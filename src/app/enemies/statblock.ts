// Shared shapes + helpers for the Enemy Library / Homebrew builder.
// A "stat block" mirrors an SrdMonster row (minus id): scalar fields at the
// top level, and traits/actions/legendaryActions/reactions stored as
// JSON STRINGS of [{ name, description }] — the exact format the combat
// engine's parseActions() (src/lib/dnd/combat.ts) reads from monster rows.

export interface NamedEntry { name: string; description: string; }

export interface StatBlock {
  name: string;
  size?: string | null;
  type?: string | null;
  subtype?: string | null;
  alignment?: string | null;
  ac: number;
  acType?: string | null;
  hp: number;
  hitDice?: string | null;
  speed?: string | null;
  str: number; dex: number; con: number; int: number; wis: number; cha: number;
  cr: string;
  xp?: number | null;
  proficiencyBonus?: number | null;
  senses?: string | null;
  languages?: string | null;
  resistances?: string | null;
  immunities?: string | null;
  vulnerabilities?: string | null;
  conditionImmunities?: string | null;
  savingThrows?: string | null;
  skills?: string | null;
  traits?: string | null;           // JSON string [{name, description}]
  actions?: string | null;          // JSON string [{name, description}]
  legendaryActions?: string | null; // JSON string [{name, description}]
  reactions?: string | null;        // JSON string [{name, description}]
}

export const MONSTER_TYPES = [
  "aberration", "beast", "celestial", "construct", "dragon", "elemental", "fey",
  "fiend", "giant", "humanoid", "monstrosity", "ooze", "plant", "undead",
];

export const MONSTER_SIZES = ["Tiny", "Small", "Medium", "Large", "Huge", "Gargantuan"];

export const CR_VALUES = [
  "0", "1/8", "1/4", "1/2",
  ...Array.from({ length: 30 }, (_, i) => String(i + 1)),
];

// SRD XP by challenge rating (DMG table), used when saving homebrew.
export const CR_XP: Record<string, number> = {
  "0": 10, "1/8": 25, "1/4": 50, "1/2": 100, "1": 200, "2": 450, "3": 700,
  "4": 1100, "5": 1800, "6": 2300, "7": 2900, "8": 3900, "9": 5000, "10": 5900,
  "11": 7200, "12": 8400, "13": 10000, "14": 11500, "15": 13000, "16": 15000,
  "17": 18000, "18": 20000, "19": 22000, "20": 25000, "21": 33000, "22": 41000,
  "23": 50000, "24": 62000, "25": 75000, "26": 90000, "27": 105000, "28": 120000,
  "29": 135000, "30": 155000,
};

export function abilityModText(score: number): string {
  const m = Math.floor((score - 10) / 2);
  return m >= 0 ? `+${m}` : `${m}`;
}

/** Parse a JSON-string column of [{name, description}]; tolerant of bad data. */
export function parseEntries(s: string | null | undefined): NamedEntry[] {
  if (!s) return [];
  try {
    const arr = JSON.parse(s);
    if (!Array.isArray(arr)) return [];
    return arr.filter((e) => e && typeof e.name === "string" && typeof e.description === "string");
  } catch { return []; }
}

/** SRD stores speed as a JSON object string like {"walk":"30 ft."} — render either form. */
export function speedText(speed: string | null | undefined): string {
  if (!speed) return "—";
  try {
    const o = JSON.parse(speed);
    if (o && typeof o === "object" && !Array.isArray(o)) {
      return Object.entries(o).map(([k, v]) => (k === "walk" ? String(v) : `${k} ${v}`)).join(", ");
    }
  } catch { /* plain string */ }
  return speed;
}

/** Average roll of "2d6+3"-style dice, for composing "Hit: 5 (1d6 + 2) ..." text. */
export function averageOfDice(dice: string): number | null {
  const m = dice.replace(/\s+/g, "").match(/^(\d+)d(\d+)([+-]\d+)?$/i);
  if (!m) return null;
  const n = parseInt(m[1], 10), sides = parseInt(m[2], 10), mod = m[3] ? parseInt(m[3], 10) : 0;
  return Math.max(1, Math.floor(n * ((sides + 1) / 2)) + mod);
}

/**
 * Compose an action description the combat engine can parse. parseAttack()
 * matches "+N to hit" and "(XdY+Z) <type> damage", so attack fields are
 * rendered in the standard SRD sentence format.
 */
export function composeActionDescription(text: string, toHit: string, dice: string, dtype: string): string {
  const base = text.trim();
  const hasAttackFields = toHit.trim() !== "" || dice.trim() !== "";
  if (!hasAttackFields) return base;

  const parts: string[] = [];
  if (toHit.trim() !== "") {
    const n = parseInt(toHit, 10);
    if (!Number.isNaN(n)) parts.push(`${n >= 0 ? "+" : ""}${n} to hit, one target.`);
  }
  if (dice.trim() !== "") {
    const d = dice.replace(/\s+/g, "");
    const avg = averageOfDice(d);
    const type = dtype.trim().toLowerCase();
    parts.push(`Hit: ${avg ?? ""}${avg ? " " : ""}(${d})${type ? ` ${type}` : ""} damage.`);
  }
  const attackSentence = parts.length ? `Melee or Ranged Attack: ${parts.join(" ")}` : "";
  return [base, attackSentence].filter(Boolean).join(" ").trim();
}
