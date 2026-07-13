"use client";
// v2.2 Actions section (SPEC-PLAYER §7): action-economy groups — Attacks,
// Actions, Bonus Actions, Reactions, Limited Use — with concise SRD rule
// summaries that expand to full text, plus roll shortcuts that honor the
// RollOptionsBar (advantage/disadvantage + situational bonus).
import { formatMod } from "@/lib/dnd/rules";
import type { DerivedCharacter } from "@/lib/dnd/character";
import type { EquippedWeapon } from "@/lib/character-view";
import { rollToTray, rollAttackToTray } from "@/components/DiceTray";
import { consumeRollOptions, decorateRollLabel } from "./RollOptionsBar";

// ---- General 5e actions (SRD wording, condensed) — spec §7.3 ----
const GENERAL_ACTIONS: { name: string; summary: string; rule: string }[] = [
  {
    name: "Attack",
    summary: "Make one melee or ranged attack.",
    rule: "Make one melee or ranged attack against a target within your reach or range. Certain features, such as the Extra Attack feature, let you make more than one attack as part of this action.",
  },
  {
    name: "Dash",
    summary: "Gain extra movement equal to your speed.",
    rule: "You gain extra movement for the current turn equal to your speed, after applying any modifiers. With a speed of 30 feet, for example, you can move up to 60 feet on your turn if you Dash.",
  },
  {
    name: "Disengage",
    summary: "Your movement doesn't provoke opportunity attacks.",
    rule: "If you take the Disengage action, your movement doesn't provoke opportunity attacks for the rest of the turn.",
  },
  {
    name: "Dodge",
    summary: "Attacks against you have disadvantage; DEX saves with advantage.",
    rule: "Until the start of your next turn, attack rolls against you have disadvantage if you can see the attacker, and you make DEX saves with advantage. You lose this benefit if you are incapacitated or if your speed drops to 0.",
  },
  {
    name: "Grapple",
    summary: "Contest Athletics to grab a creature (its speed becomes 0).",
    rule: "Using at least one free hand, make a Strength (Athletics) check contested by the target's Strength (Athletics) or Dexterity (Acrobatics) check (the target chooses). If you win, the target is grappled: its speed becomes 0 until the grapple ends. The target must be no more than one size larger than you and within your reach. Grappling replaces one attack when you take the Attack action.",
  },
  {
    name: "Help",
    summary: "Give an ally advantage on a check or an attack roll.",
    rule: "You aid another creature. It gains advantage on its next ability check to perform the task you are helping with, or on its next attack roll against a creature within 5 feet of you, provided the roll is made before the start of your next turn.",
  },
  {
    name: "Hide",
    summary: "Make a Dexterity (Stealth) check to become hidden.",
    rule: "Make a Dexterity (Stealth) check in an attempt to hide. Your check is contested by the Wisdom (Perception) of creatures that might notice you. You can't hide from a creature that can see you clearly, and you give away your position if you make noise or attack.",
  },
  {
    name: "Ready",
    summary: "Prepare an action to trigger later as your reaction.",
    rule: "Choose a perceivable trigger and the action (or movement) you will take in response. When the trigger occurs, you can use your reaction to act right after the trigger finishes, or ignore it. Readying a spell requires casting it as normal and holding its energy with concentration until you release it.",
  },
  {
    name: "Search",
    summary: "Devote your attention to finding something.",
    rule: "You devote your attention to finding something. Depending on the nature of the search, the GM might have you make a Wisdom (Perception) check or an Intelligence (Investigation) check.",
  },
  {
    name: "Shove",
    summary: "Contest Athletics to push a creature 5 ft or knock it prone.",
    rule: "Make a Strength (Athletics) check contested by the target's Strength (Athletics) or Dexterity (Acrobatics) check (the target chooses). If you win, you either knock the target prone or push it 5 feet away from you. The target must be no more than one size larger than you and within your reach. Shoving replaces one attack when you take the Attack action.",
  },
];

const OPPORTUNITY_ATTACK_RULE =
  "When a hostile creature you can see moves out of your reach, you can use your reaction to make one melee attack against it. The attack occurs right before the creature leaves your reach.";

const TWO_WEAPON_FIGHTING_RULE =
  "When you take the Attack action and attack with a light melee weapon in one hand, you can use a bonus action to attack with a different light melee weapon in the other hand. You don't add your ability modifier to the bonus attack's damage, unless that modifier is negative.";

// Same math as CharacterSheet.weaponAttack (display only — the attack roll
// itself goes through onWeaponAttack so logic lives in one place upstream).
function weaponMath(w: EquippedWeapon, derived: DerivedCharacter) {
  const useDex = w.ranged || (w.finesse && derived.mods.dex > derived.mods.str);
  const abMod = useDex ? derived.mods.dex : derived.mods.str;
  return { abMod, toHit: abMod + derived.proficiencyBonus, dmgExpr: `${w.damageDice}${formatMod(abMod)}` };
}

function isLightMelee(w: EquippedWeapon) {
  return !w.ranged && (w.properties ?? "").toLowerCase().includes("light");
}

function ActionRow({ name, summary, rule, children }: {
  name: string; summary: string; rule: string; children?: React.ReactNode;
}) {
  return (
    <details className="action-row">
      <summary>
        <b>{name}</b>
        <span className="muted action-row-summary">{summary}</span>
      </summary>
      <p className="action-rule">{rule}</p>
      {children}
    </details>
  );
}

