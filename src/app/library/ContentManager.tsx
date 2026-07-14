"use client";
// Campaign Content manager (Agent E). Three tabs — Spells, Equipment, Magic
// Items — each merging SRD reference rows (via /api/srd/*) with homebrew (via
// /api/homebrew-spells and /api/homebrew-items). Supports search, a detail
// view, and a homebrew authoring form (create / edit / delete). Homebrew can be
// scoped to the DM's personal library or to a specific campaign they run.
import { useCallback, useEffect, useMemo, useState } from "react";

type Tab = "spells" | "equipment" | "magic";
interface Campaign { id: string; name: string }

interface HomebrewRow { id: string; ownerId: string; campaignId: string | null; name: string; dataJson: string }

// Normalized list row for the current tab.
interface Row {
  key: string;
  name: string;
  sub: string; // level / category / rarity
  cost: string | null; // gp cost display
  source: "srd" | "homebrew";
  srdId?: number;
  homebrew?: HomebrewRow;
}

const SCHOOLS = ["Abjuration", "Conjuration", "Divination", "Enchantment", "Evocation", "Illusion", "Necromancy", "Transmutation"];
const RARITIES = ["Common", "Uncommon", "Rare", "Very Rare", "Legendary", "Artifact"];

interface Draft {
  id?: string; // homebrew id (edit)
  tab: Tab;
  name: string;
  description: string;
  // spell
  level: number;
  school: string;
  classes: string;
  castingTime: string;
  range: string;
  components: string;
  duration: string;
  higherLevel: string;
  // item / magic
  category: string;
  costGp: string;
  costUnit: string;
  weight: string;
  damageDice: string;
  damageType: string;
  armorCategory: string;
  acBonus: string;
  rarity: string;
  requiresAttunement: boolean;
  properties: string;
}

function emptyDraft(tab: Tab): Draft {
  return {
    tab, name: "", description: "",
    level: 0, school: "", classes: "", castingTime: "1 action", range: "", components: "", duration: "", higherLevel: "",
    category: "", costGp: "", costUnit: "gp", weight: "", damageDice: "", damageType: "", armorCategory: "", acBonus: "",
    rarity: "Common", requiresAttunement: false, properties: "",
  };
}

function num(v: string): number | undefined {
  const n = Number(v);
  return v.trim() === "" || Number.isNaN(n) ? undefined : n;
}

/** Build a draft from an existing homebrew row for editing. */
function draftFromHomebrew(tab: Tab, row: HomebrewRow): Draft {
  const d = emptyDraft(tab);
  d.id = row.id;
  d.name = row.name;
  let data: Record<string, unknown> = {};
  try { data = JSON.parse(row.dataJson) as Record<string, unknown>; } catch { /* ignore */ }
  d.description = String(data.description ?? data.descMd ?? "");
  d.level = Number(data.level ?? 0);
  d.school = String(data.school ?? "");
  d.classes = Array.isArray(data.classes) ? (data.classes as string[]).join(", ") : String(data.classes ?? "");
  d.castingTime = String(data.castingTime ?? "");
  d.range = String(data.range ?? "");
  d.components = String(data.components ?? "");
  d.duration = String(data.duration ?? "");
  d.higherLevel = String(data.higherLevel ?? "");
  d.category = String(data.category ?? "");
  d.costGp = data.costGp != null ? String(data.costGp) : "";
  d.costUnit = String(data.costUnit ?? "gp");
  d.weight = data.weight != null ? String(data.weight) : "";
  d.damageDice = String(data.damageDice ?? "");
  d.damageType = String(data.damageType ?? "");
  d.armorCategory = String(data.armorCategory ?? "");
  d.acBonus = data.acBonus != null ? String(data.acBonus) : "";
  d.rarity = String(data.rarity ?? "Common");
  d.requiresAttunement = Boolean(data.requiresAttunement);
  d.properties = Array.isArray(data.properties) ? (data.properties as string[]).join(", ") : String(data.properties ?? "");
  return d;
}

