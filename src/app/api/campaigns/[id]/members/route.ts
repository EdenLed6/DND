// Campaign access management: the DM can remove (kick) a member; a member can
// leave on their own. Removing a member detaches their characters from the
// campaign (characters are the player's property — they keep them).
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, bad } from "@/lib/api";
import { isDM } from "@/lib/auth/rbac";
import { emitToCampaign } from "@/lib/realtime/io";
import { logAudit } from "@/lib/audit";

const schema = z.object({ userId: z.string().max(64).optional() }); // omit = leave yourself

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, res } = await requireUser();
  if (!user) return res!;
  const me = await prisma.campaignMember.findUnique({ where: { campaignId_userId: { campaignId: id, userId: user.id } } });
  const dm = await isDM(user.id, id);
  if (!me && !dm) return bad("Not a member", 403);
  const members = await prisma.campaignMember.findMany({
    where: { campaignId: id },
    include: { user: { select: { id: true, displayName: true } } },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({
    members: members.map((m) => ({ userId: m.userId, name: m.user.displayName, role: m.role, joined: m.createdAt })),
  });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, res } = await requireUser();
  if (!user) return res!;
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return bad("Invalid input");

  const campaign = await prisma.campaign.findUnique({ where: { id } });
  if (!campaign) return bad("Not found", 404);
  const dm = campaign.dmId === user.id;
  const targetUserId = parsed.data.userId ?? user.id;

  // Only the DM may remove someone else; anyone may remove themself.
  if (targetUserId !== user.id && !dm) return bad("Only the DM can remove members", 403);
  // The DM can't leave their own campaign (transfer/delete instead).
  if (targetUserId === campaign.dmId) return bad("The DM cannot be removed. Delete the campaign instead.", 400);

  const member = await prisma.campaignMember.findUnique({
    where: { campaignId_userId: { campaignId: id, userId: targetUserId } },
  });
  if (!member) return bad("Not a member", 404);

  const target = await prisma.user.findUnique({ where: { id: targetUserId }, select: { email: true } });
  await prisma.$transaction([
    prisma.campaignMember.delete({ where: { id: member.id } }),
    // Their characters detach from the campaign but remain theirs.
    prisma.character.updateMany({ where: { campaignId: id, ownerId: targetUserId }, data: { campaignId: null } }),
    // Any pending invite for that user's email is revoked so they can't rejoin
    // without a fresh invitation.
    prisma.campaignInvite.updateMany({
      where: { campaignId: id, status: "pending", email: target?.email ?? "" },
      data: { status: "revoked" },
    }),
  ]);

  logAudit(id, user.id, targetUserId === user.id ? "member:left" : "member:removed", targetUserId);
  emitToCampaign(id, "member:left", { userId: targetUserId });
  return NextResponse.json({ ok: true });
}
