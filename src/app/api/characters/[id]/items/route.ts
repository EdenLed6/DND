import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, bad } from "@/lib/api";
import { canEditCharacter } from "@/lib/auth/rbac";
import { emitToCampaign } from "@/lib/realtime/io";
import { toCopper, fromCopper, COIN_TO_CP } from "@/lib/dnd/rules";

const LOCATIONS = ["equipped", "backpack", "pocket", "storage"] as const;
const MAX_ATTUNED = 3;

/** Equip-effect / homebrew payload stored in customJson (sane caps). */
const effectsSchema = z.object({
  category: z.string().max(60).optional(),
  costGp: z.number().min(0).max(1_000_000).optional(),
  weight: z.number().min(0).max(10_000).optional(),
  desc: z.string().max(1_000).optional(),
  notes: z.string().max(1_000).optional(),
  damage: z.string().max(40).optional(),
  acBonus: z.number().int().min(-5).max(10).optional(),
  acBase: z.number().int().min(5).max(25).optional(),
  addDex: z.boolean().optional(),
  maxDex: z.number().int().min(0).max(10).optional(),
  attunement: z.boolean().optional(),
});

const addSchema = z.object({
  name: z.string().min(1).max(120).optional(), // required unless homebrewItemId given
  quantity: z.number().int().min(1).max(999).default(1),
  srcEquipmentId: z.number().int().optional(),
  srcMagicItemId: z.number().int().optional(),
  homebrewItemId: z.string().optional(),
  equipped: z.boolean().optional(), // legacy
  location: z.enum(LOCATIONS).optional(),
  buy: z.boolean().optional(), // deduct price from the character's purse
  custom: effectsSchema.optional(),
});

const patchSchema = z.object({
  itemId: z.string(),
  quantity: z.number().int().min(1).max(999).optional(),
  equipped: z.boolean().optional(), // legacy — kept in sync with location
  attuned: z.boolean().optional(),
  location: z.enum(LOCATIONS).optional(),
  customJson: z.string().max(4000).optional(),
});

function safeJson<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback;
  try { return JSON.parse(s) as T; } catch { return fallback; }
}

/**
 * Build an equip-effect customJson blob from an SRD equipment row so effects
 * (AC / damage / weight / cost) work offline. Field names match the parser in
 * src/lib/dnd/equip-effects.ts (canonical: acBase, addDex, acMaxBonus, acBonus,
 * damage, weightLb, costGp, desc, name).
 */
function equipEffectJson(e: {
  name: string; armorCategory: string | null; acBase: number | null; acDexBonus: boolean | null;
  acMaxBonus: number | null; damageDice: string | null; damageType: string | null;
  weight: number | null; costGp: number | null; costUnit: string | null; description: string | null;
}): string {
  const eff: Record<string, unknown> = { name: e.name };
  const isShield = /shield/i.test(e.name) || /shield/i.test(e.armorCategory ?? "");
  if (isShield) {
    eff.acBonus = e.acBase ?? 2; // shields grant a flat bonus, no acBase
  } else if (e.armorCategory && e.acBase != null) {
    eff.acBase = e.acBase;
    const heavy = /heavy/i.test(e.armorCategory);
    eff.addDex = e.acDexBonus ?? !heavy; // light/medium add DEX, heavy does not
    if (e.acMaxBonus != null) eff.acMaxBonus = e.acMaxBonus;
    else if (/medium/i.test(e.armorCategory)) eff.acMaxBonus = 2;
  }
  if (e.damageDice) { eff.damage = e.damageDice; if (e.damageType) eff.damageType = e.damageType; }
  if (e.weight != null) eff.weightLb = e.weight;
  if (e.costGp != null) { eff.costGp = e.costGp; if (e.costUnit) eff.costUnit = e.costUnit; }
  if (e.description) eff.desc = e.description.slice(0, 2000);
  return JSON.stringify(eff);
}

/** Build a customJson blob from an SRD magic item (attunement + description). */
function magicEffectJson(m: {
  name: string; rarity: string | null; type: string | null;
  requiresAttunement: boolean; description: string | null;
}): string {
  const eff: Record<string, unknown> = { name: m.name };
  if (m.requiresAttunement) { eff.requiresAttunement = true; eff.attunement = true; }
  if (m.rarity) eff.rarity = m.rarity;
  if (m.type) eff.type = m.type;
  if (m.description) eff.desc = m.description.slice(0, 2000);
  return JSON.stringify(eff);
}

async function broadcast(characterId: string, userId: string, extra: Record<string, boolean> = {}) {
  const c = await prisma.character.findUnique({ where: { id: characterId }, select: { campaignId: true } });
  if (c?.campaignId) emitToCampaign(c.campaignId, "character:updated", { characterId, patch: { items: true, ...extra }, by: userId });
}

