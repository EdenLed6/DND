"use client";
// Shared party inventory (SPEC-DM §11) — the party stash. The DM stocks it
// (from the SRD or homebrew, optionally hidden), reveals loot, and hands items
// to characters; players claim revealed items into a character they own.
import { useCallback, useEffect, useState } from "react";
import { useRealtime } from "@/lib/realtime/useRealtime";

type PartyItem = {
  id: string;
  name: string;
  quantity: number;
  notes: string | null;
  srcEquipmentId: string | null;
  srcMagicItemId: string | null;
  hidden: boolean;
};

type CharRef = { id: string; name: string };

function EyeOffIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function sourceChip(it: PartyItem) {
  if (it.srcMagicItemId) return <span className="chip char-conc">Magic</span>;
  if (it.srcEquipmentId) return <span className="chip">Equipment</span>;
  return <span className="chip opacity-70">Custom</span>;
}

export function PartyLootTab({ campaignId, isDM, myCharacters }: {
  campaignId: string; isDM: boolean; myCharacters: { id: string; name: string }[];
}) {
  const [items, setItems] = useState<PartyItem[]>([]);
  const [characters, setCharacters] = useState<CharRef[]>([]); // DM's Give picker
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editingNotes, setEditingNotes] = useState<{ id: string; value: string } | null>(null);
  const [claimChar, setClaimChar] = useState<string>(myCharacters[0]?.id ?? "");

  const refresh = useCallback(async () => {
    try {
      const r = await fetch(`/api/campaigns/${campaignId}/party-items`);
      if (!r.ok) {
        setError((await r.json().catch(() => null))?.error ?? "Failed to load party inventory");
        setLoaded(true);
        return;
      }
      const data = await r.json();
      setItems(data.items ?? []);
      setCharacters(data.characters ?? []);
      setError(null);
      setLoaded(true);
    } catch {
      setError("Failed to load party inventory");
      setLoaded(true);
    }
  }, [campaignId]);

  useEffect(() => { refresh(); }, [refresh]);
  useRealtime({ "loot:changed": () => refresh() }, [campaignId]);

  async function op(body: Record<string, unknown>): Promise<boolean> {
    const r = await fetch(`/api/campaigns/${campaignId}/party-items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    if (r && !r.ok) setError((await r.json().catch(() => null))?.error ?? "Action failed");
    refresh();
    return !!r?.ok;
  }

  const canClaim = !isDM && myCharacters.length > 0;

  return (
    <div className="card">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-display text-gold">Party Inventory</h3>
        {isDM && <button className="btn-primary !py-1 text-sm" onClick={() => setShowAdd(true)}>+ Add Item</button>}
      </div>

      {error && <p className="mb-2 text-sm text-red-700">{error}</p>}

      {loaded && !error && items.length === 0 && (
        <div className="panel-inset p-4 text-center">
          <p className="text-sm text-[#5e5448]">
            {isDM ? "The stash is empty — add loot for the party to find." : "The party hasn't gathered any shared loot yet."}
          </p>
        </div>
      )}

      <div className="space-y-2">
        {items.map((it) => (
          <div key={it.id} className={`panel-inset p-2.5 ${it.hidden ? "loot-hidden" : ""}`}>
            <div className="flex flex-wrap items-center gap-1.5">
              {it.hidden && <span className="text-[#5e5448]" title="Hidden from players"><EyeOffIcon /></span>}
              <span className="text-sm font-bold">{it.name}</span>
              {it.quantity > 1 && <span className="text-sm text-[#5e5448]">×{it.quantity}</span>}
              {sourceChip(it)}
              {it.hidden && isDM && (
                <button className="chip cursor-pointer"
                  style={{ background: "var(--blood)", borderColor: "var(--wine-dark)", color: "#fff" }}
                  title="Reveal this item to the players."
                  onClick={() => op({ op: "reveal", itemId: it.id })}>
                  Reveal
                </button>
              )}
              <span className="ml-auto flex items-center gap-1 text-xs">
                {isDM && (
                  <>
                    <button className="chip cursor-pointer" title="Increase quantity"
                      onClick={() => op({ op: "update", itemId: it.id, patch: { quantity: it.quantity + 1 } })}>+</button>
                    <button className="chip cursor-pointer" title="Decrease quantity"
                      onClick={() => it.quantity > 1 && op({ op: "update", itemId: it.id, patch: { quantity: it.quantity - 1 } })}>−</button>
                    <button className="btn-ghost !px-1.5 !py-0 text-xs"
                      onClick={() => setEditingNotes({ id: it.id, value: it.notes ?? "" })}>Notes</button>
                    <select className="input !w-auto !py-0.5 text-xs" value=""
                      title="Give this item to a character (1 at a time)."
                      onChange={(e) => e.target.value && op({ op: "give", itemId: it.id, characterId: e.target.value, quantity: 1 })}>
                      <option value="">Give to…</option>
                      {characters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <button className="text-xs text-[#5e5448] hover:text-red-700" title="Delete item"
                      onClick={() => op({ op: "delete", itemId: it.id })}>✕</button>
                  </>
                )}
                {canClaim && (
                  <>
                    {myCharacters.length > 1 && (
                      <select className="input !w-auto !py-0.5 text-xs" value={claimChar}
                        onChange={(e) => setClaimChar(e.target.value)}>
                        {myCharacters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    )}
                    <button className="btn-gold !py-0.5 text-xs"
                      title="Take this item into your character's inventory."
                      onClick={() => op({ op: "claim", itemId: it.id, characterId: claimChar || myCharacters[0].id, quantity: 1 })}>
                      Claim
                    </button>
                  </>
                )}
              </span>
            </div>
            {editingNotes?.id === it.id ? (
              <div className="mt-1 flex gap-1">
                <input className="input !py-1 text-sm" placeholder="Notes..." maxLength={1000} autoFocus
                  value={editingNotes.value}
                  onChange={(e) => setEditingNotes({ id: it.id, value: e.target.value })}
                  onKeyDown={async (e) => {
                    if (e.key === "Enter") {
                      await op({ op: "update", itemId: it.id, patch: { notes: editingNotes.value || null } });
                      setEditingNotes(null);
                    }
                    if (e.key === "Escape") setEditingNotes(null);
                  }} />
                <button className="btn-gold !py-0.5 text-xs" onClick={async () => {
                  await op({ op: "update", itemId: it.id, patch: { notes: editingNotes.value || null } });
                  setEditingNotes(null);
                }}>Save</button>
              </div>
            ) : (
              it.notes && <p className="mt-1 text-xs text-[#5e5448]">{it.notes}</p>
            )}
          </div>
        ))}
      </div>

      {showAdd && isDM && (
        <AddPartyItemModal campaignId={campaignId} onClose={() => { setShowAdd(false); refresh(); }} />
      )}
    </div>
  );
}

// Compact SRD-search add modal (same /api/srd/items endpoint the character
// sheet uses), plus a custom/homebrew row and a "hidden from players" toggle.
function AddPartyItemModal({ campaignId, onClose }: { campaignId: string; onClose: () => void }) {
  const [type, setType] = useState<"equipment" | "magic">("equipment");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [custom, setCustom] = useState("");
  const [qty, setQty] = useState(1);
  const [hidden, setHidden] = useState(false);
  const [added, setAdded] = useState<string | null>(null);

  async function search() {
    const r = await fetch(`/api/srd/items?type=${type}&q=${encodeURIComponent(q)}`).catch(() => null);
    if (r?.ok) setRows(await r.json());
  }
  useEffect(() => { search(); /* eslint-disable-next-line */ }, [type]);

  async function add(payload: Record<string, unknown>, label: string) {
    const r = await fetch(`/api/campaigns/${campaignId}/party-items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ op: "add", quantity: qty, hidden, ...payload }),
    }).catch(() => null);
    if (r?.ok) setAdded(label);
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="card modal" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-lg text-gold">Add Party Item</h3>
          <button className="btn-ghost !py-0.5" onClick={onClose}>Close</button>
        </div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <button className={type === "equipment" ? "btn-gold" : "btn-ghost"} onClick={() => setType("equipment")}>Equipment</button>
          <button className={type === "magic" ? "btn-gold" : "btn-ghost"} onClick={() => setType("magic")}>Magic Items</button>
          <label className="ml-auto flex items-center gap-1 text-sm" title="Hidden items are only visible to you until revealed.">
            Qty
            <input type="number" className="input !w-16 !py-1 text-sm" min={1} max={9999} value={qty}
              onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))} />
          </label>
          <label className="flex items-center gap-1.5 text-sm">
            <input type="checkbox" checked={hidden} onChange={(e) => setHidden(e.target.checked)} />
            Hidden from players
          </label>
        </div>
        <div className="mb-2 flex gap-1">
          <input className="input" placeholder="Search..." value={q}
            onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} />
          <button className="btn-ghost" onClick={search}>Search</button>
        </div>
        <div className="max-h-64 space-y-1 overflow-y-auto text-sm">
          {rows.map((r) => (
            <div key={`${r.kind}-${r.id}`} className="flex items-center justify-between border-b border-[#dfd5b8] py-1">
              <span>{r.name} <span className="text-xs text-[#5e5448]">
                {r.kind === "magic" ? `${r.rarity ?? ""}${r.requiresAttunement ? " · attune" : ""}` :
                  `${r.category ?? ""}${r.damageDice ? ` · ${r.damageDice} ${r.damageType}` : ""}${r.costGp ? ` · ${r.costGp}${r.costUnit}` : ""}`}
              </span></span>
              <button className="btn-ghost !py-0.5"
                onClick={() => add(r.kind === "magic"
                  ? { name: r.name, srcMagicItemId: r.id }
                  : { name: r.name, srcEquipmentId: r.id }, r.name)}>
                + Add
              </button>
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-1 border-t border-[#dfd5b8] pt-2">
          <input className="input" placeholder="Custom item (homebrew)..." maxLength={120} value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && custom.trim()) { add({ name: custom.trim() }, custom.trim()); setCustom(""); } }} />
          <button className="btn-gold" onClick={() => { if (custom.trim()) { add({ name: custom.trim() }, custom.trim()); setCustom(""); } }}>Add</button>
        </div>
        {added && <p className="mt-2 text-xs text-[#6a4f14]">Added &ldquo;{added}&rdquo;{hidden ? " (hidden)" : ""} to the party stash.</p>}
      </div>
    </div>
  );
}
