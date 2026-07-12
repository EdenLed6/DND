// Combat resolution: parse monster stat blocks, roll attacks, apply damage.
// See docs/03-DND-BRAIN.md §10 and docs/06-COMBAT-AND-MAPS.md §E.
import { roll, rollDamage, d20Check, type RollResult } from "./dice";

export interface ParsedAttack {
  name: string;
  toHit: number | null;      // attack bonus, e.g. +4
  reach: string | null;      // "5 ft." / "80/320 ft."
  damageDice: string | null; // "1d6+2"
  damageType: string | null; // "slashing"
  save: { ability: string; dc: number } | null;
  halfOnSave: boolean;
  raw: string;
}

const ABIL_RE = /(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s+saving throw/i;

/** Parse a single monster action's description into a structured attack. */
export function parseAttack(name: string, desc: string): ParsedAttack {
  const toHitM = desc.match(/([+-]\d+)\s+to hit/i);
  const reachM = desc.match(/(?:reach|range)\s+([\d/]+\s*ft\.?)/i);
  // damage: "5 (1d6 + 2) slashing damage" -> capture dice and type
  const dmgM = desc.match(/\((\d+d\d+(?:\s*[+-]\s*\d+)?)\)\s*(\w+)?\s*damage/i)
    || desc.match(/(\d+d\d+(?:\s*[+-]\s*\d+)?)\s+(\w+)?\s*damage/i);
  const saveM = desc.match(/DC\s+(\d+)\s+(\w+)/i);
  const abilM = desc.match(ABIL_RE);

  let save: ParsedAttack["save"] = null;
  if (saveM && abilM) save = { ability: abilM[1], dc: parseInt(saveM[1], 10) };
  else if (saveM) save = { ability: saveM[2], dc: parseInt(saveM[1], 10) };

  return {
    name,
    toHit: toHitM ? parseInt(toHitM[1], 10) : null,
    reach: reachM ? reachM[1].replace(/\s+/g, " ").trim() : null,
    damageDice: dmgM ? dmgM[1].replace(/\s+/g, "") : null,
    damageType: dmgM && dmgM[2] ? dmgM[2].toLowerCase() : null,
    save,
    halfOnSave: /half as much|half damage|half the damage/i.test(desc),
    raw: desc,
  };
}

/** Parse all actions from a monster's `actions` JSON string. */
export function parseActions(actionsJson: string | null): ParsedAttack[] {
  if (!actionsJson) return [];
  let arr: { name: string; description: string }[];
  try { arr = JSON.parse(actionsJson); } catch { return []; }
  return arr.map((a) => parseAttack(a.name, a.description));
}

export interface AttackOutcome {
  target: string;
  attackRoll: RollResult | null;
  hit: boolean;
  crit: boolean;
  damage: number;
  damageRoll: RollResult | null;
  save: { roll: RollResult; success: boolean } | null;
  message: string;
}

export type DamageModifier = "normal" | "resistant" | "vulnerable" | "immune";

function applyDamageMod(dmg: number, mod: DamageModifier): number {
  if (mod === "immune") return 0;
  if (mod === "resistant") return Math.floor(dmg / 2);
  if (mod === "vulnerable") return dmg * 2;
  return dmg;
}

/** Resolve an attack-roll attack against one target. */
export function resolveAttackRoll(
  attack: ParsedAttack,
  target: { name: string; ac: number },
  opts: { advantage?: boolean; disadvantage?: boolean; damageMod?: DamageModifier } = {}
): AttackOutcome {
  const bonus = attack.toHit ?? 0;
  const atk = d20Check(bonus, opts);
  const nat = atk.dice.find((d) => d.sides === 20)?.value ?? 0;
  const hit = atk.crit ? true : atk.fumble ? false : atk.total >= target.ac;
  let damage = 0;
  let damageRoll: RollResult | null = null;
  if (hit && attack.damageDice) {
    damageRoll = rollDamage(attack.damageDice, !!atk.crit);
    damage = applyDamageMod(Math.max(0, damageRoll.total), opts.damageMod ?? "normal");
  }
  const verdict = atk.crit ? "CRIT" : atk.fumble ? "FUMBLE" : hit ? "HIT" : "MISS";
  const dmgStr = hit && damage ? ` — ${damage} ${attack.damageType ?? ""} damage`.trimEnd() : "";
  const message = `${attack.name} → ${target.name}: ${atk.total} vs AC ${target.ac} ${verdict}${dmgStr}`;
  return { target: target.name, attackRoll: atk, hit, crit: !!atk.crit, damage, damageRoll, save: null, message };
}

/** Resolve a save-based effect against one target. */
export function resolveSaveAttack(
  attack: ParsedAttack,
  target: { name: string; saveBonus: number },
  opts: { advantage?: boolean; disadvantage?: boolean; damageMod?: DamageModifier } = {}
): AttackOutcome {
  const saveRoll = d20Check(target.saveBonus, opts);
  const dc = attack.save?.dc ?? 10;
  const success = saveRoll.total >= dc;
  let damage = 0;
  let damageRoll: RollResult | null = null;
  if (attack.damageDice) {
    damageRoll = roll(attack.damageDice);
    let d = applyDamageMod(Math.max(0, damageRoll.total), opts.damageMod ?? "normal");
    if (success) d = attack.halfOnSave ? Math.floor(d / 2) : 0;
    damage = d;
  }
  const message = `${attack.name} → ${target.name}: save ${saveRoll.total} vs DC ${dc} ${success ? "SUCCESS" : "FAIL"}${damage ? ` — ${damage} ${attack.damageType ?? ""} damage`.trimEnd() : ""}`;
  return { target: target.name, attackRoll: null, hit: !success, crit: false, damage, damageRoll, save: { roll: saveRoll, success }, message };
}

/** Attack multiple targets at once ("roll attack for each player he attacks"). */
export function resolveMultiTarget(
  attack: ParsedAttack,
  targets: { name: string; ac: number; saveBonus?: number; damageMod?: DamageModifier }[],
  opts: { advantage?: boolean; disadvantage?: boolean } = {}
): AttackOutcome[] {
  return targets.map((t) =>
    attack.save
      ? resolveSaveAttack(attack, { name: t.name, saveBonus: t.saveBonus ?? 0 }, { ...opts, damageMod: t.damageMod })
      : resolveAttackRoll(attack, { name: t.name, ac: t.ac }, { ...opts, damageMod: t.damageMod })
  );
}

/** Apply damage to a HP pool, accounting for temp HP. Returns new state. */
export function applyDamage(currentHp: number, tempHp: number, damage: number) {
  let dmg = damage;
  let temp = tempHp;
  if (temp > 0) {
    const absorbed = Math.min(temp, dmg);
    temp -= absorbed;
    dmg -= absorbed;
  }
  const hp = Math.max(0, currentHp - dmg);
  return { currentHp: hp, tempHp: temp, dropped: hp === 0 };
}

/** Roll initiative for a set of combatants. */
export function rollInitiative(dexMod: number, bonus = 0): RollResult {
  return d20Check(dexMod + bonus);
}
