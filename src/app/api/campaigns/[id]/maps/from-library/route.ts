import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, bad } from "@/lib/api";
import { isDM } from "@/lib/auth/rbac";
import { findPreset } from "@/lib/maps/library";
import { generateMapSvg, svgToDataUri } from "@/lib/maps/generator";

const schema = z.object({ presetId: z.string() });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: campaignId } = await params;
  const { user, res } = await requireUser();
  if (!user) return res!;
  if (!(await isDM(user.id, campaignId))) return bad("DM only", 403);
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return bad("Invalid input");
  const preset = findPreset(parsed.data.presetId);
  if (!preset) return bad("Preset not found", 404);

  const cell = 64;
  const svg = generateMapSvg(preset.category, preset.cols, preset.rows, preset.seed, cell);
  const map = await prisma.gameMap.create({
    data: {
      campaignId, name: preset.name, imageUrl: svgToDataUri(svg),
      gridSize: cell, gridCols: preset.cols, gridRows: preset.rows,
    },
  });
  return NextResponse.json(map);
}
