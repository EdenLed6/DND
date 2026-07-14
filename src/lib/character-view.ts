import { prisma } from "@/lib/db";
import { derive, type CharacterInput, type CharClassInput, type ArmorInput } from "@/lib/dnd/character";
import type { Ability } from "@/lib/dnd/rules";
import { subclassFeaturesUpTo } from "@/lib/dnd/subclass-features";
import { deriveResources, mergeResourceUsage, type DerivedResource } from "@/lib/dnd/resources";

export interface Encumbrance {
  totalWeight: number;
  capacity: number;        // STR × 15
  pushDragLift: number;    // STR × 30
  encumberedAt: number;    // STR × 5 (variant)
  heavyAt: number;         // STR × 10 (variant)
  status: "normal" | "encumbered" | "heavily" | "overloaded";
}

export interface Senses {
  darkvision: number | null;
  passivePerception: number;
  passiveInvestigation: number;
  passiveInsight: number;
}

export interface Proficiencies {
  languages: string[];
  tools: string[];
  weapons: string[];
  armor: string[];
}

export interface FeatureGroup { source: string; items: { level?: number; name: string; description: string }[]; }

/** Speed & Defenses (SPEC-PLAYER §11) — canonical type; SpeedDefensesPanel re-exports it. */
export interface DefensesData {
  resistances: string[];
  immunities: string[];
  vulnerabilities: string[];
  conditionImmunities: string[];
  speeds: { fly?: number; swim?: number; climb?: number; burrow?: number };
}

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

  // ---- Item locations ----
  // location is canonical ("equipped" | "backpack" | "pocket" | "storage"); the legacy
  // `equipped` flag still marks pre-migration rows whose location defaulted to "backpack".
  const locationOf = (i: { location?: string | null; equipped: boolean }): string =>
    i.location === "equipped" || i.equipped ? "equipped" : (i.location ?? "backpack");
  const CARRIED = new Set(["equipped", "backpack", "pocket"]); // storage weight is excluded

  // resolve equipped armor/shield/weapons + item weights from SRD equipment
  const equippedItems = character.items.filter((i) => locationOf(i) === "equipped");
  const srdBackedItems = character.items.filter((i) => i.srcEquipmentId);
  let equippedArmor: ArmorInput | null = null;
  let equippedArmorName: string | null = null;
  let equippedShield = false;
  const weapons: EquippedWeapon[] = [];
  const acContributors: { name: string; bonus: number }[] = []; // customJson.acBonus from equipped items
  let equipWeight = 0; // total weight of carried items (× quantity); storage excluded
  const byEquipId = new Map<number, any>();
  if (srdBackedItems.length) {
    const srdEquip = await prisma.srdEquipment.findMany({
      where: { id: { in: srdBackedItems.map((i) => Number(i.srcEquipmentId)).filter((n) => !isNaN(n)) } },
    });
    for (const e of srdEquip) byEquipId.set(e.id, e);
  }
  // Weight of everything carried (equipped, backpack, pockets) — SRD weight or customJson.weight.
  for (const item of character.items) {
    if (!CARRIED.has(locationOf(item))) continue;
    const e = item.srcEquipmentId ? byEquipId.get(Number(item.srcEquipmentId)) : null;
    const custom = safeJson<any>(item.customJson, {});
    const w = e?.weight ?? (typeof custom.weight === "number" ? custom.weight : 0);
    if (w) equipWeight += w * (item.quantity ?? 1);
  }
  // Armor/shield + attack list + AC equip effects only from equipped items.
  for (const item of equippedItems) {
    const custom = safeJson<any>(item.customJson, {});
    if (typeof custom.acBonus === "number" && custom.acBonus !== 0) {
      acContributors.push({ name: item.name, bonus: custom.acBonus });
    }
    const e = item.srcEquipmentId ? byEquipId.get(Number(item.srcEquipmentId)) : null;
    if (e) {
      if (e.armorCategory && /shield/i.test(e.name)) equippedShield = true;
      else if (e.armorCategory && e.acBase != null) {
        equippedArmor = { armorCategory: e.armorCategory, acBase: e.acBase, acMaxBonus: e.acMaxBonus };
        equippedArmorName = e.name;
      }
      if (e.damageDice) {
        const props = (e.weaponProperties ?? "").toLowerCase();
        weapons.push({
          name: item.name,
          damageDice: e.damageDice,
          damageType: e.damageType ?? "",
          finesse: /finesse/.test(props),
          // SRD melee weapons carry rangeNormal: 5, and thrown melee weapons use
          // STR — the authoritative signal is the weaponRange column.
          ranged: e.weaponRange === "Ranged" || /ammunition/.test(props),
          properties: e.weaponProperties ?? "",
        });
      }
      continue;
    }
    // Custom/homebrew equip effects: acBase turns the item into armor, category "shield" into a shield.
    if (typeof custom.category === "string" && /shield/i.test(custom.category)) equippedShield = true;
    else if (typeof custom.acBase === "number" && !equippedArmor) {
      equippedArmor = {
        armorCategory: custom.addDex ? (custom.maxDex != null ? "Medium Armor" : "Light Armor") : "Heavy Armor",
        acBase: custom.acBase,
        acMaxBonus: custom.maxDex ?? null,
      };
      equippedArmorName = item.name;
    }
    if (typeof custom.damage === "string" && custom.damage) {
      weapons.push({ name: item.name, damageDice: custom.damage, damageType: "", finesse: false, ranged: false, properties: "" });
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
      select: {
        id: true, name: true, level: true, school: true, castingTime: true, concentration: true,
        ritual: true, range: true, duration: true, description: true, higherLevel: true,
        damageType: true, saveType: true, componentsV: true, componentsS: true, componentsM: true,
      },
    });
    const byId = new Map(srd.map((s) => [s.id, s]));
    spellDetails = character.spells.map((cs) => {
      const s = byId.get(Number(cs.spellId));
      return s ? { ...s, prepared: cs.prepared, alwaysPrepared: cs.alwaysPrepared, source: cs.source } : null;
    }).filter(Boolean).sort((a: any, b: any) => a.level - b.level || a.name.localeCompare(b.name));
  }

  const features = await resolveFeatures(character);
  const derived = derive(input);

  // Equip-effect AC bonuses (customJson.acBonus on equipped items) stack on top of
  // computeAc()'s armor/shield math — unless a manual AC override is set.
  const acItemBonus = acContributors.reduce((s, b) => s + b.bonus, 0);
  if (character.acOverride == null && acItemBonus !== 0) derived.ac += acItemBonus;

  // ---- Encumbrance (carried locations only — storage excluded; variant thresholds for the UI) ----
  const str = character.str;
  const encumbrance: Encumbrance = {
    totalWeight: Math.round(equipWeight * 10) / 10,
    capacity: str * 15,
    pushDragLift: str * 30,
    encumberedAt: str * 5,
    heavyAt: str * 10,
    status:
      equipWeight > str * 15 ? "overloaded" :
      equipWeight > str * 10 ? "heavily" :
      equipWeight > str * 5 ? "encumbered" : "normal",
  };

  // ---- Class resource trackers (merge derived max/reset with stored `used`) ----
  const classForResources = classes.map((c) => ({ name: c.name, subclass: c.subclass, level: c.level }));
  const derivedResources: DerivedResource[] = deriveResources(classForResources, derived.mods, derived.proficiencyBonus);
  const storedUsage: Record<string, number> = {};
  for (const r of character.resources) storedUsage[r.name] = r.used;
  const resources = mergeResourceUsage(derivedResources, storedUsage);

  // ---- Senses (darkvision from race traits) ----
  const darkvision = await resolveDarkvision(character.raceId);
  const senses: Senses = {
    darkvision,
    passivePerception: derived.passivePerception,
    passiveInvestigation: derived.passiveInvestigation,
    passiveInsight: derived.passiveInsight,
  };

  // ---- Proficiencies & languages (from proficienciesJson blob) ----
  const profBlob = safeJson<any>(character.proficienciesJson, {});
  const asArr = (v: any): string[] => Array.isArray(v) ? v.filter((x) => typeof x === "string") : (typeof v === "string" && v ? v.split(",").map((s) => s.trim()).filter(Boolean) : []);
  const proficiencies: Proficiencies = {
    languages: asArr(profBlob.languages),
    tools: asArr(profBlob.tools),
    weapons: asArr(profBlob.weapons),
    armor: asArr(profBlob.armor),
  };

  // ---- Speed & Defenses (SPEC-PLAYER §11) ----
  const defenses = parseDefenses(character.defensesJson);
  const acBreakdown = buildAcBreakdown(input, derived.mods, equippedArmorName, acContributors);

  return { character, derived, spellDetails, features, weapons, encumbrance, resources, senses, proficiencies, defenses, acBreakdown };
}

