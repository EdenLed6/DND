"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fromCopper } from "@/lib/dnd/rules";
import { computeEncounterDifficulty } from "@/lib/dnd/encounter-math";
import { useRealtime } from "@/lib/realtime/useRealtime";
import { SessionsTab } from "./SessionsTab";
import { WorldTab } from "./WorldTab";
import { DmNotesTab } from "./DmNotesTab";
import { PartyLootTab } from "./PartyLootTab";
import { ClassCrest } from "@/components/ClassEmblem";

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
  const [tab, setTab] = useState<"party" | "progress" | "sessions" | "world" | "loot" | "notes" | "rest" | "play">("party");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [invitesOpen, setInvitesOpen] = useState(false);
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
    ["party", "🎭 Party"], ["progress", "⬆ Progression"], ["sessions", "📜 Sessions"], ["world", "🗺 World"],
    ["loot", "💰 Loot & Gold"], ["notes", "🕮 Notes"], ["rest", "🛏 Rest"], ["play", "⚔ Combat & Maps"],
  ];

  const myCharacters = party.filter((p) => p.ownerId === me.id).map((p) => ({ id: p.id, name: p.name }));

  return (
    <main className="mx-auto max-w-6xl space-y-4 p-4">
      <div className="card flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-gold">{campaign.name}</h1>
          <div className="text-sm text-[#5e5448]">{campaign.description || "—"} · DM: {campaign.dmName}</div>
        </div>
        <div className="text-right text-sm">
          {isDM && <div>Invite Code: <code className="text-gold">{campaign.inviteCode}</code></div>}
          <div className="text-[#5e5448]">{members.length} members · {party.length} characters</div>
          <div className="mt-1 flex items-center justify-end gap-2">
            {isDM ? <span className="chip">👑 DM</span> : <span className="chip">Player</span>}
            {isDM && <button className="btn-ghost !px-2 !py-0.5" title="Invite players by email" onClick={() => setInvitesOpen(true)}>✉ Invites</button>}
            {isDM && <button className="btn-ghost !px-2 !py-0.5" title="Campaign Settings" onClick={() => setSettingsOpen(true)}>⚙ Settings</button>}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.filter(([t]) => isDM || t !== "progress").map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)} className={tab === t ? "btn-gold" : "btn-ghost"}>{label}</button>
        ))}
      </div>

      {/* PARTY */}
      {tab === "party" && (
        <div className="card">
          {party.length === 0 && <p className="muted text-center text-sm">No characters yet. Players join with the invite code and create a character.</p>}

          {/* Quick access to the current user's own characters, linked to their sheets. */}
          {myCharacters.length > 0 && (
            <div className="panel-inset mb-3 p-3">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#6a4f14]">My Characters</div>
              <div className="flex flex-wrap gap-1.5">
                {myCharacters.map((c) => (
                  <Link key={c.id} href={`/characters/${c.id}`} className="chip chip-gold cursor-pointer" title="Open character sheet">
                    {c.name}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Mobile: cards */}
          <div className="space-y-2 sm:hidden">
            {party.map((p) => (
              <div key={p.id} className="panel-inset p-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-2">
                    <ClassCrest name={p.classes.split(" ")[0]} size={36} cssClass="mt-0.5 shrink-0" />
                    <div>
                      <Link href={`/characters/${p.id}`} className="link-gold font-display text-base">{p.name}</Link>
                      <div className="muted text-xs">{p.owner} · {p.race} · {p.classes}</div>
                    </div>
                  </div>
                  {isDM && <input type="checkbox" className="mt-1 h-5 w-5" checked={sel.includes(p.id)} onChange={(e) => setSel((s) => e.target.checked ? [...s, p.id] : s.filter((x) => x !== p.id))} />}
                </div>
                <div className="mt-2 flex flex-wrap gap-1 text-xs">
                  <span className="chip">Lvl {p.level}{p.canLevelUp && " ⬆"}</span>
                  <span className={`chip ${p.hp === 0 ? "text-red-700" : ""}`}>HP {p.hp}/{p.maxHp}</span>
                  <span className="chip">AC {p.ac}</span>
                  <span className="chip">PP {p.pp}</span>
                  <span className="chip">{fromCopper(p.gold).gp}g</span>
                  {p.conditions.length > 0 && <span className="chip text-[#b98338]">{p.conditions.join(", ")}</span>}
                </div>
                {isDM && (
                  <div className="mt-2 flex gap-2">
                    <button className="btn-ghost flex-1 !py-1" onClick={() => post(`/api/characters/${p.id}/level`, { delta: 1 })}>+ Level</button>
                    <button className="btn-ghost flex-1 !py-1" onClick={() => post(`/api/characters/${p.id}/level`, { delta: -1 })}>− Level</button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Desktop: table */}
          <div className="hidden scroll-x sm:block">
            <table className="sheet min-w-[720px]">
              <thead><tr>
                {isDM && <th></th>}
                <th>Character</th><th>Player</th><th>Class</th><th>Level</th><th>HP</th><th>AC</th><th>PP</th><th>Gold</th><th>Conditions</th>{isDM && <th>DM</th>}
              </tr></thead>
              <tbody>
                {party.map((p) => (
                  <tr key={p.id}>
                    {isDM && <td><input type="checkbox" checked={sel.includes(p.id)} onChange={(e) => setSel((s) => e.target.checked ? [...s, p.id] : s.filter((x) => x !== p.id))} /></td>}
                    <td><span className="flex items-center gap-2"><ClassCrest name={p.classes.split(" ")[0]} size={26} cssClass="shrink-0" /><Link href={`/characters/${p.id}`} className="text-gold hover:underline">{p.name}</Link></span></td>
                    <td className="text-[#5e5448]">{p.owner}</td>
                    <td>{p.race} · {p.classes}</td>
                    <td>{p.level}{p.canLevelUp && <span className="ml-1 text-green-700" title="level-up available">⬆</span>}</td>
                    <td className={p.hp === 0 ? "text-red-700" : ""}>{p.hp}/{p.maxHp}</td>
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
              </tbody>
            </table>
          </div>

          <div className="mt-3">
            <Link href={`/characters/new?campaign=${campaign.id}`} className="btn-gold">🎭 Create Character in Campaign</Link>
          </div>
        </div>
      )}

      {/* PROGRESSION (DM) */}
      {tab === "progress" && isDM && (
        <div className="card space-y-3">
          <h3 className="font-display text-gold">XP & Level Management</h3>
          <p className="text-sm text-[#5e5448]">{sel.length ? `${sel.length} characters selected` : "Entire party"} (select in the Party tab to target)</p>
          <div className="flex flex-wrap gap-2">
            <input className="input max-w-[140px]" placeholder="XP amount" value={xpAmt} onChange={(e) => setXpAmt(e.target.value)} inputMode="numeric" />
            <button className="btn-primary" disabled={busy} onClick={() => post(`/api/campaigns/${campaign.id}/xp`, { amount: parseInt(xpAmt) || 0, characterIds: sel.length ? sel : undefined })}>Award XP</button>
            {[100, 500, 1000].map((v) => (
              <button key={v} className="btn-ghost" onClick={() => post(`/api/campaigns/${campaign.id}/xp`, { amount: v, characterIds: sel.length ? sel : undefined })}>+{v}</button>
            ))}
          </div>
          <div className="text-sm text-[#5e5448]">Level up: use the +L/−L buttons in the Party tab, or award XP and watch for the ⬆ marker.</div>
        </div>
      )}

      {/* SESSIONS */}
      {tab === "sessions" && <SessionsTab campaignId={campaign.id} isDM={isDM} />}

      {/* WORLD (NPCs & Quests) */}
      {tab === "world" && <WorldTab campaignId={campaign.id} isDM={isDM} />}

      {/* NOTES */}
      {tab === "notes" && <DmNotesTab campaignId={campaign.id} isDM={isDM} />}

      {/* LOOT & GOLD */}
      {tab === "loot" && (
        <>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="card space-y-3">
            <h3 className="font-display text-gold">Party Gold</h3>
            <div className="font-display text-2xl text-gold">{partyGold.pp}pp {partyGold.gp}gp {partyGold.sp}sp {partyGold.cp}cp</div>
            {isDM && (
              <div className="flex flex-wrap gap-2">
                <input className="input max-w-[120px]" placeholder="gp" value={goldGp} onChange={(e) => setGoldGp(e.target.value)} inputMode="numeric" />
                <button className="btn-gold" onClick={() => post(`/api/campaigns/${campaign.id}/gold`, { target: "party", deltaCp: (parseInt(goldGp) || 0) * 100 })}>+ Add</button>
                <button className="btn-ghost" onClick={() => post(`/api/campaigns/${campaign.id}/gold`, { target: "party", deltaCp: -(parseInt(goldGp) || 0) * 100 })}>− Remove</button>
              </div>
            )}
            {isDM && party.length > 0 && (
              <div className="border-t border-[#dfd5b8] pt-2 text-sm">
                <div className="mb-1 text-[#5e5448]">Distribute to a player (from the pool):</div>
                {party.map((p) => (
                  <div key={p.id} className="flex items-center justify-between py-0.5">
                    <span>{p.name}</span>
                    <button className="btn-ghost !py-0.5" onClick={() => post(`/api/campaigns/${campaign.id}/gold`, { target: "character", characterId: p.id, deltaCp: (parseInt(goldGp) || 0) * 100, fromParty: true })}>Give {goldGp || 0}g</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card space-y-3">
            <h3 className="font-display text-gold">Party Loot</h3>
            {isDM && (
              <div className="flex gap-2">
                <input className="input" placeholder="Item name" value={lootName} onChange={(e) => setLootName(e.target.value)} />
                <button className="btn-gold" disabled={!lootName} onClick={() => { post(`/api/campaigns/${campaign.id}/loot`, { name: lootName }); setLootName(""); }}>Add</button>
              </div>
            )}
            {loot.length === 0 ? <p className="text-sm text-[#5e5448]">No loot.</p> : (
              <ul className="space-y-1 text-sm">
                {loot.map((l) => (
                  <li key={l.id} className="flex items-center justify-between border-t border-[#dfd5b8] py-1">
                    <span>{l.name} {l.quantity > 1 ? `×${l.quantity}` : ""}</span>
                    {isDM && (
                      <div className="flex items-center gap-1">
                        <select className="input !py-0.5 !w-auto" defaultValue="" onChange={(e) => e.target.value && post(`/api/campaigns/${campaign.id}/loot`, { lootId: l.id, characterId: e.target.value }, "PATCH")}>
                          <option value="">Assign to...</option>
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
        <PartyLootTab campaignId={campaign.id} isDM={isDM} myCharacters={myCharacters} />
        </>
      )}

      {/* REST (DM) */}
      {tab === "rest" && (
        <div className="card space-y-3">
          <h3 className="font-display text-gold">Rest & Recovery</h3>
          {isDM ? (
            <>
              <p className="text-sm text-[#5e5448]">{sel.length ? `${sel.length} selected` : "Entire party"}</p>
              <div className="flex gap-2">
                <button className="btn-ghost" disabled={busy} onClick={() => post(`/api/campaigns/${campaign.id}/rest`, { type: "SHORT", characterIds: sel.length ? sel : undefined })}>☕ Short Rest</button>
                <button className="btn-primary" disabled={busy} onClick={() => post(`/api/campaigns/${campaign.id}/rest`, { type: "LONG", characterIds: sel.length ? sel : undefined })}>🌙 Long Rest</button>
              </div>
              <p className="text-xs text-[#5e5448]">Long Rest: full HP, half Hit Dice restored, all spell slots, resources reset, exhaustion −1. Short Rest: Pact slots + short-rest resources.</p>
            </>
          ) : <p className="text-sm text-[#5e5448]">Only the DM can trigger a party rest.</p>}
        </div>
      )}

      {/* PLAY */}
      {tab === "play" && (
        <PlayTab campaign={campaign} encounters={encounters} maps={maps} party={party} isDM={isDM} onChange={() => router.refresh()} />
      )}

      {isDM && settingsOpen && (
        <SettingsModal campaignId={campaign.id} onClose={() => { setSettingsOpen(false); router.refresh(); }} />
      )}
      {isDM && invitesOpen && (
        <InvitesModal campaignId={campaign.id} inviteCode={campaign.inviteCode} onClose={() => setInvitesOpen(false)} />
      )}
    </main>
  );
}

type Invite = { id: string; email: string; status: string; expiresAt: string };

function InvitesModal({ campaignId, inviteCode, onClose }: { campaignId: string; inviteCode: string | null; onClose: () => void }) {
  const [invites, setInvites] = useState<Invite[] | null>(null);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = () => fetch(`/api/campaigns/${campaignId}/invites`).then((r) => r.json()).then((d) => setInvites(d.invites ?? [])).catch(() => setInvites([]));
  useEffect(() => { load(); }, [campaignId]);

  async function invite() {
    if (!email.trim() || busy) return;
    setBusy(true); setErr(null); setMsg(null);
    const res = await fetch(`/api/campaigns/${campaignId}/invites`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim() }),
    });
    setBusy(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setErr(data.error ?? "Could not send invite"); return; }
    setMsg(data.emailSent ? `Invitation emailed to ${email.trim()}.` : `Invite created (email delivery unavailable — share the code manually).`);
    setEmail(""); load();
  }

  async function revoke(inviteId: string) {
    await fetch(`/api/campaigns/${campaignId}/invites`, {
      method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ inviteId }),
    });
    load();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="card w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-1 font-display text-lg text-gold">✉ Invite Players</h3>
        <p className="muted mb-3 text-xs">Players join with <b>two</b> things: an email invitation (below) <b>and</b> the campaign invite code. Both are required.</p>

        <div className="panel-inset mb-3 flex items-center justify-between p-2 text-sm">
          <span>Invite code</span>
          <code className="text-gold">{inviteCode ?? "—"}</code>
        </div>

        <div className="flex gap-2">
          <input className="input flex-1" type="email" placeholder="player@email.com" value={email}
            onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === "Enter" && invite()} />
          <button className="btn-primary" disabled={busy || !email} onClick={invite}>Send</button>
        </div>
        {msg && <p className="mt-2 text-sm text-emerald-700">{msg}</p>}
        {err && <p className="mt-2 text-sm text-red-700">{err}</p>}

        <div className="mt-4 space-y-1">
          {invites === null && <p className="muted text-sm">Loading…</p>}
          {invites?.length === 0 && <p className="muted text-sm">No invitations yet.</p>}
          {invites?.map((inv) => (
            <div key={inv.id} className="flex items-center justify-between panel-inset p-2 text-sm">
              <div className="min-w-0">
                <div className="truncate">{inv.email}</div>
                <div className="faint text-xs">{inv.status}{inv.status === "pending" && ` · expires ${new Date(inv.expiresAt).toLocaleDateString()}`}</div>
              </div>
              {inv.status === "pending" && <button className="btn-ghost !px-2 !py-0.5 text-xs" onClick={() => revoke(inv.id)}>Revoke</button>}
            </div>
          ))}
        </div>

        <div className="mt-4 flex justify-end">
          <button className="btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

type Settings = {
  xpMode: "xp" | "milestone";
  enemyHpVisible: boolean;
  diceVisibilityDefault: "public" | "dm";
  critRule: "standard" | "double-total";
  restVariant: "standard" | "gritty";
  joinApproval: boolean;
};

function SettingsModal({ campaignId, onClose }: { campaignId: string; onClose: () => void }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/campaigns/${campaignId}/settings`)
      .then((r) => r.json())
      .then((d) => setSettings(d.settings))
      .catch(() => setSettings(null));
  }, [campaignId]);

  async function save() {
    if (!settings || saving) return;
    setSaving(true);
    try {
      await fetch(`/api/campaigns/${campaignId}/settings`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings),
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setSettings((s) => (s ? { ...s, [k]: v } : s));

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal card space-y-3" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-display text-gold">⚙ Campaign Settings</h3>
        {!settings ? <p className="muted text-sm">Loading…</p> : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label">Advancement</label>
                <select className="input" value={settings.xpMode} onChange={(e) => set("xpMode", e.target.value as Settings["xpMode"])}>
                  <option value="xp">XP</option>
                  <option value="milestone">Milestone</option>
                </select>
              </div>
              <div>
                <label className="label">Default Dice Visibility</label>
                <select className="input" value={settings.diceVisibilityDefault} onChange={(e) => set("diceVisibilityDefault", e.target.value as Settings["diceVisibilityDefault"])}>
                  <option value="public">Public</option>
                  <option value="dm">DM only</option>
                </select>
              </div>
              <div>
                <label className="label">Critical Hit Rule</label>
                <select className="input" value={settings.critRule} onChange={(e) => set("critRule", e.target.value as Settings["critRule"])}>
                  <option value="standard">Standard (double dice)</option>
                  <option value="double-total">Double total</option>
                </select>
              </div>
              <div>
                <label className="label">Rest Variant</label>
                <select className="input" value={settings.restVariant} onChange={(e) => set("restVariant", e.target.value as Settings["restVariant"])}>
                  <option value="standard">Standard</option>
                  <option value="gritty">Gritty Realism</option>
                </select>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="h-4 w-4" checked={settings.enemyHpVisible} onChange={(e) => set("enemyHpVisible", e.target.checked)} />
              Show enemy HP to players
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="h-4 w-4" checked={settings.joinApproval} onChange={(e) => set("joinApproval", e.target.checked)} />
              Require DM approval for new members
            </label>
            <div className="flex justify-end gap-2 border-t border-[#dfd5b8] pt-3">
              <button className="btn-ghost" onClick={onClose}>Cancel</button>
              <button className="btn-primary" disabled={saving} onClick={save}>{saving ? "Saving…" : "Save Settings"}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function PlayTab({ campaign, encounters, maps, party, isDM, onChange }: any) {
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
        <h3 className="font-display text-gold">Encounters</h3>
        {encounters.length === 0 ? <p className="text-sm text-[#5e5448]">No encounters yet.</p> : (
          <ul className="space-y-1 text-sm">
            {encounters.map((e: any) => (
              <li key={e.id} className="flex justify-between border-t border-[#dfd5b8] py-1">
                <Link href={`/play/${e.id}`} className="text-gold hover:underline">{e.name}</Link>
                <span className="chip">{e.status}</span>
              </li>
            ))}
          </ul>
        )}
        {isDM && (
          <div className="flex gap-2 pt-2">
            <input className="input" placeholder="Encounter name" value={name} onChange={(e) => setName(e.target.value)} />
            <button className="btn-primary" onClick={createEncounter}>⚔ New Encounter</button>
          </div>
        )}
      </div>
      <div className="card space-y-2">
        <h3 className="font-display text-gold">Maps</h3>
        {maps.length === 0 ? <p className="text-sm text-[#5e5448]">No maps. Add one while building an encounter.</p> : (
          <ul className="text-sm">{maps.map((m: any) => <li key={m.id} className="border-t border-[#dfd5b8] py-1">{m.name}</li>)}</ul>
        )}
        {isDM && <p className="text-xs text-[#5e5448]">Maps are created and linked inside the encounter screen (select an encounter → “New Map”).</p>}
      </div>
      {isDM && <EncounterPlanner campaign={campaign} party={party} />}
    </div>
  );
}

type PlannedMonster = { id: number; name: string; cr: string; xp: number | null; count: number };

function EncounterPlanner({ campaign, party }: { campaign: any; party: Party[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [picked, setPicked] = useState<PlannedMonster[]>([]);
  const [busy, setBusy] = useState(false);

  async function search(query = q) {
    const r = await fetch(`/api/srd/monsters?q=${encodeURIComponent(query)}`);
    setResults(await r.json());
  }
  useEffect(() => { if (open && results.length === 0) search(""); }, [open]); // eslint-disable-line

  function addMonster(m: any) {
    setPicked((p) => {
      const i = p.findIndex((x) => x.id === m.id);
      if (i >= 0) return p.map((x, j) => (j === i ? { ...x, count: x.count + 1 } : x));
      return [...p, { id: m.id, name: m.name, cr: m.cr ?? "0", xp: m.xp ?? null, count: 1 }];
    });
  }
  function step(id: number, delta: number) {
    setPicked((p) => p
      .map((x) => (x.id === id ? { ...x, count: x.count + delta } : x))
      .filter((x) => x.count > 0));
  }

  const levels = party.map((p) => p.level);
  const diff = computeEncounterDifficulty(levels, picked.map((m) => ({ cr: m.cr, count: m.count })));
  const scaleMax = Math.max(diff.thresholds.deadly * 1.25, diff.adjustedXp * 1.1, 1);
  const pct = (v: number) => Math.min(100, (v / scaleMax) * 100);

  const RATING_STYLE: Record<string, React.CSSProperties> = {
    hard: { background: "rgba(168,93,59,.2)", borderColor: "var(--rust)", color: "#7a3a1c" },
    deadly: { background: "var(--blood)", borderColor: "var(--wine-dark)", color: "#fdf6e8" },
  };
  const ratingClass = diff.rating === "medium" ? "chip-gold" : "chip";

  async function createWithMonsters() {
    if (picked.length === 0 || busy) return;
    setBusy(true);
    try {
      const name = picked.map((m) => (m.count > 1 ? `${m.name} ×${m.count}` : m.name)).join(", ").slice(0, 80) || "Encounter";
      const res = await fetch(`/api/campaigns/${campaign.id}/encounters`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }),
      });
      if (!res.ok) { setBusy(false); return; }
      const enc = await res.json();
      for (const m of picked) {
        await fetch(`/api/encounters/${enc.id}`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ op: "addMonster", monsterId: m.id, count: m.count }),
        });
      }
      router.push(`/play/${enc.id}`);
    } catch {
      setBusy(false);
    }
  }

  const TICKS: [keyof typeof diff.thresholds, string][] = [
    ["easy", "Easy"], ["medium", "Medium"], ["hard", "Hard"], ["deadly", "Deadly"],
  ];

  return (
    <div className="card md:col-span-2">
      <button className="flex w-full items-center justify-between" onClick={() => setOpen((o) => !o)}>
        <h3 className="font-display text-gold">🧮 Encounter Planner</h3>
        <span className="chip">{open ? "▲ Hide" : "▼ Open"}</span>
      </button>

      {open && (
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          {/* Monster search */}
          <div className="space-y-2">
            <div className="flex gap-1">
              <input className="input" placeholder="Search monster..." value={q}
                onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && search()} />
              <button className="btn-ghost" onClick={() => search()}>Search</button>
            </div>
            <div className="max-h-48 space-y-1 overflow-y-auto text-sm">
              {results.map((m: any) => (
                <div key={m.id} className="flex items-center justify-between border-t border-[#dfd5b8] py-1">
                  <span>{m.name} <span className="muted text-xs">CR {m.cr ?? "?"} · {m.xp ?? "?"} XP</span></span>
                  <button className="btn-ghost !px-2 !py-0.5" onClick={() => addMonster(m)}>+ Add</button>
                </div>
              ))}
              {results.length === 0 && <p className="muted text-xs">No monsters found.</p>}
            </div>

            {/* Picked roster with count steppers */}
            <div className="border-t border-[#dfd5b8] pt-2">
              <div className="mb-1 text-sm text-[#5e5448]">Roster</div>
              {picked.length === 0 ? <p className="muted text-xs">No monsters added yet.</p> : (
                <ul className="space-y-1 text-sm">
                  {picked.map((m) => (
                    <li key={m.id} className="flex items-center justify-between">
                      <span>{m.name} <span className="muted text-xs">CR {m.cr}</span></span>
                      <span className="flex items-center gap-1">
                        <button className="btn-ghost !px-2 !py-0.5" onClick={() => step(m.id, -1)}>−</button>
                        <span className="chip !py-0.5">×{m.count}</span>
                        <button className="btn-ghost !px-2 !py-0.5" onClick={() => step(m.id, +1)}>+</button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Difficulty readout */}
          <div className="space-y-3">
            <div className="text-sm text-[#5e5448]">
              Party: {party.length === 0 ? "no characters" : party.map((p) => `${p.name} (L${p.level})`).join(", ")}
            </div>

            {/* Threshold bar */}
            <div className="relative mt-6 h-3 rounded-full border border-[#dfd5b8]"
              style={{ background: "linear-gradient(90deg, #ece4cb, #dcc9a0)" }}>
              {TICKS.map(([k, label]) => (
                <div key={k} className="absolute top-[-4px] h-5 w-px bg-[#8a7a5c]" style={{ left: `${pct(diff.thresholds[k])}%` }}>
                  <span className="absolute left-1/2 top-[-14px] -translate-x-1/2 whitespace-nowrap text-[10px] text-[#5e5448]">{label}</span>
                </div>
              ))}
              {picked.length > 0 && (
                <div className="absolute top-[-6px] h-6 w-[3px] rounded-sm"
                  style={{ left: `${pct(diff.adjustedXp)}%`, background: "var(--blood)" }}
                  title={`Adjusted XP: ${diff.adjustedXp}`} />
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className={ratingClass} style={RATING_STYLE[diff.rating]}>
                {diff.rating.charAt(0).toUpperCase() + diff.rating.slice(1)}
              </span>
              <span>
                XP {diff.totalXp} · ×{diff.multiplier} → {diff.adjustedXp} adjusted · {diff.perPlayerXp}/player
              </span>
            </div>

            {diff.warnings.map((w, i) => (
              <div key={i} className="rounded border border-[#d89d93] bg-[#f3dedb] px-2 py-1 text-xs text-[#8b2f2e]">⚠ {w}</div>
            ))}

            <button className="btn-primary w-full" disabled={picked.length === 0 || busy} onClick={createWithMonsters}>
              {busy ? "Creating..." : "⚔ Create Encounter with These Monsters"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
