// Conditions & ongoing effects — presets, types, and pure turn-tick logic.
// See docs/design-system/CONDITIONS-COMPONENT.he.md and the "conditions"
// section of docs/design-system/index.html.

import type { Ability } from "./rules";

/** Automation triggers stored in AppliedCondition.automationJson. */
export interface AutomationRules {
  /** Dice expression rolled as damage when the target's turn STARTS (e.g. "1d6"). Prompt-based — the DM confirms. */
  startTurnDamage?: string;
  /** Damage type label for start-of-turn damage (e.g. "fire"). */
  damageType?: string;
  /** Prompt the saving throw (saveAbility/saveDc) when the target's turn ENDS. */
  endTurnSave?: boolean;
  /** Automatically expire at the given phase of the target's turn. */
  autoExpire?: "start-of-turn" | "end-of-turn" | null;
}

export type ConditionCategory =
  | "condition" | "dot" | "buff" | "debuff" | "injury" | "exhaustion" | "magic" | "custom";

/** Serializable shape of an AppliedCondition row as sent to clients. */
export interface AppliedConditionDTO {
  id: string;
  encounterId?: string | null;
  combatantId?: string | null;
  characterId?: string | null;
  name: string;
  icon?: string | null;
  category: string;
  severity?: string | null;
  sourceText?: string | null;
  durationRounds?: number | null;
  remainingRounds?: number | null;
  saveAbility?: string | null;
  saveDc?: number | null;
  stacks: number;
  visibility: "public" | "dm" | string;
  automationJson: string;
  notes?: string | null;
}

export interface ConditionPreset {
  name: string;
  /** Small glyph rendered inside the token / pill (the DS itself uses ☠ ◒ ◔ ♨ ◇ …). */
  icon: string;
  category: ConditionCategory;
  /** One-line mechanical summary. */
  summary: string;
  severity?: string;
  supportsStacks?: boolean;
  /** Max stacks / levels (Exhaustion = 6). */
  maxStacks?: number;
  automation?: AutomationRules;
}

/** The 14 official 5e conditions + the design-system extras. */
export const CONDITION_PRESETS: ConditionPreset[] = [
  // — Official rules conditions —
  { name: "Blinded",       icon: "◉", category: "condition", summary: "Can't see; attacks vs it have advantage, its attacks disadvantage" },
  { name: "Charmed",       icon: "♥", category: "condition", summary: "Can't attack the charmer; charmer has social advantage" },
  { name: "Deafened",      icon: "∅", category: "condition", summary: "Can't hear; auto-fails hearing checks" },
  { name: "Frightened",    icon: "✦", category: "condition", summary: "Disadvantage while fear source is visible; can't approach it" },
  { name: "Grappled",      icon: "✊", category: "condition", summary: "Speed 0; ends if grappler is incapacitated" },
  { name: "Incapacitated", icon: "⊘", category: "condition", summary: "Can't take actions or reactions" },
  { name: "Invisible",     icon: "◌", category: "condition", summary: "Unseen; attacks vs it have disadvantage, its attacks advantage" },
  { name: "Paralyzed",     icon: "✱", category: "condition", severity: "Severe", summary: "Incapacitated, auto-fails STR/DEX saves; melee hits are crits" },
  { name: "Petrified",     icon: "⬢", category: "condition", severity: "Severe", summary: "Turned to stone; incapacitated, resistance to all damage" },
  { name: "Poisoned",      icon: "☠", category: "condition", severity: "Severe", summary: "Disadvantage on attack rolls and ability checks" },
  { name: "Prone",         icon: "▽", category: "condition", summary: "Melee attacks vs it have advantage, ranged disadvantage; crawl to move" },
  { name: "Restrained",    icon: "⛓", category: "condition", summary: "Speed 0; attacks vs it advantage, its attacks and DEX saves disadvantage" },
  { name: "Stunned",       icon: "⚡", category: "condition", severity: "Severe", summary: "Incapacitated, auto-fails STR/DEX saves; attacks vs it advantage" },
  { name: "Unconscious",   icon: "☾", category: "condition", severity: "Severe", summary: "Incapacitated, prone, auto-fails STR/DEX saves; melee hits are crits" },
  // — Design-system extras —
  { name: "Bleeding",      icon: "◒", category: "dot", severity: "Ongoing", supportsStacks: true, maxStacks: 20,
    summary: "Takes 1d6 damage at the start of its turn (per stack)",
    automation: { startTurnDamage: "1d6" } },
  { name: "Burning",       icon: "♨", category: "dot", severity: "Ongoing",
    summary: "Takes 1d6 fire damage at the start of its turn",
    automation: { startTurnDamage: "1d6", damageType: "fire" } },
  { name: "Exhaustion",    icon: "◔", category: "exhaustion", supportsStacks: true, maxStacks: 6,
    summary: "Cumulative levels 1–6; level 6 is death" },
  { name: "Concentrating", icon: "◇", category: "magic",
    summary: "Maintaining a spell; taking damage prompts a CON save" },
];

