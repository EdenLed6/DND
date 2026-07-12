import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

const COOKIE = "dnd_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 10);
}
export async function verifyPassword(pw: string, hash: string) {
  return bcrypt.compare(pw, hash);
}

export async function createSession(userId: string) {
  const expiresAt = new Date(Date.now() + MAX_AGE * 1000);
  const session = await prisma.session.create({ data: { userId, expiresAt } });
  const store = await cookies();
  store.set(COOKIE, session.id, {
    httpOnly: true, sameSite: "lax", path: "/",
    maxAge: MAX_AGE, secure: process.env.NODE_ENV === "production",
  });
  return session;
}

export async function destroySession() {
  const store = await cookies();
  const id = store.get(COOKIE)?.value;
  if (id) await prisma.session.delete({ where: { id } }).catch(() => {});
  store.delete(COOKIE);
}

export async function getCurrentUser() {
  const store = await cookies();
  const id = store.get(COOKIE)?.value;
  if (!id) return null;
  const session = await prisma.session.findUnique({ where: { id }, include: { user: true } });
  if (!session || session.expiresAt < new Date()) return null;
  const { passwordHash, ...user } = session.user;
  return user;
}

/** Read the session id from a raw cookie header (used by the socket server). */
export function parseSessionCookie(cookieHeader?: string): string | null {
  if (!cookieHeader) return null;
  const m = cookieHeader.match(new RegExp(`${COOKIE}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : null;
}

export async function userFromSessionId(id: string | null) {
  if (!id) return null;
  const session = await prisma.session.findUnique({ where: { id }, include: { user: true } });
  if (!session || session.expiresAt < new Date()) return null;
  return session.user;
}
