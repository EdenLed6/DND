"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fromCopper } from "@/lib/dnd/rules";
import { useRealtime } from "@/lib/realtime/useRealtime";

type Party = {
  id: string; name: string; owner: string; ownerId: string; race: string; classes: string;
  level: number; xp: number; levelByXp: number; canLevelUp: boolean;
  hp: number; maxHp: number; ac: number; pp: number; gold: number; conditions: string[];
};

export function CampaignView({ campaign, members, party, loot, encounters, maps, isDM, me }: {
  campaign: any; members: any[]; party: Party[]; loot: any[]; encounters: any[]; maps: any[];
  isDM: boolean; me: { id: string; name: string };
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"party" | "progress" | "loot" | "rest" | "play">("party");
  const [sel, setSel] = useState<string[]>([]);
  const [xpAmt, setXpAmt] = useState("");
  const [goldGp, setGoldGp] = useState("");
  const [lootName, setLootName] = useState("");
  const [busy, setBusy] = useState(false);

  useRealtime({
    "character:updated": () => router.refresh(),
    "xp:awarded": () => router.refresh(),
    "character:created": () => router.refresh(),
    "character:deleted": () => router.refresh(),
    "gold:changed": () => router.refresh(),
    "loot:added": () => router.refresh(),
    "loot:assigned": () => router.refresh(),
    "loot:removed": () => router.refresh(),
    "rest:applied": () => router.refresh(),
    "member:joined": () => router.refresh(),
    "encounter:started": () => router.refresh(),
  }, [campaign.id]);

  const targetIds = sel.length ? sel : party.map((p) => p.id);
  const partyGold = fromCopper(campaign.partyGoldCp);

  async function post(url: string, body: any, method = "POST") {
    setBusy(true);
    await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setBusy(false); router.refresh();
  }

  const TABS: [typeof tab, string][] = [
    ["party", "🎭 קבוצה"], ["progress", "⬆ התקדמות"], ["loot", "💰 שלל וזהב"], ["rest", "🛏 מנוחה"], ["play", "⚔ קרבות ומפות"],
  ];

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-4">
      <div className="card flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-gold">{campaign.name}</h1>
          <div className="text-sm text-[#a9977c]">{campaign.description || "—"} · DM: {campaign.dmName}</div>
        </div>
        <div className="text-right text-sm">
          <div>קוד הזמנה: <code className="text-gold">{campaign.inviteCode}</code></div>
          <div className="text-[#a9977c]">{members.length} חברים · {party.length} דמויות</div>
          {isDM ? <span className="chip mt-1">👑 DM</span> : <span className="chip mt-1">שחקן</span>}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.filter(([t]) => isDM || t !== "progress").map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)} className={tab === t ? "btn-gold" : "btn-ghost"}>{label}</button>
        ))}
      </div>

      {/* PARTY */}
      {tab === "party" && (
        <div className="card overflow-x-auto">
          <table className="sheet min-w-[720px]">
            <thead><tr>
              {isDM && <th></th>}
              <th>דמות</th><th>שחקן</th><th>מקצוע</th><th>רמה</th><th>HP</th><th>AC</th><th>PP</th><th>זהב</th><th>מצבים</th>{isDM && <th>DM</th>}
            </tr></thead>
            <tbody>
              {party.map((p) => (
                <tr key={p.id}>
                  {isDM && <td><input type="checkbox" checked={sel.includes(p.id)} onChange={(e) => setSel((s) => e.target.checked ? [...s, p.id] : s.filter((x) => x !== p.id))} /></td>}
                  <td><Link href={`/characters/${p.id}`} className="text-gold hover:underline">{p.name}</Link></td>
                  <td className="text-[#a9977c]">{p.owner}</td>
                  <td>{p.race} · {p.classes}</td>
                  <td>{p.level}{p.canLevelUp && <span className="ml-1 text-green-400" title="level-up available">⬆</span>}</td>
                  <td className={p.hp === 0 ? "text-red-400" : ""}>{p.hp}/{p.maxHp}</td>
                  <td>{p.ac}</td><td>{p.pp}</td>
                  <td>{fromCopper(p.gold).gp}g</td>
                  <td className="text-xs">{p.conditions.join(", ") || "—"}</td>
                  {isDM && <td>
                    <div className="flex gap-1">
                      <button className="btn-ghost !px-2 !py-0.5" title="Level up" onClick={() => post(`/api/characters/${p.id}/level`, { delta: 1 })}>+L</button>
                      <button className="btn-ghost !px-2 !py-0.5" title="Level down" onClick={() => post(`/api/characters/${p.id}/level`, { delta: -1 })}>−L</button>
                    </div>
                  </td>}
                </tr>
              ))}
              {party.length === 0 && <tr><td colSpan={11} className="text-center text-[#a9977c]">אין דמויות. שחקנים מצטרפים עם קוד ההזמנה ויוצרים דמות.</td></tr>}
            </tbody>
          </table>
          <div className="mt-3">
            <Link href={`/characters/new?campaign=${campaign.id}`} className="btn-gold">🎭 צור דמות בקמפיין</Link>
          </div>
        </div>
      )}

      {/* PROGRESSION (DM) */}
      {tab === "progress" && isDM && (
        <div className="card space-y-3">
          <h3 className="font-display text-gold">ניהול XP ורמות</h3>
          <p className="text-sm text-[#a9977c]">{sel.length ? `${sel.length} דמויות נבחרו` : "כל הקבוצה"} (בחר בטאב הקבוצה כדי למקד)</p>
          <div className="flex flex-wrap gap-2">
            <input className="input max-w-[140px]" placeholder="כמות XP" value={xpAmt} onChange={(e) => setXpAmt(e.target.value)} inputMode="numeric" />
            <button className="btn-primary" disabled={busy} onClick={() => post(`/api/campaigns/${campaign.id}/xp`, { amount: parseInt(xpAmt) || 0, characterIds: sel.length ? sel : undefined })}>הענק XP</button>
            {[100, 500, 1000].map((v) => (
              <button key={v} className="btn-ghost" onClick={() => post(`/api/campaigns/${campaign.id}/xp`, { amount: v, characterIds: sel.length ? sel : undefined })}>+{v}</button>
            ))}
          </div>
          <div className="text-sm text-[#a9977c]">עליית רמה: השתמש בכפתורי +L/−L בטאב הקבוצה, או הענק XP וסמן ⬆.</div>
        </div>
      )}

      {/* LOOT & GOLD */}
      {tab === "loot" && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="card space-y-3">
            <h3 className="font-display text-gold">זהב קבוצתי</h3>
            <div className="font-display text-2xl text-gold">{partyGold.pp}pp {partyGold.gp}gp {partyGold.sp}sp {partyGold.cp}cp</div>
            {isDM && (
              <div className="flex flex-wrap gap-2">
                <input className="input max-w-[120px]" placeholder="gp" value={goldGp} onChange={(e) => setGoldGp(e.target.value)} inputMode="numeric" />
                <button className="btn-gold" onClick={() => post(`/api/campaigns/${campaign.id}/gold`, { target: "party", deltaCp: (parseInt(goldGp) || 0) * 100 })}>+ הוסף</button>
                <button className="btn-ghost" onClick={() => post(`/api/campaigns/${campaign.id}/gold`, { target: "party", deltaCp: -(parseInt(goldGp) || 0) * 100 })}>− הורד</button>
              </div>
            )}
            {isDM && party.length > 0 && (
              <div className="border-t border-[#241d17] pt-2 text-sm">
                <div className="mb-1 text-[#a9977c]">חלק לשחקן (מהקופה):</div>
                {party.map((p) => (
                  <div key={p.id} className="flex items-center justify-between py-0.5">
                    <span>{p.name}</span>
                    <button className="btn-ghost !py-0.5" onClick={() => post(`/api/campaigns/${campaign.id}/gold`, { target: "character", characterId: p.id, deltaCp: (parseInt(goldGp) || 0) * 100, fromParty: true })}>תן {goldGp || 0}g</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card space-y-3">
            <h3 className="font-display text-gold">שלל הקבוצה</h3>
            {isDM && (
              <div className="flex gap-2">
                <input className="input" placeholder="שם פריט" value={lootName} onChange={(e) => setLootName(e.target.value)} />
                <button className="btn-gold" disabled={!lootName} onClick={() => { post(`/api/campaigns/${campaign.id}/loot`, { name: lootName }); setLootName(""); }}>הוסף</button>
              </div>
            )}
            {loot.length === 0 ? <p className="text-sm text-[#a9977c]">אין שלל.</p> : (
              <ul className="space-y-1 text-sm">
                {loot.map((l) => (
                  <li key={l.id} className="flex items-center justify-between border-t border-[#241d17] py-1">
                    <span>{l.name} {l.quantity > 1 ? `×${l.quantity}` : ""}</span>
                    {isDM && (
                      <div className="flex items-center gap-1">
                        <select className="input !py-0.5 !w-auto" defaultValue="" onChange={(e) => e.target.value && post(`/api/campaigns/${campaign.id}/loot`, { lootId: l.id, characterId: e.target.value }, "PATCH")}>
                          <option value="">הקצה ל...</option>
                          {party.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                        <button className="btn-ghost !px-2 !py-0.5" onClick={() => post(`/api/campaigns/${campaign.id}/loot?lootId=${l.id}`, {}, "DELETE")}>🗑</button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* REST (DM) */}
      {tab === "rest" && (
        <div className="card space-y-3">
          <h3 className="font-display text-gold">מנוחה וחידוש</h3>
          {isDM ? (
            <>
              <p className="text-sm text-[#a9977c]">{sel.length ? `${sel.length} נבחרו` : "כל הקבוצה"}</p>
              <div className="flex gap-2">
                <button className="btn-ghost" disabled={busy} onClick={() => post(`/api/campaigns/${campaign.id}/rest`, { type: "SHORT", characterIds: sel.length ? sel : undefined })}>☕ מנוחה קצרה</button>
                <button className="btn-primary" disabled={busy} onClick={() => post(`/api/campaigns/${campaign.id}/rest`, { type: "LONG", characterIds: sel.length ? sel : undefined })}>🌙 מנוחה ארוכה</button>
              </div>
              <p className="text-xs text-[#a9977c]">מנוחה ארוכה: HP מלא, החזרת קוביות פגיעה, כל משבצות הקסם, איפוס משאבים, exhaustion −1. קצרה: Pact slots + משאבי short-rest.</p>
            </>
          ) : <p className="text-sm text-[#a9977c]">רק ה-DM מפעיל מנוחה קבוצתית.</p>}
        </div>
      )}

      {/* PLAY */}
      {tab === "play" && (
        <PlayTab campaign={campaign} encounters={encounters} maps={maps} isDM={isDM} onChange={() => router.refresh()} />
      )}
    </main>
  );
}

function PlayTab({ campaign, encounters, maps, isDM, onChange }: any) {
  const router = useRouter();
  const [name, setName] = useState("");
  async function createEncounter() {
    const res = await fetch(`/api/campaigns/${campaign.id}/encounters`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name || "Encounter" }),
    });
    const enc = await res.json();
    router.push(`/play/${enc.id}`);
  }
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="card space-y-2">
        <h3 className="font-display text-gold">קרבות (Encounters)</h3>
        {encounters.length === 0 ? <p className="text-sm text-[#a9977c]">אין קרבות עדיין.</p> : (
          <ul className="space-y-1 text-sm">
            {encounters.map((e: any) => (
              <li key={e.id} className="flex justify-between border-t border-[#241d17] py-1">
                <Link href={`/play/${e.id}`} className="text-gold hover:underline">{e.name}</Link>
                <span className="chip">{e.status}</span>
              </li>
            ))}
          </ul>
        )}
        {isDM && (
          <div className="flex gap-2 pt-2">
            <input className="input" placeholder="שם הקרב" value={name} onChange={(e) => setName(e.target.value)} />
            <button className="btn-primary" onClick={createEncounter}>⚔ קרב חדש</button>
          </div>
        )}
      </div>
      <div className="card space-y-2">
        <h3 className="font-display text-gold">מפות</h3>
        {maps.length === 0 ? <p className="text-sm text-[#a9977c]">אין מפות. הוסף בעת בניית קרב.</p> : (
          <ul className="text-sm">{maps.map((m: any) => <li key={m.id} className="border-t border-[#241d17] py-1">{m.name}</li>)}</ul>
        )}
        {isDM && <Link href={`/campaigns/${campaign.id}/maps`} className="btn-ghost">🗺 ניהול מפות</Link>}
      </div>
    </div>
  );
}
