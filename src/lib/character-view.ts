import { prisma } from "@/lib/db";
import { derive, type CharacterInput, type CharClassInput, type ArmorInput } from "@/lib/dnd/character";
import type { Ability } from "@/lib/dnd/rules";

export async function loadCharacterView(id: string) {
  const character = await prisma.character.findUnique({
    where: { id },
    include: { classes: true, skills: true, items: true, spells: true, resources: true, campaign: true, owner: true },
  });
  if (!character) return null;

  // resolve equipped armor/shield from SRD equipment
  const equippedArmorItems = character.items.filter((i) => i.equipped && i.srcEquipmentId);
  let equippedArmor: ArmorInput | null = null;
  let equippedShield = false;
  if (equippedArmorItems.length) {
    const srdEquip = await prisma.srdEquipment.findMany({
      where: { id: { in: equippedArmorItems.map((i) => i.srcEquipmentId!).filter(Boolean) } },
    });
    for (const e of srdEquip) {
      if (e.armorCategory && /shield/i.test(e.name)) equippedShield = true;
      else if (e.armorCategory && e.acBase != null) {
        equippedArmor = { armorCategory: e.armorCategory, acBase: e.acBase, acMaxBonus: e.acMaxBonus };
      }
    }
  }

  const prof = safeJson<{ savingThrows?: string[]; baseSpeed?: number }>(character.proficienciesJson, {});
  const classes: CharClassInput[] = character.classes.map((c) => ({
    name: c.classId, subclass: c.subclass, level: c.level, isPrimary: c.isPrimary,
  }));

  // Unarmored defense detection
  let unarmoredDefense: "barbarian" | "monk" | null = null;
  if (!equippedArmor) {
    if (classes.some((c) => c.name === "Barbarian")) unarmoredDefense = "barbarian";
    else if (classes.some((c) => c.name === "Monk")) unarmoredDefense = "monk";
  }

  const input: CharacterInput = {
    str: character.str, dex: character.dex, con: character.con,
    int: character.int, wis: character.wis, cha: character.cha,
    xp: character.xp,
    classes,
    skills: character.skills.map((s) => ({ skill: s.skill, proficient: s.proficient, expertise: s.expertise })),
    savingThrowProfs: (prof.savingThrows ?? []).map((s) => s.toLowerCase()) as Ability[],
    maxHpBonus: character.maxHpBonus,
    acOverride: character.acOverride,
    speedOverride: character.speedOverride,
    baseSpeed: prof.baseSpeed ?? 30,
    equippedArmor,
    equippedShield,
    unarmoredDefense,
    cp: character.cp, sp: character.sp, ep: character.ep, gp: character.gp, pp: character.pp,
  };

  return { character, derived: derive(input) };
}

function safeJson<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback;
  try { return JSON.parse(s) as T; } catch { return fallback; }
}
