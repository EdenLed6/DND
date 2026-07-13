"use client";
// Class-resource trackers (Ki, Rage, Bardic Inspiration, ...). PURE/CONTROLLED:
// clicking a pip calls onSetUsed; the parent persists. No fetch here.
import type { DerivedResource } from "@/lib/dnd/resources";

interface ResourcePanelProps {
  resources: (DerivedResource & { used: number })[];
  canUse: boolean;
  onSetUsed: (key: string, used: number) => void;
}

export function ResourcePanel({ resources, canUse, onSetUsed }: ResourcePanelProps) {
  if (resources.length === 0) return null;
  return (
    <div className="card">
      <h3 className="mb-2 font-display text-gold">Resources</h3>
      <div className="space-y-3">
        {resources.map((r) => (
          <div key={r.key}>
            <div className="flex items-center justify-between text-sm">
              <span>
                <b>{r.name}</b>
                {r.unit ? <span className="text-[11px] text-[#857866]"> · {r.unit}</span> : null}
                {r.note ? <span className="muted"> · {r.note}</span> : null}
              </span>
              <span className="flex items-center gap-2">
                <span className="chip">{r.resetOn}</span>
                <button type="button" className="btn-ghost" disabled={!canUse}
                  onClick={() => onSetUsed(r.key, 0)} title="Reset">Reset</button>
              </span>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <div className="flex flex-wrap gap-1">
                {Array.from({ length: r.max }).map((_, i) => (
                  <button key={i} disabled={!canUse}
                    onClick={() => onSetUsed(r.key, i < r.used ? i : i + 1)}
                    className={`h-4 w-4 rounded-full border ${i < r.used ? "bg-[#e9dfc5] border-[#cdbf9f]" : "bg-gold border-gold"}`}
                    title={i < r.used ? "used" : "available"} />
                ))}
              </div>
              <span className="text-xs text-[#5e5448]">{r.used}/{r.max}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
