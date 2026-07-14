"use client";
// Player notes (SPEC-PLAYER §14) — dynamic tabs (fixed defaults + custom
// categories), pin, share-with-DM, search.
import { useCallback, useEffect, useMemo, useState } from "react";

const DEFAULT_CATEGORIES = ["General", "Session", "NPCs", "Locations", "Quests", "Secrets", "Rules"] as const;
const MAX_TAB_NAME = 30;

type Note = {
  id: string;
  category: string;
  title: string;
  body: string;
  pinned: boolean;
  sharedWithDm: boolean;
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

function isDefaultTab(name: string): boolean {
  return (DEFAULT_CATEGORIES as readonly string[]).includes(name);
}

export function NotesSection({ characterId, canUse, isOwner, isDM }: {
  characterId: string; canUse: boolean; isOwner: boolean; isDM: boolean;
}) {
  // Owner writes notes; the DM only reads notes shared with them. `canUse`
  // mirrors the sheet's gameplay gate; notes stay editable for the owner.
  void canUse;
  const editable = isOwner;
  const dmView = !isOwner && isDM;

  const [notes, setNotes] = useState<Note[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("All");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<{ note: Note | null; initialCategory?: string } | null>(null);
  // Custom tabs created this session that don't have a note yet — merged with
  // the categories actually present on notes so an empty new tab still shows.
  const [pendingTabs, setPendingTabs] = useState<string[]>([]);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch(`/api/characters/${characterId}/notes`);
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
  }, [characterId]);

  useEffect(() => { refresh(); }, [refresh]);

  // Tabs = fixed defaults + every distinct category present on notes + pending
  // custom tabs, deduplicated; customs listed after the defaults, sorted.
  const tabs = useMemo(() => {
    const custom = new Set<string>();
    for (const n of notes) if (!isDefaultTab(n.category)) custom.add(n.category);
    for (const t of pendingTabs) if (!isDefaultTab(t)) custom.add(t);
    return [...DEFAULT_CATEGORIES, ...[...custom].sort((a, b) => a.localeCompare(b))];
  }, [notes, pendingTabs]);

  // If the selected tab vanished (tab deleted / rename elsewhere), fall back.
  useEffect(() => {
    if (filter !== "All" && !tabs.includes(filter)) setFilter("All");
  }, [tabs, filter]);

  async function patchNote(noteId: string, fields: Partial<Pick<Note, "pinned" | "sharedWithDm">>) {
    await fetch(`/api/characters/${characterId}/notes`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ noteId, ...fields }),
    });
    refresh();
  }
  async function deleteNote(noteId: string) {
    await fetch(`/api/characters/${characterId}/notes?noteId=${noteId}`, { method: "DELETE" });
    refresh();
  }

  function promptTabName(message: string, initial = ""): string | null {
    const raw = window.prompt(message, initial);
    if (raw == null) return null;
    const name = raw.trim().slice(0, MAX_TAB_NAME);
    if (!name) return null;
    return name;
  }

  function newTab() {
    const name = promptTabName(`Tab name (max ${MAX_TAB_NAME} characters):`);
    if (!name) return;
    if (tabs.includes(name)) { setFilter(name); return; }
    setPendingTabs((prev) => [...prev, name]);
    setFilter(name);
    // Create the tab's first note right away — a tab exists through its notes.
    setEditing({ note: null, initialCategory: name });
  }

  async function renameTab(from: string) {
    const to = promptTabName(`Rename tab "${from}" to:`, from);
    if (!to || to === from) return;
    if (isDefaultTab(to) || tabs.includes(to)) {
      window.alert(`A tab named "${to}" already exists.`);
      return;
    }
    const hasNotes = notes.some((n) => n.category === from);
    if (hasNotes) {
      await fetch(`/api/characters/${characterId}/notes`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "renameCategory", from, to }),
      });
    }
    setPendingTabs((prev) => [...prev.filter((t) => t !== from), ...(hasNotes ? [] : [to])]);
    setFilter(to);
    refresh();
  }

  async function deleteTab(name: string) {
    const inTab = notes.filter((n) => n.category === name);
    if (inTab.length > 0) {
      const ok = window.confirm(
        `Delete tab "${name}" and its ${inTab.length} note${inTab.length === 1 ? "" : "s"}? This cannot be undone.`);
      if (!ok) return;
      await fetch(`/api/characters/${characterId}/notes?category=${encodeURIComponent(name)}`, { method: "DELETE" });
    }
    setPendingTabs((prev) => prev.filter((t) => t !== name));
    setFilter("All");
    refresh();
  }

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return notes.filter((n) =>
      (filter === "All" || n.category === filter) &&
      (!q || n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q)));
  }, [notes, filter, search]);

  if (!isOwner && !isDM) return null;

  const customTabSelected = filter !== "All" && !isDefaultTab(filter);

  return (
    <div>
      {/* Header: tabs + new tab + new note + search */}
      <div className="mb-2 flex flex-wrap items-center gap-1">
        {["All", ...tabs].map((c) => (
          <button key={c} onClick={() => setFilter(c)}
            className="chip cursor-pointer"
            style={filter === c ? { background: "var(--blood)", borderColor: "var(--wine-dark)", color: "#fff" } : undefined}>
            {c}
          </button>
        ))}
        {editable && (
          <button className="chip cursor-pointer opacity-80" title="Create a custom note tab" onClick={newTab}>
            + New tab
          </button>
        )}
        <div className="ml-auto flex items-center gap-1">
          <input className="input !w-40 !py-1 text-sm" placeholder="Search notes..."
            value={search} onChange={(e) => setSearch(e.target.value)} />
          {editable && (
            <button className="btn-primary !py-1 text-sm"
              onClick={() => setEditing({ note: null, initialCategory: filter !== "All" ? filter : undefined })}>
              + New Note
            </button>
          )}
        </div>
      </div>

      {/* Custom tab management */}
      {editable && customTabSelected && (
        <div className="mb-2 flex items-center gap-2 text-xs">
          <span className="text-[#5e5448]">Custom tab &ldquo;{filter}&rdquo;</span>
          <button className="btn-ghost !px-1.5 !py-0 text-xs" onClick={() => renameTab(filter)}>Rename tab</button>
          <button className="text-xs text-[#5e5448] hover:text-red-700" onClick={() => deleteTab(filter)}>Delete tab</button>
        </div>
      )}

      {dmView && (
        <p className="mb-2 text-xs text-[#5e5448]">Shared by the player — read-only.</p>
      )}
      {error && <p className="text-sm text-red-700">{error}</p>}

      {/* Empty state */}
      {loaded && !error && visible.length === 0 && (
        <div className="panel-inset p-4 text-center">
          <p className="text-sm text-[#5e5448]">
            {notes.length === 0
              ? (dmView ? "The player hasn't shared any notes with you yet." : "No notes yet — your adventures deserve a chronicle.")
              : customTabSelected && !notes.some((n) => n.category === filter)
                ? `The "${filter}" tab is empty — add its first note.`
                : "No notes match your search."}
          </p>
          {editable && notes.length === 0 && (
            <button className="btn-ghost mt-2 text-sm" onClick={() => setEditing({ note: null })}>Write your first note</button>
          )}
          {editable && notes.length > 0 && customTabSelected && !notes.some((n) => n.category === filter) && (
            <button className="btn-ghost mt-2 text-sm"
              onClick={() => setEditing({ note: null, initialCategory: filter })}>
              Add a note to &ldquo;{filter}&rdquo;
            </button>
          )}
        </div>
      )}

      {/* Notes list */}
      <div className="space-y-2">
        {visible.map((n) => {
          const isOpen = expanded.has(n.id);
          return (
            <div key={n.id} className="panel-inset p-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-bold text-sm">{n.title || "Untitled"}</span>
                <span className={n.category === "Secrets" ? "chip char-conc" : "chip"}>{n.category}</span>
                {editable ? (
                  <button
                    className={`chip cursor-pointer ${n.sharedWithDm ? "chip-gold" : "opacity-60"}`}
                    title={n.sharedWithDm ? "The DM can read this note. Click to make it private." : "Private — click to share with the DM."}
                    onClick={() => patchNote(n.id, { sharedWithDm: !n.sharedWithDm })}>
                    {n.sharedWithDm ? "Shared with DM" : "Private"}
                  </button>
                ) : (
                  n.sharedWithDm && <span className="chip chip-gold">Shared with DM</span>
                )}
                <span className="ml-auto flex items-center gap-1">
                  {editable ? (
                    <button title={n.pinned ? "Unpin" : "Pin"}
                      className={`cursor-pointer p-0.5 ${n.pinned ? "text-[#6a4f14]" : "text-[#cdbf9f] hover:text-[#6a4f14]"}`}
                      onClick={() => patchNote(n.id, { pinned: !n.pinned })}>
                      <PinIcon filled={n.pinned} />
                    </button>
                  ) : (
                    n.pinned && <span className="text-[#6a4f14]"><PinIcon filled /></span>
                  )}
                  {editable && (
                    <>
                      <button className="btn-ghost !px-1.5 !py-0 text-xs" onClick={() => setEditing({ note: n })}>Edit</button>
                      <button className="text-xs text-[#5e5448] hover:text-red-700"
                        title="Delete note" onClick={() => deleteNote(n.id)}>✕</button>
                    </>
                  )}
                </span>
              </div>
              {n.body && (
                <p className={`mt-1 cursor-pointer whitespace-pre-wrap text-sm ${isOpen ? "" : "line-clamp-3"}`}
                  title={isOpen ? "Click to collapse" : "Click to expand"}
                  onClick={() => setExpanded((prev) => {
                    const next = new Set(prev);
                    if (next.has(n.id)) next.delete(n.id); else next.add(n.id);
                    return next;
                  })}>
                  {n.body}
                </p>
              )}
              <p className="mt-1 text-[10px] text-[#5e5448]">Updated {fmtDate(n.updatedAt)}</p>
            </div>
          );
        })}
      </div>

      {editing && editable && (
        <NoteModal
          characterId={characterId}
          note={editing.note}
          categories={tabs}
          initialCategory={editing.initialCategory}
          onClose={(changed) => { setEditing(null); if (changed) refresh(); }}
        />
      )}
    </div>
  );
}

