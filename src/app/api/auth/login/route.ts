import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyPassword, createSession } from "@/lib/auth/session";
import { limitOr429 } from "@/lib/rate-limit";

const schema = z.object({ email: z.string().email(), password: z.string().min(1) });

// bcrypt hash of a random constant — used to equalize timing for unknown emails.
const DUMMY_HASH = "$2a$10$DYhjyWkl/fvs0xMSiOOuru11grjZmMT.bh7g.ctknSIo0KfHgliqm";

export async function POST(req: Request) {
  const limited = limitOr429(req, "login", 10, 5 * 60_000); // 10 tries / 5 min / IP
  if (limited) return limited;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  // Always run one bcrypt comparison so response time doesn't reveal whether the
  // account exists (or is Google-only). DUMMY_HASH is a valid bcrypt hash of a
  // random string; it never matches.
  const hashToCheck = user?.passwordHash ?? DUMMY_HASH;
  const passwordOk = await verifyPassword(password, hashToCheck);
  // Google-only accounts have no passwordHash — reject password login for them.
  if (!user || !user.passwordHash || !passwordOk)
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });

  await createSession(user.id);
  return NextResponse.json({ id: user.id, displayName: user.displayName, email: user.email });
}
