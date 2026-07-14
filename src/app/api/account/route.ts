// GDPR Art. 17 / Israeli PPL — right to erasure. Deletes the account and all
// personal data. Requires re-authentication (password) for password accounts.
import { NextResponse } from "next/server";
import { z } from "zod";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/db";
import { requireUser, bad } from "@/lib/api";
import { verifyPassword, destroySession } from "@/lib/auth/session";

const schema = z.object({ password: z.string().optional(), confirm: z.literal("DELETE") });

export async function DELETE(req: Request) {
  const { user, res } = await requireUser();
  if (!user) return res!;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return bad('Type DELETE to confirm.');

  const account = await prisma.user.findUnique({ where: { id: user.id } });
  if (!account) return bad("Account not found", 404);

  // Re-auth for password accounts. Google-only accounts rely on the active session.
  if (account.passwordHash) {
    if (!parsed.data.password || !(await verifyPassword(parsed.data.password, account.passwordHash))) {
      return bad("Incorrect password.", 403);
    }
  }

  // Collect uploaded map files for campaigns this user owns (as DM) so we can
  // remove the files from disk — deleting the DB row alone leaves orphaned PII.
  const ownedMaps = await prisma.gameMap.findMany({
    where: { campaign: { dmId: user.id } },
    select: { imageUrl: true },
  });
  const uploadsDir = path.join(process.cwd(), "public");
  await Promise.all(
    ownedMaps
      .map((m) => m.imageUrl)
      .filter((u): u is string => !!u && u.startsWith("/uploads/"))
      .map((u) => unlink(path.join(uploadsDir, u)).catch(() => {})),
  );

  // Purge data not covered by FK cascade (bare-string references to the user).
  await prisma.auditLog.deleteMany({ where: { userId: user.id } });
  await prisma.homebrewMonster.deleteMany({ where: { ownerId: user.id } });
  await prisma.homebrewSpell.deleteMany({ where: { ownerId: user.id } });
  await prisma.homebrewItem.deleteMany({ where: { ownerId: user.id } });
  await prisma.rollLog.deleteMany({ where: { userId: user.id } });

  // Cascade handles: sessions, authTokens, characters (+children), memberships,
  // owned campaigns (Campaign.dm onDelete: Cascade) and everything under them.
  await prisma.user.delete({ where: { id: user.id } });

  await destroySession();
  return NextResponse.json({ ok: true });
}
