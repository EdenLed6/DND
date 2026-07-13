"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { DndContext, useDraggable, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { restrictToParentElement } from "@dnd-kit/modifiers";
import { useRealtime, useWatchEncounter } from "@/lib/realtime/useRealtime";

const CONDITIONS = ["Prone","Poisoned","Restrained","Stunned","Grappled","Frightened","Blinded","Paralyzed","Unconscious"];

export function PlayScreen({ encId, campaignId, initialState, campaignChars, maps, isDM, myCharacterIds }: {
  encId: string; campaignId: string; initialState: any; campaignChars: any[]; maps: any[];
  isDM: boolean; myCharacterIds: string[];
}) {
  const [state, setState] = useState(initialState);
  const [tab, setTab] = useState<"build" | "attack">("build");

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

  const combatants: any[] = state?.combatants ?? [];
  const activeId = state?.status === "ACTIVE" ? combatants[state.turnIndex]?.id : null;

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
              <button className="btn-gold" onClick={() => op({ op: "turn", dir: "next" })}>Next Turn ▶</button>
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
          maps={maps} campaignId={campaignId} onMapsChanged={refetch}
        />

        {/* SIDEBAR */}
        <div className="space-y-3">
          <InitiativeTracker combatants={combatants} activeId={activeId} isDM={isDM} onUpdate={op} />
          <CombatLog log={state?.log ?? []} />
        </div>
      </div>

      {isDM && (
        <div className="card">
          <div className="mb-2 flex gap-2">
            <button className={tab === "build" ? "btn-gold" : "btn-ghost"} onClick={() => setTab("build")}>🛠 Build Encounter</button>
            <button className={tab === "attack" ? "btn-gold" : "btn-ghost"} onClick={() => setTab("attack")}>🗡 Attack</button>
          </div>
          {tab === "build"
            ? <Builder op={op} campaignChars={campaignChars} combatants={combatants} />
            : <AttackPanel op={op} combatants={combatants} />}
        </div>
      )}
    </main>
  );
}