/** Parse the defensesJson blob into a well-formed DefensesData (tolerates missing/corrupt data). */
function parseDefenses(raw: string | null | undefined): DefensesData {
  const blob = safeJson<any>(raw, {});
  const asStrArr = (v: any): string[] => Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.trim()).map((x) => x.trim()) : [];
  const asSpeed = (v: any): number | undefined => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : undefined;
  };
  const speedsBlob = blob?.speeds && typeof blob.speeds === "object" ? blob.speeds : {};
  const speeds: DefensesData["speeds"] = {};
  const fly = asSpeed(speedsBlob.fly); if (fly != null) speeds.fly = fly;
  const swim = asSpeed(speedsBlob.swim); if (swim != null) speeds.swim = swim;
  const climb = asSpeed(speedsBlob.climb); if (climb != null) speeds.climb = climb;
  const burrow = asSpeed(speedsBlob.burrow); if (burrow != null) speeds.burrow = burrow;
  return {
    resistances: asStrArr(blob?.resistances),
    immunities: asStrArr(blob?.immunities),
    vulnerabilities: asStrArr(blob?.vulnerabilities),
    conditionImmunities: asStrArr(blob?.conditionImmunities),
    speeds,
  };
}

/**
 * Human-readable AC breakdown that mirrors computeAc() in lib/dnd/character.ts,
 * plus equipped-item bonuses: "10 + DEX (+3)", "Chain Mail 16 + Shield (+2)",
 * "Chain Mail 16 + Shield (+2) + Cloak of Protection (+1)", …
 */
