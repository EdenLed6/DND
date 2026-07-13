"use client";
// NPCs & Quests (SPEC-DM §10). DM manages the world; players see only what has
// been revealed (server strips secrets — this component never receives them).
import { useCallback, useEffect, useState } from "react";
import { useRealtime } from "@/lib/realtime/useRealtime";

type Npc = {
  id: string;
  name: string;
  role: string | null;
  location: string | null;
  faction: string | null;
  attitude: string | null;
  portraitUrl: string | null;
  publicDesc: string | null;
  secretDesc?: string | null; // DM only — absent for players
  statBlockJson?: string | null; // DM only — absent for players
  status: string;
  revealed: boolean;
};

type QuestStep = { text: string; done: boolean };
type Quest = {
  id: string;
  name: string;
  status: string;
  giver: string | null;
  objective: string | null;
  stepsJson: string;
  rewards: string | null;
  playerText: string | null;
  dmNotes?: string | null; // DM only — absent for players
};

const ATTITUDES = ["friendly", "neutral", "hostile", "unknown"] as const;
const QUEST_STATUSES = ["ACTIVE", "DONE", "FAILED", "HIDDEN"] as const;

// Wine-tinted "DM only" styling (matches --heading / --wine-dark palette).
const DM_ONLY_BLOCK: React.CSSProperties = {
  background: "rgba(122, 43, 47, .06)",
  border: "1px solid rgba(122, 43, 47, .30)",
  borderRadius: "6px",
};
const DM_ONLY_LABEL: React.CSSProperties = {
  color: "var(--heading)",
  fontSize: "10px",
  fontWeight: 700,
  letterSpacing: ".08em",
  textTransform: "uppercase",
};

function attitudeChipClass(attitude: string | null) {
  switch (attitude) {
    case "friendly": return "chip chip-sage";
    case "hostile": return "chip chip-rust";
    case "neutral": return "chip";
    default: return "chip opacity-60"; // unknown / unset
  }
}

function questChipClass(status: string) {
  switch (status) {
    case "ACTIVE": return "chip chip-gold";
    case "DONE": return "chip chip-sage";
    case "FAILED": return "chip chip-rust";
    default: return "chip opacity-70"; // HIDDEN (DM only) — dashed via style
  }
}

function parseSteps(json: string): QuestStep[] {
  try {
    const v = JSON.parse(json);
    if (Array.isArray(v)) {
      return v
        .filter((s) => s && typeof s.text === "string")
        .map((s) => ({ text: s.text as string, done: !!s.done }));
    }
  } catch {}
  return [];
}

function EyeOffIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

