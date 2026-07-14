"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { DndContext, useDraggable, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { restrictToParentElement } from "@dnd-kit/modifiers";
import { useRealtime, useWatchEncounter } from "@/lib/realtime/useRealtime";
import { CONDITION_PRESETS, parseAutomation } from "@/lib/dnd/conditions";
import { roll } from "@/lib/dnd/dice";

export function PlayScreen({ encId, campaignId, initialState, campaignChars, maps, isDM, myCharacterIds }: {
  encId: string; campaignId: string; initialState: any; campaignChars: any[]; maps: any[];
  isDM: boolean; myCharacterIds: string[];
}) {
  const [state, setState] = useState(initialState);
  const [tab, setTab] = useState<"build" | "attack">("build");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [applyFor, setApplyFor] = useState<string | null>(null); // combatantId for the Add Condition modal
  const [prompts, setPrompts] = useState<any[]>([]); // pending turn-automation prompts (DM)

  useWatchEncounter(encId);

  const refetch = useCallback(async () => {
    const r = await fetch(`/api/encounters/${encId}`);
    if (r.ok) setState(await r.json());
  }, [encId]);

  useRealtime({
    "combatants:changed": refetch,
    "combatant:changed": refetch,
    "initiative:set": refetch,
    "turn:advanced": refetch,
    "log:appended": refetch,
    "token:moved": ({ tokenId, gridX, gridY }: any) =>
      setState((s: any) => ({ ...s, tokens: s.tokens.map((t: any) => t.id === tokenId ? { ...t, gridX, gridY } : t) })),
    "fog:changed": ({ fogEnabled, revealedCells }: any) =>
      setState((s: any) => ({ ...s, fogEnabled, revealedCells: revealedCells ?? s.revealedCells })),
  }, [encId]);

  async function op(body: any) {
    const r = await fetch(`/api/encounters/${encId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (body.op !== "moveToken") await refetch();
    return r.ok ? r.json() : null;
  }

  /** POST to the conditions endpoint, then refetch state. */
  async function condOp(body: any) {
    const r = await fetch(`/api/encounters/${encId}/conditions`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const data = r.ok ? await r.json() : null;
    await refetch();
    return data;
  }

  const combatants: any[] = state?.combatants ?? [];
  const activeId = state?.status === "ACTIVE" ? combatants[state.turnIndex]?.id : null;
  const selected = combatants.find((c) => c.id === selectedId) ?? null;
  // Combatants this player controls (their sheet is owned by the caller).
  const myCombatants = combatants.filter((c) => c.characterId && myCharacterIds.includes(c.characterId));

  // Undo is possible when a visible log entry recorded pre-damage HP, hasn't
  // been undone yet, and its combatant is still in the encounter.
  const canUndo = isDM && (state?.log ?? []).some((l: any) => {
    try {
      const d = JSON.parse(l.detailJson || "null");
      return !!d && (d.kind === "damage" || d.kind === "heal") && !d.undone &&
        combatants.some((c) => c.id === d.combatantId);
    } catch { return false; }
  });

  /** DM: advance the turn, then tick conditions for the combatant whose turn
   *  ended (phase "end") and the one whose turn starts (phase "start"). The
   *  server returns damage/save prompts for the DM to confirm. */
  async function nextTurn() {
    const endingId = combatants[state?.turnIndex]?.id ?? null;
    const startingId = combatants.length ? combatants[(state.turnIndex + 1) % combatants.length]?.id ?? null : null;
    await op({ op: "turn", dir: "next" });
    const collected: any[] = [];
    for (const [cid, phase] of [[endingId, "end"], [startingId, "start"]] as const) {
      if (!cid) continue;
      const d = await condOp({ op: "tick", combatantId: cid, phase });
      if (d?.prompts?.length) collected.push(...d.prompts);
    }
    if (collected.length) {
      setPrompts((list) => [
        ...list,
        ...collected.filter((p) => !list.some((x) => x.conditionId === p.conditionId && x.kind === p.kind)),
      ]);
    }
  }

  function dropPrompt(p: any) { setPrompts((list) => list.filter((x) => x !== p)); }

  async function resolveDamagePrompt(p: any) {
    const res = roll(p.expr); // DM confirms; we roll client-side via the shared dice engine
    // Goes through the encounter "damage" op so the hit is undoable from the combat log.
    await op({
      op: "damage", combatantId: p.targetId, amount: res.total,
      label: `${p.name}${p.damageType ? ` (${p.damageType})` : ""}`, breakdown: res.breakdown,
    });
    dropPrompt(p);
  }

  async function resolveSavePrompt(p: any, passed: boolean) {
    await condOp({ op: "saveResult", conditionId: p.conditionId, passed });
    dropPrompt(p);
  }

  return (
    <main className="mx-auto max-w-7xl space-y-3 p-3">
      <div className="card flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-display text-xl text-gold">⚔ {state?.name}</h1>
          <div className="text-sm text-[#5e5448]">
            Status: {state?.status} {state?.status === "ACTIVE" && `· Round ${state.round}`}
          </div>
        </div>
        {isDM && (
          <div className="flex flex-wrap gap-2">
            {state?.status !== "ACTIVE" && <button className="btn-primary" onClick={() => op({ op: "rollInitiative" })}>🎲 Roll Initiative & Start</button>}
            {state?.status === "ACTIVE" && <>
              <button className="btn-ghost" onClick={() => op({ op: "turn", dir: "prev" })}>◀ Previous</button>
              <button className="btn-gold" onClick={nextTurn}>Next Turn ▶</button>
              <button className="btn-ghost" onClick={() => op({ op: "turn", dir: "end" })}>End Combat</button>
            </>}
          </div>
        )}
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_340px]">
        {/* MAP */}
        <MapBoard state={state} isDM={isDM} myCharacterIds={myCharacterIds} encId={encId}
          onMove={(tokenId: string, gridX: number, gridY: number) => {
            setState((s: any) => ({ ...s, tokens: s.tokens.map((t: any) => t.id === tokenId ? { ...t, gridX, gridY } : t) }));
            op({ op: "moveToken", tokenId, gridX, gridY });
          }}
          onSetMap={isDM ? (mapId: string) => op({ op: "setMap", mapId }) : undefined}
          onRemoveObject={isDM ? (tokenId: string) => op({ op: "removeToken", tokenId }) : undefined}
          maps={maps} campaignId={campaignId} onMapsChanged={refetch}
        />

        {/* SIDEBAR */}
        <div className="space-y-3">
          <InitiativeTracker combatants={combatants} activeId={activeId} isDM={isDM} onUpdate={op}
            selectedId={selectedId} onSelect={(id: string) => setSelectedId(id === selectedId ? null : id)}
            onAddCondition={isDM ? (id: string) => setApplyFor(id) : undefined}
            onRemoveCondition={isDM ? (condId: string) => condOp({ op: "remove", conditionId: condId }) : undefined} />
          {selected && (
            <SelectedCombatantPanel combatant={selected} isDM={isDM}
              onClose={() => setSelectedId(null)}
              onAddCondition={isDM ? () => setApplyFor(selected.id) : undefined}
              onRemoveCondition={isDM ? (condId: string) => condOp({ op: "remove", conditionId: condId }) : undefined} />
          )}
          {isDM && prompts.length > 0 && (
            <PromptQueue prompts={prompts} onDamage={resolveDamagePrompt} onSave={resolveSavePrompt} onSkip={dropPrompt} />
          )}
          <CombatLog log={state?.log ?? []} isDM={isDM} canUndo={canUndo} onUndo={() => op({ op: "undoDamage" })} />
        </div>
      </div>

      {applyFor && (() => {
        const target = combatants.find((c) => c.id === applyFor);
        return target ? (
          <ApplyConditionModal combatant={target} onClose={() => setApplyFor(null)}
            onApply={async (fields: any) => {
              await condOp({ op: "apply", combatantId: applyFor, ...fields });
              setApplyFor(null);
            }} />
        ) : null;
      })()}

      {!isDM && myCombatants.length > 0 && (
        <PlayerActionPanel op={op} encId={encId} myCombatants={myCombatants} combatants={combatants} activeId={activeId} />
      )}

      {isDM && (
        <div className="card">
          <div className="mb-2 flex gap-2">
            <button className={tab === "build" ? "btn-gold" : "btn-ghost"} onClick={() => setTab("build")}>🛠 Build Encounter</button>
            <button className={tab === "attack" ? "btn-gold" : "btn-ghost"} onClick={() => setTab("attack")}>🗡 Attack</button>
          </div>
          {tab === "build"
            ? <Builder op={op} campaignChars={campaignChars} combatants={combatants} tokens={state?.tokens ?? []} />
            : <AttackPanel op={op} combatants={combatants} />}
        </div>
      )}
    </main>
  );
}

/* ---------------- Map ---------------- */
function MapBoard({ state, isDM, myCharacterIds, onMove, onSetMap, onRemoveObject, maps, campaignId, onMapsChanged, encId }: any) {
  const map = state?.map;
  const gridSize = map?.gridSize ?? 60;
  const cols = map?.gridCols ?? 20;
  const rows = map?.gridRows ?? 14;
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const [brush, setBrush] = useState<"off" | "reveal" | "hide">("off");
  const paintingRef = useRef<{ active: boolean; cells: Set<string> }>({ active: false, cells: new Set() }).current;
  // measurement + AoE tools
  const [tool, setTool] = useState<"off" | "ruler" | "aoe">("off");
  const [aoeShape, setAoeShape] = useState<"circle" | "square" | "cone" | "line">("circle");
  const [aoeSize, setAoeSize] = useState(20); // feet
  const [ruler, setRuler] = useState<{ start: [number, number]; end: [number, number] } | null>(null);
  const [aoeAnchor, setAoeAnchor] = useState<[number, number] | null>(null);
  const cellsPerFt = 5;
  const distFt = ruler ? Math.max(Math.abs(ruler.end[0] - ruler.start[0]), Math.abs(ruler.end[1] - ruler.start[1])) * cellsPerFt : 0;

  function aoeCells(): Set<string> {
    const s = new Set<string>();
    if (!aoeAnchor) return s;
    const [ax, ay] = aoeAnchor;
    const r = Math.round(aoeSize / cellsPerFt);
    for (let x = 0; x < cols; x++) for (let y = 0; y < rows; y++) {
      const dx = x - ax, dy = y - ay;
      if (aoeShape === "circle") { if (Math.hypot(dx, dy) <= r + 0.001) s.add(`${x},${y}`); }
      else if (aoeShape === "square") { if (Math.abs(dx) <= r && Math.abs(dy) <= r) s.add(`${x},${y}`); }
      else if (aoeShape === "line") { if (dy === 0 && dx >= 0 && dx < r) s.add(`${x},${y}`); }
      else if (aoeShape === "cone") { if (dx >= 0 && dx <= r && Math.abs(dy) <= dx) s.add(`${x},${y}`); }
    }
    return s;
  }

  const fogEnabled = !!state?.fogEnabled;
  const revealed: Set<string> = (() => { try { return new Set(JSON.parse(state?.revealedCells || "[]")); } catch { return new Set(); } })();
  const cellHidden = (x: number, y: number) => fogEnabled && !revealed.has(`${x},${y}`);

  function canDrag(token: any) { return brush === "off" && (isDM || (token.characterId && myCharacterIds.includes(token.characterId))); }

  function onDragEnd(e: DragEndEvent) {
    const token = state.tokens.find((t: any) => t.id === e.active.id);
    if (!token) return;
    const nx = Math.max(0, Math.min(cols - 1, Math.round((token.gridX * gridSize + e.delta.x) / gridSize)));
    const ny = Math.max(0, Math.min(rows - 1, Math.round((token.gridY * gridSize + e.delta.y) / gridSize)));
    if (nx !== token.gridX || ny !== token.gridY) onMove(token.id, nx, ny);
  }

  async function fogOp(body: any) {
    await fetch(`/api/encounters/${encId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  }
  function paintCell(x: number, y: number) {
    if (brush === "off") return;
    paintingRef.cells.add(`${x},${y}`);
  }
  function flushPaint() {
    if (paintingRef.cells.size === 0) return;
    const cells = [...paintingRef.cells]; paintingRef.cells.clear();
    fogOp({ op: "revealCells", cells, reveal: brush === "reveal" });
  }

  return (
    <div className="card overflow-auto">
      {isDM && <MapControls maps={maps} campaignId={campaignId} onSetMap={onSetMap} onMapsChanged={onMapsChanged} current={map?.id} />}
      {isDM && map && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-[#5e5448]">Fog of War:</span>
          <button className={fogEnabled ? "btn-gold !py-0.5" : "btn-ghost !py-0.5"} onClick={() => fogOp({ op: "setFog", enabled: !fogEnabled })}>{fogEnabled ? "On" : "Off"}</button>
          <button className={brush === "reveal" ? "btn-gold !py-0.5" : "btn-ghost !py-0.5"} onClick={() => setBrush(brush === "reveal" ? "off" : "reveal")}>🖌 Reveal</button>
          <button className={brush === "hide" ? "btn-gold !py-0.5" : "btn-ghost !py-0.5"} onClick={() => setBrush(brush === "hide" ? "off" : "hide")}>🌫 Hide</button>
          <button className="btn-ghost !py-0.5" onClick={() => fogOp({ op: "setAllCells", revealAll: true })}>Reveal All</button>
          <button className="btn-ghost !py-0.5" onClick={() => fogOp({ op: "setAllCells", revealAll: false })}>Hide All</button>
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        <span className="text-[#5e5448]">Tools:</span>
        <button className={tool === "ruler" ? "btn-gold !py-0.5" : "btn-ghost !py-0.5"} onClick={() => { setTool(tool === "ruler" ? "off" : "ruler"); setRuler(null); }}>📏 Ruler</button>
        <button className={tool === "aoe" ? "btn-gold !py-0.5" : "btn-ghost !py-0.5"} onClick={() => { setTool(tool === "aoe" ? "off" : "aoe"); setAoeAnchor(null); }}>🔥 AoE</button>
        {tool === "aoe" && (
          <>
            <select className="input !w-auto !py-0.5" value={aoeShape} onChange={(e) => setAoeShape(e.target.value as any)}>
              <option value="circle">Circle (radius)</option>
              <option value="square">Square</option>
              <option value="cone">Cone</option>
              <option value="line">Line</option>
            </select>
            <input className="input !w-16 !py-0.5" type="number" step={5} min={5} value={aoeSize} onChange={(e) => setAoeSize(+e.target.value)} title="Size (ft)" />
            <span className="text-[#5e5448]">ft</span>
            {aoeAnchor && <button className="btn-ghost !py-0.5" onClick={() => setAoeAnchor(null)}>Clear</button>}
          </>
        )}
        {tool === "ruler" && ruler && <span className="chip text-gold">{distFt} ft</span>}
      </div>
      <div className="mt-2 text-xs text-[#5e5448]">Scale: {gridSize}px = 5ft · {cols}×{rows} squares{brush !== "off" ? " · brush mode active (drag over the map)" : ""}</div>
      <DndContext sensors={sensors} modifiers={[restrictToParentElement]} onDragEnd={onDragEnd}>
        <div className="relative mt-2 select-none" style={{ width: cols * gridSize, height: rows * gridSize,
          backgroundImage: map?.imageUrl ? `url(${map.imageUrl})` : undefined,
          backgroundSize: "cover", background: map?.imageUrl ? undefined : "#0d0b09" }}>
          <div className="grid-overlay absolute inset-0" style={{ backgroundSize: `${gridSize}px ${gridSize}px` }} />

          {/* Fog display layer */}
          {fogEnabled && Array.from({ length: rows }).map((_, y) =>
            Array.from({ length: cols }).map((_, x) => cellHidden(x, y) && (
              <div key={`fog-${x}-${y}`} className="absolute" style={{
                left: x * gridSize, top: y * gridSize, width: gridSize, height: gridSize,
                background: "#000", opacity: isDM ? 0.5 : 1, pointerEvents: "none", zIndex: 20,
              }} />
            ))
          )}

          {state.tokens.map((t: any) => {
            const combatant = state.combatants.find((c: any) => c.id === t.combatantId);
            if (combatant && !combatant.isVisible && !isDM) return null;
            if (!isDM && cellHidden(t.gridX, t.gridY)) return null; // hidden by fog for players
            return <TokenView key={t.id} token={t} combatant={combatant} gridSize={gridSize} draggable={canDrag(t)} dm={isDM} onRemoveObject={onRemoveObject} />;
          })}

          {/* AoE template highlight */}
          {tool === "aoe" && aoeAnchor && [...aoeCells()].map((k) => {
            const [x, y] = k.split(",").map(Number);
            return <div key={`aoe-${k}`} className="absolute" style={{ left: x * gridSize, top: y * gridSize, width: gridSize, height: gridSize, background: "rgba(224,90,30,0.35)", border: "1px solid rgba(224,90,30,0.6)", pointerEvents: "none", zIndex: 25 }} />;
          })}

          {/* Ruler line + label */}
          {tool === "ruler" && ruler && (
            <svg className="pointer-events-none absolute inset-0" style={{ zIndex: 45 }} width={cols * gridSize} height={rows * gridSize}>
              <line x1={ruler.start[0] * gridSize + gridSize / 2} y1={ruler.start[1] * gridSize + gridSize / 2}
                x2={ruler.end[0] * gridSize + gridSize / 2} y2={ruler.end[1] * gridSize + gridSize / 2}
                stroke="#c9a227" strokeWidth={3} strokeDasharray="6 4" />
              <circle cx={ruler.end[0] * gridSize + gridSize / 2} cy={ruler.end[1] * gridSize + gridSize / 2} r={5} fill="#c9a227" />
              <text x={ruler.end[0] * gridSize + gridSize / 2 + 8} y={ruler.end[1] * gridSize + gridSize / 2 - 8} fill="#f4ecd8" fontSize={14} fontWeight="bold">{distFt} ft</text>
            </svg>
          )}

          {/* Ruler / AoE interaction layer */}
          {tool !== "off" && (
            <div className="absolute inset-0" style={{ zIndex: 46, cursor: "crosshair" }}
              onPointerDown={(e) => { if (tool === "ruler") { const c = cellFrom(e, gridSize, cols, rows); setRuler({ start: c, end: c }); } }}
              onPointerMove={(e) => { if (tool === "ruler" && ruler) { const c = cellFrom(e, gridSize, cols, rows); setRuler((r) => r ? { ...r, end: c } : r); } }}
              onClick={(e) => { if (tool === "aoe") setAoeAnchor(cellFrom(e, gridSize, cols, rows)); }} />
          )}

          {/* Fog paint layer (DM brush mode) */}
          {isDM && brush !== "off" && (
            <div className="absolute inset-0" style={{ zIndex: 40 }}
              onPointerDown={() => { paintingRef.active = true; }}
              onPointerUp={() => { paintingRef.active = false; flushPaint(); }}
              onPointerLeave={() => { if (paintingRef.active) { paintingRef.active = false; flushPaint(); } }}>
              {Array.from({ length: rows }).map((_, y) =>
                Array.from({ length: cols }).map((_, x) => (
                  <div key={`paint-${x}-${y}`} className="absolute border border-white/10"
                    style={{ left: x * gridSize, top: y * gridSize, width: gridSize, height: gridSize, cursor: "crosshair" }}
                    onPointerDown={() => paintCell(x, y)}
                    onPointerEnter={() => paintingRef.active && paintCell(x, y)} />
                ))
              )}
            </div>
          )}
        </div>
      </DndContext>
    </div>
  );
}

function cellFrom(e: React.PointerEvent | React.MouseEvent, gridSize: number, cols: number, rows: number): [number, number] {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const x = Math.max(0, Math.min(cols - 1, Math.floor((e.clientX - rect.left) / gridSize)));
  const y = Math.max(0, Math.min(rows - 1, Math.floor((e.clientY - rect.top) / gridSize)));
  return [x, y];
}

// Condition name → status-ring color. Applied as a colored aura around a token
// whenever the combatant carries that condition (driven by appliedConditions,
// which is already role-redacted server-side, so no hidden/DM-only leak).
const CONDITION_RING_COLORS: Record<string, string> = {
  Poisoned: "#3aa655", Stunned: "#e0c020", Paralyzed: "#b45cff", Petrified: "#9a9a9a",
  Prone: "#8a6d3b", Grappled: "#b5651d", Restrained: "#7b5cff", Frightened: "#d98a00",
  Charmed: "#ff6fae", Blinded: "#8a8a8a", Deafened: "#777777", Invisible: "#6cc0ff",
  Incapacitated: "#a05a2c", Unconscious: "#c0392b", Bleeding: "#c0392b", Burning: "#e05a1e",
  Concentrating: "#3a86ff", Exhaustion: "#7a5230",
};
function ringColorFor(conds: any[]): string | null {
  for (const c of conds ?? []) {
    const col = CONDITION_RING_COLORS[c.name];
    if (col) return col;
  }
  return (conds?.length ?? 0) > 0 ? "#c9a227" : null; // custom/unknown → gold aura
}

function TokenView({ token, combatant, gridSize, draggable, dm, onRemoveObject }: any) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: token.id, disabled: !draggable });
  const size = (token.sizeSquares ?? 1) * gridSize;
  const isObject = !token.combatantId; // no combatant → map object/marker
  // Hidden-HP monsters (players' view) carry no exact numbers — fall back to the
  // coarse hpStatus bucket for the health bar.
  const hpHidden = combatant && combatant.currentHp == null;
  const hpPct = !combatant
    ? 100
    : hpHidden
      ? (combatant.hpStatus === "down" ? 0 : combatant.hpStatus === "bloodied" ? 40 : 100)
      : Math.round((combatant.currentHp / Math.max(1, combatant.maxHp)) * 100);
  const ring = combatant ? ringColorFor(combatant.appliedConditions) : null;
  const style: React.CSSProperties = {
    position: "absolute", left: token.gridX * gridSize, top: token.gridY * gridSize,
    width: size, height: size, transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined,
    zIndex: isDragging ? 50 : 10, cursor: draggable ? "grab" : "default",
    opacity: combatant && !combatant.isVisible ? 0.5 : 1,
  };
  const innerShape = isObject ? "rounded-md" : "rounded-full";
  const ringShadow = ring ? `0 0 0 3px ${ring}, 0 0 9px 2px ${ring}` : undefined;
  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}
      className={`group flex items-center justify-center border-2 text-xs font-bold text-white ${isObject ? "rounded-md" : "rounded-full"}`}
      title={isObject ? `Object: ${token.label}` : combatant ? (hpHidden ? `${combatant.name} — ${combatant.hpStatus ?? "unknown"}${ring ? " (status)" : ""}` : `${combatant.name} — HP ${combatant.currentHp}/${combatant.maxHp} AC ${combatant.ac}`) : token.label}>
      <div className={`flex h-full w-full items-center justify-center overflow-hidden border-2 ${isObject ? "rounded-md border-black/60 border-dashed" : "rounded-full border-black/40"}`}
        style={{
          ...(token.imageUrl
            ? { backgroundImage: `url(${token.imageUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
            : { background: token.color }),
          boxShadow: ringShadow,
        }}>
        {!token.imageUrl && (isObject ? "◈" : token.label)}
      </div>
      {combatant && (
        <div className="absolute -bottom-1 left-0 h-1 w-full rounded bg-black/50">
          <div className="h-1 rounded" style={{ width: `${hpPct}%`, background: hpPct > 50 ? "#3aa655" : hpPct > 25 ? "#b98338" : "#c0392b" }} />
        </div>
      )}
      {isObject && dm && onRemoveObject && (
        <button className="absolute -right-2 -top-2 hidden h-4 w-4 items-center justify-center rounded-full bg-red-700 text-[10px] leading-none text-white group-hover:flex"
          title="Remove object"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onRemoveObject(token.id); }}>✕</button>
      )}
    </div>
  );
}

function MapControls({ maps, campaignId, onSetMap, onMapsChanged, current }: any) {
  const [name, setName] = useState(""); const [url, setUrl] = useState("");
  const [cols, setCols] = useState(20); const [rows, setRows] = useState(14);
  const [showLib, setShowLib] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function create() {
    const r = await fetch(`/api/campaigns/${campaignId}/maps`, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name || "Map", imageUrl: url, gridCols: cols, gridRows: rows }) });
    const m = await r.json();
    await onSetMap?.(m.id); onMapsChanged?.(); setName(""); setUrl("");
  }
  async function fromLibrary(presetId: string) {
    const r = await fetch(`/api/campaigns/${campaignId}/maps/from-library`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ presetId }) });
    const m = await r.json();
    await onSetMap?.(m.id); onMapsChanged?.(); setShowLib(false);
  }
  async function upload(file: File) {
    setUploading(true);
    const fd = new FormData(); fd.append("file", file); fd.append("name", file.name.replace(/\.[^.]+$/, ""));
    fd.append("gridCols", String(cols)); fd.append("gridRows", String(rows));
    const r = await fetch(`/api/campaigns/${campaignId}/maps/upload`, { method: "POST", body: fd });
    setUploading(false);
    if (r.ok) { const m = await r.json(); await onSetMap?.(m.id); onMapsChanged?.(); }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <select className="input !w-auto" value={current ?? ""} onChange={(e) => onSetMap?.(e.target.value)}>
        <option value="">— Select a map —</option>
        {maps.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
      </select>
      <button className="btn-gold" onClick={() => setShowLib(true)}>📚 Map Library</button>
      <label className="btn-ghost cursor-pointer">{uploading ? "Uploading..." : "⬆ Upload Map"}
        <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      </label>
      <details><summary className="cursor-pointer text-gold">+ Grid/URL</summary>
        <div className="mt-2 flex flex-wrap gap-1">
          <input className="input !w-28" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="input !w-56" placeholder="Image URL (optional)" value={url} onChange={(e) => setUrl(e.target.value)} />
          <input className="input !w-16" type="number" value={cols} onChange={(e) => setCols(+e.target.value)} title="Columns" />
          <input className="input !w-16" type="number" value={rows} onChange={(e) => setRows(+e.target.value)} title="Rows" />
          <button className="btn-gold" onClick={create}>Create</button>
        </div>
      </details>
      {showLib && <MapLibraryModal onPick={fromLibrary} onClose={() => setShowLib(false)} />}
    </div>
  );
}

function MapLibraryModal({ onPick, onClose }: { onPick: (id: string) => void; onClose: () => void }) {
  const [presets, setPresets] = useState<any[]>([]);
  useEffect(() => { fetch("/api/maps/library").then((r) => r.json()).then(setPresets); }, []);
  const cats = [...new Set(presets.map((p) => p.category))];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="card max-h-[85vh] w-full max-w-2xl overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-lg text-gold">Map Library ({presets.length})</h3>
          <button className="btn-ghost !py-0.5" onClick={onClose}>Close</button>
        </div>
        {cats.map((cat) => (
          <div key={cat} className="mb-3">
            <div className="mb-1 text-xs uppercase text-[#5e5448]">{presets.find((p) => p.category === cat)?.icon} {cat}</div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {presets.filter((p) => p.category === cat).map((p) => (
                <button key={p.id} className="btn-ghost justify-start !py-1 text-xs" onClick={() => onPick(p.id)}>
                  {p.icon} {p.name}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Initiative ---------------- */
function InitiativeTracker({ combatants, activeId, isDM, onUpdate, selectedId, onSelect, onAddCondition, onRemoveCondition }: any) {
  return (
    <div className="card">
      <h3 className="mb-2 font-display text-gold">Initiative Order</h3>
      <div className="space-y-1">
        {combatants.map((c: any) => {
          const conds: any[] = c.appliedConditions ?? [];
          const active = c.id === activeId;
          const isSel = c.id === selectedId;
          return (
            <div key={c.id} onClick={() => onSelect?.(c.id)}
              className={`cursor-pointer rounded border p-2 text-sm ${active ? "border-gold bg-[#dfd5b8]" : isSel ? "border-[#a38c62] bg-[#f0e8d2]" : "border-[#dfd5b8]"} ${!c.isVisible ? "opacity-60" : ""}`}>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <b className="w-6 text-center text-gold">{c.initiative}</b>
                  <span className={c.kind === "monster" ? "text-red-900" : "text-blue-900"}>{c.kind === "monster" ? "👹" : "🛡"}</span>
                  {c.name}{!c.isVisible && " 👁️‍🗨️"}
                </span>
                {c.currentHp == null
                  ? <span className="capitalize text-[#7d6f5c]">{c.hpStatus ?? "—"}</span>
                  : <span className={c.currentHp === 0 ? "text-red-700" : ""}>{c.currentHp}/{c.maxHp}</span>}
              </div>
              {conds.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {conds.map((ac) => <ConditionToken key={ac.id} c={ac} isDM={isDM} compact onRemove={onRemoveCondition} />)}
                </div>
              )}
              {isDM && (
                <div className="mt-1 flex flex-wrap items-center gap-1 text-xs" onClick={(e) => e.stopPropagation()}>
                  <button className="btn-ghost !px-1.5 !py-0" onClick={() => onUpdate({ op: "damage", combatantId: c.id, amount: 5 })}>−5</button>
                  <button className="btn-ghost !px-1.5 !py-0" onClick={() => onUpdate({ op: "heal", combatantId: c.id, amount: 5 })}>+5</button>
                  <button className="btn-ghost !px-1.5 !py-0" title="Set / override initiative" onClick={() => { const v = window.prompt(`Set initiative for ${c.name}:`, String(c.initiative)); if (v !== null && v.trim() !== "" && Number.isFinite(+v)) onUpdate({ op: "updateCombatant", combatantId: c.id, patch: { initiative: Math.round(+v) } }); }}>⚔ Init</button>
                  <button className="btn-ghost !px-1.5 !py-0" onClick={() => onUpdate({ op: "updateCombatant", combatantId: c.id, patch: { isVisible: !c.isVisible } })}>{c.isVisible ? "Hide" : "Reveal"}</button>
                  {c.token && <button className="btn-ghost !px-1.5 !py-0" title="Set token image" onClick={() => { const url = window.prompt("Token image URL (blank to clear):", c.token.imageUrl ?? ""); if (url !== null) onUpdate({ op: "updateToken", tokenId: c.token.id, patch: { imageUrl: url || null } }); }}>🖼</button>}
                  {onAddCondition && <button className="btn-ghost !px-1.5 !py-0" title="Add condition" onClick={() => onAddCondition(c.id)}>＋ Cond</button>}
                  <button className="btn-ghost !px-1.5 !py-0" title="Remove from encounter"
                    onClick={() => { if (confirm(`Remove combatant "${c.name}" from the encounter?`)) onUpdate({ op: "removeCombatant", combatantId: c.id }); }}>🗑</button>
                </div>
              )}
            </div>
          );
        })}
        {combatants.length === 0 && (
          <div className="panel-inset p-4 text-center">
            <p className="text-sm text-[#5e5448]">
              {isDM
                ? "No combatants yet — add the party and monsters from the Build tab."
                : "No combatants yet — the DM is still preparing the encounter."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- Conditions & Ongoing Effects ---------------- */
// Category → token style per the DS: condition=default, dot=danger,
// buff=sage, magic=arcane, exhaustion/debuff=warning.
const COND_CAT_CLASS: Record<string, string> = {
  condition: "", dot: "cond-tok-danger", buff: "cond-tok-sage", debuff: "cond-tok-warning",
  injury: "cond-tok-danger", exhaustion: "cond-tok-warning", magic: "cond-tok-arcane", custom: "",
};

function condMeta(c: any): string {
  const auto = parseAutomation(c.automationJson);
  const bits: string[] = [];
  if (c.sourceText) bits.push(c.sourceText);
  if (auto.startTurnDamage) bits.push(`${auto.startTurnDamage}${auto.damageType ? ` ${auto.damageType}` : ""} · Start turn`);
  if (c.saveAbility && c.saveDc != null) bits.push(`${String(c.saveAbility).toUpperCase()} ${c.saveDc} · End turn`);
  if (c.category === "exhaustion") bits.push(`Level ${c.stacks}`);
  if (c.remainingRounds != null) bits.push(`${c.remainingRounds} round${c.remainingRounds === 1 ? "" : "s"}`);
  else if (bits.length === 0) bits.push("Until removed");
  return bits.join(" · ");
}

function ConditionToken({ c, isDM, compact, onRemove }: { c: any; isDM: boolean; compact?: boolean; onRemove?: (id: string) => void }) {
  const cls = COND_CAT_CLASS[c.category] ?? "";
  const isExh = c.category === "exhaustion";
  if (compact) {
    return (
      <span className={`condition-token cond-tok-compact ${cls}`} title={`${c.name} — ${condMeta(c)}`} onClick={(e) => e.stopPropagation()}>
        <span className="ct-icon">{c.icon || "✱"}</span>
        <strong>{c.name}{!isExh && c.stacks > 1 ? ` ×${c.stacks}` : ""}</strong>
        {isExh && <ExhaustionPips level={c.stacks} />}
        {isDM && c.visibility === "dm" && <em className="ct-dm">DM</em>}
        {isDM && onRemove && <button className="ct-x" title="Remove condition" onClick={() => onRemove(c.id)}>✕</button>}
      </span>
    );
  }
  return (
    <div className={`condition-token ${cls}`} onClick={(e) => e.stopPropagation()}>
      <span className="ct-icon">{c.icon || "✱"}</span>
      <span className="ct-body">
        <strong>
          {c.name}{!isExh && c.stacks > 1 ? ` ×${c.stacks}` : ""}
          {c.severity && <em className="ct-sev">{c.severity}</em>}
          {isDM && c.visibility === "dm" && <em className="ct-dm">DM only</em>}
        </strong>
        <small>{condMeta(c)}</small>
        {isExh && <ExhaustionPips level={c.stacks} />}
      </span>
      {isDM && onRemove && <button className="ct-x" title="Remove condition" onClick={() => onRemove(c.id)}>✕</button>}
    </div>
  );
}

function ExhaustionPips({ level }: { level: number }) {
  return (
    <span className="exh-pips" title={`Exhaustion level ${level} of 6`}>
      {Array.from({ length: 6 }).map((_, i) => <i key={i} className={`exh-pip ${i < level ? "filled" : ""}`} />)}
    </span>
  );
}

function SelectedCombatantPanel({ combatant, isDM, onClose, onAddCondition, onRemoveCondition }: any) {
  const conds: any[] = combatant.appliedConditions ?? [];
  return (
    <div className="card">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-display text-gold">{combatant.name}</h3>
        <button className="btn-ghost !px-1.5 !py-0 text-xs" onClick={onClose}>✕</button>
      </div>
      <div className="mb-2 flex gap-2 text-xs text-[#5e5448]">
        {combatant.currentHp == null
          ? <span className="chip capitalize">{combatant.hpStatus ?? "status unknown"}</span>
          : <><span className="chip">HP {combatant.currentHp}/{combatant.maxHp}</span><span className="chip">AC {combatant.ac}</span></>}
        <span className="chip">Init {combatant.initiative}</span>
      </div>
      <div className="text-xs uppercase tracking-wide text-[#857866]">Conditions</div>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {conds.map((ac) => <ConditionToken key={ac.id} c={ac} isDM={isDM} onRemove={onRemoveCondition} />)}
        {conds.length === 0 && <span className="text-sm text-[#5e5448]">No active conditions.</span>}
      </div>
      {onAddCondition && (
        <button className="btn-ghost mt-2 !py-1 text-sm" onClick={onAddCondition}>+ Add Condition</button>
      )}
    </div>
  );
}

/* Turn-automation prompt queue (DM): DoT damage + end-of-turn saves. */
function PromptQueue({ prompts, onDamage, onSave, onSkip }: any) {
  return (
    <div className="card border-l-4 !border-l-[#b98338]">
      <h3 className="mb-2 font-display text-gold">Turn Effects</h3>
      <div className="space-y-2 text-sm">
        {prompts.map((p: any, i: number) => (
          <div key={`${p.kind}-${p.conditionId}-${i}`} className="rounded border border-[#dfd5b8] p-2">
            {p.kind === "damage" ? (
              <>
                <div>{p.icon} <b>{p.name}</b>: roll {p.expr}{p.damageType ? ` ${p.damageType}` : ""} damage to <b>{p.targetName}</b></div>
                <div className="mt-1 flex flex-wrap gap-1">
                  <button className="btn-gold !py-0.5 text-xs" onClick={() => onDamage(p)}>🎲 Roll & Apply</button>
                  <button className="btn-ghost !py-0.5 text-xs" onClick={() => onSkip(p)}>Skip</button>
                </div>
              </>
            ) : (
              <>
                <div>{p.icon} <b>{String(p.ability).toUpperCase()} {p.dc}</b> save vs <b>{p.name}</b> — {p.targetName}</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  <button className="btn-gold !py-0.5 text-xs" onClick={() => onSave(p, true)}>Passed → Remove</button>
                  <button className="btn-ghost !py-0.5 text-xs" onClick={() => onSave(p, false)}>Failed → Keep</button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* Apply Condition modal (DM) — preset pills + duration/save/stacks/visibility/source. */
function ApplyConditionModal({ combatant, onClose, onApply }: any) {
  const [picked, setPicked] = useState<string>("");
  const [customName, setCustomName] = useState("");
  const [duration, setDuration] = useState(0); // 0 = until removed
  const [saveAbility, setSaveAbility] = useState("");
  const [saveDc, setSaveDc] = useState(13);
  const [stacks, setStacks] = useState(1);
  const [visibility, setVisibility] = useState<"public" | "dm">("public");
  const [source, setSource] = useState("");
  const [busy, setBusy] = useState(false);

  const preset = CONDITION_PRESETS.find((p) => p.name === picked);
  const name = picked === "__custom" ? customName.trim() : picked;
  const maxStacks = preset?.maxStacks ?? 20;

  async function apply() {
    if (!name || busy) return;
    setBusy(true);
    const fields: any = { name, stacks: Math.min(stacks, maxStacks), visibility, durationRounds: duration };
    if (picked === "__custom") fields.category = "custom";
    if (saveAbility) { fields.saveAbility = saveAbility; fields.saveDc = saveDc; }
    if (source.trim()) fields.sourceText = source.trim();
    await onApply(fields);
    setBusy(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="card max-h-[85vh] w-full max-w-2xl overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-lg text-gold">Apply Condition — {combatant.name}</h3>
          <button className="btn-ghost !py-0.5" onClick={onClose}>Close</button>
        </div>

        <div className="condition-pill-grid">
          {CONDITION_PRESETS.map((p) => (
            <button key={p.name} className={`condition-pill ${picked === p.name ? `is-active ${COND_CAT_CLASS[p.category] ?? ""}` : ""}`}
              onClick={() => { setPicked(p.name); if (p.supportsStacks && stacks > (p.maxStacks ?? 20)) setStacks(p.maxStacks ?? 20); }}>
              <span>{p.icon}</span><strong>{p.name}</strong><small>{p.summary}</small>
            </button>
          ))}
          <button className={`condition-pill ${picked === "__custom" ? "is-active" : ""}`} onClick={() => setPicked("__custom")}>
            <span>✎</span><strong>Custom…</strong><small>Campaign-specific effect</small>
          </button>
        </div>

        {picked === "__custom" && (
          <div className="mt-2">
            <label className="label">Condition name</label>
            <input className="input" placeholder="e.g. Cursed by the Lich" maxLength={60} value={customName} onChange={(e) => setCustomName(e.target.value)} />
          </div>
        )}

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <div>
            <label className="label">Duration</label>
            <select className="input" value={duration} onChange={(e) => setDuration(+e.target.value)}>
              <option value={0}>Until removed</option>
              <option value={1}>1 round</option>
              <option value={3}>3 rounds</option>
              <option value={10}>10 rounds</option>
            </select>
          </div>
          <div>
            <label className="label">Save (end of turn)</label>
            <div className="flex gap-1">
              <select className="input" value={saveAbility} onChange={(e) => setSaveAbility(e.target.value)}>
                <option value="">No save</option>
                {["str", "dex", "con", "int", "wis", "cha"].map((a) => <option key={a} value={a}>{a.toUpperCase()}</option>)}
              </select>
              {saveAbility && <input className="input !w-20" type="number" min={1} max={30} value={saveDc} onChange={(e) => setSaveDc(+e.target.value)} title="DC" />}
            </div>
          </div>
          <div>
            <label className="label">{preset?.category === "exhaustion" ? "Level (1–6)" : "Stacks"}</label>
            <input className="input" type="number" min={1} max={maxStacks} value={stacks} onChange={(e) => setStacks(Math.max(1, Math.min(maxStacks, +e.target.value || 1)))} />
          </div>
          <div>
            <label className="label">Visibility</label>
            <select className="input" value={visibility} onChange={(e) => setVisibility(e.target.value as any)}>
              <option value="public">Public</option>
              <option value="dm">DM only</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label">Source (optional)</label>
            <input className="input" placeholder="e.g. Crawler Venom" maxLength={120} value={source} onChange={(e) => setSource(e.target.value)} />
          </div>
        </div>

        <div className="mt-3 flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={!name || busy} onClick={apply}>{busy ? "Applying…" : "Apply Condition"}</button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Combat Log ---------------- */
function CombatLog({ log, isDM, canUndo, onUndo }: any) {
  return (
    <div className="card">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-display text-gold">Combat Log</h3>
        {isDM && (
          <button className="btn-ghost !py-0.5 text-xs" disabled={!canUndo} onClick={onUndo}
            title={canUndo ? "Undo the last damage / healing entry" : "Nothing to undo"}>
            ↩ Undo
          </button>
        )}
      </div>
      <div className="max-h-64 space-y-1 overflow-y-auto text-xs">
        {log.map((l: any) => (
          <div key={l.id} className="border-b border-[#dfd5b8] pb-1">
            <span className="text-[#5e5448]">{l.actor}: </span>{l.message}
          </div>
        ))}
        {log.length === 0 && <p className="text-[#5e5448]">—</p>}
      </div>
    </div>
  );
}

/* ---------------- Player Combat Actions ----------------
 * A player acts in combat using a combatant whose character they own. Slot
 * spending is delegated to the character-sheet endpoint (the source of truth);
 * the combat-affecting damage goes through the encounter `combatDamage` op. To-hit
 * and damage may be system-rolled (crypto dice) or entered manually.               */
function PlayerActionPanel({ op, encId, myCombatants, combatants, activeId }: any) {
  const [actorId, setActorId] = useState<string>(myCombatants[0]?.id ?? "");
  const [mode, setMode] = useState<"attack" | "cast">("attack");
  const actor = myCombatants.find((c: any) => c.id === actorId) ?? myCombatants[0];
  const myTurn = actor && actor.id === activeId;
  // Valid targets: any visible combatant other than the actor.
  const targetOptions = combatants.filter((c: any) => c.id !== actor?.id && c.isVisible !== false);

  const [targets, setTargets] = useState<string[]>([]);
  const toggleTarget = (id: string) => setTargets((t) => t.includes(id) ? t.filter((x) => x !== id) : [...t, id]);

  // Attack: to-hit
  const [toHitBonus, setToHitBonus] = useState(5);
  const [attackAdv, setAttackAdv] = useState<"none" | "adv" | "dis">("none");
  const [toHit, setToHit] = useState<any>(null);
  // Damage: system-rolled expr OR a manual number
  const [dmgMode, setDmgMode] = useState<"system" | "manual">("system");
  const [dmgExpr, setDmgExpr] = useState("1d8+3");
  const [dmgManual, setDmgManual] = useState(0);
  const [label, setLabel] = useState("");

  // Cast: slot level + result
  const [slotLevel, setSlotLevel] = useState(1);
  const [castMsg, setCastMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function rollToHit() {
    const r = roll(`1d20+${toHitBonus}`, { advantage: attackAdv === "adv", disadvantage: attackAdv === "dis" });
    setToHit(r);
  }

  /** Roll (or read) damage and apply it to each selected target via combatDamage. */
  async function applyDamage(effectLabel: string) {
    if (!actor || targets.length === 0) return;
    let amount = 0, breakdown: string | undefined;
    if (dmgMode === "system") { const r = roll(dmgExpr); amount = r.total; breakdown = r.breakdown; }
    else { amount = Math.max(0, Math.floor(Number(dmgManual) || 0)); }
    for (const tId of targets) {
      await op({ op: "combatDamage", actorCombatantId: actor.id, targetId: tId, amount, label: effectLabel || undefined, breakdown });
    }
  }

  async function doAttack() {
    setBusy(true);
    await applyDamage(label || "Attack");
    setBusy(false);
  }

  async function doCast() {
    if (!actor?.characterId) return;
    setBusy(true);
    setCastMsg(null);
    // 1) Spend the slot on the character sheet (source of truth) — do NOT duplicate slot logic here.
    const r = await fetch(`/api/characters/${actor.characterId}/spells`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ op: "cast", level: slotLevel }),
    });
    if (!r.ok) { setCastMsg("Could not cast — no slot available?"); setBusy(false); return; }
    const data = await r.json().catch(() => ({}));
    const remaining = data?.remaining ?? data?.slotsRemaining;
    setCastMsg(`Cast a level ${slotLevel} spell.${remaining != null ? ` Slots left: ${remaining}.` : ""}`);
    // 2) Apply any damage the spell deals to the chosen target(s).
    if (targets.length > 0) await applyDamage(label || `Spell (lvl ${slotLevel})`);
    setBusy(false);
  }

  if (!actor) return null;
  return (
    <div className="card space-y-3 border-l-4 !border-l-[#2e6da4]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-gold">🎯 Your Combat Actions</h3>
        {myTurn && <span className="chip text-gold">Your turn</span>}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        {myCombatants.length > 1 && (
          <select className="input !w-auto" value={actorId} onChange={(e) => setActorId(e.target.value)}>
            {myCombatants.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
        <span className="text-[#5e5448]">Acting as <b>{actor.name}</b> · Init {actor.initiative}</span>
        <button className="btn-gold !py-0.5" onClick={() => op({ op: "selfInitiative", combatantId: actor.id })}>🎲 Roll My Initiative</button>
      </div>

      <div className="flex gap-2">
        <button className={mode === "attack" ? "btn-gold" : "btn-ghost"} onClick={() => setMode("attack")}>🗡 Attack</button>
        <button className={mode === "cast" ? "btn-gold" : "btn-ghost"} onClick={() => setMode("cast")}>✨ Cast Spell</button>
      </div>

      {/* Targets */}
      <div>
        <label className="label">Target(s)</label>
        <div className="flex flex-wrap gap-1">
          {targetOptions.map((c: any) => (
            <button key={c.id} className={targets.includes(c.id) ? "btn-gold !py-0.5" : "btn-ghost !py-0.5"} onClick={() => toggleTarget(c.id)}>
              {c.kind === "monster" ? "👹" : "🛡"} {c.name}{c.ac != null ? ` (AC ${c.ac})` : ""}
            </button>
          ))}
          {targetOptions.length === 0 && <span className="text-sm text-[#5e5448]">No visible targets.</span>}
        </div>
      </div>

      {mode === "cast" && (
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="label">Spell slot level</label>
            <select className="input !w-auto" value={slotLevel} onChange={(e) => setSlotLevel(+e.target.value)}>
              {Array.from({ length: 9 }).map((_, i) => <option key={i + 1} value={i + 1}>Level {i + 1}</option>)}
            </select>
          </div>
        </div>
      )}

      {mode === "attack" && (
        <div className="flex flex-wrap items-end gap-2 text-sm">
          <div>
            <label className="label">To-hit bonus</label>
            <input className="input !w-16" type="number" value={toHitBonus} onChange={(e) => setToHitBonus(+e.target.value)} />
          </div>
          <select className="input !w-auto" value={attackAdv} onChange={(e) => setAttackAdv(e.target.value as any)}>
            <option value="none">Normal</option><option value="adv">Advantage</option><option value="dis">Disadvantage</option>
          </select>
          <button className="btn-ghost !py-1" onClick={rollToHit}>🎲 Roll to Hit</button>
          {toHit && <span className={`chip ${toHit.crit ? "text-gold" : toHit.fumble ? "text-red-700" : ""}`}>To hit: {toHit.total} {toHit.crit ? "(crit!)" : toHit.fumble ? "(fumble)" : ""} · {toHit.breakdown}</span>}
        </div>
      )}

      {/* Damage: system-rolled or manual */}
      <div className="flex flex-wrap items-end gap-2 text-sm">
        <div>
          <label className="label">Damage</label>
          <div className="flex gap-1">
            <select className="input !w-auto" value={dmgMode} onChange={(e) => setDmgMode(e.target.value as any)}>
              <option value="system">System roll</option>
              <option value="manual">Manual number</option>
            </select>
            {dmgMode === "system"
              ? <input className="input !w-28" placeholder="e.g. 8d6" value={dmgExpr} onChange={(e) => setDmgExpr(e.target.value)} title="Dice expression" />
              : <input className="input !w-20" type="number" min={0} value={dmgManual} onChange={(e) => setDmgManual(+e.target.value)} />}
          </div>
        </div>
        <div>
          <label className="label">Label (optional)</label>
          <input className="input !w-40" placeholder="e.g. Fireball" maxLength={60} value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {mode === "attack"
          ? <button className="btn-primary" disabled={busy || targets.length === 0} onClick={doAttack}>{busy ? "…" : "⚔ Apply Attack Damage"}</button>
          : <button className="btn-primary" disabled={busy} onClick={doCast}>{busy ? "…" : "✨ Cast & Apply"}</button>}
        {castMsg && <span className="text-sm text-[#3a6a3a]">{castMsg}</span>}
      </div>
      <p className="text-xs text-[#8a7a63]">Slot spending syncs to your character sheet. The DM sees every action in the combat log and can undo damage.</p>
    </div>
  );
}

/* ---------------- Builder ---------------- */
function Builder({ op, campaignChars, combatants, tokens }: any) {
  const [q, setQ] = useState(""); const [results, setResults] = useState<any[]>([]);
  const [count, setCount] = useState(1); const [rollHp, setRollHp] = useState(true);
  const existingCharIds = new Set(combatants.filter((c: any) => c.characterId).map((c: any) => c.characterId));
  const objects = (tokens ?? []).filter((t: any) => !t.combatantId);
  const [objLabel, setObjLabel] = useState(""); const [objColor, setObjColor] = useState("#6b7280"); const [objSize, setObjSize] = useState(1);

  async function search() {
    const r = await fetch(`/api/srd/monsters?q=${encodeURIComponent(q)}`);
    setResults(await r.json());
  }
  useEffect(() => { search(); /* initial */ }, []); // eslint-disable-line

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="md:col-span-2">
        <h4 className="mb-2 text-gold">Map Objects / Markers</h4>
        <div className="mb-2 flex flex-wrap items-end gap-1">
          <input className="input !w-40" placeholder="Label (e.g. Chest)" maxLength={12} value={objLabel} onChange={(e) => setObjLabel(e.target.value)} />
          <input className="input !w-14 !p-0.5" type="color" value={objColor} onChange={(e) => setObjColor(e.target.value)} title="Color" />
          <input className="input !w-14" type="number" min={1} max={4} value={objSize} onChange={(e) => setObjSize(Math.max(1, Math.min(4, +e.target.value || 1)))} title="Size (squares)" />
          <button className="btn-ghost" onClick={() => { op({ op: "addObject", label: objLabel || "Obj", color: objColor, sizeSquares: objSize }); setObjLabel(""); }}>◈ Add Object</button>
        </div>
        {objects.length > 0 && (
          <div className="flex flex-wrap gap-1 text-sm">
            {objects.map((t: any) => (
              <span key={t.id} className="chip flex items-center gap-1">
                <span style={{ background: t.color, width: 10, height: 10, display: "inline-block", borderRadius: 2 }} />
                {t.label}
                <button className="text-red-700" title="Remove" onClick={() => op({ op: "removeToken", tokenId: t.id })}>✕</button>
              </span>
            ))}
          </div>
        )}
      </div>
      <div>
        <h4 className="mb-2 text-gold">Add Players</h4>
        <div className="flex flex-wrap gap-1">
          {campaignChars.map((c: any) => (
            <button key={c.id} disabled={existingCharIds.has(c.id)} className={existingCharIds.has(c.id) ? "chip opacity-40" : "btn-ghost"}
              onClick={() => op({ op: "addPlayers", characterIds: [c.id] })}>{c.name}</button>
          ))}
          {campaignChars.length === 0 && <span className="text-sm text-[#5e5448]">No characters in this campaign.</span>}
        </div>
      </div>
      <div>
        <h4 className="mb-2 text-gold">Add Enemies (SRD Bestiary)</h4>
        <div className="mb-2 flex gap-1">
          <input className="input" placeholder="Search monster..." value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} />
          <button className="btn-ghost" onClick={search}>Search</button>
          <input className="input !w-14" type="number" min={1} max={12} value={count} onChange={(e) => setCount(+e.target.value)} title="Count" />
          <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={rollHp} onChange={(e) => setRollHp(e.target.checked)} />Random HP</label>
        </div>
        <div className="max-h-48 space-y-1 overflow-y-auto text-sm">
          {results.map((m: any) => (
            <div key={m.id} className="flex items-center justify-between border-b border-[#dfd5b8] py-1">
              <span>{m.name} <span className="text-xs text-[#5e5448]">CR {m.cr} · HP {m.hp} · AC {m.ac}</span></span>
              <button className="btn-ghost !py-0.5" onClick={() => op({ op: "addMonster", monsterId: m.id, count, rollHp })}>+ Add</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Attack Panel ---------------- */
function AttackPanel({ op, combatants }: any) {
  const attackers = combatants.filter((c: any) => c.kind === "monster");
  const [attackerId, setAttackerId] = useState("");
  const [actionName, setActionName] = useState("");
  const [targets, setTargets] = useState<string[]>([]);
  const [adv, setAdv] = useState<"none" | "adv" | "dis">("none");
  const [result, setResult] = useState<any>(null);

  const attacker = combatants.find((c: any) => c.id === attackerId);
  const actions = attacker ? parseStatActions(attacker.statBlockJson) : [];
  const players = combatants.filter((c: any) => c.kind === "player");

  async function doAttack() {
    const r = await op({ op: "attack", attackerId, actionName: actionName || actions[0]?.name, targetIds: targets,
      advantage: adv === "adv", disadvantage: adv === "dis" });
    setResult(r);
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-[#5e5448]">Choose an attacker, an action, and targets (one or many players) — the system rolls the attack against each target's AC.</p>
      <div className="grid gap-2 md:grid-cols-3">
        <div>
          <label className="label">Attacker</label>
          <select className="input" value={attackerId} onChange={(e) => { setAttackerId(e.target.value); setActionName(""); }}>
            <option value="">—</option>
            {attackers.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Action</label>
          <select className="input" value={actionName} onChange={(e) => setActionName(e.target.value)}>
            {actions.map((a: any) => <option key={a.name} value={a.name}>{a.name}{a.toHit != null ? ` (+${a.toHit})` : a.save ? ` (DC ${a.save.dc} ${a.save.ability})` : ""}</option>)}
            {actions.length === 0 && <option>—</option>}
          </select>
        </div>
        <div>
          <label className="label">Advantage/Disadvantage</label>
          <select className="input" value={adv} onChange={(e) => setAdv(e.target.value as any)}>
            <option value="none">Normal</option><option value="adv">Advantage</option><option value="dis">Disadvantage</option>
          </select>
        </div>
      </div>
      <div>
        <label className="label">Targets (players)</label>
        <div className="flex flex-wrap gap-1">
          {players.map((p: any) => (
            <button key={p.id} className={targets.includes(p.id) ? "btn-gold" : "btn-ghost"}
              onClick={() => setTargets((t) => t.includes(p.id) ? t.filter((x) => x !== p.id) : [...t, p.id])}>
              {p.name} (AC {p.ac})
            </button>
          ))}
        </div>
      </div>
      <button className="btn-primary" disabled={!attackerId || targets.length === 0} onClick={doAttack}>🎲 Roll Attack</button>
      {result?.outcomes && (
        <div className="rounded border border-[#cdbf9f] p-2 text-sm">
          <b className="text-gold">{result.action}</b>
          {result.outcomes.map((o: any, i: number) => (
            <div key={i} className={o.hit ? "text-green-900" : "text-red-900"}>{o.message}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function parseStatActions(statBlockJson: string | null) {
  try {
    const sb = JSON.parse(statBlockJson || "{}");
    const arr = JSON.parse(sb.actions || "[]");
    return arr.map((a: any) => {
      const toHitM = a.description?.match(/([+-]\d+)\s+to hit/i);
      const saveM = a.description?.match(/DC\s+(\d+)\s+(\w+)/i);
      return { name: a.name, toHit: toHitM ? parseInt(toHitM[1]) : null, save: saveM ? { dc: +saveM[1], ability: saveM[2] } : null };
    });
  } catch { return []; }
}
