"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ABILITIES, ABILITY_LABELS, formatMod, EXHAUSTION_EFFECTS, type Ability } from "@/lib/dnd/rules";
import { xpToNextLevel, levelForXp } from "@/lib/dnd/rules";
import type { DerivedCharacter } from "@/lib/dnd/character";
import { useRealtime } from "@/lib/realtime/useRealtime";
import { InventoryManager } from "./InventoryManager";
import { SpellManager } from "./SpellManager";

const CONDITIONS = ["Blinded","Charmed","Deafened","Frightened","Grappled","Incapacitated","Invisible","Paralyzed","Petrified","Poisoned","Prone","Restrained","Stunned","Unconscious"];

export function CharacterSheet({ initialCharacter, derived, spellDetails, canEdit, isDM }: {
  initialCharacter: any; derived: DerivedCharacter; spellDetails: any[]; canEdit: boolean; isDM: boolean;
}) {
  const router = useRouter();
  const [c, setC] = useState(initialCharacter);
  const conditions: string[] = safeArr(c.conditions);
  const xpInfo = xpToNextLevel(c.xp);
  const canLevelUp = levelForXp(c.xp) > derived.totalLevel;

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

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-4">
      {/* Header */}
      <div className="card flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-gold">{c.name}</h1>
          <div className="text-sm text-[#a9977c]">
            {c.raceId}{c.subrace ? ` (${c.subrace})` : ""} · {c.classes.map((cl: any) => `${cl.classId} ${cl.level}`).join(" / ")} · {c.background} · {c.alignment}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-center">
            <div className="text-xs text-[#a9977c]">רמה</div>
            <div className="font-display text-2xl text-gold">{derived.totalLevel}</div>
          </div>
          <div className="min-w-[160px]">
            <div className="flex justify-between text-xs text-[#a9977c]"><span>XP</span><span>{c.xp}{xpInfo.next ? ` / ${xpInfo.next}` : ""}</span></div>
            <div className="mt-1 h-2 rounded bg-[#0f0c0a]"><div className="h-2 rounded bg-gold" style={{ width: `${xpInfo.pct}%` }} /></div>
            {canLevelUp && <div className="mt-1 text-xs text-green-400">⬆ עליית רמה זמינה (L{levelForXp(c.xp)})</div>}
          </div>
          <button onClick={() => canEdit && patch({ inspiration: !c.inspiration })}
            className={c.inspiration ? "btn-gold" : "btn-ghost"} title="Inspiration">💡</button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Left column: abilities + saves + skills */}
        <div className="space-y-4">
          <div className="card">
            <div className="mb-2 text-xs uppercase text-[#a9977c]">Proficiency Bonus <b className="text-gold">{formatMod(derived.proficiencyBonus)}</b></div>
            <div className="grid grid-cols-3 gap-2">
              {ABILITIES.map((a) => (
                <div key={a} className="stat-box">
                  <div className="text-[10px] uppercase text-[#a9977c]">{ABILITY_LABELS[a]}</div>
                  <div className="font-display text-xl">{formatMod(derived.mods[a])}</div>
                  <div className="text-xs text-[#a9977c]">{(c as any)[a]}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <h3 className="mb-2 font-display text-gold">הצלות (Saving Throws)</h3>
            <div className="grid grid-cols-2 gap-1 text-sm">
              {ABILITIES.map((a) => (
                <div key={a} className="flex justify-between px-2 py-1">
                  <span className={derived.saves[a].proficient ? "text-gold" : ""}>{derived.saves[a].proficient ? "●" : "○"} {a.toUpperCase()}</span>
                  <b>{formatMod(derived.saves[a].value)}</b>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <h3 className="mb-2 font-display text-gold">מיומנויות (Skills)</h3>
            <table className="sheet">
              <tbody>
                {Object.entries(derived.skills).map(([name, s]) => (
                  <tr key={name}>
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
            <div className="stat-box"><div className="text-[10px] text-[#a9977c]">Initiative</div><div className="font-display text-2xl">{formatMod(derived.initiative)}</div></div>
            <div className="stat-box"><div className="text-[10px] text-[#a9977c]">Speed</div><div className="font-display text-2xl">{derived.speed}</div></div>
          </div>

          <div className="card">
            <div className="mb-1 flex items-end justify-between">
              <h3 className="font-display text-gold">נקודות פגיעה</h3>
              <div className="text-sm text-[#a9977c]">Temp: {c.tempHp}</div>
            </div>
            <div className="mb-2 flex items-center justify-center gap-2">
              <span className="font-display text-4xl">{c.currentHp}</span>
              <span className="text-2xl text-[#a9977c]">/ {derived.maxHp}</span>
            </div>
            <div className="h-3 rounded bg-[#0f0c0a]"><div className="h-3 rounded bg-blood" style={{ width: `${Math.round((c.currentHp / derived.maxHp) * 100)}%` }} /></div>
            {canEdit && (
              <div className="mt-3 flex gap-2">
                <input className="input" placeholder="כמות" value={dmg} onChange={(e) => setDmg(e.target.value)} inputMode="numeric" />
                <button className="btn-primary" onClick={() => { applyHp(-Math.abs(parseInt(dmg) || 0)); setDmg(""); }}>נזק</button>
                <button className="btn-gold" onClick={() => { applyHp(Math.abs(parseInt(dmg) || 0)); setDmg(""); }}>ריפוי</button>
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
            {canEdit && c.currentHp === 0 && (
              <div className="mt-2 flex gap-2 text-xs">
                <button className="btn-ghost" onClick={() => patch({ deathSuccess: Math.min(3, c.deathSuccess + 1) })}>+הצלחה</button>
                <button className="btn-ghost" onClick={() => patch({ deathFail: Math.min(3, c.deathFail + 1) })}>+כישלון</button>
                <button className="btn-ghost" onClick={() => patch({ deathSuccess: 0, deathFail: 0 })}>איפוס</button>
              </div>
            )}
          </div>

          <div className="card">
            <h3 className="mb-2 font-display text-gold">מצבים (Conditions)</h3>
            <div className="flex flex-wrap gap-1">
              {CONDITIONS.map((cond) => (
                <button key={cond} disabled={!canEdit} onClick={() => toggleCondition(cond)}
                  className={conditions.includes(cond) ? "chip bg-blood text-white" : "chip"}>{cond}</button>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2 text-sm">
              <span>Exhaustion:</span>
              {canEdit && <button className="btn-ghost" onClick={() => patch({ exhaustion: Math.max(0, c.exhaustion - 1) })}>−</button>}
              <b className="text-gold">{c.exhaustion}</b>
              {canEdit && <button className="btn-ghost" onClick={() => patch({ exhaustion: Math.min(6, c.exhaustion + 1) })}>+</button>}
              <span className="text-xs text-[#a9977c]">{EXHAUSTION_EFFECTS[c.exhaustion]}</span>
            </div>
            {c.concentration && <div className="mt-2 text-sm text-arcane">🔵 Concentrating: {c.concentration}</div>}
          </div>
        </div>

        {/* Right column: spells + currency */}
        <div className="space-y-4">
          {derived.spellcasting && (
            <div className="card">
              <h3 className="mb-2 font-display text-gold">קסמים ({derived.spellcasting.casterClass})</h3>
              <div className="flex gap-2 text-sm">
                <span className="chip">Save DC {derived.spellcasting.spellSaveDc}</span>
                <span className="chip">Attack {formatMod(derived.spellcasting.spellAttackBonus)}</span>
                <span className="chip">{derived.spellcasting.abilityLabel}</span>
              </div>
              <div className="mt-3 space-y-1">
                {derived.spellcasting.slots.map((n, i) => n > 0 && (
                  <SlotRow key={i} level={i + 1} total={n} used={slotUsed(c, i + 1)} canEdit={canEdit}
                    onChange={(u) => patch({ spellcastingJson: setSlotUsed(c, i + 1, u) })} />
                ))}
                {derived.spellcasting.pact && (
                  <div className="mt-2 text-xs text-arcane">Pact Magic: {derived.spellcasting.pact.slots} slots @ L{derived.spellcasting.pact.level}</div>
                )}
              </div>
              <SpellManager characterId={c.id} spells={spellDetails} casterClass={derived.spellcasting.casterClass} canEdit={canEdit} />
            </div>
          )}

          <div className="card">
            <h3 className="mb-2 font-display text-gold">מטבעות</h3>
            <div className="grid grid-cols-5 gap-1 text-center text-sm">
              {(["pp","gp","ep","sp","cp"] as const).map((coin) => (
                <div key={coin} className="stat-box">
                  <div className="text-[10px] uppercase text-[#a9977c]">{coin}</div>
                  {canEdit ? (
                    <input className="w-full bg-transparent text-center outline-none" type="number" min={0}
                      value={(c as any)[coin]} onChange={(e) => setC((p: any) => ({ ...p, [coin]: Math.max(0, +e.target.value) }))}
                      onBlur={(e) => patch({ [coin]: Math.max(0, +e.target.value) })} />
                  ) : <div>{(c as any)[coin]}</div>}
                </div>
              ))}
            </div>
          </div>

          <InventoryManager characterId={c.id} items={c.items} canEdit={canEdit} carryCapacity={derived.carryCapacity} />
        </div>
      </div>
      {isDM && <div className="text-center text-xs text-[#a9977c]">👑 מצב DM — יש לך שליטה מלאה על דמות זו</div>}
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
