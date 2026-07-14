"use client";
// v2.2 "Character Shell" (SPEC-PLAYER §3, §20): sticky CharacterHeader +
// hash-persisted section navigation. Each card is extracted into a local
// render function so it can appear in more than one section without
// duplicating JSX. Business logic (patch/rest/rolls) is unchanged.
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ABILITIES, ABILITY_LABELS, formatMod, EXHAUSTION_EFFECTS, type Ability } from "@/lib/dnd/rules";
import { xpToNextLevel, levelForXp } from "@/lib/dnd/rules";
import type { DerivedCharacter } from "@/lib/dnd/character";
import { useRealtime } from "@/lib/realtime/useRealtime";
import { InventoryManager } from "./InventoryManager";
import { SpellManager } from "./SpellManager";
import { LevelUpWizard } from "./LevelUpWizard";
import { CastableSpells } from "./CastableSpells";
import { ResourcePanel } from "./ResourcePanel";
import { RestPanel } from "./RestPanel";
import { SensesPanel } from "./SensesPanel";
import { ProficienciesPanel } from "./ProficienciesPanel";
import { DescriptionTab } from "./DescriptionTab";
import { CompanionsTab } from "./CompanionsTab";
import { RollLogPanel } from "./RollLogPanel";
import { setRollCharacter } from "@/components/DiceTray";
import { EncumbranceBar } from "./EncumbranceBar";
import { CharacterHeader } from "./CharacterHeader";
import { ActionsSection } from "./ActionsSection";
import { NotesSection } from "./NotesSection";
import { SpeedDefensesPanel } from "./SpeedDefensesPanel";
import { RollOptionsBar, consumeRollOptions, decorateRollLabel } from "./RollOptionsBar";
import { rollToTray, rollAttackToTray, pushTrayEntry } from "@/components/DiceTray";
import { roll } from "@/lib/dnd/dice";
import type { EquippedWeapon, Encumbrance, Senses, Proficiencies, DefensesData } from "@/lib/character-view";
import type { DerivedResource } from "@/lib/dnd/resources";

const CONDITIONS = ["Blinded","Charmed","Deafened","Frightened","Grappled","Incapacitated","Invisible","Paralyzed","Petrified","Poisoned","Prone","Restrained","Stunned","Unconscious"];

type MergedResource = DerivedResource & { used: number };

// Section navigation (spec §3.3, mapped to existing content).
type SectionId = "overview" | "abilities" | "skills" | "actions" | "spells" | "inventory" | "features" | "proficiencies" | "creatures" | "background" | "notes";
const ALL_SECTIONS: { id: SectionId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "abilities", label: "Abilities & Saves" },
  { id: "skills", label: "Skills" },
  { id: "actions", label: "Actions" },
  { id: "spells", label: "Spells" },
  { id: "inventory", label: "Inventory" },
  { id: "features", label: "Features" },
  { id: "proficiencies", label: "Proficiencies" },
  { id: "creatures", label: "Creatures" },
  { id: "background", label: "Background" },
  { id: "notes", label: "Notes" },
];

