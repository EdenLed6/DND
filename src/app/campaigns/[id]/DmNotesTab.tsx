"use client";
// DM Notes & Secrets (SPEC-DM §14) — the DM's campaign journal. Notes stay
// behind the screen until revealed; revealed notes appear to players as
// live handouts (with a brief highlight when they arrive).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRealtime } from "@/lib/realtime/useRealtime";

const CATEGORIES = [
  "Campaign", "Session", "NPC", "Location", "Quest",
  "Encounter", "Character", "Secret", "Handout",
] as const;
type Category = (typeof CATEGORIES)[number];

type Note = {
  id: string;
  title: string;
  body: string;
  category: string;
  visibility: "dm" | "players";
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
};

function PinIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"
      fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 17v5" />
      <path d="M9 3h6l-1 7 3 3H7l3-3-1-7z" />
    </svg>
  );
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
    " " + d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
}

export function DmNotesTab({ campaignId, isDM }: { campaignId: string; isDM: boolean }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"All" | Category>("All");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Note | "new" | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch(`/api/campaigns/${campaignId}/dm-notes`);
      if (!r.ok) {
        setError((await r.json().catch(() => null))?.error ?? "Failed to load notes");
        setLoaded(true);
        return;
      }
      const data = await r.json();
      setNotes(data.notes ?? []);
      setError(null);
      setLoaded(true);
    } catch {
      setError("Failed to load notes");
      setLoaded(true);
    }
  }, [campaignId]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => () => { if (flashTimer.current) clearTimeout(flashTimer.current); }, []);

  // Live updates: refetch on any change; when the DM reveals a note, players
  // get a subtle highlight ring on the freshly arrived handout for ~3s.
  useRealtime({
    "dmnotes:changed": () => refresh(),
    "note:revealed": (p: { noteId: string }) => {
      refresh();
      if (!isDM && p?.noteId) {
        setFlashId(p.noteId);
        if (flashTimer.current) clearTimeout(flashTimer.current);
        flashTimer.current = setTimeout(() => setFlashId(null), 3000);
      }
    },
  }, [campaignId, isDM]);

  async function op(body: Record<string, unknown>) {
    const r = await fetch(`/api/campaigns/${campaignId}/dm-notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    if (r && !r.ok) setError((await r.json().catch(() => null))?.error ?? "Action failed");
    refresh();
  }

  const visible = useMemo(
    () => notes.filter((n) => filter === "All" || n.category === filter),
    [notes, filter],
  );

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  // ---------- Player view: revealed handouts only, read-only ----------
  if (!isDM) {
    return (
      <div className="card">
        <h3 className="font-display text-gold">Handouts &amp; Notes from the DM</h3>
        {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
        {loaded && !error && notes.length === 0 && (
          <div className="panel-inset mt-2 p-4 text-center">
            <p className="text-sm text-[#5e5448]">Nothing has been revealed yet. The DM is keeping their secrets… for now.</p>
          </div>
        )}
        <div className="mt-2 space-y-2">
          {notes.map((n) => {
            const isOpen = expanded.has(n.id);
            return (
              <div key={n.id} className={`panel-inset p-3 ${flashId === n.id ? "note-flash" : ""}`}>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-sm font-bold">{n.title || "Untitled"}</span>
                  <span className="chip">{n.category}</span>
                </div>
                {n.body && (
                  <p className={`mt-1 cursor-pointer whitespace-pre-wrap text-sm ${isOpen ? "" : "line-clamp-3"}`}
                    title={isOpen ? "Click to collapse" : "Click to expand"}
                    onClick={() => toggleExpanded(n.id)}>
                    {n.body}
                  </p>
                )}
                <p className="mt-1 text-[10px] text-[#5e5448]">Revealed · updated {fmtDate(n.updatedAt)}</p>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ---------- DM view ----------
  return (
    <div className="card">
      <div className="mb-2 flex flex-wrap items-center gap-1">
        {(["All", ...CATEGORIES] as const).map((c) => (
          <button key={c} onClick={() => setFilter(c)}
            className="chip cursor-pointer"
            style={filter === c ? { background: "var(--blood)", borderColor: "var(--wine-dark)", color: "#fff" } : undefined}>
            {c}
          </button>
        ))}
        <button className="btn-primary ml-auto !py-1 text-sm" onClick={() => setEditing("new")}>+ New Note</button>
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}

      {loaded && !error && visible.length === 0 && (
        <div className="panel-inset p-4 text-center">
          <p className="text-sm text-[#5e5448]">
            {notes.length === 0 ? "No notes yet — every great campaign starts with a secret." : "No notes in this category."}
          </p>
          {notes.length === 0 && (
            <button className="btn-ghost mt-2 text-sm" onClick={() => setEditing("new")}>Write your first note</button>
          )}
        </div>
      )}

      <div className="space-y-2">
        {visible.map((n) => {
          const isOpen = expanded.has(n.id);
          const revealed = n.visibility === "players";
          return (
            <div key={n.id} className={`panel-inset p-3 ${n.category === "Secret" ? "dm-note-secret" : ""}`}>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-sm font-bold">{n.title || "Untitled"}</span>
                <span className={n.category === "Secret" ? "chip char-conc" : "chip"}>{n.category}</span>
                {revealed ? (
                  <button className="chip chip-gold cursor-pointer"
                    title="Players can read this note. Click to hide it again."
                    onClick={() => op({ op: "reveal", noteId: n.id, visibility: "dm" })}>
                    Revealed
                  </button>
                ) : (
                  <button className="chip cursor-pointer"
                    style={{ background: "var(--blood)", borderColor: "var(--wine-dark)", color: "#fff" }}
                    title="Reveal this note to all players as a handout."
                    onClick={() => op({ op: "reveal", noteId: n.id, visibility: "players" })}>
                    Reveal to players
                  </button>
                )}
                <span className="ml-auto flex items-center gap-1">
                  <button title={n.pinned ? "Unpin" : "Pin"}
                    className={`cursor-pointer p-0.5 ${n.pinned ? "text-[#6a4f14]" : "text-[#cdbf9f] hover:text-[#6a4f14]"}`}
                    onClick={() => op({ op: "update", noteId: n.id, patch: { pinned: !n.pinned } })}>
                    <PinIcon filled={n.pinned} />
                  </button>
                  <button className="btn-ghost !px-1.5 !py-0 text-xs" onClick={() => setEditing(n)}>Edit</button>
                  <button className="text-xs text-[#5e5448] hover:text-red-700" title="Delete note"
                    onClick={() => op({ op: "delete", noteId: n.id })}>✕</button>
                </span>
              </div>
              {n.body && (
                <p className={`mt-1 cursor-pointer whitespace-pre-wrap text-sm ${isOpen ? "" : "line-clamp-3"}`}
                  title={isOpen ? "Click to collapse" : "Click to expand"}
                  onClick={() => toggleExpanded(n.id)}>
                  {n.body}
                </p>
              )}
              <p className="mt-1 text-[10px] text-[#5e5448]">Updated {fmtDate(n.updatedAt)}</p>
            </div>
          );
        })}
      </div>

      {editing && (
        <DmNoteModal
          campaignId={campaignId}
          note={editing === "new" ? null : editing}
          onClose={(changed) => { setEditing(null); if (changed) refresh(); }}
        />
      )}
    </div>
  );
}

function DmNoteModal({ campaignId, note, onClose }: {
  campaignId: string; note: Note | null; onClose: (changed: boolean) => void;
}) {
  const [category, setCategory] = useState<string>(note?.category ?? "Campaign");
  const [title, setTitle] = useState(note?.title ?? "");
  const [body, setBody] = useState(note?.body ?? "");
  const [pinned, setPinned] = useState(note?.pinned ?? false);
  const [visibility, setVisibility] = useState<"dm" | "players">(note?.visibility ?? "dm");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    const payload = note
      ? { op: "update", noteId: note.id, patch: { category, title, body, pinned } }
      : { op: "create", category, title, body, pinned, visibility };
    const r = await fetch(`/api/campaigns/${campaignId}/dm-notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => null);
    // Visibility changes go through the reveal op (it announces the handout).
    if (r?.ok && note && visibility !== note.visibility) {
      await fetch(`/api/campaigns/${campaignId}/dm-notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "reveal", noteId: note.id, visibility }),
      }).catch(() => null);
    }
    setSaving(false);
    if (!r || !r.ok) {
      setError((await r?.json().catch(() => null))?.error ?? "Failed to save note");
      return;
    }
    onClose(true);
  }

  return (
    <div className="overlay" onClick={() => onClose(false)}>
      <div className="card modal" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-lg text-gold">{note ? "Edit Note" : "New Note"}</h3>
          <button className="btn-ghost !py-0.5" onClick={() => onClose(false)}>Close</button>
        </div>
        <div className="space-y-2">
          <div className="flex gap-2">
            <select className="input !w-auto" value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <input className="input flex-1" placeholder="Title" maxLength={120}
              value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <textarea className="input" rows={8} placeholder="Write your note..." maxLength={10000}
            value={body} onChange={(e) => setBody(e.target.value)} />
          <div className="flex items-center gap-1 text-sm">
            <span className="mr-1 text-xs font-bold text-[#5e5448]">Visibility:</span>
            <button type="button" className="chip cursor-pointer"
              style={visibility === "dm" ? { background: "var(--blood)", borderColor: "var(--wine-dark)", color: "#fff" } : undefined}
              onClick={() => setVisibility("dm")}>
              DM only
            </button>
            <button type="button" className={`chip cursor-pointer ${visibility === "players" ? "chip-gold" : ""}`}
              onClick={() => setVisibility("players")}>
              Visible to players
            </button>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
            Pin to top
          </label>
          {error && <p className="text-sm text-red-700">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button className="btn-ghost" onClick={() => onClose(false)}>Cancel</button>
            <button className="btn-primary" disabled={saving} onClick={save}>{saving ? "Saving..." : "Save"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
