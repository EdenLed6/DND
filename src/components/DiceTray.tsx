"use client";
// D&D Beyond-style dice tray + roll log. Fixed at the bottom, collapsible.
// Any client component can call rollToTray(...) / pushTrayEntry(...) to feed it.
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import { roll, rollDamage, type RollDie } from "@/lib/dnd/dice";

// 3D physics dice overlay (SPEC-PLAYER §19) — client-only visual layer.
const DiceOverlay = dynamic(() => import("@/dice3d/DiceOverlay").then((m) => m.DiceOverlay), { ssr: false });
const OVERLAY_SIDES = [4, 6, 8, 10, 12, 20, 100];

// ---------------------------------------------------------------------------
// Tiny client store / singleton
// ---------------------------------------------------------------------------
export interface TrayEntry {
  id: number;
  label: string;
  dice: RollDie[];
  total: number;
  breakdown: string;
  extra?: string;      // e.g. "8 slashing damage"
  verdict?: string;    // "CRIT!", "HIT", "MISS", "NAT 1"
  crit?: boolean;
  fumble?: boolean;
  remote?: boolean;    // came from the campaign roll feed — never republish
}

// Optional campaign publisher: RollFeedListener registers one when the page
// has a campaign context, so local rolls are broadcast to the party.
let rollPublisher: ((e: TrayEntry) => void) | null = null;
export function setRollPublisher(fn: ((e: TrayEntry) => void) | null) { rollPublisher = fn; }

// Active character context: when a character sheet is open it registers its id
// so every roll is persisted to that character's roll log. Cleared on unmount.
let rollCharacterId: string | null = null;
export function setRollCharacter(id: string | null) { rollCharacterId = id; }

// Persist a roll to the durable roll log (fire-and-forget) and notify listeners
// (the per-character RollLogPanel refreshes on "roll-logged").
function persistRoll(e: TrayEntry) {
  if (e.remote || typeof window === "undefined") return; // never re-log feed rolls
  try {
    void fetch("/api/roll-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        characterId: rollCharacterId || undefined,
        label: e.label,
        expression: e.label,
        total: e.total,
        breakdown: e.breakdown + (e.extra ? `  ·  ${e.extra}` : ""),
      }),
    }).then(() => window.dispatchEvent(new Event("roll-logged"))).catch(() => {});
  } catch { /* logging is best-effort */ }
}

interface TrayState { current: TrayEntry | null; log: TrayEntry[]; }

let state: TrayState = { current: null, log: [] };
let counter = 0;
const listeners = new Set<() => void>();
function emit() { for (const l of listeners) l(); }
function subscribe(cb: () => void) { listeners.add(cb); return () => { listeners.delete(cb); }; }
function getSnapshot(): TrayState { return state; }

function push(entry: Omit<TrayEntry, "id">) {
  const e: TrayEntry = { ...entry, id: ++counter };
  state = { current: e, log: [e, ...state.log].slice(0, 40) };
  emit();
  // Broadcast local rolls to the campaign feed (never re-broadcast remote ones).
  if (!e.remote && rollPublisher) { try { rollPublisher(e); } catch { /* feed is optional */ } }
  // Persist to the durable per-character roll log.
  persistRoll(e);
  // Visual 3D overlay (fire-and-forget): throw physical dice over the UI and
  // show a roll card. The tray above stays the logical log / fallback.
  if (typeof window !== "undefined") {
    void import("@/dice3d")
      .then((m) => {
        if (!m.isOverlayAvailable()) return;
        m.pushRollCard(e);
        m.throwDice(
          e.dice.filter((d) => OVERLAY_SIDES.includes(d.sides)).slice(0, 20),
          { label: e.label },
        );
      })
      .catch(() => { /* overlay is optional */ });
  }
}

/** Roll a dice expression ("1d20+5", "2d6") and show it in the tray. */
export function rollToTray(
  label: string,
  expr: string,
  opts: { advantage?: boolean; disadvantage?: boolean; extra?: string; verdict?: string } = {},
) {
  const r = roll(expr, opts);
  push({
    label,
    dice: r.dice,
    total: r.total,
    breakdown: r.breakdown,
    extra: opts.extra,
    verdict: opts.verdict ?? (r.crit ? "CRIT!" : r.fumble ? "NAT 1" : undefined),
    crit: r.crit,
    fumble: r.fumble,
  });
}

/** Roll an attack: d20 to-hit then damage, shown as one entry. */
export function rollAttackToTray(
  label: string,
  toHit: number,
  damageExpr: string,
  damageType: string,
  opts: { advantage?: boolean; disadvantage?: boolean } = {},
) {
  const sign = toHit >= 0 ? "+" : "-";
  const atk = roll(`1d20${sign}${Math.abs(toHit)}`, opts);
  const dmg = damageExpr ? rollDamage(damageExpr, !!atk.crit) : null;
  const extra = dmg ? `${dmg.total} ${damageType} damage · ${dmg.breakdown}` : undefined;
  push({
    label,
    dice: atk.dice,
    total: atk.total,
    breakdown: atk.breakdown,
    extra,
    verdict: atk.crit ? "CRIT!" : atk.fumble ? "NAT 1" : undefined,
    crit: atk.crit,
    fumble: atk.fumble,
  });
}

/** Push a fully-formed entry (advanced callers). */
export function pushTrayEntry(entry: Omit<TrayEntry, "id">) { push(entry); }

