import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, bad, safeImageUrl } from "@/lib/api";
import { roleInCampaign } from "@/lib/auth/rbac";
import { emitToCampaign } from "@/lib/realtime/io";
import { limitOr429 } from "@/lib/rate-limit";

const str = (max: number) => z.string().max(max).nullish();
const characterSchema = z.object({
  name: z.string().max(60).optional(),
  avatarUrl: str(2000),
  raceId: str(60), subrace: str(60), background: str(60), alignment: str(40),
  str: z.number().int().min(1).max(30).optional(), dex: z.number().int().min(1).max(30).optional(),
  con: z.number().int().min(1).max(30).optional(), int: z.number().int().min(1).max(30).optional(),
  wis: z.number().int().min(1).max(30).optional(), cha: z.number().int().min(1).max(30).optional(),
  xp: z.number().int().min(0).max(1_000_000).optional(),
  maxHpBonus: z.number().int().min(-1000).max(10000).optional(),
  currentHp: z.number().int().optional(), tempHp: z.number().int().min(0).max(10000).optional(),
  hitDiceUsed: z.number().int().min(0).max(100).optional(), exhaustion: z.number().int().min(0).max(6).optional(),
  conditions: str(2000),
  cp: z.number().int().min(0).optional(), sp: z.number().int().min(0).optional(), ep: z.number().int().min(0).optional(),
  gp: z.number().int().min(0).optional(), pp: z.number().int().min(0).optional(),
  personality: str(4000), ideals: str(4000), bonds: str(4000), flaws: str(4000), backstory: str(20000), notes: str(20000),
  proficienciesJson: str(20000), featuresJson: str(50000), spellcastingJson: str(20000),
  classes: z.array(z.object({ classId: z.string().max(40), subclass: z.string().max(60).nullish(), level: z.number().int().min(1).max(20).optional(), isPrimary: z.boolean().optional() })).max(20).optional(),
  skills: z.array(z.object({ skill: z.string().max(40), proficient: z.boolean().optional(), expertise: z.boolean().optional() })).max(40).optional(),
  spells: z.array(z.object({ spellId: z.string().max(40), prepared: z.boolean().optional(), alwaysPrepared: z.boolean().optional(), source: z.string().max(40).nullish() })).max(500).optional(),
  items: z.array(z.object({ name: z.string().max(120), quantity: z.number().int().min(1).max(10000).optional(), equipped: z.boolean().optional(), attuned: z.boolean().optional(), srcEquipmentId: z.string().max(40).nullish(), srcMagicItemId: z.string().max(40).nullish(), customJson: z.string().max(4000).nullish() })).max(300).optional(),
  resources: z.array(z.object({ name: z.string().max(80), max: z.number().int().min(0).max(1000).optional(), used: z.number().int().min(0).max(1000).optional(), resetOn: z.string().max(10).optional() })).max(50).optional(),
}).passthrough();

const schema = z.object({
  __format: z.literal("dnd5e-cm-character"),
  character: characterSchema,
  campaignId: z.string().max(40).nullish(),
});

export async function POST(req: Request) {
  const limited = limitOr429(req, "import", 10, 10 * 60_000); // 10 imports / 10 min / IP
  if (limited) return limited;
  const { user, res } = await requireUser();
  if (!user) return res!;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return bad("Invalid file");
  const c = parsed.data.character;
  const campaignId = parsed.data.campaignId || null;
  if (campaignId) {
    const role = await roleInCampaign(user.id, campaignId);
    if (role !== "DM" && role !== "PLAYER") return bad("You are not a member of this campaign", 403);
    // Prevent importing a maxed-out sheet into a campaign to bypass the DM's
    // XP/level progression. The DM can adjust afterwards via the audited flow.
    if (role !== "DM") {
      c.xp = 0;
      if (Array.isArray(c.classes)) c.classes = c.classes.map((cl) => ({ ...cl, level: 1 }));
    }
  }

  const created = await prisma.character.create({
    data: {
      ownerId: user.id,
      campaignId,
      name: (c.name ?? "Imported") + "",
      avatarUrl: safeImageUrl(c.avatarUrl),
      raceId: c.raceId ?? "Human", subrace: c.subrace ?? null, background: c.background ?? null,
      alignment: c.alignment ?? null,
      str: c.str ?? 10, dex: c.dex ?? 10, con: c.con ?? 10, int: c.int ?? 10, wis: c.wis ?? 10, cha: c.cha ?? 10,
      xp: c.xp ?? 0, maxHpBonus: c.maxHpBonus ?? 0,
      currentHp: c.currentHp ?? 1, tempHp: c.tempHp ?? 0, hitDiceUsed: c.hitDiceUsed ?? 0,
      exhaustion: c.exhaustion ?? 0, conditions: c.conditions ?? "[]",
      cp: c.cp ?? 0, sp: c.sp ?? 0, ep: c.ep ?? 0, gp: c.gp ?? 0, pp: c.pp ?? 0,
      personality: c.personality ?? null, ideals: c.ideals ?? null, bonds: c.bonds ?? null,
      flaws: c.flaws ?? null, backstory: c.backstory ?? null, notes: c.notes ?? null,
      proficienciesJson: c.proficienciesJson ?? "{}", featuresJson: c.featuresJson ?? "[]",
      spellcastingJson: c.spellcastingJson ?? "{}",
      classes: { create: (c.classes ?? []).map((cl: any) => ({ classId: cl.classId, subclass: cl.subclass ?? null, level: cl.level ?? 1, isPrimary: cl.isPrimary ?? false })) },
      skills: { create: (c.skills ?? []).map((s: any) => ({ skill: s.skill, proficient: !!s.proficient, expertise: !!s.expertise })) },
      spells: { create: (c.spells ?? []).map((s: any) => ({ spellId: s.spellId, prepared: !!s.prepared, alwaysPrepared: !!s.alwaysPrepared, source: s.source ?? null })) },
      items: { create: (c.items ?? []).map((i: any) => ({ name: i.name, quantity: i.quantity ?? 1, equipped: !!i.equipped, attuned: !!i.attuned, srcEquipmentId: i.srcEquipmentId ?? null, srcMagicItemId: i.srcMagicItemId ?? null, customJson: i.customJson ?? null })) },
      resources: { create: (c.resources ?? []).map((r: any) => ({ name: r.name, max: r.max ?? 0, used: r.used ?? 0, resetOn: r.resetOn ?? "LONG" })) },
    },
  });
  if (campaignId) emitToCampaign(campaignId, "character:created", { characterId: created.id, name: created.name, ownerId: user.id });
  return NextResponse.json({ id: created.id });
}
