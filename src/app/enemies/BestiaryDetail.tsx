"use client";
// Bestiary detail per the DS "Creature Detail Foundation" (design-system §08):
// a two-column monster-manual spread — art + lore on the left, the framed
// parchment stat block with wine section rules on the right.
import type { StatBlock } from "./statblock";
import { abilityModText, parseEntries, speedText } from "./statblock";

const ART_GRADIENTS: Record<string, string> = {
  aberration: "linear-gradient(160deg,#D8D7C8,#A6B09D 60%,#7B8676)",
  beast: "linear-gradient(160deg,#DCCFB4,#B49B72 60%,#8A6F4B)",
  celestial: "linear-gradient(160deg,#F2E7C8,#D7C08A 60%,#B58A42)",
  construct: "linear-gradient(160deg,#D6D2C8,#A8A296 60%,#7C766B)",
  dragon: "linear-gradient(160deg,#E3C7B4,#C08A6B 60%,#8A4A33)",
  elemental: "linear-gradient(160deg,#C8D8E0,#8DA7B4 60%,#5F7B8A)",
  fey: "linear-gradient(160deg,#D9E0C8,#A8B88A 60%,#6F8A5B)",
  fiend: "linear-gradient(160deg,#DDBEB4,#B4726B 60%,#7A2B2F)",
  giant: "linear-gradient(160deg,#DAD0BE,#AE9878 60%,#7C6A50)",
  humanoid: "linear-gradient(160deg,#DFD4BE,#BCA57F 60%,#8C7452)",
  monstrosity: "linear-gradient(160deg,#D4CCC0,#A3907E 60%,#6E5B4C)",
  ooze: "linear-gradient(160deg,#D7DCC2,#AEB786 60%,#7E8A5B)",
  plant: "linear-gradient(160deg,#CFDCC2,#93AE7E 60%,#5E7A4C)",
  undead: "linear-gradient(160deg,#CCC9CE,#948E9C 60%,#5C566A)",
};

function Entries({ entries }: { entries: { name: string; description: string }[] }) {
  return (
    <>
      {entries.map((e, i) => (
        <div key={i}>
          {i > 0 && <div className="thin-rule" />}
          <p><strong><em>{e.name}.</em></strong> {e.description}</p>
        </div>
      ))}
    </>
  );
}

/** The framed stat block alone (also used as the builder's live preview). */
export function StatBlockCard({ mon }: { mon: StatBlock }) {
  const traits = parseEntries(mon.traits);
  const actions = parseEntries(mon.actions);
  const legendary = parseEntries(mon.legendaryActions);
  const reactions = parseEntries(mon.reactions);
  const abilities = [
    ["STR", mon.str], ["DEX", mon.dex], ["CON", mon.con],
    ["INT", mon.int], ["WIS", mon.wis], ["CHA", mon.cha],
  ] as const;
  const skills = (() => {
    if (!mon.skills) return null;
    try {
      const arr = JSON.parse(mon.skills);
      if (Array.isArray(arr)) return arr.map((s: any) => `${s.name} ${s.bonus >= 0 ? "+" : ""}${s.bonus}`).join(", ");
    } catch { /* plain string */ }
    return mon.skills;
  })();

  return (
    <div className="stat-block">
      <h3>{(mon.name || "Unnamed").toUpperCase()}</h3>
      <div className="type-line">
        {[mon.size, mon.type].filter(Boolean).join(" ")}
        {mon.subtype ? ` (${mon.subtype})` : ""}{mon.alignment ? `, ${mon.alignment}` : ""}
      </div>
      <div className="red-rule" />
      <p><strong>Armor Class</strong> {mon.ac}{mon.acType ? ` (${mon.acType})` : ""}</p>
      <p><strong>Hit Points</strong> {mon.hp}{mon.hitDice ? ` (${mon.hitDice})` : ""}</p>
      <p><strong>Speed</strong> {speedText(mon.speed)}</p>
      <div className="ability-line">
        {abilities.map(([label, score]) => (
          <div key={label}>
            <strong>{label}</strong>
            <span>{score ?? 10} ({abilityModText(score ?? 10)})</span>
          </div>
        ))}
      </div>
      {mon.savingThrows && <p><strong>Saving Throws</strong> {mon.savingThrows}</p>}
      {skills && <p><strong>Skills</strong> {skills}</p>}
      {mon.vulnerabilities && <p><strong>Damage Vulnerabilities</strong> {mon.vulnerabilities}</p>}
      {mon.resistances && <p><strong>Damage Resistances</strong> {mon.resistances}</p>}
      {mon.immunities && <p><strong>Damage Immunities</strong> {mon.immunities}</p>}
      {mon.conditionImmunities && <p><strong>Condition Immunities</strong> {mon.conditionImmunities}</p>}
      {mon.senses && <p><strong>Senses</strong> {mon.senses}</p>}
      {mon.languages && <p><strong>Languages</strong> {mon.languages}</p>}
      <p><strong>Challenge</strong> {mon.cr}{mon.xp ? ` (${mon.xp.toLocaleString()} XP)` : ""}</p>
      {traits.length > 0 && (
        <>
          <div className="red-rule" />
          <Entries entries={traits} />
        </>
      )}
      {actions.length > 0 && (
        <>
          <h4>ACTIONS</h4>
          <Entries entries={actions} />
        </>
      )}
      {reactions.length > 0 && (
        <>
          <h4>REACTIONS</h4>
          <Entries entries={reactions} />
        </>
      )}
      {legendary.length > 0 && (
        <>
          <h4>LEGENDARY ACTIONS</h4>
          <Entries entries={legendary} />
        </>
      )}
    </div>
  );
}

/** Full two-column bestiary spread: art + lore column, stat block column. */
export function BestiarySpread({ mon }: { mon: StatBlock }) {
  const gradient = ART_GRADIENTS[(mon.type ?? "").toLowerCase()] ?? ART_GRADIENTS.aberration;
  const initial = (mon.name || "?").trim().charAt(0).toUpperCase();
  return (
    <div className="enemy-spread">
      <div className="min-w-0">
        <div className="enemy-art" style={{ background: gradient }}>
          <span className="enemy-initial">{initial}</span>
          <span className="enemy-name">{mon.name}</span>
        </div>
        <h2 className="mt-3 font-display text-2xl text-heading">{mon.name}</h2>
        <p className="mt-1 text-[15px] italic text-[#5e5448]">
          {[mon.size, mon.type].filter(Boolean).join(" ")}
          {mon.subtype ? ` (${mon.subtype})` : ""}{mon.alignment ? `, ${mon.alignment}` : ""}
          {" — "}Challenge {mon.cr}{mon.xp ? ` (${mon.xp.toLocaleString()} XP)` : ""}.
        </p>
        <div className="mt-3 space-y-1 text-sm">
          {mon.senses && <p><b className="text-heading">Senses.</b> {mon.senses}</p>}
          {mon.languages && <p><b className="text-heading">Languages.</b> {mon.languages}</p>}
          {mon.speed && <p><b className="text-heading">Movement.</b> {speedText(mon.speed)}</p>}
          {mon.resistances && <p><b className="text-heading">Resistances.</b> {mon.resistances}</p>}
          {mon.immunities && <p><b className="text-heading">Immunities.</b> {mon.immunities}</p>}
        </div>
      </div>
      <div className="min-w-0">
        <StatBlockCard mon={mon} />
      </div>
    </div>
  );
}