export function ActionsSection({ weapons, derived, canUse, onWeaponAttack }: {
  weapons: EquippedWeapon[];
  derived: DerivedCharacter;
  canUse: boolean;
  onWeaponAttack: (w: EquippedWeapon) => void;
}) {
  const firstMelee = weapons.find((w) => !w.ranged) ?? null;
  const lightMelee = weapons.filter(isLightMelee);
  const offHand = lightMelee.length >= 2 ? lightMelee[1] : null;

  // Damage-only roll (spec §7.2 "Roll damage") — adv/dis don't apply to damage,
  // so this doesn't consume roll options.
  function rollDamageOnly(w: EquippedWeapon) {
    const { dmgExpr } = weaponMath(w, derived);
    rollToTray(`${w.name} damage`, dmgExpr, { extra: w.damageType });
  }

  // Hide → Stealth check, honoring the roll options bar.
  function rollStealth() {
    const o = consumeRollOptions();
    const bonus = derived.skills.Stealth.value + o.bonus;
    rollToTray(decorateRollLabel("Stealth (Hide)", o), `1d20${formatMod(bonus)}`, {
      advantage: o.advantage, disadvantage: o.disadvantage,
    });
  }

  // Two-weapon fighting off-hand attack: no ability mod on damage (unless negative).
  function rollOffHand(w: EquippedWeapon) {
    const o = consumeRollOptions();
    const { abMod, toHit } = weaponMath(w, derived);
    const dmgExpr = abMod < 0 ? `${w.damageDice}${formatMod(abMod)}` : w.damageDice;
    rollAttackToTray(decorateRollLabel(`${w.name} off-hand`, o), toHit + o.bonus, dmgExpr, w.damageType, {
      advantage: o.advantage, disadvantage: o.disadvantage,
    });
  }

  return (
    <div className="space-y-4">
      {/* ---- Attacks (spec §7.1/§7.2) ---- */}
      <div className="card">
        <h3 className="mb-1 font-display text-gold">Attacks</h3>
        <p className="mb-2 text-[11px] text-[#857866]">Roll = to-hit + damage in one throw · Dmg = damage only.</p>
        {weapons.length === 0 ? (
          <p className="text-sm text-[#5e5448]">No weapons equipped. Equip one in your inventory.</p>
        ) : (
          <div className="space-y-1 text-sm">
            {weapons.map((w, i) => {
              const atk = weaponMath(w, derived);
              return (
                <div key={i} className="attack-row">
                  <span className="min-w-0">
                    <b>{w.name}</b>{" "}
                    <span className="text-[11px] text-[#857866]">· {w.ranged ? "Ranged" : "Melee"}{w.properties ? ` · ${w.properties}` : ""}</span>
                  </span>
                  <span className="flex items-center gap-2 whitespace-nowrap">
                    <span className="chip" title="Attack bonus">{formatMod(atk.toHit)} hit</span>
                    <span className="text-gold">{w.damageDice}{formatMod(atk.abMod)} {w.damageType}</span>
                    <button type="button" className="roll-chip roll-chip-sm" disabled={!canUse}
                      onClick={() => onWeaponAttack(w)} title={`Attack with ${w.name}`}>Roll</button>
                    <button type="button" className="roll-chip roll-chip-sm" disabled={!canUse}
                      onClick={() => rollDamageOnly(w)} title={`Roll ${w.name} damage only`}>Dmg</button>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ---- Actions (spec §7.3) ---- */}
      <div className="card">
        <h3 className="mb-1 font-display text-gold">Actions</h3>
        <p className="mb-2 text-[11px] text-[#857866]">One action per turn. Tap a row for the full rule.</p>
        <div>
          {GENERAL_ACTIONS.map((a) => (
            <ActionRow key={a.name} name={a.name} summary={a.summary} rule={a.rule}>
              {a.name === "Hide" && (
                <button type="button" className="roll-chip roll-chip-sm" disabled={!canUse}
                  onClick={rollStealth} title="Roll a Dexterity (Stealth) check">
                  Roll Stealth {formatMod(derived.skills.Stealth.value)}
                </button>
              )}
            </ActionRow>
          ))}
        </div>
      </div>

      {/* ---- Bonus Actions ---- */}
      <div className="card">
        <h3 className="mb-1 font-display text-gold">Bonus Actions</h3>
        <div>
          <ActionRow name="Two-Weapon Fighting"
            summary="Attack with a second light weapon as a bonus action."
            rule={TWO_WEAPON_FIGHTING_RULE}>
            {offHand ? (
              <button type="button" className="roll-chip roll-chip-sm" disabled={!canUse}
                onClick={() => rollOffHand(offHand)} title={`Off-hand attack with ${offHand.name}`}>
                Roll off-hand: {offHand.name}
              </button>
            ) : (
              <p className="action-note muted">Equip two light melee weapons to enable the off-hand roll.</p>
            )}
          </ActionRow>
        </div>
      </div>

      {/* ---- Reactions ---- */}
      <div className="card">
        <h3 className="mb-1 font-display text-gold">Reactions</h3>
        <p className="mb-2 text-[11px] text-[#857866]">One reaction per round, regained at the start of your turn.</p>
        <div>
          <ActionRow name="Opportunity Attack"
            summary="Melee attack when an enemy leaves your reach."
            rule={OPPORTUNITY_ATTACK_RULE}>
            {firstMelee ? (
              <button type="button" className="roll-chip roll-chip-sm" disabled={!canUse}
                onClick={() => onWeaponAttack(firstMelee)} title={`Opportunity attack with ${firstMelee.name}`}>
                Roll: {firstMelee.name}
              </button>
            ) : (
              <p className="action-note muted">No melee weapon equipped.</p>
            )}
          </ActionRow>
        </div>
      </div>

      {/* ---- Limited Use ---- */}
      <div className="card">
        <h3 className="mb-1 font-display text-gold">Limited Use</h3>
        <p className="text-sm muted">Class and feature resources (rages, ki, channel divinity, …) are tracked in <b>Overview → Resources</b>.</p>
      </div>
    </div>
  );
}
