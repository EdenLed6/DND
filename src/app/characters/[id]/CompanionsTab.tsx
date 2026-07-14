"use client";
// Creatures tab — a character's companions: familiars, wild-shape forms,
// summons and mounts. Self-fetches its data; a chooser summons from the SRD
// monster library (or a blank custom creature), and selecting a creature opens
// its full CompanionSheet.
import { useCallback, useEffect, useState } from "react";
import { CreatureArt } from "@/components/CreatureArt";
import { MONSTER_TYPES } from "@/app/enemies/statblock";
import { CompanionSheet, type Companion } from "./CompanionSheet";

const KINDS = ["summon", "familiar", "wildshape", "mount", "other"] as const;
type Kind = (typeof KINDS)[number];
const KIND_LABEL: Record<Kind, string> = {
  summon: "Summon", familiar: "Familiar", wildshape: "Wild Shape", mount: "Mount", other: "Other",
};

function statType(statJson: string): string | null {
  try { return (JSON.parse(statJson) as { type?: string | null })?.type ?? null; } catch { return null; }
}

export function CompanionsTab({ characterId, canEdit }: { characterId: string; canEdit: boolean }) {
  const [companions, setCompanions] = useState<Companion[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch(`/api/characters/${characterId}/companions`);
      if (!r.ok) {
        setError((await r.json().catch(() => null))?.error ?? "Failed to load creatures");
        setLoaded(true);
        return;
      }
      const data = await r.json();
      setCompanions(data.companions ?? []);
      setError(null);
      setLoaded(true);
    } catch {
      setError("Failed to load creatures");
      setLoaded(true);
    }
  }, [characterId]);

  useEffect(() => { refresh(); }, [refresh]);

  async function remove(c: Companion) {
    if (!window.confirm(`Delete ${c.name}? This cannot be undone.`)) return;
    await fetch(`/api/characters/${characterId}/companions?companionId=${c.id}`, { method: "DELETE" });
    if (selectedId === c.id) setSelectedId(null);
    setCompanions((prev) => prev.filter((x) => x.id !== c.id));
  }

  const selected = companions.find((c) => c.id === selectedId) ?? null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="font-display text-gold">Creatures &amp; Companions</h3>
        <span className="text-[11px] text-[#857866]">Familiars, wild shapes, summons &amp; mounts</span>
        {canEdit && (
          <button className="btn-primary ml-auto !py-1 text-sm" onClick={() => setAdding(true)}>+ Summon / Add companion</button>
        )}
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}

      {loaded && !error && companions.length === 0 && (
        <div className="panel-inset p-4 text-center">
          <p className="text-sm text-[#5e5448]">No creatures yet — summon a familiar, conjure an ally, or wild-shape into a beast.</p>
          {canEdit && (
            <button className="btn-ghost mt-2 text-sm" onClick={() => setAdding(true)}>Add your first creature</button>
          )}
        </div>
      )}

      {/* Crest list */}
      <div className="grid gap-2 sm:grid-cols-2">
        {companions.map((c) => {
          const pct = c.maxHp > 0 ? Math.round((c.currentHp / c.maxHp) * 100) : 0;
          return (
            <button key={c.id} type="button"
              className={`panel-inset flex w-full items-center gap-3 p-2 text-left ${c.active ? "" : "opacity-60"} ${c.id === selectedId ? "border-[var(--gold)]" : ""}`}
              onClick={() => setSelectedId(c.id === selectedId ? null : c.id)}>
              <CreatureArt type={statType(c.statJson)} size={40} title={KIND_LABEL[c.kind as Kind] ?? c.kind} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1">
                  <span className="truncate font-bold text-sm">{c.name}</span>
                  <span className="chip text-[10px]">{KIND_LABEL[c.kind as Kind] ?? c.kind}</span>
                  {!c.active && <span className="chip opacity-70 text-[10px]">Dismissed</span>}
                </span>
                <span className="mt-0.5 block h-1.5 w-full overflow-hidden rounded-full" style={{ background: "var(--inset)" }}>
                  <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: pct > 25 ? "var(--sage)" : "var(--blood)" }} />
                </span>
                <span className="text-[11px] text-[#5e5448]">HP {c.currentHp}/{c.maxHp}</span>
              </span>
              {canEdit && (
                <span className="text-xs text-[#5e5448] hover:text-red-700" title="Remove"
                  role="button" tabIndex={-1}
                  onClick={(e) => { e.stopPropagation(); remove(c); }}>✕</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected creature sheet */}
      {selected && (
        <CompanionSheet
          companion={selected}
          characterId={characterId}
          canEdit={canEdit}
          onChange={(updated) => setCompanions((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))}
          onClose={() => setSelectedId(null)}
        />
      )}

      {adding && canEdit && (
        <AddCompanionModal
          characterId={characterId}
          onCreated={(created) => {
            setAdding(false);
            if (created) { setCompanions((prev) => [...prev, created]); setSelectedId(created.id); }
          }}
          onClose={() => setAdding(false)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add companion modal — SRD monster picker or blank custom
// ---------------------------------------------------------------------------
interface MonsterHit {
  id: number; name: string; cr: string | null; type: string | null;
  size: string | null; ac: number | null; hp: number | null;
}

function AddCompanionModal({ characterId, onCreated, onClose }: {
  characterId: string; onCreated: (created?: Companion) => void; onClose: () => void;
}) {
  const [mode, setMode] = useState<"srd" | "custom">("srd");
  const [kind, setKind] = useState<Kind>("summon");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // SRD picker state
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [results, setResults] = useState<MonsterHit[]>([]);
  const [searching, setSearching] = useState(false);

  // Custom state
  const [name, setName] = useState("");
  const [maxHp, setMaxHp] = useState(10);
  const [ac, setAc] = useState(12);
  const [speed, setSpeed] = useState("30 ft.");

  useEffect(() => {
    if (mode !== "srd") return;
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/srd/monsters?q=${encodeURIComponent(q.trim())}`);
        const data = r.ok ? await r.json() : [];
        if (!cancelled) {
          const list: MonsterHit[] = Array.isArray(data) ? data : [];
          setResults(typeFilter === "all" ? list : list.filter((m) => (m.type ?? "").toLowerCase() === typeFilter));
        }
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [q, typeFilter, mode]);

  async function create(body: Record<string, unknown>) {
    setSaving(true);
    setError(null);
    const r = await fetch(`/api/characters/${characterId}/companions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    setSaving(false);
    if (!r || !r.ok) {
      setError((await r?.json().catch(() => null))?.error ?? "Failed to add creature");
      return;
    }
    const data = await r.json().catch(() => null);
    onCreated(data?.companion ?? undefined);
  }

  function createCustom() {
    if (!name.trim()) { setError("Give your creature a name."); return; }
    create({
      kind,
      name: name.trim(),
      maxHp: Math.max(1, maxHp),
      block: { ac, speed, str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    });
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="card modal" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-lg text-gold">Summon / Add companion</h3>
          <button className="btn-ghost !py-0.5" onClick={onClose}>Close</button>
        </div>

        <div className="mb-2 flex flex-wrap items-center gap-2">
          <div className="tabbar" role="group" aria-label="Companion source">
            <button type="button" className="tab" data-active={mode === "srd"} onClick={() => setMode("srd")}>SRD Monster</button>
            <button type="button" className="tab" data-active={mode === "custom"} onClick={() => setMode("custom")}>Custom</button>
          </div>
          <label className="ml-auto flex items-center gap-1 text-sm">
            <span className="label !mb-0">Kind</span>
            <select className="input !w-auto !py-1" value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
              {KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
            </select>
          </label>
        </div>

        {mode === "srd" ? (
          <div className="space-y-2">
            <div className="flex gap-2">
              <input className="input flex-1" placeholder="Search monsters (wolf, owl, imp...)"
                value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
              <select className="input !w-auto" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
                aria-label="Filter by creature type">
                <option value="all">All types</option>
                {MONSTER_TYPES.map((t) => <option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</option>)}
              </select>
            </div>
            <div className="max-h-72 space-y-1 overflow-y-auto">
              {searching && results.length === 0 && <p className="text-sm text-[#5e5448]">Searching...</p>}
              {!searching && results.length === 0 && (
                <p className="text-sm text-[#5e5448]">No monsters found{typeFilter !== "all" ? ` of type "${typeFilter}"` : ""}. Try another search.</p>
              )}
              {results.map((m) => (
                <div key={m.id} className="panel-inset flex items-center gap-2 p-2">
                  <CreatureArt type={m.type} size={32} title={m.type ?? "creature"} />
                  <span className="min-w-0 flex-1">
                    <b className="text-sm">{m.name}</b>
                    <span className="block text-[11px] text-[#857866]">
                      {[m.size, m.type].filter(Boolean).join(" ")} · CR {m.cr ?? "?"} · AC {m.ac ?? "—"} · {m.hp ?? "—"} HP
                    </span>
                  </span>
                  <button className="btn-gold !py-1 text-sm" disabled={saving}
                    onClick={() => create({ kind, srcMonsterId: m.id })}>Add</button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div>
              <label className="label" htmlFor="companion-name">Name</label>
              <input id="companion-name" className="input" maxLength={60} placeholder="Scout the mastiff"
                value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="label" htmlFor="companion-hp">Max HP</label>
                <input id="companion-hp" className="input" inputMode="numeric" value={maxHp}
                  onChange={(e) => setMaxHp(Math.max(1, parseInt(e.target.value, 10) || 1))} />
              </div>
              <div>
                <label className="label" htmlFor="companion-ac">AC</label>
                <input id="companion-ac" className="input" inputMode="numeric" value={ac}
                  onChange={(e) => setAc(Math.max(0, parseInt(e.target.value, 10) || 0))} />
              </div>
              <div>
                <label className="label" htmlFor="companion-speed">Speed</label>
                <input id="companion-speed" className="input" maxLength={60} value={speed}
                  onChange={(e) => setSpeed(e.target.value)} />
              </div>
            </div>
            <p className="text-xs text-[#5e5448]">Ability scores start at 10 — pick an SRD monster instead for a full stat block, or edit later from the sheet.</p>
            <div className="flex justify-end gap-2 pt-1">
              <button className="btn-ghost" onClick={onClose}>Cancel</button>
              <button className="btn-primary" disabled={saving} onClick={createCustom}>
                {saving ? "Adding..." : "Add creature"}
              </button>
            </div>
          </div>
        )}

        {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
      </div>
    </div>
  );
}
