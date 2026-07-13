"use client";
// Dice roller page — quick rolls feed the shared DiceTray, whose roll log
// serves as the session's dice history for now.
import { useState } from "react";
import { DiceTray, rollToTray } from "@/components/DiceTray";
import { FloatingDice } from "@/components/FloatingDice";

const QUICK: { label: string; expr: string }[] = [
  { label: "d4", expr: "1d4" },
  { label: "d6", expr: "1d6" },
  { label: "d8", expr: "1d8" },
  { label: "d10", expr: "1d10" },
  { label: "d12", expr: "1d12" },
  { label: "d20", expr: "1d20" },
  { label: "2d6", expr: "2d6" },
];

export function DiceHistory() {
  const [expr, setExpr] = useState("");

  function rollCustom() {
    const v = expr.trim();
    if (v) rollToTray(v.toUpperCase(), v);
  }

  return (
    <main className="has-dice-tray mx-auto max-w-2xl space-y-4 p-4">
      <h1 className="font-display text-2xl text-gold">Dice Roller</h1>
      <p className="muted text-sm">
        Roll dice below — every result lands in the tray, and the roll log keeps your session history.
      </p>

      <div className="card space-y-3">
        <div className="flex flex-wrap gap-2">
          {QUICK.map((q) => (
            <button
              key={q.label}
              type="button"
              className="btn-ghost"
              onClick={() => rollToTray(q.expr.toUpperCase(), q.expr)}
            >
              {q.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            className="input flex-1"
            placeholder="Custom roll, e.g. 2d6+3"
            value={expr}
            onChange={(e) => setExpr(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") rollCustom(); }}
          />
          <button type="button" className="btn-gold" onClick={rollCustom}>Roll</button>
        </div>
      </div>

      <DiceTray />
      <FloatingDice />
    </main>
  );
}
