import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, bad } from "@/lib/api";
import { canEditCharacter } from "@/lib/auth/rbac";
import { emitToCampaign } from "@/lib/realtime/io";

const schema = z.object({
  key: z.string().max(60),
  used: z.number().int().min(0).max(1000),
  max: z.number().int().min(0).max(1000).optional(),
  resetOn: z.enum(["SHORT", "LONG"]).optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, res } = await requireUser();
  if (!user) return res!;
  if (!(await canEditCharacter(user.id, id))) return bad("Not authorized to edit this character", 403);

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return bad("Invalid input");
  const { key, used, max, resetOn } = parsed.data;

  // No @@unique on (characterId, name), so find-then-update-or-create.
  const existing = await prisma.characterResource.findFirst({ where: { characterId: id, name: key } });
  if (existing) {
    await prisma.characterResource.update({
      where: { id: existing.id },
      data: { used, ...(max !== undefined ? { max } : {}), ...(resetOn !== undefined ? { resetOn } : {}) },
    });
  } else {
    await prisma.characterResource.create({
      data: { characterId: id, name: key, used, max: max ?? 0, resetOn: resetOn ?? "LONG" },
    });
  }

  const character = await prisma.character.findUnique({ where: { id }, select: { campaignId: true } });
  if (character?.campaignId) {
    emitToCampaign(character.campaignId, "character:updated", { characterId: id, patch: { resource: { key, used } }, by: user.id });
  }
  return NextResponse.json({ ok: true });
}
