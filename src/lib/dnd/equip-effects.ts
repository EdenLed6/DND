/**
 * Equipment effect helpers — pure, dependency-free, and robust to missing or
 * garbled `customJson`. This module is the integration contract used by the
 * character sheet's AC calculation (character-view.ts imports computeEquippedAc).
 *
 * `customJson` is a JSON blob stored on each InventoryItem, populated from the
 * source SRD equipment/magic item at add-time so equip effects work offline.
 * Recognised shape (all fields optional):
 *   {
 *     name?: string,            // display name, used in the AC breakdown
 *     acBase?: number,          // armor sets a base AC (e.g. Chain Mail 16)
 *     addDex?: boolean,         // does DEX add to acBase (light/medium armor)?
 *     acMaxBonus?: number,      // cap on DEX added by armor (medium = 2)
 *     acBonus?: number,         // flat AC bonus (shield +2, ring of protection…)
 *     requiresAttunement?: boolean, // acBonus only applies while attuned
 *     damage?: string,          // weapon damage dice, e.g. "1d8"
 *     damageType?: string,
 *     weightLb?: number,        // per-unit weight in pounds
 *     costGp?: number,
 *     desc?: string,
 *   }
 */

export type ItemEffect = {
  name?: string;
  acBonus?: number;
  acBase?: number;
  addDex?: boolean;
  acMaxBonus?: number;
  requiresAttunement?: boolean;
  damage?: string;
  damageType?: string;
  weightLb?: number;
  costGp?: number;
  desc?: string;
};

type EffectItem = { equipped: boolean; attuned: boolean; customJson: string | null };

const num = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) ? v : undefined;
const str = (v: unknown): string | undefined =>
  typeof v === "string" && v.length > 0 ? v : undefined;
const bool = (v: unknown): boolean | undefined =>
  typeof v === "boolean" ? v : undefined;

/** Fully parse a customJson blob into an ItemEffect. Never throws. */
export function parseFullEffect(customJson: string | null | undefined): ItemEffect {
  if (!customJson || typeof customJson !== "string") return {};
  let raw: any;
  try {
    raw = JSON.parse(customJson);
  } catch {
    return {};
  }
  if (!raw || typeof raw !== "object") return {};
  const eff: ItemEffect = {};
  const name = str(raw.name); if (name !== undefined) eff.name = name;
  const acBonus = num(raw.acBonus); if (acBonus !== undefined) eff.acBonus = acBonus;
  const acBase = num(raw.acBase); if (acBase !== undefined) eff.acBase = acBase;
  const addDex = bool(raw.addDex); if (addDex !== undefined) eff.addDex = addDex;
  // Accept the canonical `acMaxBonus` and the homebrew alias `maxDex`.
  const acMaxBonus = num(raw.acMaxBonus) ?? num(raw.maxDex); if (acMaxBonus !== undefined) eff.acMaxBonus = acMaxBonus;
  // Accept canonical `requiresAttunement` and the homebrew alias `attunement`.
  const reqAtt = bool(raw.requiresAttunement) ?? bool(raw.attunement); if (reqAtt !== undefined) eff.requiresAttunement = reqAtt;
  const damage = str(raw.damage); if (damage !== undefined) eff.damage = damage;
  const damageType = str(raw.damageType); if (damageType !== undefined) eff.damageType = damageType;
  // Accept canonical `weightLb` and the homebrew/SRD alias `weight`.
  const weightLb = num(raw.weightLb) ?? num(raw.weight); if (weightLb !== undefined) eff.weightLb = weightLb;
  const costGp = num(raw.costGp); if (costGp !== undefined) eff.costGp = costGp;
  const desc = str(raw.desc); if (desc !== undefined) eff.desc = desc;
  return eff;
}

/**
 * Parse the documented subset of an item's effect. Kept as the narrow public
 * contract requested by integration; use parseFullEffect for the richer shape.
 */
export function parseItemEffect(
  customJson: string | null,
): { acBonus?: number; acBase?: number; addDex?: boolean; damage?: string; weightLb?: number } {
  const e = parseFullEffect(customJson);
  const out: { acBonus?: number; acBase?: number; addDex?: boolean; damage?: string; weightLb?: number } = {};
  if (e.acBonus !== undefined) out.acBonus = e.acBonus;
  if (e.acBase !== undefined) out.acBase = e.acBase;
  if (e.addDex !== undefined) out.addDex = e.addDex;
  if (e.damage !== undefined) out.damage = e.damage;
  if (e.weightLb !== undefined) out.weightLb = e.weightLb;
  return out;
}

/**
 * Compute AC from equipped items and a DEX modifier.
 *
 * Returns null when no armor (an item with acBase) is equipped, letting the
 * caller fall back to its own unarmored formula (10 + DEX, barbarian/monk, …).
 * When armor is equipped:
 *   AC = acBase
 *      + (addDex ? min(dexMod, acMaxBonus ?? ∞) : 0)   // DEX capped by armor type
 *      + Σ acBonus of equipped items (shields, etc.), where items flagged
 *        requiresAttunement only count while attuned.
 */
export function computeEquippedAc(
  items: EffectItem[],
  dexMod: number,
): { ac: number; breakdown: string } | null {
  const dex = Number.isFinite(dexMod) ? Math.trunc(dexMod) : 0;
  const equipped = (items ?? []).filter((i) => i && i.equipped);

  // Pick the armor: the equipped item that defines acBase (highest wins on ties).
  let armor: ItemEffect | null = null;
  const bonuses: { label: string; amount: number }[] = [];
  for (const it of equipped) {
    const eff = parseFullEffect(it.customJson);
    if (eff.acBase !== undefined) {
      if (!armor || eff.acBase > (armor.acBase ?? 0)) armor = eff;
    }
    if (eff.acBonus !== undefined && eff.acBase === undefined) {
      // A flat-bonus item (shield, ring…). Honour attunement gating.
      if (eff.requiresAttunement && !it.attuned) continue;
      bonuses.push({ label: eff.name ?? "Bonus", amount: eff.acBonus });
    }
  }

  if (!armor) return null;

  const fmt = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
  let ac = armor.acBase ?? 0;
  const parts: string[] = [`${armor.name ?? "Armor"} ${armor.acBase}`];

  if (armor.addDex) {
    const capped = armor.acMaxBonus !== undefined ? Math.min(dex, armor.acMaxBonus) : dex;
    ac += capped;
    parts.push(`DEX (${fmt(capped)})`);
  }
  for (const b of bonuses) {
    ac += b.amount;
    parts.push(`${b.label} ${b.amount}`);
  }

  return { ac, breakdown: `${parts.join(" + ")} = ${ac}` };
}

/** Total per-unit weight (lb) across items, honouring optional quantity. */
export function totalCarriedWeightLb(
  items: { customJson: string | null; quantity?: number }[],
): number {
  let total = 0;
  for (const it of items ?? []) {
    const w = parseFullEffect(it.customJson).weightLb;
    if (w !== undefined) total += w * (it.quantity ?? 1);
  }
  return Math.round(total * 10) / 10;
}
