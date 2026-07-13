"use client";
// Game sessions tab (SPEC-DM §5): list, prep, live status, recaps.
import { useCallback, useEffect, useState } from "react";
import { useRealtime } from "@/lib/realtime/useRealtime";

type AgendaItem = { title: string; done: boolean; notes?: string };
type Session = {
  id: string; number: number; title: string; date: string | null;
  status: "PLANNED" | "LIVE" | "DONE";
  agenda: AgendaItem[];
  prepNotes?: string; recapPlayer: string; recapDm?: string;
  xpAwarded: number;
};

function StatusChip({ status }: { status: Session["status"] }) {
  if (status === "LIVE") return <span className="chip chip-live">● LIVE</span>;
  if (status === "DONE") return <span className="chip chip-gold">Done</span>;
  return <span className="chip">Planned</span>;
}

function fmtDate(date: string | null) {
  if (!date) return null;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/** ISO → value for <input type="datetime-local"> in local time. */
function toLocalInput(date: string | null): string {
  if (!date) return "";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function SessionsTab({ campaignId, isDM }: { campaignId: string; isDM: boolean }) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    try {
      const r = await fetch(`/api/campaigns/${campaignId}/sessions`);
      if (r.ok) setSessions((await r.json()).sessions ?? []);
    } finally {
      setLoaded(true);
    }
  }, [campaignId]);

  useEffect(() => { refetch(); }, [refetch]);
  useRealtime({ "session:changed": () => refetch() }, [campaignId]);

  async function op(body: Record<string, unknown>) {
    setBusy(true);
    try {
      await fetch(`/api/campaigns/${campaignId}/sessions`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      await refetch();
    } finally {
      setBusy(false);
    }
  }

  // Newest first (API order); players get the LIVE session pinned on top.
  const ordered = isDM ? sessions : [...sessions].sort((a, b) =>
    (b.status === "LIVE" ? 1 : 0) - (a.status === "LIVE" ? 1 : 0) || b.number - a.number);

  return (
    <div className="space-y-3">
      {isDM && (
        <div className="flex justify-end">
          <button className="btn-gold" disabled={busy} onClick={() => op({ op: "create" })}>+ New Session</button>
        </div>
      )}

      {loaded && ordered.length === 0 && (
        <div className="card"><p className="muted text-center text-sm">
          {isDM ? "No sessions yet. Create one to start planning." : "No sessions yet."}
        </p></div>
      )}

      {ordered.map((s) => (
        <div key={s.id} className={`card space-y-2 ${!isDM && s.status === "LIVE" ? "session-live-card" : ""}`}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="font-display text-lg text-gold">Session {s.number}{s.title ? ` · ${s.title}` : ""}</h3>
              <div className="muted text-xs">
                {fmtDate(s.date) ?? "No date set"}
                {s.xpAwarded > 0 && <span className="ml-2 text-[#6a4f14]">✦ {s.xpAwarded} XP awarded</span>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <StatusChip status={s.status} />
              {isDM && s.status !== "LIVE" && (
                <button className="btn-primary !px-2 !py-0.5 text-xs" disabled={busy} onClick={() => op({ op: "setStatus", sessionId: s.id, status: "LIVE" })}>▶ Start</button>
              )}
              {isDM && s.status === "LIVE" && (
                <button className="btn-ghost !px-2 !py-0.5 text-xs" disabled={busy} onClick={() => op({ op: "setStatus", sessionId: s.id, status: "DONE" })}>■ End</button>
              )}
              {isDM && (
                <button className="btn-ghost !px-2 !py-0.5 text-xs" onClick={() => setEditing((e) => (e === s.id ? null : s.id))}>
                  {editing === s.id ? "▲ Close" : "✎ Edit"}
                </button>
              )}
            </div>
          </div>

          {s.recapPlayer && (
            <p className="text-sm text-[#5e5448]">
              {s.recapPlayer.length > 220 && editing !== s.id ? `${s.recapPlayer.slice(0, 220)}…` : s.recapPlayer}
            </p>
          )}

          {s.agenda.length > 0 && editing !== s.id && (
            <ul className="space-y-0.5 text-sm">
              {s.agenda.map((a, i) => (
                <li key={i} className={a.done ? "text-[#8a7a5c] line-through" : ""}>
                  {a.done ? "☑" : "☐"} {a.title}
                </li>
              ))}
            </ul>
          )}

          {isDM && editing === s.id && (
            <SessionEditor
              campaignId={campaignId} session={s} busy={busy}
              onOp={op} onDelete={() => { setEditing(null); op({ op: "delete", sessionId: s.id }); }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function SessionEditor({ campaignId, session, busy, onOp, onDelete }: {
  campaignId: string; session: Session; busy: boolean;
  onOp: (body: Record<string, unknown>) => Promise<void>; onDelete: () => void;
}) {
  const [title, setTitle] = useState(session.title);
  const [date, setDate] = useState(toLocalInput(session.date));
  const [agenda, setAgenda] = useState<AgendaItem[]>(session.agenda);
  const [newItem, setNewItem] = useState("");
  const [prepNotes, setPrepNotes] = useState(session.prepNotes ?? "");
  const [recapPlayer, setRecapPlayer] = useState(session.recapPlayer ?? "");
  const [recapDm, setRecapDm] = useState(session.recapDm ?? "");
  const [xp, setXp] = useState(String(session.xpAwarded || ""));
  const [awarding, setAwarding] = useState(false);

  function save() {
    onOp({
      op: "update", sessionId: session.id,
      patch: {
        title, date: date ? new Date(date).toISOString() : null,
        agendaJson: agenda.map((a) => ({ title: a.title, done: !!a.done, ...(a.notes ? { notes: a.notes } : {}) })),
        prepNotes, recapPlayer, recapDm,
        xpAwarded: Math.max(0, Math.min(1_000_000, parseInt(xp) || 0)),
      },
    });
  }

  async function awardToParty() {
    const amount = Math.max(0, Math.min(1_000_000, parseInt(xp) || 0));
    if (!amount || awarding) return;
    setAwarding(true);
    try {
      const r = await fetch(`/api/campaigns/${campaignId}/xp`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount }),
      });
      if (r.ok) {
        // Stamp the awarded amount on the session record.
        await onOp({ op: "update", sessionId: session.id, patch: { xpAwarded: amount } });
      }
    } finally {
      setAwarding(false);
    }
  }

  const DmChip = () => <span className="chip !py-0 text-[10px]" title="Not visible to players">🔒 DM only</span>;

  return (
    <div className="panel-inset space-y-3 p-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <label className="label">Title</label>
          <input className="input" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <label className="label">Date & Time</label>
          <input className="input" type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>

      <div>
        <label className="label">Agenda</label>
        <div className="space-y-1">
          {agenda.map((a, i) => (
            <div key={i} className="flex items-center gap-2">
              <input type="checkbox" className="h-4 w-4" checked={a.done}
                onChange={(e) => setAgenda((ag) => ag.map((x, j) => (j === i ? { ...x, done: e.target.checked } : x)))} />
              <input className="input !py-1" value={a.title} maxLength={300}
                onChange={(e) => setAgenda((ag) => ag.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
              <input className="input !py-1 max-w-[180px]" placeholder="Notes (DM)" value={a.notes ?? ""} maxLength={2000}
                onChange={(e) => setAgenda((ag) => ag.map((x, j) => (j === i ? { ...x, notes: e.target.value } : x)))} />
              <button className="btn-ghost !px-2 !py-0.5" title="Remove"
                onClick={() => setAgenda((ag) => ag.filter((_, j) => j !== i))}>🗑</button>
            </div>
          ))}
          <div className="flex gap-2">
            <input className="input !py-1" placeholder="New agenda item..." value={newItem} maxLength={300}
              onChange={(e) => setNewItem(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newItem.trim() && agenda.length < 50) {
                  setAgenda((ag) => [...ag, { title: newItem.trim(), done: false }]); setNewItem("");
                }
              }} />
            <button className="btn-ghost !py-1" disabled={!newItem.trim() || agenda.length >= 50}
              onClick={() => { setAgenda((ag) => [...ag, { title: newItem.trim(), done: false }]); setNewItem(""); }}>+ Add</button>
          </div>
        </div>
      </div>

      <div>
        <label className="label">Prep Notes <DmChip /></label>
        <textarea className="input min-h-[80px]" value={prepNotes} maxLength={20000} onChange={(e) => setPrepNotes(e.target.value)} />
      </div>
      <div>
        <label className="label">Player Recap</label>
        <textarea className="input min-h-[80px]" value={recapPlayer} maxLength={20000} onChange={(e) => setRecapPlayer(e.target.value)} />
      </div>
      <div>
        <label className="label">DM Recap <DmChip /></label>
        <textarea className="input min-h-[80px]" value={recapDm} maxLength={20000} onChange={(e) => setRecapDm(e.target.value)} />
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="label">XP Awarded</label>
          <input className="input max-w-[120px]" inputMode="numeric" value={xp} onChange={(e) => setXp(e.target.value)} />
        </div>
        <button className="btn-gold" disabled={awarding || busy || !(parseInt(xp) > 0)} onClick={awardToParty}>
          {awarding ? "Awarding..." : "✦ Award to Party"}
        </button>
      </div>

      <div className="flex justify-between border-t border-[#dfd5b8] pt-2">
        <button className="btn-ghost text-[#8b2f2e]" disabled={busy} onClick={onDelete}>🗑 Delete Session</button>
        <button className="btn-primary" disabled={busy} onClick={save}>Save</button>
      </div>
    </div>
  );
}
