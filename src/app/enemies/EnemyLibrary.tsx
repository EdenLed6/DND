"use client";
// Enemy Library (SPEC-DM §9): SRD + homebrew tabs, CR/type/size filters,
// bestiary detail spreads, and the homebrew monster builder.
import { useCallback, useEffect, useMemo, useState } from "react";
import { BestiarySpread } from "./BestiaryDetail";
import { MonsterBuilder, draftFromStatBlock, emptyDraft, type BuilderDraft } from "./MonsterBuilder";
import { CR_VALUES, MONSTER_SIZES, MONSTER_TYPES, type StatBlock } from "./statblock";
import { CreatureArt } from "@/components/CreatureArt";

interface SrdRow { id: number; name: string; cr: string | null; type: string | null; size: string | null; ac: number | null; hp: number | null; xp: number | null; }
interface HomebrewRow { id: string; ownerId: string; campaignId: string | null; name: string; statBlockJson: string; }

function parseHomebrew(row: HomebrewRow): StatBlock | null {
  try { return JSON.parse(row.statBlockJson) as StatBlock; } catch { return null; }
}

export function EnemyLibrary() {
  const [tab, setTab] = useState<"srd" | "homebrew">("srd");
  const [q, setQ] = useState("");
  const [cr, setCr] = useState("");
  const [type, setType] = useState("");
  const [size, setSize] = useState("");

  const [srdRows, setSrdRows] = useState<SrdRow[]>([]);
  const [srdLoading, setSrdLoading] = useState(true);
  const [homebrew, setHomebrew] = useState<HomebrewRow[]>([]);
  const [homebrewLoading, setHomebrewLoading] = useState(true);

  // Detail modal: a stat block + where it came from (for the action buttons).
  const [detail, setDetail] = useState<{ mon: StatBlock; source: "srd" | "homebrew"; homebrewId?: string; loading?: boolean } | null>(null);
  const [builder, setBuilder] = useState<BuilderDraft | null>(null);

  // ---- SRD list: server-side q + cr, client-side type/size (API has no such params) ----
  useEffect(() => {
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setSrdLoading(true);
      try {
        const params = new URLSearchParams();
        if (q) params.set("q", q);
        if (cr) params.set("cr", cr);
        const r = await fetch(`/api/srd/monsters?${params}`, { signal: ctrl.signal });
        setSrdRows(r.ok ? await r.json() : []);
      } catch { /* aborted */ }
      setSrdLoading(false);
    }, 250);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q, cr]);

  const loadHomebrew = useCallback(async () => {
    setHomebrewLoading(true);
    const r = await fetch("/api/homebrew-monsters?mine=1");
    setHomebrew(r.ok ? await r.json() : []);
    setHomebrewLoading(false);
  }, []);
  useEffect(() => { loadHomebrew(); }, [loadHomebrew]);

  const srdFiltered = useMemo(
    () => srdRows.filter((m) =>
      (!type || (m.type ?? "").toLowerCase() === type) &&
      (!size || (m.size ?? "") === size)),
    [srdRows, type, size],
  );

  const homebrewFiltered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return homebrew
      .map((row) => ({ row, sb: parseHomebrew(row) }))
      .filter(({ row, sb }) =>
        (!ql || row.name.toLowerCase().includes(ql)) &&
        (!cr || sb?.cr === cr) &&
        (!type || (sb?.type ?? "").toLowerCase() === type) &&
        (!size || (sb?.size ?? "") === size));
  }, [homebrew, q, cr, type, size]);

  // ---- Detail handling ----
  async function openSrdDetail(id: number) {
    setDetail({ mon: { name: "Loading..." } as StatBlock, source: "srd", loading: true });
    const r = await fetch(`/api/srd/detail?type=monsters&id=${id}`);
    if (!r.ok) { setDetail(null); return; }
    const d = await r.json();
    setDetail({ mon: d as StatBlock, source: "srd" });
  }

  function openHomebrewDetail(row: HomebrewRow) {
    const sb = parseHomebrew(row);
    if (sb) setDetail({ mon: sb, source: "homebrew", homebrewId: row.id });
  }

  async function deleteHomebrew(id: string, name: string) {
    if (!confirm(`Delete "${name}" from your homebrew library?`)) return;
    const r = await fetch(`/api/homebrew-monsters?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (r.ok) loadHomebrew();
    else alert((await r.json().catch(() => null))?.error ?? "Failed to delete.");
  }

  function editHomebrew(row: HomebrewRow) {
    const sb = parseHomebrew(row);
    if (sb) { setDetail(null); setBuilder(draftFromStatBlock(sb, { id: row.id })); }
  }

  function duplicateToHomebrew(mon: StatBlock) {
    setDetail(null);
    setBuilder(draftFromStatBlock(mon, { renameCopy: true }));
  }

  const rows = tab === "srd" ? srdFiltered : homebrewFiltered;
  const loading = tab === "srd" ? srdLoading : homebrewLoading;

  return (
    <div className="space-y-4">
      {/* Tabs + new monster */}
      <div className="flex flex-wrap items-center gap-2">
        <button className="tab" data-active={tab === "srd"} onClick={() => setTab("srd")}>SRD</button>
        <button className="tab" data-active={tab === "homebrew"} onClick={() => setTab("homebrew")}>
          My Homebrew{homebrew.length ? ` (${homebrew.length})` : ""}
        </button>
        <div className="flex-1" />
        <button className="btn-gold" onClick={() => setBuilder(emptyDraft())}>+ New Monster</button>
      </div>

      {/* Filters */}
      <div className="card grid gap-2 p-3 sm:grid-cols-[1fr_auto_auto_auto]">
        <input className="input" placeholder="Search by name..." value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search by name" />
        <select className="input" value={cr} onChange={(e) => setCr(e.target.value)} aria-label="Challenge rating">
          <option value="">Any CR</option>
          {CR_VALUES.map((c) => <option key={c} value={c}>CR {c}</option>)}
        </select>
        <select className="input" value={type} onChange={(e) => setType(e.target.value)} aria-label="Creature type">
          <option value="">Any type</option>
          {MONSTER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select className="input" value={size} onChange={(e) => setSize(e.target.value)} aria-label="Creature size">
          <option value="">Any size</option>
          {MONSTER_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Results */}
      {loading ? (
        <p className="muted text-sm">Loading monsters...</p>
      ) : rows.length === 0 ? (
        <div className="card">
          <p className="muted text-sm">
            {tab === "srd"
              ? "No SRD monsters match these filters."
              : "No homebrew monsters yet. Create one with + New Monster, or duplicate any SRD creature."}
          </p>
        </div>
      ) : (
        <div className="card divide-y divide-[#e2d6b8] p-0">
          {tab === "srd"
            ? srdFiltered.map((m) => (
                <button key={m.id} onClick={() => openSrdDetail(m.id)}
                  className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-2 px-4 py-2 text-left hover:bg-[#f4ead2] sm:grid-cols-[auto_minmax(0,1.4fr)_auto_minmax(0,1fr)_auto_auto]">
                  <CreatureArt type={m.type} size={34} cssClass="shrink-0" />
                  <span className="truncate font-semibold">{m.name}</span>
                  <span className="chip chip-gold justify-self-start">CR {m.cr ?? "?"}</span>
                  <span className="hidden truncate text-sm text-[#5e5448] sm:block">{[m.type, m.size].filter(Boolean).join(" · ")}</span>
                  <span className="hidden text-sm sm:block"><b>AC</b> {m.ac ?? "—"}</span>
                  <span className="hidden text-sm sm:block"><b>HP</b> {m.hp ?? "—"}</span>
                </button>
              ))
            : homebrewFiltered.map(({ row, sb }) => (
                <div key={row.id}
                  className="grid grid-cols-[1fr_auto] items-center gap-2 px-4 py-2 hover:bg-[#f4ead2] sm:grid-cols-[minmax(0,1.4fr)_auto_minmax(0,1fr)_auto_auto_auto]">
                  <button className="min-w-0 truncate text-left font-semibold hover:underline" onClick={() => openHomebrewDetail(row)}>{row.name}</button>
                  <span className="chip chip-gold justify-self-start">CR {sb?.cr ?? "?"}</span>
                  <span className="hidden truncate text-sm text-[#5e5448] sm:block">{[sb?.type, sb?.size].filter(Boolean).join(" · ")}</span>
                  <span className="hidden text-sm sm:block"><b>AC</b> {sb?.ac ?? "—"}</span>
                  <span className="hidden text-sm sm:block"><b>HP</b> {sb?.hp ?? "—"}</span>
                  <span className="flex gap-1">
                    <button className="btn-ghost px-2 py-1 text-xs" onClick={() => editHomebrew(row)}>Edit</button>
                    <button className="btn-ghost px-2 py-1 text-xs" onClick={() => sb && duplicateToHomebrew(sb)}>Duplicate</button>
                    <button className="btn-ghost px-2 py-1 text-xs text-blood" onClick={() => deleteHomebrew(row.id, row.name)}>Delete</button>
                  </span>
                </div>
              ))}
        </div>
      )}
      {tab === "srd" && !srdLoading && srdRows.length >= 40 && (
        <p className="muted text-xs">Showing the first 40 name matches — refine the search or CR filter to narrow down.</p>
      )}

      {/* ---- Bestiary detail modal ---- */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4" onClick={() => setDetail(null)}>
          <div className="card my-6 w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
            {detail.loading ? (
              <p className="muted">Loading...</p>
            ) : (
              <>
                <BestiarySpread mon={detail.mon} />
                <div className="mt-4 flex flex-wrap gap-2 border-t border-[#e2d6b8] pt-3">
                  <button className="btn-gold" onClick={() => duplicateToHomebrew(detail.mon)}>
                    {detail.source === "srd" ? "Duplicate to Homebrew" : "Duplicate"}
                  </button>
                  {detail.source === "homebrew" && detail.homebrewId && (
                    <button className="btn-primary" onClick={() => {
                      const row = homebrew.find((h) => h.id === detail.homebrewId);
                      if (row) editHomebrew(row);
                    }}>Edit</button>
                  )}
                  <div className="flex-1" />
                  <button className="btn-ghost" onClick={() => setDetail(null)}>Close</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ---- Builder modal ---- */}
      {builder && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4">
          <div className="card my-6 w-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[.16em] text-heading">Homebrew Builder</div>
                <h2 className="font-display text-xl text-gold">{builder.id ? "Edit Monster" : "New Monster"}</h2>
              </div>
              <button className="btn-ghost" onClick={() => setBuilder(null)}>Close</button>
            </div>
            <MonsterBuilder
              initial={builder}
              onClose={() => setBuilder(null)}
              onSaved={() => { setBuilder(null); setTab("homebrew"); loadHomebrew(); }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
