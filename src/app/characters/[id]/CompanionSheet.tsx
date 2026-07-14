"use client";
// A full mini creature stat sheet for a Companion / summon. Renders the
// normalized stat block stored in Companion.statJson and lets an editor
// adjust HP and roll the dice in action descriptions.
import { useMemo, useState } from "react";
import { roll } from "@/lib/dnd/dice";

type NamedEntry = { name: string; desc: string };

type StatBlock = {
  size?: string | null;
  type?: string | null;
  alignment?: string | null;
  ac?: number | string | null;
  speed?: string | null;
  str?: number | null; dex?: number | null; con?: number | null;
  int?: number | null; wis?: number | null; cha?: number | null;
  senses?: string | null;
  skills?: string | null;
  languages?: string | null;
  cr?: string | null;
  traits?: NamedEntry[] | null;
  actions?: NamedEntry[] | null;
};

export type Companion = {
  id: string;
  name: string;
  kind: string;
  srcMonsterId: number | null;
  statJson: string;
  currentHp: number;
  maxHp: number;
  notes: string | null;
  active: boolean;
};

const ABILITIES: { key: keyof StatBlock; label: string }[] = [
  { key: "str", label: "STR" }, { key: "dex", label: "DEX" }, { key: "con", label: "CON" },
  { key: "int", label: "INT" }, { key: "wis", label: "WIS" }, { key: "cha", label: "CHA" },
];

const KIND_LABEL: Record<string, string> = {
  familiar: "Familiar", wildshape: "Wild Shape", summon: "Summon", mount: "Mount", other: "Companion",
};

function mod(score: number | null | undefined): string {
  const m = Math.floor(((score ?? 10) - 10) / 2);
  return m >= 0 ? `+${m}` : `${m}`;
}

/** Parse the statJson blob; tolerant of both the normalized shape and raw SRD. */
function parseBlock(statJson: string): StatBlock {
  let raw: any = {};
  try { raw = JSON.parse(statJson) || {}; } catch { raw = {}; }
  const entries = (v: unknown): NamedEntry[] => {
    let arr: any = v;
    if (typeof v === "string") { try { arr = JSON.parse(v); } catch { arr = []; } }
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((e) => e && typeof e.name === "string")
      .map((e) => ({ name: String(e.name), desc: String(e.desc ?? e.description ?? "") }));
  };
  let speed = raw.speed;
  if (typeof speed === "string" && speed.trim().startsWith("{")) {
    try {
      const o = JSON.parse(speed);
      speed = Object.entries(o).map(([k, val]) => (k === "walk" ? String(val) : `${k} ${val}`)).join(", ");
    } catch { /* keep as-is */ }
  }
  return { ...raw, speed, traits: entries(raw.traits), actions: entries(raw.actions) };
}

// Find dice expressions like "2d6+3", "1d20 + 5", "d8" inside action text.
const DICE_RE = /\b(\d*d\d+(?:\s*[+-]\s*\d+)?)\b/gi;
function diceIn(text: string): string[] {
  const found = new Set<string>();
  let m: RegExpExecArray | null;
  DICE_RE.lastIndex = 0;
  while ((m = DICE_RE.exec(text)) !== null) found.add(m[1].replace(/\s+/g, ""));
  return [...found];
}

