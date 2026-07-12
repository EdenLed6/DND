import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyPassword, createSession } from "@/lib/auth/session";
import { limitOr429 } from "@/lib/rate-limit";

const schema = z.object({ email: z.string().email(), password: z.string().min(1) });

export async function POST(req: Request) {
  const limited = limitOr429(req, "login", 10, 5 * 60_000); // 10 tries / 5 min / IP
  if (limited) return limited;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash)))
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });

  await createSession(user.id);
  return NextResponse.json({ id: user.id, displayName: user.displayName, email: user.email });
}
