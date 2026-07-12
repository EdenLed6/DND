// Dice engine. See docs/03-DND-BRAIN.md §10-11 and docs/06 §F.

export interface RollDie { sides: number; value: number; }
export interface RollResult {
  total: number;
  dice: RollDie[];
  modifier: number;
  expression: string;
  breakdown: string; // e.g. "[4,6] + 3 = 13"
  crit?: boolean;    // natural 20 on a single d20
  fumble?: boolean;  // natural 1 on a single d20
}

function rollOne(sides: number): number {
  return Math.floor(Math.random() * sides) + 1;
}

/** Roll a dice expression like "2d6+3", "1d20-1", "d8", "3". */
export function roll(expr: string, opts: { advantage?: boolean; disadvantage?: boolean } = {}): RollResult {
  const cleaned = expr.replace(/\s+/g, "").toLowerCase();
  // sum all XdY terms and flat modifiers
  const termRe = /([+-]?)(\d*)d(\d+)|([+-]?\d+)/g;
  const dice: RollDie[] = [];
  let modifier = 0;
  let m: RegExpExecArray | null;
  let firstD20Single = false;
  while ((m = termRe.exec(cleaned)) !== null) {
    if (m[3]) {
      const sign = m[1] === "-" ? -1 : 1;
      const count = m[2] === "" ? 1 : parseInt(m[2], 10);
      const sides = parseInt(m[3], 10);
      if (sides === 20 && count === 1) firstD20Single = true;
      for (let i = 0; i < count; i++) dice.push({ sides, value: sign * rollOne(sides) });
    } else if (m[4]) {
      modifier += parseInt(m[4], 10);
    }
  }

  // advantage/disadvantage applies to a single d20 roll
  let advNote = "";
  if (firstD20Single && (opts.advantage || opts.disadvantage) && !(opts.advantage && opts.disadvantage)) {
    const idx = dice.findIndex((d) => d.sides === 20);
    const a = dice[idx].value;
    const b = rollOne(20);
    const pick = opts.advantage ? Math.max(a, b) : Math.min(a, b);
    dice[idx].value = pick;
    advNote = ` (${opts.advantage ? "adv" : "dis"} ${a}/${b})`;
  }

  const diceSum = dice.reduce((s, d) => s + d.value, 0);
  const total = diceSum + modifier;
  const d20 = dice.find((d) => d.sides === 20);
  const crit = firstD20Single && d20?.value === 20;
  const fumble = firstD20Single && d20?.value === 1;

  const diceStr = dice.length ? `[${dice.map((d) => d.value).join(", ")}]${advNote}` : "";
  const modStr = modifier !== 0 ? ` ${modifier > 0 ? "+" : "-"} ${Math.abs(modifier)}` : "";
  const breakdown = `${diceStr}${modStr} = ${total}`.trim();

  return { total, dice, modifier, expression: expr, breakdown, crit, fumble };
}

/** Roll a d20 check with a numeric bonus. */
export function d20Check(bonus: number, opts: { advantage?: boolean; disadvantage?: boolean } = {}): RollResult {
  const sign = bonus >= 0 ? "+" : "-";
  return roll(`1d20${sign}${Math.abs(bonus)}`, opts);
}

/** Roll damage; on crit, double the number of dice (not the modifier). */
export function rollDamage(expr: string, crit = false): RollResult {
  if (!crit) return roll(expr);
  const cleaned = expr.replace(/\s+/g, "").toLowerCase();
  const doubled = cleaned.replace(/(\d*)d(\d+)/g, (_, c, s) => {
    const count = c === "" ? 1 : parseInt(c, 10);
    return `${count * 2}d${s}`;
  });
  const r = roll(doubled);
  r.crit = true;
  return r;
}

/** Average value of a dice expression (used for "take average HP"). */
export function averageOf(expr: string): number {
  const cleaned = expr.replace(/\s+/g, "").toLowerCase();
  const termRe = /([+-]?)(\d*)d(\d+)|([+-]?\d+)/g;
  let total = 0;
  let m: RegExpExecArray | null;
  while ((m = termRe.exec(cleaned)) !== null) {
    if (m[3]) {
      const sign = m[1] === "-" ? -1 : 1;
      const count = m[2] === "" ? 1 : parseInt(m[2], 10);
      const sides = parseInt(m[3], 10);
      total += sign * count * ((sides + 1) / 2);
    } else if (m[4]) total += parseInt(m[4], 10);
  }
  return Math.floor(total);
}

/** Roll on a rollable table (entries: {min,max,text}[]) using die dieType like "d100". */
export function rollTable(dieType: string, entries: { min: number; max: number; text: string }[]) {
  const r = roll(`1${dieType}`);
  const hit = entries.find((e) => r.total >= e.min && r.total <= e.max);
  return { roll: r.total, result: hit?.text ?? "(no result)" };
}
