// Server-side combat operations for an encounter. Each mutation broadcasts live.
import { prisma } from "@/lib/db";
import { loadCharacterView } from "@/lib/character-view";
import { emitToEncounter } from "@/lib/realtime/io";
import { roll } from "@/lib/dnd/dice";
import { abilityMod, sizeToSquares } from "@/lib/dnd/rules";
import { parseActions, resolveAttackRoll, resolveSaveAttack, applyDamage, type DamageModifier } from "@/lib/dnd/combat";

export async function encounterState(encounterId: string) {
  const enc = await prisma.encounter.findUnique({
    where: { id: encounterId },
    include: {
      combatants: { orderBy: [{ initiative: "desc" }, { sortOrder: "asc" }], include: { token: true } },
      tokens: true,
      map: true,
      log: { orderBy: { ts: "desc" }, take: 40 },
    },
  });
  if (!enc) return enc;
  // Attach applied conditions (Conditions & Ongoing Effects system) per combatant.
  const conds = await prisma.appliedCondition.findMany({
    where: { encounterId }, orderBy: { createdAt: "asc" },
  });
  const byCombatant = new Map<string, typeof conds>();
  for (const ac of conds) {
    if (!ac.combatantId) continue;
    const arr = byCombatant.get(ac.combatantId) ?? [];
    arr.push(ac);
    byCombatant.set(ac.combatantId, arr);
  }
  return {
    ...enc,
    combatants: enc.combatants.map((c) => ({ ...c, appliedConditions: byCombatant.get(c.id) ?? [] })),
  };
}

/**
 * Redact an encounter state for a non-DM viewer: strip DM-hidden combatants,
 * their tokens, and raw stat blocks. Used by BOTH the API GET and the SSR page
 * so players never receive hidden monster data (fog of war / hidden combatants).
 */
export function filterStateForRole<T extends { combatants: any[]; tokens: any[] } | null>(
  state: T,
  isDM: boolean,
): T {
  if (!state || isDM) return state;
  const hiddenIds = new Set(state.combatants.filter((c: any) => !c.isVisible).map((c: any) => c.id));
  state.combatants = state.combatants
    .filter((c: any) => c.isVisible)
    .map((c: any) => ({
      ...c,
      statBlockJson: null,
      // Players only see public conditions (DM-only ones are stripped; conditions
      // on hidden combatants disappear with the combatant filter above).
      appliedConditions: (c.appliedConditions ?? []).filter((ac: any) => ac.visibility === "public"),
    }));
  state.tokens = state.tokens.filter((t: any) => !t.combatantId || !hiddenIds.has(t.combatantId));
  return state;
}

/** Append a combat-log entry and broadcast it (also used by the conditions API). */
export async function logEvent(encounterId: string, actor: string, message: string, detail?: any) {
  return log(encounterId, actor, message, detail);
}

async function log(encounterId: string, actor: string, message: string, detail?: any) {
  const entry = await prisma.combatLog.create({
    data: { encounterId, actor, message, detailJson: detail ? JSON.stringify(detail) : null },
  });
  emitToEncounter(encounterId, "log:appended", { logEntry: entry });
  return entry;
}

/** Add campaign player characters as combatants. */
export async function addPlayers(encounterId: string, characterIds: string[]) {
  const enc = await prisma.encounter.findUnique({ where: { id: encounterId } });
  if (!enc) throw new Error("no encounter");
  let sort = await prisma.combatant.count({ where: { encounterId } });
  for (const cid of characterIds) {
    const view = await loadCharacterView(cid);
    if (!view) continue;
    // Only characters that belong to THIS encounter's campaign may be added.
    if (view.character.campaignId !== enc.campaignId) continue;
    const dexMod = view.derived.mods.dex;
    const combatant = await prisma.combatant.create({
      data: {
        encounterId, kind: "player", characterId: cid, name: view.character.name,
        maxHp: view.derived.maxHp, currentHp: view.character.currentHp, ac: view.derived.ac,
        initiative: 0, sortOrder: sort++,
        statBlockJson: JSON.stringify({ dexMod }),
      },
    });
    await prisma.token.create({
      data: { encounterId, combatantId: combatant.id, characterId: cid, label: view.character.name.slice(0, 2),
        color: "#2e6da4", imageUrl: view.character.avatarUrl ?? null, gridX: 1 + (sort % 8), gridY: 1, sizeSquares: 1 },
    });
  }
  emitToEncounter(encounterId, "combatants:changed", { encounterId });
}

