import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, bad } from "@/lib/api";
import { canEditCharacter, roleInCampaign } from "@/lib/auth/rbac";
import { emitToCampaign } from "@/lib/realtime/io";
import { limitOr429 } from "@/lib/rate-limit";

// Companion creatures (familiars, wild-shape forms, summons, mounts).
// A companion snapshots its stat block into statJson — either copied and
// normalized from an SRD monster at creation time or supplied as a custom
// block — so later SRD data changes never mutate an existing companion.
// The normalized block shape is:
//   { size, type, alignment, ac, speed, str, dex, con, int, wis, cha,
//     senses, skills, languages, cr, traits:[{name,desc}], actions:[{name,desc}] }

const KINDS = ["familiar", "wildshape", "summon", "mount", "other"] as const;
const MAX_COMPANIONS = 20;
const MAX_STAT_JSON = 20_000;

const namedEntry = z.object({
  name: z.string().max(120),
  desc: z.string().max(4000),
});

// A custom / edited stat block. Everything optional so a blank creature can be
// created and filled in later.
const blockSchema = z.object({
  size: z.string().max(40).nullish(),
  type: z.string().max(80).nullish(),
  alignment: z.string().max(60).nullish(),
  ac: z.union([z.number().int().min(0).max(50), z.string().max(40)]).nullish(),
  speed: z.string().max(200).nullish(),
  str: z.number().int().min(0).max(40).nullish(),
  dex: z.number().int().min(0).max(40).nullish(),
  con: z.number().int().min(0).max(40).nullish(),
  int: z.number().int().min(0).max(40).nullish(),
  wis: z.number().int().min(0).max(40).nullish(),
  cha: z.number().int().min(0).max(40).nullish(),
  senses: z.string().max(400).nullish(),
  skills: z.string().max(400).nullish(),
  languages: z.string().max(400).nullish(),
  cr: z.string().max(20).nullish(),
  traits: z.array(namedEntry).max(60).nullish(),
  actions: z.array(namedEntry).max(60).nullish(),
}).strip();

const createSchema = z.object({
  kind: z.enum(KINDS).default("summon"),
  srcMonsterId: z.number().int().positive().optional(),
  name: z.string().trim().min(1).max(60).optional(),
  block: blockSchema.optional(),
  maxHp: z.number().int().min(1).max(2000).optional(),
  notes: z.string().max(4000).nullable().optional(),
});

const patchSchema = z.object({
  companionId: z.string().min(1),
  name: z.string().trim().min(1).max(60).optional(),
  kind: z.enum(KINDS).optional(),
  currentHp: z.number().int().min(0).max(2000).optional(),
  maxHp: z.number().int().min(1).max(2000).optional(),
  notes: z.string().max(4000).nullable().optional(),
  active: z.boolean().optional(),
  block: blockSchema.optional(),
});

type Ctx = { params: Promise<{ id: string }> };

/** Parse an SRD JSON-string column of [{name, description}] into [{name, desc}]. */
function srdEntries(s: string | null | undefined): { name: string; desc: string }[] {
  if (!s) return [];
  try {
    const arr = JSON.parse(s);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((e) => e && typeof e.name === "string")
      .slice(0, 60)
      .map((e) => ({
        name: String(e.name).slice(0, 120),
        desc: String(e.description ?? e.desc ?? "").slice(0, 4000),
      }));
  } catch {
    return [];
  }
}

/** SRD stores speed as a JSON object string like {"walk":"30 ft."} — flatten it. */
function srdSpeed(speed: string | null | undefined): string | null {
  if (!speed) return null;
  try {
    const o = JSON.parse(speed);
    if (o && typeof o === "object" && !Array.isArray(o)) {
      return Object.entries(o).map(([k, v]) => (k === "walk" ? String(v) : `${k} ${v}`)).join(", ");
    }
  } catch { /* plain string */ }
  return speed;
}

async function emitChange(characterId: string, companionId: string, by: string, extra?: Record<string, unknown>) {
  const character = await prisma.character.findUnique({ where: { id: characterId }, select: { campaignId: true } });
  if (character?.campaignId) {
    emitToCampaign(character.campaignId, "companion:updated", { characterId, companionId, by, ...extra });
  }
}

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const { user, res } = await requireUser();
  if (!user) return res!;
  const character = await prisma.character.findUnique({
    where: { id }, select: { ownerId: true, campaignId: true },
  });
  if (!character) return bad("Character not found", 404);
  // Read access: the owner, or any member of the character's campaign (DM/player/viewer).
  const allowed = character.ownerId === user.id ||
    (character.campaignId ? !!(await roleInCampaign(user.id, character.campaignId)) : false);
  if (!allowed) return bad("Not authorized", 403);

  const companions = await prisma.companion.findMany({
    where: { characterId: id },
    orderBy: [{ active: "desc" }, { createdAt: "asc" }],
  });
  return NextResponse.json({ companions });
}