async function postOp(campaignId: string, kind: "npcs" | "quests", body: unknown): Promise<string | null> {
  const r = await fetch(`/api/campaigns/${campaignId}/${kind}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);
  if (!r || !r.ok) return (await r?.json().catch(() => null))?.error ?? "Request failed";
  return null;
}

export function WorldTab({ campaignId, isDM }: { campaignId: string; isDM: boolean }) {
  const [npcs, setNpcs] = useState<Npc[]>([]);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [nr, qr] = await Promise.all([
        fetch(`/api/campaigns/${campaignId}/npcs`),
        fetch(`/api/campaigns/${campaignId}/quests`),
      ]);
      if (!nr.ok || !qr.ok) {
        setError("Failed to load the world");
        setLoaded(true);
        return;
      }
      setNpcs((await nr.json()).npcs ?? []);
      setQuests((await qr.json()).quests ?? []);
      setError(null);
      setLoaded(true);
    } catch {
      setError("Failed to load the world");
      setLoaded(true);
    }
  }, [campaignId]);

  useEffect(() => { refresh(); }, [refresh]);
  useRealtime({ "world:changed": () => refresh() }, [campaignId]);

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-red-700">{error}</p>}
      <NpcsSection campaignId={campaignId} isDM={isDM} npcs={npcs} loaded={loaded} onChanged={refresh} />
      <QuestsSection campaignId={campaignId} isDM={isDM} quests={quests} loaded={loaded} onChanged={refresh} />
    </div>
  );
}

/* ============================== NPCs ============================== */

function NpcsSection({ campaignId, isDM, npcs, loaded, onChanged }: {
  campaignId: string; isDM: boolean; npcs: Npc[]; loaded: boolean; onChanged: () => void;
}) {
  const [editing, setEditing] = useState<Npc | "new" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function run(body: unknown) {
    setActionError(await postOp(campaignId, "npcs", body));
    onChanged();
  }

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-display text-lg text-gold">NPCs</h3>
        {isDM && (
          <button className="btn-primary !py-1 text-sm" onClick={() => setEditing("new")}>+ New NPC</button>
        )}
      </div>
      {actionError && <p className="mb-2 text-sm text-red-700">{actionError}</p>}

      {loaded && npcs.length === 0 && (
        <div className="panel-inset p-4 text-center">
          <p className="text-sm text-[#5e5448]">
            {isDM ? "No NPCs yet — populate your world." : "No NPCs have been revealed yet."}
          </p>
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        {npcs.map((n) => (
          <NpcCard key={n.id} npc={n} isDM={isDM}
            onReveal={(revealed) => run({ op: "reveal", npcId: n.id, revealed })}
            onEdit={() => setEditing(n)}
            onDelete={() => { if (confirm(`Delete NPC "${n.name}"?`)) run({ op: "delete", npcId: n.id }); }}
          />
        ))}
      </div>

      {editing && isDM && (
        <NpcModal campaignId={campaignId} npc={editing === "new" ? null : editing}
          onClose={(changed) => { setEditing(null); if (changed) onChanged(); }} />
      )}
    </section>
  );
}

function NpcCard({ npc, isDM, onReveal, onEdit, onDelete }: {
  npc: Npc; isDM: boolean; onReveal: (revealed: boolean) => void; onEdit: () => void; onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const hidden = !npc.revealed;
  const subtitle = [npc.role, npc.location].filter(Boolean).join(" · ");
  const hasDetail = !!(npc.publicDesc || (isDM && npc.secretDesc));

  return (
    <div className="panel-inset p-3"
      style={isDM && hidden ? { borderStyle: "dashed", borderColor: "var(--gold)" } : undefined}>
      <div className="flex items-start gap-2.5">
        {/* Portrait circle: image or initial */}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--gold)] bg-[#f4ead2]">
          {npc.portraitUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={npc.portraitUrl} alt={npc.name} className="h-full w-full object-cover" />
          ) : (
            <span className="font-display text-lg text-[var(--heading)]">{npc.name.charAt(0).toUpperCase()}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`font-display text-base ${hasDetail ? "cursor-pointer" : ""}`}
              title={hasDetail ? (open ? "Click to collapse" : "Click to expand") : undefined}
              onClick={() => hasDetail && setOpen((v) => !v)}>
              {npc.name}
            </span>
            {isDM && hidden && <span className="text-[#5e5448]" title="Hidden from players"><EyeOffIcon /></span>}
          </div>
          {subtitle && <p className="text-xs text-[#5e5448]">{subtitle}</p>}
          <div className="mt-1 flex flex-wrap items-center gap-1">
            {npc.faction && <span className="chip">{npc.faction}</span>}
            {npc.attitude && <span className={attitudeChipClass(npc.attitude)}>{npc.attitude}</span>}
            {npc.status && <span className="chip opacity-80">{npc.status}</span>}
            {isDM && (
              <button className={`chip cursor-pointer ${npc.revealed ? "chip-gold" : "opacity-60"}`}
                style={hidden ? { borderStyle: "dashed" } : undefined}
                title={npc.revealed ? "Players can see this NPC. Click to hide." : "Hidden from players. Click to reveal."}
                onClick={() => onReveal(!npc.revealed)}>
                {npc.revealed ? "Revealed" : "Hidden"}
              </button>
            )}
          </div>
        </div>
        {isDM && (
          <span className="flex shrink-0 items-center gap-1">
            <button className="btn-ghost !px-1.5 !py-0 text-xs" onClick={onEdit}>Edit</button>
            <button className="text-xs text-[#5e5448] hover:text-red-700" title="Delete NPC" onClick={onDelete}>✕</button>
          </span>
        )}
      </div>

      {open && hasDetail && (
        <div className="mt-2 space-y-2">
          {npc.publicDesc && <p className="whitespace-pre-wrap text-sm">{npc.publicDesc}</p>}
          {isDM && npc.secretDesc && (
            <div className="p-2" style={DM_ONLY_BLOCK}>
              <p style={DM_ONLY_LABEL}>DM only</p>
              <p className="mt-0.5 whitespace-pre-wrap text-sm">{npc.secretDesc}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function NpcModal({ campaignId, npc, onClose }: {
  campaignId: string; npc: Npc | null; onClose: (changed: boolean) => void;
}) {
  const [name, setName] = useState(npc?.name ?? "");
  const [role, setRole] = useState(npc?.role ?? "");
  const [location, setLocation] = useState(npc?.location ?? "");
  const [faction, setFaction] = useState(npc?.faction ?? "");
  const [attitude, setAttitude] = useState(npc?.attitude ?? "unknown");
  const [portraitUrl, setPortraitUrl] = useState(npc?.portraitUrl ?? "");
  const [status, setStatus] = useState(npc?.status ?? "alive");
  const [publicDesc, setPublicDesc] = useState(npc?.publicDesc ?? "");
  const [secretDesc, setSecretDesc] = useState(npc?.secretDesc ?? "");
  const [revealed, setRevealed] = useState(npc?.revealed ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    const fields = {
      name: name.trim(), role: role.trim() || null, location: location.trim() || null,
      faction: faction.trim() || null, attitude, portraitUrl: portraitUrl.trim() || null,
      status: status.trim() || "alive", publicDesc: publicDesc || null, secretDesc: secretDesc || null,
      revealed,
    };
    const err = await postOp(campaignId, "npcs",
      npc ? { op: "update", npcId: npc.id, patch: fields } : { op: "create", ...fields });
    setSaving(false);
    if (err) { setError(err); return; }
    onClose(true);
  }

  return (
    <div className="overlay" onClick={() => onClose(false)}>
      <div className="card modal" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-lg text-gold">{npc ? "Edit NPC" : "New NPC"}</h3>
          <button className="btn-ghost !py-0.5" onClick={() => onClose(false)}>Close</button>
        </div>
        <div className="space-y-2">
          <input className="input" placeholder="Name" maxLength={80}
            value={name} onChange={(e) => setName(e.target.value)} />
          <div className="flex gap-2">
            <input className="input flex-1" placeholder="Role (e.g. Innkeeper)" maxLength={200}
              value={role} onChange={(e) => setRole(e.target.value)} />
            <input className="input flex-1" placeholder="Location" maxLength={200}
              value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <input className="input flex-1" placeholder="Faction" maxLength={200}
              value={faction} onChange={(e) => setFaction(e.target.value)} />
            <select className="input !w-auto" value={attitude ?? "unknown"}
              onChange={(e) => setAttitude(e.target.value)} title="Attitude">
              {ATTITUDES.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <input className="input flex-1" placeholder="Portrait URL (optional)" maxLength={2000}
              value={portraitUrl} onChange={(e) => setPortraitUrl(e.target.value)} />
            <input className="input !w-32" placeholder="Status" maxLength={80} title="Status (e.g. alive, dead, missing)"
              value={status} onChange={(e) => setStatus(e.target.value)} />
          </div>
          <div>
            <label className="label">Public description</label>
            <textarea className="input" rows={3} maxLength={8000}
              placeholder="Players see this when revealed"
              value={publicDesc} onChange={(e) => setPublicDesc(e.target.value)} />
          </div>
          <div className="p-2" style={DM_ONLY_BLOCK}>
            <p style={DM_ONLY_LABEL}>DM only</p>
            <textarea className="input mt-1" rows={3} maxLength={8000}
              placeholder="Secrets, plans, true motives — never shown to players"
              value={secretDesc} onChange={(e) => setSecretDesc(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={revealed} onChange={(e) => setRevealed(e.target.checked)} />
            <span>
              Revealed to players
              <span className="block text-xs text-[#5e5448]">Players will see this NPC and its public description.</span>
            </span>
          </label>
          {error && <p className="text-sm text-red-700">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button className="btn-ghost" onClick={() => onClose(false)}>Cancel</button>
            <button className="btn-primary" disabled={saving || !name.trim()} onClick={save}>
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================== Quests ============================== */

function QuestsSection({ campaignId, isDM, quests, loaded, onChanged }: {
  campaignId: string; isDM: boolean; quests: Quest[]; loaded: boolean; onChanged: () => void;
}) {
  const [editing, setEditing] = useState<Quest | "new" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function run(body: unknown) {
    setActionError(await postOp(campaignId, "quests", body));
    onChanged();
  }

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-display text-lg text-gold">Quests</h3>
        {isDM && (
          <button className="btn-primary !py-1 text-sm" onClick={() => setEditing("new")}>+ New Quest</button>
        )}
      </div>
      {actionError && <p className="mb-2 text-sm text-red-700">{actionError}</p>}

      {loaded && quests.length === 0 && (
        <div className="panel-inset p-4 text-center">
          <p className="text-sm text-[#5e5448]">
            {isDM ? "No quests yet — every adventure needs a call to action." : "No quests yet."}
          </p>
        </div>
      )}

      <div className="space-y-2">
        {quests.map((q) => (
          <QuestCard key={q.id} quest={q} isDM={isDM}
            onToggleStep={(idx) => {
              const steps = parseSteps(q.stepsJson);
              if (!steps[idx]) return;
              steps[idx] = { ...steps[idx], done: !steps[idx].done };
              run({ op: "update", questId: q.id, patch: { steps } });
            }}
            onSetStatus={(status) => run({ op: "setStatus", questId: q.id, status })}
            onEdit={() => setEditing(q)}
            onDelete={() => { if (confirm(`Delete quest "${q.name}"?`)) run({ op: "delete", questId: q.id }); }}
          />
        ))}
      </div>

      {editing && isDM && (
        <QuestModal campaignId={campaignId} quest={editing === "new" ? null : editing}
          onClose={(changed) => { setEditing(null); if (changed) onChanged(); }} />
      )}
    </section>
  );
}

function QuestCard({ quest, isDM, onToggleStep, onSetStatus, onEdit, onDelete }: {
  quest: Quest; isDM: boolean; onToggleStep: (idx: number) => void;
  onSetStatus: (status: string) => void; onEdit: () => void; onDelete: () => void;
}) {
  const steps = parseSteps(quest.stepsJson);
  const hiddenQuest = quest.status === "HIDDEN";

  return (
    <div className="panel-inset p-3"
      style={isDM && hiddenQuest ? { borderStyle: "dashed", borderColor: "var(--gold)" } : undefined}>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="font-display text-base">{quest.name}</span>
        <span className={questChipClass(quest.status)}
          style={hiddenQuest ? { borderStyle: "dashed" } : undefined}>
          {quest.status}
        </span>
        {quest.giver && <span className="text-xs text-[#5e5448]">from {quest.giver}</span>}
        <span className="ml-auto flex items-center gap-1">
          {isDM && (
            <>
              <select className="input !w-auto !py-0.5 text-xs" value={quest.status}
                title="Quest status" onChange={(e) => onSetStatus(e.target.value)}>
                {QUEST_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <button className="btn-ghost !px-1.5 !py-0 text-xs" onClick={onEdit}>Edit</button>
              <button className="text-xs text-[#5e5448] hover:text-red-700" title="Delete quest" onClick={onDelete}>✕</button>
            </>
          )}
        </span>
      </div>

      {quest.objective && <p className="mt-1 text-sm font-semibold">{quest.objective}</p>}
      {quest.playerText && <p className="mt-1 whitespace-pre-wrap text-sm">{quest.playerText}</p>}

      {steps.length > 0 && (
        <ul className="mt-2 space-y-1">
          {steps.map((s, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              {isDM ? (
                <input type="checkbox" className="mt-0.5 cursor-pointer" checked={s.done}
                  title="Toggle step" onChange={() => onToggleStep(i)} />
              ) : (
                <span className={s.done ? "text-[#4c5f3d]" : "text-[#cdbf9f]"} aria-hidden="true">
                  {s.done ? "✓" : "○"}
                </span>
              )}
              <span className={s.done ? "line-through opacity-60" : ""}>{s.text}</span>
            </li>
          ))}
        </ul>
      )}

      {quest.rewards && (
        <p className="mt-2 text-sm">
          <span className="font-semibold text-[#6a4f14]">Rewards:</span> {quest.rewards}
        </p>
      )}

      {isDM && quest.dmNotes && (
        <div className="mt-2 p-2" style={DM_ONLY_BLOCK}>
          <p style={DM_ONLY_LABEL}>DM only</p>
          <p className="mt-0.5 whitespace-pre-wrap text-sm">{quest.dmNotes}</p>
        </div>
      )}
    </div>
  );
}

function QuestModal({ campaignId, quest, onClose }: {
  campaignId: string; quest: Quest | null; onClose: (changed: boolean) => void;
}) {
  const [name, setName] = useState(quest?.name ?? "");
  const [status, setStatus] = useState(quest?.status ?? "ACTIVE");
  const [giver, setGiver] = useState(quest?.giver ?? "");
  const [objective, setObjective] = useState(quest?.objective ?? "");
  const [steps, setSteps] = useState<QuestStep[]>(quest ? parseSteps(quest.stepsJson) : []);
  const [rewards, setRewards] = useState(quest?.rewards ?? "");
  const [playerText, setPlayerText] = useState(quest?.playerText ?? "");
  const [dmNotes, setDmNotes] = useState(quest?.dmNotes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    const fields = {
      name: name.trim(), status, giver: giver.trim() || null,
      objective: objective.trim() || null,
      steps: steps.filter((s) => s.text.trim()).map((s) => ({ text: s.text.trim(), done: s.done })),
      rewards: rewards.trim() || null, playerText: playerText || null, dmNotes: dmNotes || null,
    };
    const err = await postOp(campaignId, "quests",
      quest ? { op: "update", questId: quest.id, patch: fields } : { op: "create", ...fields });
    setSaving(false);
    if (err) { setError(err); return; }
    onClose(true);
  }

  return (
    <div className="overlay" onClick={() => onClose(false)}>
      <div className="card modal" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-lg text-gold">{quest ? "Edit Quest" : "New Quest"}</h3>
          <button className="btn-ghost !py-0.5" onClick={() => onClose(false)}>Close</button>
        </div>
        <div className="space-y-2">
          <div className="flex gap-2">
            <input className="input flex-1" placeholder="Quest name" maxLength={80}
              value={name} onChange={(e) => setName(e.target.value)} />
            <select className="input !w-auto" value={status} title="Status"
              onChange={(e) => setStatus(e.target.value)}>
              {QUEST_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <input className="input" placeholder="Quest giver" maxLength={200}
            value={giver} onChange={(e) => setGiver(e.target.value)} />
          <input className="input" placeholder="Objective" maxLength={8000}
            value={objective} onChange={(e) => setObjective(e.target.value)} />

          <div>
            <label className="label">Steps</label>
            <div className="space-y-1">
              {steps.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input type="checkbox" checked={s.done} title="Done"
                    onChange={(e) => setSteps((prev) => prev.map((p, j) => j === i ? { ...p, done: e.target.checked } : p))} />
                  <input className="input flex-1 !py-1 text-sm" placeholder={`Step ${i + 1}`} maxLength={300}
                    value={s.text}
                    onChange={(e) => setSteps((prev) => prev.map((p, j) => j === i ? { ...p, text: e.target.value } : p))} />
                  <button className="text-xs text-[#5e5448] hover:text-red-700" title="Remove step"
                    onClick={() => setSteps((prev) => prev.filter((_, j) => j !== i))}>✕</button>
                </div>
              ))}
            </div>
            {steps.length < 30 && (
              <button className="btn-ghost mt-1 !py-0.5 text-xs"
                onClick={() => setSteps((prev) => [...prev, { text: "", done: false }])}>
                + Add step
              </button>
            )}
          </div>

          <input className="input" placeholder="Rewards (e.g. 200 gp, Sword of Dawn)" maxLength={8000}
            value={rewards} onChange={(e) => setRewards(e.target.value)} />
          <div>
            <label className="label">Player text</label>
            <textarea className="input" rows={3} maxLength={8000}
              placeholder="Description players can read"
              value={playerText} onChange={(e) => setPlayerText(e.target.value)} />
          </div>
          <div className="p-2" style={DM_ONLY_BLOCK}>
            <p style={DM_ONLY_LABEL}>DM only</p>
            <textarea className="input mt-1" rows={3} maxLength={8000}
              placeholder="Twists, secrets, contingencies — never shown to players"
              value={dmNotes} onChange={(e) => setDmNotes(e.target.value)} />
          </div>
          {error && <p className="text-sm text-red-700">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button className="btn-ghost" onClick={() => onClose(false)}>Cancel</button>
            <button className="btn-primary" disabled={saving || !name.trim()} onClick={save}>
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
