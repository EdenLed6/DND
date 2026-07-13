// Shareable character summary / print view (SPEC v2.2 §6).
// Server-rendered, read-only, single-page snapshot of the character styled
// like a clean rulebook sheet. Same access rule as the full sheet (owner or
// campaign member). The `.no-print` chrome disappears under @media print
// (see the appended print section in globals.css).
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { loadCharacterView } from "@/lib/character-view";
import { roleInCampaign } from "@/lib/auth/rbac";
import { TopNav } from "@/components/TopNav";
import { ABILITIES, ABILITY_LABELS, SKILLS, SKILL_NAMES, formatMod } from "@/lib/dnd/rules";
import type { EquippedWeapon } from "@/lib/character-view";
import type { DerivedCharacter } from "@/lib/dnd/character";
import { PrintButton } from "./PrintButton";

export default async function CharacterSummaryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const view = await loadCharacterView(id);
  if (!view) notFound();

  const isOwner = view.character.ownerId === user.id;
  const role = view.character.campaignId ? await roleInCampaign(user.id, view.character.campaignId) : null;
  if (!isOwner && !role) redirect("/dashboard"); // no access

  const { character: c, derived, spellDetails, features, weapons, encumbrance, resources, senses, proficiencies, defenses, acBreakdown } = view;
  const sc = derived.spellcasting;

  const meta = [
    `${c.raceId}${c.subrace ? ` (${c.subrace})` : ""}`,
    c.classes.map((cl) => `${cl.classId} ${cl.level}${cl.subclass ? ` (${cl.subclass})` : ""}`).join(" / "),
    c.background,
    c.alignment,
  ].filter(Boolean).join(" · ");

  // Prepared spells grouped by level (cantrips always count as prepared).
  const preparedSpells = spellDetails.filter((s: any) => s.level === 0 || s.prepared || s.alwaysPrepared);
  const spellsByLevel = new Map<number, string[]>();
  for (const s of preparedSpells) {
    const arr = spellsByLevel.get(s.level) ?? [];
    arr.push(s.name);
    spellsByLevel.set(s.level, arr);
  }
  const spellLevels = [...spellsByLevel.keys()].sort((a, b) => a - b);

  const slotList = sc ? sc.slots.map((n, i) => ({ level: i + 1, n })).filter((s) => s.n > 0) : [];

  const items = [...c.items].sort((a, b) => Number(b.equipped) - Number(a.equipped) || a.name.localeCompare(b.name));
  const coins: [string, number][] = [["PP", c.pp], ["GP", c.gp], ["EP", c.ep], ["SP", c.sp], ["CP", c.cp]];

  const defenseLines: [string, string[]][] = [
    ["Resistances", defenses.resistances],
    ["Immunities", defenses.immunities],
    ["Vulnerabilities", defenses.vulnerabilities],
    ["Condition Imm.", defenses.conditionImmunities],
  ];
  const extraSpeeds = (Object.entries(defenses.speeds) as [string, number][])
    .map(([k, v]) => `${cap(k)} ${v} ft`);
  const hasDefenses = defenseLines.some(([, v]) => v.length) || extraSpeeds.length > 0 || senses.darkvision != null;

  const profLines: [string, string[]][] = [
    ["Languages", proficiencies.languages],
    ["Tools", proficiencies.tools],
    ["Weapons", proficiencies.weapons],
    ["Armor", proficiencies.armor],
  ];

  return (
    <div className="summary-page">
      <div className="no-print">
        <TopNav user={user} />
      </div>

      <main className="mx-auto max-w-5xl space-y-3 p-4">
        {/* Screen-only toolbar */}
        <div className="no-print flex items-center justify-between gap-3">
          <Link href={`/characters/${c.id}`} className="btn-ghost">← Back to sheet</Link>
          <PrintButton />
        </div>

        {/* ---- Header: identity + core stat strip ---- */}
        <header className="card sum-card">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="font-display text-3xl text-gold">{c.name}</h1>
              <div className="text-sm muted">{meta}</div>
            </div>
            <div className="sum-strip" aria-label="Core stats">
              <StatBox k="AC" v={String(derived.ac)} />
              <StatBox k="Init" v={formatMod(derived.initiative)} />
              <StatBox k="Speed" v={`${derived.speed} ft`} />
              <StatBox k="HP" v={`${c.currentHp}/${derived.maxHp}`} />
              <StatBox k="Prof" v={formatMod(derived.proficiencyBonus)} />
              <StatBox k="Pass. Perc." v={String(derived.passivePerception)} />
            </div>
          </div>
        </header>

        {/* ---- Dense multi-column body ---- */}
        <div className="sum-cols">
          {/* Abilities */}
          <section className="card sum-card">
            <h3 className="font-display text-gold sum-h">Abilities</h3>
            <div className="sum-abilities">
              {ABILITIES.map((a) => (
                <div key={a} className="stat-box sum-ability">
                  <span className="sum-k">{a.toUpperCase()}</span>
                  <span className="sum-v">{formatMod(derived.mods[a])}</span>
                  <span className="sum-sub">{(c as any)[a]}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Saving throws */}
          <section className="card sum-card">
            <h3 className="font-display text-gold sum-h">Saving Throws</h3>
            <div className="sum-skills">
              {ABILITIES.map((a) => (
                <div key={a} className="sum-row">
                  <span><Dot on={derived.saves[a].proficient} /> {ABILITY_LABELS[a]}</span>
                  <b>{formatMod(derived.saves[a].value)}</b>
                </div>
              ))}
            </div>
          </section>

          {/* Skills — all 18, two columns, proficiency dots */}
          <section className="card sum-card">
            <h3 className="font-display text-gold sum-h">Skills</h3>
            <div className="sum-skills">
              {SKILL_NAMES.map((name) => {
                const s = derived.skills[name];
                return (
                  <div key={name} className="sum-row">
                    <span className="sum-line">
                      <Dot on={s.proficient} expert={s.expertise} /> {name} <span className="faint">({SKILLS[name].toUpperCase()})</span>
                    </span>
                    <b>{formatMod(s.value)}</b>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Attacks */}
          {weapons.length > 0 && (
            <section className="card sum-card">
              <h3 className="font-display text-gold sum-h">Attacks</h3>
              {weapons.map((w, i) => {
                const atk = weaponMath(w, derived);
                return (
                  <div key={i} className="sum-row">
                    <span className="sum-line"><b>{w.name}</b> <span className="faint">{w.ranged ? "ranged" : "melee"}</span></span>
                    <span className="whitespace-nowrap"><b>{formatMod(atk.toHit)}</b> · {w.damageDice}{formatMod(atk.abMod)} {w.damageType}</span>
                  </div>
                );
              })}
            </section>
          )}

          {/* Spellcasting */}
          {sc && (
            <section className="card sum-card">
              <h3 className="font-display text-gold sum-h">Spellcasting</h3>
              <div className="sum-row"><span>{sc.casterClass} ({sc.abilityLabel})</span><span>DC <b>{sc.spellSaveDc}</b> · Atk <b>{formatMod(sc.spellAttackBonus)}</b></span></div>
              {(slotList.length > 0 || sc.pact) && (
                <div className="sum-row">
                  <span className="faint">Slots</span>
                  <span className="text-right">
                    {slotList.map((s) => `${ord(s.level)}: ${s.n}`).join(" · ")}
                    {sc.pact ? `${slotList.length ? " · " : ""}Pact: ${sc.pact.slots} × ${ord(sc.pact.level)}` : ""}
                  </span>
                </div>
              )}
              {spellLevels.map((lvl) => (
                <div key={lvl} className="sum-spell-group">
                  <span className="sum-k">{lvl === 0 ? "Cantrips" : ord(lvl) + " level"}</span>
                  <span>{spellsByLevel.get(lvl)!.join(", ")}</span>
                </div>
              ))}
            </section>
          )}

          {/* Resources */}
          {resources.length > 0 && (
            <section className="card sum-card">
              <h3 className="font-display text-gold sum-h">Resources</h3>
              {resources.map((r) => (
                <div key={r.key} className="sum-row">
                  <span className="sum-line">{r.name}{r.unit ? ` (${r.unit})` : ""}</span>
                  <span className="whitespace-nowrap"><b>{r.max}</b> <span className="faint">/ {r.resetOn === "SHORT" ? "short rest" : "long rest"}</span></span>
                </div>
              ))}
            </section>
          )}

          {/* Features & traits */}
          {features.length > 0 && (
            <section className="card sum-card">
              <h3 className="font-display text-gold sum-h">Features & Traits</h3>
              {features.map((g) => (
                <div key={g.source} className="sum-feature-group">
                  <span className="sum-k">{g.source}</span>
                  {g.items.map((f, i) => (
                    <div key={i} className="sum-line">
                      <b>{f.name}</b>{f.description ? <span className="faint"> — {f.description}</span> : null}
                    </div>
                  ))}
                </div>
              ))}
            </section>
          )}

          {/* Proficiencies & languages */}
          {profLines.some(([, v]) => v.length > 0) && (
            <section className="card sum-card">
              <h3 className="font-display text-gold sum-h">Proficiencies & Languages</h3>
              {profLines.filter(([, v]) => v.length).map(([k, v]) => (
                <div key={k} className="sum-feature-group">
                  <span className="sum-k">{k}</span>
                  <span>{v.join(", ")}</span>
                </div>
              ))}
            </section>
          )}

          {/* Defenses, senses & extra speeds */}
          {hasDefenses && (
            <section className="card sum-card">
              <h3 className="font-display text-gold sum-h">Defenses & Senses</h3>
              {defenseLines.filter(([, v]) => v.length).map(([k, v]) => (
                <div key={k} className="sum-row"><span className="sum-k">{k}</span><span className="text-right">{v.join(", ")}</span></div>
              ))}
              {senses.darkvision != null && (
                <div className="sum-row"><span className="sum-k">Darkvision</span><span>{senses.darkvision} ft</span></div>
              )}
              {extraSpeeds.length > 0 && (
                <div className="sum-row"><span className="sum-k">Speeds</span><span className="text-right">{extraSpeeds.join(" · ")}</span></div>
              )}
              <div className="sum-row"><span className="sum-k">AC</span><span className="text-right faint">{acBreakdown}</span></div>
            </section>
          )}

          {/* Equipment + currency */}
          <section className="card sum-card">
            <h3 className="font-display text-gold sum-h">Equipment</h3>
            {items.length === 0 && <div className="faint text-sm">No items.</div>}
            {items.map((i) => (
              <div key={i.id} className="sum-row">
                <span className="sum-line">{i.equipped ? <span className="sum-dot" title="Equipped">●</span> : <span className="faint">○</span>} {i.name}</span>
                {(i.quantity ?? 1) > 1 && <span className="faint whitespace-nowrap">×{i.quantity}</span>}
              </div>
            ))}
            <div className="sum-row sum-currency">
              <span className="sum-k">Currency</span>
              <span>{coins.filter(([, n]) => n > 0).map(([k, n]) => `${n} ${k}`).join(" · ") || "—"}</span>
            </div>
            <div className="sum-row"><span className="sum-k">Weight</span><span className="faint">{encumbrance.totalWeight} / {encumbrance.capacity} lb</span></div>
          </section>
        </div>
      </main>
    </div>
  );
}

function StatBox({ k, v }: { k: string; v: string }) {
  return (
    <div className="stat-box sum-stat">
      <span className="sum-k">{k}</span>
      <span className="sum-v">{v}</span>
    </div>
  );
}

function Dot({ on, expert }: { on: boolean; expert?: boolean }) {
  return <span className={on ? "sum-dot" : "faint"} title={expert ? "Expertise" : on ? "Proficient" : undefined}>{expert ? "◆" : on ? "●" : "○"}</span>;
}

// Same display math as ActionsSection.weaponMath / CharacterSheet.weaponAttack.
function weaponMath(w: EquippedWeapon, derived: DerivedCharacter) {
  const useDex = w.ranged || (w.finesse && derived.mods.dex > derived.mods.str);
  const abMod = useDex ? derived.mods.dex : derived.mods.str;
  return { abMod, toHit: abMod + derived.proficiencyBonus };
}

function ord(n: number): string {
  return n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : `${n}th`;
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
