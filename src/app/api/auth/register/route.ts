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

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return NextResponse.json({ error: "Email already registered" }, { status: 409 });

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
