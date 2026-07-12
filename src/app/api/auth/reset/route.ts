import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { bad } from "@/lib/api";
import { limitOr429 } from "@/lib/rate-limit";
import { hashPassword, createSession } from "@/lib/auth/session";
import { consumeAuthToken } from "@/lib/auth/tokens";

const schema = z.object({ token: z.string().min(1), password: z.string().min(8).max(200) });

// POST /api/auth/reset — set a new password using a valid reset token.
export async function POST(req: Request) {
  const limited = limitOr429(req, "reset", 10, 15 * 60_000);
  if (limited) return limited;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return bad("Password must be at least 8 characters");

  const userId = await consumeAuthToken(parsed.data.token, "reset");
  if (!userId) return bad("This reset link is invalid or has expired", 400);

  await prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(parsed.data.password) } });
  // Invalidate all existing sessions (force re-login everywhere), then sign in.
  await prisma.session.deleteMany({ where: { userId } });
  await createSession(userId);
  return NextResponse.json({ ok: true });
}
