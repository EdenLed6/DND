"use client";
// v2.2 "Character Shell" sticky header (SPEC-PLAYER §3.1, §20).
// Renders the expanded header card plus a sticky chrome strip (compact bar +
// section bar passed as children). PURE/CONTROLLED: persists nothing itself —
// all mutations go through the parent's onPatch / onRest / onLevelUp.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { formatMod } from "@/lib/dnd/rules";
import type { DerivedCharacter } from "@/lib/dnd/character";

export function CharacterHeader({
  c, derived, canEdit, canUse, canEditDef, editMode, onModeChange,
  xpInfo, canLevelUp, nextLevel, onPatch, onLevelUp, onRest, children,
}: {
  c: any;
  derived: DerivedCharacter;
  canEdit: boolean;
  canUse: boolean;
  canEditDef: boolean;
  editMode: boolean;
  onModeChange: (edit: boolean) => void;
  xpInfo: { current: number; next: number | null; pct: number };
  canLevelUp: boolean;
  nextLevel: number;
  onPatch: (body: any) => void;
  onLevelUp: () => void;
  onRest: (type: "SHORT" | "LONG") => void;
  children?: ReactNode; // section bar — rendered inside the sticky strip
}) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  // Sentinel sits at the bottom of the expanded header. When it scrolls up
  // behind the TopNav + sticky strip, swap in the compact bar.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(
      ([entry]) => setCollapsed(!entry.isIntersecting),
      { rootMargin: "-120px 0px 0px 0px", threshold: 0 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  function expand() {
    const reduce = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  }

  const hpPct = derived.maxHp > 0 ? Math.max(0, Math.min(100, Math.round((c.currentHp / derived.maxHp) * 100))) : 0;

  return (
    <>
      {/* ---- Expanded header (scrolls away) ---- */}
      <div>
        <div className="card flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => { if (!canEditDef) return; const url = window.prompt("Avatar image URL (blank to clear):", c.avatarUrl ?? ""); if (url !== null) onPatch({ avatarUrl: url || null }); }}
              className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#cdbf9f] bg-[#e9dfc5] text-2xl"
              title={canEditDef ? "Set avatar" : undefined} aria-label="Avatar">
              {c.avatarUrl ? <img src={c.avatarUrl} alt="" className="h-full w-full object-cover" /> : "🧙"}
            </button>
            <div>
              <h1 className="font-display text-2xl text-gold">{c.name}</h1>
              <div className="text-sm text-[#5e5448]">
                {c.raceId}{c.subrace ? ` (${c.subrace})` : ""} · {c.classes.map((cl: any) => `${cl.classId} ${cl.level}${cl.subclass ? ` (${cl.subclass})` : ""}`).join(" / ")} · {c.background} · {c.alignment}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            {/* DS shield plaques — AC / Initiative / HP always visible */}
            <div className="flex items-center gap-2" aria-label="Core stats">
              <div className="shield"><div><span className="k">Armor</span><span className="v">{derived.ac}</span></div></div>
              <div className="shield"><div><span className="k">Init</span><span className="v">{formatMod(derived.initiative)}</span></div></div>
              <div className="shield shield-hp"><div><span className="k">HP</span><span className="v">{c.currentHp}/{derived.maxHp}</span></div></div>
            </div>
            {canEdit && (
              <div className="tabbar rounded-full border border-[#cdbf9f] p-0.5" role="group" aria-label="Sheet mode">
                <button type="button" onClick={() => onModeChange(false)}
                  className="tab" data-active={!editMode} aria-pressed={!editMode} title="Use the character">▶ Play</button>
                <button type="button" onClick={() => onModeChange(true)}
                  className="tab" data-active={editMode} aria-pressed={editMode} title="Edit the character definition">✎ Edit</button>
              </div>
            )}
            <div className="text-center">
              <div className="text-xs text-[#5e5448]">Level</div>
              <div className="font-display text-2xl text-gold">{derived.totalLevel}</div>
            </div>
            <div className="min-w-[160px]">
              <div className="flex justify-between text-xs text-[#5e5448]"><span>XP</span><span>{c.xp}{xpInfo.next ? ` / ${xpInfo.next}` : ""}</span></div>
              <div className="mt-1 h-2 rounded bg-[#e9dfc5]"><div className="h-2 rounded bg-gold" style={{ width: `${xpInfo.pct}%` }} /></div>
              {canLevelUp && <div className="mt-1 text-xs text-green-700">⬆ Level up available (L{nextLevel})</div>}
            </div>
            {canEditDef && <button onClick={onLevelUp} className={canLevelUp ? "btn-gold" : "btn-ghost"} title="Level Up">⬆ Level Up</button>}
            <button onClick={() => canUse && onPatch({ inspiration: !c.inspiration })}
              className={c.inspiration ? "btn-gold" : "btn-ghost"} title="Inspiration">💡</button>
            <a href={`/api/characters/${c.id}/export`} className="btn-ghost" title="Export JSON" download>⬇</a>
            <a href={`/characters/${c.id}/summary`} className="btn-ghost" title="Print view">🖨</a>
          </div>
        </div>
        <div ref={sentinelRef} aria-hidden />
      </div>

      {/* ---- Sticky strip: compact bar (when scrolled) + section bar ---- */}
      <div className="sticky top-[57px] z-20 space-y-2 sm:top-[61px]">
        {collapsed && (
          <div className="char-compact text-sm" role="region" aria-label="Character summary">
            <button type="button" onClick={expand}
              className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#cdbf9f] bg-[#e9dfc5] text-base"
              aria-label="Scroll to top">
              {c.avatarUrl ? <img src={c.avatarUrl} alt="" className="h-full w-full object-cover" /> : "🧙"}
            </button>
            <b className="max-w-[8rem] truncate font-display sm:max-w-[14rem]">{c.name}</b>
            <span className="char-pill"><span className="k">AC</span><span className="v">{derived.ac}</span></span>
            <span className="char-pill"><span className="k">Init</span><span className="v">{formatMod(derived.initiative)}</span></span>
            {c.currentHp === 0 ? (
              <span className="chip char-dying whitespace-nowrap font-semibold">
                DYING — Death Saves ✓{c.deathSuccess} ✗{c.deathFail}
              </span>
            ) : (
              <span className="char-pill min-w-[64px]">
                <span className="k">HP</span>
                <span className="v">{c.currentHp}/{derived.maxHp}</span>
                <span className="char-hpbar"><span style={{ width: `${hpPct}%` }} /></span>
              </span>
            )}
            {c.concentration && (
              <span className="chip char-conc whitespace-nowrap">◉ Concentrating: {c.concentration}</span>
            )}
            <span className="flex-1" />
            {canUse && (
              <>
                <button className="btn-ghost btn-compact" onClick={() => onRest("SHORT")} title="Short Rest">Short Rest</button>
                <button className="btn-ghost btn-compact" onClick={() => onRest("LONG")} title="Long Rest">Long Rest</button>
              </>
            )}
            <button className="btn-ghost btn-compact" onClick={expand} title="Expand header" aria-label="Expand header">⌄</button>
          </div>
        )}
        {children}
      </div>
    </>
  );
}
