"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export function DashboardActions() {
  const router = useRouter();
  const [modal, setModal] = useState<null | "campaign" | "join">(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function createCampaign() {
    setBusy(true); setError(null);
    const res = await fetch("/api/campaigns", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description }),
    });
    setBusy(false);
    if (!res.ok) { setError((await res.json()).error ?? "שגיאה"); return; }
    const c = await res.json();
    router.push(`/campaigns/${c.id}`);
  }

  async function joinCampaign() {
    setBusy(true); setError(null);
    const res = await fetch("/api/campaigns/join", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: code.trim() }),
    });
    setBusy(false);
    if (!res.ok) { setError((await res.json()).error ?? "קוד לא תקין"); return; }
    const c = await res.json();
    router.push(`/campaigns/${c.id}`);
  }

  return (
    <div className="flex flex-wrap gap-3">
      <button className="btn-primary" onClick={() => { setModal("campaign"); setError(null); }}>➕ קמפיין חדש</button>
      <button className="btn-ghost" onClick={() => { setModal("join"); setError(null); }}>🔑 הצטרף לקמפיין</button>
      <Link href="/characters/new" className="btn-gold">🎭 דמות חדשה</Link>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setModal(null)}>
          <div className="card w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            {modal === "campaign" ? (
              <>
                <h3 className="mb-3 font-display text-lg text-gold">קמפיין חדש</h3>
                <label className="label">שם הקמפיין</label>
                <input className="input mb-3" value={name} onChange={(e) => setName(e.target.value)} />
                <label className="label">תיאור (אופציונלי)</label>
                <textarea className="input mb-3" value={description} onChange={(e) => setDescription(e.target.value)} />
                {error && <p className="mb-2 text-sm text-red-400">{error}</p>}
                <div className="flex justify-end gap-2">
                  <button className="btn-ghost" onClick={() => setModal(null)}>ביטול</button>
                  <button className="btn-primary" disabled={busy || !name} onClick={createCampaign}>צור</button>
                </div>
              </>
            ) : (
              <>
                <h3 className="mb-3 font-display text-lg text-gold">הצטרפות לקמפיין</h3>
                <label className="label">קוד הזמנה</label>
                <input className="input mb-3" value={code} onChange={(e) => setCode(e.target.value)} placeholder="ABCD12" />
                {error && <p className="mb-2 text-sm text-red-400">{error}</p>}
                <div className="flex justify-end gap-2">
                  <button className="btn-ghost" onClick={() => setModal(null)}>ביטול</button>
                  <button className="btn-primary" disabled={busy || !code} onClick={joinCampaign}>הצטרף</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
