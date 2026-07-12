import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/api";

/** Options needed by the character creation wizard. */
export async function GET() {
  const { user, res } = await requireUser();
  if (!user) return res!;

  const [races, classes, backgrounds] = await Promise.all([
    prisma.srdRace.findMany({ orderBy: { name: "asc" } }),
    prisma.srdClass.findMany({ orderBy: { name: "asc" } }),
    prisma.srdBackground.findMany({ orderBy: { name: "asc" } }),
  ]);

  return NextResponse.json({
    races: races.map((r) => ({
      id: r.id, name: r.name, size: r.size, speed: r.speed,
      abilityBonuses: JSON.parse(r.abilityBonuses ?? "[]"),
      traits: JSON.parse(r.traits ?? "[]"),
      languages: r.languages, subraces: JSON.parse(r.subraces ?? "[]"),
    })),
    classes: classes.map((c) => ({
      id: c.id, name: c.name, hitDie: c.hitDie,
      savingThrows: JSON.parse(c.savingThrows ?? "[]"),
      proficiencies: JSON.parse(c.proficiencies ?? "{}"),
      spellcastingAbility: c.spellcastingAbility,
      subclasses: JSON.parse(c.subclasses ?? "[]"),
    })),
    backgrounds: backgrounds.map((b) => ({
      id: b.id, name: b.name, skills: JSON.parse(b.skills ?? "[]"),
      tools: JSON.parse(b.tools ?? "[]"), featureName: b.featureName,
      featureDesc: b.featureDesc, startGp: b.startGp,
    })),
  });
}
