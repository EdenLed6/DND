// Lightweight in-memory rate limiter (fixed window). Per-process — fine for a
// single instance. For multi-instance scale, back this with Redis.
import { NextResponse } from "next/server";

interface Bucket { count: number; resetAt: number; }
const buckets = new Map<string, Bucket>();

// Periodic cleanup to bound memory.
let lastSweep = 0;
function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
}

export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/** Returns { ok, retryAfter } for `key`, allowing `limit` hits per `windowMs`. */
export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  sweep(now);
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }
  b.count++;
  if (b.count > limit) return { ok: false, retryAfter: Math.ceil((b.resetAt - now) / 1000) };
  return { ok: true, retryAfter: 0 };
}

/** Convenience guard for API route handlers. Returns a 429 response if limited, else null. */
export function limitOr429(req: Request, name: string, limit: number, windowMs: number): NextResponse | null {
  const { ok, retryAfter } = rateLimit(`${name}:${clientIp(req)}`, limit, windowMs);
  if (ok) return null;
  return NextResponse.json(
    { error: "Too many requests. Please try again later." },
    { status: 429, headers: { "Retry-After": String(retryAfter) } },
  );
}
