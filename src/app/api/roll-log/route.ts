// Persistent roll history (character sheet roll log). Each entry is scoped to
// the calling user; a character/campaign id may be attached for filtering.
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, bad } from "@/lib/api";
import { roleInCampaign } from "@/lib/auth/rbac";

const postSchema = z.object({
  characterId: z.string().max(64).optional(),
  campaignId: z.string().max(64).optional(),
  label: z.string().max(80).default(""),
  expression: z.string().max(120).optional(),
  total: z.number().int().min(-100000).max(100000),
  breakdown: z.string().max(400).default(""),
  visibility: z.enum(["public", "dm", "self"]).default("public"),
});

export async function GET(req: Request) {
  const { user, res } = await requireUser();
  if (!user) return res!;
  const { searchParams } = new URL(req.url);
  const characterId = searchParams.get("characterId");
  const take = Math.min(100, Math.max(1, parseInt(searchParams.get("take") || "40", 10) || 40));

  // Only the roller (or the DM of the character's campaign) may read a
  // character's log.
  if (characterId) {
    const c = await prisma.character.findUnique({ where: { id: characterId }, select: { ownerId: true, campaignId: true } });
    if (!c) return bad("Not found", 404);
    const allowed = c.ownerId === user.id || (c.campaignId ? (await roleInCampaign(user.id, c.campaignId)) === "DM" : false);
    if (!allowed) return bad("Not authorized", 403);
    const rows = await prisma.rollLog.findMany({ where: { characterId }, orderBy: { ts: "desc" }, take });
    return NextResponse.json(rows);
  }
  const rows = await prisma.rollLog.findMany({ where: { userId: user.id }, orderBy: { ts: "desc" }, take });
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const { user, res } = await requireUser();
  if (!user) return res!;
  const parsed = postSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return bad("Invalid input");
  const d = parsed.data;

  // If a characterId is supplied it must belong to the caller (no writing to
  // someone else's log).
  if (d.characterId) {
    const c = await prisma.character.findUnique({ where: { id: d.characterId }, select: { ownerId: true } });
    if (!c || c.ownerId !== user.id) return bad("Not your character", 403);
  }

  const row = await prisma.rollLog.create({
    data: {
      userId: user.id,
      characterId: d.characterId || null,
      campaignId: d.campaignId || null,
      label: d.label,
      expression: d.expression,
      total: d.total,
      breakdown: d.breakdown,
      visibility: d.visibility,
    },
  });
  return NextResponse.json(row);
}
