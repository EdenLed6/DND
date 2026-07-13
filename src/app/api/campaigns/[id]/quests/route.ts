import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, bad } from "@/lib/api";
import { roleInCampaign } from "@/lib/auth/rbac";
import { limitOr429 } from "@/lib/rate-limit";
import { emitToCampaign } from "@/lib/realtime/io";

// Quests (SPEC-DM §10). DM sees everything; players see only non-HIDDEN quests
// and never dmNotes (stripped server-side via Prisma select).

const STATUSES = ["ACTIVE", "DONE", "FAILED", "HIDDEN"] as const;

const stepsSchema = z
  .array(z.object({ text: z.string().max(300), done: z.boolean() }))
  .max(30);

const text = z.string().max(8000);
const fieldsSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  status: z.enum(STATUSES).optional(),
  giver: z.string().max(200).nullish(),
  objective: text.nullish(),
  steps: stepsSchema.optional(),
  rewards: text.nullish(),
  playerText: text.nullish(),
  dmNotes: text.nullish(),
});

const opSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("create") }).merge(fieldsSchema),
  z.object({ op: z.literal("update"), questId: z.string(), patch: fieldsSchema.partial() }),
  z.object({ op: z.literal("delete"), questId: z.string() }),
  z.object({ op: z.literal("setStatus"), questId: z.string(), status: z.enum(STATUSES) }),
]);

// Player-safe projection: dmNotes is never selected.
const PLAYER_SELECT = {
  id: true, campaignId: true, name: true, status: true, giver: true,
  objective: true, stepsJson: true, rewards: true, playerText: true,
  createdAt: true, updatedAt: true,
} as const;

function toDbFields<T extends Partial<z.infer<typeof fieldsSchema>>>(f: T) {
  const { steps, ...rest } = f;
  const out: Record<string, unknown> = { ...rest };
  if (steps !== undefined) out.stepsJson = JSON.stringify(steps);
  return out;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: campaignId } = await params;
  const { user, res } = await requireUser();
  if (!user) return res!;
  const role = await roleInCampaign(user.id, campaignId);
  if (!role) return bad("Not a member of this campaign", 403);

  if (role === "DM") {
    const quests = await prisma.quest.findMany({ where: { campaignId }, orderBy: { createdAt: "asc" } });
    return NextResponse.json({ quests });
  }
  const quests = await prisma.quest.findMany({
    where: { campaignId, status: { not: "HIDDEN" } },
    select: PLAYER_SELECT,
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ quests });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: campaignId } = await params;
  const limited = limitOr429(req, "quests", 60, 60_000);
  if (limited) return limited;
  const { user, res } = await requireUser();
  if (!user) return res!;
  if ((await roleInCampaign(user.id, campaignId)) !== "DM") return bad("DM only", 403);

  const parsed = opSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return bad(parsed.error.issues[0]?.message ?? "Invalid input");
  const data = parsed.data;

  switch (data.op) {
    case "create": {
      const { op: _op, ...fields } = data;
      const quest = await prisma.quest.create({
        data: { campaignId, ...toDbFields(fields), name: fields.name } as any,
      });
      emitToCampaign(campaignId, "world:changed", { kind: "quest", id: quest.id });
      return NextResponse.json({ quest });
    }
    case "update": {
      const existing = await prisma.quest.findFirst({ where: { id: data.questId, campaignId } });
      if (!existing) return bad("Quest not found", 404);
      const quest = await prisma.quest.update({
        where: { id: existing.id },
        data: toDbFields(data.patch) as any,
      });
      emitToCampaign(campaignId, "world:changed", { kind: "quest", id: quest.id });
      return NextResponse.json({ quest });
    }
    case "delete": {
      await prisma.quest.deleteMany({ where: { id: data.questId, campaignId } });
      emitToCampaign(campaignId, "world:changed", { kind: "quest", id: data.questId });
      return NextResponse.json({ ok: true });
    }
    case "setStatus": {
      const existing = await prisma.quest.findFirst({ where: { id: data.questId, campaignId } });
      if (!existing) return bad("Quest not found", 404);
      const quest = await prisma.quest.update({ where: { id: existing.id }, data: { status: data.status } });
      emitToCampaign(campaignId, "world:changed", { kind: "quest", id: quest.id });
      return NextResponse.json({ quest });
    }
  }
}
