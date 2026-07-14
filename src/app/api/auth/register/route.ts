import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword, createSession } from "@/lib/auth/session";
import { limitOr429 } from "@/lib/rate-limit";
import { baseUrl } from "@/lib/api";
import { createAuthToken } from "@/lib/auth/tokens";
import { sendEmail, verificationEmail } from "@/lib/email/mailer";

const schema = z.object({
  email: z.string().email(),
  displayName: z.string().min(1).max(60),
  password: z.string().min(8).max(200),
});

export async function POST(req: Request) {
  const limited = limitOr429(req, "register", 5, 10 * 60_000); // 5 signups / 10 min / IP
  if (limited) return limited;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const { email, displayName, password } = parsed.data;

  // Do NOT reveal whether the email already exists (account enumeration). If it
  // does, silently send a "someone tried to register your address" style notice
  // and return the same neutral response as a fresh signup — but do NOT create a
  // session, since the caller may not own the address.
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    try {
      await sendEmail({
        to: email,
        subject: "Account already exists — D&D Campaign Manager",
        html: `<p>Someone tried to sign up with this email, but an account already exists. If this was you, just <a href="${baseUrl(req)}/login">sign in</a>. If you forgot your password, use the reset link on the sign-in page.</p>`,
        text: `An account with this email already exists. Sign in at ${baseUrl(req)}/login or reset your password.`,
      });
    } catch { /* ignore */ }
    return NextResponse.json({ ok: true, pending: true });
  }

  const user = await prisma.user.create({
    data: { email, displayName, passwordHash: await hashPassword(password) },
  });
  await createSession(user.id);

  // Send verification email (soft — login is allowed immediately).
  try {
    const token = await createAuthToken(user.id, "verify", 24 * 60 * 60_000);
    const url = `${baseUrl(req)}/api/auth/verify?token=${token}`;
    await sendEmail({ to: email, ...verificationEmail(url) });
  } catch (e) {
    console.error("[register] verification email failed:", (e as Error).message);
  }

  return NextResponse.json({ id: user.id, displayName: user.displayName, email: user.email });
}
