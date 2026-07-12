import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";

export type TokenType = "verify" | "reset";

/** Create a single-use, high-entropy token of a given type. */
export async function createAuthToken(userId: string, type: TokenType, ttlMs: number): Promise<string> {
  // Invalidate previous tokens of the same type for this user.
  await prisma.authToken.deleteMany({ where: { userId, type } });
  const token = randomBytes(32).toString("base64url");
  await prisma.authToken.create({ data: { token, type, userId, expiresAt: new Date(Date.now() + ttlMs) } });
  return token;
}

/** Validate + consume a token. Returns userId if valid, else null. */
export async function consumeAuthToken(token: string, type: TokenType): Promise<string | null> {
  const row = await prisma.authToken.findUnique({ where: { token } });
  if (!row || row.type !== type || row.expiresAt < new Date()) return null;
  await prisma.authToken.delete({ where: { id: row.id } });
  return row.userId;
}
