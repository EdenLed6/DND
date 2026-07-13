import type { Senses } from "@/lib/character-view";

export function SensesPanel({ senses }: { senses: Senses }) {
  const boxes = [
    { label: "Passive Perception", value: senses.passivePerception },
    { label: "Passive Investigation", value: senses.passiveInvestigation },
    { label: "Passive Insight", value: senses.passiveInsight },
  ];
  return (
    <div className="card">
      <h3 className="mb-2 font-display text-gold">Senses</h3>
      <div className="grid grid-cols-3 gap-2 text-center">
        {boxes.map((b) => (
          <div key={b.label} className="stat-box">
            <div className="text-[10px] uppercase text-[#6b5a42]">{b.label}</div>
            <div className="font-display text-2xl text-gold">{b.value}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between text-sm">
        <span className="text-[#6b5a42]">Darkvision</span>
        <b>{senses.darkvision != null ? `${senses.darkvision} ft` : "Normal vision"}</b>
      </div>
    </div>
  );
}
