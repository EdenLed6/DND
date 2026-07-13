"use client";
import { useState } from "react";

export function CompendiumList({ rows, tab }: { rows: any[]; tab: string }) {
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  async function open(id: string | number) {
    setLoading(true); setDetail({ __loading: true });
    const r = await fetch(`/api/srd/detail?type=${tab}&id=${id}`);
    setDetail(r.ok ? await r.json() : null);
    setLoading(false);
  }

  return (
    <>
      <div className="grid gap-2 sm:grid-cols-2">
        {rows.map((r) => (
          <button key={`${tab}-${r.id}`} onClick={() => open(r.id)} className="card text-left hover:border-gold">
            <div className="font-display">{r.title}</div>
            <div className="text-xs text-[#6b5a42]">{r.sub}</div>
          </button>
        ))}
      </div>
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setDetail(null)}>
          <div className="card max-h-[85vh] w-full max-w-2xl overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {loading || detail.__loading ? <p className="text-[#6b5a42]">Loading...</p> : <DetailBody tab={tab} d={detail} />}
            <button className="btn-ghost mt-3" onClick={() => setDetail(null)}>Close</button>
          </div>
        </div>
      )}
    </>
  );
}

function DetailBody({ tab, d }: { tab: string; d: any }) {
  if (!d) return <p>Not found.</p>;
  const J = (s: any) => { try { return JSON.parse(s || "[]"); } catch { return []; } };

  if (tab === "spells") return (
    <div>
      <h2 className="font-display text-2xl text-gold">{d.name}</h2>
      <p className="text-sm text-[#6b5a42]">{d.level === 0 ? "Cantrip" : `Level ${d.level}`} · {d.school}
        {d.concentration ? " · Concentration" : ""}{d.ritual ? " · Ritual" : ""}</p>
      <div className="mt-2 grid grid-cols-2 gap-1 text-sm">
        <div><b>Casting Time:</b> {d.castingTime}</div><div><b>Range:</b> {d.range}</div>
        <div><b>Duration:</b> {d.duration}</div>
        <div><b>Components:</b> {[d.componentsV && "V", d.componentsS && "S", d.componentsM && "M"].filter(Boolean).join(", ")}</div>
        <div className="col-span-2"><b>Classes:</b> {J(d.classes).join(", ")}</div>
      </div>
      <p className="mt-3 whitespace-pre-wrap text-sm">{d.description}</p>
      {d.higherLevel && <p className="mt-2 text-sm text-[#4a3a24]"><b>At Higher Levels:</b> {d.higherLevel}</p>}
    </div>
  );

  if (tab === "monsters") return (
    <div>
      <h2 className="font-display text-2xl text-gold">{d.name}</h2>
      <p className="text-sm text-[#6b5a42]">{d.size} {d.type}{d.subtype ? ` (${d.subtype})` : ""} · {d.alignment} · CR {d.cr} ({d.xp} XP)</p>
      <div className="mt-2 flex gap-3 text-sm"><span><b>AC</b> {d.ac} {d.acType && `(${d.acType})`}</span><span><b>HP</b> {d.hp} ({d.hitDice})</span><span><b>Speed</b> {Object.values(J(d.speed)).join(", ") || d.speed}</span></div>
      <div className="mt-2 grid grid-cols-6 gap-1 text-center text-sm">
        {["str","dex","con","int","wis","cha"].map((a) => (
          <div key={a} className="stat-box"><div className="text-[10px] uppercase text-[#6b5a42]">{a}</div><div>{d[a]}</div></div>
        ))}
      </div>
      {d.senses && <p className="mt-2 text-sm"><b>Senses:</b> {d.senses}</p>}
      {d.languages && <p className="text-sm"><b>Languages:</b> {d.languages}</p>}
      <StatList title="Traits" arr={J(d.traits)} />
      <StatList title="Actions" arr={J(d.actions)} />
      <StatList title="Legendary Actions" arr={J(d.legendaryActions)} />
      <StatList title="Reactions" arr={J(d.reactions)} />
    </div>
  );

  if (tab === "equipment") return (
    <div>
      <h2 className="font-display text-2xl text-gold">{d.name}</h2>
      <p className="text-sm text-[#6b5a42]">{d.category}{d.costGp ? ` · ${d.costGp} ${d.costUnit}` : ""}{d.weight ? ` · ${d.weight} lb` : ""}</p>
      {d.damageDice && <p className="mt-1 text-sm"><b>Damage:</b> {d.damageDice} {d.damageType} · {J(d.weaponProperties).join(", ")}</p>}
      {d.armorCategory && <p className="mt-1 text-sm"><b>Armor:</b> {d.armorCategory} · base AC {d.acBase}{d.strMinimum ? ` · Str ${d.strMinimum}` : ""}{d.stealthDisadvantage ? " · Stealth disadv" : ""}</p>}
      {d.description && <p className="mt-2 whitespace-pre-wrap text-sm">{d.description}</p>}
    </div>
  );

  if (tab === "magic") return (
    <div>
      <h2 className="font-display text-2xl text-gold">{d.name}</h2>
      <p className="text-sm text-[#6b5a42]">{d.rarity} · {d.type}{d.requiresAttunement ? " · requires attunement" : ""}</p>
      <p className="mt-2 whitespace-pre-wrap text-sm">{d.description}</p>
    </div>
  );

  if (tab === "races") return (
    <div>
      <h2 className="font-display text-2xl text-gold">{d.name}</h2>
      <p className="text-sm text-[#6b5a42]">{d.size} · speed {d.speed} · {J(d.abilityBonuses).map((a: any) => `${a.ability} +${a.bonus}`).join(", ")}</p>
      <StatList title="Traits" arr={J(d.traits)} />
      {d.languages && <p className="text-sm"><b>Languages:</b> {d.languages}</p>}
    </div>
  );

  if (tab === "classes") return (
    <div>
      <h2 className="font-display text-2xl text-gold">{d.name}</h2>
      <p className="text-sm text-[#6b5a42]">Hit die d{d.hitDie} · Saves {J(d.savingThrows).join(", ")}{d.spellcastingAbility ? ` · Caster (${d.spellcastingAbility})` : ""}</p>
      <StatList title="Features" arr={J(d.features).map((f: any) => ({ name: `L${f.level} · ${f.name}`, description: f.description }))} />
    </div>
  );

  if (tab === "conditions") return (
    <div>
      <h2 className="font-display text-2xl text-gold">{d.name}</h2>
      <p className="mt-2 whitespace-pre-wrap text-sm">{d.description}</p>
    </div>
  );

  return <pre className="text-xs">{JSON.stringify(d, null, 2)}</pre>;
}

function StatList({ title, arr }: { title: string; arr: any[] }) {
  if (!arr || arr.length === 0) return null;
  return (
    <div className="mt-3">
      <h3 className="font-display text-gold">{title}</h3>
      {arr.map((a: any, i: number) => (
        <p key={i} className="mt-1 text-sm"><b>{a.name}.</b> {a.description}</p>
      ))}
    </div>
  );
}
