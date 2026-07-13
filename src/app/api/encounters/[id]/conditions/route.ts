// Conditions & Ongoing Effects API for a live encounter.
// GET  — list conditions (role-filtered: players see public-only, no hidden combatants).
// POST — DM-only ops: apply / update / remove / tick / damage / saveResult.
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, bad } from "@/lib/api";
import { roleInCampaign } from "@/lib/auth/rbac";
import { emitToEncounter } from "@/lib/realtime/io";
import { logEvent } from "@/lib/combat-service";
import * as combat from "@/lib/combat-service";
import { applyDamage } from "@/lib/dnd/combat";
import { findPreset, tickConditionsForTurn } from "@/lib/dnd/conditions";

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

  const conds = await prisma.appliedCondition.findMany({ where: { encounterId: id }, orderBy: { createdAt: "asc" } });
  if (role === "DM") return NextResponse.json(conds);
  // Players: public conditions only, and never those attached to hidden
  // combatants (same rule as filterStateForRole).
  const hidden = await prisma.combatant.findMany({ where: { encounterId: id, isVisible: false }, select: { id: true } });
  const hiddenIds = new Set(hidden.map((h) => h.id));
  return NextResponse.json(conds.filter((c) =>
    c.visibility === "public" && (!c.combatantId || !hiddenIds.has(c.combatantId))
  ));
}

const abilityEnum = z.enum(["str", "dex", "con", "int", "wis", "cha"]);

const applySchema = z.object({
  op: z.literal("apply"),
  combatantId: z.string().min(1),
  name: z.string().trim().min(1).max(60),
  icon: z.string().max(8).optional(),
  category: z.enum(["condition", "dot", "buff", "debuff", "injury", "exhaustion", "magic", "custom"]).optional(),
  severity: z.string().max(24).optional(),
  sourceText: z.string().max(120).optional(),
  durationRounds: z.number().int().min(0).max(100).optional(), // 0 / omitted = until removed
  saveAbility: abilityEnum.optional(),
  saveDc: z.number().int().min(1).max(30).optional(),
  stacks: z.number().int().min(1).max(20).optional(),
  visibility: z.enum(["public", "dm"]).optional(),
  notes: z.string().max(500).optional(),
});

const updateSchema = z.object({
  op: z.literal("update"),
  conditionId: z.string().min(1),
  patch: z.object({
    stacks: z.number().int().min(1).max(20).optional(),
    remainingRounds: z.number().int().min(0).max(100).nullable().optional(),
    visibility: z.enum(["public", "dm"]).optional(),
    notes: z.string().max(500).nullable().optional(),
  }),
});

const removeSchema = z.object({ op: z.literal("remove"), conditionId: z.string().min(1) });

const tickSchema = z.object({
  op: z.literal("tick"),
  combatantId: z.string().min(1),
  phase: z.enum(["start", "end"]),
});

// DM confirmed a damage prompt (dice already rolled client-side via @/lib/dnd/dice).
const damageSchema = z.object({
  op: z.literal("damage"),
  combatantId: z.string().min(1),
  amount: z.number().int().min(0).max(999),
  label: z.string().max(80),      // e.g. "Bleeding (fire)"
  breakdown: z.string().max(120).optional(), // e.g. "[3, 1] = 4"
});

// DM resolved an end-of-turn save prompt: passed → remove the condition.
const saveResultSchema = z.object({
  op: z.literal("saveResult"),
  conditionId: z.string().min(1),
  passed: z.boolean(),
});