function NoteModal({ characterId, note, categories, initialCategory, onClose }: {
  characterId: string;
  note: Note | null;
  categories: string[];
  initialCategory?: string;
  onClose: (changed: boolean) => void;
}) {
  const [category, setCategory] = useState<string>(note?.category ?? initialCategory ?? "General");
  const [title, setTitle] = useState(note?.title ?? "");
  const [body, setBody] = useState(note?.body ?? "");
  const [pinned, setPinned] = useState(note?.pinned ?? false);
  const [sharedWithDm, setSharedWithDm] = useState(note?.sharedWithDm ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The note's current category may be a custom tab not in the list (e.g. a
  // legacy category) — keep it selectable.
  const options = useMemo(
    () => (categories.includes(category) ? categories : [...categories, category]),
    [categories, category],
  );

  async function save() {
    setSaving(true);
    setError(null);
    const payload = { category, title, body, pinned, sharedWithDm };
    const r = await fetch(`/api/characters/${characterId}/notes`, {
      method: note ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(note ? { noteId: note.id, ...payload } : payload),
    }).catch(() => null);
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
              {options.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <input className="input flex-1" placeholder="Title" maxLength={120}
              value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <textarea className="input" rows={8} placeholder="Write your note..." maxLength={8000}
            value={body} onChange={(e) => setBody(e.target.value)} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
            Pin to top
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-0.5" checked={sharedWithDm} onChange={(e) => setSharedWithDm(e.target.checked)} />
            <span>
              Share with DM
              <span className="block text-xs text-[#5e5448]">The DM will be able to read this note.</span>
            </span>
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
