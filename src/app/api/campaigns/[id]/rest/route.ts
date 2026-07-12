import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, bad } from "@/lib/api";
import { isDM } from "@/lib/auth/rbac";
import { loadCharacterView } from "@/lib/character-view";
import { computeRest } from "@/lib/dnd/rest";
import { emitToCampaign } from "@/lib/realtime/io";

const schema = z.object({
  type: z.enum(["SHORT", "LONG"]),
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
  const chars = await prisma.character.findMany({ where, select: { id: true } });

  for (const { id } of chars) {
    const view = await loadCharacterView(id);
    if (!view) continue;
    const patch = computeRest(view.character, view.derived, parsed.data.type);
    await prisma.character.update({ where: { id }, data: patch as any });
    // reset resources
    if (parsed.data.type === "LONG") {
      await prisma.characterResource.updateMany({ where: { characterId: id }, data: { used: 0 } });
    } else {
      await prisma.characterResource.updateMany({ where: { characterId: id, resetOn: "SHORT" }, data: { used: 0 } });
    }
    emitToCampaign(campaignId, "character:updated", { characterId: id, patch, by: user.id });
  }
  emitToCampaign(campaignId, "rest:applied", { type: parsed.data.type, count: chars.length });
  return NextResponse.json({ ok: true, count: chars.length });
}
