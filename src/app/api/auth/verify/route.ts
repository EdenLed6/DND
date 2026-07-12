import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { baseUrl } from "@/lib/api";
import { consumeAuthToken } from "@/lib/auth/tokens";

// GET /api/auth/verify?token=... — verify an email address, then redirect.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token") ?? "";
  const userId = await consumeAuthToken(token, "verify");
  if (!userId) return NextResponse.redirect(`${baseUrl(req)}/dashboard?verified=invalid`);
  await prisma.user.update({ where: { id: userId }, data: { emailVerified: new Date() } });
  return NextResponse.redirect(`${baseUrl(req)}/dashboard?verified=1`);
}
