"use client";
// Compact NPC / creature stat sheet. Used by the DM to give an NPC a playable
// block (AC, HP, abilities, skills, actions with roll buttons). Renders read-only
// or as an inline editor; `onChange` receives the updated block on every edit.
import { useState } from "react";
import { roll } from "@/lib/dnd/dice";

export interface NpcAction {
  name: string;
  desc?: string;
  toHit?: number; // attack bonus for the d20 roll (optional)
  damage?: string; // dice expression, e.g. "1d8+2"
}
export interface NpcSkill {
  name: string;
  bonus: number;
}
export interface NpcStatBlock {
  name?: string;
  type?: string; // e.g. "Medium humanoid (guard), neutral"
  ac?: number;
  hp?: number;
  speed?: string;
  str?: number;
  dex?: number;
  con?: number;
  int?: number;
  wis?: number;
  cha?: number;
  skills?: NpcSkill[];
  actions?: NpcAction[];
  notes?: string;
}

const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"] as const;
type Ability = (typeof ABILITIES)[number];

export function abilityMod(score: number | undefined): number {
  return Math.floor(((score ?? 10) - 10) / 2);
}
function fmt(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

/** A fresh, empty-ish stat block for the "give this NPC a sheet" flow. */
export function emptyStatBlock(name = ""): NpcStatBlock {
  return {
    name,
    type: "",
    ac: 12,
    hp: 11,
    speed: "30 ft.",
    str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10,
    skills: [],
    actions: [],
    notes: "",
  };
}

export function NpcSheet({
  block,
  editable = false,
  onChange,
}: {
  block: NpcStatBlock;
  editable?: boolean;
  onChange?: (b: NpcStatBlock) => void;
}) {
  const [lastRoll, setLastRoll] = useState<string | null>(null);

  function patch(p: Partial<NpcStatBlock>) {
    onChange?.({ ...block, ...p });
  }
  function num(v: string): number | undefined {
    const n = Number(v);
    return v === "" || Number.isNaN(n) ? undefined : n;
  }

  function doRoll(label: string, expr: string) {
    const r = roll(expr);
    setLastRoll(`${label}: ${r.breakdown}`);
  }

  // ---------- Editable form ----------
  if (editable) {
    const skills = block.skills ?? [];
    const actions = block.actions ?? [];
    return (
      <div className="space-y-3 text-sm">
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-heading">Name</span>
            <input className="input w-full" value={block.name ?? ""} onChange={(e) => patch({ name: e.target.value })} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-heading">Type</span>
            <input className="input w-full" placeholder="Medium humanoid, neutral" value={block.type ?? ""} onChange={(e) => patch({ type: e.target.value })} />
          </label>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-heading">AC</span>
            <input className="input w-full" type="number" value={block.ac ?? ""} onChange={(e) => patch({ ac: num(e.target.value) })} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-heading">HP</span>
            <input className="input w-full" type="number" value={block.hp ?? ""} onChange={(e) => patch({ hp: num(e.target.value) })} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-heading">Speed</span>
            <input className="input w-full" value={block.speed ?? ""} onChange={(e) => patch({ speed: e.target.value })} />
          </label>
        </div>

        <div className="grid grid-cols-6 gap-2">
          {ABILITIES.map((a) => (
            <label key={a} className="block">
              <span className="mb-1 block text-center text-xs font-semibold uppercase text-heading">{a}</span>
              <input
                className="input w-full text-center"
                type="number"
                value={(block[a as Ability] as number | undefined) ?? ""}
                onChange={(e) => patch({ [a]: num(e.target.value) } as Partial<NpcStatBlock>)}
              />
              <span className="mt-0.5 block text-center text-[11px] muted">{fmt(abilityMod(block[a as Ability] as number | undefined))}</span>
            </label>
          ))}
        </div>

        {/* Skills */}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-semibold text-heading">Skills</span>
            <button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={() => patch({ skills: [...skills, { name: "", bonus: 0 }] })}>+ Skill</button>
          </div>
          <div className="space-y-1">
            {skills.map((s, i) => (
              <div key={i} className="flex gap-2">
                <input className="input flex-1" placeholder="Perception" value={s.name} onChange={(e) => {
                  const next = skills.slice(); next[i] = { ...s, name: e.target.value }; patch({ skills: next });
                }} />
                <input className="input w-20" type="number" value={s.bonus} onChange={(e) => {
                  const next = skills.slice(); next[i] = { ...s, bonus: Number(e.target.value) || 0 }; patch({ skills: next });
                }} />
                <button type="button" className="btn-ghost px-2 py-1 text-xs text-blood" onClick={() => patch({ skills: skills.filter((_, j) => j !== i) })}>×</button>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-semibold text-heading">Actions</span>
            <button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={() => patch({ actions: [...actions, { name: "", desc: "", damage: "" }] })}>+ Action</button>
          </div>
          <div className="space-y-2">
            {actions.map((act, i) => (
              <div key={i} className="card space-y-1 p-2">
                <div className="flex gap-2">
                  <input className="input flex-1" placeholder="Longsword" value={act.name} onChange={(e) => {
                    const next = actions.slice(); next[i] = { ...act, name: e.target.value }; patch({ actions: next });
                  }} />
                  <button type="button" className="btn-ghost px-2 py-1 text-xs text-blood" onClick={() => patch({ actions: actions.filter((_, j) => j !== i) })}>×</button>
                </div>
                <div className="flex gap-2">
                  <label className="flex-1 text-[11px] muted">To-hit
                    <input className="input w-full" type="number" placeholder="+4" value={act.toHit ?? ""} onChange={(e) => {
                      const next = actions.slice(); next[i] = { ...act, toHit: num(e.target.value) }; patch({ actions: next });
                    }} />
                  </label>
                  <label className="flex-1 text-[11px] muted">Damage
                    <input className="input w-full" placeholder="1d8+2" value={act.damage ?? ""} onChange={(e) => {
                      const next = actions.slice(); next[i] = { ...act, damage: e.target.value }; patch({ actions: next });
                    }} />
                  </label>
                </div>
                <textarea className="input w-full" rows={2} placeholder="Description" value={act.desc ?? ""} onChange={(e) => {
                  const next = actions.slice(); next[i] = { ...act, desc: e.target.value }; patch({ actions: next });
                }} />
              </div>
            ))}
          </div>
        </div>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-heading">Notes</span>
          <textarea className="input w-full" rows={2} value={block.notes ?? ""} onChange={(e) => patch({ notes: e.target.value })} />
        </label>
      </div>
    );
  }

  // ---------- Read-only sheet ----------
  return (
    <div className="space-y-2 text-sm">
      <div>
        <div className="font-display text-lg text-gold">{block.name || "Unnamed creature"}</div>
        {block.type && <div className="text-xs italic muted">{block.type}</div>}
      </div>

      <div className="flex flex-wrap gap-2 border-y border-[#e2d6b8] py-2">
        {block.ac != null && <span className="chip"><b>AC</b>&nbsp;{block.ac}</span>}
        {block.hp != null && <span className="chip"><b>HP</b>&nbsp;{block.hp}</span>}
        {block.speed && <span className="chip"><b>Speed</b>&nbsp;{block.speed}</span>}
      </div>

      <div className="grid grid-cols-6 gap-1 text-center">
        {ABILITIES.map((a) => {
          const score = block[a as Ability] as number | undefined;
          return (
            <div key={a} className="card p-1">
              <div className="text-[10px] font-bold uppercase text-heading">{a}</div>
              <div className="font-semibold">{score ?? 10}</div>
              <button className="btn-ghost w-full px-0 py-0.5 text-[11px]" onClick={() => doRoll(`${a.toUpperCase()} check`, `1d20${fmt(abilityMod(score))}`)}>
                {fmt(abilityMod(score))}
              </button>
            </div>
          );
        })}
      </div>

      {block.skills && block.skills.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {block.skills.map((s, i) => (
            <button key={i} className="chip" onClick={() => doRoll(s.name || "Skill", `1d20${fmt(s.bonus)}`)}>
              {s.name} {fmt(s.bonus)}
            </button>
          ))}
        </div>
      )}

      {block.actions && block.actions.length > 0 && (
        <div className="space-y-1">
          <div className="text-xs font-bold uppercase tracking-wide text-heading">Actions</div>
          {block.actions.map((act, i) => (
            <div key={i} className="card p-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{act.name || "Action"}</span>
                {act.toHit != null && (
                  <button className="btn-ghost px-2 py-0.5 text-xs" onClick={() => doRoll(`${act.name || "Attack"} to hit`, `1d20${fmt(act.toHit!)}`)}>
                    Attack {fmt(act.toHit)}
                  </button>
                )}
                {act.damage && (
                  <button className="btn-ghost px-2 py-0.5 text-xs" onClick={() => doRoll(`${act.name || "Action"} damage`, act.damage!)}>
                    Damage {act.damage}
                  </button>
                )}
              </div>
              {act.desc && <p className="mt-1 text-xs muted">{act.desc}</p>}
            </div>
          ))}
        </div>
      )}

      {block.notes && <p className="text-xs muted">{block.notes}</p>}

      {lastRoll && (
        <div className="chip chip-gold w-full justify-center py-1 text-center font-semibold" role="status" aria-live="polite">
          {lastRoll}
        </div>
      )}
    </div>
  );
}