export function CharacterSheet({ initialCharacter, derived, spellDetails, features, weapons, encumbrance, resources: initialResources, senses, proficiencies, defenses, acBreakdown, canEdit, isDM, isOwner }: {
  initialCharacter: any; derived: DerivedCharacter; spellDetails: any[]; features: any[]; weapons: EquippedWeapon[];
  encumbrance: Encumbrance; resources: MergedResource[]; senses: Senses; proficiencies: Proficiencies;
  defenses: DefensesData; acBreakdown?: string;
  canEdit: boolean; isDM: boolean; isOwner: boolean;
}) {
  const router = useRouter();
  const [c, setC] = useState(initialCharacter);
  const [resources, setResources] = useState<MergedResource[]>(initialResources);
  // Play vs Edit: Play is for USING the character (rolling, HP, slots, conditions,
  // inventory usage). Edit reveals DEFINITION-editing affordances (avatar, level up,
  // add/remove spells & items). Gameplay controls stay available in Play mode.
  const [editMode, setEditMode] = useState(false);
  const canUse = canEdit;                    // gameplay controls (owner/DM)
  const canEditDef = canEdit && editMode;    // definition edits (owner/DM + Edit mode)
  const conditions: string[] = safeArr(c.conditions);
  const xpInfo = xpToNextLevel(c.xp);
  const canLevelUp = levelForXp(c.xp) > derived.totalLevel;

  // ---- Section navigation (persisted in the URL hash, e.g. #spells) ----
  const sections = useMemo(
    () => ALL_SECTIONS.filter((s) => s.id !== "spells" || !!derived.spellcasting),
    [derived.spellcasting],
  );
  const [section, setSection] = useState<SectionId>("overview");
  useEffect(() => {
    const h = window.location.hash.slice(1) as SectionId;
    if (h && sections.some((s) => s.id === h)) setSection(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Register this character as the active roll context so every dice roll (from
  // the sheet, the global tray, or combat) is persisted to its roll log.
  useEffect(() => {
    setRollCharacter(c.id);
    return () => setRollCharacter(null);
  }, [c.id]);
  function selectSection(id: SectionId) {
    setSection(id);
    history.replaceState(null, "", `#${id}`);
  }

  // Compute a weapon's to-hit and damage from derived mods (assume proficiency).
  function weaponAttack(w: EquippedWeapon) {
    const useDex = w.ranged || (w.finesse && derived.mods.dex > derived.mods.str);
    const ab: Ability = useDex ? "dex" : "str";
    const abMod = derived.mods[ab];
    const toHit = abMod + derived.proficiencyBonus;
    const dmgExpr = `${w.damageDice}${formatMod(abMod)}`;
    return { ab, abMod, toHit, dmgExpr };
  }

  // ---- Roll options (SPEC-PLAYER §5.1/§6.3): every click-to-roll consumes the
  // RollOptionsBar state — adv/dis + situational bonus — then (by default) resets it.
  function rollWithOpts(label: string, expr: string) {
    const o = consumeRollOptions();
    rollToTray(decorateRollLabel(label, o), o.bonus !== 0 ? `${expr}${formatMod(o.bonus)}` : expr, {
      advantage: o.advantage, disadvantage: o.disadvantage,
    });
  }
  function attackWithOpts(label: string, toHit: number, dmgExpr: string, dmgType: string) {
    const o = consumeRollOptions();
    rollAttackToTray(decorateRollLabel(label, o), toHit + o.bonus, dmgExpr, dmgType, {
      advantage: o.advantage, disadvantage: o.disadvantage,
    });
  }

  // ---- Pinned skills (SPEC-PLAYER §6.3) — persisted per character in localStorage.
  const [pins, togglePin] = usePinnedSkills(c.id);
  const favoriteSkills = pins.filter((p) => derived.skills[p]);

  useRealtime({
    "character:updated": (p: any) => {
      if (p.characterId !== c.id) return;
      if (p.by && p.by === c.__me) return; // ignore own echo (best effort)
      router.refresh();
    },
  }, [c.id]);

  async function patch(body: any) {
    setC((prev: any) => ({ ...prev, ...body, conditions: body.conditions ? JSON.stringify(body.conditions) : prev.conditions }));
    await fetch(`/api/characters/${c.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  }

  function applyHp(delta: number) {
    const rawDamage = delta < 0 ? -delta : 0;
    let hp = c.currentHp; let temp = c.tempHp;
    if (delta < 0 && temp > 0) { const a = Math.min(temp, -delta); temp -= a; delta += a; }
    hp = Math.max(0, Math.min(derived.maxHp, hp + delta));
    const body: any = { currentHp: hp, tempHp: temp };
    // Healing from 0 clears death saves.
    if (delta > 0 && c.currentHp === 0 && hp > 0) { body.deathSuccess = 0; body.deathFail = 0; }
    // Concentration: taking damage forces a CON save (DC = max(10, half damage)).
    if (rawDamage > 0 && c.concentration) {
      const dc = Math.max(10, Math.floor(rawDamage / 2));
      const save = roll(`1d20${derived.saves.con.value >= 0 ? "+" : ""}${derived.saves.con.value}`);
      const held = hp > 0 && save.total >= dc;
      pushTrayEntry({
        label: `Concentration — ${c.concentration}`,
        dice: save.dice, total: save.total, breakdown: save.breakdown,
        extra: `DC ${dc} CON save`, verdict: held ? "HELD" : "BROKEN", crit: held, fumble: !held,
      });
      if (!held) body.concentration = null;
    }
    patch(body);
  }

  function rollDeathSave() {
    const r = roll("1d20");
    const nat = r.dice[0]?.value ?? r.total;
    let successes = c.deathSuccess, fails = c.deathFail;
    let label = "Death Save", verdict = "";
    const body: any = {};
    if (nat === 20) { // regain 1 HP
      body.currentHp = 1; body.deathSuccess = 0; body.deathFail = 0;
      verdict = "ALIVE! (nat 20)";
    } else if (nat === 1) { // two failures
      fails = Math.min(3, fails + 2); body.deathFail = fails; verdict = "NAT 1 — 2 failures";
    } else if (nat >= 10) {
      successes = Math.min(3, successes + 1); body.deathSuccess = successes;
      verdict = successes >= 3 ? "STABILIZED" : "Success";
    } else {
      fails = Math.min(3, fails + 1); body.deathFail = fails;
      verdict = fails >= 3 ? "DEAD" : "Failure";
    }
    pushTrayEntry({ label, dice: r.dice, total: r.total, breakdown: r.breakdown, extra: `${successes}✓ / ${fails}✗`, verdict, crit: nat === 20, fumble: nat === 1 });
    patch(body);
  }

  function toggleCondition(cond: string) {
    const next = conditions.includes(cond) ? conditions.filter((x) => x !== cond) : [...conditions, cond];
    patch({ conditions: next });
  }

  const [dmg, setDmg] = useState("");
  const [showLevelUp, setShowLevelUp] = useState(false);

  // ---- Spell slots (stored in spellcastingJson) ----
  const slotsUsedMap = parseSlotsUsed(c);
  const pactUsedCount = parsePactUsed(c);
  function spendSlot(level: number) {
    const cur = parseSlotsUsed(c)[level] ?? 0;
    const max = derived.spellcasting?.slots[level - 1] ?? 0;
    if (cur >= max) return;
    patch({ spellcastingJson: setSlotUsed(c, level, cur + 1) });
  }
  function spendPact() {
    const cur = parsePactUsed(c);
    const max = derived.spellcasting?.pact?.slots ?? 0;
    if (cur >= max) return;
    patch({ spellcastingJson: setPactUsed(c, cur + 1) });
  }

  // ---- Class resources ----
  function setResourceUsed(key: string, used: number) {
    const r = resources.find((x) => x.key === key);
    if (!r) return;
    const clamped = Math.max(0, Math.min(r.max, used));
    setResources((prev) => prev.map((x) => (x.key === key ? { ...x, used: clamped } : x)));
    fetch(`/api/characters/${c.id}/resources`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, used: clamped, max: r.max, resetOn: r.resetOn }),
    }).catch(() => {});
  }

  // ---- Rest ----
  async function doRest(type: "SHORT" | "LONG") {
    const res = await fetch(`/api/characters/${c.id}/rest`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type }),
    });
    if (res.ok) {
      const { patch: applied } = await res.json();
      if (applied) setC((prev: any) => ({ ...prev, ...applied }));
      // reset resource usage locally to match the server
      setResources((prev) => prev.map((r) => (type === "LONG" || r.resetOn === "SHORT" ? { ...r, used: 0 } : r)));
    }
  }
  function spendHitDie(_die: number, healed: number) {
    const totalHd = derived.hitDiceTotal.reduce((s, h) => s + h.count, 0);
    if (c.hitDiceUsed >= totalHd) return;
    const hp = Math.min(derived.maxHp, c.currentHp + Math.max(0, healed));
    patch({ hitDiceUsed: c.hitDiceUsed + 1, currentHp: hp });
  }

  function saveDescription(field: string, value: string) {
    patch({ [field]: value || null });
  }

  const saveProfs = ABILITIES.filter((a) => derived.saves[a].proficient).map((a) => a.toUpperCase());
  const skillProfs = Object.entries(derived.skills).filter(([, s]) => s.proficient).map(([name]) => name);
  const totalHitDice = derived.hitDiceTotal.reduce((s, h) => s + h.count, 0);

  // ================================================================
  // Cards — each defined ONCE, referenced by one or more sections.
  // ================================================================

  const renderAbilities = (showFavorites = false) => (
    <div className="card">
      <div className="mb-2 text-xs uppercase text-[#5e5448]">Proficiency Bonus <b className="text-gold">{formatMod(derived.proficiencyBonus)}</b></div>
      <div className="grid grid-cols-3 gap-2">
        {ABILITIES.map((a) => (
          <button key={a} type="button" className="stat-box rollable"
            onClick={() => rollWithOpts(`${ABILITY_LABELS[a]} check`, `1d20${formatMod(derived.mods[a])}`)}
            title={`Roll ${ABILITY_LABELS[a]} check`}>
            <div className="text-[10px] uppercase text-[#5e5448]">{ABILITY_LABELS[a]}</div>
            <div className="font-display text-xl">{formatMod(derived.mods[a])}</div>
            <div className="text-xs text-[#5e5448]">{(c as any)[a]}</div>
          </button>
        ))}
      </div>
      <p className="mt-2 text-center text-[11px] text-[#857866]">Tap an ability to roll a check.</p>
      {showFavorites && favoriteSkills.length > 0 && (
        <div className="hairline mt-3 pt-2">
          <div className="mb-1 text-[10px] uppercase text-[#5e5448]">Favorites</div>
          <div className="flex flex-wrap gap-1.5">
            {favoriteSkills.map((name) => (
              <button key={name} type="button" className="roll-chip roll-chip-sm"
                onClick={() => rollWithOpts(name, `1d20${formatMod(derived.skills[name].value)}`)}
                title={`Roll ${name}`}>
                {name} {formatMod(derived.skills[name].value)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderSaves = () => (
    <div className="card">
      <h3 className="mb-2 font-display text-gold">Saving Throws</h3>
      <div className="grid grid-cols-2 gap-1 text-sm">
        {ABILITIES.map((a) => (
          <button key={a} type="button"
            className="rollable flex justify-between rounded border border-transparent px-2 py-1 text-left"
            onClick={() => rollWithOpts(`${ABILITY_LABELS[a]} save`, `1d20${formatMod(derived.saves[a].value)}`)}
            title={`Roll ${ABILITY_LABELS[a]} save`}>
            <span className={derived.saves[a].proficient ? "text-gold" : ""}>{derived.saves[a].proficient ? "●" : "○"} {a.toUpperCase()}</span>
            <b>{formatMod(derived.saves[a].value)}</b>
          </button>
        ))}
      </div>
    </div>
  );

  const renderSkillRow = (name: string) => {
    const s = derived.skills[name];
    const isPinned = pins.includes(name);
    return (
      <tr key={name} className="rollable" onClick={() => rollWithOpts(name, `1d20${formatMod(s.value)}`)} title={`Roll ${name}`}>
        <td className="w-7">
          <button type="button" className="pin-btn" data-pinned={isPinned || undefined}
            onClick={(e) => { e.stopPropagation(); togglePin(name); }}
            aria-pressed={isPinned} aria-label={isPinned ? `Unpin ${name}` : `Pin ${name}`}
            title={isPinned ? "Unpin from favorites" : "Pin to favorites"}>
            <PinIcon filled={isPinned} />
          </button>
        </td>
        <td className="w-6">{s.expertise ? "◆" : s.proficient ? "●" : "○"}</td>
        <td>{name}</td>
        <td className="text-[#5e5448]">{s.ability.toUpperCase()}</td>
        <td className="text-right"><b>{formatMod(s.value)}</b></td>
      </tr>
    );
  };

  const renderSkills = () => (
    <div className="card">
      <h3 className="mb-2 font-display text-gold">Skills</h3>
      {favoriteSkills.length > 0 && (
        <>
          <div className="skills-minihead">Pinned</div>
          <table className="sheet">
            <tbody>{favoriteSkills.map(renderSkillRow)}</tbody>
          </table>
          <div className="skills-minihead mt-2">All Skills</div>
        </>
      )}
      <table className="sheet">
        <tbody>
          {Object.keys(derived.skills).filter((name) => !favoriteSkills.includes(name)).map(renderSkillRow)}
        </tbody>
      </table>
      <div className="mt-2 flex gap-2 text-xs text-[#5e5448]">
        <span className="chip">Passive Perception {10 + derived.skills.Perception.value}</span>
        <span className="chip">Insight {10 + derived.skills.Insight.value}</span>
      </div>
    </div>
  );

  const renderCombatStats = () => (
    <div className="card grid grid-cols-3 gap-2 text-center">
      <div className="stat-box"><div className="text-[10px] text-[#5e5448]">AC</div><div className="font-display text-2xl text-gold">{derived.ac}</div></div>
      <button type="button" className="stat-box rollable"
        onClick={() => rollWithOpts("Initiative", `1d20${formatMod(derived.initiative)}`)} title="Roll initiative">
        <div className="text-[10px] text-[#5e5448]">Initiative</div><div className="font-display text-2xl">{formatMod(derived.initiative)}</div>
      </button>
      <div className="stat-box"><div className="text-[10px] text-[#5e5448]">Speed</div><div className="font-display text-2xl">{derived.speed}</div></div>
    </div>
  );

  // Actions section (spec §7) — attack rolls funnel through weaponAttack +
  // attackWithOpts so they honor the roll options bar.
  const renderActions = () => (
    <ActionsSection
      weapons={weapons}
      derived={derived}
      canUse={canUse}
      onWeaponAttack={(w) => {
        const atk = weaponAttack(w);
        attackWithOpts(`${w.name} attack`, atk.toHit, atk.dmgExpr, w.damageType);
      }}
    />
  );

  const renderHp = () => (
    <div className="card">
      <div className="mb-1 flex items-end justify-between">
        <h3 className="font-display text-gold">Hit Points</h3>
        <div className="text-sm text-[#5e5448]">Temp: {c.tempHp}</div>
      </div>
      <div className="mb-2 flex items-center justify-center gap-2">
        <span className="font-display text-4xl">{c.currentHp}</span>
        <span className="text-2xl text-[#5e5448]">/ {derived.maxHp}</span>
      </div>
      <div className="h-3 rounded bg-[#e9dfc5]"><div className="h-3 rounded bg-blood" style={{ width: `${Math.round((c.currentHp / derived.maxHp) * 100)}%` }} /></div>
      {canUse && (
        <div className="mt-3 flex gap-2">
          <input className="input" placeholder="Amount" value={dmg} onChange={(e) => setDmg(e.target.value)} inputMode="numeric" />
          <button className="btn-primary" onClick={() => { applyHp(-Math.abs(parseInt(dmg) || 0)); setDmg(""); }}>Damage</button>
          <button className="btn-gold" onClick={() => { applyHp(Math.abs(parseInt(dmg) || 0)); setDmg(""); }}>Heal</button>
          <button className="btn-ghost" onClick={() => patch({ tempHp: Math.abs(parseInt(dmg) || 0) })} title="Temp HP">Temp</button>
        </div>
      )}
      <div className="mt-3 flex items-center justify-between text-sm">
        <div>Hit Dice: {c.hitDiceUsed}/{derived.hitDiceTotal.reduce((s, h) => s + h.count, 0)} ({derived.hitDiceTotal.map((h) => `${h.count}d${h.die}`).join(" ")})</div>
        <div className="flex items-center gap-1">Death:
          <span className="text-green-700">{"✓".repeat(c.deathSuccess)}{"·".repeat(3 - c.deathSuccess)}</span>
          <span className="text-red-700">{"✗".repeat(c.deathFail)}{"·".repeat(3 - c.deathFail)}</span>
        </div>
      </div>
      {canUse && c.currentHp === 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <button className="btn-gold" onClick={rollDeathSave}>🎲 Roll Death Save</button>
          <button className="btn-ghost" onClick={() => patch({ deathSuccess: Math.min(3, c.deathSuccess + 1) })}>+Success</button>
          <button className="btn-ghost" onClick={() => patch({ deathFail: Math.min(3, c.deathFail + 1) })}>+Failure</button>
          <button className="btn-ghost" onClick={() => patch({ deathSuccess: 0, deathFail: 0 })}>Reset</button>
        </div>
      )}
    </div>
  );

  const renderConditions = () => (
    <div className="card">
      <h3 className="mb-2 font-display text-gold">Conditions</h3>
      <div className="flex flex-wrap gap-1">
        {CONDITIONS.map((cond) => (
          <button key={cond} disabled={!canUse} onClick={() => toggleCondition(cond)}
            className={conditions.includes(cond) ? "chip bg-blood text-white" : "chip"}>{cond}</button>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2 text-sm">
        <span>Exhaustion:</span>
        {canUse && <button className="btn-ghost" onClick={() => patch({ exhaustion: Math.max(0, c.exhaustion - 1) })}>−</button>}
        <b className="text-gold">{c.exhaustion}</b>
        {canUse && <button className="btn-ghost" onClick={() => patch({ exhaustion: Math.min(6, c.exhaustion + 1) })}>+</button>}
        <span className="text-xs text-[#5e5448]">{EXHAUSTION_EFFECTS[c.exhaustion]}</span>
      </div>
      {c.concentration && <div className="mt-2 text-sm text-arcane">🔵 Concentrating: {c.concentration}</div>}
    </div>
  );

  const renderRest = () => (
    <RestPanel
      hitDice={derived.hitDiceTotal}
      hitDiceUsed={c.hitDiceUsed}
      conMod={derived.mods.con}
      totalHitDice={totalHitDice}
      canUse={canUse}
      onShortRest={() => doRest("SHORT")}
      onLongRest={() => doRest("LONG")}
      onSpendHitDie={spendHitDie}
    />
  );

  const renderResources = () => (
    <ResourcePanel resources={resources} canUse={canUse} onSetUsed={setResourceUsed} />
  );

  const renderSpells = () => derived.spellcasting && (
    <div className="card">
      <h3 className="mb-2 font-display text-gold">Spells ({derived.spellcasting.casterClass})</h3>
      <div className="flex gap-2 text-sm">
        <span className="chip">Save DC {derived.spellcasting.spellSaveDc}</span>
        <span className="chip">Attack {formatMod(derived.spellcasting.spellAttackBonus)}</span>
        <span className="chip">{derived.spellcasting.abilityLabel}</span>
      </div>
      <div className="mt-3 space-y-1">
        {derived.spellcasting.slots.map((n, i) => n > 0 && (
          <SlotRow key={i} level={i + 1} total={n} used={slotUsed(c, i + 1)} canEdit={canUse}
            onChange={(u) => patch({ spellcastingJson: setSlotUsed(c, i + 1, u) })} />
        ))}
        {derived.spellcasting.pact && (
          <div className="mt-2 text-xs text-arcane">Pact Magic: {derived.spellcasting.pact.slots} slots @ L{derived.spellcasting.pact.level}</div>
        )}
      </div>
      <CastableSpells
        characterId={c.id}
        spells={spellDetails}
        spellcasting={derived.spellcasting}
        slotsUsed={slotsUsedMap}
        pactUsed={pactUsedCount}
        characterLevel={derived.totalLevel}
        abilityMod={derived.mods[derived.spellcasting.ability]}
        canUse={canUse}
        onSpendSlot={spendSlot}
        onSpendPact={spendPact}
      />
      <SpellManager characterId={c.id} spells={spellDetails} casterClass={derived.spellcasting.casterClass} canEdit={canEditDef} canUse={canUse} />
    </div>
  );

  const renderCurrency = () => (
    <div className="card">
      <h3 className="mb-2 font-display text-gold">Currency</h3>
      <div className="grid grid-cols-5 gap-1 text-center text-sm">
        {(["pp","gp","ep","sp","cp"] as const).map((coin) => (
          <div key={coin} className="stat-box">
            <div className="text-[10px] uppercase text-[#5e5448]">{coin}</div>
            {canUse ? (
              <input className="w-full bg-transparent text-center outline-none" type="number" min={0}
                value={(c as any)[coin]} onChange={(e) => setC((p: any) => ({ ...p, [coin]: Math.max(0, +e.target.value) }))}
                onBlur={(e) => patch({ [coin]: Math.max(0, +e.target.value) })} />
            ) : <div>{(c as any)[coin]}</div>}
          </div>
        ))}
      </div>
    </div>
  );

  const renderInventory = () => (
    <InventoryManager characterId={c.id} items={c.items} canEdit={canEditDef} canUse={canUse} carryCapacity={derived.carryCapacity} />
  );

  const renderEncumbrance = () => (
    <div className="card">
      <h3 className="mb-1 font-display text-gold">Encumbrance</h3>
      <EncumbranceBar encumbrance={encumbrance} />
    </div>
  );

  const renderFeatures = () => (
    <div className="card">
      <h3 className="mb-2 font-display text-gold">Features & Traits</h3>
      {features.length === 0 ? <p className="muted text-sm">No features yet.</p> : (
        <div className="grid gap-3 sm:grid-cols-2">
          {features.map((g) => (
            <div key={g.source} className="panel-inset p-3">
              <div className="mb-1 text-xs uppercase tracking-wide text-gold">{g.source}</div>
              <ul className="space-y-1 text-sm">
                {g.items.map((it: any, i: number) => (
                  <li key={i}>
                    <b>{it.level ? `L${it.level} · ` : ""}{it.name}.</b> <span className="muted">{it.description}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderSenses = () => <SensesPanel senses={senses} />;

  const renderProficiencies = () => (
    <ProficienciesPanel proficiencies={proficiencies} saveProfs={saveProfs} skillProfs={skillProfs} />
  );

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-4">
      <CharacterHeader
        c={c} derived={derived}
        canEdit={canEdit} canUse={canUse} canEditDef={canEditDef}
        editMode={editMode} onModeChange={setEditMode}
        xpInfo={xpInfo} canLevelUp={canLevelUp} nextLevel={levelForXp(c.xp)}
        onPatch={patch} onLevelUp={() => setShowLevelUp(true)} onRest={doRest}
      >
        {/* Section bar — sticky together with the compact header bar */}
        <div className="tabbar char-sectionbar" role="tablist" aria-label="Character sections">
          {sections.map((s) => (
            <button key={s.id} type="button" role="tab" className="tab"
              data-active={section === s.id} aria-selected={section === s.id}
              onClick={() => selectSection(s.id)}>{s.label}</button>
          ))}
        </div>
        {/* Roll options (adv/dis + situational) — armed for the next roll, all sections (Play mode) */}
        {!editMode && <RollOptionsBar />}
      </CharacterHeader>

      {canEdit && editMode && (
        <div className="chip-gold flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
          ✎ <b>Edit mode.</b> <span className="muted">Definition controls (avatar, level up, add/remove spells &amp; items) are shown. Switch to Play to use the sheet.</span>
        </div>
      )}

      {showLevelUp && (
        <LevelUpWizard
          characterId={c.id}
          classes={c.classes.map((cl: any) => ({ classId: cl.classId, level: cl.level, subclass: cl.subclass }))}
          abilities={{ str: c.str, dex: c.dex, con: c.con, int: c.int, wis: c.wis, cha: c.cha }}
          onClose={() => setShowLevelUp(false)}
        />
      )}

      {/* ---- Sections ---- */}
      {section === "overview" && (
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <div className="space-y-4">
            {renderAbilities(true)}
            {renderCombatStats()}
            {renderHp()}
          </div>
          <div className="space-y-4">
            {renderRest()}
            {renderResources()}
            {renderConditions()}
          </div>
        </div>
      )}

      {section === "abilities" && (
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <div className="space-y-4">
            {renderAbilities()}
            {renderSenses()}
          </div>
          <div className="space-y-4">
            {renderSaves()}
            <SpeedDefensesPanel
              defenses={defenses}
              walkingSpeed={derived.speed}
              ac={derived.ac}
              acBreakdown={acBreakdown}
              canEdit={canEditDef}
              onSave={(d) => patch({ defensesJson: JSON.stringify(d) })}
            />
          </div>
        </div>
      )}

      {section === "skills" && <div className="max-w-2xl">{renderSkills()}</div>}

      {section === "actions" && <div className="max-w-2xl">{renderActions()}</div>}

      {section === "spells" && <div className="max-w-3xl">{renderSpells()}</div>}

      {section === "inventory" && (
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <div className="space-y-4">
            {renderInventory()}
          </div>
          <div className="space-y-4">
            {renderCurrency()}
            {renderEncumbrance()}
          </div>
        </div>
      )}

      {section === "features" && <div className="max-w-3xl">{renderFeatures()}</div>}

      {section === "proficiencies" && <div className="max-w-2xl">{renderProficiencies()}</div>}

      {section === "creatures" && (
        <div className="max-w-4xl">
          <CompanionsTab characterId={c.id} canEdit={canEditDef} />
        </div>
      )}

      {section === "background" && (
        <DescriptionTab character={c} canEdit={canEditDef} onSave={saveDescription} />
      )}

      {section === "notes" && (
        <div className="max-w-3xl space-y-4">
          <NotesSection characterId={c.id} canUse={canUse} isOwner={isOwner} isDM={isDM} />
          <RollLogPanel characterId={c.id} />
        </div>
      )}

      {isDM && <div className="text-center text-xs text-[#5e5448]">👑 DM Mode — you have full control over this character</div>}
    </main>
  );
}

function SlotRow({ level, total, used, canEdit, onChange }: { level: number; total: number; used: number; canEdit: boolean; onChange: (u: number) => void }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-16 text-[#5e5448]">Level {level}</span>
      <div className="flex gap-1">
        {Array.from({ length: total }).map((_, i) => (
          <button key={i} disabled={!canEdit}
            onClick={() => onChange(i < used ? i : i + 1)}
            className={`h-4 w-4 rounded-full border ${i < used ? "bg-[#e9dfc5] border-[#cdbf9f]" : "bg-gold border-gold"}`}
            title={i < used ? "used" : "available"} />
        ))}
      </div>
      <span className="text-xs text-[#5e5448]">{total - used}/{total}</span>
    </div>
  );
}

// ---- Pinned skills (SPEC-PLAYER §6.3) — persisted in localStorage per character.
function usePinnedSkills(characterId: string): [string[], (name: string) => void] {
  const [pins, setPins] = useState<string[]>([]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`dnd_pins_${characterId}`);
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) setPins(parsed.filter((x) => typeof x === "string"));
    } catch { /* corrupted storage — start empty */ }
  }, [characterId]);
  function togglePin(name: string) {
    setPins((prev) => {
      const next = prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name];
      try { localStorage.setItem(`dnd_pins_${characterId}`, JSON.stringify(next)); } catch { /* storage unavailable */ }
      return next;
    });
  }
  return [pins, togglePin];
}

// Small quill-tack pin (14px inline SVG — filled when pinned).
function PinIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"
      fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 17v5" />
      <path d="M9 10.76V7a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3.76l2.26 2.26c.19.18.29.44.29.7V15a1 1 0 0 1-1 1H7.45a1 1 0 0 1-1-1v-1.27c0-.27.1-.52.29-.71z" />
    </svg>
  );
}

function safeArr(s: any): string[] { try { return typeof s === "string" ? JSON.parse(s) : (s ?? []); } catch { return []; } }
function slotUsed(c: any, level: number): number { try { return (JSON.parse(c.spellcastingJson || "{}").slotsUsed ?? {})[level] ?? 0; } catch { return 0; } }
function parseSlotsUsed(c: any): Record<number, number> { try { return JSON.parse(c.spellcastingJson || "{}").slotsUsed ?? {}; } catch { return {}; } }
function parsePactUsed(c: any): number { try { return JSON.parse(c.spellcastingJson || "{}").pactUsed ?? 0; } catch { return 0; } }
function setPactUsed(c: any, used: number): string {
  let obj: any = {}; try { obj = JSON.parse(c.spellcastingJson || "{}"); } catch {}
  obj.pactUsed = used;
  return JSON.stringify(obj);
}
function setSlotUsed(c: any, level: number, used: number): string {
  let obj: any = {}; try { obj = JSON.parse(c.spellcastingJson || "{}"); } catch {}
  obj.slotsUsed = { ...(obj.slotsUsed ?? {}), [level]: used };
  return JSON.stringify(obj);
}
