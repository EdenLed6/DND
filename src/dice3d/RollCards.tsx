"use client";
// Roll result cards — SPEC-PLAYER.he.md §19.8. Translucent paper cards
// stacked bottom-left (above the dice tray), max 3, auto-dismissed after 8s.
// Rendered only while the 3D overlay is enabled; the tray remains the full
// roll log / fallback display.
import { useSyncExternalStore } from "react";
import { dismissCard, getSnapshot, subscribe } from "./store";
import { isOverlayAvailable } from "./index";

function verdictColor(v?: string): string {
  if (v === "CRIT!" || v === "HIT") return "var(--gold-text)";
  if (v === "MISS" || v === "NAT 1") return "var(--danger)";
  return "var(--gold-text)";
}

export function RollCards() {
  const { cards, enabled } = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  if (!enabled || cards.length === 0 || !isOverlayAvailable()) return null;

  return (
    <div className="dice3d-cards" aria-live="polite">
      {cards.map((c) => (
        <div key={c.cardId} className={`dice3d-card${c.crit ? " is-crit" : ""}${c.fumble ? " is-fumble" : ""}`}>
          <button
            type="button"
            className="dice3d-card-close"
            aria-label="Dismiss roll result"
            onClick={() => dismissCard(c.cardId)}
          >
            ✕
          </button>
          <div className="dice3d-card-kicker">{c.label}</div>
          <div className="dice3d-card-bd">
            {c.breakdown}
            {c.extra ? ` · ${c.extra}` : ""}
          </div>
          <div className="dice3d-card-row">
            <span className="dice3d-card-total">{c.total}</span>
            {c.verdict && (
              <span className="dice3d-card-verdict" style={{ color: verdictColor(c.verdict) }}>
                {c.verdict}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
