// Creature art — filled silhouette medallions keyed to the 14 SRD monster
// types. Original / CC0, inline (CSP-safe, offline). Used in the bestiary and
// enemy cards so every monster reads at a glance by its kind.
import * as React from "react";

type TypeKey =
  | "aberration" | "beast" | "celestial" | "construct" | "dragon" | "elemental"
  | "fey" | "fiend" | "giant" | "humanoid" | "monstrosity" | "ooze" | "plant" | "undead";

const TINT: Record<TypeKey, string> = {
  aberration: "#6e4b8f", beast: "#7a5a34", celestial: "#c1a24a", construct: "#5f6b74",
  dragon: "#9e3b2e", elemental: "#3f6f8f", fey: "#4f8f6a", fiend: "#8a2f2f",
  giant: "#7a6242", humanoid: "#4f6a8f", monstrosity: "#7a4a5a", ooze: "#5f7a3f",
  plant: "#4f7a3f", undead: "#5a6b5f",
};

// Silhouettes centered in a 48×48 field, drawn in white on the tinted disc.
const ART: Record<TypeKey, React.ReactNode> = {
  // Tentacled maw
  aberration: (
    <g fill="#fff">
      <circle cx="24" cy="20" r="7" />
      <circle cx="24" cy="20" r="2.4" fill={TINT.aberration} />
      <path d="M18 25c-2 4-5 6-8 6 2-3 3-6 3-9ZM30 25c2 4 5 6 8 6-2-3-3-6-3-9ZM22 27c-1 5-2 8-4 10 0-4 1-7 2-11ZM26 27c1 5 2 8 4 10 0-4-1-7-2-11Z" />
    </g>
  ),
  // Wolf head
  beast: (
    <g fill="#fff">
      <path d="M14 16l4 4 6-2 6 2 4-4-1 7 3 3-5 2-2 6-5-3-5 3-2-6-5-2 3-3Z" />
      <circle cx="20" cy="24" r="1.4" fill={TINT.beast} />
      <circle cx="28" cy="24" r="1.4" fill={TINT.beast} />
    </g>
  ),
  // Winged halo
  celestial: (
    <g fill="#fff">
      <circle cx="24" cy="18" r="4" />
      <path d="M24 12a6 6 0 0 1 0 12" fill="none" stroke="#fff" strokeWidth="1.4" />
      <path d="M20 24c-6-2-10 0-13 3 5 1 9 3 13 6ZM28 24c6-2 10 0 13 3-5 1-9 3-13 6Z" />
    </g>
  ),
  // Cog golem
  construct: (
    <g fill="#fff">
      <rect x="17" y="17" width="14" height="14" rx="2" />
      <circle cx="24" cy="24" r="3.4" fill={TINT.construct} />
      {Array.from({ length: 8 }).map((_, i) => {
        const a = (i / 8) * Math.PI * 2;
        return <rect key={i} x={23} y={9} width="2" height="4" transform={`rotate(${(i * 45)} 24 24)`} />;
      })}
    </g>
  ),
  // Dragon head + wing
  dragon: (
    <g fill="#fff">
      <path d="M12 30c3-1 5-4 5-7 0-3 2-5 5-6 0 0-1-3 1-4 0 2 2 2 2 2s5 0 8 3c2 2 4 2 4 2s-2 2-5 1c1 2 0 4 0 4s2 1 2 3c-2 0-3-1-3-1 0 2-1 3-1 3s-2-1-3-3c-2 1-5 1-7 0" />
      <circle cx="30" cy="22" r="1.3" fill={TINT.dragon} />
    </g>
  ),
  // Flame swirl
  elemental: (
    <g fill="#fff">
      <path d="M24 11c4 4 7 8 7 13a7 7 0 0 1-14 0c0-3 1-5 3-7 0 3 2 5 3 5-2-4 0-8 1-11Z" />
      <circle cx="24" cy="27" r="2.4" fill={TINT.elemental} />
    </g>
  ),
  // Butterfly/moth wings
  fey: (
    <g fill="#fff">
      <path d="M24 16c-3-4-8-5-11-3 1 4 4 7 8 8-4 1-6 3-7 6 4 1 8-1 10-5ZM24 16c3-4 8-5 11-3-1 4-4 7-8 8 4 1 6 3 7 6-4 1-8-1-10-5Z" />
      <circle cx="24" cy="18" r="1.8" fill={TINT.fey} />
    </g>
  ),
  // Horned skull / devil
  fiend: (
    <g fill="#fff">
      <path d="M14 15c1 3 3 4 3 4M34 15c-1 3-3 4-3 4" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <path d="M24 17c-5 0-9 3-9 8 0 3 2 5 3 6l1 4h10l1-4c1-1 3-3 3-6 0-5-4-8-9-8Z" />
      <path d="M21 27l3 3 3-3" stroke={TINT.fiend} strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <circle cx="20.5" cy="25" r="1.3" fill={TINT.fiend} />
      <circle cx="27.5" cy="25" r="1.3" fill={TINT.fiend} />
    </g>
  ),
  // Fist / club
  giant: (
    <g fill="#fff">
      <path d="M24 12c6 0 11 3 11 9 0 8-5 15-11 15S13 29 13 21c0-6 5-9 11-9Z" />
      <path d="M19 22h10M19 27h10" stroke={TINT.giant} strokeWidth="1.6" strokeLinecap="round" />
    </g>
  ),
  // Helmed figure
  humanoid: (
    <g fill="#fff">
      <circle cx="24" cy="18" r="5" />
      <path d="M14 37c0-6 4-10 10-10s10 4 10 10Z" />
      <path d="M24 13v10" stroke={TINT.humanoid} strokeWidth="1.4" />
    </g>
  ),
  // Chimera / many eyes
  monstrosity: (
    <g fill="#fff">
      <path d="M15 18l4 3 5-2 5 2 4-3-1 8 2 3-4 2-2 5-4-3-4 3-2-5-4-2 2-3Z" />
      <circle cx="20" cy="23" r="1.3" fill={TINT.monstrosity} />
      <circle cx="28" cy="23" r="1.3" fill={TINT.monstrosity} />
      <circle cx="24" cy="27" r="1.3" fill={TINT.monstrosity} />
    </g>
  ),
  // Blob
  ooze: (
    <g fill="#fff">
      <path d="M14 30c0-7 4-13 10-13s10 6 10 13c0 3-2 4-4 4-1 0-2-1-3-1s-2 2-3 2-2-2-3-2-2 1-3 1c-2 0-4-1-4-4Z" />
      <circle cx="21" cy="25" r="1.6" fill={TINT.ooze} />
      <circle cx="28" cy="26" r="1.3" fill={TINT.ooze} />
    </g>
  ),
  // Leaf / vine
  plant: (
    <g fill="#fff">
      <path d="M24 36V18M24 18c-6 0-10 4-10 4s4 4 10 4M24 22c6 0 10-4 10-4s-4-4-10-4" />
      <path d="M24 20v8" stroke={TINT.plant} strokeWidth="1.4" />
    </g>
  ),
  // Skull
  undead: (
    <g fill="#fff">
      <path d="M24 13c-6 0-10 4-10 9 0 3 1 5 3 6v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4c2-1 3-3 3-6 0-5-4-9-10-9Z" />
      <circle cx="20" cy="23" r="2.2" fill={TINT.undead} />
      <circle cx="28" cy="23" r="2.2" fill={TINT.undead} />
      <path d="M22 29v3M26 29v3" stroke={TINT.undead} strokeWidth="1.4" strokeLinecap="round" />
    </g>
  ),
};

