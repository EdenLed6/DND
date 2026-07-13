"use client";
// Homebrew Monster Builder (SPEC-DM §9.4): form on the left, live bestiary
// stat-block preview on the right. Saves statBlockJson in the SrdMonster row
// shape so the combat engine (parseActions in src/lib/dnd/combat.ts) can read
// homebrew actions exactly like SRD ones.
import { useMemo, useState } from "react";
import { StatBlockCard } from "./BestiaryDetail";
import {
  CR_VALUES, CR_XP, MONSTER_SIZES, MONSTER_TYPES,
  composeActionDescription, parseEntries, type StatBlock,
} from "./statblock";

interface NamedRow { name: string; text: string; }
interface ActionRow extends NamedRow { toHit: string; dice: string; dtype: string; }

export interface BuilderDraft {
  id?: string; // present when editing an existing homebrew monster
  name: string; size: string; type: string; alignment: string; cr: string;
  ac: string; acType: string; hp: string; hitDice: string; speed: string;
  str: string; dex: string; con: string; int: string; wis: string; cha: string;
  senses: string; languages: string;
  resistances: string; immunities: string; vulnerabilities: string; conditionImmunities: string;
  traits: NamedRow[]; actions: ActionRow[]; legendary: NamedRow[];
}

export function emptyDraft(): BuilderDraft {
  return {
    name: "", size: "Medium", type: "humanoid", alignment: "unaligned", cr: "1/4",
    ac: "12", acType: "", hp: "10", hitDice: "", speed: "30 ft.",
    str: "10", dex: "10", con: "10", int: "10", wis: "10", cha: "10",
    senses: "", languages: "",
    resistances: "", immunities: "", vulnerabilities: "", conditionImmunities: "",
    traits: [], actions: [], legendary: [],
  };
}

/** Pre-fill the builder from any stat block (SRD detail row or homebrew JSON). */
export function draftFromStatBlock(mon: StatBlock, opts: { id?: string; renameCopy?: boolean } = {}): BuilderDraft {
  const named = (s: string | null | undefined): NamedRow[] =>
    parseEntries(s).map((e) => ({ name: e.name, text: e.description }));
  return {
    id: opts.id,
    name: opts.renameCopy ? `${mon.name} (Copy)` : (mon.name ?? ""),
    size: mon.size ?? "Medium",
    type: (mon.type ?? "humanoid").toLowerCase(),
    alignment: mon.alignment ?? "unaligned",
    cr: mon.cr ?? "1/4",
    ac: String(mon.ac ?? 10), acType: mon.acType ?? "",
    hp: String(mon.hp ?? 10), hitDice: mon.hitDice ?? "",
    speed: mon.speed ?? "30 ft.",
    str: String(mon.str ?? 10), dex: String(mon.dex ?? 10), con: String(mon.con ?? 10),
    int: String(mon.int ?? 10), wis: String(mon.wis ?? 10), cha: String(mon.cha ?? 10),
    senses: mon.senses ?? "", languages: mon.languages ?? "",
    resistances: mon.resistances ?? "", immunities: mon.immunities ?? "",
    vulnerabilities: mon.vulnerabilities ?? "", conditionImmunities: mon.conditionImmunities ?? "",
    traits: named(mon.traits),
    // Existing descriptions already carry "+N to hit" text the combat engine
    // parses, so they load into the text field; attack fields are for NEW text.
    actions: parseEntries(mon.actions).map((e) => ({ name: e.name, text: e.description, toHit: "", dice: "", dtype: "" })),
    legendary: named(mon.legendaryActions),
  };
}

function clampInt(v: string, lo: number, hi: number, dflt: number): number {
  const n = parseInt(v, 10);
  if (Number.isNaN(n)) return dflt;
  return Math.min(hi, Math.max(lo, n));
}

/** Build the statBlockJson object from the current draft. */
export function draftToStatBlock(d: BuilderDraft): StatBlock {
  const entries = (rows: NamedRow[]) =>
    rows.map((r) => ({ name: r.name.trim(), description: r.text.trim() })).filter((r) => r.name || r.description);
  const traits = entries(d.traits);
  const legendary = entries(d.legendary);
  const actions = d.actions
    .map((a) => ({ name: a.name.trim(), description: composeActionDescription(a.text, a.toHit, a.dice, a.dtype) }))
    .filter((a) => a.name || a.description);
  return {
    name: d.name.trim() || "Unnamed",
    size: d.size, type: d.type, alignment: d.alignment.trim() || null,
    ac: clampInt(d.ac, 1, 30, 10),
    acType: d.acType.trim() || null,
    hp: clampInt(d.hp, 1, 1000, 1),
    hitDice: d.hitDice.trim() || null,
    speed: d.speed.trim() || null,
    str: clampInt(d.str, 1, 30, 10), dex: clampInt(d.dex, 1, 30, 10), con: clampInt(d.con, 1, 30, 10),
    int: clampInt(d.int, 1, 30, 10), wis: clampInt(d.wis, 1, 30, 10), cha: clampInt(d.cha, 1, 30, 10),
    cr: d.cr, xp: CR_XP[d.cr] ?? null,
    senses: d.senses.trim() || null, languages: d.languages.trim() || null,
    resistances: d.resistances.trim() || null, immunities: d.immunities.trim() || null,
    vulnerabilities: d.vulnerabilities.trim() || null, conditionImmunities: d.conditionImmunities.trim() || null,
    traits: traits.length ? JSON.stringify(traits) : null,
    actions: actions.length ? JSON.stringify(actions) : null,
    legendaryActions: legendary.length ? JSON.stringify(legendary) : null,
  };
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="mb-1 block text-[10px] font-bold uppercase tracking-[.1em] text-heading">{label}</span>
      {children}
    </label>
  );
}

