import { test } from "node:test";
import assert from "node:assert/strict";
import { tickConditionsForTurn, scaleDiceExpr, findPreset, CONDITION_PRESETS, type TickInputCondition } from "./conditions";

function cond(over: Partial<TickInputCondition> & { id: string }): TickInputCondition {
  return { name: "Test", combatantId: "cmb1", stacks: 1, remainingRounds: null, ...over };
}

test("presets: 14 official conditions + DS extras present", () => {
  const official = CONDITION_PRESETS.filter((p) => p.category === "condition");
  assert.equal(official.length, 14);
  assert.ok(findPreset("bleeding")?.automation?.startTurnDamage === "1d6");
  assert.equal(findPreset("Burning")?.automation?.damageType, "fire");
  assert.equal(findPreset("Exhaustion")?.maxStacks, 6);
  assert.equal(findPreset("Concentrating")?.category, "magic");
});

test("end phase decrements remainingRounds without expiring", () => {
  const r = tickConditionsForTurn([cond({ id: "a", remainingRounds: 3 })], "end");
  assert.deepEqual(r.expired, []);
  assert.deepEqual(r.updated, [{ id: "a", remainingRounds: 2 }]);
});

test("end phase expires when remainingRounds hits 0", () => {
  const r = tickConditionsForTurn([cond({ id: "a", remainingRounds: 1 })], "end");
  assert.deepEqual(r.expired, ["a"]);
  assert.deepEqual(r.updated, []);
});

test("start phase never decrements durations", () => {
  const r = tickConditionsForTurn([cond({ id: "a", remainingRounds: 1 })], "start");
  assert.deepEqual(r.expired, []);
  assert.deepEqual(r.updated, []);
});

test("until-removed (null duration) never expires", () => {
  const r1 = tickConditionsForTurn([cond({ id: "a" })], "end");
  const r2 = tickConditionsForTurn([cond({ id: "a" })], "start");
  assert.deepEqual(r1.expired, []);
  assert.deepEqual(r2.expired, []);
});

test("dot prompts at start of turn, scaled by stacks", () => {
  const bleeding = cond({ id: "b", name: "Bleeding", stacks: 2, automationJson: JSON.stringify({ startTurnDamage: "1d6" }) });
  const r = tickConditionsForTurn([bleeding], "start");
  assert.deepEqual(r.damagePrompts, [{ conditionId: "b", targetId: "cmb1", name: "Bleeding", expr: "2d6", damageType: undefined }]);
  // no dot prompt at end of turn
  assert.equal(tickConditionsForTurn([bleeding], "end").damagePrompts.length, 0);
});

test("dot prompt carries damage type", () => {
  const burning = cond({ id: "f", name: "Burning", automationJson: JSON.stringify({ startTurnDamage: "1d6", damageType: "fire" }) });
  const r = tickConditionsForTurn([burning], "start");
  assert.equal(r.damagePrompts[0].expr, "1d6");
  assert.equal(r.damagePrompts[0].damageType, "fire");
});

test("save prompts at end of turn when saveAbility+DC set", () => {
  const poisoned = cond({ id: "p", name: "Poisoned", saveAbility: "con", saveDc: 13 });
  const r = tickConditionsForTurn([poisoned], "end");
  assert.deepEqual(r.savePrompts, [{ conditionId: "p", targetId: "cmb1", name: "Poisoned", ability: "con", dc: 13 }]);
  assert.equal(tickConditionsForTurn([poisoned], "start").savePrompts.length, 0);
});

test("expired conditions produce no prompts", () => {
  const c = cond({ id: "x", name: "Poisoned", saveAbility: "con", saveDc: 13, remainingRounds: 1,
    automationJson: JSON.stringify({ startTurnDamage: "1d6" }) });
  const r = tickConditionsForTurn([c], "end");
  assert.deepEqual(r.expired, ["x"]);
  assert.equal(r.savePrompts.length, 0);
});

test("autoExpire start-of-turn / end-of-turn", () => {
  const s = cond({ id: "s", automationJson: JSON.stringify({ autoExpire: "start-of-turn" }) });
  const e = cond({ id: "e", automationJson: JSON.stringify({ autoExpire: "end-of-turn" }) });
  assert.deepEqual(tickConditionsForTurn([s, e], "start").expired, ["s"]);
  assert.deepEqual(tickConditionsForTurn([s, e], "end").expired, ["e"]);
});

test("scaleDiceExpr multiplies dice, not flat modifiers", () => {
  assert.equal(scaleDiceExpr("1d6", 3), "3d6");
  assert.equal(scaleDiceExpr("2d4+1", 2), "4d4+1");
  assert.equal(scaleDiceExpr("1d6", 1), "1d6");
});

test("malformed automationJson is tolerated", () => {
  const r = tickConditionsForTurn([cond({ id: "m", automationJson: "{oops" })], "end");
  assert.deepEqual(r, { expired: [], damagePrompts: [], savePrompts: [], updated: [] });
});
