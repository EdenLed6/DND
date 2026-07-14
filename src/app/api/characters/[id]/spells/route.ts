import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, bad } from "@/lib/api";
import { canEditCharacter } from "@/lib/auth/rbac";
import { emitToCampaign } from "@/lib/realtime/io";
import { spellSlots, pactSlots } from "@/lib/dnd/rules";
import { parseSlotState, trySpendSlot } from "@/lib/dnd/spell-casting";

// SRD spell ids are numeric; homebrew ids are cuids. CharacterSpell.spellId stores both as strings.
const spellIdSchema = z.union([z.number().int(), z.string().min(1)]);
const addSchema = z.object({ spellId: spellIdSchema, source: z.string().optional(), prepared: z.boolean().optional() });
const patchSchema = z.object({ spellId: spellIdSchema, prepared: z.boolean() });
// Casting mechanics: spend a slot at `level`. 0 = cantrip (no slot). upcastFrom = the
// spell's own base level (informational). pact = spend a Warlock pact slot. ritual = no slot.
const castSchema = z.object({
  op: z.literal("cast"),
  level: z.number().int().min(0).max(9),
  upcastFrom: z.number().int().min(0).max(9).optional(),
  pact: z.boolean().optional(),
  spellId: spellIdSchema.optional(),
  ritual: z.boolean().optional(),
});

function isSrdId(spellId: string | number): boolean {
  return !isNaN(Number(spellId));
}

async function broadcast(characterId: string, userId: string, patch: Record<string, boolean> = { spells: true }) {
  const c = await prisma.character.findUnique({ where: { id: characterId }, select: { campaignId: true } });
  if (c?.campaignId) emitToCampaign(c.campaignId, "character:updated", { characterId, patch, by: userId });
}

type ClassRef = { name: string; level: number };

// Build the {slotsUsed, remaining} view Agent F (and the sheet) rely on.
// slotsUsed mirrors spellcastingJson ({ "<level>": used, pactUsed }); remaining is availability.
function slotView(json: string | null | undefined, classes: ClassRef[]) {
  const { slotsUsed, pactUsed } = parseSlotState(json);
  const totals = spellSlots(classes);
  const pact = pactSlots(classes);
  const remainingSlots: Record<string, number> = {};
  for (let lvl = 1; lvl <= 9; lvl++) {
    const max = totals[lvl - 1] ?? 0;
    if (max > 0) remainingSlots[String(lvl)] = Math.max(0, max - (slotsUsed[lvl] ?? 0));
  }
  return {
    slotsUsed: { ...slotsUsed, pactUsed },
    remaining: {
      slots: remainingSlots,
      pact: pact ? { level: pact.level, available: Math.max(0, pact.slots - pactUsed) } : null,
    },
  };
}

/**
 * The single source of truth for spending a spell slot — used by the sheet's
 * Cast panel and by the live battle (Agent F). Cantrips (level 0) and rituals
 * never consume a slot. Returns { ok, level, pact, slotsUsed, remaining }.
 */
async function handleCast(id: string, userId: string, data: z.infer<typeof castSchema>) {
  const { level, upcastFrom, pact: viaPact, spellId, ritual } = data;

  const c = await prisma.character.findUnique({ where: { id }, include: { classes: true } });
  if (!c) return bad("Character not found", 404);
  const classes: ClassRef[] = c.classes.map((cl) => ({ name: cl.classId, level: cl.level }));
  const totals = spellSlots(classes);
  const pact = pactSlots(classes);

  // Resolve the spell when a spellId is given (ritual validation + slot-level sanity).
  if (spellId !== undefined) {
    let spellLevel: number | null = null;
    let spellIsRitual = false;
    if (isSrdId(spellId)) {
      const s = await prisma.srdSpell.findUnique({ where: { id: Number(spellId) }, select: { level: true, ritual: true } });
      if (s) { spellLevel = s.level; spellIsRitual = s.ritual; }
    } else {
      const h = await prisma.homebrewSpell.findUnique({ where: { id: String(spellId) } });
      if (h) { try { const d = JSON.parse(h.dataJson || "{}"); spellLevel = Number(d.level) || 0; spellIsRitual = !!d.ritual; } catch { spellLevel = 0; } }
    }
    if (spellLevel === null) return bad("Spell not found", 404);
    if (!ritual && spellLevel > 0 && level < spellLevel) return bad(`Slot level ${level} is below spell level ${spellLevel}`);
    if (ritual && !spellIsRitual) return bad("Spell is not a ritual");
  }

  // Rituals and cantrips consume no slot — just report current state.
  if (ritual || level === 0) {
    return NextResponse.json({ ok: true, level, ritual: !!ritual, pact: false, ...slotView(c.spellcastingJson, classes) });
  }

  // Spend a slot.
  let updatedJson: string;
  let usedPact = false;
  if (viaPact) {
    const { obj, pactUsed } = parseSlotState(c.spellcastingJson);
    const max = pact?.slots ?? 0;
    if (pactUsed >= max) return bad("No slots of that level");
    obj.pactUsed = pactUsed + 1;
    updatedJson = JSON.stringify(obj);
    usedPact = true;
  } else {
    const spent = trySpendSlot(c.spellcastingJson, level, totals, pact);
    if (!spent.ok) return bad("No slots of that level");
    updatedJson = spent.json;
  }

  await prisma.character.update({ where: { id }, data: { spellcastingJson: updatedJson } });
  if (c.campaignId) emitToCampaign(c.campaignId, "character:updated", { characterId: id, patch: { spellcasting: true }, by: userId });
  return NextResponse.json({ ok: true, level, upcastFrom: upcastFrom ?? null, pact: usedPact, ...slotView(updatedJson, classes) });
}

/**
 * POST — two ops:
 *  - add a spell (default): {spellId, source?, prepared?}
 *  - cast: {op:"cast", level, upcastFrom?, pact?, spellId?, ritual?}
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, res } = await requireUser();
  if (!user) return res!;
  if (!(await canEditCharacter(user.id, id))) return bad("Not authorized", 403);
  const body = await req.json().catch(() => null);

  if (body && typeof body === "object" && (body as { op?: unknown }).op === "cast") {
    const parsed = castSchema.safeParse(body);
    if (!parsed.success) return bad("Invalid input");
    return handleCast(id, user.id, parsed.data);
  }

  const parsed = addSchema.safeParse(body);
  if (!parsed.success) return bad("Invalid input");
  await prisma.characterSpell.upsert({
    where: { characterId_spellId: { characterId: id, spellId: String(parsed.data.spellId) } },
    update: { prepared: parsed.data.prepared ?? false, source: parsed.data.source },
    create: { characterId: id, spellId: String(parsed.data.spellId), prepared: parsed.data.prepared ?? false, source: parsed.data.source },
  });
  await broadcast(id, user.id);
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, res } = await requireUser();
  if (!user) return res!;
  if (!(await canEditCharacter(user.id, id))) return bad("Not authorized", 403);
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return bad("Invalid input");
  await prisma.characterSpell.updateMany({
    where: { characterId: id, spellId: String(parsed.data.spellId) }, data: { prepared: parsed.data.prepared },
  });
  await broadcast(id, user.id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, res } = await requireUser();
  if (!user) return res!;
  if (!(await canEditCharacter(user.id, id))) return bad("Not authorized", 403);
  const { searchParams } = new URL(req.url);
  const spellId = searchParams.get("spellId");
  if (!spellId) return bad("spellId required");
  await prisma.characterSpell.deleteMany({ where: { characterId: id, spellId } });
  await broadcast(id, user.id);
  return NextResponse.json({ ok: true });
}
