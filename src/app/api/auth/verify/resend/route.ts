import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, bad, baseUrl } from "@/lib/api";
import { limitOr429 } from "@/lib/rate-limit";
import { createAuthToken } from "@/lib/auth/tokens";
import { sendEmail, verificationEmail } from "@/lib/email/mailer";

// POST /api/auth/verify/resend — resend the verification email to the logged-in user.
export async function POST(req: Request) {
  const limited = limitOr429(req, "verify-resend", 5, 15 * 60_000);
  if (limited) return limited;
  const { user, res } = await requireUser();
  if (!user) return res!;
  const full = await prisma.user.findUnique({ where: { id: user.id } });
  if (!full) return bad("Not found", 404);
  if (full.emailVerified) return NextResponse.json({ ok: true, alreadyVerified: true });

  const token = await createAuthToken(full.id, "verify", 24 * 60 * 60_000);
  const url = `${baseUrl(req)}/api/auth/verify?token=${token}`;
  const { ok } = await sendEmail({ to: full.email, ...verificationEmail(url) });
  return NextResponse.json({ ok });
}