/** Update a token's appearance (image, color, size). */
export async function updateToken(encounterId: string, tokenId: string, patch: { imageUrl?: string | null; color?: string; sizeSquares?: number; label?: string }) {
  const existing = await prisma.token.findFirst({ where: { id: tokenId, encounterId } });
  if (!existing) throw new Error("token not in this encounter");
  const data: any = {};
  for (const k of ["imageUrl", "color", "sizeSquares", "label"] as const) if (k in patch) data[k] = patch[k];
  const t = await prisma.token.update({ where: { id: tokenId }, data });
  emitToEncounter(encounterId, "combatants:changed", { encounterId });
  return t;
}

/** Add N copies of an SRD monster. */
export async function addMonster(encounterId: string, monsterId: number, count: number, rollHp: boolean) {
  const m = await prisma.srdMonster.findUnique({ where: { id: monsterId } });
  if (!m) throw new Error("no monster");
  let sort = await prisma.combatant.count({ where: { encounterId } });
  const squares = sizeToSquares(m.size);
  for (let i = 0; i < count; i++) {
    const hp = rollHp && m.hitDice ? Math.max(1, roll(m.hitDice).total) : (m.hp ?? 1);
    const name = count > 1 ? `${m.name} ${i + 1}` : m.name;
    const statBlock = { ...m, dexMod: abilityMod(m.dex ?? 10) };
    const combatant = await prisma.combatant.create({
      data: {
        encounterId, kind: "monster", monsterId: String(m.id), name, maxHp: hp, currentHp: hp,
        ac: m.ac ?? 10, initiative: 0, sortOrder: sort++, isVisible: true,
        statBlockJson: JSON.stringify(statBlock),
      },
    });
    await prisma.token.create({
      data: { encounterId, combatantId: combatant.id, label: name.slice(0, 2), color: "#7b1e1e",
        gridX: 3 + (i % 8), gridY: 4, sizeSquares: squares },
    });
  }
  emitToEncounter(encounterId, "combatants:changed", { encounterId });
  await log(encounterId, "DM", `Added ${count}× ${m.name} (CR ${m.cr})`);
}

/** Roll initiative for all combatants. */
export async function rollInitiativeAll(encounterId: string) {
  const combatants = await prisma.combatant.findMany({ where: { encounterId } });
  for (const c of combatants) {
    let dexMod = 0;
    try { dexMod = JSON.parse(c.statBlockJson || "{}").dexMod ?? 0; } catch {}
    const init = roll(`1d20`).total + dexMod;
    await prisma.combatant.update({ where: { id: c.id }, data: { initiative: init } });
  }
  await prisma.encounter.update({ where: { id: encounterId }, data: { round: 1, turnIndex: 0, status: "ACTIVE" } });
  emitToEncounter(encounterId, "initiative:set", { encounterId });
  await log(encounterId, "DM", "Rolled initiative — combat begins!");
}

/** Advance / rewind the turn pointer. */
export async function turn(encounterId: string, dir: "next" | "prev" | "end") {
  const enc = await prisma.encounter.findUnique({ where: { id: encounterId } });
  if (!enc) throw new Error("no encounter");
  const count = await prisma.combatant.count({ where: { encounterId } });
  if (dir === "end") {
    await prisma.encounter.update({ where: { id: encounterId }, data: { status: "ENDED" } });
    emitToEncounter(encounterId, "turn:advanced", { status: "ENDED" });
    await log(encounterId, "DM", "Encounter ended.");
    return;
  }
  if (count === 0) return;
  let idx = enc.turnIndex + (dir === "next" ? 1 : -1);
  let round = enc.round;
  if (idx >= count) { idx = 0; round++; }
  if (idx < 0) { idx = count - 1; round = Math.max(1, round - 1); }
  await prisma.encounter.update({ where: { id: encounterId }, data: { turnIndex: idx, round } });
  // Include the id of the combatant whose turn now starts, so clients (e.g. the
  // DM's condition-tick prompts) know the new active combatant without a refetch.
  const ordered = await prisma.combatant.findMany({
    where: { encounterId }, orderBy: [{ initiative: "desc" }, { sortOrder: "asc" }], select: { id: true },
  });
  emitToEncounter(encounterId, "turn:advanced", { turnIndex: idx, round, activeCombatantId: ordered[idx]?.id ?? null });
}

