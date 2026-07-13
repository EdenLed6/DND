"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function InventoryManager({ characterId, items, canEdit, canUse, carryCapacity }: {
  characterId: string; items: any[]; canEdit: boolean; canUse?: boolean; carryCapacity: number;
}) {
  // canEdit  → definition edits (add / remove / attune / quantity), gated by Edit mode.
  // canUse   → gameplay (equip toggle), available in Play mode. Defaults to canEdit.
  const canEquip = canUse ?? canEdit;
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);

  async function patchItem(itemId: string, body: any) {
    await fetch(`/api/characters/${characterId}/items`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemId, ...body }),
    });
    router.refresh();
  }
  async function removeItem(itemId: string) {
    await fetch(`/api/characters/${characterId}/items?itemId=${itemId}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="card">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-display text-gold">Equipment</h3>
        {canEdit && <button className="btn-ghost !py-0.5" onClick={() => setShowAdd(true)}>+ Add</button>}
      </div>
      {items.length === 0 ? <p className="text-sm text-[#6b5a42]">Empty.</p> : (
        <ul className="text-sm">
          {items.map((it) => (
            <li key={it.id} className="flex items-center justify-between gap-2 border-t border-[#e0d4b4] py-1">
              <span className="flex-1">{it.equipped ? "🛡 " : ""}{it.name}{it.quantity > 1 ? ` ×${it.quantity}` : ""}
                {it.attuned && <span className="ml-1 text-xs text-arcane">attuned</span>}</span>
              {(canEquip || canEdit) && (
                <span className="flex items-center gap-1 text-xs">
                  {canEquip && <button className={it.equipped ? "chip bg-gold text-white" : "chip"} onClick={() => patchItem(it.id, { equipped: !it.equipped })}>equip</button>}
                  {canEdit && <button className={it.attuned ? "chip bg-arcane text-white" : "chip"} onClick={() => patchItem(it.id, { attuned: !it.attuned })}>attune</button>}
                  {canEdit && <button className="chip" onClick={() => patchItem(it.id, { quantity: it.quantity + 1 })}>+</button>}
                  {canEdit && <button className="chip" onClick={() => it.quantity > 1 && patchItem(it.id, { quantity: it.quantity - 1 })}>−</button>}
                  {canEdit && <button className="chip" onClick={() => removeItem(it.id)}>🗑</button>}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2 text-xs text-[#6b5a42]">Carry capacity: {carryCapacity} lb</div>
      {showAdd && <AddItemModal characterId={characterId} onClose={() => { setShowAdd(false); router.refresh(); }} />}
    </div>
  );
}

function AddItemModal({ characterId, onClose }: { characterId: string; onClose: () => void }) {
  const [type, setType] = useState<"equipment" | "magic">("equipment");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [custom, setCustom] = useState("");

  async function search() {
    const r = await fetch(`/api/srd/items?type=${type}&q=${encodeURIComponent(q)}`);
    setRows(await r.json());
  }
  useEffect(() => { search(); /* eslint-disable-next-line */ }, [type]);

  async function add(item: any) {
    await fetch(`/api/characters/${characterId}/items`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item.kind === "magic"
        ? { name: item.name, srcMagicItemId: item.id }
        : { name: item.name, srcEquipmentId: item.id }),
    });
  }
  async function addCustom() {
    if (!custom) return;
    await fetch(`/api/characters/${characterId}/items`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: custom }),
    });
    setCustom("");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="card w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-lg text-gold">Add Item</h3>
          <button className="btn-ghost !py-0.5" onClick={onClose}>Close</button>
        </div>
        <div className="mb-2 flex gap-2">
          <button className={type === "equipment" ? "btn-gold" : "btn-ghost"} onClick={() => setType("equipment")}>Equipment</button>
          <button className={type === "magic" ? "btn-gold" : "btn-ghost"} onClick={() => setType("magic")}>Magic Items</button>
        </div>
        <div className="mb-2 flex gap-1">
          <input className="input" placeholder="Search..." value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} />
          <button className="btn-ghost" onClick={search}>Search</button>
        </div>
        <div className="max-h-64 space-y-1 overflow-y-auto text-sm">
          {rows.map((r) => (
            <div key={`${r.kind}-${r.id}`} className="flex items-center justify-between border-b border-[#e0d4b4] py-1">
              <span>{r.name} <span className="text-xs text-[#6b5a42]">
                {r.kind === "magic" ? `${r.rarity ?? ""}${r.requiresAttunement ? " · attune" : ""}` :
                  `${r.category ?? ""}${r.damageDice ? ` · ${r.damageDice} ${r.damageType}` : ""}${r.costGp ? ` · ${r.costGp}${r.costUnit}` : ""}`}
              </span></span>
              <button className="btn-ghost !py-0.5" onClick={() => add(r)}>+ Add</button>
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-1 border-t border-[#e0d4b4] pt-2">
          <input className="input" placeholder="Custom item (homebrew)..." value={custom} onChange={(e) => setCustom(e.target.value)} />
          <button className="btn-gold" onClick={addCustom}>Add</button>
        </div>
      </div>
    </div>
  );
}