function buildAcBreakdown(
  c: CharacterInput,
  mods: Record<Ability, number>,
  armorName: string | null,
  itemBonuses: { name: string; bonus: number }[] = [],
): string {
  if (c.acOverride != null) return `Manual override ${c.acOverride}`;
  const fmt = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
  let base: string;
  const armor = c.equippedArmor;
  if (armor && armor.acBase != null) {
    const name = armorName ?? "Armor";
    const cat = armor.armorCategory ?? "";
    if (/light/i.test(cat)) base = `${name} ${armor.acBase} + DEX (${fmt(mods.dex)})`;
    else if (/medium/i.test(cat)) base = `${name} ${armor.acBase} + DEX (${fmt(Math.min(mods.dex, armor.acMaxBonus ?? 2))}, max ${fmt(armor.acMaxBonus ?? 2)})`;
    else if (/heavy/i.test(cat)) base = `${name} ${armor.acBase}`;
    else base = `${name} ${armor.acBase} + DEX (${fmt(mods.dex)})`;
  } else if (c.unarmoredDefense === "barbarian") {
    base = `10 + DEX (${fmt(mods.dex)}) + CON (${fmt(mods.con)})`;
  } else if (c.unarmoredDefense === "monk") {
    base = `10 + DEX (${fmt(mods.dex)}) + WIS (${fmt(mods.wis)})`;
  } else {
    base = `10 + DEX (${fmt(mods.dex)})`;
  }
  if (c.equippedShield) base += " + Shield (+2)";
  for (const b of itemBonuses) base += ` + ${b.name} (${fmt(b.bonus)})`;
  return base;
}

/** Read a race's Darkvision range (in feet) from its SRD traits, if any. */
async function resolveDarkvision(raceId: string): Promise<number | null> {
  const race = await prisma.srdRace.findFirst({ where: { name: raceId }, select: { traits: true } });
  if (!race?.traits) return null;
  try {
    const traits = JSON.parse(race.traits) as { name?: string; description?: string }[];
    const dv = traits.find((t) => /darkvision|superior darkvision/i.test(t.name ?? ""));
    if (!dv) return null;
    const m = (dv.description ?? "").match(/(\d+)\s*(?:feet|ft)/i);
    return m ? Number(m[1]) : 60;
  } catch { return null; }
}

function safeJson<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback;
  try { return JSON.parse(s) as T; } catch { return fallback; }
}
