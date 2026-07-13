// Class-resource derivation. See docs/03-DND-BRAIN.md §14.
// Given a character's classes/subclasses/levels and ability mods, derive the
// pool of limited-use class features D&D Beyond shows as "trackers" (Ki, Rage,
// Bardic Inspiration, Channel Divinity, Sorcery Points, Superiority Dice, Lay on
// Hands, Second Wind, Action Surge, Wild Shape, Rages, Arcane Recovery, ...).
//
// Each entry reports a max, when it recharges, and whether it is a die pool.
// The DB (CharacterResource) stores the live `used` count; this table supplies
// the derived `max`/`resetOn` so the sheet stays in sync as the character levels.
import type { Ability } from "./rules";

export interface DerivedResource {
  key: string;                 // stable id, e.g. "ki", "rage" (used to merge with stored `used`)
  name: string;                // display label, e.g. "Ki Points"
  max: number;
  resetOn: "SHORT" | "LONG";
  unit?: string;               // e.g. "d6" for die pools, "HP" for Lay on Hands
  note?: string;               // short reminder, e.g. "1 ki / turn"
}

interface ClassLevel { name: string; subclass?: string | null; level: number; }

const RAGES_BY_LEVEL = [0, 2, 2, 3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 6, 6, 6, 999];
// Battle Master superiority dice count by fighter level (feature at L3).
const SUPERIORITY_DICE = (lvl: number) => (lvl >= 15 ? 6 : lvl >= 7 ? 5 : lvl >= 3 ? 4 : 0);
const SUPERIORITY_DIE = (lvl: number) => (lvl >= 18 ? 12 : lvl >= 10 ? 10 : 8);
// Bardic Inspiration die size by bard level.
const BARDIC_DIE = (lvl: number) => (lvl >= 15 ? 10 : lvl >= 10 ? 8 : lvl >= 5 ? 6 : 6);
// Channel Divinity uses per short rest (Cleric).
const CLERIC_CHANNEL = (lvl: number) => (lvl >= 18 ? 3 : lvl >= 6 ? 2 : lvl >= 2 ? 1 : 0);
// Indomitable uses (Fighter).
const INDOMITABLE = (lvl: number) => (lvl >= 17 ? 3 : lvl >= 13 ? 2 : lvl >= 9 ? 1 : 0);
// Action Surge uses (Fighter).
const ACTION_SURGE = (lvl: number) => (lvl >= 17 ? 2 : lvl >= 2 ? 1 : 0);
// Wild Shape uses (Druid) — always 2 (unlimited effectively, but tracked as 2/rest).
const clamp0 = (n: number) => Math.max(0, n);