/** Serialize a draft's type-specific fields into a dataJson payload. */
function draftToDataJson(d: Draft): string {
  if (d.tab === "spells") {
    return JSON.stringify({
      level: d.level,
      school: d.school || null,
      classes: d.classes || null,
      castingTime: d.castingTime || null,
      range: d.range || null,
      components: d.components || null,
      duration: d.duration || null,
      description: d.description || null,
      higherLevel: d.higherLevel || null,
    });
  }
  const kind = d.tab === "magic" ? "magic" : "equipment";
  return JSON.stringify({
    kind,
    category: d.category || null,
    costGp: num(d.costGp) ?? null,
    costUnit: d.costUnit || null,
    weight: num(d.weight) ?? null,
    description: d.description || null,
    damageDice: d.damageDice || null,
    damageType: d.damageType || null,
    armorCategory: d.armorCategory || null,
    acBonus: num(d.acBonus) ?? null,
    rarity: kind === "magic" ? d.rarity || null : null,
    requiresAttunement: kind === "magic" ? d.requiresAttunement : null,
    properties: d.properties || null,
  });
}

export function ContentManager({ campaigns }: { campaigns: Campaign[] }) {
  const [tab, setTab] = useState<Tab>("spells");
  const [scope, setScope] = useState<string>(""); // "" = personal, else campaignId
  const [q, setQ] = useState("");

  const [srd, setSrd] = useState<any[]>([]);
  const [srdLoading, setSrdLoading] = useState(true);
  const [hbSpells, setHbSpells] = useState<HomebrewRow[]>([]);
  const [hbItems, setHbItems] = useState<HomebrewRow[]>([]);

  const [detail, setDetail] = useState<{ title: string; body: React.ReactNode } | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // ---- Homebrew load (both spells & items) for the current scope ----
  const loadHomebrew = useCallback(async () => {
    const qs = scope ? `campaignId=${encodeURIComponent(scope)}` : "mine=1";
    const [s, i] = await Promise.all([
      fetch(`/api/homebrew-spells?${qs}`).then((r) => (r.ok ? r.json() : [])),
      fetch(`/api/homebrew-items?${qs}`).then((r) => (r.ok ? r.json() : [])),
    ]);
    setHbSpells(Array.isArray(s) ? s : []);
    setHbItems(Array.isArray(i) ? i : []);
  }, [scope]);
  useEffect(() => { loadHomebrew(); }, [loadHomebrew]);

  // ---- SRD load (debounced by q + tab) ----
  useEffect(() => {
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setSrdLoading(true);
      try {
        const url = tab === "spells"
          ? `/api/srd/spells?q=${encodeURIComponent(q)}`
          : `/api/srd/items?type=${tab === "magic" ? "magic" : "equipment"}&q=${encodeURIComponent(q)}`;
        const r = await fetch(url, { signal: ctrl.signal });
        setSrd(r.ok ? await r.json() : []);
      } catch { /* aborted */ }
      setSrdLoading(false);
    }, 250);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q, tab]);

  const homebrewForTab: HomebrewRow[] = useMemo(() => {
    if (tab === "spells") return hbSpells;
    return hbItems.filter((row) => {
      let kind = "equipment";
      try { kind = (JSON.parse(row.dataJson).kind as string) ?? "equipment"; } catch { /* ignore */ }
      return tab === "magic" ? kind === "magic" : kind === "equipment";
    });
  }, [tab, hbSpells, hbItems]);

  // ---- Build normalized rows ----
  const rows: Row[] = useMemo(() => {
    const ql = q.trim().toLowerCase();
    const srdRows: Row[] = srd.map((s: any) => {
      if (tab === "spells") {
        return { key: `s${s.id}`, name: s.name, sub: s.level === 0 ? "Cantrip" : `Level ${s.level}`, cost: null, source: "srd", srdId: s.id };
      }
      if (tab === "equipment") {
        return { key: `s${s.id}`, name: s.name, sub: s.category ?? "Gear", cost: s.costGp != null ? `${s.costGp} ${s.costUnit ?? "gp"}` : null, source: "srd", srdId: s.id };
      }
      return { key: `s${s.id}`, name: s.name, sub: s.rarity ?? "—", cost: null, source: "srd", srdId: s.id };
    });
    const hbRows: Row[] = homebrewForTab
      .filter((row) => !ql || row.name.toLowerCase().includes(ql))
      .map((row) => {
        let data: any = {};
        try { data = JSON.parse(row.dataJson); } catch { /* ignore */ }
        const sub = tab === "spells"
          ? (data.level === 0 ? "Cantrip" : `Level ${data.level ?? "?"}`)
          : tab === "magic" ? (data.rarity ?? "—") : (data.category ?? "Gear");
        const cost = tab === "equipment" && data.costGp != null ? `${data.costGp} ${data.costUnit ?? "gp"}` : null;
        return { key: `h${row.id}`, name: row.name, sub, cost, source: "homebrew" as const, homebrew: row };
      });
    return [...hbRows, ...srdRows];
  }, [srd, homebrewForTab, tab, q]);

  // ---- Detail view ----
  async function openDetail(row: Row) {
    if (row.source === "homebrew" && row.homebrew) {
      let data: any = {};
      try { data = JSON.parse(row.homebrew.dataJson); } catch { /* ignore */ }
      setDetail({ title: row.name, body: renderDetail(tab, row.name, data, true) });
      return;
    }
    setDetail({ title: row.name, body: <p className="muted">Loading…</p> });
    const type = tab === "spells" ? "spells" : tab === "magic" ? "magic" : "equipment";
    const r = await fetch(`/api/srd/detail?type=${type}&id=${row.srdId}`);
    const data = r.ok ? await r.json() : {};
    setDetail({ title: row.name, body: renderDetail(tab, row.name, data, false) });
  }

  // ---- Save homebrew ----
  async function save() {
    if (!draft) return;
    if (!draft.name.trim()) { setErr("Name is required."); return; }
    setSaving(true); setErr(null);
    const endpoint = draft.tab === "spells" ? "/api/homebrew-spells" : "/api/homebrew-items";
    const dataJson = draftToDataJson(draft);
    const method = draft.id ? "PATCH" : "POST";
    const payload = draft.id
      ? { id: draft.id, name: draft.name.trim(), dataJson }
      : { name: draft.name.trim(), campaignId: scope || null, dataJson };
    const r = await fetch(endpoint, {
      method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    });
    setSaving(false);
    if (!r.ok) { setErr((await r.json().catch(() => null))?.error ?? "Failed to save."); return; }
    setDraft(null);
    loadHomebrew();
  }

  async function del(row: HomebrewRow) {
    if (!confirm(`Delete homebrew "${row.name}"?`)) return;
    const endpoint = tab === "spells" ? "/api/homebrew-spells" : "/api/homebrew-items";
    const r = await fetch(`${endpoint}?id=${encodeURIComponent(row.id)}`, { method: "DELETE" });
    if (r.ok) loadHomebrew();
    else alert((await r.json().catch(() => null))?.error ?? "Failed to delete.");
  }

  const tabLabel: Record<Tab, string> = { spells: "Spells", equipment: "Equipment", magic: "Magic Items" };

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {(["spells", "equipment", "magic"] as Tab[]).map((t) => (
          <button key={t} className="tab" data-active={tab === t} onClick={() => { setTab(t); setDetail(null); }}>{tabLabel[t]}</button>
        ))}
        <div className="flex-1" />
        <button className="btn-gold" onClick={() => { setErr(null); setDraft(emptyDraft(tab)); }}>＋ Create Homebrew</button>
      </div>

      {/* Scope + search */}
      <div className="card grid gap-2 p-3 sm:grid-cols-[1fr_auto]">
        <input className="input" placeholder={`Search ${tabLabel[tab].toLowerCase()}…`} value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" />
        <select className="input" value={scope} onChange={(e) => setScope(e.target.value)} aria-label="Homebrew scope">
          <option value="">Personal homebrew</option>
          {campaigns.map((c) => <option key={c.id} value={c.id}>Campaign: {c.name}</option>)}
        </select>
      </div>
      {campaigns.length === 0 && (
        <p className="muted text-xs">You do not run any campaigns yet — homebrew you create here is saved to your personal library.</p>
      )}

      {/* List */}
      {srdLoading && rows.length === 0 ? (
        <p className="muted text-sm">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="card"><p className="muted text-sm">No {tabLabel[tab].toLowerCase()} match your search.</p></div>
      ) : (
        <div className="card divide-y divide-[#e2d6b8] p-0">
          {rows.map((row) => (
            <div key={row.key} className="grid grid-cols-[1fr_auto] items-center gap-2 px-4 py-2 hover:bg-[#f4ead2] sm:grid-cols-[minmax(0,1.5fr)_auto_auto_auto]">
              <button className="min-w-0 truncate text-left font-semibold hover:underline" onClick={() => openDetail(row)}>{row.name}</button>
              <span className="chip justify-self-start">{row.sub}</span>
              <span className="hidden text-sm sm:block">
                {row.source === "homebrew" ? <span className="chip chip-gold">Homebrew</span> : <span className="muted text-xs">SRD</span>}
                {row.cost ? <span className="ml-2 text-xs">{row.cost}</span> : null}
              </span>
              <span className="flex justify-end gap-1">
                {row.source === "homebrew" && row.homebrew && (
                  <>
                    <button className="btn-ghost px-2 py-1 text-xs" onClick={() => { setErr(null); setDraft(draftFromHomebrew(tab, row.homebrew!)); }}>Edit</button>
                    <button className="btn-ghost px-2 py-1 text-xs text-blood" onClick={() => del(row.homebrew!)}>Delete</button>
                  </>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
      {tab !== "spells" && !srdLoading && srd.length >= 40 && (
        <p className="muted text-xs">Showing the first 40 SRD matches — refine your search to narrow down.</p>
      )}

      {/* Detail modal */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4" onClick={() => setDetail(null)}>
          <div className="card my-6 w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-display text-xl text-gold">{detail.title}</h2>
              <button className="btn-ghost" onClick={() => setDetail(null)}>Close</button>
            </div>
            {detail.body}
          </div>
        </div>
      )}

      {/* Homebrew editor modal */}
      {draft && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4" onClick={() => setDraft(null)}>
          <div className="card my-6 w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[.16em] text-heading">
                  {scope ? `Campaign homebrew` : "Personal homebrew"} · {tabLabel[draft.tab]}
                </div>
                <h2 className="font-display text-xl text-gold">{draft.id ? "Edit Homebrew" : "New Homebrew"}</h2>
              </div>
              <button className="btn-ghost" onClick={() => setDraft(null)}>Close</button>
            </div>

            <div className="space-y-3 text-sm">
              <label className="block">
                <span className="label">Name</span>
                <input className="input w-full" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </label>

              {draft.tab === "spells" ? (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block">
                      <span className="label">Level</span>
                      <select className="input w-full" value={draft.level} onChange={(e) => setDraft({ ...draft, level: Number(e.target.value) })}>
                        {Array.from({ length: 10 }, (_, i) => <option key={i} value={i}>{i === 0 ? "Cantrip" : `Level ${i}`}</option>)}
                      </select>
                    </label>
                    <label className="block">
                      <span className="label">School</span>
                      <select className="input w-full" value={draft.school} onChange={(e) => setDraft({ ...draft, school: e.target.value })}>
                        <option value="">—</option>
                        {SCHOOLS.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </label>
                  </div>
                  <label className="block">
                    <span className="label">Classes (comma-separated)</span>
                    <input className="input w-full" placeholder="Wizard, Sorcerer" value={draft.classes} onChange={(e) => setDraft({ ...draft, classes: e.target.value })} />
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block"><span className="label">Casting time</span><input className="input w-full" value={draft.castingTime} onChange={(e) => setDraft({ ...draft, castingTime: e.target.value })} /></label>
                    <label className="block"><span className="label">Range</span><input className="input w-full" placeholder="60 feet" value={draft.range} onChange={(e) => setDraft({ ...draft, range: e.target.value })} /></label>
                    <label className="block"><span className="label">Components</span><input className="input w-full" placeholder="V, S, M" value={draft.components} onChange={(e) => setDraft({ ...draft, components: e.target.value })} /></label>
                    <label className="block"><span className="label">Duration</span><input className="input w-full" placeholder="Instantaneous" value={draft.duration} onChange={(e) => setDraft({ ...draft, duration: e.target.value })} /></label>
                  </div>
                  <label className="block"><span className="label">At higher levels</span><textarea className="input w-full" rows={2} value={draft.higherLevel} onChange={(e) => setDraft({ ...draft, higherLevel: e.target.value })} /></label>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block">
                      <span className="label">{draft.tab === "magic" ? "Category / type" : "Category"}</span>
                      <input className="input w-full" placeholder={draft.tab === "magic" ? "Wondrous item" : "Weapon"} value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} />
                    </label>
                    {draft.tab === "magic" ? (
                      <label className="block">
                        <span className="label">Rarity</span>
                        <select className="input w-full" value={draft.rarity} onChange={(e) => setDraft({ ...draft, rarity: e.target.value })}>
                          {RARITIES.map((r) => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </label>
                    ) : (
                      <label className="block">
                        <span className="label">Cost (gp)</span>
                        <input className="input w-full" type="number" step="any" value={draft.costGp} onChange={(e) => setDraft({ ...draft, costGp: e.target.value })} />
                      </label>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block"><span className="label">Weight (lb)</span><input className="input w-full" type="number" step="any" value={draft.weight} onChange={(e) => setDraft({ ...draft, weight: e.target.value })} /></label>
                    {draft.tab === "magic" ? (
                      <label className="flex items-end gap-2 pb-2">
                        <input type="checkbox" checked={draft.requiresAttunement} onChange={(e) => setDraft({ ...draft, requiresAttunement: e.target.checked })} />
                        <span className="label mb-0">Requires attunement</span>
                      </label>
                    ) : (
                      <label className="block"><span className="label">Cost unit</span><input className="input w-full" value={draft.costUnit} onChange={(e) => setDraft({ ...draft, costUnit: e.target.value })} /></label>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block"><span className="label">Damage dice</span><input className="input w-full" placeholder="1d8" value={draft.damageDice} onChange={(e) => setDraft({ ...draft, damageDice: e.target.value })} /></label>
                    <label className="block"><span className="label">Damage type</span><input className="input w-full" placeholder="slashing" value={draft.damageType} onChange={(e) => setDraft({ ...draft, damageType: e.target.value })} /></label>
                    <label className="block"><span className="label">Armor category</span><input className="input w-full" placeholder="Medium" value={draft.armorCategory} onChange={(e) => setDraft({ ...draft, armorCategory: e.target.value })} /></label>
                    <label className="block"><span className="label">AC bonus / base</span><input className="input w-full" type="number" placeholder="2" value={draft.acBonus} onChange={(e) => setDraft({ ...draft, acBonus: e.target.value })} /></label>
                  </div>
                  <label className="block"><span className="label">Properties (comma-separated)</span><input className="input w-full" placeholder="Finesse, Light" value={draft.properties} onChange={(e) => setDraft({ ...draft, properties: e.target.value })} /></label>
                </>
              )}

              <label className="block"><span className="label">Description</span><textarea className="input w-full" rows={4} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></label>

              {err && <p className="text-sm text-blood">{err}</p>}
              <div className="flex gap-2">
                <button className="btn-gold" disabled={saving} onClick={save}>{saving ? "Saving…" : draft.id ? "Save changes" : "Create"}</button>
                <button className="btn-ghost" onClick={() => setDraft(null)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Render a read-only detail body for SRD or homebrew data. */
function renderDetail(tab: Tab, name: string, data: any, homebrew: boolean): React.ReactNode {
  const desc = data.description ?? data.descMd ?? "";
  if (tab === "spells") {
    const classes = Array.isArray(data.classes) ? data.classes.join(", ") : data.classes;
    return (
      <div className="space-y-2 text-sm">
        <div className="flex flex-wrap gap-1">
          <span className="chip">{data.level === 0 ? "Cantrip" : `Level ${data.level ?? "?"}`}</span>
          {data.school && <span className="chip">{data.school}</span>}
          {homebrew && <span className="chip chip-gold">Homebrew</span>}
        </div>
        <div className="grid grid-cols-2 gap-1 text-xs">
          {data.castingTime && <div><b>Casting time:</b> {data.castingTime}</div>}
          {data.range && <div><b>Range:</b> {data.range}</div>}
          {data.duration && <div><b>Duration:</b> {data.duration}</div>}
          {data.components && <div><b>Components:</b> {data.components}</div>}
          {classes && <div className="col-span-2"><b>Classes:</b> {classes}</div>}
        </div>
        {desc && <p className="whitespace-pre-wrap">{desc}</p>}
        {data.higherLevel && <p className="whitespace-pre-wrap"><b>At higher levels.</b> {data.higherLevel}</p>}
      </div>
    );
  }
  // equipment + magic
  return (
    <div className="space-y-2 text-sm">
      <div className="flex flex-wrap gap-1">
        {tab === "magic" ? (data.rarity && <span className="chip">{data.rarity}</span>) : (data.category && <span className="chip">{data.category}</span>)}
        {tab === "equipment" && data.costGp != null && <span className="chip chip-gold">{data.costGp} {data.costUnit ?? "gp"}</span>}
        {homebrew && <span className="chip chip-gold">Homebrew</span>}
      </div>
      <div className="grid grid-cols-2 gap-1 text-xs">
        {data.weight != null && <div><b>Weight:</b> {data.weight} lb</div>}
        {data.damageDice && <div><b>Damage:</b> {data.damageDice} {data.damageType ?? ""}</div>}
        {(data.acBase != null || data.acBonus != null) && <div><b>AC:</b> {data.acBase ?? data.acBonus}</div>}
        {data.armorCategory && <div><b>Armor:</b> {data.armorCategory}</div>}
        {data.requiresAttunement && <div><b>Attunement required</b></div>}
      </div>
      {desc && <p className="whitespace-pre-wrap">{desc}</p>}
    </div>
  );
}
