import { test } from "node:test";
import assert from "node:assert/strict";
import { abilityMod, proficiencyBonus, levelForXp, spellSlots, pactSlots, toCopper, fromCopper, sizeToSquares } from "./rules";
import { averageOf, rollDamage, roll } from "./dice";
import { derive } from "./character";
import { parseAttack, resolveAttackRoll, applyDamage } from "./combat";

test("ability modifiers", () => {
  assert.equal(abilityMod(10), 0);
  assert.equal(abilityMod(20), 5);
  assert.equal(abilityMod(8), -1);
  assert.equal(abilityMod(1), -5);
});

test("proficiency bonus by level", () => {
  assert.equal(proficiencyBonus(1), 2);
  assert.equal(proficiencyBonus(5), 3);
  assert.equal(proficiencyBonus(9), 4);
  assert.equal(proficiencyBonus(17), 6);
});

test("xp -> level", () => {
  assert.equal(levelForXp(0), 1);
  assert.equal(levelForXp(299), 1);
  assert.equal(levelForXp(300), 2);
  assert.equal(levelForXp(6500), 5);
  assert.equal(levelForXp(355000), 20);
});

test("full caster slots", () => {
  assert.deepEqual(spellSlots([{ name: "Wizard", level: 1 }]), [2, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(spellSlots([{ name: "Wizard", level: 5 }]), [4, 3, 2, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(spellSlots([{ name: "Cleric", level: 20 }]), [4, 3, 3, 3, 3, 2, 2, 1, 1]);
});

test("multiclass caster level (full + half)", () => {
  // Paladin 4 (=2) + Sorcerer 3 (=3) => caster level 5 => [4,3,2,...]
  assert.deepEqual(spellSlots([{ name: "Paladin", level: 4 }, { name: "Sorcerer", level: 3 }]),
    [4, 3, 2, 0, 0, 0, 0, 0, 0]);
});

test("warlock pact magic", () => {
  assert.deepEqual(pactSlots([{ name: "Warlock", level: 5 }]), { slots: 2, level: 3 });
  assert.deepEqual(pactSlots([{ name: "Warlock", level: 11 }]), { slots: 3, level: 5 });
});

test("currency conversion round-trips", () => {
  assert.equal(toCopper({ gp: 1 }), 100);
  assert.equal(toCopper({ pp: 1, gp: 2, sp: 3, cp: 4 }), 1234);
  assert.deepEqual(fromCopper(1234), { pp: 1, gp: 2, ep: 0, sp: 3, cp: 4 });
});

test("size to squares", () => {
  assert.equal(sizeToSquares("Medium"), 1);
  assert.equal(sizeToSquares("Large"), 2);
  assert.equal(sizeToSquares("Gargantuan"), 4);
});

test("dice average", () => {
  assert.equal(averageOf("1d6+2"), 5);      // 3.5+2 floor = 5
  assert.equal(averageOf("2d6"), 7);
  assert.equal(averageOf("1d10"), 5);
});

test("crit doubles dice not modifier", () => {
  // Force determinism by checking bounds: 2d6+3 crit => 4d6+3, range 7..27
  for (let i = 0; i < 50; i++) {
    const r = rollDamage("2d6+3", true);
    assert.ok(r.total >= 7 && r.total <= 27, `got ${r.total}`);
    assert.equal(r.dice.filter((d) => d.sides === 6).length, 4);
  }
});

test("parse goblin scimitar attack", () => {
  const a = parseAttack("Scimitar", "Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 5 (1d6 + 2) slashing damage.");
  assert.equal(a.toHit, 4);
  assert.equal(a.damageDice, "1d6+2");
  assert.equal(a.damageType, "slashing");
  assert.equal(a.reach, "5 ft.");
});

test("resolve attack vs AC 1 hits unless natural 1", () => {
  const a = parseAttack("Bite", "Melee Weapon Attack: +7 to hit, reach 5 ft. Hit: 10 (2d6 + 3) piercing damage.");
  for (let i = 0; i < 60; i++) {
    const out = resolveAttackRoll(a, { name: "Dummy", ac: 1 });
    const nat = out.attackRoll!.dice.find((d) => d.sides === 20)!.value;
    if (nat === 1) { // natural 1 always misses, even vs AC 1
      assert.equal(out.hit, false);
      assert.equal(out.damage, 0);
    } else {
      assert.equal(out.hit, true);
      assert.ok(out.damage >= 5); // 2d6+3 min 5 (crit 4d6+3 min 7)
    }
  }
});

test("temp HP absorbs before HP", () => {
  const r = applyDamage(20, 5, 8);
  assert.equal(r.tempHp, 0);
  assert.equal(r.currentHp, 17); // 8-5=3 to hp => 20-3
});

test("derive fighter core stats", () => {
  const d = derive({
    str: 16, dex: 14, con: 15, int: 8, wis: 12, cha: 10, xp: 6500,
    classes: [{ name: "Fighter", level: 5, isPrimary: true }],
    skills: [{ skill: "Athletics", proficient: true, expertise: false }],
    savingThrowProfs: ["str", "con"],
    baseSpeed: 30,
  });
  assert.equal(d.totalLevel, 5);
  assert.equal(d.proficiencyBonus, 3);
  assert.equal(d.mods.str, 3);
  assert.equal(d.saves.str.value, 6); // 3 + 3 prof
  assert.equal(d.saves.dex.value, 2); // not proficient
  assert.equal(d.skills.Athletics.value, 6); // 3 + 3
  assert.equal(d.ac, 12); // 10 + dex 2, no armor
  assert.equal(d.maxHp, 44); // L1:10+2=12; +4*(6+2)=32 => 44
  assert.equal(d.spellcasting, null);
});

test("derive wizard spellcasting", () => {
  const d = derive({
    str: 8, dex: 14, con: 14, int: 16, wis: 12, cha: 10, xp: 2700,
    classes: [{ name: "Wizard", level: 4, isPrimary: true }],
    skills: [], savingThrowProfs: ["int", "wis"], baseSpeed: 30,
  });
  assert.ok(d.spellcasting);
  assert.equal(d.spellcasting!.spellSaveDc, 8 + 2 + 3); // pb2 + int3 = 13
  assert.equal(d.spellcasting!.spellAttackBonus, 5);
  assert.deepEqual(d.spellcasting!.slots, [4, 3, 0, 0, 0, 0, 0, 0, 0]);
});
