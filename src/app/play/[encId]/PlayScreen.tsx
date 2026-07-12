"use client";
import { useCallback, useEffect, useState } from "react";
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
          <div className="text-sm text-[#a9977c]">
            סטטוס: {state?.status} {state?.status === "ACTIVE" && `· סבב ${state.round}`}
          </div>
        </div>
        {isDM && (
          <div className="flex flex-wrap gap-2">
            {state?.status !== "ACTIVE" && <button className="btn-primary" onClick={() => op({ op: "rollInitiative" })}>🎲 גלגל יוזמה והתחל</button>}
            {state?.status === "ACTIVE" && <>
              <button className="btn-ghost" onClick={() => op({ op: "turn", dir: "prev" })}>◀ קודם</button>
              <button className="btn-gold" onClick={() => op({ op: "turn", dir: "next" })}>תור הבא ▶</button>
              <button className="btn-ghost" onClick={() => op({ op: "turn", dir: "end" })}>סיים קרב</button>
            </>}
          </div>
        )}
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_340px]">
        {/* MAP */}
        <MapBoard state={state} isDM={isDM} myCharacterIds={myCharacterIds}
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
            <button className={tab === "build" ? "btn-gold" : "btn-ghost"} onClick={() => setTab("build")}>🛠 בניית קרב</button>
            <button className={tab === "attack" ? "btn-gold" : "btn-ghost"} onClick={() => setTab("attack")}>🗡 תקיפה</button>
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
function MapBoard({ state, isDM, myCharacterIds, onMove, onSetMap, maps, campaignId, onMapsChanged }: any) {
  const map = state?.map;
  const gridSize = map?.gridSize ?? 60;
  const cols = map?.gridCols ?? 20;
  const rows = map?.gridRows ?? 14;
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function canDrag(token: any) { return isDM || (token.characterId && myCharacterIds.includes(token.characterId)); }

  function onDragEnd(e: DragEndEvent) {
    const token = state.tokens.find((t: any) => t.id === e.active.id);
    if (!token) return;
    const nx = Math.max(0, Math.min(cols - 1, Math.round((token.gridX * gridSize + e.delta.x) / gridSize)));
    const ny = Math.max(0, Math.min(rows - 1, Math.round((token.gridY * gridSize + e.delta.y) / gridSize)));
    if (nx !== token.gridX || ny !== token.gridY) onMove(token.id, nx, ny);
  }

  return (
    <div className="card overflow-auto">
      {isDM && <MapControls maps={maps} campaignId={campaignId} onSetMap={onSetMap} onMapsChanged={onMapsChanged} current={map?.id} />}
      <div className="mt-2 text-xs text-[#a9977c]">קנה מידה: {gridSize}px = 5ft · {cols}×{rows} משבצות</div>
      <DndContext sensors={sensors} modifiers={[restrictToParentElement]} onDragEnd={onDragEnd}>
        <div className="relative mt-2" style={{ width: cols * gridSize, height: rows * gridSize,
          backgroundImage: map?.imageUrl ? `url(${map.imageUrl})` : undefined,
          backgroundSize: "cover", background: map?.imageUrl ? undefined : "#0d0b09" }}>
          <div className="grid-overlay absolute inset-0" style={{ backgroundSize: `${gridSize}px ${gridSize}px` }} />
          {state.tokens.map((t: any) => {
            const combatant = state.combatants.find((c: any) => c.id === t.combatantId);
            if (combatant && !combatant.isVisible && !isDM) return null;
            return <TokenView key={t.id} token={t} combatant={combatant} gridSize={gridSize} draggable={canDrag(t)} dm={isDM} />;
          })}
        </div>
      </DndContext>
    </div>
  );
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
      <div className="flex h-full w-full items-center justify-center rounded-full border-2 border-black/40"
        style={{ background: token.color }}>
        {token.label}
      </div>
      {combatant && (
        <div className="absolute -bottom-1 left-0 h-1 w-full rounded bg-black/50">
          <div className="h-1 rounded" style={{ width: `${hpPct}%`, background: hpPct > 50 ? "#3aa655" : hpPct > 25 ? "#d1a000" : "#c0392b" }} />
        </div>
      )}
    </div>
  );
}

