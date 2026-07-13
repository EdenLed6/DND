import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, bad, safeImageUrl } from "@/lib/api";
import { isDM, roleInCampaign } from "@/lib/auth/rbac";
import * as combat from "@/lib/combat-service";

async function encCampaign(encounterId: string) {
  const enc = await prisma.encounter.findUnique({ where: { id: encounterId } });
  return enc?.campaignId ?? null;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, res } = await requireUser();
  if (!user) return res!;
  const campaignId = await encCampaign(id);
  const role = campaignId ? await roleInCampaign(user.id, campaignId) : null;
  if (!campaignId || !role) return bad("No access", 403);
  const state = combat.filterStateForRole(await combat.encounterState(id), role === "DM");
  return NextResponse.json(state);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, res } = await requireUser();
  if (!user) return res!;
  const campaignId = await encCampaign(id);
  if (!campaignId) return bad("Not found", 404);
  const role = await roleInCampaign(user.id, campaignId);
  if (!role) return bad("No access", 403);
  const dm = role === "DM";

  const body = await req.json().catch(() => ({}));
  const op = body.op as string;

  // Players may only move their own token; everything else is DM-only.
  if (op === "moveToken") {
    const token = await prisma.token.findUnique({ where: { id: body.tokenId }, include: { character: true } });
    if (!token || token.encounterId !== id) return bad("Bad token");
    if (!dm && token.character?.ownerId !== user.id) return bad("Not your token", 403);
    const t = await combat.moveToken(id, body.tokenId, body.gridX, body.gridY);
    return NextResponse.json(t);
  }

  if (!dm) return bad("DM only", 403);

  try {
    switch (op) {
      case "addPlayers": await combat.addPlayers(id, body.characterIds ?? []); break;
      case "addMonster": await combat.addMonster(id, body.monsterId, body.count ?? 1, !!body.rollHp); break;
      case "rollInitiative": await combat.rollInitiativeAll(id); break;
      case "turn": await combat.turn(id, body.dir); break;
      case "updateCombatant": await combat.updateCombatant(id, body.combatantId, body.patch ?? {}); break;
      case "removeCombatant": await combat.removeCombatant(id, body.combatantId); break;
      case "updateToken": {
        const patch = { ...(body.patch ?? {}) };
        if ("imageUrl" in patch) patch.imageUrl = patch.imageUrl ? safeImageUrl(patch.imageUrl) : null;
        await combat.updateToken(id, body.tokenId, patch); break;
      }
      case "setFog": await combat.setFog(id, !!body.enabled); break;
      case "revealCells": await combat.revealCells(id, body.cells ?? [], body.reveal !== false); break;
      case "setAllCells": await combat.setAllCells(id, !!body.revealAll); break;
      case "setMap": {
        await prisma.encounter.update({ where: { id }, data: { mapId: body.mapId ?? null } });
        break;
      }
      case "start": {
        await prisma.encounter.update({ where: { id }, data: { status: "ACTIVE" } });
        const c = await prisma.encounter.findUnique({ where: { id } });
        const { emitToCampaign } = await import("@/lib/realtime/io");
        emitToCampaign(campaignId, "encounter:started", { encounterId: id });
        return NextResponse.json(c);
      }
      case "damage": {
        const amount = Math.floor(Number(body.amount));
        if (!Number.isFinite(amount) || amount < 0 || amount > 999) return bad("Bad amount");
        const label = typeof body.label === "string" ? body.label.slice(0, 80) : undefined;
        const breakdown = typeof body.breakdown === "string" ? body.breakdown.slice(0, 120) : undefined;
        const r = await combat.damageCombatant(id, body.combatantId, amount, label, breakdown);
        return NextResponse.json(r);
      }
      case "heal": {
        const amount = Math.floor(Number(body.amount));
        if (!Number.isFinite(amount) || amount < 0 || amount > 999) return bad("Bad amount");
        const r = await combat.healCombatant(id, body.combatantId, amount);
        return NextResponse.json(r);
      }
      case "undoDamage": {
        const r = await combat.undoLastDamage(id);
        if (!r) return bad("Nothing to undo");
        return NextResponse.json(r);
      }
      case "attack": {
        const result = await combat.attack(id, body.attackerId, body.actionName, body.targetIds ?? [], {
          advantage: body.advantage, disadvantage: body.disadvantage,
        });
        return NextResponse.json(result);
      }
      default: return bad("Unknown op: " + op);
    }
  } catch (e: any) {
    console.error(`[encounter ${id}] op ${op} failed:`, e?.message ?? e);
    return bad("Operation could not be completed", 400);
  }
  return NextResponse.json({ ok: true });
}