export function findPreset(name: string): ConditionPreset | undefined {
  const n = name.trim().toLowerCase();
  return CONDITION_PRESETS.find((p) => p.name.toLowerCase() === n);
}

export function parseAutomation(json: string | null | undefined): AutomationRules {
  if (!json) return {};
  try {
    const v = JSON.parse(json);
    return v && typeof v === "object" ? (v as AutomationRules) : {};
  } catch { return {}; }
}

/** Scale a dice expression by stack count: "1d6" ×3 → "3d6" (flat modifiers untouched). */
export function scaleDiceExpr(expr: string, stacks: number): string {
  if (!stacks || stacks <= 1) return expr;
  return expr.replace(/(\d*)d(\d+)/gi, (_, c: string, s: string) => `${(c === "" ? 1 : parseInt(c, 10)) * stacks}d${s}`);
}

/** Minimal condition shape the tick logic needs (subset of AppliedConditionDTO). */
export interface TickInputCondition {
  id: string;
  combatantId?: string | null;
  name: string;
  remainingRounds?: number | null;
  saveAbility?: string | null;
  saveDc?: number | null;
  stacks?: number;
  automationJson?: string | null;
}

export interface DamagePrompt {
  conditionId: string;
  targetId: string;
  name: string;
  /** Dice expression already scaled by stacks. */
  expr: string;
  damageType?: string;
}
export interface SavePrompt {
  conditionId: string;
  targetId: string;
  name: string;
  ability: Ability | string;
  dc: number;
}
export interface TickResult {
  /** Condition ids that expired this phase (duration ran out or autoExpire). */
  expired: string[];
  /** Start-of-turn damage the DM should confirm (never auto-applied). */
  damagePrompts: DamagePrompt[];
  /** End-of-turn saves the DM should resolve. */
  savePrompts: SavePrompt[];
  /** remainingRounds decrements to persist. */
  updated: { id: string; remainingRounds: number }[];
}

/**
 * Pure turn-tick logic for one combatant's conditions.
 * - phase "start": emit damage prompts (DoT), expire autoExpire:"start-of-turn".
 * - phase "end":   decrement remainingRounds (null = until removed), expire at 0
 *                  or autoExpire:"end-of-turn", emit save prompts for the rest.
 * Expired conditions produce no prompts. Nothing is written anywhere — callers
 * (the API tick op) persist `expired` and `updated`.
 */
export function tickConditionsForTurn(conds: TickInputCondition[], phase: "start" | "end"): TickResult {
  const result: TickResult = { expired: [], damagePrompts: [], savePrompts: [], updated: [] };
  for (const c of conds) {
    const auto = parseAutomation(c.automationJson);
    let expired = auto.autoExpire === (phase === "start" ? "start-of-turn" : "end-of-turn");

    if (phase === "end" && c.remainingRounds != null) {
      const rem = c.remainingRounds - 1;
      if (rem <= 0) expired = true;
      else if (!expired) result.updated.push({ id: c.id, remainingRounds: rem });
    }
    if (expired) { result.expired.push(c.id); continue; }

    if (phase === "start" && auto.startTurnDamage) {
      result.damagePrompts.push({
        conditionId: c.id, targetId: c.combatantId ?? "", name: c.name,
        expr: scaleDiceExpr(auto.startTurnDamage, c.stacks ?? 1),
        damageType: auto.damageType,
      });
    }
    if (phase === "end" && c.saveAbility && c.saveDc != null && auto.endTurnSave !== false) {
      result.savePrompts.push({
        conditionId: c.id, targetId: c.combatantId ?? "", name: c.name,
        ability: c.saveAbility, dc: c.saveDc,
      });
    }
  }
  return result;
}