function MapControls({ maps, campaignId, onSetMap, onMapsChanged, current }: any) {
  const [name, setName] = useState(""); const [url, setUrl] = useState("");
  const [cols, setCols] = useState(20); const [rows, setRows] = useState(14);
  async function create() {
    const r = await fetch(`/api/campaigns/${campaignId}/maps`, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name || "Map", imageUrl: url, gridCols: cols, gridRows: rows }) });
    const m = await r.json();
    await onSetMap?.(m.id); onMapsChanged?.(); setName(""); setUrl("");
  }
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <select className="input !w-auto" value={current ?? ""} onChange={(e) => onSetMap?.(e.target.value)}>
        <option value="">— בחר מפה —</option>
        {maps.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
      </select>
      <details><summary className="cursor-pointer text-gold">+ מפה חדשה</summary>
        <div className="mt-2 flex flex-wrap gap-1">
          <input className="input !w-28" placeholder="שם" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="input !w-56" placeholder="URL תמונה (אופציונלי)" value={url} onChange={(e) => setUrl(e.target.value)} />
          <input className="input !w-16" type="number" value={cols} onChange={(e) => setCols(+e.target.value)} title="עמודות" />
          <input className="input !w-16" type="number" value={rows} onChange={(e) => setRows(+e.target.value)} title="שורות" />
          <button className="btn-gold" onClick={create}>צור</button>
        </div>
      </details>
    </div>
  );
}

/* ---------------- Initiative ---------------- */
function InitiativeTracker({ combatants, activeId, isDM, onUpdate }: any) {
  return (
    <div className="card">
      <h3 className="mb-2 font-display text-gold">סדר יוזמה</h3>
      <div className="space-y-1">
        {combatants.map((c: any) => {
          const conditions = safeArr(c.conditions);
          const active = c.id === activeId;
          return (
            <div key={c.id} className={`rounded border p-2 text-sm ${active ? "border-gold bg-[#241d17]" : "border-[#241d17]"} ${!c.isVisible ? "opacity-60" : ""}`}>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <b className="w-6 text-center text-gold">{c.initiative}</b>
                  <span className={c.kind === "monster" ? "text-red-300" : "text-blue-300"}>{c.kind === "monster" ? "👹" : "🛡"}</span>
                  {c.name}{!c.isVisible && " 👁️‍🗨️"}
                </span>
                <span className={c.currentHp === 0 ? "text-red-400" : ""}>{c.currentHp}/{c.maxHp}</span>
              </div>
              {conditions.length > 0 && <div className="mt-1 text-xs text-[#d1a000]">{conditions.join(", ")}</div>}
              {isDM && (
                <div className="mt-1 flex flex-wrap items-center gap-1 text-xs">
                  <button className="btn-ghost !px-1.5 !py-0" onClick={() => onUpdate({ op: "updateCombatant", combatantId: c.id, patch: { currentHp: Math.max(0, c.currentHp - 5) } })}>−5</button>
                  <button className="btn-ghost !px-1.5 !py-0" onClick={() => onUpdate({ op: "updateCombatant", combatantId: c.id, patch: { currentHp: Math.min(c.maxHp, c.currentHp + 5) } })}>+5</button>
                  <button className="btn-ghost !px-1.5 !py-0" onClick={() => onUpdate({ op: "updateCombatant", combatantId: c.id, patch: { isVisible: !c.isVisible } })}>{c.isVisible ? "הסתר" : "חשוף"}</button>
                  <select className="input !w-auto !py-0 text-xs" defaultValue="" onChange={(e) => { if (!e.target.value) return;
                    const has = conditions.includes(e.target.value);
                    const next = has ? conditions.filter((x: string) => x !== e.target.value) : [...conditions, e.target.value];
                    onUpdate({ op: "updateCombatant", combatantId: c.id, patch: { conditions: next } }); e.target.value = ""; }}>
                    <option value="">±מצב</option>
                    {CONDITIONS.map((cond) => <option key={cond}>{cond}</option>)}
                  </select>
                  <button className="btn-ghost !px-1.5 !py-0" onClick={() => onUpdate({ op: "removeCombatant", combatantId: c.id })}>🗑</button>
                </div>
              )}
            </div>
          );
        })}
        {combatants.length === 0 && <p className="text-sm text-[#a9977c]">אין משתתפים. הוסף בבניית הקרב.</p>}
      </div>
    </div>
  );
}

