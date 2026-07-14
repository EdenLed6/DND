"use client";
// Play-mode cast panel: cast prepared/known spells & cantrips.
// Spending goes through the op:"cast" endpoint (single source of truth, shared
// with the live battle) when `characterId` is provided; otherwise it falls back
// to the parent onSpendSlot/onSpendPact callbacks. Remaining slots update live.
import { useEffect, useState } from "react";
import type { SpellcastingInfo } from "@/lib/dnd/character";
import { isPreparedCaster, resolveCast, isCastable } from "@/lib/dnd/spell-casting";
import { roll } from "@/lib/dnd/dice";
import { rollToTray, rollAttackToTray, pushTrayEntry } from "@/components/DiceTray";

interface CastableSpellsProps {
  spells: any[];
  spellcasting: SpellcastingInfo;
  slotsUsed: Record<number, number>;
  pactUsed: number;
  characterLevel: number;
  abilityMod: number;
  canUse: boolean;
  onSpendSlot: (level: number) => void;
  onSpendPact: () => void;
  // When provided, casting is persisted through POST /spells {op:"cast"} — the
  // single source of truth. Pass characterId={c.id} from CharacterSheet to enable.
  characterId?: string;
}

// Value used in the upcast <select>: a numeric slot level, or the "pact" sentinel.
const PACT = "pact";

// Remaining-slots shape returned by the cast endpoint.
type CastRemaining = { slots: Record<string, number>; pact: { level: number; available: number } | null };

