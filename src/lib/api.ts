import { NextResponse } from "next/server";
import { randomInt } from "node:crypto";
import { getCurrentUser } from "@/lib/auth/session";

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) return { user: null, res: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  return { user, res: null as NextResponse | null };
}

export function genInviteCode(): string {
  // Cryptographically-random (not Math.random) so codes can't be predicted from
  // observed outputs. 8 chars over a 32-symbol alphabet ≈ 40 bits.
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 8; i++) s += chars[randomInt(chars.length)];
  return s;
}

export function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

/**
 * Absolute base URL for building links in emails/OAuth redirects.
 * Security: in production we NEVER trust the request Host header (it is
 * attacker-controllable and would allow reset-link host-header injection).
 * APP_URL is required in production; the Host fallback is dev-only.
 */
export function baseUrl(req: Request): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (process.env.NODE_ENV === "production") {
    throw new Error("APP_URL environment variable must be set in production (see .env.example).");
  }
  const proto = req.headers.get("x-forwarded-proto") ?? "http";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

/**
 * Sanitize a user-supplied image URL. Allows only http(s) URLs and site-relative
 * paths (e.g. /uploads/...). Rejects javascript:, data:, and other schemes to
 * prevent them being rendered as <img src>. Returns null if invalid/empty.
 */
export function safeImageUrl(url: unknown): string | null {
  if (typeof url !== "string") return null;
  const v = url.trim();
  if (!v) return null;
  if (v.startsWith("/")) return v.length <= 2000 ? v : null;
  try {
    const u = new URL(v);
    if ((u.protocol === "http:" || u.protocol === "https:") && v.length <= 2000) return v;
  } catch {}
  return null;
}
