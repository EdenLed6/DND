// Derived character calculations. See docs/03-DND-BRAIN.md and docs/04-CHARACTER-SYSTEM.md §C.
import {
  ABILITIES, type Ability, abilityMod, proficiencyBonus, SKILLS, SKILL_NAMES,
  HIT_DIE, CASTING_ABILITY, CASTER_TYPE, spellSlots, pactSlots, levelForXp, toCopper,
} from "./rules";

export interface CharClassInput { name: string; classId?: string; subclass?: string | null; level: number; isPrimary?: boolean; }
export interface CharSkillInput { skill: string; proficient: boolean; expertise: boolean; }
export interface ArmorInput {
  armorCategory?: string | null; // "Light Armor" | "Medium Armor" | "Heavy Armor"
  acBase?: number | null;
  acMaxBonus?: number | null;
  isShield?: boolean;
}

export interface CharacterInput {
  str: number; dex: number; con: number; int: number; wis: number; cha: number;
  xp: number;
  classes: CharClassInput[];
  skills: CharSkillInput[];
  savingThrowProfs?: Ability[];   // from classes (union)
  maxHpBonus?: number;
  acOverride?: number | null;
  speedOverride?: number | null;
  baseSpeed?: number;             // from race
  equippedArmor?: ArmorInput | null;
  equippedShield?: boolean;
  unarmoredDefense?: "barbarian" | "monk" | null;
  cp?: number; sp?: number; ep?: number; gp?: number; pp?: number;
}

export interface DerivedCharacter {
  totalLevel: number;
  levelByXp: number;
  proficiencyBonus: number;
  mods: Record<Ability, number>;
  ac: number;
  initiative: number;
  speed: number;
  maxHp: number;
  hitDiceTotal: { die: number; count: number }[];
  saves: Record<Ability, { value: number; proficient: boolean }>;
  skills: Record<string, { value: number; ability: Ability; proficient: boolean; expertise: boolean }>;
  passivePerception: number;
  passiveInvestigation: number;
  passiveInsight: number;
  spellcasting: SpellcastingInfo | null;
  carryCapacity: number;
  totalCp: number;
}

export interface SpellcastingInfo {
  ability: Ability;
  abilityLabel: string;
  spellSaveDc: number;
  spellAttackBonus: number;
  slots: number[];                 // index 0 = level 1
  pact: { slots: number; level: number } | null;
  casterClass: string;
}

export function totalLevel(classes: CharClassInput[]): number {
  return classes.reduce((s, c) => s + c.level, 0);
}

export function abilityMods(c: CharacterInput): Record<Ability, number> {
  return {
    str: abilityMod(c.str), dex: abilityMod(c.dex), con: abilityMod(c.con),
    int: abilityMod(c.int), wis: abilityMod(c.wis), cha: abilityMod(c.cha),
  };
}

export function computeAc(c: CharacterInput, mods: Record<Ability, number>): number {
  if (c.acOverride != null) return c.acOverride;
  let ac = 10 + mods.dex;
  const armor = c.equippedArmor;
  if (armor && armor.acBase != null) {
    const cat = armor.armorCategory ?? "";
    if (/light/i.test(cat)) ac = armor.acBase + mods.dex;
    else if (/medium/i.test(cat)) ac = armor.acBase + Math.min(mods.dex, armor.acMaxBonus ?? 2);
    else if (/heavy/i.test(cat)) ac = armor.acBase;
    else ac = armor.acBase + mods.dex;
  } else if (c.unarmoredDefense === "barbarian") {
    ac = 10 + mods.dex + mods.con;
  } else if (c.unarmoredDefense === "monk") {
    ac = 10 + mods.dex + mods.wis;
  }
  if (c.equippedShield) ac += 2;
  return ac;
}

export function computeMaxHp(c: CharacterInput, conMod: number): number {
  let hp = 0;
  let first = true;
  for (const cls of c.classes) {
    const die = HIT_DIE[cls.name] ?? 8;
    for (let lvl = 1; lvl <= cls.level; lvl++) {
      if (first && lvl === 1) { hp += die + conMod; first = false; }
      else hp += Math.floor(die / 2) + 1 + conMod; // average per level
    }
  }
  if (c.classes.length === 0) hp = 0;
  return Math.max(1, hp + (c.maxHpBonus ?? 0));
}

export function hitDiceTotals(classes: CharClassInput[]): { die: number; count: number }[] {
  const map = new Map<number, number>();
  for (const c of classes) {
    const die = HIT_DIE[c.name] ?? 8;
    map.set(die, (map.get(die) ?? 0) + c.level);
  }
  return [...map.entries()].map(([die, count]) => ({ die, count })).sort((a, b) => b.die - a.die);
}

export function computeSpellcasting(c: CharacterInput, mods: Record<Ability, number>, pb: number): SpellcastingInfo | null {
  // Pick the primary spellcasting class (first caster, primary preferred).
  const casters = c.classes.filter((cl) => CASTER_TYPE[cl.name] && CASTER_TYPE[cl.name] !== "none");
  if (casters.length === 0) return null;
  const primary = casters.find((cl) => cl.isPrimary) ?? casters[0];
  const ability = CASTING_ABILITY[primary.name];
  if (!ability) return null;
  const mod = mods[ability];
  const slots = spellSlots(c.classes.map((cl) => ({ name: cl.name, level: cl.level })));
  const pact = pactSlots(c.classes.map((cl) => ({ name: cl.name, level: cl.level })));
  return {
    ability,
    abilityLabel: ability.toUpperCase(),
    spellSaveDc: 8 + pb + mod,
    spellAttackBonus: pb + mod,
    slots,
    pact,
    casterClass: primary.name,
  };
}

export function derive(c: CharacterInput): DerivedCharacter {
  const tl = Math.max(1, totalLevel(c.classes));
  const pb = proficiencyBonus(tl);
  const mods = abilityMods(c);
  const saveProfs = new Set(c.savingThrowProfs ?? []);

  const saves = {} as DerivedCharacter["saves"];
  for (const a of ABILITIES) {
    const prof = saveProfs.has(a);
    saves[a] = { value: mods[a] + (prof ? pb : 0), proficient: prof };
  }

  const skillMap = new Map(c.skills.map((s) => [s.skill, s]));
  const skills = {} as DerivedCharacter["skills"];
  for (const name of SKILL_NAMES) {
    const ability = SKILLS[name];
    const s = skillMap.get(name);
    const prof = s?.proficient ?? false;
    const exp = s?.expertise ?? false;
    const value = mods[ability] + (prof ? pb : 0) + (exp ? pb : 0);
    skills[name] = { value, ability, proficient: prof, expertise: exp };
  }

  const passive = (skill: string) => 10 + skills[skill].value;

  return {
    totalLevel: tl,
    levelByXp: levelForXp(c.xp),
    proficiencyBonus: pb,
    mods,
    ac: computeAc(c, mods),
    initiative: mods.dex,
    speed: c.speedOverride ?? c.baseSpeed ?? 30,
    maxHp: computeMaxHp(c, mods.con),
    hitDiceTotal: hitDiceTotals(c.classes),
    saves,
    skills,
    passivePerception: passive("Perception"),
    passiveInvestigation: passive("Investigation"),
    passiveInsight: passive("Insight"),
    spellcasting: computeSpellcasting(c, mods, pb),
    carryCapacity: c.str * 15,
    totalCp: toCopper({ cp: c.cp, sp: c.sp, ep: c.ep, gp: c.gp, pp: c.pp }),
  };
}