export function CastableSpells({
  spells,
  spellcasting,
  slotsUsed,
  pactUsed,
  characterLevel,
  abilityMod,
  canUse,
  onSpendSlot,
  onSpendPact,
  characterId,
}: CastableSpellsProps) {
  // Prepared casters cast only prepared (or always-prepared) spells; known
  // casters (Bard/Sorcerer/Warlock/Ranger) can cast anything they know.
  const prepares = isPreparedCaster(spellcasting.casterClass);
  const cantrips = spells.filter((s) => s.level === 0);
  const leveled = spells
    .filter((s) => s.level > 0 && (!prepares || s.prepared || s.alwaysPrepared))
    .sort((a, b) => a.level - b.level || String(a.name).localeCompare(String(b.name)));

  // Local, live slot usage — seeded from props, bumped optimistically on cast and
  // reconciled from the endpoint response. Re-syncs when the props change.
  const [usedLocal, setUsedLocal] = useState<Record<number, number>>(slotsUsed);
  const [pactLocal, setPactLocal] = useState<number>(pactUsed);
  useEffect(() => { setUsedLocal(slotsUsed); }, [slotsUsed]);
  useEffect(() => { setPactLocal(pactUsed); }, [pactUsed]);

  // Inline "rolled X" result per spell (from the 🎲 quick-roll button).
  const [rolls, setRolls] = useState<Record<string, string>>({});

  const pactAvail = spellcasting.pact ? Math.max(0, spellcasting.pact.slots - pactLocal) : 0;

  function slotAvail(level: number): number {
    return Math.max(0, (spellcasting.slots[level - 1] ?? 0) - (usedLocal[level] ?? 0));
  }

  // Reconcile local usage from the endpoint's authoritative `remaining`.
  function applyRemaining(remaining: CastRemaining) {
    const next: Record<number, number> = {};
    for (let lvl = 1; lvl <= 9; lvl++) {
      const max = spellcasting.slots[lvl - 1] ?? 0;
      if (max > 0) {
        const avail = remaining.slots?.[String(lvl)] ?? max;
        next[lvl] = Math.max(0, max - avail);
      }
    }
    setUsedLocal(next);
    if (spellcasting.pact && remaining.pact) {
      setPactLocal(Math.max(0, spellcasting.pact.slots - remaining.pact.available));
    }
  }

  // Persist the spend through the cast endpoint. Returns false if rejected.
  async function spendViaEndpoint(spell: any, level: number, viaPact: boolean): Promise<boolean> {
    if (!characterId) return true;
    try {
      const r = await fetch(`/api/characters/${characterId}/spells`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "cast", level, upcastFrom: spell.level, pact: viaPact, spellId: spell.id }),
      });
      if (!r.ok) return false;
      const data = await r.json().catch(() => null);
      if (data?.remaining) applyRemaining(data.remaining);
      return true;
    } catch {
      return false;
    }
  }

  // Roll the spell's effect (attack / save damage / heal) to the dice tray.
  function rollEffect(spell: any, chosenSlotLevel: number, asRitual: boolean) {
    const cast = resolveCast(spell.name, spell.level, chosenSlotLevel, characterLevel, abilityMod);
    if (cast.kind === "attack") {
      rollAttackToTray(`${spell.name}`, spellcasting.spellAttackBonus, cast.damageExpr ?? "", cast.damageType ?? "");
    } else if (cast.kind === "save") {
      if (cast.damageExpr) {
        rollToTray(`${spell.name} (${cast.save?.toUpperCase()} save)`, cast.damageExpr, {
          extra: `DC ${spellcasting.spellSaveDc} ${cast.save?.toUpperCase()} · ${cast.damageType}${cast.half ? " (half on save)" : ""}`,
        });
      } else {
        pushTrayEntry({ label: spell.name, dice: [], total: 0, breakdown: "cast", extra: `DC ${spellcasting.spellSaveDc} ${cast.save?.toUpperCase()} save` });
      }
    } else if (cast.kind === "heal") {
      rollToTray(`${spell.name} (healing)`, cast.healExpr ?? "0", { extra: "healing" });
    } else {
      pushTrayEntry({
        label: spell.name, dice: [], total: 0, breakdown: "cast",
        extra: asRitual ? "cast as ritual — no slot spent" : `Level ${chosenSlotLevel} slot spent`,
      });
    }
  }

  // Cast: roll the effect, then spend the slot. Cantrips (level 0) and ritual
  // casts spend nothing.
  async function doCast(spell: any, chosenSlotLevel: number, viaPact: boolean, asRitual = false) {
    rollEffect(spell, chosenSlotLevel, asRitual);
    if (spell.level === 0 || asRitual) return;

    // Optimistic local update for instant feedback.
    if (viaPact) setPactLocal((p) => p + 1);
    else setUsedLocal((u) => ({ ...u, [chosenSlotLevel]: (u[chosenSlotLevel] ?? 0) + 1 }));

    if (characterId) {
      const ok = await spendViaEndpoint(spell, chosenSlotLevel, viaPact);
      if (!ok) {
        // Revert the optimistic bump on rejection.
        if (viaPact) setPactLocal((p) => Math.max(0, p - 1));
        else setUsedLocal((u) => ({ ...u, [chosenSlotLevel]: Math.max(0, (u[chosenSlotLevel] ?? 1) - 1) }));
      }
    } else if (viaPact) {
      onSpendPact();
    } else {
      onSpendSlot(chosenSlotLevel);
    }
  }

  // Minimal dice roll (no slot spent): roll the spell's damage/heal and show it inline.
  function quickRoll(spell: any, chosenSlotLevel: number) {
    const cast = resolveCast(spell.name, spell.level, chosenSlotLevel, characterLevel, abilityMod);
    const expr = cast.damageExpr ?? cast.healExpr;
    if (!expr) return;
    const r = roll(expr);
    const suffix = cast.kind === "heal" ? "healing" : (cast.damageType ?? "");
    rollToTray(`${spell.name} (${cast.kind === "heal" ? "healing" : "damage"})`, expr, { extra: suffix });
    setRolls((prev) => ({ ...prev, [String(spell.id)]: `${r.total}${suffix ? ` ${suffix}` : ""}` }));
  }

  const hasCastables = cantrips.length > 0 || leveled.length > 0;

  return (
    <div className="mt-3">
      <div className="mb-1 text-xs uppercase tracking-wide text-gold">Cast</div>
      {!hasCastables ? (
        <p className="muted text-sm">{prepares ? "No prepared spells or cantrips." : "No spells known or cantrips."}</p>
      ) : (
        <div className="space-y-1">
          {cantrips.map((spell) => (
            <div key={spell.id} className="flex items-center justify-between gap-2 text-sm">
              <span>
                <b>{spell.name}</b> <span className="text-[11px] text-[#857866]">· cantrip</span>
                {spell.ritual ? <span className="text-[11px] text-[#857866]"> (R)</span> : null}
                {spell.concentration ? <span className="text-arcane"> · C</span> : null}
                {rolls[String(spell.id)] && <span className="ml-1 text-[11px] text-gold">🎲 {rolls[String(spell.id)]}</span>}
              </span>
              <span className="flex items-center gap-1">
                {isCastable(spell.name) && (
                  <button type="button" className="btn-ghost !px-2" disabled={!canUse}
                    onClick={() => quickRoll(spell, 0)} title={`Roll ${spell.name}`}>🎲</button>
                )}
                <button type="button" className="btn-ghost" disabled={!canUse}
                  onClick={() => doCast(spell, 0, false)} title={`Cast ${spell.name}`}>Cast</button>
              </span>
            </div>
          ))}
          {leveled.map((spell) => (
            <LeveledSpellRow
              key={spell.id}
              spell={spell}
              canUse={canUse}
              slotAvail={slotAvail}
              pactAvail={pactAvail}
              pactLevel={spellcasting.pact?.level ?? 0}
              onCast={doCast}
              onRoll={quickRoll}
              rolled={rolls[String(spell.id)]}
            />
          ))}
        </div>
      )}
      <div className="mt-2 flex flex-wrap gap-1 text-xs text-[#5e5448]">
        {spellcasting.slots.map((n, i) => n > 0 && (
          <span key={i} className="chip">L{i + 1}: {slotAvail(i + 1)}/{n}</span>
        ))}
        {spellcasting.pact && <span className="chip chip-gold">Pact L{spellcasting.pact.level}: {pactAvail}/{spellcasting.pact.slots}</span>}
      </div>
    </div>
  );
}

