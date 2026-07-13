"use client";
// Short/Long rest + spend-hit-die. PURE/CONTROLLED: rolls dice to the tray and
// calls parent callbacks; the parent persists. No fetch here.
import { roll } from "@/lib/dnd/dice";
import { pushTrayEntry } from "@/components/DiceTray";

interface RestPanelProps {
  hitDice: { die: number; count: number }[];
  hitDiceUsed: number;
  conMod: number;
  totalHitDice: number;
  canUse: boolean;
  onShortRest: () => void;
  onLongRest: () => void;
  onSpendHitDie: (die: number, healed: number) => void;
}

export function RestPanel({
  hitDice, hitDiceUsed, conMod, totalHitDice, canUse, onShortRest, onLongRest, onSpendHitDie,
}: RestPanelProps) {
  const remaining = Math.max(0, totalHitDice - hitDiceUsed);

  function spendHitDie(die: number) {
    const expr = `1d${die}${conMod >= 0 ? "+" : ""}${conMod}`;
    const r = roll(expr);
    // Roll once, show it, and report the same total to the parent (no double-roll).
    pushTrayEntry({ label: `Hit Die (d${die})`, dice: r.dice, total: r.total, breakdown: r.breakdown, extra: "HP recovered" });
    onSpendHitDie(die, r.total);
  }

  return (
    <div className="card">
      <h3 className="mb-2 font-display text-gold">Rest</h3>
      <div className="flex gap-2">
        <button type="button" className="btn-ghost" disabled={!canUse} onClick={onShortRest}>Short Rest</button>
        <button type="button" className="btn-gold" disabled={!canUse} onClick={onLongRest}>Long Rest</button>
      </div>
      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between text-sm">
          <span className="text-xs uppercase tracking-wide text-gold">Spend Hit Die</span>
          <span className="text-xs text-[#6b5a42]">{remaining}/{totalHitDice} remaining</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {hitDice.map((hd) => (
            <button key={hd.die} type="button" className="btn-ghost" disabled={!canUse || remaining <= 0}
              onClick={() => spendHitDie(hd.die)} title={`Roll a d${hd.die} hit die`}>
              Roll d{hd.die}{conMod >= 0 ? "+" : ""}{conMod}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
