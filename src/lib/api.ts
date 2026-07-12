import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) return { user: null, res: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  return { user, res: null as NextResponse | null };
}

export function genInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

/** Absolute base URL for building links in emails/redirects. Prefers APP_URL. */
export function baseUrl(req: Request): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const proto = req.headers.get("x-forwarded-proto") ?? "http";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}