/* ---------------- Combat Log ---------------- */
function CombatLog({ log }: any) {
  return (
    <div className="card">
      <h3 className="mb-2 font-display text-gold">יומן קרב</h3>
      <div className="max-h-64 space-y-1 overflow-y-auto text-xs">
        {log.map((l: any) => (
          <div key={l.id} className="border-b border-[#241d17] pb-1">
            <span className="text-[#a9977c]">{l.actor}: </span>{l.message}
          </div>
        ))}
        {log.length === 0 && <p className="text-[#a9977c]">—</p>}
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
        <h4 className="mb-2 text-gold">הוסף שחקנים</h4>
        <div className="flex flex-wrap gap-1">
          {campaignChars.map((c: any) => (
            <button key={c.id} disabled={existingCharIds.has(c.id)} className={existingCharIds.has(c.id) ? "chip opacity-40" : "btn-ghost"}
              onClick={() => op({ op: "addPlayers", characterIds: [c.id] })}>{c.name}</button>
          ))}
          {campaignChars.length === 0 && <span className="text-sm text-[#a9977c]">אין דמויות בקמפיין.</span>}
        </div>
      </div>
      <div>
        <h4 className="mb-2 text-gold">הוסף אויבים (בסטיאריון SRD)</h4>
        <div className="mb-2 flex gap-1">
          <input className="input" placeholder="חיפוש מפלצת..." value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} />
          <button className="btn-ghost" onClick={search}>חפש</button>
          <input className="input !w-14" type="number" min={1} max={12} value={count} onChange={(e) => setCount(+e.target.value)} title="כמות" />
          <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={rollHp} onChange={(e) => setRollHp(e.target.checked)} />HP אקראי</label>
        </div>
        <div className="max-h-48 space-y-1 overflow-y-auto text-sm">
          {results.map((m: any) => (
            <div key={m.id} className="flex items-center justify-between border-b border-[#241d17] py-1">
              <span>{m.name} <span className="text-xs text-[#a9977c]">CR {m.cr} · HP {m.hp} · AC {m.ac}</span></span>
              <button className="btn-ghost !py-0.5" onClick={() => op({ op: "addMonster", monsterId: m.id, count, rollHp })}>+ הוסף</button>
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
      <p className="text-sm text-[#a9977c]">בחר אויב תוקף, פעולה, ומטרות (שחקן אחד או רבים) — המערכת מגלגלת תקיפה מול ה-AC של כל מטרה.</p>
      <div className="grid gap-2 md:grid-cols-3">
        <div>
          <label className="label">אויב תוקף</label>
          <select className="input" value={attackerId} onChange={(e) => { setAttackerId(e.target.value); setActionName(""); }}>
            <option value="">—</option>
            {attackers.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">פעולה</label>
          <select className="input" value={actionName} onChange={(e) => setActionName(e.target.value)}>
            {actions.map((a: any) => <option key={a.name} value={a.name}>{a.name}{a.toHit != null ? ` (+${a.toHit})` : a.save ? ` (DC ${a.save.dc} ${a.save.ability})` : ""}</option>)}
            {actions.length === 0 && <option>—</option>}
          </select>
        </div>
        <div>
          <label className="label">יתרון/חיסרון</label>
          <select className="input" value={adv} onChange={(e) => setAdv(e.target.value as any)}>
            <option value="none">רגיל</option><option value="adv">יתרון</option><option value="dis">חיסרון</option>
          </select>
        </div>
      </div>
      <div>
        <label className="label">מטרות (שחקנים)</label>
        <div className="flex flex-wrap gap-1">
          {players.map((p: any) => (
            <button key={p.id} className={targets.includes(p.id) ? "btn-gold" : "btn-ghost"}
              onClick={() => setTargets((t) => t.includes(p.id) ? t.filter((x) => x !== p.id) : [...t, p.id])}>
              {p.name} (AC {p.ac})
            </button>
          ))}
        </div>
      </div>
      <button className="btn-primary" disabled={!attackerId || targets.length === 0} onClick={doAttack}>🎲 גלגל תקיפה</button>
      {result?.outcomes && (
        <div className="rounded border border-[#3a2f24] p-2 text-sm">
          <b className="text-gold">{result.action}</b>
          {result.outcomes.map((o: any, i: number) => (
            <div key={i} className={o.hit ? "text-green-300" : "text-red-300"}>{o.message}</div>
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
