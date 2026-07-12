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

// Determine the client IP for rate limiting, resistant to header spoofing.
// A client can only prepend to X-Forwarded-For; the trusted proxy APPENDS the
// real connecting IP, so we take the RIGHTMOST entry (nearest trusted hop),
// not the leftmost (client-controlled). Cloudflare/nginx set dedicated headers
// which we prefer. Behind a trusted proxy this cannot be spoofed by the client.
export function clientIp(req: Request): string {
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1]; // rightmost = added by trusted proxy
  }
  return "unknown";
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
