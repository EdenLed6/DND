import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDiceExpression, rollExt } from "./dice-ext";

// Deterministic rng: returns the scripted fractions in order, throws if the
// roller asks for more values than scripted (also proves e.g. reroll happens
// exactly once).
function fixed(values: number[]): () => number {
  let i = 0;
  return () => {
    if (i >= values.length) throw new Error(`rng exhausted after ${values.length} values`);
    return values[i++];
  };
}
// Fraction that makes a dS die land on face f.
function face(f: number, sides: number): number {
  return (f - 0.5) / sides;
}

test("keep highest: 2d20kh1+5 keeps the high die, drops the low one", () => {
  const r = rollExt("2d20kh1+5", fixed([face(14, 20), face(8, 20)]));
  assert.equal(r.total, 19);
  assert.equal(r.modifier, 5);
  assert.equal(r.dice.length, 2);
  assert.equal(r.dice[0].value, 14);
  assert.equal(r.dice[0].dropped, undefined);
  assert.equal(r.dice[1].value, 8);
  assert.equal(r.dice[1].dropped, true);
  assert.equal(r.breakdown, "[14, ~8~] kh1 + 5 = 19");
});

test("keep lowest: 2d20kl1 keeps the low die", () => {
  const r = rollExt("2d20kl1", fixed([face(14, 20), face(8, 20)]));
  assert.equal(r.total, 8);
  assert.equal(r.dice[0].dropped, true);
  assert.equal(r.dice[1].dropped, undefined);
});

test("drop highest: 3d6dh1 drops only the highest die", () => {
  const r = rollExt("3d6dh1", fixed([face(5, 6), face(2, 6), face(6, 6)]));
  assert.equal(r.total, 7);
  assert.deepEqual(r.dice.map((d) => !!d.dropped), [false, false, true]);
});

test("drop lowest with default M: 4d6dl drops one lowest die", () => {
  const r = rollExt("4d6dl", fixed([face(4, 6), face(4, 6), face(1, 6), face(6, 6)]));
  assert.equal(r.total, 14);
  assert.deepEqual(r.dice.map((d) => !!d.dropped), [false, false, true, false]);
  assert.ok(r.breakdown.includes("~1~"));
  assert.ok(r.breakdown.includes("dl1"));
});

test("reroll default: r rerolls a 1 exactly once", () => {
  // die1 rolls 1 -> rerolled to 4; die2 rolls 3 (no reroll). Exactly 3 rng calls.
  const r = rollExt("2d6r", fixed([face(1, 6), face(4, 6), face(3, 6)]));
  assert.equal(r.total, 7);
  assert.equal(r.dice[0].value, 4);
  assert.equal(r.dice[0].rerolled, true);
  assert.equal(r.dice[1].rerolled, undefined);
});

test("reroll happens only once even if the new value is under threshold", () => {
  // 1d10r3: rolls 3 (<=3) -> rerolled to 2 (<=3 but kept, no second reroll).
  const r = rollExt("1d10r3", fixed([face(3, 10), face(2, 10)]));
  assert.equal(r.total, 2);
  assert.equal(r.dice[0].rerolled, true);
});

test("exploding: 1d6! chains on max rolls", () => {
  const r = rollExt("1d6!", fixed([face(6, 6), face(6, 6), face(2, 6)]));
  assert.equal(r.total, 14);
  assert.equal(r.dice.length, 3);
  assert.equal(r.dice[0].exploded, undefined);
  assert.equal(r.dice[1].exploded, true);
  assert.equal(r.dice[2].exploded, true);
});

test("exploding chain is capped at 10 extra dice", () => {
  // Every roll is a max face; chain must stop after 10 explosions (11 rng calls).
  const r = rollExt("1d4!", fixed(new Array(11).fill(face(4, 4))));
  assert.equal(r.dice.length, 11);
  assert.equal(r.total, 44);
});

test("d% is d100", () => {
  const r = rollExt("1d%+1", fixed([face(57, 100)]));
  assert.equal(r.dice[0].sides, 100);
  assert.equal(r.dice[0].value, 57);
  assert.equal(r.total, 58);
  assert.equal(parseDiceExpression("d%").valid, true);
  assert.equal(parseDiceExpression("d100").valid, true);
});

test("modifier arithmetic including negative net modifier", () => {
  const r = rollExt("1d8+3-5", fixed([face(4, 8)]));
  assert.equal(r.modifier, -2);
  assert.equal(r.total, 2);
  assert.equal(r.breakdown, "[4] - 2 = 2");
});

test("negative dice term subtracts from the total", () => {
  const r = rollExt("1d4-1d4", fixed([face(3, 4), face(2, 4)]));
  assert.equal(r.total, 1);
  assert.equal(r.breakdown, "[3] - [2] = 1");
});

