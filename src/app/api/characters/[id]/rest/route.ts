import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, bad } from "@/lib/api";
import { canEditCharacter } from "@/lib/auth/rbac";
import { loadCharacterView } from "@/lib/character-view";
import { computeRest } from "@/lib/dnd/rest";
import { emitToCampaign } from "@/lib/realtime/io";

const schema = z.object({
  type: z.enum(["SHORT", "LONG"]),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, res } = await requireUser();
  if (!user) return res!;
  if (!(await canEditCharacter(user.id, id))) return bad("Not authorized to edit this character", 403);

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return bad("Invalid input");
  const { type } = parsed.data;

  const view = await loadCharacterView(id);
  if (!view) return bad("Not found", 404);

  const patch = computeRest(view.character, view.derived, type);
  await prisma.character.update({ where: { id }, data: patch as any });

  // Reset resources: LONG resets everything, SHORT resets only SHORT-reset resources.
  if (type === "LONG") {
    await prisma.characterResource.updateMany({ where: { characterId: id }, data: { used: 0 } });
  } else {
    await prisma.characterResource.updateMany({ where: { characterId: id, resetOn: "SHORT" }, data: { used: 0 } });
  }

  if (view.character.campaignId) {
    emitToCampaign(view.character.campaignId, "character:updated", { characterId: id, patch, by: user.id });
  }
  return NextResponse.json({ ok: true, patch });
}