/* ---------------- Map ---------------- */
function MapBoard({ state, isDM, myCharacterIds, onMove, onSetMap, maps, campaignId, onMapsChanged, encId }: any) {
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
            return <TokenView key={t.id} token={t} combatant={combatant} gridSize={gridSize} draggable={canDrag(t)} dm={isDM} />;
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

function TokenView({ token, combatant, gridSize, draggable, dm }: any) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: token.id, disabled: !draggable });
  const size = (token.sizeSquares ?? 1) * gridSize;
  const hpPct = combatant ? Math.round((combatant.currentHp / Math.max(1, combatant.maxHp)) * 100) : 100;
  const style: React.CSSProperties = {
    position: "absolute", left: token.gridX * gridSize, top: token.gridY * gridSize,
    width: size, height: size, transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined,
    zIndex: isDragging ? 50 : 10, cursor: draggable ? "grab" : "default",
    opacity: combatant && !combatant.isVisible ? 0.5 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}
      className="flex items-center justify-center rounded-full border-2 text-xs font-bold text-white"
      title={combatant ? `${combatant.name} — HP ${combatant.currentHp}/${combatant.maxHp} AC ${combatant.ac}` : token.label}>
      <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full border-2 border-black/40"
        style={token.imageUrl
          ? { backgroundImage: `url(${token.imageUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
          : { background: token.color }}>
        {!token.imageUrl && token.label}
      </div>
      {combatant && (
        <div className="absolute -bottom-1 left-0 h-1 w-full rounded bg-black/50">
          <div className="h-1 rounded" style={{ width: `${hpPct}%`, background: hpPct > 50 ? "#3aa655" : hpPct > 25 ? "#b98338" : "#c0392b" }} />
        </div>
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
function InitiativeTracker({ combatants, activeId, isDM, onUpdate }: any) {
  return (
    <div className="card">
      <h3 className="mb-2 font-display text-gold">Initiative Order</h3>
      <div className="space-y-1">
        {combatants.map((c: any) => {
          const conditions = safeArr(c.conditions);
          const active = c.id === activeId;
          return (
            <div key={c.id} className={`rounded border p-2 text-sm ${active ? "border-gold bg-[#dfd5b8]" : "border-[#dfd5b8]"} ${!c.isVisible ? "opacity-60" : ""}`}>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <b className="w-6 text-center text-gold">{c.initiative}</b>
                  <span className={c.kind === "monster" ? "text-red-900" : "text-blue-900"}>{c.kind === "monster" ? "👹" : "🛡"}</span>
                  {c.name}{!c.isVisible && " 👁️‍🗨️"}
                </span>
                <span className={c.currentHp === 0 ? "text-red-700" : ""}>{c.currentHp}/{c.maxHp}</span>
              </div>
              {conditions.length > 0 && <div className="mt-1 text-xs text-[#b98338]">{conditions.join(", ")}</div>}
              {isDM && (
                <div className="mt-1 flex flex-wrap items-center gap-1 text-xs">
                  <button className="btn-ghost !px-1.5 !py-0" onClick={() => onUpdate({ op: "updateCombatant", combatantId: c.id, patch: { currentHp: Math.max(0, c.currentHp - 5) } })}>−5</button>
                  <button className="btn-ghost !px-1.5 !py-0" onClick={() => onUpdate({ op: "updateCombatant", combatantId: c.id, patch: { currentHp: Math.min(c.maxHp, c.currentHp + 5) } })}>+5</button>
                  <button className="btn-ghost !px-1.5 !py-0" onClick={() => onUpdate({ op: "updateCombatant", combatantId: c.id, patch: { isVisible: !c.isVisible } })}>{c.isVisible ? "Hide" : "Reveal"}</button>
                  {c.token && <button className="btn-ghost !px-1.5 !py-0" title="Set token image" onClick={() => { const url = window.prompt("Token image URL (blank to clear):", c.token.imageUrl ?? ""); if (url !== null) onUpdate({ op: "updateToken", tokenId: c.token.id, patch: { imageUrl: url || null } }); }}>🖼</button>}
                  <select className="input !w-auto !py-0 text-xs" defaultValue="" onChange={(e) => { if (!e.target.value) return;
                    const has = conditions.includes(e.target.value);
                    const next = has ? conditions.filter((x: string) => x !== e.target.value) : [...conditions, e.target.value];
                    onUpdate({ op: "updateCombatant", combatantId: c.id, patch: { conditions: next } }); e.target.value = ""; }}>
                    <option value="">±Condition</option>
                    {CONDITIONS.map((cond) => <option key={cond}>{cond}</option>)}
                  </select>
                  <button className="btn-ghost !px-1.5 !py-0" onClick={() => onUpdate({ op: "removeCombatant", combatantId: c.id })}>🗑</button>
                </div>
              )}
            </div>
          );
        })}
        {combatants.length === 0 && <p className="text-sm text-[#5e5448]">No combatants. Add some in Build Encounter.</p>}
      </div>
    </div>
  );
}

/* ---------------- Combat Log ---------------- */
function CombatLog({ log }: any) {
  return (
    <div className="card">
      <h3 className="mb-2 font-display text-gold">Combat Log</h3>
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

/* ---------------- Builder ---------------- */
function Builder({ op, campaignChars, combatants }: any) {
  const [q, setQ] = useState(""); const [results, setResults] = useState<any[]>([]);
  const [count, setCount] = useState(1); const [rollHp, setRollHp] = useState(true);
  const existingCharIds = new Set(combatants.filter((c: any) => c.characterId).map((c: any) => c.characterId));

  async function search() {
    const r = await fetch(`/api/srd/monsters?q=${encodeURIComponent(q)}`);
    setResults(await r.json());
  }
  useEffect(() => { search(); /* initial */ }, []); // eslint-disable-line

  return (
    <div className="grid gap-4 md:grid-cols-2">
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

function safeArr(s: any): string[] { try { return typeof s === "string" ? JSON.parse(s) : (s ?? []); } catch { return []; } }
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
