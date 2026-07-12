"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ABILITIES, ABILITY_LABELS, formatMod, EXHAUSTION_EFFECTS, type Ability } from "@/lib/dnd/rules";
import { xpToNextLevel, levelForXp } from "@/lib/dnd/rules";
import type { DerivedCharacter } from "@/lib/dnd/character";
import { useRealtime } from "@/lib/realtime/useRealtime";
import { InventoryManager } from "./InventoryManager";
import { SpellManager } from "./SpellManager";
import { LevelUpWizard } from "./LevelUpWizard";
import { rollToTray, rollAttackToTray } from "@/components/DiceTray";
import type { EquippedWeapon } from "@/lib/character-view";

const CONDITIONS = ["Blinded","Charmed","Deafened","Frightened","Grappled","Incapacitated","Invisible","Paralyzed","Petrified","Poisoned","Prone","Restrained","Stunned","Unconscious"];

export function CharacterSheet({ initialCharacter, derived, spellDetails, features, weapons, canEdit, isDM }: {
  initialCharacter: any; derived: DerivedCharacter; spellDetails: any[]; features: any[]; weapons: EquippedWeapon[]; canEdit: boolean; isDM: boolean;
}) {
  const router = useRouter();
  const [c, setC] = useState(initialCharacter);
  // Play vs Edit: Play is for USING the character (rolling, HP, slots, conditions,
  // inventory usage). Edit reveals DEFINITION-editing affordances (avatar, level up,
  // add/remove spells & items). Gameplay controls stay available in Play mode.
  const [editMode, setEditMode] = useState(false);
  const canUse = canEdit;                    // gameplay controls (owner/DM)
  const canEditDef = canEdit && editMode;    // definition edits (owner/DM + Edit mode)
  const conditions: string[] = safeArr(c.conditions);
  const xpInfo = xpToNextLevel(c.xp);
  const canLevelUp = levelForXp(c.xp) > derived.totalLevel;

  // Compute a weapon's to-hit and damage from derived mods (assume proficiency).
  function weaponAttack(w: EquippedWeapon) {
    const useDex = w.ranged || (w.finesse && derived.mods.dex > derived.mods.str);
    const ab: Ability = useDex ? "dex" : "str";
    const abMod = derived.mods[ab];
    const toHit = abMod + derived.proficiencyBonus;
    const dmgExpr = `${w.damageDice}${formatMod(abMod)}`;
    return { ab, abMod, toHit, dmgExpr };
  }

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
    let hp = c.currentHp; let temp = c.tempHp;
    if (delta < 0 && temp > 0) { const a = Math.min(temp, -delta); temp -= a; delta += a; }
    hp = Math.max(0, Math.min(derived.maxHp, hp + delta));
    patch({ currentHp: hp, tempHp: temp });
  }

  function toggleCondition(cond: string) {
    const next = conditions.includes(cond) ? conditions.filter((x) => x !== cond) : [...conditions, cond];
    patch({ conditions: next });
  }

  const [dmg, setDmg] = useState("");
  const [showLevelUp, setShowLevelUp] = useState(false);

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-4">
      {/* Header */}
      <div className="card flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => { if (!canEditDef) return; const url = window.prompt("Avatar image URL (blank to clear):", c.avatarUrl ?? ""); if (url !== null) patch({ avatarUrl: url || null }); }}
            className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#3a2f24] bg-[#0f0c0a] text-2xl"
            title={canEditDef ? "Set avatar" : undefined} aria-label="Avatar">
            {c.avatarUrl ? <img src={c.avatarUrl} alt="" className="h-full w-full object-cover" /> : "🧙"}
          </button>
          <div>
            <h1 className="font-display text-2xl text-gold">{c.name}</h1>
            <div className="text-sm text-[#a9977c]">
              {c.raceId}{c.subrace ? ` (${c.subrace})` : ""} · {c.classes.map((cl: any) => `${cl.classId} ${cl.level}${cl.subclass ? ` (${cl.subclass})` : ""}`).join(" / ")} · {c.background} · {c.alignment}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {canEdit && (
            <div className="tabbar rounded-full border border-[#3a2f24] p-0.5" role="group" aria-label="Sheet mode">
              <button type="button" onClick={() => setEditMode(false)}
                className="tab" data-active={!editMode} aria-pressed={!editMode} title="Use the character">▶ Play</button>
              <button type="button" onClick={() => setEditMode(true)}
                className="tab" data-active={editMode} aria-pressed={editMode} title="Edit the character definition">✎ Edit</button>
            </div>
          )}
          <div className="text-center">
            <div className="text-xs text-[#a9977c]">Level</div>
            <div className="font-display text-2xl text-gold">{derived.totalLevel}</div>
          </div>
          <div className="min-w-[160px]">
            <div className="flex justify-between text-xs text-[#a9977c]"><span>XP</span><span>{c.xp}{xpInfo.next ? ` / ${xpInfo.next}` : ""}</span></div>
            <div className="mt-1 h-2 rounded bg-[#0f0c0a]"><div className="h-2 rounded bg-gold" style={{ width: `${xpInfo.pct}%` }} /></div>
            {canLevelUp && <div className="mt-1 text-xs text-green-400">⬆ Level up available (L{levelForXp(c.xp)})</div>}
          </div>
          {canEditDef && <button onClick={() => setShowLevelUp(true)} className={canLevelUp ? "btn-gold" : "btn-ghost"} title="Level Up">⬆ Level Up</button>}
          <button onClick={() => canUse && patch({ inspiration: !c.inspiration })}
            className={c.inspiration ? "btn-gold" : "btn-ghost"} title="Inspiration">💡</button>
          <a href={`/api/characters/${c.id}/export`} className="btn-ghost" title="Export JSON" download>⬇</a>
        </div>
      </div>
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

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Left column: abilities + saves + skills */}
        <div className="space-y-4">
          <div className="card">
            <div className="mb-2 text-xs uppercase text-[#a9977c]">Proficiency Bonus <b className="text-gold">{formatMod(derived.proficiencyBonus)}</b></div>
            <div className="grid grid-cols-3 gap-2">
              {ABILITIES.map((a) => (
                <button key={a} type="button" className="stat-box rollable"
                  onClick={() => rollToTray(`${ABILITY_LABELS[a]} check`, `1d20${formatMod(derived.mods[a])}`)}
                  title={`Roll ${ABILITY_LABELS[a]} check`}>
                  <div className="text-[10px] uppercase text-[#a9977c]">{ABILITY_LABELS[a]}</div>
                  <div className="font-display text-xl">{formatMod(derived.mods[a])}</div>
                  <div className="text-xs text-[#a9977c]">{(c as any)[a]}</div>
                </button>
              ))}
            </div>
            <p className="mt-2 text-center text-[11px] text-[#7d6f5c]">Tap an ability to roll a check.</p>
          </div>

          <div className="card">
            <h3 className="mb-2 font-display text-gold">Saving Throws</h3>
            <div className="grid grid-cols-2 gap-1 text-sm">
              {ABILITIES.map((a) => (
                <button key={a} type="button"
                  className="rollable flex justify-between rounded border border-transparent px-2 py-1 text-left"
                  onClick={() => rollToTray(`${ABILITY_LABELS[a]} save`, `1d20${formatMod(derived.saves[a].value)}`)}
                  title={`Roll ${ABILITY_LABELS[a]} save`}>
                  <span className={derived.saves[a].proficient ? "text-gold" : ""}>{derived.saves[a].proficient ? "●" : "○"} {a.toUpperCase()}</span>
                  <b>{formatMod(derived.saves[a].value)}</b>
                </button>
              ))}
            </div>
          </div>

          <div className="card">
            <h3 className="mb-2 font-display text-gold">Skills</h3>
            <table className="sheet">
              <tbody>
                {Object.entries(derived.skills).map(([name, s]) => (
                  <tr key={name} className="rollable" onClick={() => rollToTray(name, `1d20${formatMod(s.value)}`)} title={`Roll ${name}`}>
                    <td className="w-6">{s.expertise ? "◆" : s.proficient ? "●" : "○"}</td>
                    <td>{name}</td>
                    <td className="text-[#a9977c]">{s.ability.toUpperCase()}</td>
                    <td className="text-right"><b>{formatMod(s.value)}</b></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-2 flex gap-2 text-xs text-[#a9977c]">
              <span className="chip">Passive Perception {10 + derived.skills.Perception.value}</span>
              <span className="chip">Insight {10 + derived.skills.Insight.value}</span>
            </div>
          </div>
        </div>

        {/* Middle column: combat */}
        <div className="space-y-4">
          <div className="card grid grid-cols-3 gap-2 text-center">
            <div className="stat-box"><div className="text-[10px] text-[#a9977c]">AC</div><div className="font-display text-2xl text-gold">{derived.ac}</div></div>
            <button type="button" className="stat-box rollable"
              onClick={() => rollToTray("Initiative", `1d20${formatMod(derived.initiative)}`)} title="Roll initiative">
              <div className="text-[10px] text-[#a9977c]">Initiative</div><div className="font-display text-2xl">{formatMod(derived.initiative)}</div>
            </button>
            <div className="stat-box"><div className="text-[10px] text-[#a9977c]">Speed</div><div className="font-display text-2xl">{derived.speed}</div></div>
          </div>

          <div className="card">
            <h3 className="mb-1 font-display text-gold">Attacks</h3>
            <p className="mb-2 text-[11px] text-[#7d6f5c]">Tap an attack to roll to-hit and damage.</p>
            {weapons.length === 0 ? (
              <p className="text-sm text-[#a9977c]">No weapons equipped. Equip one in your inventory.</p>
            ) : (
              <div className="space-y-1 text-sm">
                {weapons.map((w, i) => {
                  const atk = weaponAttack(w);
                  return (
                    <button key={i} type="button"
                      className="rollable flex w-full items-center justify-between gap-2 rounded border border-transparent px-2 py-1.5 text-left"
                      onClick={() => rollAttackToTray(`${w.name} attack`, atk.toHit, atk.dmgExpr, w.damageType)}
                      title={`Attack with ${w.name}`}>
                      <span>
                        <b>{w.name}</b>{" "}
                        <span className="text-[11px] text-[#7d6f5c]">· {w.ranged ? "Ranged" : "Melee"}{w.properties ? ` · ${w.properties}` : ""}</span>
                      </span>
                      <span className="flex items-center gap-3 whitespace-nowrap">
                        <span>{formatMod(atk.toHit)} <span className="text-[10px] text-[#7d6f5c]">hit</span></span>
                        <span className="text-gold">{w.damageDice}{formatMod(atk.abMod)} {w.damageType}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="card">
            <div className="mb-1 flex items-end justify-between">
              <h3 className="font-display text-gold">Hit Points</h3>
              <div className="text-sm text-[#a9977c]">Temp: {c.tempHp}</div>
            </div>
            <div className="mb-2 flex items-center justify-center gap-2">
              <span className="font-display text-4xl">{c.currentHp}</span>
              <span className="text-2xl text-[#a9977c]">/ {derived.maxHp}</span>
            </div>
            <div className="h-3 rounded bg-[#0f0c0a]"><div className="h-3 rounded bg-blood" style={{ width: `${Math.round((c.currentHp / derived.maxHp) * 100)}%` }} /></div>
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
                <span className="text-green-400">{"✓".repeat(c.deathSuccess)}{"·".repeat(3 - c.deathSuccess)}</span>
                <span className="text-red-400">{"✗".repeat(c.deathFail)}{"·".repeat(3 - c.deathFail)}</span>
              </div>
            </div>
            {canUse && c.currentHp === 0 && (
              <div className="mt-2 flex gap-2 text-xs">
                <button className="btn-ghost" onClick={() => patch({ deathSuccess: Math.min(3, c.deathSuccess + 1) })}>+Success</button>
                <button className="btn-ghost" onClick={() => patch({ deathFail: Math.min(3, c.deathFail + 1) })}>+Failure</button>
                <button className="btn-ghost" onClick={() => patch({ deathSuccess: 0, deathFail: 0 })}>Reset</button>
              </div>
            )}
          </div>

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
              <span className="text-xs text-[#a9977c]">{EXHAUSTION_EFFECTS[c.exhaustion]}</span>
            </div>
            {c.concentration && <div className="mt-2 text-sm text-arcane">🔵 Concentrating: {c.concentration}</div>}
          </div>
        </div>

        {/* Right column: spells + currency */}
        <div className="space-y-4">
          {derived.spellcasting && (
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
              <SpellManager characterId={c.id} spells={spellDetails} casterClass={derived.spellcasting.casterClass} canEdit={canEditDef} canUse={canUse} />
            </div>
          )}

          <div className="card">
            <h3 className="mb-2 font-display text-gold">Currency</h3>
            <div className="grid grid-cols-5 gap-1 text-center text-sm">
              {(["pp","gp","ep","sp","cp"] as const).map((coin) => (
                <div key={coin} className="stat-box">
                  <div className="text-[10px] uppercase text-[#a9977c]">{coin}</div>
                  {canUse ? (
                    <input className="w-full bg-transparent text-center outline-none" type="number" min={0}
                      value={(c as any)[coin]} onChange={(e) => setC((p: any) => ({ ...p, [coin]: Math.max(0, +e.target.value) }))}
                      onBlur={(e) => patch({ [coin]: Math.max(0, +e.target.value) })} />
                  ) : <div>{(c as any)[coin]}</div>}
                </div>
              ))}
            </div>
          </div>

          <InventoryManager characterId={c.id} items={c.items} canEdit={canEditDef} canUse={canUse} carryCapacity={derived.carryCapacity} />
        </div>
      </div>

      {/* Features & Traits */}
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

      {isDM && <div className="text-center text-xs text-[#a9977c]">👑 DM Mode — you have full control over this character</div>}
    </main>
  );
}

function SlotRow({ level, total, used, canEdit, onChange }: { level: number; total: number; used: number; canEdit: boolean; onChange: (u: number) => void }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-16 text-[#a9977c]">Level {level}</span>
      <div className="flex gap-1">
        {Array.from({ length: total }).map((_, i) => (
          <button key={i} disabled={!canEdit}
            onClick={() => onChange(i < used ? i : i + 1)}
            className={`h-4 w-4 rounded-full border ${i < used ? "bg-[#0f0c0a] border-[#3a2f24]" : "bg-gold border-gold"}`}
            title={i < used ? "used" : "available"} />
        ))}
      </div>
      <span className="text-xs text-[#a9977c]">{total - used}/{total}</span>
    </div>
  );
}

function safeArr(s: any): string[] { try { return typeof s === "string" ? JSON.parse(s) : (s ?? []); } catch { return []; } }
function slotUsed(c: any, level: number): number { try { return (JSON.parse(c.spellcastingJson || "{}").slotsUsed ?? {})[level] ?? 0; } catch { return 0; } }
function setSlotUsed(c: any, level: number, used: number): string {
  let obj: any = {}; try { obj = JSON.parse(c.spellcastingJson || "{}"); } catch {}
  obj.slotsUsed = { ...(obj.slotsUsed ?? {}), [level]: used };
  return JSON.stringify(obj);
}
