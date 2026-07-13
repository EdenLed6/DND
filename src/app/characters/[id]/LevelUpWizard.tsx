"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { HIT_DIE, asiLevels, subclassLevel, MULTICLASS_PREREQ, ABILITIES, ABILITY_LABELS, type Ability } from "@/lib/dnd/rules";

interface Klass { id: number; name: string; hitDie: number; subclasses: { name: string }[] | string[]; }

export function LevelUpWizard({ characterId, classes, abilities, onClose }: {
  characterId: string;
  classes: { classId: string; level: number; subclass?: string | null }[];
  abilities: Record<Ability, number>;
  onClose: () => void;
}) {
  const router = useRouter();
  const [options, setOptions] = useState<Klass[]>([]);
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [className, setClassName] = useState(classes[0]?.classId ?? "");
  const [hpMode, setHpMode] = useState<"average" | "roll" | "max">("average");
  const [hpRoll, setHpRoll] = useState<number | null>(null);
  const [subclass, setSubclass] = useState("");
  const [asiMode, setAsiMode] = useState<"none" | "asi" | "feat">("none");
  const [asi, setAsi] = useState<Record<string, number>>({});
  const [featName, setFeatName] = useState("");
  const [featDesc, setFeatDesc] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { fetch("/api/srd/character-options").then((r) => r.json()).then((d) => setOptions(d.classes)); }, []);

  const existing = classes.find((c) => c.classId === className);
  const targetLevel = mode === "new" ? 1 : (existing ? existing.level + 1 : 1);
  const die = HIT_DIE[className] ?? 8;
  const avg = Math.floor(die / 2) + 1;
  const klassOpt = options.find((o) => o.name === className);
  const subNames: string[] = (klassOpt?.subclasses ?? []).map((s: any) => typeof s === "string" ? s : s.name).filter(Boolean);

  const needsSubclass = targetLevel >= subclassLevel(className) && !(existing?.subclass) && (mode === "existing");
  const isAsiLevel = mode === "existing" && asiLevels(className).includes(targetLevel);
  const asiPoints = Object.values(asi).reduce((s, v) => s + v, 0);

  // multiclass prerequisite check
  const prereq = mode === "new" ? MULTICLASS_PREREQ[className] : null;
  const prereqOk = !prereq || Object.entries(prereq).every(([k, v]) => abilities[k as Ability] >= (v as number));

  const canSubmit = className &&
    (!needsSubclass || subclass) &&
    (!isAsiLevel || asiMode !== "asi" || asiPoints === 2) &&
    (!isAsiLevel || asiMode !== "feat" || featName) &&
    (mode !== "new" || prereqOk);

  async function submit() {
    setBusy(true); setError(null);
    const body: any = {
      className, isNewClass: mode === "new", hpMode,
      hpRoll: hpMode === "roll" ? (hpRoll ?? avg) : undefined,
      subclass: needsSubclass ? subclass : undefined,
    };
    if (isAsiLevel && asiMode === "asi") body.asi = asi;
    if (isAsiLevel && asiMode === "feat") body.feat = { name: featName, description: featDesc };
    const r = await fetch(`/api/characters/${characterId}/levelup`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    setBusy(false);
    if (!r.ok) { setError((await r.json()).error ?? "Level up failed"); return; }
    onClose(); router.refresh();
  }

  function bumpAsi(a: Ability, delta: number) {
    setAsi((cur) => {
      const next = { ...cur };
      const val = (next[a] ?? 0) + delta;
      if (val <= 0) delete next[a]; else next[a] = Math.min(2, val);
      // cap total 2
      const total = Object.values(next).reduce((s, v) => s + v, 0);
      if (total > 2) return cur;
      if ((abilities[a] + (next[a] ?? 0)) > 20) return cur;
      return next;
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="card max-h-[85vh] w-full max-w-lg overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-lg text-gold">⬆ Level Up</h3>
          <button className="btn-ghost !py-0.5" onClick={onClose}>Close</button>
        </div>

        {/* Class choice */}
        <label className="label">Class</label>
        <div className="mb-2 flex gap-2">
          <button className={mode === "existing" ? "btn-gold" : "btn-ghost"} onClick={() => { setMode("existing"); setClassName(classes[0]?.classId ?? ""); }}>Level existing</button>
          <button className={mode === "new" ? "btn-gold" : "btn-ghost"} onClick={() => { setMode("new"); setClassName(""); }}>Multiclass</button>
        </div>
        {mode === "existing" ? (
          <div className="mb-3 flex flex-wrap gap-2">
            {classes.map((c) => (
              <button key={c.classId} className={className === c.classId ? "btn-gold" : "btn-ghost"} onClick={() => setClassName(c.classId)}>
                {c.classId} {c.level} → {c.level + 1}
              </button>
            ))}
          </div>
        ) : (
          <select className="input mb-1" value={className} onChange={(e) => setClassName(e.target.value)}>
            <option value="">— choose a class —</option>
            {options.filter((o) => !classes.some((c) => c.classId === o.name)).map((o) => <option key={o.id} value={o.name}>{o.name}</option>)}
          </select>
        )}
        {mode === "new" && className && !prereqOk && (
          <p className="mb-2 text-xs text-red-700">Prerequisite not met: {Object.entries(prereq!).map(([k, v]) => `${k.toUpperCase()} ${v}`).join(", ")}</p>
        )}

        {className && (
          <>
            <div className="mb-3 text-sm text-[#5e5448]">Target: {className} level {targetLevel} · Hit die d{die}</div>

            {/* HP */}
            <label className="label">Hit Points gained</label>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <button className={hpMode === "average" ? "btn-gold" : "btn-ghost"} onClick={() => setHpMode("average")}>Average ({avg})</button>
              <button className={hpMode === "roll" ? "btn-gold" : "btn-ghost"} onClick={() => setHpMode("roll")}>Roll d{die}</button>
              <button className={hpMode === "max" ? "btn-gold" : "btn-ghost"} onClick={() => setHpMode("max")}>Max ({die})</button>
              {hpMode === "roll" && (
                <>
                  <button className="btn-primary" onClick={() => setHpRoll(Math.floor(Math.random() * die) + 1)}>🎲 Roll</button>
                  {hpRoll != null && <span className="chip text-gold">Rolled: {hpRoll}</span>}
                </>
              )}
              <span className="text-xs text-[#5e5448]">(+ CON modifier)</span>
            </div>

            {/* Subclass */}
            {needsSubclass && (
              <>
                <label className="label">Choose Subclass (required at level {subclassLevel(className)})</label>
                {subNames.length > 0 ? (
                  <select className="input mb-3" value={subclass} onChange={(e) => setSubclass(e.target.value)}>
                    <option value="">— choose —</option>
                    {subNames.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                ) : (
                  <input className="input mb-3" placeholder="Subclass name" value={subclass} onChange={(e) => setSubclass(e.target.value)} />
                )}
              </>
            )}

            {/* ASI / Feat */}
            {isAsiLevel && (
              <div className="mb-3 rounded border border-[#cdbf9f] p-2">
                <div className="mb-2 flex gap-2">
                  <span className="text-sm text-gold">Ability Score Improvement</span>
                  <button className={asiMode === "asi" ? "btn-gold !py-0.5" : "btn-ghost !py-0.5"} onClick={() => setAsiMode("asi")}>+2 Abilities</button>
                  <button className={asiMode === "feat" ? "btn-gold !py-0.5" : "btn-ghost !py-0.5"} onClick={() => setAsiMode("feat")}>Feat</button>
                  <button className={asiMode === "none" ? "btn-gold !py-0.5" : "btn-ghost !py-0.5"} onClick={() => setAsiMode("none")}>Skip</button>
                </div>
                {asiMode === "asi" && (
                  <div>
                    <div className="mb-1 text-xs text-[#5e5448]">Distribute 2 points ({asiPoints}/2 used), max 20 each</div>
                    <div className="grid grid-cols-3 gap-1">
                      {ABILITIES.map((a) => (
                        <div key={a} className="stat-box">
                          <div className="text-[10px] uppercase text-[#5e5448]">{ABILITY_LABELS[a]}</div>
                          <div className="flex items-center gap-1">
                            <button className="chip" onClick={() => bumpAsi(a, -1)}>−</button>
                            <span>{abilities[a] + (asi[a] ?? 0)}</span>
                            <button className="chip" onClick={() => bumpAsi(a, 1)}>+</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {asiMode === "feat" && (
                  <div className="space-y-1">
                    <input className="input" placeholder="Feat name (e.g. Great Weapon Master)" value={featName} onChange={(e) => setFeatName(e.target.value)} />
                    <textarea className="input" placeholder="Feat description (optional)" value={featDesc} onChange={(e) => setFeatDesc(e.target.value)} />
                  </div>
                )}
              </div>
            )}

            {error && <p className="mb-2 text-sm text-red-700">{error}</p>}
            <button className="btn-primary w-full" disabled={!canSubmit || busy} onClick={submit}>
              {busy ? "Applying..." : `Confirm — ${className} ${targetLevel}`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
