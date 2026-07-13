import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, bad, safeImageUrl } from "@/lib/api";
import { roleInCampaign } from "@/lib/auth/rbac";
import { limitOr429 } from "@/lib/rate-limit";
import { emitToCampaign } from "@/lib/realtime/io";

// NPCs (SPEC-DM §10). DM sees everything; players see only revealed NPCs and
// never secretDesc/statBlockJson (stripped server-side via Prisma select).

const ATTITUDES = ["friendly", "neutral", "hostile", "unknown"] as const;

const text = z.string().max(8000);
const fieldsSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  role: z.string().max(200).nullish(),
  location: z.string().max(200).nullish(),
  faction: z.string().max(200).nullish(),
  attitude: z.enum(ATTITUDES).nullish(),
  portraitUrl: z.string().max(2000).nullish(),
  publicDesc: text.nullish(),
  secretDesc: text.nullish(),
  statBlockJson: text.nullish(),
  status: z.string().max(80).nullish(),
  revealed: z.boolean().optional(),
});

const opSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("create") }).merge(fieldsSchema),
  z.object({ op: z.literal("update"), npcId: z.string(), patch: fieldsSchema.partial() }),
  z.object({ op: z.literal("delete"), npcId: z.string() }),
  z.object({ op: z.literal("reveal"), npcId: z.string(), revealed: z.boolean() }),
]);

// Player-safe projection: secretDesc/statBlockJson are never selected, so they
// cannot leak through serialization.
const PLAYER_SELECT = {
  id: true, campaignId: true, name: true, role: true, location: true,
  faction: true, attitude: true, portraitUrl: true, publicDesc: true,
  status: true, revealed: true, createdAt: true, updatedAt: true,
} as const;

function cleanFields<T extends Partial<z.infer<typeof fieldsSchema>>>(f: T) {
  const out: Record<string, unknown> = { ...f };
  if ("portraitUrl" in f) out.portraitUrl = safeImageUrl(f.portraitUrl);
  return out;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: campaignId } = await params;
  const { user, res } = await requireUser();
  if (!user) return res!;
  const role = await roleInCampaign(user.id, campaignId);
  if (!role) return bad("Not a member of this campaign", 403);

  if (role === "DM") {
    const npcs = await prisma.npc.findMany({ where: { campaignId }, orderBy: { createdAt: "asc" } });
    return NextResponse.json({ npcs });
  }
  const npcs = await prisma.npc.findMany({
    where: { campaignId, revealed: true },
    select: PLAYER_SELECT,
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ npcs });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: campaignId } = await params;
  const limited = limitOr429(req, "npcs", 60, 60_000);
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
      const npc = await prisma.npc.create({
        data: { campaignId, ...cleanFields(fields), name: fields.name } as any,
      });
      emitToCampaign(campaignId, "world:changed", { kind: "npc", id: npc.id });
      return NextResponse.json({ npc });
    }
    case "update": {
      const existing = await prisma.npc.findFirst({ where: { id: data.npcId, campaignId } });
      if (!existing) return bad("NPC not found", 404);
      const npc = await prisma.npc.update({
        where: { id: existing.id },
        data: cleanFields(data.patch) as any,
      });
      emitToCampaign(campaignId, "world:changed", { kind: "npc", id: npc.id });
      return NextResponse.json({ npc });
    }
    case "delete": {
      await prisma.npc.deleteMany({ where: { id: data.npcId, campaignId } });
      emitToCampaign(campaignId, "world:changed", { kind: "npc", id: data.npcId });
      return NextResponse.json({ ok: true });
    }
    case "reveal": {
      const existing = await prisma.npc.findFirst({ where: { id: data.npcId, campaignId } });
      if (!existing) return bad("NPC not found", 404);
      const npc = await prisma.npc.update({ where: { id: existing.id }, data: { revealed: data.revealed } });
      emitToCampaign(campaignId, "world:changed", { kind: "npc", id: npc.id });
      return NextResponse.json({ npc });
    }
  }
}
