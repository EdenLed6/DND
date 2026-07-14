// Original hand-built SVG ornaments & iconography for the D&D theme.
// All inline (no external requests — works under the strict CSP and offline).
// Icons inherit `currentColor` so they pick up theme colors. CC0 / app-owned.
import * as React from "react";

type IconProps = React.SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 24, strokeWidth = 1.6, ...p }: IconProps) {
  return {
    width: size, height: size, viewBox: "0 0 24 24", fill: "none",
    stroke: "currentColor", strokeWidth, strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const, ...p,
  };
}

/** The iconic twenty-sided die. */
export function D20({ size = 24, ...p }: IconProps) {
  return (
    <svg {...base({ size, ...p })}>
      <path d="M12 2.5 21 7.5V16.5L12 21.5 3 16.5V7.5Z" />
      <path d="M12 2.5 6.5 6 12 9.5 17.5 6Z" />
      <path d="M12 9.5 6.5 6 3 7.5 6.5 13.5Z" />
      <path d="M12 9.5 17.5 6 21 7.5 17.5 13.5Z" />
      <path d="M12 9.5 6.5 13.5 12 21.5 17.5 13.5Z" />
      <text x="12" y="16.2" textAnchor="middle" fontSize="5.2" fill="currentColor" stroke="none" fontFamily="var(--font-display), serif" fontWeight="700">20</text>
    </svg>
  );
}

export function Sword({ size = 24, ...p }: IconProps) {
  return (
    <svg {...base({ size, ...p })}>
      <path d="M20 3.5 11 12.5M20 3.5l-.2 4.2-8.8 8.8M20 3.5l-4.2.2-8.8 8.8" />
      <path d="M7 12.5 4 15.5l1.5 1.5-2.5 2.5M8.5 14l3 3M6 17.5 3.5 20" />
      <path d="M10.5 16 14 19.5" />
    </svg>
  );
}

export function Shield({ size = 24, ...p }: IconProps) {
  return (
    <svg {...base({ size, ...p })}>
      <path d="M12 2.5 4.5 5.2V11c0 5 3.3 8.3 7.5 10.3C16.2 19.3 19.5 16 19.5 11V5.2Z" />
      <path d="M12 6v11M7 9.5h10" />
    </svg>
  );
}

export function Scroll({ size = 24, ...p }: IconProps) {
  return (
    <svg {...base({ size, ...p })}>
      <path d="M6 4.5h11a2 2 0 0 1 2 2v11" />
      <path d="M17 17.5a2 2 0 0 0 2 2H8a2 2 0 0 1-2-2V6.5a2 2 0 0 0-2-2 2 2 0 0 0-2 2V8h4" />
      <path d="M9 8.5h6M9 11.5h6M9 14.5h4" />
    </svg>
  );
}

