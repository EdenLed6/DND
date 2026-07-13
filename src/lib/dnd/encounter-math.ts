// Encounter difficulty math (DMG "Creating a Combat Encounter").
// See docs/SPEC-DM.he.md §6.3. Reuses encounterMultiplier from rules.ts.

import { encounterMultiplier } from "./rules";

export interface Thresholds { easy: number; medium: number; hard: number; deadly: number }

/** DMG XP thresholds per character level (1..20). */
export const XP_THRESHOLDS: Record<number, Thresholds> = {
  1: { easy: 25, medium: 50, hard: 75, deadly: 100 },
  2: { easy: 50, medium: 100, hard: 150, deadly: 200 },
  3: { easy: 75, medium: 150, hard: 225, deadly: 400 },
  4: { easy: 125, medium: 250, hard: 375, deadly: 500 },
  5: { easy: 250, medium: 500, hard: 750, deadly: 1100 },
  6: { easy: 300, medium: 600, hard: 900, deadly: 1400 },
  7: { easy: 350, medium: 750, hard: 1100, deadly: 1700 },
  8: { easy: 450, medium: 900, hard: 1400, deadly: 2100 },
  9: { easy: 550, medium: 1100, hard: 1600, deadly: 2400 },
  10: { easy: 600, medium: 1200, hard: 1900, deadly: 2800 },
  11: { easy: 800, medium: 1600, hard: 2400, deadly: 3600 },
  12: { easy: 1000, medium: 2000, hard: 3000, deadly: 4500 },
  13: { easy: 1100, medium: 2200, hard: 3400, deadly: 5100 },
  14: { easy: 1250, medium: 2500, hard: 3800, deadly: 5700 },
  15: { easy: 1400, medium: 2800, hard: 4300, deadly: 6400 },
  16: { easy: 1600, medium: 3200, hard: 4800, deadly: 7200 },
  17: { easy: 2000, medium: 3900, hard: 5900, deadly: 8800 },
  18: { easy: 2100, medium: 4200, hard: 6300, deadly: 9500 },
  19: { easy: 2400, medium: 4900, hard: 7300, deadly: 10900 },
  20: { easy: 2800, medium: 5700, hard: 8500, deadly: 12700 },
};

/** DMG XP value per Challenge Rating. */
export const CR_TO_XP: Record<string, number> = {
  "0": 10, "1/8": 25, "1/4": 50, "1/2": 100,
  "1": 200, "2": 450, "3": 700, "4": 1100, "5": 1800,
  "6": 2300, "7": 2900, "8": 3900, "9": 5000, "10": 5900,
  "11": 7200, "12": 8400, "13": 10000, "14": 11500, "15": 13000,
  "16": 15000, "17": 18000, "18": 20000, "19": 22000, "20": 25000,
  "21": 33000, "22": 41000, "23": 50000, "24": 62000,
  "25": 75000, "26": 90000, "27": 105000, "28": 120000, "29": 135000, "30": 155000,
};

/** XP for a CR. Handles "1/8" | "1/4" | "1/2", numeric strings and numbers (0.125 etc.). */
export function crToXp(cr: string | number): number {
  if (typeof cr === "number") {
    if (cr > 0 && cr < 1) {
      if (cr <= 0.125) return CR_TO_XP["1/8"];
      if (cr <= 0.25) return CR_TO_XP["1/4"];
      return CR_TO_XP["1/2"];
    }
    return CR_TO_XP[String(Math.min(30, Math.max(0, Math.round(cr))))] ?? 0;
  }
  const s = cr.trim();
  if (s in CR_TO_XP) return CR_TO_XP[s];
  if (s.includes("/")) {
    const [a, b] = s.split("/").map(Number);
    if (b) return crToXp(a / b);
  }
  const n = Number(s);
  return Number.isFinite(n) ? crToXp(n) : 0;
}

/** DMG multiplier ladder — small/large parties shift one step up/down this ladder. */
const MULTIPLIER_STEPS = [0.5, 1, 1.5, 2, 2.5, 3, 4];

export type DifficultyRating = "trivial" | "easy" | "medium" | "hard" | "deadly";

export interface EncounterDifficulty {
  totalXp: number;
  adjustedXp: number;
  multiplier: number;
  thresholds: Thresholds;
  rating: DifficultyRating;
  perPlayerXp: number;
  warnings: string[];
}

/**
 * Compute encounter difficulty for a party (character levels) vs a monster roster.
 * Multiplier per encounterMultiplier(count), shifted one step up for parties of
 * fewer than 3 and one step down for parties of more than 5 (DMG).
 */
export function computeEncounterDifficulty(
  party: number[],
  monsters: { cr: string | number; count: number }[],
): EncounterDifficulty {
  const thresholds: Thresholds = { easy: 0, medium: 0, hard: 0, deadly: 0 };
  for (const lvl of party) {
    const t = XP_THRESHOLDS[Math.min(20, Math.max(1, Math.round(lvl)))];
    thresholds.easy += t.easy; thresholds.medium += t.medium;
    thresholds.hard += t.hard; thresholds.deadly += t.deadly;
  }

  const monsterCount = monsters.reduce((n, m) => n + Math.max(0, m.count), 0);
  const totalXp = monsters.reduce((xp, m) => xp + crToXp(m.cr) * Math.max(0, m.count), 0);

  let multiplier = 1;
  if (monsterCount > 0) {
    let idx = MULTIPLIER_STEPS.indexOf(encounterMultiplier(monsterCount));
    if (party.length > 0 && party.length < 3) idx += 1;   // small party: one step up
    else if (party.length > 5) idx -= 1;                   // large party: one step down
    multiplier = MULTIPLIER_STEPS[Math.min(MULTIPLIER_STEPS.length - 1, Math.max(0, idx))];
  }

  const adjustedXp = Math.round(totalXp * multiplier);

  let rating: DifficultyRating = "trivial";
  if (party.length > 0 && adjustedXp > 0) {
    if (adjustedXp >= thresholds.deadly) rating = "deadly";
    else if (adjustedXp >= thresholds.hard) rating = "hard";
    else if (adjustedXp >= thresholds.medium) rating = "medium";
    else if (adjustedXp >= thresholds.easy) rating = "easy";
  }

  const perPlayerXp = party.length > 0 ? Math.round(adjustedXp / party.length) : 0;

  const warnings: string[] = [];
  if (party.length > 0 && monsterCount > 2 * party.length) {
    warnings.push(`Action economy: ${monsterCount} monsters vs ${party.length} character${party.length === 1 ? "" : "s"} — the extra actions make this swingier than the XP math suggests.`);
  }
  if (monsterCount === 1 && (rating === "hard" || rating === "deadly")) {
    warnings.push("Single monster vs the whole party: it may be focused down fast — consider legendary actions, lair actions, or minions.");
  }

  return { totalXp, adjustedXp, multiplier, thresholds, rating, perPlayerXp, warnings };
}
