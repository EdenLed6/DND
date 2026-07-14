"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const LOCATIONS = [
  { key: "equipped", label: "Equipped", icon: "⚔" },
  { key: "backpack", label: "Backpack", icon: "🎒" },
  { key: "pocket", label: "Pockets", icon: "👝" },
  { key: "storage", label: "Storage", icon: "📦" },
] as const;
type LocationKey = (typeof LOCATIONS)[number]["key"];
const MAX_ATTUNED = 3;

function locationOf(it: any): LocationKey {
  if (it.location === "equipped" || it.equipped) return "equipped";
  return (["backpack", "pocket", "storage"].includes(it.location) ? it.location : "backpack") as LocationKey;
}
function effectsOf(it: any): any {
  if (!it.customJson) return {};
  try { return JSON.parse(it.customJson) ?? {}; } catch { return {}; }
}
function needsAttunement(it: any): boolean {
  const fx = effectsOf(it);
  return it.srcMagicItemId != null || fx.attunement === true || fx.requiresAttunement === true;
}
/** An item affects AC (armor sets base, shield/ring grants a bonus). */
function affectsAc(it: any): boolean {
  const fx = effectsOf(it);
  return typeof fx.acBase === "number" || (typeof fx.acBonus === "number" && fx.acBonus !== 0);
}
function effectChips(it: any): string[] {
  const fx = effectsOf(it);
  const chips: string[] = [];
  if (typeof fx.acBonus === "number" && fx.acBonus !== 0) chips.push(`AC ${fx.acBonus > 0 ? "+" : ""}${fx.acBonus}`);
  if (typeof fx.acBase === "number") chips.push(`AC base ${fx.acBase}${fx.addDex ? ` + DEX${(fx.acMaxBonus ?? fx.maxDex) != null ? ` (max ${fx.acMaxBonus ?? fx.maxDex})` : ""}` : ""}`);
  if (fx.damage) chips.push(String(fx.damage));
  const w = typeof fx.weightLb === "number" ? fx.weightLb : (typeof fx.weight === "number" ? fx.weight : null);
  if (w != null && w > 0) chips.push(`${w} lb`);
  return chips;
}

