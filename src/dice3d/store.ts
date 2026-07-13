// Tiny module store for the 3D dice overlay UI (roll cards + builder drawer).
// Same useSyncExternalStore pattern as the DiceTray store. No three.js here —
// this module stays light so the overlay chrome loads without the 3D engine.

export interface RollCardDie { sides: number; value: number; }

/** Structurally matches DiceTray's TrayEntry (minus id). */
export interface RollCardEntry {
  label: string;
  dice: RollCardDie[];
  total: number;
  breakdown: string;
  extra?: string;
  verdict?: string;
  crit?: boolean;
  fumble?: boolean;
}

export interface RollCard extends RollCardEntry { cardId: number; at: number; }

interface Dice3dState {
  cards: RollCard[];
  builderOpen: boolean;
  enabled: boolean; // persisted user toggle (localStorage "dice3d")
}

const STORAGE_KEY = "dice3d";
const CARD_TTL_MS = 8000;
const MAX_CARDS = 3;

function readEnabled(): boolean {
  if (typeof window === "undefined") return true;
  try { return window.localStorage.getItem(STORAGE_KEY) !== "0"; } catch { return true; }
}

let state: Dice3dState = { cards: [], builderOpen: false, enabled: readEnabled() };
let cardSeq = 0;
const listeners = new Set<() => void>();

function emit() { for (const l of listeners) l(); }
export function subscribe(cb: () => void) { listeners.add(cb); return () => { listeners.delete(cb); }; }
export function getSnapshot(): Dice3dState { return state; }

/** Add a roll card (auto-dismissed after 8s; max 3 visible). */
export function pushRollCard(entry: RollCardEntry) {
  if (typeof window === "undefined") return;
  const card: RollCard = { ...entry, cardId: ++cardSeq, at: Date.now() };
  state = { ...state, cards: [card, ...state.cards].slice(0, MAX_CARDS) };
  emit();
  window.setTimeout(() => dismissCard(card.cardId), CARD_TTL_MS);
}

export function dismissCard(cardId: number) {
  if (!state.cards.some((c) => c.cardId === cardId)) return;
  state = { ...state, cards: state.cards.filter((c) => c.cardId !== cardId) };
  emit();
}

export function openBuilder() { if (!state.builderOpen) { state = { ...state, builderOpen: true }; emit(); } }
export function closeBuilder() { if (state.builderOpen) { state = { ...state, builderOpen: false }; emit(); } }
export function toggleBuilder() { state = { ...state, builderOpen: !state.builderOpen }; emit(); }

export function getOverlayEnabled(): boolean { return state.enabled; }

/** Persisted 3D-overlay toggle. */
export function setOverlayEnabled(on: boolean) {
  if (typeof window !== "undefined") {
    try { window.localStorage.setItem(STORAGE_KEY, on ? "1" : "0"); } catch { /* ignore */ }
  }
  if (state.enabled !== on) { state = { ...state, enabled: on }; emit(); }
}