/** GET — campaign homebrew items for the picker. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, res } = await requireUser();
  if (!user) return res!;
  if (!(await canEditCharacter(user.id, id))) return bad("Not authorized", 403);
  const character = await prisma.character.findUnique({ where: { id }, select: { campaignId: true } });
  if (!character) return bad("Not found", 404);
  const rows = await prisma.homebrewItem.findMany({
    where: {
      OR: [
        ...(character.campaignId ? [{ campaignId: character.campaignId }] : []),
        { ownerId: user.id },
      ],
    },
    orderBy: { name: "asc" },
    take: 100,
  });
  const homebrew = rows.map((r) => {
    const d = safeJson<any>(r.dataJson, {});
    return {
      id: r.id, name: r.name, kind: "homebrew" as const,
      category: d.category ?? null, costGp: typeof d.costGp === "number" ? d.costGp : null,
      weight: typeof d.weight === "number" ? d.weight : null, desc: d.desc ?? null,
      acBonus: typeof d.acBonus === "number" ? d.acBonus : null,
      acBase: typeof d.acBase === "number" ? d.acBase : null,
      damage: d.damage ?? null,
    };
  });
  return NextResponse.json({ homebrew });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, res } = await requireUser();
  if (!user) return res!;
  if (!(await canEditCharacter(user.id, id))) return bad("Not authorized", 403);
  const parsed = addSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return bad("Invalid input");
  const d = parsed.data;

  const character = await prisma.character.findUnique({
    where: { id },
    select: { campaignId: true, cp: true, sp: true, ep: true, gp: true, pp: true },
  });
  if (!character) return bad("Not found", 404);

  let name = d.name ?? "";
  let customJson: string | null = null;
  let priceCp = 0; // per unit, in copper

  if (d.homebrewItemId) {
    const hb = await prisma.homebrewItem.findUnique({ where: { id: d.homebrewItemId } });
    if (!hb) return bad("Homebrew item not found", 404);
    const inCampaign = character.campaignId != null && hb.campaignId === character.campaignId;
    if (!inCampaign && hb.ownerId !== user.id) return bad("Not authorized", 403);
    name = hb.name;
    const fx = effectsSchema.safeParse(safeJson<any>(hb.dataJson, {}));
    const effects = fx.success ? fx.data : {};
    if (Object.keys(effects).length) customJson = JSON.stringify(effects);
    if (typeof effects.costGp === "number") priceCp = Math.round(effects.costGp * 100);
  } else if (d.srcEquipmentId != null) {
    const eq = await prisma.srdEquipment.findUnique({ where: { id: d.srcEquipmentId } });
    if (!eq) return bad("Equipment not found", 404);
    if (!name) name = eq.name;
    // Copy armor AC / weapon damage / weight / cost into customJson so effects
    // work offline (see src/lib/dnd/equip-effects.ts).
    customJson = equipEffectJson(eq);
    if (eq.costGp != null) priceCp = Math.round(eq.costGp * (COIN_TO_CP[eq.costUnit ?? "gp"] ?? 100));
  } else if (d.srcMagicItemId != null) {
    const mi = await prisma.srdMagicItem.findUnique({ where: { id: d.srcMagicItemId } });
    if (!mi) return bad("Magic item not found", 404);
    if (!name) name = mi.name;
    customJson = magicEffectJson(mi);
  } else if (d.custom) {
    customJson = JSON.stringify(d.custom);
    if (typeof d.custom.costGp === "number") priceCp = Math.round(d.custom.costGp * 100);
  }
  if (!name) return bad("Name required");

  const location = d.location ?? (d.equipped ? "equipped" : "backpack");
  const equipped = location === "equipped";

  // Buying: deduct the price from the purse (cp/sp/ep/gp/pp normalized via copper).
  let purseUpdate: ReturnType<typeof fromCopper> | null = null;
  if (d.buy) {
    const total = priceCp * d.quantity;
    if (total <= 0) return bad("This item has no listed price — use Add instead");
    const have = toCopper(character);
    if (have < total) return bad("Not enough coin");
    purseUpdate = fromCopper(have - total);
  }

  const [item] = await prisma.$transaction([
    prisma.inventoryItem.create({
      data: {
        characterId: id, name, quantity: d.quantity, equipped, location, customJson,
        srcEquipmentId: d.srcEquipmentId != null ? String(d.srcEquipmentId) : null,
        srcMagicItemId: d.srcMagicItemId != null ? String(d.srcMagicItemId) : null,
      },
    }),
    ...(purseUpdate ? [prisma.character.update({ where: { id }, data: purseUpdate })] : []),
  ]);
  await broadcast(id, user.id, purseUpdate ? { purse: true } : {});
  return NextResponse.json(item);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, res } = await requireUser();
  if (!user) return res!;
  if (!(await canEditCharacter(user.id, id))) return bad("Not authorized", 403);
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return bad("Invalid input");
  const { itemId, ...body } = parsed.data;
  const item = await prisma.inventoryItem.findFirst({ where: { id: itemId, characterId: id } });
  if (!item) return bad("Not found", 404);

  const data: Record<string, unknown> = {};
  if (body.quantity != null) data.quantity = body.quantity;
  if (body.customJson != null) data.customJson = body.customJson;

  // Location moves keep the legacy `equipped` flag in sync (equipped ⇔ location === "equipped").
  if (body.location) {
    data.location = body.location;
    data.equipped = body.location === "equipped";
  } else if (body.equipped != null) {
    data.equipped = body.equipped;
    data.location = body.equipped ? "equipped" : (item.location === "equipped" ? "backpack" : item.location);
  }

  if (body.attuned != null) {
    if (body.attuned) {
      const needsAttunement = item.srcMagicItemId != null || safeJson<any>(item.customJson, {}).attunement === true;
      if (!needsAttunement) return bad("This item doesn't require attunement");
      const attunedCount = await prisma.inventoryItem.count({
        where: { characterId: id, attuned: true, id: { not: itemId } },
      });
      if (attunedCount >= MAX_ATTUNED) return bad(`Attunement limit reached (${MAX_ATTUNED})`);
    }
    data.attuned = body.attuned;
  }

  await prisma.inventoryItem.update({ where: { id: itemId }, data });
  await broadcast(id, user.id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, res } = await requireUser();
  if (!user) return res!;
  if (!(await canEditCharacter(user.id, id))) return bad("Not authorized", 403);
  const { searchParams } = new URL(req.url);
  const itemId = searchParams.get("itemId");
  if (!itemId) return bad("itemId required");
  await prisma.inventoryItem.deleteMany({ where: { id: itemId, characterId: id } });
  await broadcast(id, user.id);
  return NextResponse.json({ ok: true });
}
