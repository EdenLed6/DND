// Join a campaign — TWO independent layers are required:
//   1. a pending, unexpired email invitation for the user's (verified) email
//   2. the campaign invite code
// The code alone is not enough; the invite alone is not enough.
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, bad } from "@/lib/api";
import { limitOr429 } from "@/lib/rate-limit";
import { emitToCampaign } from "@/lib/realtime/io";
import { logAudit } from "@/lib/audit";

const schema = z.object({ code: z.string().min(1).max(12) });

export async function POST(req: Request) {
  const { user, res } = await requireUser();
  if (!user) return res!;

  // Brute-force guard on invite codes.
  const limited = limitOr429(req, "campaign-join", 10, 15 * 60 * 1000);
  if (limited) return limited;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return bad("Invalid input");

  const campaign = await prisma.campaign.findUnique({ where: { inviteCode: parsed.data.code.toUpperCase() } });
  // Layer 2 first (code), but respond identically for "bad code" and "no invite"
  // so the endpoint doesn't confirm which codes exist.
  const denied = () => bad("No matching invitation. Check the code, and make sure your DM invited this email address.", 404);
  if (!campaign) return denied();
  if (campaign.dmId === user.id) return NextResponse.json(campaign); // DM already

  const existing = await prisma.campaignMember.findUnique({
    where: { campaignId_userId: { campaignId: campaign.id, userId: user.id } },
  });
  if (existing) return NextResponse.json(campaign); // already a member

  // Layer 1: a pending email invitation for this exact (verified) address.
  const email = user.email.toLowerCase();
  const invite = await prisma.campaignInvite.findUnique({
    where: { campaignId_email: { campaignId: campaign.id, email } },
  });
  if (!invite || invite.status !== "pending" || invite.expiresAt < new Date()) return denied();

  // The invite was sent to an email address — make sure this account actually
  // controls it before honoring the invitation.
  if (!user.emailVerified) {
    return bad("Please verify your email address first — the invitation is tied to it. Check your inbox for the verification link.", 403);
  }

  await prisma.$transaction([
    prisma.campaignMember.create({ data: { campaignId: campaign.id, userId: user.id, role: "PLAYER" } }),
    prisma.campaignInvite.update({ where: { id: invite.id }, data: { status: "accepted" } }),
  ]);
  logAudit(campaign.id, user.id, "member:joined", user.email);
  emitToCampaign(campaign.id, "member:joined", { userId: user.id, displayName: user.displayName });
  return NextResponse.json(campaign);
}