function normalize(type?: string | null): TypeKey | null {
  if (!type) return null;
  const k = type.trim().toLowerCase().split(/[\s(]/)[0]; // "Swarm of beasts" -> "swarm"; keep first word
  return (k in TINT ? (k as TypeKey) : null);
}

/** A tinted medallion illustrating a creature by its type. */
export function CreatureArt({ type, size = 44, title, cssClass = "" }:
  { type?: string | null; size?: number; title?: string; cssClass?: string }) {
  const key = normalize(type);
  const tint = key ? TINT[key] : "#7a6a4a";
  const gradId = `ca-${key ?? "generic"}`;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" role="img" aria-label={title ?? `${type ?? "creature"} illustration`} className={cssClass}>
      <defs>
        <radialGradient id={gradId} cx="50%" cy="36%" r="72%">
          <stop offset="0%" stopColor={tint} stopOpacity="0.95" />
          <stop offset="100%" stopColor={tint} stopOpacity="0.7" />
        </radialGradient>
      </defs>
      <circle cx="24" cy="24" r="23" fill="none" stroke="var(--gold, #b58a42)" strokeWidth="2" />
      <circle cx="24" cy="24" r="20" fill={`url(#${gradId})`} stroke="rgba(0,0,0,.18)" strokeWidth="1" />
      {key ? ART[key] : (
        <text x="24" y="30" textAnchor="middle" fontSize="16" fill="#fff" fontFamily="var(--font-display), serif" fontWeight="700">?</text>
      )}
    </svg>
  );
}

export function typeTint(type?: string | null): string {
  const k = normalize(type);
  return k ? TINT[k] : "#7a6a4a";
}
