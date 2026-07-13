"use client";
// Speed & Defenses (SPEC-PLAYER §11).
import { useState } from "react";
import type { DefensesData } from "@/lib/character-view";

// Canonical type lives in src/lib/character-view.ts; re-exported here for compatibility.
export type { DefensesData } from "@/lib/character-view";

const DAMAGE_TYPES = [
  "acid", "bludgeoning", "cold", "fire", "force", "lightning", "necrotic",
  "piercing", "poison", "psychic", "radiant", "slashing", "thunder",
];
const CONDITIONS = [
  "blinded", "charmed", "deafened", "frightened", "grappled", "incapacitated",
  "invisible", "paralyzed", "petrified", "poisoned", "prone", "restrained",
  "stunned", "unconscious",
];
const SPEED_KEYS = ["fly", "swim", "climb", "burrow"] as const;
type SpeedKey = (typeof SPEED_KEYS)[number];
const SPEED_LABELS: Record<SpeedKey, string> = { fly: "Fly", swim: "Swim", climb: "Climb", burrow: "Burrow" };

export function SpeedDefensesPanel({ defenses, walkingSpeed, ac, acBreakdown, canEdit, onSave }: {
  defenses: DefensesData;
  walkingSpeed: number;
  ac: number;
  acBreakdown?: string;
  canEdit: boolean;
  onSave: (d: DefensesData) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<DefensesData>(defenses);

  const startEdit = () => {
    setDraft({
      resistances: [...defenses.resistances],
      immunities: [...defenses.immunities],
      vulnerabilities: [...defenses.vulnerabilities],
      conditionImmunities: [...defenses.conditionImmunities],
      speeds: { ...defenses.speeds },
    });
    setEditing(true);
  };

  const save = () => {
    const speeds: DefensesData["speeds"] = {};
    for (const k of SPEED_KEYS) {
      const v = draft.speeds[k];
      if (v != null && v > 0) speeds[k] = v;
    }
    onSave({ ...draft, speeds });
    setEditing(false);
  };

  const groups: { label: string; items: string[]; chipClass: string }[] = [
    { label: "Resistances", items: defenses.resistances, chipClass: "chip chip-sage" },
    { label: "Immunities", items: defenses.immunities, chipClass: "chip chip-mist" },
    { label: "Vulnerabilities", items: defenses.vulnerabilities, chipClass: "chip chip-rust" },
    { label: "Condition Immunities", items: defenses.conditionImmunities, chipClass: "chip" },
  ];
  const allEmpty = groups.every((g) => g.items.length === 0);

  const speedBoxes: { label: string; value: number }[] = [{ label: "Walking", value: walkingSpeed }];
  for (const k of SPEED_KEYS) {
    const v = defenses.speeds[k];
    if (v != null && v > 0) speedBoxes.push({ label: SPEED_LABELS[k], value: v });
  }

  return (
    <div className="card">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-display text-gold">Speed &amp; Defenses</h3>
        {canEdit && !editing && (
          <button type="button" className="btn-ghost btn-compact" onClick={startEdit}>Edit</button>
        )}
      </div>

      {/* Speeds */}
      <div className="grid grid-cols-3 gap-2 text-center sm:grid-cols-5">
        {speedBoxes.map((b) => (
          <div key={b.label} className="stat-box">
            <div className="text-[10px] uppercase text-[#5e5448]">{b.label}</div>
            <div className="font-display text-2xl text-gold">{b.value}<span className="ml-0.5 text-xs text-[#857866]">ft</span></div>
          </div>
        ))}
      </div>

      {/* AC */}
      <div className="mt-3 flex items-center gap-3">
        <div className="shield">
          <span>
            <span className="k">AC</span>
            <span className="v">{ac}</span>
          </span>
        </div>
        <div className="text-sm text-[#5e5448]">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-[#857866]">Armor Class</div>
          {acBreakdown && <div>{acBreakdown}</div>}
        </div>
      </div>

      {/* Defense chip groups */}
      {!editing && (
        <div className="mt-3 space-y-2">
          {allEmpty && !canEdit && (
            <div className="text-sm text-[#857866]">No special defenses.</div>
          )}
          {groups.map((g) =>
            g.items.length === 0 ? null : (
              <div key={g.label}>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-[#857866]">{g.label}</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {g.items.map((it) => (
                    <span key={it} className={`${g.chipClass} capitalize`}>{it}</span>
                  ))}
                </div>
              </div>
            )
          )}
        </div>
      )}

      {/* Editor */}
      {editing && (
        <div className="mt-3 space-y-3 border-t border-[#e0d4b4] pt-3">
          <TokenInput
            label="Resistances" chipClass="chip chip-sage" options={DAMAGE_TYPES} listId="sd-dmg-res"
            values={draft.resistances} onChange={(v) => setDraft((d) => ({ ...d, resistances: v }))}
          />
          <TokenInput
            label="Immunities" chipClass="chip chip-mist" options={DAMAGE_TYPES} listId="sd-dmg-imm"
            values={draft.immunities} onChange={(v) => setDraft((d) => ({ ...d, immunities: v }))}
          />
          <TokenInput
            label="Vulnerabilities" chipClass="chip chip-rust" options={DAMAGE_TYPES} listId="sd-dmg-vul"
            values={draft.vulnerabilities} onChange={(v) => setDraft((d) => ({ ...d, vulnerabilities: v }))}
          />
          <TokenInput
            label="Condition Immunities" chipClass="chip" options={CONDITIONS} listId="sd-cond-imm"
            values={draft.conditionImmunities} onChange={(v) => setDraft((d) => ({ ...d, conditionImmunities: v }))}
          />

          <div>
            <div className="label">Other Speeds (ft)</div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {SPEED_KEYS.map((k) => (
                <label key={k} className="text-xs text-[#5e5448]">
                  {SPEED_LABELS[k]}
                  <input
                    type="number" min={0} max={1000} step={5}
                    className="input mt-1"
                    value={draft.speeds[k] ?? ""}
                    onChange={(e) => {
                      const raw = e.target.value;
                      const n = raw === "" ? undefined : Math.max(0, Math.floor(Number(raw)));
                      setDraft((d) => ({ ...d, speeds: { ...d.speeds, [k]: Number.isFinite(n as number) ? n : undefined } }));
                    }}
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button type="button" className="btn-gold" onClick={save}>Save</button>
            <button type="button" className="btn-ghost" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Text field + Add button + removable chips, with datalist suggestions. */
function TokenInput({ label, values, onChange, options, listId, chipClass }: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
  options: string[];
  listId: string;
  chipClass: string;
}) {
  const [text, setText] = useState("");

  const add = () => {
    const v = text.trim().toLowerCase();
    if (!v) return;
    if (!values.some((x) => x.toLowerCase() === v)) onChange([...values, v]);
    setText("");
  };

  return (
    <div>
      <div className="label">{label}</div>
      {values.length > 0 && (
        <div className="mb-1.5 flex flex-wrap gap-1">
          {values.map((v) => (
            <span key={v} className={`${chipClass} capitalize`}>
              {v}
              <button
                type="button"
                aria-label={`Remove ${v}`}
                className="ml-0.5 cursor-pointer font-bold leading-none opacity-70 hover:opacity-100"
                onClick={() => onChange(values.filter((x) => x !== v))}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          className="input"
          list={listId}
          value={text}
          placeholder={`Add ${label.toLowerCase()}…`}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
        />
        <datalist id={listId}>
          {options.filter((o) => !values.includes(o)).map((o) => <option key={o} value={o} />)}
        </datalist>
        <button type="button" className="btn-ghost" onClick={add}>Add</button>
      </div>
    </div>
  );
}