export function MonsterBuilder({
  initial, onSaved, onClose,
}: {
  initial: BuilderDraft;
  onSaved: () => void;
  onClose: () => void;
}) {
  const [d, setD] = useState<BuilderDraft>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const preview = useMemo(() => draftToStatBlock(d), [d]);

  const set = (patch: Partial<BuilderDraft>) => setD((prev) => ({ ...prev, ...patch }));
  const setTrait = (i: number, patch: Partial<NamedRow>) =>
    set({ traits: d.traits.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
  const setAction = (i: number, patch: Partial<ActionRow>) =>
    set({ actions: d.actions.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
  const setLegendary = (i: number, patch: Partial<NamedRow>) =>
    set({ legendary: d.legendary.map((r, j) => (j === i ? { ...r, ...patch } : r)) });

  async function save() {
    if (!d.name.trim()) { setError("Name is required."); return; }
    setSaving(true); setError(null);
    const statBlock = draftToStatBlock(d);
    const body = { name: statBlock.name, statBlockJson: JSON.stringify(statBlock) };
    const r = await fetch("/api/homebrew-monsters", {
      method: d.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(d.id ? { id: d.id, ...body } : body),
    });
    setSaving(false);
    if (!r.ok) {
      const e = await r.json().catch(() => null);
      setError(e?.error ?? "Failed to save monster.");
      return;
    }
    onSaved();
  }

  const num = "input w-full";
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
      {/* ---- Form ---- */}
      <div className="min-w-0 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name" className="sm:col-span-2">
            <input className="input w-full" value={d.name} onChange={(e) => set({ name: e.target.value })} maxLength={80} placeholder="Goblin Chieftain" />
          </Field>
          <Field label="Size">
            <select className="input w-full" value={d.size} onChange={(e) => set({ size: e.target.value })}>
              {MONSTER_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Type">
            <select className="input w-full" value={d.type} onChange={(e) => set({ type: e.target.value })}>
              {MONSTER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Alignment">
            <input className="input w-full" value={d.alignment} onChange={(e) => set({ alignment: e.target.value })} maxLength={60} placeholder="chaotic evil" />
          </Field>
          <Field label="Challenge Rating">
            <select className="input w-full" value={d.cr} onChange={(e) => set({ cr: e.target.value })}>
              {CR_VALUES.map((c) => <option key={c} value={c}>CR {c}</option>)}
            </select>
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Armor Class">
            <input className={num} type="number" min={1} max={30} value={d.ac} onChange={(e) => set({ ac: e.target.value })} />
          </Field>
          <Field label="AC Type">
            <input className="input w-full" value={d.acType} onChange={(e) => set({ acType: e.target.value })} maxLength={80} placeholder="natural armor" />
          </Field>
          <Field label="Hit Points (avg)">
            <input className={num} type="number" min={1} max={1000} value={d.hp} onChange={(e) => set({ hp: e.target.value })} />
          </Field>
          <Field label="Hit Dice">
            <input className="input w-full" value={d.hitDice} onChange={(e) => set({ hitDice: e.target.value })} maxLength={40} placeholder="2d6" />
          </Field>
          <Field label="Speed" className="sm:col-span-4">
            <input className="input w-full" value={d.speed} onChange={(e) => set({ speed: e.target.value })} maxLength={200} placeholder="30 ft., fly 60 ft." />
          </Field>
        </div>

        <div>
          <div className="mb-1 text-[10px] font-bold uppercase tracking-[.1em] text-heading">Ability Scores</div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {(["str", "dex", "con", "int", "wis", "cha"] as const).map((a) => (
              <label key={a} className="block text-center">
                <span className="block text-[10px] font-bold uppercase text-[#5e5448]">{a}</span>
                <input className="input w-full text-center" type="number" min={1} max={30}
                  value={d[a]} onChange={(e) => set({ [a]: e.target.value } as Partial<BuilderDraft>)} />
              </label>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Senses">
            <input className="input w-full" value={d.senses} onChange={(e) => set({ senses: e.target.value })} maxLength={300} placeholder="darkvision 60 ft., passive Perception 9" />
          </Field>
          <Field label="Languages">
            <input className="input w-full" value={d.languages} onChange={(e) => set({ languages: e.target.value })} maxLength={300} placeholder="Common, Goblin" />
          </Field>
          <Field label="Damage Resistances">
            <input className="input w-full" value={d.resistances} onChange={(e) => set({ resistances: e.target.value })} maxLength={400} placeholder="cold, fire" />
          </Field>
          <Field label="Damage Immunities">
            <input className="input w-full" value={d.immunities} onChange={(e) => set({ immunities: e.target.value })} maxLength={400} placeholder="poison" />
          </Field>
          <Field label="Damage Vulnerabilities">
            <input className="input w-full" value={d.vulnerabilities} onChange={(e) => set({ vulnerabilities: e.target.value })} maxLength={400} placeholder="radiant" />
          </Field>
          <Field label="Condition Immunities">
            <input className="input w-full" value={d.conditionImmunities} onChange={(e) => set({ conditionImmunities: e.target.value })} maxLength={400} placeholder="poisoned, charmed" />
          </Field>
        </div>

        {/* Traits */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-heading">Traits</h3>
            <button type="button" className="btn-ghost text-xs" onClick={() => set({ traits: [...d.traits, { name: "", text: "" }] })}>+ Add trait</button>
          </div>
          {d.traits.map((t, i) => (
            <div key={i} className="panel-inset space-y-2 p-2">
              <div className="flex gap-2">
                <input className="input w-full" value={t.name} onChange={(e) => setTrait(i, { name: e.target.value })} maxLength={120} placeholder="Nimble Escape" />
                <button type="button" className="btn-ghost text-xs" onClick={() => set({ traits: d.traits.filter((_, j) => j !== i) })}>Remove</button>
              </div>
              <textarea className="input w-full" rows={2} value={t.text} onChange={(e) => setTrait(i, { text: e.target.value })} maxLength={4000} placeholder="Trait description..." />
            </div>
          ))}
        </section>

        {/* Actions */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-heading">Actions</h3>
            <button type="button" className="btn-ghost text-xs" onClick={() => set({ actions: [...d.actions, { name: "", text: "", toHit: "", dice: "", dtype: "" }] })}>+ Add action</button>
          </div>
          {d.actions.map((a, i) => (
            <div key={i} className="panel-inset space-y-2 p-2">
              <div className="flex gap-2">
                <input className="input w-full" value={a.name} onChange={(e) => setAction(i, { name: e.target.value })} maxLength={120} placeholder="Scimitar" />
                <button type="button" className="btn-ghost text-xs" onClick={() => set({ actions: d.actions.filter((_, j) => j !== i) })}>Remove</button>
              </div>
              <textarea className="input w-full" rows={2} value={a.text} onChange={(e) => setAction(i, { text: e.target.value })} maxLength={3500}
                placeholder="Description — or fill the attack fields below to auto-compose one" />
              <div className="grid grid-cols-3 gap-2">
                <label className="block">
                  <span className="block text-[9px] font-bold uppercase text-[#5e5448]">To hit (e.g. 4)</span>
                  <input className="input w-full" type="number" min={-5} max={20} value={a.toHit} onChange={(e) => setAction(i, { toHit: e.target.value })} />
                </label>
                <label className="block">
                  <span className="block text-[9px] font-bold uppercase text-[#5e5448]">Damage dice</span>
                  <input className="input w-full" value={a.dice} onChange={(e) => setAction(i, { dice: e.target.value })} maxLength={20} placeholder="1d6+2" />
                </label>
                <label className="block">
                  <span className="block text-[9px] font-bold uppercase text-[#5e5448]">Damage type</span>
                  <input className="input w-full" value={a.dtype} onChange={(e) => setAction(i, { dtype: e.target.value })} maxLength={20} placeholder="slashing" />
                </label>
              </div>
            </div>
          ))}
        </section>

        {/* Legendary actions */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-heading">Legendary Actions</h3>
            <button type="button" className="btn-ghost text-xs" onClick={() => set({ legendary: [...d.legendary, { name: "", text: "" }] })}>+ Add legendary action</button>
          </div>
          {d.legendary.map((t, i) => (
            <div key={i} className="panel-inset space-y-2 p-2">
              <div className="flex gap-2">
                <input className="input w-full" value={t.name} onChange={(e) => setLegendary(i, { name: e.target.value })} maxLength={120} placeholder="Tail Swipe" />
                <button type="button" className="btn-ghost text-xs" onClick={() => set({ legendary: d.legendary.filter((_, j) => j !== i) })}>Remove</button>
              </div>
              <textarea className="input w-full" rows={2} value={t.text} onChange={(e) => setLegendary(i, { text: e.target.value })} maxLength={4000} placeholder="Legendary action description..." />
            </div>
          ))}
        </section>

        {error && <p className="text-sm font-semibold text-blood">{error}</p>}
        <div className="flex gap-2">
          <button type="button" className="btn-primary" onClick={save} disabled={saving}>
            {saving ? "Saving..." : d.id ? "Save Changes" : "Save Monster"}
          </button>
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>

      {/* ---- Live preview ---- */}
      <div className="min-w-0">
        <div className="sticky top-20">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-[.16em] text-heading">Live Preview</div>
          <StatBlockCard mon={preview} />
        </div>
      </div>
    </div>
  );
}
