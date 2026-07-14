// Heraldic class crests — filled, roundel-style SVG emblems for the 12 core
// classes. Original / CC0, inline (CSP-safe, offline). Each is a gilded
// medallion with a class-colored field and a white symbol.
import * as React from "react";

type ClassKey =
  | "barbarian" | "bard" | "cleric" | "druid" | "fighter" | "monk"
  | "paladin" | "ranger" | "rogue" | "sorcerer" | "warlock" | "wizard";

const COLORS: Record<ClassKey, string> = {
  barbarian: "#9e3b2e", bard: "#b5487e", cleric: "#c19a34", druid: "#4f7a3f",
  fighter: "#61656d", monk: "#cf7b3b", paladin: "#b89a44", ranger: "#3f6b4a",
  rogue: "#474a55", sorcerer: "#b0432f", warlock: "#6e4b8f", wizard: "#3f5a8f",
};

// Each symbol is drawn centered in a 48×48 field, in white strokes/fills.
const SYMBOLS: Record<ClassKey, React.ReactNode> = {
  // Greataxe
  barbarian: (
    <g stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none">
      <path d="M24 12v26" />
      <path d="M24 13c5-4 11-3 13 1-4 1-8 2-13 4M24 13c-5-4-11-3-13 1 4 1 8 2 13 4" fill="#fff" />
    </g>
  ),
  // Lute
  bard: (
    <g stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none">
      <ellipse cx="21" cy="30" rx="8" ry="9" fill="#fff" fillOpacity=".9" stroke="none" />
      <circle cx="21" cy="30" r="2.4" fill={COLORS.bard} stroke="none" />
      <path d="M26 25 36 13M34 11l3 3" />
    </g>
  ),
  // Sunburst
  cleric: (
    <g stroke="#fff" strokeWidth="2" strokeLinecap="round" fill="none">
      <circle cx="24" cy="24" r="6.5" fill="#fff" stroke="none" />
      {Array.from({ length: 8 }).map((_, i) => {
        const a = (i / 8) * Math.PI * 2;
        return <path key={i} d={`M${24 + Math.cos(a) * 10} ${24 + Math.sin(a) * 10}L${24 + Math.cos(a) * 15} ${24 + Math.sin(a) * 15}`} />;
      })}
    </g>
  ),
  // Leaf / crescent
  druid: (
    <g stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none">
      <path d="M16 32c0-10 8-18 18-18 0 10-8 18-18 18Z" fill="#fff" fillOpacity=".92" stroke="none" />
      <path d="M18 30 30 18" stroke={COLORS.druid} strokeWidth="1.6" />
    </g>
  ),
  // Crossed swords
  fighter: (
    <g stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none">
      <path d="M14 14 32 32M14 34l4-4M30 12l4 4" />
      <path d="M34 14 16 32M34 34l-4-4M18 12l-4 4" />
    </g>
  ),
  // Open fist
  monk: (
    <g stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none">
      <path d="M18 26v-6a2 2 0 0 1 4 0v4M22 22v-5a2 2 0 0 1 4 0v5M26 23v-4a2 2 0 0 1 4 0v6c0 5-3 9-8 9s-8-3-8-8v-2a2 2 0 0 1 4 0" fill="#fff" fillOpacity=".9" />
    </g>
  ),
  // Radiant sword
  paladin: (
    <g stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none">
      <path d="M24 12v20M18 30h12" />
      <path d="M24 32l-3 6h6Z" fill="#fff" stroke="none" />
      {Array.from({ length: 5 }).map((_, i) => {
        const a = -Math.PI / 2 + (i - 2) * 0.5;
        return <path key={i} d={`M${24 + Math.cos(a) * 8} ${14 + Math.sin(a) * 3}L${24 + Math.cos(a) * 12} ${13 + Math.sin(a) * 4}`} strokeWidth="1.4" />;
      })}
    </g>
  ),
  // Bow & arrow
  ranger: (
    <g stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none">
      <path d="M16 12c8 4 8 20 0 24" />
      <path d="M16 12 16 36" strokeWidth="1.4" />
      <path d="M12 24h24M32 20l4 4-4 4" />
    </g>
  ),
  // Dagger + shadow hood
  rogue: (
    <g stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none">
      <path d="M24 12 27 26 24 30 21 26Z" fill="#fff" stroke="none" />
      <path d="M20 30h8M24 30v6" />
    </g>
  ),
  // Draconic flame
  sorcerer: (
    <g stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none">
      <path d="M24 12c4 4 6 8 6 12a6 6 0 0 1-12 0c0-2 1-4 2-5 0 3 2 4 3 4-2-4 0-8 1-11Z" fill="#fff" fillOpacity=".92" stroke="none" />
    </g>
  ),
  // Occult eye
  warlock: (
    <g stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none">
      <path d="M12 24c4-6 8-9 12-9s8 3 12 9c-4 6-8 9-12 9s-8-3-12-9Z" />
      <circle cx="24" cy="24" r="4" fill="#fff" stroke="none" />
      <circle cx="24" cy="24" r="1.6" fill={COLORS.warlock} stroke="none" />
    </g>
  ),
  // Arcane star
  wizard: (
    <g stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none">
      <path d="M24 12v24M14 18l20 12M34 18 14 30" />
      <circle cx="24" cy="24" r="3" fill="#fff" stroke="none" />
    </g>
  ),
};

function normalize(name: string): ClassKey | null {
  const k = name.trim().toLowerCase();
  return (k in COLORS ? (k as ClassKey) : null);
}

/** A heraldic crest for a class (SRD names like "Fighter" work). Falls back to
 *  a neutral gilded roundel with the class initial. */
export function ClassCrest({ name, size = 48, ring = true, title, cssClass = "" }:
  { name: string; size?: number; ring?: boolean; title?: string; cssClass?: string }) {
  const key = normalize(name);
  const color = key ? COLORS[key] : "#8a7a55";
  const gradId = `cc-${key ?? "generic"}`;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" role="img" aria-label={title ?? `${name} emblem`} className={cssClass}>
      <defs>
        <radialGradient id={gradId} cx="50%" cy="38%" r="70%">
          <stop offset="0%" stopColor={color} stopOpacity="0.95" />
          <stop offset="100%" stopColor={color} stopOpacity="0.72" />
        </radialGradient>
      </defs>
      {ring && <circle cx="24" cy="24" r="23" fill="none" stroke="var(--gold, #b58a42)" strokeWidth="2" />}
      <circle cx="24" cy="24" r={ring ? 20 : 23} fill={`url(#${gradId})`} stroke="rgba(0,0,0,.18)" strokeWidth="1" />
      <circle cx="24" cy="24" r={ring ? 17 : 20} fill="none" stroke="rgba(255,255,255,.25)" strokeWidth="1" />
      {key ? SYMBOLS[key] : (
        <text x="24" y="30" textAnchor="middle" fontSize="18" fill="#fff" fontFamily="var(--font-display), serif" fontWeight="700">
          {name.slice(0, 1).toUpperCase()}
        </text>
      )}
    </svg>
  );
}

export const CLASS_KEYS = Object.keys(COLORS) as ClassKey[];
export function classColor(name: string): string {
  const k = normalize(name);
  return k ? COLORS[k] : "#8a7a55";
}