test("mixed dice pools: 1d100+1d10+4", () => {
  const r = rollExt("1d100+1d10+4", fixed([face(42, 100), face(7, 10)]));
  assert.equal(r.total, 53);
  assert.equal(r.dice.length, 2);
});

test("validation: bad token", () => {
  const p = parseDiceExpression("2d6xx");
  assert.equal(p.valid, false);
  assert.ok(p.error && p.error.length > 0);
  assert.throws(() => rollExt("2d6xx"), new Error(p.error));
  assert.equal(parseDiceExpression("foo").valid, false);
  assert.equal(parseDiceExpression("").valid, false);
  assert.equal(parseDiceExpression("1d6++2").valid, false);
});

test("validation: too many dice", () => {
  assert.equal(parseDiceExpression("100d6").valid, true);
  const p = parseDiceExpression("101d6");
  assert.equal(p.valid, false);
  assert.match(p.error!, /max 100/);
  assert.equal(parseDiceExpression("60d6+41d4").valid, false);
});

test("validation: invalid die size", () => {
  const p = parseDiceExpression("1d7");
  assert.equal(p.valid, false);
  assert.match(p.error!, /d7/);
  assert.equal(parseDiceExpression("1d0").valid, false);
  assert.throws(() => rollExt("1d7"), new Error(p.error));
});

test("validation: too many terms, bad keep/drop and reroll ranges", () => {
  const p = parseDiceExpression(new Array(21).fill("1").join("+"));
  assert.equal(p.valid, false);
  assert.match(p.error!, /max 20/);
  assert.equal(parseDiceExpression("2d6kh3").valid, false); // keep more than rolled
  assert.equal(parseDiceExpression("2d6dh2").valid, false); // drop everything
  assert.equal(parseDiceExpression("1d6kh1kl1").valid, false); // conflicting keep/drop
  assert.equal(parseDiceExpression("1d6r6").valid, false); // reroll threshold >= sides
  assert.equal(parseDiceExpression("0d6").valid, false);
});

test("suffixes accepted in any order, whitespace-insensitive", () => {
  assert.equal(parseDiceExpression("3d6!r2kh2").valid, true);
  assert.equal(parseDiceExpression("3d6kh2r2!").valid, true);
  assert.equal(parseDiceExpression(" 2d20 kh1 + 5 ").valid, true);
  assert.equal(parseDiceExpression("1d20+8").valid, true);
  assert.equal(parseDiceExpression("4d8").valid, true);
});

test("crit: 2d20kh1 with kept natural 20", () => {
  const r = rollExt("2d20kh1+5", fixed([face(20, 20), face(5, 20)]));
  assert.equal(r.crit, true);
  assert.equal(r.fumble, false);
  assert.equal(r.total, 25);
});

test("no crit when the natural 20 is dropped", () => {
  const r = rollExt("2d20kl1", fixed([face(20, 20), face(5, 20)]));
  assert.equal(r.crit, false);
  assert.equal(r.total, 5);
});

test("fumble: kept natural 1; none when the 1 is dropped", () => {
  const kept = rollExt("2d20kl1", fixed([face(5, 20), face(1, 20)]));
  assert.equal(kept.fumble, true);
  assert.equal(kept.crit, false);
  const dropped = rollExt("2d20kh1", fixed([face(1, 20), face(15, 20)]));
  assert.equal(dropped.fumble, false);
});

test("crit/fumble come from the first d20 term only", () => {
  const r = rollExt("1d20+1d20", fixed([face(3, 20), face(20, 20)]));
  assert.equal(r.crit, false);
  assert.equal(r.fumble, false);
});

test("compatibility: plain 1d20+5 like the old roll()", () => {
  const r = rollExt("1d20+5", fixed([face(14, 20)]));
  assert.equal(r.total, 19);
  assert.equal(r.modifier, 5);
  assert.equal(r.breakdown, "[14] + 5 = 19");
  assert.equal(r.crit, false);
  assert.equal(r.fumble, false);
  const nat20 = rollExt("1d20+5", fixed([face(20, 20)]));
  assert.equal(nat20.crit, true);
});

test("compatibility: 2d6 with default rng stays in range", () => {
  for (let i = 0; i < 50; i++) {
    const r = rollExt("2d6");
    assert.equal(r.dice.length, 2);
    assert.ok(r.total >= 2 && r.total <= 12);
    for (const d of r.dice) assert.ok(d.value >= 1 && d.value <= 6);
  }
});

test("breakdown marks dropped dice with ~ ~", () => {
  const r = rollExt("2d20kh1+5", fixed([face(14, 20), face(8, 20)]));
  assert.ok(r.breakdown.includes("~8~"));
  assert.ok(!r.breakdown.includes("~14~"));
  assert.ok(r.breakdown.includes("kh1"));
  assert.ok(r.breakdown.endsWith("= 19"));
});