// ---------------------------------------------------------------------------
// Dice shapes
// ---------------------------------------------------------------------------
const DIE_CLIP: Record<number, string> = {
  4: "polygon(50% 4%,96% 92%,4% 92%)",
  8: "polygon(50% 2%,90% 50%,50% 98%,10% 50%)",
  10: "polygon(50% 2%,88% 34%,74% 96%,26% 96%,12% 34%)",
  12: "polygon(50% 2%,90% 32%,76% 94%,24% 94%,10% 32%)",
  20: "polygon(28% 5%,72% 5%,97% 50%,72% 95%,28% 95%,3% 50%)",
};

function prefersReducedMotion() {
  return typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function Die({ die }: { die: RollDie }) {
  const sides = die.sides;
  const finalFace = Math.abs(die.value);
  const [face, setFace] = useState(finalFace);
  const [phase, setPhase] = useState<"rolling" | "landed" | "idle">("idle");

  useEffect(() => {
    if (prefersReducedMotion()) { setFace(finalFace); return; }
    setPhase("rolling");
    let n = 0;
    const iv = setInterval(() => {
      setFace(Math.floor(Math.random() * sides) + 1);
      if (++n > 7) {
        clearInterval(iv);
        setFace(finalFace);
        setPhase("landed");
        setTimeout(() => setPhase("idle"), 300);
      }
    }, 62);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cls =
    "die" +
    (sides === 6 ? " die-s6" : "") +
    (sides === 20 && finalFace === 20 ? " die-crit" : "") +
    (sides === 20 && finalFace === 1 ? " die-fumble" : "") +
    (phase === "rolling" ? " die-rolling" : phase === "landed" ? " die-landed" : "");

  return (
    <div className={cls} style={DIE_CLIP[sides] ? { clipPath: DIE_CLIP[sides] } : undefined} aria-hidden>
      {face}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tray
// ---------------------------------------------------------------------------
export function DiceTray() {
  const { current, log } = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const [collapsed, setCollapsed] = useState(false);
  const [showTotal, setShowTotal] = useState(true);
  const totalTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Delay the total reveal so it lands with the dice (unless reduced motion).
  useEffect(() => {
    if (!current) return;
    if (prefersReducedMotion()) { setShowTotal(true); return; }
    setShowTotal(false);
    if (totalTimer.current) clearTimeout(totalTimer.current);
    totalTimer.current = setTimeout(() => setShowTotal(true), 560);
    return () => { if (totalTimer.current) clearTimeout(totalTimer.current); };
  }, [current]);

  const verdictColor = (v?: string) =>
    v === "CRIT!" || v === "HIT" ? "var(--forest)" :
    v === "MISS" || v === "NAT 1" ? "var(--blood-bright)" :
    "var(--gold-bright)";

  return (
    <>
    <DiceOverlay />
    <div className={`dice-tray${collapsed ? " is-collapsed" : ""}`}>
      <button
        type="button"
        className="dice-tray-handle"
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
      >
        <span className="dice-tray-title">🎲 Dice Tray</span>
        <span className="faint" style={{ fontSize: 12 }}>{collapsed ? "▴ show" : "▾ hide"}</span>
      </button>

      <div className="dice-tray-inner">
        <div className="dice-tray-main">
          <div className="dice-tray-dice">
            {current && current.dice.length > 0
              ? current.dice.slice(0, 10).map((d, i) => <Die key={`${current.id}-${i}`} die={d} />)
              : <span className="faint" style={{ fontSize: 12 }}>🎲</span>}
          </div>
          <div className="dice-tray-info">
            <div className="dice-tray-lbl">
              {current ? current.label : "Tap any ability, save, skill, or attack to roll"}
            </div>
            <div>
              <span className="dice-tray-total">
                {current ? (showTotal ? current.total : "…") : "—"}
              </span>
              {current?.verdict && (
                <span className="dice-tray-verdict" style={{ color: verdictColor(current.verdict) }}>
                  {current.verdict}
                </span>
              )}
            </div>
            {current && (
              <div className="dice-tray-bd">
                {current.breakdown}{current.extra ? `  ·  ${current.extra}` : ""}
              </div>
            )}
          </div>
        </div>

        <div className="dice-tray-log">
          <div className="dice-tray-log-head">Roll Log</div>
          {log.length === 0 && <div className="faint" style={{ fontSize: 12 }}>No rolls yet.</div>}
          {log.map((e) => (
            <div key={e.id} className="dice-log-row">
              <span className="muted dice-log-label">{e.label}</span>
              <span className="dice-log-total">
                <b>{e.total}</b>
                {e.verdict && <span className="dice-log-verdict">{e.verdict}</span>}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="dice-tray-quick">
        <span className="faint" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".08em" }}>
          Quick roll
        </span>
        {["1d20", "1d4", "1d6", "1d8", "1d10", "1d12", "2d6"].map((q) => (
          <button key={q} type="button" className="btn-ghost dice-quick-btn" onClick={() => rollToTray(q.toUpperCase(), q)}>
            {q.replace("1", "")}
          </button>
        ))}
        <button type="button" className="btn-ghost dice-quick-btn" onClick={() => rollToTray("D20 (adv)", "1d20", { advantage: true })}>Adv</button>
        <button type="button" className="btn-ghost dice-quick-btn" onClick={() => rollToTray("D20 (dis)", "1d20", { disadvantage: true })}>Dis</button>
        <QuickExpr />
      </div>
    </div>
    </>
  );
}

function QuickExpr() {
  const [expr, setExpr] = useState("");
  const go = () => { const v = expr.trim(); if (v) rollToTray(v.toUpperCase(), v); };
  return (
    <>
      <input
        className="input dice-quick-input"
        placeholder="2d6+3"
        value={expr}
        onChange={(e) => setExpr(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") go(); }}
      />
      <button type="button" className="btn-gold dice-quick-btn" onClick={go}>Roll</button>
    </>
  );
}