export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  const { user, res } = await requireUser();
  if (!user) return res!;

  const limited = limitOr429(req, "companions", 30, 60_000);
  if (limited) return limited;

  if (!(await canEditCharacter(user.id, id))) return bad("Not authorized", 403);

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return bad("Invalid input");
  const input = parsed.data;

  const count = await prisma.companion.count({ where: { characterId: id } });
  if (count >= MAX_COMPANIONS) return bad(`A character can have at most ${MAX_COMPANIONS} companions`);

  let name: string;
  let block: z.infer<typeof blockSchema>;
  let maxHp: number;
  let srcMonsterId: number | null = null;

  if (input.srcMonsterId != null) {
    // Snapshot + normalize an SRD monster's stat block.
    const monster = await prisma.srdMonster.findUnique({ where: { id: input.srcMonsterId } });
    if (!monster) return bad("Monster not found", 404);
    block = {
      size: monster.size, type: monster.type, alignment: monster.alignment,
      ac: monster.ac ?? null, speed: srdSpeed(monster.speed),
      str: monster.str, dex: monster.dex, con: monster.con,
      int: monster.int, wis: monster.wis, cha: monster.cha,
      senses: monster.senses, skills: monster.skills, languages: monster.languages, cr: monster.cr,
      traits: srdEntries(monster.traits),
      actions: srdEntries(monster.actions),
    };
    name = input.name ?? monster.name;
    maxHp = input.maxHp ?? Math.max(1, monster.hp ?? 1);
    srcMonsterId = monster.id;
  } else {
    // Custom companion (blank or provided block).
    if (!input.name) return bad("Name is required for a custom companion");
    block = input.block ?? {};
    name = input.name;
    maxHp = input.maxHp ?? 1;
  }

  let statJson = JSON.stringify(block);
  if (statJson.length > MAX_STAT_JSON) {
    // Extremely large blocks: drop the bulkiest optional sections.
    block = { ...block, traits: [], actions: [] };
    statJson = JSON.stringify(block);
    if (statJson.length > MAX_STAT_JSON) return bad("Stat block too large");
  }

  const companion = await prisma.companion.create({
    data: {
      characterId: id,
      name,
      kind: input.kind,
      srcMonsterId,
      statJson,
      maxHp,
      currentHp: maxHp,
      notes: input.notes ?? null,
    },
  });
  await emitChange(id, companion.id, user.id);
  return NextResponse.json({ companion });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const { user, res } = await requireUser();
  if (!user) return res!;

  const limited = limitOr429(req, "companions", 60, 60_000);
  if (limited) return limited;

  if (!(await canEditCharacter(user.id, id))) return bad("Not authorized", 403);

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return bad("Invalid input");
  const { companionId, block, ...fields } = parsed.data;

  const existing = await prisma.companion.findUnique({ where: { id: companionId } });
  if (!existing || existing.characterId !== id) return bad("Companion not found", 404);

  const data: Record<string, unknown> = { ...fields };
  if (block) {
    const statJson = JSON.stringify(block);
    if (statJson.length > MAX_STAT_JSON) return bad("Stat block too large");
    data.statJson = statJson;
  }
  // Keep currentHp within [0, maxHp] whichever of the two is being changed.
  const maxHp = fields.maxHp ?? existing.maxHp;
  if (fields.currentHp != null || fields.maxHp != null) {
    data.currentHp = Math.max(0, Math.min(maxHp, fields.currentHp ?? existing.currentHp));
  }

  const companion = await prisma.companion.update({ where: { id: companionId }, data });
  await emitChange(id, companion.id, user.id);
  return NextResponse.json({ companion });
}

export async function DELETE(req: Request, { params }: Ctx) {
  const { id } = await params;
  const { user, res } = await requireUser();
  if (!user) return res!;

  if (!(await canEditCharacter(user.id, id))) return bad("Not authorized", 403);

  const companionId = new URL(req.url).searchParams.get("companionId");
  if (!companionId) return bad("companionId is required");

  const existing = await prisma.companion.findUnique({ where: { id: companionId } });
  if (!existing || existing.characterId !== id) return bad("Companion not found", 404);

  await prisma.companion.delete({ where: { id: companionId } });
  await emitChange(id, companionId, user.id, { deleted: true });
  return NextResponse.json({ ok: true });
}