export async function updateCombatant(encounterId: string, combatantId: string, patch: any) {
  // Scope: the combatant must belong to this encounter.
  const existing = await prisma.combatant.findFirst({ where: { id: combatantId, encounterId } });
  if (!existing) throw new Error("combatant not in this encounter");
  const data: any = {};
  for (const k of ["currentHp", "tempHp", "ac", "initiative", "name", "isVisible"]) if (k in patch) data[k] = patch[k];
  if ("conditions" in patch) data.conditions = JSON.stringify(patch.conditions);
  const c = await prisma.combatant.update({ where: { id: combatantId }, data });
  // if it's a player, sync HP back to the character sheet
  if (c.kind === "player" && c.characterId && ("currentHp" in patch || "tempHp" in patch)) {
    await prisma.character.update({ where: { id: c.characterId }, data: { currentHp: c.currentHp, tempHp: c.tempHp } });
  }
  // Do NOT broadcast the full combatant (it can include hidden monsters + raw
  // stat blocks). Clients refetch the role-filtered state on this event.
  emitToEncounter(encounterId, "combatant:changed", { encounterId, combatantId: c.id });
  return c;
}

export async function removeCombatant(encounterId: string, combatantId: string) {
  const existing = await prisma.combatant.findFirst({ where: { id: combatantId, encounterId } });
  if (!existing) throw new Error("combatant not in this encounter");
  await prisma.token.deleteMany({ where: { combatantId } });
  await prisma.combatant.delete({ where: { id: combatantId } });
  emitToEncounter(encounterId, "combatants:changed", { encounterId });
}

export async function moveToken(encounterId: string, tokenId: string, gridX: number, gridY: number) {
  const existing = await prisma.token.findFirst({ where: { id: tokenId, encounterId } });
  if (!existing) throw new Error("token not in this encounter");
  const t = await prisma.token.update({ where: { id: tokenId }, data: { gridX, gridY } });
  emitToEncounter(encounterId, "token:moved", { tokenId, gridX, gridY });
  return t;
}

/** Toggle fog of war on/off for an encounter. */
export async function setFog(encounterId: string, enabled: boolean) {
  await prisma.encounter.update({ where: { id: encounterId }, data: { fogEnabled: enabled } });
  const enc = await prisma.encounter.findUnique({ where: { id: encounterId } });
  emitToEncounter(encounterId, "fog:changed", { fogEnabled: enabled, revealedCells: enc?.revealedCells });
}

/** Reveal or hide a set of "x,y" cells. */
export async function revealCells(encounterId: string, cells: string[], reveal: boolean) {
  const enc = await prisma.encounter.findUnique({ where: { id: encounterId } });
  if (!enc) return;
  let set: Set<string>;
  try { set = new Set(JSON.parse(enc.revealedCells || "[]")); } catch { set = new Set(); }
  for (const c of cells) reveal ? set.add(c) : set.delete(c);
  const revealed = JSON.stringify([...set]);
  await prisma.encounter.update({ where: { id: encounterId }, data: { revealedCells: revealed } });
  emitToEncounter(encounterId, "fog:changed", { fogEnabled: enc.fogEnabled, revealedCells: revealed });
}

/** Reveal everything or hide everything. */
export async function setAllCells(encounterId: string, revealAll: boolean) {
  const enc = await prisma.encounter.findUnique({ where: { id: encounterId }, include: { map: true } });
  if (!enc) return;
  let revealed = "[]";
  if (revealAll && enc.map) {
    const all: string[] = [];
    for (let x = 0; x < enc.map.gridCols; x++) for (let y = 0; y < enc.map.gridRows; y++) all.push(`${x},${y}`);
    revealed = JSON.stringify(all);
  }
  await prisma.encounter.update({ where: { id: encounterId }, data: { revealedCells: revealed } });
  emitToEncounter(encounterId, "fog:changed", { fogEnabled: enc.fogEnabled, revealedCells: revealed });
}

/**
 * Apply damage to a combatant (temp HP absorbs first) and log an undoable
 * entry: detailJson carries {kind:"damage", combatantId, hpBefore, hpAfter,
 * tempBefore, tempAfter, amount} so undoLastDamage can reverse it.
 */
export async function damageCombatant(
  encounterId: string, combatantId: string, amount: number, label?: string, breakdown?: string,
) {
  const c = await prisma.combatant.findFirst({ where: { id: combatantId, encounterId } });
  if (!c) throw new Error("combatant not in this encounter");
  if (amount <= 0) return { currentHp: c.currentHp, tempHp: c.tempHp };
  const after = applyDamage(c.currentHp, c.tempHp, amount);
  await updateCombatant(encounterId, combatantId, { currentHp: after.currentHp, tempHp: after.tempHp });
  await log(
    encounterId, "DM",
    `${c.name} takes ${amount} damage${label ? ` from ${label}` : ""}${breakdown ? ` (${breakdown})` : ""}${after.dropped ? " and drops to 0 HP!" : ""}`,
    { kind: "damage", combatantId, hpBefore: c.currentHp, hpAfter: after.currentHp, tempBefore: c.tempHp, tempAfter: after.tempHp, amount },
  );
  return { currentHp: after.currentHp, tempHp: after.tempHp };
}