export function Potion({ size = 24, ...p }: IconProps) {
  return (
    <svg {...base({ size, ...p })}>
      <path d="M10 3h4M10.5 3v4.5l-4 7A3 3 0 0 0 9.2 19h5.6a3 3 0 0 0 2.7-4.5l-4-7V3" />
      <path d="M7.4 13.5h9.2" />
      <circle cx="11" cy="16" r=".6" fill="currentColor" stroke="none" />
      <circle cx="13.5" cy="15" r=".5" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function Wand({ size = 24, ...p }: IconProps) {
  return (
    <svg {...base({ size, ...p })}>
      <path d="M5 19 16 8" />
      <path d="M18 3.5l.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9L15.4 6l1.9-.6Z" fill="currentColor" stroke="none" />
      <path d="M6.5 10.5l.5 1.3 1.3.5-1.3.5-.5 1.3-.5-1.3L4.7 12.8 6 12.3Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function Dragon({ size = 24, ...p }: IconProps) {
  return (
    <svg {...base({ size, ...p })}>
      <path d="M3 15c2-1 3-3 3-5 0-1.5 1-3 3-3.5 0 0-1-2 .5-3 .3 1.2 1.5 1.5 1.5 1.5S16 6 18 8c1.5 1.5 3 1.5 3 1.5s-1.5 1.5-3.5 1c.8 1 .5 2.5.5 2.5s1.5.3 2 1.5c-1.2.2-2 0-2 0 .3 1.3-.5 2.5-.5 2.5s-1-.7-1.5-2c-1 .8-3 1-4.5.5" />
      <path d="M9 19c-1.5 0-3.5-1-4.5-2.5" />
      <circle cx="16.5" cy="8.5" r=".7" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function Book({ size = 24, ...p }: IconProps) {
  return (
    <svg {...base({ size, ...p })}>
      <path d="M5 4.5h9a2 2 0 0 1 2 2v12l-2-1.2-9 .2a1.5 1.5 0 0 1-1.5-1.5V6a1.5 1.5 0 0 1 1.5-1.5Z" />
      <path d="M16 6.5h2.5A1.5 1.5 0 0 1 20 8v10.5l-4-1.7" />
      <path d="M8 8.5h5M8 11h5" />
    </svg>
  );
}

export function Coin({ size = 24, ...p }: IconProps) {
  return (
    <svg {...base({ size, ...p })}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="5.5" />
      <path d="M12 9v6M10.5 12h3" />
    </svg>
  );
}

export function Skull({ size = 24, ...p }: IconProps) {
  return (
    <svg {...base({ size, ...p })}>
      <path d="M12 3.5c-4.4 0-7.5 3-7.5 7 0 2.4 1.2 4 2.5 5v2.5a1.5 1.5 0 0 0 1.5 1.5h7a1.5 1.5 0 0 0 1.5-1.5V15.5c1.3-1 2.5-2.6 2.5-5 0-4-3.1-7-7.5-7Z" />
      <circle cx="9" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="15" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <path d="M11 16.5v2M13 16.5v2" />
    </svg>
  );
}

export function Helmet({ size = 24, ...p }: IconProps) {
  return (
    <svg {...base({ size, ...p })}>
      <path d="M4.5 12a7.5 7.5 0 0 1 15 0v3.5a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2Z" />
      <path d="M12 4.5v13M4.5 12h15M8 17.5v-4M16 17.5v-4" />
    </svg>
  );
}

const ICONS = { D20, Sword, Shield, Scroll, Potion, Wand, Dragon, Book, Coin, Skull, Helmet };
export type OrnamentIconName = keyof typeof ICONS;
export function Icon({ name, ...p }: { name: OrnamentIconName } & IconProps) {
  const C = ICONS[name];
  return <C {...p} />;
}

/** A filigree corner flourish. Rotate via CSS to place on any corner. */
export function CornerFlourish({ size = 44, className = "", style }: { size?: number; className?: string; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden className={className} style={style}>
      <path d="M2 2c14 0 24 2 30 8M2 2c0 14 2 24 8 30" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M2 10c8 0 14 3 18 9M10 2c0 8 3 14 9 18" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity=".7" />
      <circle cx="24" cy="24" r="2.2" fill="currentColor" opacity=".9" />
      <path d="M24 20c1.5 0 3 1.5 3 4M20 24c0-1.5 1.5-3 4-3" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity=".7" />
    </svg>
  );
}

/** A horizontal divider: gold rules sweeping into a center diamond + small die. */
export function DividerFlourish({ className = "", withDie = true }: { className?: string; withDie?: boolean }) {
  return (
    <div className={`flex items-center justify-center gap-2 text-[var(--gold)] ${className}`} aria-hidden>
      <svg width="120" height="14" viewBox="0 0 120 14" fill="none" className="max-w-[35vw]">
        <path d="M0 7h84" stroke="currentColor" strokeWidth="1.2" />
        <path d="M92 7l8-4v8Z" fill="currentColor" opacity=".55" />
        <path d="M108 3l4 4-4 4-4-4Z" stroke="currentColor" strokeWidth="1.2" fill="none" />
      </svg>
      {withDie && <D20 size={18} className="text-[var(--gold)]" />}
      <svg width="120" height="14" viewBox="0 0 120 14" fill="none" className="max-w-[35vw]">
        <path d="M36 7h84" stroke="currentColor" strokeWidth="1.2" />
        <path d="M28 7l-8-4v8Z" fill="currentColor" opacity=".55" />
        <path d="M12 3l4 4-4 4-4-4Z" stroke="currentColor" strokeWidth="1.2" fill="none" />
      </svg>
    </div>
  );
}

/** A wax-seal style crest with a dragon, for hero sections. */
export function DragonCrest({ size = 96, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 96 96" fill="none" aria-hidden className={className}>
      <circle cx="48" cy="48" r="44" stroke="var(--gold)" strokeWidth="2" fill="url(#crestg)" />
      <circle cx="48" cy="48" r="38" stroke="var(--gold)" strokeWidth="1" opacity=".6" />
      <defs>
        <radialGradient id="crestg" cx="50%" cy="38%" r="70%">
          <stop offset="0%" stopColor="#fbf7ea" />
          <stop offset="100%" stopColor="#efe4c8" />
        </radialGradient>
      </defs>
      {/* laurel dots around the ring */}
      {Array.from({ length: 24 }).map((_, i) => {
        const a = (i / 24) * Math.PI * 2;
        return <circle key={i} cx={48 + Math.cos(a) * 41} cy={48 + Math.sin(a) * 41} r=".9" fill="var(--gold)" opacity=".7" />;
      })}
      <g transform="translate(24 26) scale(2)" className="text-[var(--heading)]">
        <Dragon size={24} />
      </g>
    </svg>
  );
}
