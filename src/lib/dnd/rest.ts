// Rest logic. See docs/03-DND-BRAIN.md §13.
import type { DerivedCharacter } from "./character";

export interface RestUpdate {
  currentHp?: number;
  tempHp?: number;
  hitDiceUsed?: number;
  exhaustion?: number;
  deathSuccess?: number;
  deathFail?: number;
  concentration?: null;
  spellcastingJson?: string;
}

/** Compute the DB patch for a rest. */
export function computeRest(
  character: { currentHp: number; hitDiceUsed: number; exhaustion: number; spellcastingJson: string },
  derived: DerivedCharacter,
  type: "SHORT" | "LONG"
): RestUpdate {
  let sc: any = {};
  try { sc = JSON.parse(character.spellcastingJson || "{}"); } catch {}

  if (type === "LONG") {
    const totalHd = derived.hitDiceTotal.reduce((s, h) => s + h.count, 0);
    const regained = Math.max(1, Math.floor(totalHd / 2));
    sc.slotsUsed = {};        // all spell slots back
    sc.pactUsed = 0;          // pact slots back
    return {
      currentHp: derived.maxHp,
      tempHp: 0,
      hitDiceUsed: Math.max(0, character.hitDiceUsed - regained),
      exhaustion: Math.max(0, character.exhaustion - 1),
      deathSuccess: 0,
      deathFail: 0,
      concentration: null,
      spellcastingJson: JSON.stringify(sc),
    };
  }
  // SHORT rest: warlock pact slots refresh; short-rest resources handled separately
  sc.pactUsed = 0;
  return { spellcastingJson: JSON.stringify(sc) };
}
