// Curated casting data for SRD spells. The SRD spell rows store only prose
// (description / higherLevel), so structured "roll this much damage" data is
// hand-curated here for the spells players actually cast from the sheet.
// Anything not in the table is treated as a utility spell (no roll, just spend
// the slot). See docs/03-DND-BRAIN.md §12.
import type { Ability } from "./rules";

export interface SpellCastData {
  attack?: boolean;          // make a spell attack roll (+spellAttackBonus)
  save?: Ability;            // target makes this save (vs spellSaveDc)
  half?: boolean;            // half damage on a successful save
  damage?: string;           // base damage dice (at the spell's own level, or cantrip base)
  damageType?: string;
  heal?: string;             // base healing dice
  addModToHeal?: boolean;    // add spellcasting ability mod to healing (e.g. Cure Wounds)
  upcast?: string;           // dice added per slot level above the spell's base level
  healUpcast?: string;       // healing dice added per slot level above base
  cantrip?: boolean;         // scales by character level (5/11/17), not by slot
}

// Keyed by lowercased spell name.
const CAST: Record<string, SpellCastData> = {
  // ---- Cantrips (scale at character levels 5/11/17) ----
  "fire bolt": { attack: true, damage: "1d10", damageType: "fire", cantrip: true },
  "ray of frost": { attack: true, damage: "1d8", damageType: "cold", cantrip: true },
  "eldritch blast": { attack: true, damage: "1d10", damageType: "force", cantrip: true },
  "chill touch": { attack: true, damage: "1d8", damageType: "necrotic", cantrip: true },
  "shocking grasp": { attack: true, damage: "1d8", damageType: "lightning", cantrip: true },
  "poison spray": { save: "con", damage: "1d12", damageType: "poison", cantrip: true },
  "sacred flame": { save: "dex", damage: "1d8", damageType: "radiant", cantrip: true },
  "acid splash": { save: "dex", damage: "1d6", damageType: "acid", cantrip: true },
  "toll the dead": { save: "wis", damage: "1d8", damageType: "necrotic", cantrip: true },
  "vicious mockery": { save: "wis", damage: "1d4", damageType: "psychic", cantrip: true },
  "produce flame": { attack: true, damage: "1d8", damageType: "fire", cantrip: true },
  "thorn whip": { attack: true, damage: "1d6", damageType: "piercing", cantrip: true },
  "frostbite": { save: "con", damage: "1d6", damageType: "cold", cantrip: true },
  "primal savagery": { attack: true, damage: "1d10", damageType: "acid", cantrip: true },

  // ---- Damage spells (upcast adds dice per slot level above base) ----
  "burning hands": { save: "dex", half: true, damage: "3d6", damageType: "fire", upcast: "1d6" },
  "magic missile": { damage: "3d4", damageType: "force", upcast: "1d4" }, // auto-hit (+1 dart/level); dice models 3 darts of 1d4+1 ≈ shown as base
  "thunderwave": { save: "con", half: true, damage: "2d8", damageType: "thunder", upcast: "1d8" },
  "chromatic orb": { attack: true, damage: "3d8", damageType: "varies", upcast: "1d8" },
  "witch bolt": { attack: true, damage: "1d12", damageType: "lightning", upcast: "1d12" },
  "guiding bolt": { attack: true, damage: "4d6", damageType: "radiant", upcast: "1d6" },
  "inflict wounds": { attack: true, damage: "3d10", damageType: "necrotic", upcast: "1d10" },
  "hellish rebuke": { save: "dex", half: true, damage: "2d10", damageType: "fire", upcast: "1d10" },
  "scorching ray": { attack: true, damage: "2d6", damageType: "fire", upcast: "2d6" }, // per ray; base 3 rays of 2d6
  "shatter": { save: "con", half: true, damage: "3d8", damageType: "thunder", upcast: "1d8" },
  "acid arrow": { attack: true, damage: "4d4", damageType: "acid", upcast: "1d4" },
  "fireball": { save: "dex", half: true, damage: "8d6", damageType: "fire", upcast: "1d6" },
  "lightning bolt": { save: "dex", half: true, damage: "8d6", damageType: "lightning", upcast: "1d6" },
  "vampiric touch": { attack: true, damage: "3d6", damageType: "necrotic", upcast: "1d6" },
  "spirit guardians": { save: "wis", half: true, damage: "3d8", damageType: "radiant", upcast: "1d8" },
  "call lightning": { save: "dex", half: true, damage: "3d10", damageType: "lightning", upcast: "1d10" },
  "ice storm": { save: "dex", half: true, damage: "2d8", damageType: "bludgeoning", upcast: "1d8" },
  "cone of cold": { save: "con", half: true, damage: "8d8", damageType: "cold", upcast: "1d8" },
  "chain lightning": { save: "dex", half: true, damage: "10d8", damageType: "lightning", upcast: "0" },
  "disintegrate": { save: "dex", damage: "10d6+40", damageType: "force", upcast: "3d6" },
  "finger of death": { save: "con", half: true, damage: "7d8+30", damageType: "necrotic" },
  "flame strike": { save: "dex", half: true, damage: "8d6", damageType: "fire/radiant", upcast: "1d6" },
  "moonbeam": { save: "con", half: true, damage: "2d10", damageType: "radiant", upcast: "1d10" },
  "sacred weapon": { damage: "", damageType: "radiant" },

  // ---- Healing spells ----
  "cure wounds": { heal: "1d8", addModToHeal: true, healUpcast: "1d8" },
  "healing word": { heal: "1d4", addModToHeal: true, healUpcast: "1d4" },
  "mass healing word": { heal: "1d4", addModToHeal: true, healUpcast: "1d4" },
  "prayer of healing": { heal: "2d8", addModToHeal: true, healUpcast: "1d8" },
  "mass cure wounds": { heal: "3d8", addModToHeal: true, healUpcast: "1d8" },
  "heal": { heal: "70", healUpcast: "10" },
  "healing spirit": { heal: "1d6", healUpcast: "1d6" },
  "aid": { heal: "5", healUpcast: "5" }, // raises max HP; modeled as flat
};

