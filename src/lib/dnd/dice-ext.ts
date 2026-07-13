// Extended dice-expression parser & roller. See docs/SPEC-PLAYER.he.md §19.7.
// Pure module, no dependencies, rng injectable for deterministic tests.
//
// Grammar (whitespace-insensitive, case-insensitive):
//   expression := [sign] term (('+' | '-') term)*
//   term       := integer | dice
//   dice       := [N] 'd' (X | '%') suffix*        (d% == d100, N defaults to 1)
//   suffix     := 'kh'[M] | 'kl'[M]                 keep highest/lowest M (default 1)
//               | 'dh'[M] | 'dl'[M]                 drop highest/lowest M (default 1)
//               | 'r'[Y]                            reroll once any die <= Y (default 1)
//               | '!'                               exploding die (chain capped at 10)
// Suffixes may appear in any order. Limits: max 100 dice, max 20 terms,
// X in {2,3,4,6,8,10,12,20,100}.

export interface ExtDie {
  sides: number;
  value: number;
  dropped?: boolean;
  exploded?: boolean;
  rerolled?: boolean;
}

export interface ExtRollResult {
  expression: string;
  dice: ExtDie[];
  modifier: number;
  total: number;
  breakdown: string;
  crit: boolean;
  fumble: boolean;
}

const ALLOWED_SIDES = new Set([2, 3, 4, 6, 8, 10, 12, 20, 100]);
const MAX_DICE = 100;
const MAX_TERMS = 20;
const EXPLODE_CAP = 10; // max chained explosion rolls per die

type KeepMode = "kh" | "kl" | "dh" | "dl";

interface DiceTerm {
  kind: "dice";
  sign: 1 | -1;
  count: number;
  sides: number;
  keep?: { mode: KeepMode; n: number };
  reroll?: number; // reroll once any die <= this threshold
  explode: boolean;
}

interface FlatTerm {
  kind: "flat";
  sign: 1 | -1;
  value: number;
}

type Term = DiceTerm | FlatTerm;

/** Parse an expression into terms. Throws Error with a user-facing message. */
function parse(expr: string): Term[] {
  const cleaned = expr.replace(/\s+/g, "").toLowerCase();
  if (cleaned === "") throw new Error("Empty dice expression");

  // Split into sign-prefixed chunks.
  const chunks: { sign: 1 | -1; text: string }[] = [];
  let i = 0;
  let sign: 1 | -1 = 1;
  if (cleaned[0] === "+") i = 1;
  else if (cleaned[0] === "-") { sign = -1; i = 1; }
  let start = i;
  for (; i <= cleaned.length; i++) {
    const ch = cleaned[i];
    if (i === cleaned.length || ch === "+" || ch === "-") {
      const text = cleaned.slice(start, i);
      if (text === "") throw new Error(`Invalid token in dice expression "${expr.trim()}"`);
      chunks.push({ sign, text });
      if (i < cleaned.length) {
        sign = ch === "-" ? -1 : 1;
        start = i + 1;
      }
    }
  }

  if (chunks.length > MAX_TERMS) throw new Error(`Too many terms (max ${MAX_TERMS})`);

  const terms: Term[] = [];
  let totalDice = 0;

  for (const { sign, text } of chunks) {
    // Flat integer term.
    if (/^\d+$/.test(text)) {
      terms.push({ kind: "flat", sign, value: parseInt(text, 10) });
      continue;
    }

    // Dice term: [N] d (X|%) suffixes
    const m = /^(\d*)d(%|\d+)(.*)$/.exec(text);
    if (!m) throw new Error(`Invalid token "${text}" in dice expression`);

    const count = m[1] === "" ? 1 : parseInt(m[1], 10);
    if (count < 1) throw new Error(`Invalid dice count in "${text}"`);
    const sides = m[2] === "%" ? 100 : parseInt(m[2], 10);
    if (!ALLOWED_SIDES.has(sides)) {
      throw new Error(
        `Invalid die size d${m[2]} (allowed: d2, d3, d4, d6, d8, d10, d12, d20, d100)`
      );
    }

    const term: DiceTerm = { kind: "dice", sign, count, sides, explode: false };

    let rest = m[3];
    while (rest !== "") {
      let sm: RegExpExecArray | null;
      if ((sm = /^(kh|kl|dh|dl)(\d*)/.exec(rest)) !== null) {
        if (term.keep) throw new Error(`Conflicting keep/drop modifiers in "${text}"`);
        const n = sm[2] === "" ? 1 : parseInt(sm[2], 10);
        term.keep = { mode: sm[1] as KeepMode, n };
        rest = rest.slice(sm[0].length);
      } else if ((sm = /^r(\d*)/.exec(rest)) !== null) {
        if (term.reroll !== undefined) throw new Error(`Duplicate reroll modifier in "${text}"`);
        term.reroll = sm[1] === "" ? 1 : parseInt(sm[1], 10);
        rest = rest.slice(sm[0].length);
      } else if (rest[0] === "!") {
        term.explode = true;
        rest = rest.slice(1);
      } else {
        throw new Error(`Invalid modifier "${rest}" in "${text}"`);
      }
    }

    if (term.keep) {
      const { mode, n } = term.keep;
      if (n < 1) throw new Error(`Keep/drop count must be at least 1 in "${text}"`);
      if ((mode === "kh" || mode === "kl") && n > count) {
        throw new Error(`Cannot keep ${n} of ${count} dice in "${text}"`);
      }
      if ((mode === "dh" || mode === "dl") && n >= count) {
        throw new Error(`Cannot drop ${n} of ${count} dice in "${text}"`);
      }
    }
    if (term.reroll !== undefined && (term.reroll < 1 || term.reroll >= sides)) {
      throw new Error(`Reroll threshold must be between 1 and ${sides - 1} in "${text}"`);
    }

    totalDice += count;
    if (totalDice > MAX_DICE) throw new Error(`Too many dice (max ${MAX_DICE})`);
    terms.push(term);
  }

  return terms;
}

