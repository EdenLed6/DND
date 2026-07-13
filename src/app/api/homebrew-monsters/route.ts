import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, bad } from "@/lib/api";
import { isDM } from "@/lib/auth/rbac";
import { limitOr429 } from "@/lib/rate-limit";

// Homebrew monsters (SPEC-DM §9.4). statBlockJson stores the SAME shape as an
// SrdMonster row (minus id) so the combat engine can consume it unchanged:
// top-level scalar columns + `traits`/`actions`/`legendaryActions`/`reactions`
// as JSON-STRING columns of [{ name, description }] — exactly what
// parseActions() in src/lib/dnd/combat.ts expects.

const CR_VALUES = [
  "0", "1/8", "1/4", "1/2",
  ...Array.from({ length: 30 }, (_, i) => String(i + 1)),
] as [string, ...string[]];

const abilityScore = z.number().int().min(1).max(30);

/** A JSON string encoding [{ name, description }, ...] (the SRD column format). */
const namedEntryList = z.string().max(12000).refine((s) => {
  try {
    const arr = JSON.parse(s);
    return Array.isArray(arr) && arr.every(
      (e) => e && typeof e === "object" &&
        typeof e.name === "string" && e.name.length <= 120 &&
        typeof e.description === "string" && e.description.length <= 4000,
    );
  } catch { return false; }
}, "must be a JSON string of [{name, description}]").nullish();

const statBlockSchema = z.object({
  name: z.string().min(1).max(80),
  size: z.string().max(20).nullish(),
  type: z.string().max(40).nullish(),
  subtype: z.string().max(60).nullish(),
  alignment: z.string().max(60).nullish(),
  ac: z.number().int().min(1).max(30),
  acType: z.string().max(80).nullish(),
  hp: z.number().int().min(1).max(1000),
  hitDice: z.string().max(40).nullish(),
  speed: z.string().max(200).nullish(),
  str: abilityScore, dex: abilityScore, con: abilityScore,
  int: abilityScore, wis: abilityScore, cha: abilityScore,
  cr: z.enum(CR_VALUES),
  xp: z.number().int().min(0).max(500000).nullish(),
  proficiencyBonus: z.number().int().min(0).max(12).nullish(),
  senses: z.string().max(300).nullish(),
  languages: z.string().max(300).nullish(),
  resistances: z.string().max(400).nullish(),
  immunities: z.string().max(400).nullish(),
  vulnerabilities: z.string().max(400).nullish(),
  conditionImmunities: z.string().max(400).nullish(),
  savingThrows: z.string().max(400).nullish(),
  skills: z.string().max(1000).nullish(),
  traits: namedEntryList,
  actions: namedEntryList,
  legendaryActions: namedEntryList,
  reactions: namedEntryList,
});

/** Validate a raw statBlockJson string. Returns the parsed name or an error. */
function checkStatBlock(raw: string): { ok: true; name: string } | { ok: false; error: string } {
  if (raw.length > 20000) return { ok: false, error: "Stat block too large (max 20000 chars)" };
  let obj: unknown;
  try { obj = JSON.parse(raw); } catch { return { ok: false, error: "statBlockJson is not valid JSON" }; }
  const parsed = statBlockSchema.safeParse(obj);
  if (!parsed.success) {
    const issues = parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    return { ok: false, error: `Invalid stat block — ${issues}` };
  }
  return { ok: true, name: parsed.data.name };
}

const createSchema = z.object({
  name: z.string().min(1).max(80),
  campaignId: z.string().max(64).nullish(),
  statBlockJson: z.string().min(2).max(20000),
});

const patchSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(80).optional(),
  campaignId: z.string().max(64).nullish().optional(),
  statBlockJson: z.string().min(2).max(20000).optional(),
});

/** GET ?mine=1 — the user's homebrew plus homebrew of campaigns they DM. */
export async function GET(req: Request) {
  const { user, res } = await requireUser();
  if (!user) return res!;
  const dmCampaigns = await prisma.campaign.findMany({ where: { dmId: user.id }, select: { id: true } });
  const monsters = await prisma.homebrewMonster.findMany({
    where: {
      OR: [
        { ownerId: user.id },
        ...(dmCampaigns.length ? [{ campaignId: { in: dmCampaigns.map((c) => c.id) } }] : []),
      ],
    },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(monsters);
}

export async function POST(req: Request) {
  const { user, res } = await requireUser();
  if (!user) return res!;
  const limited = limitOr429(req, "homebrew-monsters", 30, 60_000);
  if (limited) return limited;

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return bad("Invalid input: " + parsed.error.issues.map((i) => i.path.join(".")).join(", "));
  const d = parsed.data;

  const sb = checkStatBlock(d.statBlockJson);
  if (!sb.ok) return bad(sb.error);
  if (d.campaignId && !(await isDM(user.id, d.campaignId))) {
    return bad("Only the DM may attach homebrew to this campaign", 403);
  }

  const monster = await prisma.homebrewMonster.create({
    data: { ownerId: user.id, campaignId: d.campaignId || null, name: d.name, statBlockJson: d.statBlockJson },
  });
  return NextResponse.json(monster);
}

export async function PATCH(req: Request) {
  const { user, res } = await requireUser();
  if (!user) return res!;
  const limited = limitOr429(req, "homebrew-monsters", 30, 60_000);
  if (limited) return limited;

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return bad("Invalid input: " + parsed.error.issues.map((i) => i.path.join(".")).join(", "));
  const d = parsed.data;

  const existing = await prisma.homebrewMonster.findUnique({ where: { id: d.id } });
  if (!existing || existing.ownerId !== user.id) return bad("Not your homebrew monster", 403);

  if (d.statBlockJson !== undefined) {
    const sb = checkStatBlock(d.statBlockJson);
    if (!sb.ok) return bad(sb.error);
  }
  if (d.campaignId && !(await isDM(user.id, d.campaignId))) {
    return bad("Only the DM may attach homebrew to this campaign", 403);
  }

  const data: { name?: string; campaignId?: string | null; statBlockJson?: string } = {};
  if (d.name !== undefined) data.name = d.name;
  if (d.campaignId !== undefined) data.campaignId = d.campaignId || null;
  if (d.statBlockJson !== undefined) data.statBlockJson = d.statBlockJson;

  const monster = await prisma.homebrewMonster.update({ where: { id: d.id }, data });
  return NextResponse.json(monster);
}

export async function DELETE(req: Request) {
  const { user, res } = await requireUser();
  if (!user) return res!;
  const limited = limitOr429(req, "homebrew-monsters", 30, 60_000);
  if (limited) return limited;

  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!id) return bad("id required");
  const existing = await prisma.homebrewMonster.findUnique({ where: { id } });
  if (!existing || existing.ownerId !== user.id) return bad("Not your homebrew monster", 403);

  await prisma.homebrewMonster.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
