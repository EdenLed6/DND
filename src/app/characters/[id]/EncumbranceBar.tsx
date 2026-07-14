import type { Encumbrance } from "@/lib/character-view";

export function EncumbranceBar({ encumbrance }: { encumbrance: Encumbrance }) {
  const { totalWeight, capacity, pushDragLift, status } = encumbrance;
  const pct = capacity > 0 ? Math.min(100, (totalWeight / capacity) * 100) : 0;

  const fillColor =
    status === "overloaded" ? "bg-red-600" :
    status === "heavily" ? "bg-blood" :
    status === "encumbered" ? "bg-orange-500" :
    "bg-gold";

  const statusLabel =
    status === "overloaded" ? "Over capacity!" :
    status === "heavily" ? "Heavily Encumbered −20 ft, disadv." :
    status === "encumbered" ? "Encumbered −10 ft" :
    null;

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between text-xs text-[#5e5448]">
        <span>Carried weight: {totalWeight} / {capacity} lb</span>
        {statusLabel && <span className="chip bg-blood text-white">{statusLabel}</span>}
      </div>
      <div className="mt-1 h-2 rounded bg-[#e9dfc5]">
        <div className={`h-2 rounded ${fillColor}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1 text-[11px] text-[#857866]">
        Counts equipped, backpack & pockets — storage excluded · Push / Drag / Lift: {pushDragLift} lb
      </div>
    </div>
  );
}
