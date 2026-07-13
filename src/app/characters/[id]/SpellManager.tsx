"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function SpellManager({ characterId, spells, casterClass, canEdit, canUse }: {
  characterId: string; spells: any[]; casterClass: string; canEdit: boolean; canUse?: boolean;
}) {
  // canEdit → add / remove spells (definition), gated by Edit mode.
  // canUse  → prepare/unprepare spells (gameplay), available in Play mode.
  const canPrepare = canUse ?? canEdit;
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);

  async function togglePrepared(spellId: number, prepared: boolean) {
    await fetch(`/api/characters/${characterId}/spells`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ spellId, prepared }),
    });
    router.refresh();
  }
  async function remove(spellId: number, name: string) {
    if (!confirm(`Remove spell "${name}"?`)) return;
    await fetch(`/api/characters/${characterId}/spells?spellId=${spellId}`, { method: "DELETE" });
    router.refresh();
  }

  const byLevel = new Map<number, any[]>();
  for (const s of spells) { if (!byLevel.has(s.level)) byLevel.set(s.level, []); byLevel.get(s.level)!.push(s); }
  const levels = [...byLevel.keys()].sort((a, b) => a - b);

  return (
    <div className="mt-3 border-t border-[#dfd5b8] pt-2">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-sm text-[#5e5448]">Known Spells ({spells.length})</span>
        {canEdit && <button className="btn-ghost !py-0.5 text-xs" onClick={() => setShowAdd(true)}>+ Add Spell</button>}
      </div>
      {levels.length === 0 && (
        <div className="panel-inset p-4 text-center">
          <p className="text-sm text-[#5e5448]">No spells known yet — magic awaits in the {casterClass || "class"} list.</p>
          {canEdit && (
            <button className="btn-ghost mt-2 text-sm" onClick={() => setShowAdd(true)}>Learn your first spell</button>
          )}
        </div>
      )}
      {levels.map((lvl) => (
        <div key={lvl} className="mb-1">
          <div className="text-[10px] uppercase text-[#5e5448]">{lvl === 0 ? "Cantrips" : `Level ${lvl}`}</div>
          {byLevel.get(lvl)!.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-1 text-sm">
              <span className="flex items-center gap-1">
                {lvl > 0 && canPrepare && (
                  <button title="prepared" onClick={() => togglePrepared(s.id, !s.prepared)}
                    className={`h-3 w-3 rounded-sm border ${s.prepared ? "bg-gold border-gold" : "border-[#cdbf9f]"}`} />
                )}
                {s.name}
                {s.concentration && <span className="text-[10px] text-arcane">C</span>}
                {s.ritual && <span className="text-[10px] text-[#5e5448]">R</span>}
              </span>
              {canEdit && <button className="text-xs text-[#5e5448] hover:text-red-700" title="Remove spell" onClick={() => remove(s.id, s.name)}>✕</button>}
            </div>
          ))}
        </div>
      ))}
      {showAdd && <AddSpellModal characterId={characterId} casterClass={casterClass} onClose={() => { setShowAdd(false); router.refresh(); }} />}
    </div>
  );
}

function AddSpellModal({ characterId, casterClass, onClose }: { characterId: string; casterClass: string; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [level, setLevel] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [filterClass, setFilterClass] = useState(true);

  async function search() {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (level !== "") params.set("level", level);
    if (filterClass && casterClass) params.set("class", casterClass);
    const r = await fetch(`/api/srd/spells?${params.toString()}`);
    setRows(await r.json());
  }
  useEffect(() => { search(); /* eslint-disable-next-line */ }, [level, filterClass]);

  async function add(spellId: number) {
    await fetch(`/api/characters/${characterId}/spells`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ spellId, source: casterClass }),
    });
    setRows((r) => r.filter((x) => x.id !== spellId));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="card w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-lg text-gold">Add Spell {casterClass && `(${casterClass})`}</h3>
          <button className="btn-ghost !py-0.5" onClick={onClose}>Close</button>
        </div>
        <div className="mb-2 flex flex-wrap gap-1">
          <input className="input flex-1" placeholder="Search..." value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} />
          <select className="input !w-auto" value={level} onChange={(e) => setLevel(e.target.value)}>
            <option value="">All Levels</option>
            {[0,1,2,3,4,5,6,7,8,9].map((l) => <option key={l} value={l}>{l === 0 ? "Cantrip" : `L${l}`}</option>)}
          </select>
          <button className="btn-ghost" onClick={search}>Search</button>
          <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={filterClass} onChange={(e) => setFilterClass(e.target.checked)} />{casterClass} only</label>
        </div>
        <div className="max-h-72 space-y-1 overflow-y-auto text-sm">
          {rows.map((s) => (
            <div key={s.id} className="flex items-center justify-between border-b border-[#dfd5b8] py-1">
              <span>{s.name} <span className="text-xs text-[#5e5448]">{s.level === 0 ? "Cantrip" : `L${s.level}`} · {s.school}</span></span>
              <button className="btn-ghost !py-0.5" onClick={() => add(s.id)}>+ Add</button>
            </div>
          ))}
          {rows.length === 0 && <p className="text-[#5e5448]">No results.</p>}
        </div>
      </div>
    </div>
  );
}
