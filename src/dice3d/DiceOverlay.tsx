"use client";
// 3D dice overlay chrome — SPEC-PLAYER.he.md §19.2, §19.6.
// Mounted (client-only) from DiceTray so every page with a tray gets the
// overlay: roll result cards + the Dice Builder drawer opened by the floating
// dice button. The WebGL canvas itself is created lazily by the engine on the
// first throw (fixed, transparent, pointer-events:none, z-index 44).
import { useState, useSyncExternalStore } from "react";
import { rollToTray } from "@/components/DiceTray";
import { clearDice, isOverlayAvailable, setOverlayEnabled } from "./index";
import { closeBuilder, getSnapshot, subscribe } from "./store";
import { RollCards } from "./RollCards";

const DIE_TYPES = [4, 6, 8, 10, 12, 20, 100] as const;

export function DiceOverlay() {
  return (
    <>
      <RollCards />
      <DiceBuilder />
    </>
  );
}

function DiceBuilder() {
  const { builderOpen, enabled } = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const [pool, setPool] = useState<Record<number, number>>({});
  const [mod, setMod] = useState(0);

  if (!builderOpen) return null;

  const add = (sides: number) =>
    setPool((p) => ({ ...p, [sides]: Math.min((p[sides] ?? 0) + 1, 20) }));
  const removeOne = (sides: number) =>
    setPool((p) => {
      const n = (p[sides] ?? 0) - 1;
      const next = { ...p };
      if (n <= 0) delete next[sides];
      else next[sides] = n;
      return next;
    });
  const reset = () => { setPool({}); setMod(0); };

  const parts = DIE_TYPES.filter((s) => pool[s]).map((s) => `${pool[s]}d${s}`);
  const canRoll = parts.length > 0;

  const doRoll = () => {
    if (!canRoll) return;
    const expr = parts.join("+") + (mod ? (mod > 0 ? `+${mod}` : `${mod}`) : "");
    rollToTray("Custom Roll", expr);
    window.dispatchEvent(new CustomEvent("dice-tray-expand"));
  };

  return (
    <div className="dice3d-builder" role="dialog" aria-label="Dice builder">
      <div className="dice3d-builder-head">
        <span className="dice3d-card-kicker">Dice Builder</span>
        <button type="button" className="dice3d-card-close" aria-label="Close dice builder" onClick={closeBuilder}>
          ✕
        </button>
      </div>

      <div className="dice3d-builder-dice">
        {DIE_TYPES.map((s) => (
          <button
            key={s}
            type="button"
            className={`dice3d-die-btn${pool[s] ? " has-count" : ""}`}
            onClick={() => add(s)}
            onContextMenu={(e) => { e.preventDefault(); removeOne(s); }}
            title={`Add d${s} (right-click / long-press removes one)`}
          >
            d{s}
            {pool[s] ? <span className="dice3d-die-badge">{pool[s]}</span> : null}
          </button>
        ))}
      </div>

      <div className="dice3d-builder-mod">
        <label htmlFor="dice3d-mod">Modifier</label>
        <input
          id="dice3d-mod"
          className="input"
          type="number"
          value={mod}
          onChange={(e) => setMod(Number(e.target.value) || 0)}
        />
        <span className="dice3d-builder-expr">
          {canRoll ? parts.join(" + ") + (mod ? ` ${mod > 0 ? "+" : "−"} ${Math.abs(mod)}` : "") : "Pick some dice"}
        </span>
      </div>

      <div className="dice3d-builder-actions">
        <button type="button" className="btn-ghost" onClick={reset}>Reset</button>
        <button type="button" className="btn-ghost" onClick={() => clearDice()}>Clear Dice</button>
        <button type="button" className="btn-primary" disabled={!canRoll} onClick={doRoll}>Roll</button>
      </div>

      <label className="dice3d-toggle">
        <input
          type="checkbox"
          checked={enabled && isOverlayAvailable()}
          onChange={(e) => setOverlayEnabled(e.target.checked)}
        />
        3D dice on screen
      </label>
    </div>
  );
}
