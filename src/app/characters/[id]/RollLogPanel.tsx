"use client";
// Persistent roll-log panel for the character sheet. Fetches recent rolls and
// live-updates when this character rolls (listens for a window event).
import { useCallback, useEffect, useState } from "react";

type Row = { id: string; label: string; expression: string | null; total: number; breakdown: string; ts: string };

export function RollLogPanel({ characterId }: { characterId: string }) {
  const [rows, setRows] = useState<Row[] | null>(null);

  const load = useCallback(() => {
    fetch(`/api/roll-log?characterId=${encodeURIComponent(characterId)}&take=40`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setRows)
      .catch(() => setRows([]));
  }, [characterId]);

  useEffect(() => {
    load();
    const onRoll = () => load();
    window.addEventListener("roll-logged", onRoll);
    return () => window.removeEventListener("roll-logged", onRoll);
  }, [load]);

  return (
    <div className="card">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-display text-gold">Roll Log</h3>
        <button className="btn-ghost btn-compact" onClick={load} title="Refresh">↻</button>
      </div>
      {rows === null ? (
        <p className="muted text-sm">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="muted text-sm">No rolls yet. Roll from an ability, save, attack, or the dice tray.</p>
      ) : (
        <div className="space-y-1">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center justify-between border-b border-[#e2d6b8] py-1 text-sm last:border-0">
              <span className="min-w-0">
                <span className="font-semibold">{r.label || r.expression || "Roll"}</span>
                {r.breakdown && <span className="muted ml-2 text-xs">{r.breakdown}</span>}
              </span>
              <b className="ml-2 tabular-nums text-gold">{r.total}</b>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
