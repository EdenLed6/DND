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