function LeveledSpellRow({
  spell, canUse, slotAvail, pactAvail, pactLevel, onCast, onRoll, rolled,
}: {
  spell: any;
  canUse: boolean;
  slotAvail: (level: number) => number;
  pactAvail: number;
  pactLevel: number;
  onCast: (spell: any, chosenSlotLevel: number, viaPact: boolean, asRitual?: boolean) => void;
  onRoll: (spell: any, chosenSlotLevel: number) => void;
  rolled?: string;
}) {
  // Build the list of castable options: normal slots at level >= spell.level with
  // availability, plus a pact-slot option when the pact level is high enough.
  const levelOptions: number[] = [];
  for (let lvl = spell.level; lvl <= 9; lvl++) {
    if (slotAvail(lvl) > 0) levelOptions.push(lvl);
  }
  const pactUsable = pactAvail > 0 && pactLevel >= spell.level;

  // Default: the spell's own level if available, else the lowest available slot,
  // else pact, else the spell's own level (Cast will be disabled).
  const defaultValue =
    levelOptions.includes(spell.level) ? String(spell.level)
    : levelOptions.length > 0 ? String(levelOptions[0])
    : pactUsable ? PACT
    : String(spell.level);

  const [choice, setChoice] = useState<string>(defaultValue);
  const noSlots = levelOptions.length === 0 && !pactUsable;
  const effective = levelOptions.includes(Number(choice)) || (choice === PACT && pactUsable) ? choice : defaultValue;
  const effectiveLevel = effective === PACT ? pactLevel : Number(effective);

  function cast() {
    if (effective === PACT) onCast(spell, pactLevel, true);
    else onCast(spell, Number(effective), false);
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
      <span className="min-w-0">
        <b>{spell.name}</b> <span className="text-[11px] text-[#857866]">· L{spell.level}</span>
        {spell.ritual ? <span className="text-[11px] text-[#857866]"> (R)</span> : null}
        {spell.concentration ? <span className="text-arcane"> · C</span> : null}
        {rolled && <span className="ml-1 text-[11px] text-gold">🎲 {rolled}</span>}
      </span>
      <span className="flex shrink-0 items-center gap-1">
        {isCastable(spell.name) && (
          <button type="button" className="btn-ghost !px-2" disabled={!canUse}
            onClick={() => onRoll(spell, effectiveLevel)} title={`Roll ${spell.name} at L${effectiveLevel}`}>🎲</button>
        )}
        <select
          className="input"
          value={effective}
          disabled={!canUse || noSlots}
          onChange={(e) => setChoice(e.target.value)}
          title="Cast at slot level"
        >
          {levelOptions.map((lvl) => (
            <option key={lvl} value={String(lvl)}>L{lvl}</option>
          ))}
          {pactUsable && <option value={PACT}>Pact L{pactLevel}</option>}
          {noSlots && <option value={String(spell.level)}>L{spell.level}</option>}
        </select>
        <button type="button" className="btn-ghost" disabled={!canUse || noSlots}
          onClick={cast} title={noSlots ? "No slots available" : `Cast ${spell.name}`}>Cast</button>
        {spell.ritual && (
          <button type="button" className="btn-ghost" disabled={!canUse}
            onClick={() => onCast(spell, spell.level, false, true)}
            title={`Cast ${spell.name} as a ritual (+10 minutes, no slot)`}>Ritual</button>
        )}
      </span>
    </div>
  );
}
