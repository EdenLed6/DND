// The D&D Brain, in code. Constants & tables from docs/03-DND-BRAIN.md.

export const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"] as const;
export type Ability = (typeof ABILITIES)[number];
export const ABILITY_LABELS: Record<Ability, string> = {
  str: "Strength", dex: "Dexterity", con: "Constitution",
  int: "Intelligence", wis: "Wisdom", cha: "Charisma",
};

// ---- Skills (18) -> ability ----
export const SKILLS: Record<string, Ability> = {
  Athletics: "str",
  Acrobatics: "dex", "Sleight of Hand": "dex", Stealth: "dex",
  Arcana: "int", History: "int", Investigation: "int", Nature: "int", Religion: "int",
  "Animal Handling": "wis", Insight: "wis", Medicine: "wis", Perception: "wis", Survival: "wis",
  Deception: "cha", Intimidation: "cha", Performance: "cha", Persuasion: "cha",
};
export const SKILL_NAMES = Object.keys(SKILLS);

// ---- Ability modifier ----
export function abilityMod(score: number): number {
  return Math.floor((score - 10) / 2);
}
export function formatMod(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

// ---- Proficiency bonus by total level ----
export function proficiencyBonus(totalLevel: number): number {
  return 2 + Math.floor((Math.max(1, totalLevel) - 1) / 4);
}

// ---- XP thresholds -> level ----
export const XP_TABLE = [
  0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000,
  85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000,
];
export function levelForXp(xp: number): number {
  let lvl = 1;
  for (let i = 0; i < XP_TABLE.length; i++) if (xp >= XP_TABLE[i]) lvl = i + 1;
  return lvl;
}
export function xpForLevel(level: number): number {
  return XP_TABLE[Math.min(Math.max(level, 1), 20) - 1];
}
export function xpToNextLevel(xp: number): { current: number; next: number | null; pct: number } {
  const lvl = levelForXp(xp);
  if (lvl >= 20) return { current: xpForLevel(20), next: null, pct: 100 };
  const cur = xpForLevel(lvl);
  const next = xpForLevel(lvl + 1);
  return { current: cur, next, pct: Math.round(((xp - cur) / (next - cur)) * 100) };
}

// ---- Encounter XP multiplier by number of monsters ----
export function encounterMultiplier(count: number): number {
  if (count <= 1) return 1;
  if (count === 2) return 1.5;
  if (count <= 6) return 2;
  if (count <= 10) return 2.5;
  if (count <= 14) return 3;
  return 4;
}

// ---- Hit die per class ----
export const HIT_DIE: Record<string, number> = {
  Barbarian: 12, Fighter: 10, Paladin: 10, Ranger: 10,
  Bard: 8, Cleric: 8, Druid: 8, Monk: 8, Rogue: 8, Warlock: 8,
  Sorcerer: 6, Wizard: 6,
};

// ---- Spellcasting ability per class ----
export const CASTING_ABILITY: Record<string, Ability> = {
  Wizard: "int",
  Cleric: "wis", Druid: "wis", Ranger: "wis",
  Bard: "cha", Paladin: "cha", Sorcerer: "cha", Warlock: "cha",
};

// caster progression type
export type CasterType = "full" | "half" | "third" | "pact" | "none";
export const CASTER_TYPE: Record<string, CasterType> = {
  Bard: "full", Cleric: "full", Druid: "full", Sorcerer: "full", Wizard: "full",
  Paladin: "half", Ranger: "half",
  Warlock: "pact",
  Barbarian: "none", Fighter: "none", Monk: "none", Rogue: "none",
};

// ---- Full-caster spell slot table [level 1..20] -> [slot lvl 1..9] ----
export const FULL_CASTER_SLOTS: number[][] = [
  [2, 0, 0, 0, 0, 0, 0, 0, 0], // 1
  [3, 0, 0, 0, 0, 0, 0, 0, 0],
  [4, 2, 0, 0, 0, 0, 0, 0, 0],
  [4, 3, 0, 0, 0, 0, 0, 0, 0],
  [4, 3, 2, 0, 0, 0, 0, 0, 0],
  [4, 3, 3, 0, 0, 0, 0, 0, 0],
  [4, 3, 3, 1, 0, 0, 0, 0, 0],
  [4, 3, 3, 2, 0, 0, 0, 0, 0],
  [4, 3, 3, 3, 1, 0, 0, 0, 0],
  [4, 3, 3, 3, 2, 0, 0, 0, 0], // 10
  [4, 3, 3, 3, 2, 1, 0, 0, 0],
  [4, 3, 3, 3, 2, 1, 0, 0, 0],
  [4, 3, 3, 3, 2, 1, 1, 0, 0],
  [4, 3, 3, 3, 2, 1, 1, 0, 0],
  [4, 3, 3, 3, 2, 1, 1, 1, 0],
  [4, 3, 3, 3, 2, 1, 1, 1, 0],
  [4, 3, 3, 3, 2, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 2, 1, 1], // 20
];

// ---- Warlock Pact Magic: [level] -> {slots, slotLevel} ----
export const PACT_MAGIC: { slots: number; level: number }[] = [
  { slots: 1, level: 1 }, { slots: 2, level: 1 }, { slots: 2, level: 2 }, { slots: 2, level: 2 },
  { slots: 2, level: 3 }, { slots: 2, level: 3 }, { slots: 2, level: 4 }, { slots: 2, level: 4 },
  { slots: 2, level: 5 }, { slots: 2, level: 5 }, { slots: 3, level: 5 }, { slots: 3, level: 5 },
  { slots: 3, level: 5 }, { slots: 3, level: 5 }, { slots: 3, level: 5 }, { slots: 3, level: 5 },
  { slots: 4, level: 5 }, { slots: 4, level: 5 }, { slots: 4, level: 5 }, { slots: 4, level: 5 },
];

// Multiclass caster level -> combined slots. classes: [{name, level}]
export function multiclassCasterLevel(classes: { name: string; level: number }[]): number {
  let cl = 0;
  for (const c of classes) {
    const t = CASTER_TYPE[c.name];
    if (t === "full") cl += c.level;
    else if (t === "half") cl += Math.floor(c.level / 2);
    else if (t === "third") cl += Math.floor(c.level / 3);
  }
  return cl;
}

/** Standard spell slots for a set of classes (excludes Warlock pact magic). */
export function spellSlots(classes: { name: string; level: number }[]): number[] {
  const nonWarlock = classes.filter((c) => CASTER_TYPE[c.name] && CASTER_TYPE[c.name] !== "pact");
  const cl = multiclassCasterLevel(nonWarlock);
  if (cl <= 0) return [0, 0, 0, 0, 0, 0, 0, 0, 0];
  return FULL_CASTER_SLOTS[Math.min(cl, 20) - 1];
}

export function pactSlots(classes: { name: string; level: number }[]) {
  const w = classes.find((c) => c.name === "Warlock");
  if (!w) return null;
  return PACT_MAGIC[Math.min(w.level, 20) - 1];
}

// ---- Currency (copper base) ----
export const COIN_TO_CP: Record<string, number> = { cp: 1, sp: 10, ep: 50, gp: 100, pp: 1000 };
export interface Purse { cp: number; sp: number; ep: number; gp: number; pp: number; }
export function toCopper(p: Partial<Purse>): number {
  return (p.cp ?? 0) * 1 + (p.sp ?? 0) * 10 + (p.ep ?? 0) * 50 + (p.gp ?? 0) * 100 + (p.pp ?? 0) * 1000;
}
export function fromCopper(cp: number): Purse {
  let r = Math.max(0, Math.floor(cp));
  const pp = Math.floor(r / 1000); r -= pp * 1000;
  const gp = Math.floor(r / 100); r -= gp * 100;
  const ep = Math.floor(r / 50); r -= ep * 50;
  const sp = Math.floor(r / 10); r -= sp * 10;
  return { pp, gp, ep, sp, cp: r };
}
export function gpValue(cp: number): number {
  return Math.round((cp / 100) * 100) / 100;
}

// ---- Creature size -> squares on a 5ft grid ----
export const SIZE_SQUARES: Record<string, number> = {
  Tiny: 1, Small: 1, Medium: 1, Large: 2, Huge: 3, Gargantuan: 4,
};
export function sizeToSquares(size?: string | null): number {
  return SIZE_SQUARES[size ?? "Medium"] ?? 1;
}

// ---- Exhaustion effects (short description) ----
export const EXHAUSTION_EFFECTS = [
  "None",
  "Disadvantage on ability checks",
  "Speed halved",
  "Disadvantage on attack rolls and saving throws",
  "Hit point maximum halved",
  "Speed reduced to 0",
  "Death",
];

// ---- ASI levels per class (levels that grant Ability Score Improvement) ----
export const ASI_LEVELS: Record<string, number[]> = {
  Fighter: [4, 6, 8, 12, 14, 16, 19],
  Rogue: [4, 8, 10, 12, 16, 19],
  _default: [4, 8, 12, 16, 19],
};
export function asiLevels(className: string): number[] {
  return ASI_LEVELS[className] ?? ASI_LEVELS._default;
}

// ---- Level at which each class chooses its subclass ----
export const SUBCLASS_LEVEL: Record<string, number> = {
  Cleric: 1, Sorcerer: 1, Warlock: 1,
  Bard: 3, Barbarian: 3, Fighter: 3, Monk: 3, Paladin: 3, Ranger: 3, Rogue: 3, Wizard: 2, Druid: 2,
};
export function subclassLevel(className: string): number {
  return SUBCLASS_LEVEL[className] ?? 3;
}

// ---- Multiclass ability prerequisites (SRD) ----
export const MULTICLASS_PREREQ: Record<string, Partial<Record<Ability, number>>> = {
  Barbarian: { str: 13 }, Bard: { cha: 13 }, Cleric: { wis: 13 }, Druid: { wis: 13 },
  Fighter: { str: 13 }, Monk: { dex: 13, wis: 13 }, Paladin: { str: 13, cha: 13 },
  Ranger: { dex: 13, wis: 13 }, Rogue: { dex: 13 }, Sorcerer: { cha: 13 },
  Warlock: { cha: 13 }, Wizard: { int: 13 },
};
