"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { abilityMod, formatMod, ABILITIES, type Ability } from "@/lib/dnd/rules";

interface Race { id: number; name: string; size: string; speed: number; abilityBonuses: { ability: string; bonus: number }[]; traits: { name: string; description: string }[]; languages: string; subraces: any[]; }
interface Klass { id: number; name: string; hitDie: number; savingThrows: string[]; proficiencies: { skills?: { choose: number; from: string[] } }; spellcastingAbility: string | null; }
interface Bg { id: number; name: string; skills: string[]; featureName: string; featureDesc: string; startGp: number; }

const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];
const POINT_COST: Record<number, number> = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };

export function CharacterWizard({ campaignId }: { campaignId: string | null }) {
  const router = useRouter();
  const [opts, setOpts] = useState<{ races: Race[]; classes: Klass[]; backgrounds: Bg[] } | null>(null);
  const [name, setName] = useState("");
  const [alignment, setAlignment] = useState("True Neutral");
  const [raceId, setRaceId] = useState<number | null>(null);
  const [classId, setClassId] = useState<number | null>(null);
  const [bgId, setBgId] = useState<number | null>(null);
  const [method, setMethod] = useState<"standard" | "pointbuy" | "manual">("standard");
  const [base, setBase] = useState<Record<Ability, number>>({ str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 });
  const [skills, setSkills] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { fetch("/api/srd/character-options").then((r) => r.json()).then(setOpts); }, []);

  const race = opts?.races.find((r) => r.id === raceId) ?? null;
  const klass = opts?.classes.find((c) => c.id === classId) ?? null;
  const bg = opts?.backgrounds.find((b) => b.id === bgId) ?? null;

  const racial = useMemo(() => {
    const m: Record<Ability, number> = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
    race?.abilityBonuses.forEach((a) => { const k = a.ability.toLowerCase() as Ability; if (k in m) m[k] += a.bonus; });
    return m;
  }, [race]);

  const finalScores = useMemo(() => {
    const f = {} as Record<Ability, number>;
    ABILITIES.forEach((a) => (f[a] = base[a] + racial[a]));
    return f;
  }, [base, racial]);

  const pointsUsed = ABILITIES.reduce((s, a) => s + (POINT_COST[base[a]] ?? 0), 0);
  const skillChoices = klass?.proficiencies?.skills;
  const bgSkills = bg?.skills ?? [];

  function assignStandard(i: number, ability: Ability) {
    setBase((b) => ({ ...b, [ability]: STANDARD_ARRAY[i] }));
  }

  function toggleSkill(s: string) {
    setSkills((cur) => cur.includes(s) ? cur.filter((x) => x !== s)
      : (skillChoices && cur.filter((x) => !bgSkills.includes(x)).length >= skillChoices.choose ? cur : [...cur, s]));
  }

  const canSubmit = name && race && klass && bg &&
    (!skillChoices || skills.filter((s) => !bgSkills.includes(s)).length === skillChoices.choose) &&
    (method !== "pointbuy" || pointsUsed <= 27);

  async function submit() {
    if (!race || !klass || !bg) return;
    setBusy(true); setError(null);
    const allSkills = Array.from(new Set([...skills, ...bgSkills]));
    const res = await fetch("/api/characters", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name, campaignId, raceName: race.name, className: klass.name, background: bg.name, alignment,
        abilities: finalScores, skills: allSkills, baseSpeed: race.speed,
        savingThrows: klass.savingThrows, startGp: bg.startGp,
      }),
    });
    setBusy(false);
    if (!res.ok) { setError((await res.json()).error ?? "Error"); return; }
    const c = await res.json();
    router.push(`/characters/${c.id}`);
  }

  if (!opts) return <p className="text-[#6b5a42]">Loading SRD data...</p>;

  return (
    <div className="space-y-6">
      {/* Race */}
      <section className="card">
        <h2 className="mb-2 font-display text-lg text-gold">1 · Race</h2>
        <div className="flex flex-wrap gap-2">
          {opts.races.map((r) => (
            <button key={r.id} onClick={() => setRaceId(r.id)} className={raceId === r.id ? "btn-gold" : "btn-ghost"}>{r.name}</button>
          ))}
        </div>
        {race && (
          <div className="mt-3 text-sm text-[#4a3a24]">
            <div>Speed {race.speed}ft · Size {race.size} · Bonuses: {race.abilityBonuses.map((a) => `${a.ability} +${a.bonus}`).join(", ") || "—"}</div>
            <details className="mt-1"><summary className="cursor-pointer text-gold">Racial Traits ({race.traits.length})</summary>
              <ul className="mt-1 list-disc pr-5">{race.traits.map((t) => <li key={t.name}><b>{t.name}:</b> {t.description.slice(0, 120)}…</li>)}</ul>
            </details>
          </div>
        )}
      </section>

      {/* Class */}
      <section className="card">
        <h2 className="mb-2 font-display text-lg text-gold">2 · Class</h2>
        <div className="flex flex-wrap gap-2">
          {opts.classes.map((c) => (
            <button key={c.id} onClick={() => { setClassId(c.id); setSkills((s) => s.filter((x) => bgSkills.includes(x))); }} className={classId === c.id ? "btn-gold" : "btn-ghost"}>{c.name}</button>
          ))}
        </div>
        {klass && (
          <div className="mt-3 text-sm text-[#4a3a24]">
            Hit die d{klass.hitDie} · Saving Throws: {klass.savingThrows.join(", ")} {klass.spellcastingAbility ? `· Spellcaster (${klass.spellcastingAbility})` : ""}
          </div>
        )}
      </section>

      {/* Abilities */}
      <section className="card">
        <h2 className="mb-2 font-display text-lg text-gold">3 · Ability Scores</h2>
        <div className="mb-3 flex gap-2">
          {(["standard", "pointbuy", "manual"] as const).map((m) => (
            <button key={m} onClick={() => setMethod(m)} className={method === m ? "btn-gold" : "btn-ghost"}>
              {m === "standard" ? "Standard Array" : m === "pointbuy" ? "Point Buy" : "Manual"}
            </button>
          ))}
          {method === "pointbuy" && <span className={`chip ${pointsUsed > 27 ? "text-red-700" : "text-gold"}`}>Points: {pointsUsed}/27</span>}
        </div>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {ABILITIES.map((a) => (
            <div key={a} className="stat-box">
              <div className="text-xs uppercase text-[#6b5a42]">{a}</div>
              {method === "standard" ? (
                <select className="input mt-1 text-center" value={base[a]} onChange={(e) => setBase((b) => ({ ...b, [a]: Number(e.target.value) }))}>
                  {[8, 10, 12, 13, 14, 15].map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              ) : (
                <input type="number" min={method === "pointbuy" ? 8 : 3} max={method === "pointbuy" ? 15 : 20}
                  className="input mt-1 text-center" value={base[a]}
                  onChange={(e) => setBase((b) => ({ ...b, [a]: Number(e.target.value) }))} />
              )}
              <div className="mt-1 text-xs text-[#6b5a42]">
                {racial[a] ? `+${racial[a]} → ` : ""}<b className="text-ink">{finalScores[a]}</b> ({formatMod(abilityMod(finalScores[a]))})
              </div>
            </div>
          ))}
        </div>
        {method === "standard" && <p className="mt-2 text-xs text-[#6b5a42]">Array: 15,14,13,12,10,8 — assign a value to each ability.</p>}
      </section>

      {/* Background */}
      <section className="card">
        <h2 className="mb-2 font-display text-lg text-gold">4 · Background</h2>
        <div className="flex flex-wrap gap-2">
          {opts.backgrounds.map((b) => (
            <button key={b.id} onClick={() => setBgId(b.id)} className={bgId === b.id ? "btn-gold" : "btn-ghost"}>{b.name}</button>
          ))}
        </div>
        {bg && <div className="mt-3 text-sm text-[#4a3a24]">Skills: {bg.skills.join(", ")} · Starting gold {bg.startGp}gp · <b>{bg.featureName}</b></div>}
      </section>

      {/* Skills */}
      {klass && skillChoices && (
        <section className="card">
          <h2 className="mb-2 font-display text-lg text-gold">5 · Class Skills (choose {skillChoices.choose})</h2>
          <div className="flex flex-wrap gap-2">
            {skillChoices.from.map((s) => {
              const fromBg = bgSkills.includes(s);
              const on = skills.includes(s) || fromBg;
              return (
                <button key={s} disabled={fromBg} onClick={() => toggleSkill(s)}
                  className={on ? "btn-gold" : "btn-ghost"} title={fromBg ? "Already from background" : ""}>
                  {s}{fromBg ? " (Background)" : ""}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Details */}
      <section className="card">
        <h2 className="mb-2 font-display text-lg text-gold">6 · Details</h2>
        <label className="label">Character Name</label>
        <input className="input mb-3" value={name} onChange={(e) => setName(e.target.value)} />
        <label className="label">Alignment</label>
        <select className="input" value={alignment} onChange={(e) => setAlignment(e.target.value)}>
          {["Lawful Good","Neutral Good","Chaotic Good","Lawful Neutral","True Neutral","Chaotic Neutral","Lawful Evil","Neutral Evil","Chaotic Evil"].map((a) => <option key={a}>{a}</option>)}
        </select>
      </section>

      {error && <p className="text-sm text-red-700">{error}</p>}
      <button className="btn-primary w-full text-lg" disabled={!canSubmit || busy} onClick={submit}>
        {busy ? "Creating..." : "✨ Create Character"}
      </button>
    </div>
  );
}