/** Validate a dice expression without rolling it. */
export function parseDiceExpression(expr: string): { valid: boolean; error?: string } {
  try {
    parse(expr);
    return { valid: true };
  } catch (e) {
    return { valid: false, error: (e as Error).message };
  }
}

/**
 * Roll an extended dice expression. `rng` must return a float in [0, 1)
 * (defaults to Math.random). Throws Error on an invalid expression, with the
 * same message parseDiceExpression() reports.
 */
export function rollExt(expr: string, rng: () => number = Math.random): ExtRollResult {
  const terms = parse(expr);
  const rollOne = (sides: number) => Math.floor(rng() * sides) + 1;

  const dice: ExtDie[] = [];
  let modifier = 0;
  let diceTotal = 0;
  let crit = false;
  let fumble = false;
  let sawD20Term = false;
  const segments: { sign: 1 | -1; text: string }[] = [];

  for (const term of terms) {
    if (term.kind === "flat") {
      modifier += term.sign * term.value;
      continue;
    }

    // Roll base dice (with optional single reroll), then explosion chains.
    const rolled: { die: ExtDie; chain: ExtDie[] }[] = [];
    for (let k = 0; k < term.count; k++) {
      let value = rollOne(term.sides);
      let rerolled = false;
      if (term.reroll !== undefined && value <= term.reroll) {
        value = rollOne(term.sides); // reroll once, keep the new result
        rerolled = true;
      }
      const die: ExtDie = { sides: term.sides, value };
      if (rerolled) die.rerolled = true;

      const chain: ExtDie[] = [];
      if (term.explode) {
        let current = value;
        while (current === term.sides && chain.length < EXPLODE_CAP) {
          current = rollOne(term.sides);
          chain.push({ sides: term.sides, value: current, exploded: true });
        }
      }
      rolled.push({ die, chain });
    }

    // Keep/drop: rank base dice by value (explosion chains follow their die).
    if (term.keep) {
      const order = rolled.map((_, idx) => idx);
      order.sort((a, b) => rolled[b].die.value - rolled[a].die.value || a - b); // descending
      const { mode, n } = term.keep;
      let droppedIdx: number[];
      if (mode === "kh") droppedIdx = order.slice(n);
      else if (mode === "kl") droppedIdx = order.slice(0, order.length - n);
      else if (mode === "dh") droppedIdx = order.slice(0, n);
      else droppedIdx = order.slice(order.length - n);
      for (const idx of droppedIdx) {
        rolled[idx].die.dropped = true;
        for (const c of rolled[idx].chain) c.dropped = true;
      }
    }

    // Sum kept dice and collect for the result.
    let termSum = 0;
    const shown: string[] = [];
    for (const r of rolled) {
      if (!r.die.dropped) termSum += r.die.value;
      shown.push(r.die.dropped ? `~${r.die.value}~` : `${r.die.value}`);
      dice.push(r.die);
      for (const c of r.chain) {
        if (!c.dropped) termSum += c.value;
        shown.push(c.dropped ? `~${c.value}~` : `${c.value}`);
        dice.push(c);
      }
    }
    diceTotal += term.sign * termSum;

    // crit/fumble come from the FIRST d20 term: a kept natural 20 / natural 1.
    if (term.sides === 20 && !sawD20Term) {
      sawD20Term = true;
      for (const r of rolled) {
        if (!r.die.dropped) {
          if (r.die.value === 20) crit = true;
          if (r.die.value === 1) fumble = true;
        }
      }
    }

    let text = `[${shown.join(", ")}]`;
    if (term.keep) text += ` ${term.keep.mode}${term.keep.n}`;
    segments.push({ sign: term.sign, text });
  }

  const total = diceTotal + modifier;

  let breakdown = "";
  for (const seg of segments) {
    if (breakdown === "") breakdown = (seg.sign < 0 ? "-" : "") + seg.text;
    else breakdown += ` ${seg.sign < 0 ? "-" : "+"} ${seg.text}`;
  }
  if (modifier !== 0) {
    breakdown += breakdown === ""
      ? `${modifier}`
      : ` ${modifier > 0 ? "+" : "-"} ${Math.abs(modifier)}`;
  }
  if (breakdown === "") breakdown = "0";
  breakdown += ` = ${total}`;

  return { expression: expr, dice, modifier, total, breakdown, crit, fumble };
}
