// Public API of the 3D physics dice overlay — SPEC-PLAYER.he.md §19.
// Parser-free: callers pass already-rolled dice ({sides, value}); the overlay
// is purely visual — after the physics settles, each die is reoriented so its
// top face shows the logical value. Client-only; every entry point no-ops on
// the server. The heavy three.js/cannon-es engine is imported lazily on the
// first throw.
import type { DieKind } from "./geometry";
import { getOverlayEnabled, setOverlayEnabled as storeSetEnabled } from "./store";

export {
  pushRollCard,
  dismissCard,
  openBuilder,
  closeBuilder,
  toggleBuilder,
  getOverlayEnabled,
  subscribe as subscribeDice3d,
  getSnapshot as getDice3dSnapshot,
} from "./store";
export type { RollCardEntry, RollCard, RollCardDie } from "./store";

const RENDERABLE_SIDES = [4, 6, 8, 10, 12, 20, 100];
const MAX_DICE = 20;

let webglOk: boolean | null = null;
function hasWebGL(): boolean {
  if (webglOk !== null) return webglOk;
  try {
    const canvas = document.createElement("canvas");
    webglOk = !!(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    webglOk = false;
  }
  return webglOk;
}

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** WebGL supported, user hasn't disabled the overlay, and motion is OK. */
export function isOverlayAvailable(): boolean {
  if (typeof window === "undefined") return false;
  return getOverlayEnabled() && !prefersReducedMotion() && hasWebGL();
}

/** Enable/disable the 3D overlay (persisted in localStorage "dice3d"). */
export function setOverlayEnabled(on: boolean): void {
  if (typeof window === "undefined") return;
  storeSetEnabled(on);
  if (!on) clearDice();
}

// d100 arrives as a single logical die (value 1-100) and is rendered as the
// classic percentile pair: a tens d10 labelled 00-90 plus a units d10.
function expand(dice: { sides: number; value: number }[]): { kind: DieKind; value: number }[] {
  const out: { kind: DieKind; value: number }[] = [];
  for (const d of dice) {
    if (!RENDERABLE_SIDES.includes(d.sides)) continue;
    const v = Math.abs(d.value);
    if (d.sides === 100) {
      const units = v % 10;
      const tens = Math.floor((v - units) / 10) % 10;
      out.push({ kind: 100, value: tens }, { kind: 101, value: units });
    } else {
      out.push({ kind: d.sides as DieKind, value: Math.min(Math.max(v, 1), d.sides) });
    }
  }
  return out.slice(0, MAX_DICE);
}

let engineLoaded = false;

/**
 * Throw physical dice over the UI. Fire-and-forget; the logical results were
 * already decided by the game RNG — each die settles showing its value.
 */
export function throwDice(dice: { sides: number; value: number }[], _meta?: { label?: string }): void {
  if (typeof window === "undefined" || !isOverlayAvailable()) return;
  const expanded = expand(dice);
  if (expanded.length === 0) return;
  engineLoaded = true;
  void import("./engine")
    .then((m) => m.getEngine().throwSet(expanded))
    .catch(() => { webglOk = false; });
}

/** Remove all 3D dice from the screen immediately. */
export function clearDice(): void {
  if (typeof window === "undefined" || !engineLoaded) return;
  void import("./engine").then((m) => m.peekEngine()?.clearAll()).catch(() => {});
}
