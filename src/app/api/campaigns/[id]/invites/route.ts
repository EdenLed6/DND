// Email invitations (DM only). Joining requires BOTH a pending invite for the
// user's verified email AND the campaign invite code — two independent layers.
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, bad, baseUrl } from "@/lib/api";
import { isDM } from "@/lib/auth/rbac";
import { limitOr429 } from "@/lib/rate-limit";
import { sendEmail, inviteEmail } from "@/lib/email/mailer";
import { logAudit } from "@/lib/audit";

const INVITE_TTL_DAYS = 14;

const createSchema = z.object({ email: z.string().trim().toLowerCase().email().max(254) });
const revokeSchema = z.object({ inviteId: z.string().min(1).max(64) });

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, res } = await requireUser();
  if (!user) return res!;
  if (!(await isDM(user.id, id))) return bad("Forbidden", 403);

  const invites = await prisma.campaignInvite.findMany({
    where: { campaignId: id },
    orderBy: { createdAt: "desc" },
    select: { id: true, email: true, status: true, expiresAt: true, createdAt: true },
  });
  return NextResponse.json({ invites });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, res } = await requireUser();
  if (!user) return res!;
  if (!(await isDM(user.id, id))) return bad("Forbidden", 403);

  // Sending email on behalf of the app — keep it un-spammable.
  const limited = limitOr429(req, "invite-send", 20, 60 * 60 * 1000);
  if (limited) return limited;

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return bad("Invalid email address");
  const email = parsed.data.email;

  const campaign = await prisma.campaign.findUnique({ where: { id } });
  if (!campaign) return bad("Campaign not found", 404);

  // Already a member? (invitee may not have an account yet — that's fine)
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    const member = await prisma.campaignMember.findUnique({
      where: { campaignId_userId: { campaignId: id, userId: existingUser.id } },
    });
    if (member || campaign.dmId === existingUser.id) return bad("This person is already a member of the campaign");
  }

  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
  const invite = await prisma.campaignInvite.upsert({
    where: { campaignId_email: { campaignId: id, email } },
    update: { status: "pending", expiresAt, invitedBy: user.id },
    create: { campaignId: id, email, invitedBy: user.id, expiresAt },
  });

  const joinUrl = `${baseUrl(req)}/dashboard?join=${encodeURIComponent(campaign.inviteCode)}`;
  const mail = inviteEmail(campaign.name, user.displayName, campaign.inviteCode, joinUrl);
  const sent = await sendEmail({ to: email, ...mail });

  logAudit(id, user.id, "invite:sent", email);
  return NextResponse.json({
    invite: { id: invite.id, email: invite.email, status: invite.status, expiresAt: invite.expiresAt },
    emailSent: sent.ok,
  });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, res } = await requireUser();
  if (!user) return res!;
  if (!(await isDM(user.id, id))) return bad("Forbidden", 403);

  const parsed = revokeSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return bad("Invalid input");

  const invite = await prisma.campaignInvite.findUnique({ where: { id: parsed.data.inviteId } });
  if (!invite || invite.campaignId !== id) return bad("Invite not found", 404);

  await prisma.campaignInvite.update({ where: { id: invite.id }, data: { status: "revoked" } });
  logAudit(id, user.id, "invite:revoked", invite.email);
  return NextResponse.json({ ok: true });
}