export function InventoryManager({ characterId, items, canEdit, canUse, carryCapacity }: {
  characterId: string; items: any[]; canEdit: boolean; canUse?: boolean; carryCapacity: number;
}) {
  // canEdit  → definition edits (add / remove / attune / quantity), gated by Edit mode.
  // canUse   → gameplay (equip / move between locations), available in Play mode. Defaults to canEdit.
  const canEquip = canUse ?? canEdit;
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const attunedCount = items.filter((i) => i.attuned).length;

  async function patchItem(itemId: string, body: any) {
    setErr(null);
    const r = await fetch(`/api/characters/${characterId}/items`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemId, ...body }),
    });
    if (!r.ok) setErr((await r.json().catch(() => null))?.error ?? "Update failed");
    router.refresh();
  }
  async function removeItem(itemId: string, name: string) {
    if (!confirm(`Delete item "${name}"?`)) return;
    await fetch(`/api/characters/${characterId}/items?itemId=${itemId}`, { method: "DELETE" });
    router.refresh();
  }

  const grouped = LOCATIONS.map((loc) => ({ ...loc, items: items.filter((i) => locationOf(i) === loc.key) }));

  return (
    <div className="card">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-display text-gold">Equipment</h3>
        <div className="flex items-center gap-2">
          <span className={`text-xs ${attunedCount >= MAX_ATTUNED ? "text-blood" : "text-[#5e5448]"}`}>
            Attuned {attunedCount}/{MAX_ATTUNED}
          </span>
          {canEdit && <button className="btn-ghost !py-0.5" onClick={() => setShowAdd(true)}>+ Add</button>}
        </div>
      </div>
      {err && <div className="mb-2 rounded border border-blood/40 bg-blood/10 px-2 py-1 text-xs text-blood">{err}</div>}
      {items.length === 0 ? (
        <div className="panel-inset p-4 text-center">
          <p className="text-sm text-[#5e5448]">No equipment yet — every adventurer needs some gear.</p>
          {canEdit && (
            <button className="btn-ghost mt-2 text-sm" onClick={() => setShowAdd(true)}>Add your first item</button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {grouped.map((loc) => (loc.items.length === 0 && loc.key !== "backpack") ? null : (
            <div key={loc.key}>
              <div className="flex items-baseline justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-[#857866]">{loc.icon} {loc.label}</h4>
                {loc.key === "storage" && <span className="text-[10px] text-[#857866]">not carried — excluded from weight</span>}
              </div>
              {loc.items.length === 0 ? (
                <p className="border-t border-[#dfd5b8] py-1 text-xs italic text-[#857866]">Empty</p>
              ) : (
                <ul className="text-sm">
                  {loc.items.map((it) => (
                    <li key={it.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-[#dfd5b8] py-1">
                      <span className="flex-1">
                        {it.name}{it.quantity > 1 ? ` ×${it.quantity}` : ""}
                        {effectChips(it).map((c) => <span key={c} className="ml-1 text-xs text-[#857866]">· {c}</span>)}
                        {it.attuned && <span className="ml-1 text-xs text-arcane">attuned</span>}
                      </span>
                      {(canEquip || canEdit) && (
                        <span className="flex items-center gap-1 text-xs">
                          {canEquip && (
                            <button
                              className={loc.key === "equipped" ? "chip bg-gold text-white" : "chip"}
                              title={affectsAc(it) ? "Equipping updates your AC" : "Equip / unequip"}
                              onClick={() => patchItem(it.id, { equipped: loc.key !== "equipped" })}
                            >{loc.key === "equipped" ? "unequip" : "equip"}</button>
                          )}
                          {canEquip && (
                            <select
                              className="input !w-auto !px-1 !py-0 text-xs"
                              value={loc.key}
                              onChange={(e) => patchItem(it.id, { location: e.target.value })}
                              title="Move to..."
                            >
                              {LOCATIONS.map((l) => <option key={l.key} value={l.key}>{l.icon} {l.label}</option>)}
                            </select>
                          )}
                          {canEdit && needsAttunement(it) && (
                            <button
                              className={it.attuned ? "chip bg-arcane text-white" : "chip"}
                              disabled={!it.attuned && attunedCount >= MAX_ATTUNED}
                              title={!it.attuned && attunedCount >= MAX_ATTUNED ? `Attunement limit reached (${MAX_ATTUNED})` : undefined}
                              onClick={() => patchItem(it.id, { attuned: !it.attuned })}
                            >attune</button>
                          )}
                          {canEdit && <button className="chip" onClick={() => patchItem(it.id, { quantity: it.quantity + 1 })}>+</button>}
                          {canEdit && <button className="chip" onClick={() => it.quantity > 1 && patchItem(it.id, { quantity: it.quantity - 1 })}>−</button>}
                          {canEdit && <button className="chip" onClick={() => removeItem(it.id, it.name)}>🗑</button>}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
      <div className="mt-2 text-xs text-[#5e5448]">Carry capacity: {carryCapacity} lb (storage not counted)</div>
      {showAdd && <AddItemModal characterId={characterId} onClose={() => { setShowAdd(false); router.refresh(); }} />}
    </div>
  );
}

function AddItemModal({ characterId, onClose }: { characterId: string; onClose: () => void }) {
  const [type, setType] = useState<"equipment" | "magic" | "homebrew" | "custom">("equipment");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [homebrew, setHomebrew] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);

  async function search() {
    if (type === "custom") return;
    if (type === "homebrew") {
      const r = await fetch(`/api/characters/${characterId}/items`);
      const data = await r.json().catch(() => ({ homebrew: [] }));
      setHomebrew(Array.isArray(data.homebrew) ? data.homebrew : []);
      return;
    }
    const r = await fetch(`/api/srd/items?type=${type}&q=${encodeURIComponent(q)}`);
    setRows(await r.json());
  }
  useEffect(() => { search(); /* eslint-disable-next-line */ }, [type]);

  async function post(body: any, label: string) {
    setErr(null); setAdded(null);
    const r = await fetch(`/api/characters/${characterId}/items`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    if (!r.ok) { setErr((await r.json().catch(() => null))?.error ?? "Failed to add item"); return false; }
    setAdded(label);
    return true;
  }
  function add(item: any, buy: boolean) {
    const body =
      item.kind === "magic" ? { name: item.name, srcMagicItemId: item.id } :
      item.kind === "homebrew" ? { homebrewItemId: item.id, buy } :
      { name: item.name, srcEquipmentId: item.id, buy };
    post(body, `${buy ? "Bought" : "Added"} ${item.name}`);
  }

  const shownHomebrew = homebrew.filter((h) => !q || h.name.toLowerCase().includes(q.toLowerCase()));
  const priceLabel = (r: any) =>
    r.kind === "homebrew" ? (r.costGp != null ? `${r.costGp} gp` : null) :
    r.costGp != null ? `${r.costGp} ${r.costUnit ?? "gp"}` : null;
  /** Note surfaced for AC-granting gear, e.g. "Equipping grants +2 AC". */
  const acHint = (r: any): string | null => {
    const isShield = /shield/i.test(r.name ?? "") || /shield/i.test(r.armorCategory ?? r.category ?? "");
    if (isShield && typeof r.acBase === "number") return `Equipping grants +${r.acBase} AC`;
    if (typeof r.acBonus === "number" && r.acBonus !== 0) return `Equipping grants ${r.acBonus > 0 ? "+" : ""}${r.acBonus} AC`;
    if (typeof r.acBase === "number") return `Equipping sets AC to ${r.acBase}${r.armorCategory && !/heavy/i.test(r.armorCategory) ? " + DEX" : ""}`;
    return null;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="card w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-lg text-gold">Add Item</h3>
          <button className="btn-ghost !py-0.5" onClick={onClose}>Close</button>
        </div>
        <div className="mb-2 flex flex-wrap gap-2">
          <button className={type === "equipment" ? "btn-gold" : "btn-ghost"} onClick={() => setType("equipment")}>Equipment</button>
          <button className={type === "magic" ? "btn-gold" : "btn-ghost"} onClick={() => setType("magic")}>Magic Items</button>
          <button className={type === "homebrew" ? "btn-gold" : "btn-ghost"} onClick={() => setType("homebrew")}>Homebrew</button>
          <button className={type === "custom" ? "btn-gold" : "btn-ghost"} onClick={() => setType("custom")}>Custom</button>
        </div>
        {err && <div className="mb-2 rounded border border-blood/40 bg-blood/10 px-2 py-1 text-xs text-blood">{err}</div>}
        {added && <div className="mb-2 rounded border border-gold/40 bg-gold/10 px-2 py-1 text-xs text-[#5e5448]">{added}</div>}
        {type === "custom" ? (
          <CustomItemForm onSubmit={(body) => post(body, `Added ${body.name}`)} />
        ) : (
          <>
            <div className="mb-2 flex gap-1">
              <input className="input" placeholder="Search..." value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} />
              <button className="btn-ghost" onClick={search}>Search</button>
            </div>
            <div className="max-h-64 space-y-1 overflow-y-auto text-sm">
              {(type === "homebrew" ? shownHomebrew : rows).map((r) => (
                <div key={`${r.kind}-${r.id}`} className="flex items-center justify-between gap-2 border-b border-[#dfd5b8] py-1">
                  <span className="flex-1">{r.name} <span className="text-xs text-[#5e5448]">
                    {r.kind === "magic" ? `${r.rarity ?? ""}${r.requiresAttunement ? " · attune" : ""}` :
                      `${r.category ?? ""}${r.damageDice || r.damage ? ` · ${r.damageDice ?? r.damage}${r.damageType ? ` ${r.damageType}` : ""}` : ""}${r.acBonus ? ` · AC +${r.acBonus}` : ""}${priceLabel(r) ? ` · ${priceLabel(r)}` : ""}`}
                  </span>
                    {acHint(r) && <span className="block text-[11px] text-arcane">{acHint(r)}</span>}
                  </span>
                  <span className="flex shrink-0 gap-1">
                    {r.kind !== "magic" && priceLabel(r) && (
                      <button className="btn-gold !px-2 !py-0.5 text-xs" onClick={() => add(r, true)}>Buy {priceLabel(r)}</button>
                    )}
                    <button className="btn-ghost !px-2 !py-0.5 text-xs" onClick={() => add(r, false)}>{priceLabel(r) ? "Add free" : "+ Add"}</button>
                  </span>
                </div>
              ))}
              {type === "homebrew" && shownHomebrew.length === 0 && (
                <p className="py-2 text-center text-xs text-[#857866]">No homebrew items in this campaign yet.</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function CustomItemForm({ onSubmit }: { onSubmit: (body: any) => Promise<boolean> | boolean }) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [costGp, setCostGp] = useState("");
  const [weight, setWeight] = useState("");
  const [damage, setDamage] = useState("");
  const [acBonus, setAcBonus] = useState("");
  const [acBase, setAcBase] = useState("");
  const [addDex, setAddDex] = useState(false);
  const [maxDex, setMaxDex] = useState("");
  const [attunement, setAttunement] = useState(false);
  const [notes, setNotes] = useState("");

  async function submit() {
    if (!name.trim()) return;
    const custom: any = {};
    if (category.trim()) custom.category = category.trim();
    if (costGp !== "" && !isNaN(+costGp)) custom.costGp = Math.max(0, +costGp);
    if (weight !== "" && !isNaN(+weight)) custom.weight = Math.max(0, +weight);
    if (damage.trim()) custom.damage = damage.trim();
    if (acBonus !== "" && !isNaN(+acBonus)) custom.acBonus = Math.max(-5, Math.min(10, Math.round(+acBonus)));
    if (acBase !== "" && !isNaN(+acBase)) {
      custom.acBase = Math.max(5, Math.min(25, Math.round(+acBase)));
      custom.addDex = addDex;
      if (addDex && maxDex !== "" && !isNaN(+maxDex)) custom.maxDex = Math.max(0, Math.min(10, Math.round(+maxDex)));
    }
    if (attunement) custom.attunement = true;
    if (notes.trim()) custom.notes = notes.trim();
    const ok = await onSubmit({ name: name.trim(), custom });
    if (ok) { setName(""); setDamage(""); setAcBonus(""); setAcBase(""); setNotes(""); }
  }

  return (
    <div className="space-y-2 text-sm">
      <div className="flex gap-2">
        <div className="flex-1"><label className="label">Name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Cloak of Protection" /></div>
        <div className="w-28"><label className="label">Category</label>
          <input className="input" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Armor, Shield…" /></div>
      </div>
      <div className="flex gap-2">
        <div className="flex-1"><label className="label">Cost (gp)</label>
          <input className="input" type="number" min={0} value={costGp} onChange={(e) => setCostGp(e.target.value)} /></div>
        <div className="flex-1"><label className="label">Weight (lb)</label>
          <input className="input" type="number" min={0} value={weight} onChange={(e) => setWeight(e.target.value)} /></div>
        <div className="flex-1"><label className="label">Damage</label>
          <input className="input" value={damage} onChange={(e) => setDamage(e.target.value)} placeholder="1d8" /></div>
      </div>
      <div className="flex items-end gap-2">
        <div className="w-24"><label className="label">AC bonus</label>
          <input className="input" type="number" min={-5} max={10} value={acBonus} onChange={(e) => setAcBonus(e.target.value)} placeholder="+1" /></div>
        <div className="w-24"><label className="label">AC base</label>
          <input className="input" type="number" min={5} max={25} value={acBase} onChange={(e) => setAcBase(e.target.value)} placeholder="14" /></div>
        <label className="flex items-center gap-1 pb-2 text-xs"><input type="checkbox" checked={addDex} onChange={(e) => setAddDex(e.target.checked)} /> + DEX</label>
        {addDex && <div className="w-20"><label className="label">Max DEX</label>
          <input className="input" type="number" min={0} max={10} value={maxDex} onChange={(e) => setMaxDex(e.target.value)} placeholder="2" /></div>}
        <label className="flex items-center gap-1 pb-2 text-xs"><input type="checkbox" checked={attunement} onChange={(e) => setAttunement(e.target.checked)} /> Requires attunement</label>
      </div>
      <div><label className="label">Notes</label>
        <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional description" /></div>
      <div className="flex justify-end"><button className="btn-gold" onClick={submit} disabled={!name.trim()}>Create & Add</button></div>
    </div>
  );
}