export function deriveResources(classes: ClassLevel[], mods: Record<Ability, number>, pb: number): DerivedResource[] {
  const out: DerivedResource[] = [];
  const lvlOf = (name: string) => classes.filter((c) => c.name === name).reduce((s, c) => s + c.level, 0);
  const has = (name: string) => classes.some((c) => c.name === name);
  const subOf = (name: string) => classes.find((c) => c.name === name)?.subclass ?? null;

  // ---- Barbarian ----
  if (has("Barbarian")) {
    const lvl = lvlOf("Barbarian");
    out.push({ key: "rage", name: "Rage", max: RAGES_BY_LEVEL[Math.min(lvl, 20)] >= 999 ? 6 : RAGES_BY_LEVEL[Math.min(lvl, 20)], resetOn: "LONG", note: "damage bonus & resistance" });
  }

  // ---- Monk ----
  if (has("Monk")) {
    const lvl = lvlOf("Monk");
    if (lvl >= 2) out.push({ key: "ki", name: "Ki Points", max: lvl, resetOn: "SHORT", note: "Flurry / Patient Defense / Step of the Wind" });
  }

  // ---- Fighter ----
  if (has("Fighter")) {
    const lvl = lvlOf("Fighter");
    out.push({ key: "second-wind", name: "Second Wind", max: 1, resetOn: "SHORT", unit: "HP", note: `heal 1d10+${lvl}` });
    if (ACTION_SURGE(lvl) > 0) out.push({ key: "action-surge", name: "Action Surge", max: ACTION_SURGE(lvl), resetOn: "SHORT", note: "extra action" });
    if (INDOMITABLE(lvl) > 0) out.push({ key: "indomitable", name: "Indomitable", max: INDOMITABLE(lvl), resetOn: "LONG", note: "reroll a failed save" });
    if (/battle ?master/i.test(subOf("Fighter") ?? "") && SUPERIORITY_DICE(lvl) > 0) {
      out.push({ key: "superiority", name: "Superiority Dice", max: SUPERIORITY_DICE(lvl), resetOn: "SHORT", unit: `d${SUPERIORITY_DIE(lvl)}`, note: "combat maneuvers" });
    }
  }

  // ---- Bard ----
  if (has("Bard")) {
    const lvl = lvlOf("Bard");
    out.push({ key: "bardic-inspiration", name: "Bardic Inspiration", max: clamp0(mods.cha) || 1, resetOn: lvl >= 5 ? "SHORT" : "LONG", unit: `d${BARDIC_DIE(lvl)}`, note: "give an ally a bonus die" });
    if (lvl >= 20) out.push({ key: "superior-inspiration", name: "Superior Inspiration", max: 1, resetOn: "SHORT" });
  }

  // ---- Cleric ----
  if (has("Cleric")) {
    const lvl = lvlOf("Cleric");
    if (CLERIC_CHANNEL(lvl) > 0) out.push({ key: "channel-divinity", name: "Channel Divinity", max: CLERIC_CHANNEL(lvl), resetOn: "SHORT", note: "Turn Undead & domain option" });
  }

  // ---- Paladin ----
  if (has("Paladin")) {
    const lvl = lvlOf("Paladin");
    if (lvl >= 1) out.push({ key: "lay-on-hands", name: "Lay on Hands", max: lvl * 5, resetOn: "LONG", unit: "HP", note: "heal pool" });
    if (lvl >= 3) out.push({ key: "channel-divinity-pal", name: "Channel Divinity", max: 1, resetOn: "SHORT", note: "oath option" });
    if (lvl >= 3) out.push({ key: "divine-sense", name: "Divine Sense", max: 1 + clamp0(mods.cha), resetOn: "LONG", note: "detect celestial/fiend/undead" });
  }

  // ---- Druid ----
  if (has("Druid")) {
    const lvl = lvlOf("Druid");
    if (lvl >= 2) out.push({ key: "wild-shape", name: "Wild Shape", max: 2, resetOn: "SHORT", note: "transform into a beast" });
  }

  // ---- Sorcerer ----
  if (has("Sorcerer")) {
    const lvl = lvlOf("Sorcerer");
    if (lvl >= 2) out.push({ key: "sorcery-points", name: "Sorcery Points", max: lvl, resetOn: "LONG", note: "Font of Magic: convert to/from slots" });
  }

  // ---- Wizard ----
  if (has("Wizard")) {
    const lvl = lvlOf("Wizard");
    if (lvl >= 1) out.push({ key: "arcane-recovery", name: "Arcane Recovery", max: 1, resetOn: "LONG", note: `recover slots (≤${Math.ceil(lvl / 2)} levels) on a short rest` });
  }

  // ---- Warlock (Mystic Arcanum & Eldritch Master handled via pact slots) ----
  // Pact slots already tracked separately; nothing else pooled here.

  return out;
}

/**
 * Merge derived resources (max/reset) with the stored used counts.
 * `stored` maps a resource key -> used. Unknown stored keys are ignored.
 */
export function mergeResourceUsage(derived: DerivedResource[], stored: Record<string, number>): (DerivedResource & { used: number })[] {
  return derived.map((r) => ({ ...r, used: Math.min(r.max, Math.max(0, stored[r.key] ?? 0)) }));
}
