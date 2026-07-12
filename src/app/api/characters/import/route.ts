import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, bad } from "@/lib/api";
import { roleInCampaign } from "@/lib/auth/rbac";
import { emitToCampaign } from "@/lib/realtime/io";

const schema = z.object({
  __format: z.literal("dnd5e-cm-character"),
  character: z.any(),
  campaignId: z.string().nullish(),
});

export async function POST(req: Request) {
  const { user, res } = await requireUser();
  if (!user) return res!;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return bad("Invalid file");
  const c = parsed.data.character;
  const campaignId = parsed.data.campaignId || null;
  if (campaignId && !(await roleInCampaign(user.id, campaignId))) return bad("You are not a member of this campaign", 403);

  const created = await prisma.character.create({
    data: {
      ownerId: user.id,
      campaignId,
      name: (c.name ?? "Imported") + "",
      avatarUrl: c.avatarUrl ?? null,
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
