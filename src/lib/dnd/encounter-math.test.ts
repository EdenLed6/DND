import { test } from "node:test";
import assert from "node:assert/strict";
import { XP_THRESHOLDS, crToXp, computeEncounterDifficulty } from "./encounter-math";

test("cr -> xp, including fractions", () => {
  assert.equal(crToXp("0"), 10);
  assert.equal(crToXp("1/8"), 25);
  assert.equal(crToXp("1/4"), 50);
  assert.equal(crToXp("1/2"), 100);
  assert.equal(crToXp(0.25), 50);
  assert.equal(crToXp(1), 200);
  assert.equal(crToXp("5"), 1800);
  assert.equal(crToXp(30), 155000);
});

test("thresholds sum across the party", () => {
  const d = computeEncounterDifficulty([3, 3, 3, 3], []);
  // L3 = 75/150/225/400 each, x4
  assert.deepEqual(d.thresholds, { easy: 300, medium: 600, hard: 900, deadly: 1600 });
  assert.equal(XP_THRESHOLDS[1].deadly, 100);
  assert.equal(XP_THRESHOLDS[20].deadly, 12700);
});

test("multiplier steps by monster count (normal party)", () => {
  const party = [3, 3, 3, 3];
  const one = (n: number) =>
    computeEncounterDifficulty(party, [{ cr: "1/4", count: n }]).multiplier;
  assert.equal(one(1), 1);
  assert.equal(one(2), 1.5);
  assert.equal(one(3), 2);
  assert.equal(one(6), 2);
  assert.equal(one(7), 2.5);
  assert.equal(one(11), 3);
  assert.equal(one(15), 4);
});

test("small party (<3) shifts multiplier one step up", () => {
  const d = computeEncounterDifficulty([3, 3], [{ cr: "1/4", count: 2 }]);
  assert.equal(d.multiplier, 2); // normally 1.5
  const single = computeEncounterDifficulty([3, 3], [{ cr: "1", count: 1 }]);
  assert.equal(single.multiplier, 1.5); // normally 1
  const swarm = computeEncounterDifficulty([3, 3], [{ cr: "0", count: 15 }]);
  assert.equal(swarm.multiplier, 4); // clamped at top
});

test("large party (>5) shifts multiplier one step down", () => {
  const party = [3, 3, 3, 3, 3, 3];
  const d = computeEncounterDifficulty(party, [{ cr: "1/4", count: 4 }]);
  assert.equal(d.multiplier, 1.5); // normally 2
  const single = computeEncounterDifficulty(party, [{ cr: "5", count: 1 }]);
  assert.equal(single.multiplier, 0.5); // clamped one below x1
});

test("total and adjusted xp: 4 goblins vs 4x L3", () => {
  const d = computeEncounterDifficulty([3, 3, 3, 3], [{ cr: "1/4", count: 4 }]);
  assert.equal(d.totalXp, 200);
  assert.equal(d.multiplier, 2);
  assert.equal(d.adjustedXp, 400);
  assert.equal(d.perPlayerXp, 100);
  assert.equal(d.rating, "easy"); // 400 in [300, 600)
});

test("rating boundaries", () => {
  const party = [1, 1, 1, 1]; // 100/200/300/400
  const rate = (ms: { cr: string; count: number }[]) =>
    computeEncounterDifficulty(party, ms).rating;
  assert.equal(rate([]), "trivial");
  assert.equal(rate([{ cr: "1/8", count: 1 }]), "trivial");     // 25 < 100
  assert.equal(rate([{ cr: "1/2", count: 1 }]), "easy");        // 100 >= easy
  assert.equal(rate([{ cr: "1", count: 1 }]), "medium");        // 200 >= medium
  assert.equal(computeEncounterDifficulty(party, [{ cr: "1/2", count: 2 }]).adjustedXp, 300);
  assert.equal(rate([{ cr: "1/2", count: 2 }]), "hard");        // exactly at hard threshold
  assert.equal(rate([{ cr: "2", count: 1 }]), "deadly");        // 450 >= 400
});

test("warnings: action economy and single big monster", () => {
  const horde = computeEncounterDifficulty([3, 3, 3], [{ cr: "1/8", count: 7 }]);
  assert.equal(horde.warnings.length, 1);
  assert.match(horde.warnings[0], /Action economy/);

  const boss = computeEncounterDifficulty([1, 1, 1, 1], [{ cr: "3", count: 1 }]);
  assert.equal(boss.rating, "deadly");
  assert.equal(boss.warnings.length, 1);
  assert.match(boss.warnings[0], /Single monster/);

  const fine = computeEncounterDifficulty([3, 3, 3, 3], [{ cr: "1/4", count: 4 }]);
  assert.deepEqual(fine.warnings, []);
});
