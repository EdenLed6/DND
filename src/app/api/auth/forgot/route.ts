import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { bad, baseUrl } from "@/lib/api";
import { limitOr429 } from "@/lib/rate-limit";
import { createAuthToken } from "@/lib/auth/tokens";
import { sendEmail, resetEmail } from "@/lib/email/mailer";

const schema = z.object({ email: z.string().email() });

// POST /api/auth/forgot — always returns a generic success (no user enumeration).
export async function POST(req: Request) {
  const limited = limitOr429(req, "forgot", 5, 15 * 60_000);
  if (limited) return limited;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return bad("Invalid input");

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  // Only send if the account exists AND has a password (Google-only accounts can't reset).
  if (user?.passwordHash) {
    const token = await createAuthToken(user.id, "reset", 60 * 60_000); // 1 hour
    const url = `${baseUrl(req)}/reset?token=${token}`;
    await sendEmail({ to: user.email, ...resetEmail(url) });
  }
  // Generic response regardless of whether the email exists.
  return NextResponse.json({ ok: true });
}
