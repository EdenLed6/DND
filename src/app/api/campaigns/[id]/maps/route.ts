import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, bad } from "@/lib/api";
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
  if (!(await isDM(user.id, campaignId))) return bad("רק ה-DM", 403);
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return bad("Invalid input");
  const map = await prisma.gameMap.create({ data: { campaignId, ...parsed.data } });
  return NextResponse.json(map);
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: campaignId } = await params;
  const { user, res } = await requireUser();
  if (!user) return res!;
  const maps = await prisma.gameMap.findMany({ where: { campaignId } });
  return NextResponse.json(maps);
}