export interface ResolvedCast {
  kind: "attack" | "save" | "heal" | "utility";
  damageExpr?: string;     // full expression to roll (already scaled/upcast)
  damageType?: string;
  save?: Ability;
  half?: boolean;
  healExpr?: string;
  cantrip?: boolean;
  slotLevel: number;       // the level the spell was cast at
}

/** How many damage/scaling tiers a cantrip has at a given character level. */
export function cantripTier(characterLevel: number): number {
  return 1 + (characterLevel >= 5 ? 1 : 0) + (characterLevel >= 11 ? 1 : 0) + (characterLevel >= 17 ? 1 : 0);
}

// Multiply the die count in a "NdX[+M]" expression by `factor`.
function scaleDice(expr: string, factor: number): string {
  return expr.replace(/(\d+)d(\d+)/g, (_m, n, sides) => `${Number(n) * factor}d${sides}`);
}

// Add two "NdX" die pools of the same size, or append flats. Best-effort.
function addDice(base: string, add: string, times: number): string {
  if (!add || add === "0" || times <= 0) return base;
  const bm = base.match(/^(\d+)d(\d+)(.*)$/);
  const am = add.match(/^(\d+)d(\d+)$/);
  if (bm && am && bm[2] === am[2]) {
    return `${Number(bm[1]) + Number(am[1]) * times}d${bm[2]}${bm[3]}`;
  }
  // flat numeric upcast (e.g. Heal +10/level)
  const flat = Number(add);
  if (!isNaN(flat)) {
    const bflat = Number(base);
    if (!isNaN(bflat)) return String(bflat + flat * times);
  }
  return base;
}

/**
 * Resolve what happens when a spell is cast at `slotLevel`.
 * @param name spell name
 * @param baseLevel the spell's own level (0 = cantrip)
 * @param slotLevel the slot level used to cast (== characterLevel for cantrips is ignored; pass characterLevel separately)
 * @param characterLevel used for cantrip scaling
 * @param abilityMod spellcasting ability modifier (added to healing where relevant)
 */
export function resolveCast(
  name: string,
  baseLevel: number,
  slotLevel: number,
  characterLevel: number,
  abilityMod: number,
): ResolvedCast {
  const data = CAST[name.trim().toLowerCase()];
  if (!data) return { kind: "utility", slotLevel };

  // Healing
  if (data.heal) {
    let expr = data.heal;
    if (baseLevel > 0 && data.healUpcast) {
      expr = addDice(expr, data.healUpcast, Math.max(0, slotLevel - baseLevel));
    }
    if (data.addModToHeal && abilityMod) {
      expr = `${expr}${abilityMod >= 0 ? "+" : ""}${abilityMod}`;
    }
    return { kind: "heal", healExpr: expr, slotLevel };
  }

  // Damage
  let dmg = data.damage ?? "";
  if (dmg) {
    if (data.cantrip) {
      dmg = scaleDice(dmg, cantripTier(characterLevel));
    } else if (data.upcast) {
      dmg = addDice(dmg, data.upcast, Math.max(0, slotLevel - baseLevel));
    }
  }
  const kind: ResolvedCast["kind"] = data.attack ? "attack" : data.save ? "save" : "utility";
  return {
    kind: dmg ? kind : "utility",
    damageExpr: dmg || undefined,
    damageType: data.damageType,
    save: data.save,
    half: data.half,
    cantrip: data.cantrip,
    slotLevel,
  };
}

/** Does the sheet know how to roll this spell? */
export function isCastable(name: string): boolean {
  return !!CAST[name.trim().toLowerCase()];
}
