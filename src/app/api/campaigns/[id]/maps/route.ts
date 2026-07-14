import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, bad, safeImageUrl } from "@/lib/api";
import { isDM } from "@/lib/auth/rbac";

const schema = z.object({
  name: z.string().min(1).max(80),
  imageUrl: z.string().default(""),
  gridSize: z.number().int().min(20).max(200).default(70),
  gridCols: z.number().int().min(4).max(60).default(20),
  gridRows: z.number().int().min(4).max(60).default(20),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: campaignId } = await params;
  const { user, res } = await requireUser();
  if (!user) return res!;
  if (!(await isDM(user.id, campaignId))) return bad("DM only", 403);
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return bad("Invalid input");
  // Sanitize the image URL: allow only http(s)/site-relative, reject data:/js: etc.
  const imageUrl = parsed.data.imageUrl ? (safeImageUrl(parsed.data.imageUrl) ?? "") : "";
  const map = await prisma.gameMap.create({ data: { campaignId, ...parsed.data, imageUrl } });
  return NextResponse.json(map);
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: campaignId } = await params;
  const { user, res } = await requireUser();
  if (!user) return res!;
  // The map library is DM prep material (secret dungeons, unused maps). Players
  // receive only the specific map used by their active encounter, via the play page.
  if (!(await isDM(user.id, campaignId))) return bad("DM only", 403);
  const maps = await prisma.gameMap.findMany({ where: { campaignId } });
  return NextResponse.json(maps);
}
