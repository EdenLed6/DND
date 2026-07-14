import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, bad } from "@/lib/api";
import { roleInCampaign } from "@/lib/auth/rbac";
import { derive } from "@/lib/dnd/character";
import { fromCopper, type Ability } from "@/lib/dnd/rules";
import { emitToCampaign } from "@/lib/realtime/io";

const schema = z.object({
  name: z.string().min(1).max(60),
  campaignId: z.string().nullish(),
  raceName: z.string(),
  subrace: z.string().nullish(),
  className: z.string(),
  background: z.string().nullish(),
  alignment: z.string().nullish(),
  abilities: z.object({ str: z.number(), dex: z.number(), con: z.number(), int: z.number(), wis: z.number(), cha: z.number() }),
  skills: z.array(z.string()).default([]),
  baseSpeed: z.number().default(30),
  savingThrows: z.array(z.string()).default([]),
  startGp: z.number().default(0),
});

export async function POST(req: Request) {
  const { user, res } = await requireUser();
  if (!user) return res!;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return bad("Invalid input: " + parsed.error.issues.map((i) => i.path.join(".")).join(", "));
  const d = parsed.data;

  if (d.campaignId) {
    const role = await roleInCampaign(user.id, d.campaignId);
    // VIEWER is read-only; only DM/PLAYER may add characters to a campaign.
    if (role !== "DM" && role !== "PLAYER") return bad("You are not a member of this campaign", 403);
  }

  const saveProfs = d.savingThrows.map((s) => s.toLowerCase()).filter((s) => ["str", "dex", "con", "int", "wis", "cha"].includes(s)) as Ability[];
  const derived = derive({
    ...d.abilities, xp: 0,
    classes: [{ name: d.className, level: 1, isPrimary: true }],
    skills: d.skills.map((s) => ({ skill: s, proficient: true, expertise: false })),
    savingThrowProfs: saveProfs, baseSpeed: d.baseSpeed,
  });
  const purse = fromCopper(d.startGp * 100);

  const character = await prisma.character.create({
    data: {
      ownerId: user.id,
      campaignId: d.campaignId || null,
      name: d.name,
      raceId: d.raceName,
      subrace: d.subrace || null,
      background: d.background || null,
      alignment: d.alignment || null,
      str: d.abilities.str, dex: d.abilities.dex, con: d.abilities.con,
      int: d.abilities.int, wis: d.abilities.wis, cha: d.abilities.cha,
      currentHp: derived.maxHp,
      cp: purse.cp, sp: purse.sp, ep: purse.ep, gp: purse.gp, pp: purse.pp,
      proficienciesJson: JSON.stringify({ savingThrows: saveProfs, baseSpeed: d.baseSpeed }),
      classes: { create: { classId: d.className, level: 1, isPrimary: true } },
      skills: { create: d.skills.map((s) => ({ skill: s, proficient: true })) },
    },
    include: { classes: true },
  });

  if (d.campaignId) emitToCampaign(d.campaignId, "character:created", { characterId: character.id, name: character.name, ownerId: user.id });
  return NextResponse.json(character);
}
