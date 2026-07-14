// Campaign read + deletion. DELETE is DM-only and permanent: FK cascade removes
// members, characters' campaign link stays (characters are detached first),
// encounters, maps, notes, world pages, homebrew, audit logs; uploaded map
// image files are unlinked from disk.
import { NextResponse } from "next/server";
import { z } from "zod";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/db";
import { requireUser, bad } from "@/lib/api";
import { roleInCampaign } from "@/lib/auth/rbac";
import { emitToCampaign } from "@/lib/realtime/io";

const delSchema = z.object({ confirmName: z.string().min(1).max(120) });

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, res } = await requireUser();
  if (!user) return res!;
  const role = await roleInCampaign(user.id, id);
  if (!role) return bad("Not a member", 403);
  const campaign = await prisma.campaign.findUnique({ where: { id } });
  if (!campaign) return bad("Not found", 404);
  const { inviteCode, ...pub } = campaign;
  return NextResponse.json(role === "DM" ? campaign : pub);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, res } = await requireUser();
  if (!user) return res!;
  const campaign = await prisma.campaign.findUnique({ where: { id } });
  if (!campaign) return bad("Not found", 404);
  if (campaign.dmId !== user.id) return bad("Only the DM can delete the campaign", 403);

  // Require typing the campaign name — deletion is destructive and permanent.
  const parsed = delSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success || parsed.data.confirmName.trim() !== campaign.name.trim()) {
    return bad("Type the campaign name to confirm deletion.");
  }

  // Unlink uploaded map files (DB rows cascade; files don't).
  const maps = await prisma.gameMap.findMany({ where: { campaignId: id }, select: { imageUrl: true } });
  const pub = path.join(process.cwd(), "public");
  await Promise.all(
    maps.map((m) => m.imageUrl)
      .filter((u): u is string => !!u && u.startsWith("/uploads/"))
      .map((u) => unlink(path.join(pub, u)).catch(() => {})),
  );

  emitToCampaign(id, "campaign:deleted", { campaignId: id });
  await prisma.$transaction([
    // Detach members' characters (they keep their heroes).
    prisma.character.updateMany({ where: { campaignId: id }, data: { campaignId: null } }),
    // RollLog has no FK — clean campaign-stamped rows.
    prisma.rollLog.deleteMany({ where: { campaignId: id } }),
    prisma.campaign.delete({ where: { id } }), // cascades the rest
  ]);
  return NextResponse.json({ ok: true });
}