/** Heal a combatant (clamped to max HP) with an undoable log entry. */
export async function healCombatant(encounterId: string, combatantId: string, amount: number) {
  const c = await prisma.combatant.findFirst({ where: { id: combatantId, encounterId } });
  if (!c) throw new Error("combatant not in this encounter");
  const hpAfter = Math.min(c.maxHp, c.currentHp + Math.max(0, amount));
  const healed = hpAfter - c.currentHp;
  if (healed <= 0) return { currentHp: c.currentHp, tempHp: c.tempHp };
  await updateCombatant(encounterId, combatantId, { currentHp: hpAfter });
  await log(encounterId, "DM", `${c.name} regains ${healed} HP`, {
    kind: "heal", combatantId, hpBefore: c.currentHp, hpAfter, tempBefore: c.tempHp, tempAfter: c.tempHp, amount: healed,
  });
  return { currentHp: hpAfter, tempHp: c.tempHp };
}

/**
 * Undo the most recent damage/healing log entry that is still reversible:
 * restores the combatant's HP/temp HP to the recorded pre-change values,
 * marks the entry as undone, and appends an "↩ Undid: ..." log line.
 * Returns null when there is nothing undoable.
 */
export async function undoLastDamage(encounterId: string) {
  const entries = await prisma.combatLog.findMany({
    where: { encounterId }, orderBy: [{ ts: "desc" }, { id: "desc" }], take: 200,
  });
  for (const e of entries) {
    let d: any = null;
    try { d = JSON.parse(e.detailJson || "null"); } catch { continue; }
    if (!d || (d.kind !== "damage" && d.kind !== "heal") || d.undone) continue;
    if (typeof d.hpBefore !== "number" || !d.combatantId) continue;
    // The combatant may have been removed since — skip to an older entry.
    const c = await prisma.combatant.findFirst({ where: { id: d.combatantId, encounterId } });
    if (!c) continue;
    await updateCombatant(encounterId, d.combatantId, {
      currentHp: d.hpBefore,
      ...(typeof d.tempBefore === "number" ? { tempHp: d.tempBefore } : {}),
    });
    await prisma.combatLog.update({
      where: { id: e.id }, data: { detailJson: JSON.stringify({ ...d, undone: true }) },
    });
    await log(encounterId, "DM", `↩ Undid: ${e.message}`, { kind: "undo", targetLogId: e.id });
    return { ok: true, undoneLogId: e.id, combatantId: d.combatantId, currentHp: d.hpBefore };
  }
  return null;
}

/** DM attacks: attacker combatant uses an action against target combatants. */
export async function attack(
  encounterId: string, attackerId: string, actionName: string, targetIds: string[],
  opts: { advantage?: boolean; disadvantage?: boolean } = {}
) {
  // Scope: attacker and all targets must belong to this encounter.
  const attacker = await prisma.combatant.findFirst({ where: { id: attackerId, encounterId } });
  if (!attacker) throw new Error("attacker not in this encounter");
  const actions = parseActions(safe(attacker.statBlockJson)?.actions ?? null);
  const action = actions.find((a) => a.name === actionName) ?? actions[0];
  if (!action) throw new Error("no action");

  const targets = await prisma.combatant.findMany({ where: { id: { in: targetIds }, encounterId } });
  const outcomes = [];
  for (const t of targets) {
    let dexMod = 0; try { dexMod = JSON.parse(t.statBlockJson || "{}").dexMod ?? 0; } catch {}
    const outcome = action.save
      ? resolveSaveAttack(action, { name: t.name, saveBonus: dexMod }, opts)
      : resolveAttackRoll(action, { name: t.name, ac: t.ac }, opts);
    let detail: any = { attacker: attacker.name, action: action.name };
    if (outcome.damage > 0) {
      const after = applyDamage(t.currentHp, t.tempHp, outcome.damage);
      await updateCombatant(encounterId, t.id, { currentHp: after.currentHp, tempHp: after.tempHp });
      // Undo payload: pre/post HP so undoLastDamage can reverse this hit.
      detail = {
        ...detail, kind: "damage", combatantId: t.id, amount: outcome.damage,
        hpBefore: t.currentHp, hpAfter: after.currentHp, tempBefore: t.tempHp, tempAfter: after.tempHp,
      };
    }
    await log(encounterId, attacker.name, outcome.message, detail);
    outcomes.push(outcome);
  }
  return { action: action.name, outcomes };
}

function safe(s: string | null) { try { return JSON.parse(s || "{}"); } catch { return {}; } }
