import { prisma } from "@/lib/db";
import { derive, type CharacterInput, type CharClassInput, type ArmorInput } from "@/lib/dnd/character";
import type { Ability } from "@/lib/dnd/rules";
import { subclassFeaturesUpTo } from "@/lib/dnd/subclass-features";

export interface FeatureGroup { source: string; items: { level?: number; name: string; description: string }[]; }

export interface EquippedWeapon {
  name: string;
  damageDice: string;   // e.g. "1d8"
  damageType: string;   // e.g. "slashing"
  finesse: boolean;
  ranged: boolean;
  properties: string;
}

/** All features a character has: race, class (by level), subclass (by level), feats, background. */
async function resolveFeatures(character: any): Promise<FeatureGroup[]> {
  const groups: FeatureGroup[] = [];

  // Race traits
  const race = await prisma.srdRace.findFirst({ where: { name: character.raceId } });
  if (race?.traits) {
    try {
      const traits = JSON.parse(race.traits);
      if (traits.length) groups.push({ source: `Race: ${character.raceId}`, items: traits });
    } catch {}
  }

  // Class + subclass features
  for (const cls of character.classes) {
    const srdClass = await prisma.srdClass.findFirst({ where: { name: cls.classId } });
    const items: { level: number; name: string; description: string }[] = [];
    if (srdClass?.features) {
      try {
        const feats = JSON.parse(srdClass.features) as { level: number; name: string; description: string }[];
        items.push(...feats.filter((f) => f.level <= cls.level));
      } catch {}
    }
    for (const sf of subclassFeaturesUpTo(cls.subclass, cls.level)) items.push(sf);
    items.sort((a, b) => a.level - b.level);
    const label = cls.subclass ? `${cls.classId} (${cls.subclass}) ${cls.level}` : `${cls.classId} ${cls.level}`;
    if (items.length) groups.push({ source: label, items });
  }

  // Feats (stored)
  try {
    const stored = JSON.parse(character.featuresJson || "[]");
    const feats = stored.filter((f: any) => f?.type === "feat" || f?.name);
    if (feats.length) groups.push({ source: "Feats", items: feats.map((f: any) => ({ name: f.name, description: f.description ?? "" })) });
  } catch {}

  // Background feature
  if (character.background) {
    const bg = await prisma.srdBackground.findFirst({ where: { name: character.background } });
    if (bg?.featureName) groups.push({ source: `Background: ${character.background}`, items: [{ name: bg.featureName, description: bg.featureDesc ?? "" }] });
  }

  return groups;
}

export async function loadCharacterView(id: string) {
  const character = await prisma.character.findUnique({
    where: { id },
    include: { classes: true, skills: true, items: true, spells: true, resources: true, campaign: true, owner: true },
  });
  if (!character) return null;

  // resolve equipped armor/shield/weapons from SRD equipment
  const equippedItems = character.items.filter((i) => i.equipped && i.srcEquipmentId);
  let equippedArmor: ArmorInput | null = null;
  let equippedShield = false;
  const weapons: EquippedWeapon[] = [];
  if (equippedItems.length) {
    const srdEquip = await prisma.srdEquipment.findMany({
      where: { id: { in: equippedItems.map((i) => Number(i.srcEquipmentId)).filter((n) => !isNaN(n)) } },
    });
    const byEquipId = new Map(srdEquip.map((e) => [e.id, e]));
    for (const e of srdEquip) {
      if (e.armorCategory && /shield/i.test(e.name)) equippedShield = true;
      else if (e.armorCategory && e.acBase != null) {
        equippedArmor = { armorCategory: e.armorCategory, acBase: e.acBase, acMaxBonus: e.acMaxBonus };
      }
    }
    // Build the attack list from equipped weapons (items with damage dice).
    for (const item of equippedItems) {
      const e = byEquipId.get(Number(item.srcEquipmentId));
      if (!e || !e.damageDice) continue;
      const props = (e.weaponProperties ?? "").toLowerCase();
      weapons.push({
        name: item.name,
        damageDice: e.damageDice,
        damageType: e.damageType ?? "",
        finesse: /finesse/.test(props),
        ranged: /ranged/i.test(e.category ?? "") || /ammunition|thrown/.test(props) || e.rangeNormal != null,
        properties: e.weaponProperties ?? "",
      });
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

  // resolve spell details for the sheet
  let spellDetails: any[] = [];
  if (character.spells.length) {
    const ids = character.spells.map((s) => Number(s.spellId)).filter((n) => !isNaN(n));
    const srd = await prisma.srdSpell.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, level: true, school: true, castingTime: true, concentration: true, ritual: true, range: true },
    });
    const byId = new Map(srd.map((s) => [s.id, s]));
    spellDetails = character.spells.map((cs) => {
      const s = byId.get(Number(cs.spellId));
      return s ? { ...s, prepared: cs.prepared, alwaysPrepared: cs.alwaysPrepared, source: cs.source } : null;
    }).filter(Boolean).sort((a: any, b: any) => a.level - b.level || a.name.localeCompare(b.name));
  }

  const features = await resolveFeatures(character);
  return { character, derived: derive(input), spellDetails, features, weapons };
}

function safeJson<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback;
  try { return JSON.parse(s) as T; } catch { return fallback; }
}