function changed(encounterId: string, combatantId?: string | null) {
  emitToEncounter(encounterId, "combatant:changed", { encounterId, combatantId: combatantId ?? null });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, res } = await requireUser();
  if (!user) return res!;
  const campaignId = await encCampaign(id);
  if (!campaignId) return bad("Not found", 404);
  const role = await roleInCampaign(user.id, campaignId);
  if (!role) return bad("No access", 403);
  if (role !== "DM") return bad("DM only", 403); // all condition ops are DM-only

  const body = await req.json().catch(() => ({}));

  try {
    switch (body?.op) {
      case "apply": {
        const p = applySchema.parse(body);
        const combatant = await prisma.combatant.findFirst({ where: { id: p.combatantId, encounterId: id } });
        if (!combatant) return bad("Combatant not in this encounter");
        const preset = findPreset(p.name);
        const duration = p.durationRounds && p.durationRounds > 0 ? p.durationRounds : null;
        const cond = await prisma.appliedCondition.create({
          data: {
            encounterId: id,
            combatantId: combatant.id,
            characterId: combatant.characterId ?? null,
            name: preset?.name ?? p.name,
            icon: p.icon ?? preset?.icon ?? "✱",
            category: p.category ?? preset?.category ?? "custom",
            severity: p.severity ?? preset?.severity ?? null,
            sourceText: p.sourceText ?? null,
            durationRounds: duration,
            remainingRounds: duration,
            saveAbility: p.saveAbility ?? null,
            saveDc: p.saveDc ?? null,
            stacks: Math.min(p.stacks ?? 1, preset?.maxStacks ?? 20),
            visibility: p.visibility ?? "public",
            automationJson: JSON.stringify(preset?.automation ?? {}),
            notes: p.notes ?? null,
          },
        });
        if (cond.visibility === "public") {
          await logEvent(id, "DM", `${combatant.name} is now ${cond.name}${cond.stacks > 1 ? ` ×${cond.stacks}` : ""}${cond.saveAbility ? ` (${cond.saveAbility.toUpperCase()} ${cond.saveDc} to end)` : ""}`);
        }
        changed(id, combatant.id);
        return NextResponse.json(cond);
      }

      case "update": {
        const p = updateSchema.parse(body);
        const existing = await prisma.appliedCondition.findFirst({ where: { id: p.conditionId, encounterId: id } });
        if (!existing) return bad("Condition not in this encounter");
        const data: any = {};
        for (const k of ["stacks", "remainingRounds", "visibility", "notes"] as const) {
          if (k in p.patch) data[k] = p.patch[k];
        }
        const cond = await prisma.appliedCondition.update({ where: { id: existing.id }, data });
        changed(id, existing.combatantId);
        return NextResponse.json(cond);
      }

      case "remove": {
        const p = removeSchema.parse(body);
        const existing = await prisma.appliedCondition.findFirst({ where: { id: p.conditionId, encounterId: id } });
        if (!existing) return bad("Condition not in this encounter");
        await prisma.appliedCondition.delete({ where: { id: existing.id } });
        if (existing.visibility === "public" && existing.combatantId) {
          const cb = await prisma.combatant.findUnique({ where: { id: existing.combatantId } });
          await logEvent(id, "DM", `${existing.name} removed from ${cb?.name ?? "combatant"}`);
        }
        changed(id, existing.combatantId);
        return NextResponse.json({ ok: true });
      }

      case "tick": {
        const p = tickSchema.parse(body);
        const combatant = await prisma.combatant.findFirst({ where: { id: p.combatantId, encounterId: id } });
        if (!combatant) return bad("Combatant not in this encounter");
        const conds = await prisma.appliedCondition.findMany({ where: { encounterId: id, combatantId: combatant.id } });
        const tick = tickConditionsForTurn(conds, p.phase);
        // Persist decrements + expirations; return prompts for the DM to confirm
        // (damage is never auto-applied — prompt-based automation per spec).
        for (const u of tick.updated) {
          await prisma.appliedCondition.update({ where: { id: u.id }, data: { remainingRounds: u.remainingRounds } });
        }
        if (tick.expired.length) {
          const gone = conds.filter((c) => tick.expired.includes(c.id));
          await prisma.appliedCondition.deleteMany({ where: { id: { in: tick.expired } } });
          for (const g of gone) {
            if (g.visibility === "public") await logEvent(id, "DM", `${g.name} on ${combatant.name} has expired`);
          }
        }
        if (tick.updated.length || tick.expired.length) changed(id, combatant.id);
        const iconOf = (condId: string) => conds.find((c) => c.id === condId)?.icon ?? "✱";
        return NextResponse.json({
          expired: tick.expired,
          prompts: [
            ...tick.damagePrompts.map((d) => ({ kind: "damage" as const, icon: iconOf(d.conditionId), targetName: combatant.name, ...d })),
            ...tick.savePrompts.map((s) => ({ kind: "save" as const, icon: iconOf(s.conditionId), targetName: combatant.name, ...s })),
          ],
        });
      }

      case "damage": {
        const p = damageSchema.parse(body);
        const combatant = await prisma.combatant.findFirst({ where: { id: p.combatantId, encounterId: id } });
        if (!combatant) return bad("Combatant not in this encounter");
        const after = applyDamage(combatant.currentHp, combatant.tempHp, p.amount);
        await combat.updateCombatant(id, combatant.id, { currentHp: after.currentHp, tempHp: after.tempHp });
        await logEvent(id, "DM", `${combatant.name} takes ${p.amount} damage from ${p.label}${p.breakdown ? ` (${p.breakdown})` : ""}`);
        return NextResponse.json({ ok: true, currentHp: after.currentHp, tempHp: after.tempHp });
      }

      case "saveResult": {
        const p = saveResultSchema.parse(body);
        const existing = await prisma.appliedCondition.findFirst({ where: { id: p.conditionId, encounterId: id } });
        if (!existing) return bad("Condition not in this encounter");
        const cb = existing.combatantId ? await prisma.combatant.findUnique({ where: { id: existing.combatantId } }) : null;
        const saveTxt = existing.saveAbility ? `${existing.saveAbility.toUpperCase()} ${existing.saveDc}` : "save";
        if (p.passed) {
          await prisma.appliedCondition.delete({ where: { id: existing.id } });
          await logEvent(id, "DM", `${cb?.name ?? "Combatant"} passed the ${saveTxt} save — ${existing.name} ends`);
          changed(id, existing.combatantId);
        } else {
          await logEvent(id, "DM", `${cb?.name ?? "Combatant"} failed the ${saveTxt} save — ${existing.name} persists`);
        }
        return NextResponse.json({ ok: true, removed: p.passed });
      }

      default:
        return bad("Unknown op: " + body?.op);
    }
  } catch (e: any) {
    if (e instanceof z.ZodError) return bad("Invalid input", 400);
    console.error(`[encounter ${id}] conditions op ${body?.op} failed:`, e?.message ?? e);
    return bad("Operation could not be completed", 400);
  }
}