export function CompanionSheet({
  companion,
  characterId,
  canEdit,
  onChange,
  onClose,
}: {
  companion: Companion;
  characterId: string;
  canEdit: boolean;
  onChange?: (c: Companion) => void;
  onClose?: () => void;
}) {
  const block = useMemo(() => parseBlock(companion.statJson), [companion.statJson]);
  const [hp, setHp] = useState(companion.currentHp);
  const [busy, setBusy] = useState(false);
  const [lastRoll, setLastRoll] = useState<string | null>(null);

  async function patch(fields: Record<string, unknown>) {
    if (!canEdit) return;
    setBusy(true);
    const r = await fetch(`/api/characters/${characterId}/companions`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companionId: companion.id, ...fields }),
    }).catch(() => null);
    setBusy(false);
    if (r?.ok) {
      const data = await r.json().catch(() => null);
      if (data?.companion && onChange) onChange(data.companion);
    }
  }

  function changeHp(delta: number) {
    const next = Math.max(0, Math.min(companion.maxHp, hp + delta));
    setHp(next);
    patch({ currentHp: next });
  }

  function doRoll(label: string, expr: string) {
    const r = roll(expr);
    const flair = r.crit ? " — CRIT!" : r.fumble ? " — fumble" : "";
    setLastRoll(`${label}: ${r.breakdown}${flair}`);
  }

  const hpPct = companion.maxHp > 0 ? Math.round((hp / companion.maxHp) * 100) : 0;

  return (
    <div className="card">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="font-display text-lg text-gold">{companion.name}</h3>
          <p className="text-xs text-[#5e5448]">
            <span className="chip mr-1">{KIND_LABEL[companion.kind] ?? companion.kind}</span>
            {[block.size, block.type].filter(Boolean).join(" ")}
            {block.alignment ? `, ${block.alignment}` : ""}
            {block.cr ? ` · CR ${block.cr}` : ""}
          </p>
        </div>
        <span className="flex items-center gap-1">
          {canEdit && (
            <button className={`chip cursor-pointer ${companion.active ? "chip-gold" : "opacity-70"}`}
              title={companion.active ? "Active — click to dismiss" : "Dismissed — click to reactivate"}
              disabled={busy}
              onClick={() => patch({ active: !companion.active })}>
              {companion.active ? "Active" : "Dismissed"}
            </button>
          )}
          {onClose && <button className="btn-ghost !py-0.5" onClick={onClose}>Close</button>}
        </span>
      </div>

      {/* Defensive plaques */}
      <div className="flex flex-wrap items-stretch gap-2">
        <div className="shield">
          <span className="k">AC</span>
          <span className="v">{block.ac != null && block.ac !== "" ? block.ac : "—"}</span>
        </div>
        <div className="shield shield-hp">
          <span className="k">Hit Points</span>
          <span className="v">{hp} / {companion.maxHp}</span>
          {canEdit && (
            <span className="mt-1 flex items-center gap-1">
              <button className="btn-ghost !px-2 !py-0 text-sm" disabled={busy} onClick={() => changeHp(-1)}>−</button>
              <button className="btn-ghost !px-2 !py-0 text-sm" disabled={busy} onClick={() => changeHp(-5)}>−5</button>
              <button className="btn-ghost !px-2 !py-0 text-sm" disabled={busy} onClick={() => changeHp(+5)}>+5</button>
              <button className="btn-ghost !px-2 !py-0 text-sm" disabled={busy} onClick={() => changeHp(+1)}>+</button>
            </span>
          )}
        </div>
        <div className="shield">
          <span className="k">Speed</span>
          <span className="v" style={{ fontSize: 14 }}>{block.speed || "—"}</span>
        </div>
      </div>

      {/* HP bar */}
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full" style={{ background: "var(--inset)" }}>
        <div className="h-full rounded-full" style={{ width: `${hpPct}%`, background: hpPct > 25 ? "var(--sage)" : "var(--blood)" }} />
      </div>

      {/* Ability scores */}
      <div className="ability-line mt-3">
        {ABILITIES.map((a) => {
          const score = block[a.key] as number | null | undefined;
          return (
            <div key={a.key}>
              <strong>{a.label}</strong>
              <span>{score ?? "—"} ({mod(score)})</span>
            </div>
          );
        })}
      </div>

      {/* Senses / skills / languages */}
      <div className="space-y-1 text-sm">
        {block.senses && <p><span className="text-gold">Senses</span> {block.senses}</p>}
        {block.skills && <p><span className="text-gold">Skills</span> {block.skills}</p>}
        {block.languages && <p><span className="text-gold">Languages</span> {block.languages}</p>}
      </div>

      {lastRoll && (
        <div className="panel-inset mt-2 p-2 text-sm">
          <span className="text-gold">Roll</span> {lastRoll}
        </div>
      )}

      {/* Traits */}
      {block.traits && block.traits.length > 0 && (
        <div className="mt-3">
          <h4 className="mb-1 text-xs uppercase tracking-wide text-gold">Traits</h4>
          <div className="space-y-1">
            {block.traits.map((t, i) => (
              <p key={i} className="text-sm"><b>{t.name}.</b> {t.desc}</p>
            ))}
          </div>
        </div>
      )}

      {/* Actions with roll buttons */}
      {block.actions && block.actions.length > 0 && (
        <div className="mt-3">
          <h4 className="mb-1 text-xs uppercase tracking-wide text-gold">Actions</h4>
          <div className="space-y-2">
            {block.actions.map((a, i) => {
              const dice = diceIn(a.desc);
              return (
                <div key={i} className="panel-inset p-2 text-sm">
                  <p><b>{a.name}.</b> {a.desc}</p>
                  {dice.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {dice.map((d) => (
                        <button key={d} className="chip cursor-pointer" onClick={() => doRoll(a.name, d)}>
                          🎲 {d}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Notes */}
      {canEdit ? (
        <div className="mt-3">
          <label className="label">Notes</label>
          <textarea
            className="input" rows={2} defaultValue={companion.notes ?? ""}
            maxLength={4000}
            onBlur={(e) => { if (e.target.value !== (companion.notes ?? "")) patch({ notes: e.target.value || null }); }}
          />
        </div>
      ) : (
        companion.notes && (
          <div className="mt-3">
            <div className="label">Notes</div>
            <p className="whitespace-pre-wrap text-sm">{companion.notes}</p>
          </div>
        )
      )}
    </div>
  );
}
