"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function DmHomeActions() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createCampaign() {
    setBusy(true); setError(null);
    const res = await fetch("/api/campaigns", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description }),
    });
    setBusy(false);
    if (!res.ok) { setError((await res.json()).error ?? "Could not create campaign"); return; }
    const { id } = await res.json();
    setOpen(false);
    router.push(`/campaigns/${id}`);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button className="btn-primary" onClick={() => { setOpen(true); setError(null); }}>+ New Campaign</button>
      {open && (
        <div className="overlay" onClick={() => setOpen(false)}>
          <div className="card modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-3 font-display text-lg text-gold">New Campaign</h3>
            <div className="space-y-3">
              <div>
                <label className="label">Name</label>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
              </div>
              <div>
                <label className="label">Description</label>
                <textarea className="input" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              {error && <p className="text-sm text-red-700">{error}</p>}
              <div className="flex justify-end gap-2">
                <button className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
                <button className="btn-primary" disabled={busy || !name} onClick={createCampaign}>Create</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
