"use client";
// Cast the character's prepared spells & cantrips straight to the dice tray.
// PURE/CONTROLLED: rolls dice + calls parent callbacks to spend slots. No fetch here.
import { useState } from "react";
import type { SpellcastingInfo } from "@/lib/dnd/character";
import { resolveCast } from "@/lib/dnd/spell-casting";
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
}

// Value used in the upcast <select>: a numeric slot level, or the "pact" sentinel.
const PACT = "pact";

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
}: CastableSpellsProps) {
  const cantrips = spells.filter((s) => s.level === 0);
  const leveled = spells
    .filter((s) => s.level > 0 && (s.prepared || s.alwaysPrepared))
    .sort((a, b) => a.level - b.level || String(a.name).localeCompare(String(b.name)));

  const pactAvail = spellcasting.pact ? Math.max(0, spellcasting.pact.slots - pactUsed) : 0;

  function slotAvail(level: number): number {
    return Math.max(0, (spellcasting.slots[level - 1] ?? 0) - (slotsUsed[level] ?? 0));
  }

  // Fire the roll for a resolved cast, then let the parent persist the spend.
  function doCast(spell: any, chosenSlotLevel: number, viaPact: boolean) {
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
      pushTrayEntry({ label: spell.name, dice: [], total: 0, breakdown: "cast", extra: `Level ${chosenSlotLevel} slot spent` });
    }
    // Spend after rolling. Cantrips spend nothing.
    if (spell.level > 0) {
      if (viaPact) onSpendPact();
      else onSpendSlot(chosenSlotLevel);
    }
  }

  const hasCastables = cantrips.length > 0 || leveled.length > 0;

  return (
    <div className="mt-3">
      <div className="mb-1 text-xs uppercase tracking-wide text-gold">Cast</div>
      {!hasCastables ? (
        <p className="muted text-sm">No prepared spells or cantrips.</p>
      ) : (
        <div className="space-y-1">
          {cantrips.map((spell) => (
            <div key={spell.id} className="flex items-center justify-between gap-2 text-sm">
              <span>
                <b>{spell.name}</b> <span className="text-[11px] text-[#8a7a5f]">· cantrip</span>
                {spell.concentration ? <span className="text-arcane"> · C</span> : null}
              </span>
              <button type="button" className="btn-ghost" disabled={!canUse}
                onClick={() => doCast(spell, 0, false)} title={`Cast ${spell.name}`}>Cast</button>
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
            />
          ))}
        </div>
      )}
      <div className="mt-2 flex flex-wrap gap-1 text-xs text-[#6b5a42]">
        {spellcasting.slots.map((n, i) => n > 0 && (
          <span key={i} className="chip">L{i + 1}: {slotAvail(i + 1)}/{n}</span>
        ))}
        {spellcasting.pact && <span className="chip chip-gold">Pact L{spellcasting.pact.level}: {pactAvail}/{spellcasting.pact.slots}</span>}
      </div>
    </div>
  );
}

function LeveledSpellRow({
  spell, canUse, slotAvail, pactAvail, pactLevel, onCast,
}: {
  spell: any;
  canUse: boolean;
  slotAvail: (level: number) => number;
  pactAvail: number;
  pactLevel: number;
  onCast: (spell: any, chosenSlotLevel: number, viaPact: boolean) => void;
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

  function cast() {
    if (effective === PACT) onCast(spell, pactLevel, true);
    else onCast(spell, Number(effective), false);
  }

  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span>
        <b>{spell.name}</b> <span className="text-[11px] text-[#8a7a5f]">· L{spell.level}</span>
        {spell.concentration ? <span className="text-arcane"> · C</span> : null}
      </span>
      <span className="flex items-center gap-1">
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
      </span>
    </div>
  );
}
