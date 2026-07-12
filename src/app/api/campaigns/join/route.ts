import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, bad } from "@/lib/api";
import { emitToCampaign } from "@/lib/realtime/io";

const schema = z.object({ code: z.string().min(1).max(12) });

export async function POST(req: Request) {
  const { user, res } = await requireUser();
  if (!user) return res!;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return bad("Invalid input");

  const campaign = await prisma.campaign.findUnique({ where: { inviteCode: parsed.data.code.toUpperCase() } });
  if (!campaign) return bad("Invite code not found", 404);
  if (campaign.dmId === user.id) return NextResponse.json(campaign); // DM already

  await prisma.campaignMember.upsert({
    where: { campaignId_userId: { campaignId: campaign.id, userId: user.id } },
    update: {},
    create: { campaignId: campaign.id, userId: user.id, role: "PLAYER" },
  });
  emitToCampaign(campaign.id, "member:joined", { userId: user.id, displayName: user.displayName });
  return NextResponse.json(campaign);
}
