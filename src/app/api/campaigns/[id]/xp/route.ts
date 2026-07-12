import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, bad } from "@/lib/api";
import { isDM } from "@/lib/auth/rbac";
import { levelForXp } from "@/lib/dnd/rules";
import { emitToCampaign } from "@/lib/realtime/io";

const schema = z.object({
  amount: z.number().int(),
  characterIds: z.array(z.string()).optional(), // omit = whole party
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: campaignId } = await params;
  const { user, res } = await requireUser();
  if (!user) return res!;
  if (!(await isDM(user.id, campaignId))) return bad("DM only", 403);
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return bad("Invalid input");

  const where = { campaignId, ...(parsed.data.characterIds ? { id: { in: parsed.data.characterIds } } : {}) };
  const chars = await prisma.character.findMany({ where, include: { classes: true } });

  const results = [];
  for (const ch of chars) {
    const newXp = Math.max(0, ch.xp + parsed.data.amount);
    await prisma.character.update({ where: { id: ch.id }, data: { xp: newXp } });
    const totalLevel = ch.classes.reduce((s, c) => s + c.level, 0);
    const canLevelUp = levelForXp(newXp) > totalLevel;
    results.push({ characterId: ch.id, xp: newXp, level: levelForXp(newXp), canLevelUp });
    emitToCampaign(campaignId, "xp:awarded", { characterId: ch.id, xp: newXp, level: levelForXp(newXp), canLevelUp });
  }
  return NextResponse.json({ results });
}
