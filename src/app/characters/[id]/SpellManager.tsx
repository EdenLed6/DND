"use client";
// Known-spell list + daily preparation flow.
// Prepared casters (Cleric/Druid/Paladin/Wizard) pick prepared spells from the
// full class list each day; known casters (Bard/Sorcerer/Warlock/Ranger) skip
// preparation entirely — their known spells are always castable.
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isPreparedCaster } from "@/lib/dnd/spell-casting";

interface SpellMeta {
  casterClass: string | null;
  preparedCaster: boolean;
  prepareLimit: number;
  preparedCount: number;
  maxSpellLevel: number;
  slots?: number[];                 // max slots per level (index 0 = L1) — for pips
  pact?: { slots: number; level: number } | null;
  known: any[];
  available: any[];
}

export function SpellManager({ characterId, spells, casterClass, canEdit, canUse }: {
  characterId: string; spells: any[]; casterClass: string; canEdit: boolean; canUse?: boolean;
}) {
  // canEdit → add / remove spells (definition), gated by Edit mode.
  // canUse  → prepare/unprepare spells (gameplay), available in Play mode.
  const canPrepare = canUse ?? canEdit;
  const prepares = isPreparedCaster(casterClass);
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);
  const [showPrepare, setShowPrepare] = useState(false);
  const [meta, setMeta] = useState<SpellMeta | null>(null);

  const loadMeta = useCallback(async () => {
    try {
      const r = await fetch(`/api/characters/${characterId}/spell-picker`);
      if (r.ok) setMeta(await r.json());
    } catch { /* viewers without edit rights get a 403; the SRD prop list still renders */ }
  }, [characterId]);
  useEffect(() => { loadMeta(); }, [loadMeta]);

  async function togglePrepared(spellId: number | string, prepared: boolean) {
    await fetch(`/api/characters/${characterId}/spells`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ spellId, prepared }),
    });
    loadMeta();
    router.refresh();
  }
  async function remove(spellId: number | string, name: string) {
    if (!confirm(`Remove spell "${name}"?`)) return;
    await fetch(`/api/characters/${characterId}/spells?spellId=${encodeURIComponent(String(spellId))}`, { method: "DELETE" });
    loadMeta();
    router.refresh();
  }

  // Merge SRD spells (server-resolved prop) with campaign homebrew known spells (from GET).
  const homebrewKnown = (meta?.known ?? []).filter((k) => k.homebrew);
  const allKnown = [...spells, ...homebrewKnown];

  const byLevel = new Map<number, any[]>();
  for (const s of allKnown) { if (!byLevel.has(s.level)) byLevel.set(s.level, []); byLevel.get(s.level)!.push(s); }
  const levels = [...byLevel.keys()].sort((a, b) => a - b);

  const preparedCount = allKnown.filter((s) => s.level > 0 && s.prepared && !s.alwaysPrepared).length;
  const limit = meta?.prepareLimit ?? 0;

  return (
    <div className="mt-3 border-t border-[#dfd5b8] pt-2">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-1">
        <span className="text-sm text-[#5e5448]">
          {prepares ? "Spells" : "Known Spells"} ({allKnown.length})
        </span>
        <span className="flex flex-wrap items-center gap-1">
          {prepares && limit > 0 && (
            <span className="chip" title="Prepared spells / daily limit (always-prepared spells don't count)">
              Prepared {preparedCount}/{limit}
            </span>
          )}
          {prepares && canPrepare && (
            <button className="btn-gold !py-0.5 text-xs" onClick={() => setShowPrepare(true)}>Prepare Spells</button>
          )}
          {canEdit && <button className="btn-ghost !py-0.5 text-xs" onClick={() => setShowAdd(true)}>+ Add Spell</button>}
        </span>
      </div>
      {levels.length === 0 && (
        <div className="panel-inset p-4 text-center">
          <p className="text-sm text-[#5e5448]">No spells known yet — magic awaits in the {casterClass || "class"} list.</p>
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            {prepares && canPrepare && (
              <button className="btn-gold text-sm" onClick={() => setShowPrepare(true)}>Prepare spells</button>
            )}
            {canEdit && (
              <button className="btn-ghost text-sm" onClick={() => setShowAdd(true)}>Learn your first spell</button>
            )}
          </div>
        </div>
      )}
      {levels.map((lvl) => {
        const slotCount = lvl > 0 ? (meta?.slots?.[lvl - 1] ?? 0) : 0;
        const pactPips = lvl > 0 && meta?.pact && meta.pact.level === lvl ? meta.pact.slots : 0;
        return (
        <div key={lvl} className="mb-1">
          <div className="flex items-center gap-1 text-[10px] uppercase text-[#5e5448]">
            <span>{lvl === 0 ? "Cantrips" : `Level ${lvl}`}</span>
            {slotCount > 0 && (
              <span className="flex items-center gap-0.5" title={`${slotCount} level ${lvl} slot${slotCount === 1 ? "" : "s"}`}>
                {Array.from({ length: slotCount }, (_, i) => (
                  <span key={i} className="h-1.5 w-1.5 rounded-full border border-gold bg-gold/60" />
                ))}
              </span>
            )}
            {pactPips > 0 && (
              <span className="flex items-center gap-0.5" title={`${pactPips} pact slot${pactPips === 1 ? "" : "s"} @ L${meta?.pact?.level}`}>
                {Array.from({ length: pactPips }, (_, i) => (
                  <span key={i} className="h-1.5 w-1.5 rounded-full border border-arcane bg-arcane/50" />
                ))}
              </span>
            )}
          </div>
          {byLevel.get(lvl)!.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-1 text-sm">
              <span className="flex items-center gap-1">
                {lvl > 0 && prepares && (
                  s.alwaysPrepared ? (
                    <span title="Always prepared (doesn't count against your limit)" className="h-3 w-3 rounded-sm border border-gold bg-gold/40" />
                  ) : canPrepare ? (
                    <button title={s.prepared ? "Unprepare" : "Prepare"} onClick={() => togglePrepared(s.id, !s.prepared)}
                      className={`h-3 w-3 rounded-sm border ${s.prepared ? "bg-gold border-gold" : "border-[#cdbf9f]"}`} />
                  ) : (
                    <span className={`h-3 w-3 rounded-sm border ${s.prepared ? "bg-gold border-gold" : "border-[#cdbf9f]"}`} />
                  )
                )}
                {s.name}
                {s.concentration && <span className="text-[10px] text-arcane">C</span>}
                {s.ritual && <span className="text-[10px] text-[#5e5448]">(R)</span>}
                {s.homebrew && <span className="text-[10px] text-arcane" title="Campaign homebrew spell">HB</span>}
              </span>
              {canEdit && <button className="text-xs text-[#5e5448] hover:text-red-700" title="Remove spell" onClick={() => remove(s.id, s.name)}>✕</button>}
            </div>
          ))}
        </div>
        );
      })}
      {!prepares && allKnown.some((s) => s.level > 0) && (
        <p className="mt-1 text-[10px] text-[#857866]">{casterClass}s don&apos;t prepare spells — every known spell is ready to cast.</p>
      )}
      {showAdd && (
        <AddSpellModal
          characterId={characterId}
          casterClass={casterClass}
          homebrew={(meta?.available ?? []).filter((s) => s.homebrew)}
          onClose={() => { setShowAdd(false); loadMeta(); router.refresh(); }}
        />
      )}
      {showPrepare && meta && (
        <PrepareSpellsModal
          characterId={characterId}
          meta={meta}
          onClose={() => { setShowPrepare(false); loadMeta(); router.refresh(); }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Daily preparation picker: the full class list at castable levels.
// ---------------------------------------------------------------------------
function PrepareSpellsModal({ characterId, meta, onClose }: {
  characterId: string; meta: SpellMeta; onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [levelFilter, setLevelFilter] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  // Local prepared state keyed by String(spellId): {prepared, always, known(=row exists)}
  const [state, setState] = useState<Record<string, { prepared: boolean; always: boolean; known: boolean }>>(() => {
    const init: Record<string, { prepared: boolean; always: boolean; known: boolean }> = {};
    for (const k of meta.known) {
      if (k.level > 0) init[String(k.id)] = { prepared: !!k.prepared, always: !!k.alwaysPrepared, known: true };
    }
    return init;
  });

  const preparedCount = Object.values(state).filter((v) => v.prepared && !v.always).length;
  const atLimit = preparedCount >= meta.prepareLimit;

  const list = meta.available
    .filter((s) => s.level > 0)
    .filter((s) => (levelFilter === "" ? true : s.level === Number(levelFilter)))
    .filter((s) => (q ? String(s.name).toLowerCase().includes(q.toLowerCase()) : true));

  const byLevel = new Map<number, any[]>();
  for (const s of list) { if (!byLevel.has(s.level)) byLevel.set(s.level, []); byLevel.get(s.level)!.push(s); }
  const levels = [...byLevel.keys()].sort((a, b) => a - b);

  async function toggle(spell: any) {
    const key = String(spell.id);
    const cur = state[key];
    if (cur?.always) return; // always-prepared spells are locked in
    const next = !(cur?.prepared);
    if (next && atLimit) return;
    setBusy(key);
    try {
      if (cur?.known) {
        await fetch(`/api/characters/${characterId}/spells`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ spellId: spell.id, prepared: next }),
        });
      } else {
        await fetch(`/api/characters/${characterId}/spells`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ spellId: spell.id, prepared: true, source: meta.casterClass ?? undefined }),
        });
      }
      setState((s) => ({ ...s, [key]: { prepared: next, always: false, known: true } }));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="card flex max-h-[85vh] w-full max-w-lg flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="font-display text-lg text-gold">Prepare Spells{meta.casterClass && ` (${meta.casterClass})`}</h3>
          <button className="btn-ghost !py-0.5" onClick={onClose}>Done</button>
        </div>
        <div className="mb-2 flex flex-wrap items-center gap-1">
          <span className={`chip ${atLimit ? "chip-gold" : ""}`} title="Always-prepared spells don't count against the limit">
            {preparedCount}/{meta.prepareLimit} prepared
          </span>
          <input className="input min-w-0 flex-1" placeholder="Search the class list..." value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="input !w-auto" value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)}>
            <option value="">All Levels</option>
            {Array.from({ length: meta.maxSpellLevel }, (_, i) => i + 1).map((l) => (
              <option key={l} value={l}>L{l}</option>
            ))}
          </select>
        </div>
        <p className="mb-1 text-[11px] text-[#857866]">
          After a long rest you may swap your prepared spells. You can prepare any {meta.casterClass} spell of a level you have slots for.
        </p>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto text-sm">
          {levels.map((lvl) => (
            <div key={lvl}>
              <div className="text-[10px] uppercase text-[#5e5448]">Level {lvl}</div>
              {byLevel.get(lvl)!.map((s) => {
                const key = String(s.id);
                const st = state[key];
                const checked = !!(st?.prepared || st?.always);
                const disabled = !!st?.always || busy === key || (!checked && atLimit);
                return (
                  <div key={key} className="flex items-center justify-between gap-2 border-b border-[#dfd5b8] py-1">
                    <span className="min-w-0">
                      <span className={checked ? "font-semibold" : ""}>{s.name}</span>
                      {s.ritual && <span className="ml-1 text-[10px] text-[#5e5448]">(R)</span>}
                      {s.concentration && <span className="ml-1 text-[10px] text-arcane">C</span>}
                      {s.homebrew && <span className="ml-1 text-[10px] text-arcane" title="Campaign homebrew spell">HB</span>}
                      <span className="ml-1 text-xs text-[#5e5448]">{[s.school, s.castingTime].filter(Boolean).join(" · ")}</span>
                    </span>
                    {st?.always ? (
                      <span className="chip chip-gold shrink-0" title="Always prepared (domain, oath, etc.)">Always</span>
                    ) : (
                      <button
                        type="button"
                        className={`shrink-0 ${checked ? "btn-gold" : "btn-ghost"} !py-0.5 text-xs`}
                        disabled={disabled}
                        title={!checked && atLimit ? "Prepare limit reached — unprepare something first" : checked ? "Unprepare" : "Prepare"}
                        onClick={() => toggle(s)}
                      >
                        {checked ? "Prepared" : "Prepare"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
          {list.length === 0 && (
            <div className="panel-inset p-4 text-center text-[#5e5448]">
              {meta.available.filter((s) => s.level > 0).length === 0
                ? "No leveled spells available yet — gain a spell slot first."
                : "No spells match your search."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add-spell picker (SRD search + campaign homebrew).
// ---------------------------------------------------------------------------
function AddSpellModal({ characterId, casterClass, homebrew, onClose }: {
  characterId: string; casterClass: string; homebrew: any[]; onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [level, setLevel] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [filterClass, setFilterClass] = useState(true);
  const [added, setAdded] = useState<Set<string>>(new Set());

  async function search() {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (level !== "") params.set("level", level);
    if (filterClass && casterClass) params.set("class", casterClass);
    const r = await fetch(`/api/srd/spells?${params.toString()}`);
    setRows(await r.json());
  }
  useEffect(() => { search(); /* eslint-disable-next-line */ }, [level, filterClass]);

  async function add(spellId: number | string) {
    await fetch(`/api/characters/${characterId}/spells`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ spellId, source: casterClass }),
    });
    setAdded((prev) => new Set(prev).add(String(spellId)));
    setRows((r) => r.filter((x) => x.id !== spellId));
  }

  const hbMatches = homebrew.filter((s) =>
    !added.has(String(s.id)) &&
    (level === "" || s.level === Number(level)) &&
    (!q || String(s.name).toLowerCase().includes(q.toLowerCase())),
  );

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
          {hbMatches.map((s) => (
            <div key={s.id} className="flex items-center justify-between border-b border-[#dfd5b8] py-1">
              <span>
                {s.name} <span className="text-xs text-arcane" title="Campaign homebrew spell">HB</span>{" "}
                <span className="text-xs text-[#5e5448]">{s.level === 0 ? "Cantrip" : `L${s.level}`}{s.school ? ` · ${s.school}` : ""}</span>
              </span>
              <button className="btn-ghost !py-0.5" onClick={() => add(s.id)}>+ Add</button>
            </div>
          ))}
          {rows.map((s) => (
            <div key={s.id} className="flex items-center justify-between border-b border-[#dfd5b8] py-1">
              <span>{s.name} <span className="text-xs text-[#5e5448]">{s.level === 0 ? "Cantrip" : `L${s.level}`} · {s.school}</span></span>
              <button className="btn-ghost !py-0.5" onClick={() => add(s.id)}>+ Add</button>
            </div>
          ))}
          {rows.length === 0 && hbMatches.length === 0 && <p className="text-[#5e5448]">No results.</p>}
        </div>
      </div>
    </div>
  );
}
