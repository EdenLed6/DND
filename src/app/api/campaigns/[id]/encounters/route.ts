import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, bad } from "@/lib/api";
import { isDM } from "@/lib/auth/rbac";
import { emitToCampaign } from "@/lib/realtime/io";

const schema = z.object({ name: z.string().min(1).max(80).default("Encounter"), mapId: z.string().optional() });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: campaignId } = await params;
  const { user, res } = await requireUser();
  if (!user) return res!;
  if (!(await isDM(user.id, campaignId))) return bad("רק ה-DM", 403);
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return bad("Invalid input");

  const enc = await prisma.encounter.create({
    data: { campaignId, name: parsed.data.name, mapId: parsed.data.mapId ?? null, status: "PLANNING" },
  });
  emitToCampaign(campaignId, "encounter:created", { id: enc.id, name: enc.name });
  return NextResponse.json(enc);
}
