"use client";
// v2.2 roll options bar (SPEC-PLAYER §5.1, §6.3): a slim control row that arms
// the NEXT roll with advantage/disadvantage and a situational bonus.
// Implemented as a module-level store (same pattern as DiceTray) so any
// click-to-roll call site can read/consume the current options.
import { useSyncExternalStore } from "react";

export interface RollOptions {
  advantage: boolean;
  disadvantage: boolean;
  bonus: number;
}

type Mode = "adv" | "normal" | "dis";
interface OptionsState { mode: Mode; bonus: number; autoReset: boolean; }

let state: OptionsState = { mode: "normal", bonus: 0, autoReset: true };
const listeners = new Set<() => void>();
function emit() { for (const l of listeners) l(); }
function subscribe(cb: () => void) { listeners.add(cb); return () => { listeners.delete(cb); }; }
function getSnapshot(): OptionsState { return state; }
function set(patch: Partial<OptionsState>) { state = { ...state, ...patch }; emit(); }

/** Peek at the currently armed options without resetting them. */
export function getRollOptions(): RollOptions {
  return { advantage: state.mode === "adv", disadvantage: state.mode === "dis", bonus: state.bonus };
}

/** Read the options for a roll; when auto-reset is on, snap back to Normal / +0. */
export function consumeRollOptions(): RollOptions {
  const o = getRollOptions();
  if (state.autoReset && (state.mode !== "normal" || state.bonus !== 0)) {
    set({ mode: "normal", bonus: 0 });
  }
  return o;
}

/** Decorate a roll label with the applied options: "Athletics (adv) +2 sit." */
export function decorateRollLabel(label: string, o: RollOptions): string {
  let out = label;
  if (o.advantage && !o.disadvantage) out += " (adv)";
  if (o.disadvantage && !o.advantage) out += " (dis)";
  if (o.bonus !== 0) out += ` ${o.bonus > 0 ? "+" : ""}${o.bonus} sit.`;
  return out;
}

function clampBonus(n: number): number {
  const v = Math.trunc(n);
  if (Number.isNaN(v)) return 0;
  return Math.max(-10, Math.min(10, v));
}

const MODES: { id: Mode; label: string; title: string }[] = [
  { id: "adv", label: "Adv", title: "Next roll with advantage" },
  { id: "normal", label: "Normal", title: "Next roll is normal" },
  { id: "dis", label: "Dis", title: "Next roll with disadvantage" },
];

export function RollOptionsBar() {
  const s = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return (
    <div className="panel-inset roll-options-bar" role="group" aria-label="Roll options">
      <span className="roll-options-title">Next roll</span>
      <div className="tabbar roll-options-seg" role="group" aria-label="Advantage state">
        {MODES.map((m) => (
          <button key={m.id} type="button" className="tab" data-active={s.mode === m.id}
            aria-pressed={s.mode === m.id} title={m.title}
            onClick={() => set({ mode: m.id })}>
            {m.label}
          </button>
        ))}
      </div>
      <span className="roll-options-bonus">
        <span className="roll-options-title" id="roll-sit-label">Situational</span>
        <button type="button" className="btn-ghost roll-options-step" aria-label="Decrease situational bonus"
          onClick={() => set({ bonus: clampBonus(s.bonus - 1) })}>−</button>
        <input className="input roll-options-input" inputMode="numeric" aria-labelledby="roll-sit-label"
          value={s.bonus}
          onChange={(e) => set({ bonus: clampBonus(parseInt(e.target.value, 10)) })} />
        <button type="button" className="btn-ghost roll-options-step" aria-label="Increase situational bonus"
          onClick={() => set({ bonus: clampBonus(s.bonus + 1) })}>+</button>
      </span>
      <label className="roll-options-reset" title="Return to Normal / +0 after each roll">
        <input type="checkbox" checked={s.autoReset}
          onChange={(e) => set({ autoReset: e.target.checked })} />
        resets after roll
      </label>
    </div>
  );
}
