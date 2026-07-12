import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, bad } from "@/lib/api";
import { roleInCampaign } from "@/lib/auth/rbac";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, res } = await requireUser();
  if (!user) return res!;
  const character = await prisma.character.findUnique({
    where: { id }, include: { classes: true, skills: true, spells: true, items: true, resources: true },
  });
  if (!character) return bad("Not found", 404);
  const canView = character.ownerId === user.id ||
    (character.campaignId ? await roleInCampaign(user.id, character.campaignId) : null);
  if (!canView) return bad("No access", 403);

  const { id: _i, ownerId, campaignId, createdAt, updatedAt, ...rest } = character as any;
  const payload = {
    __format: "dnd5e-cm-character",
    __version: 1,
    character: {
      ...rest,
      classes: character.classes.map(({ id, characterId, ...c }: any) => c),
      skills: character.skills.map(({ id, characterId, ...s }: any) => s),
      spells: character.spells.map(({ id, characterId, ...s }: any) => s),
      items: character.items.map(({ id, characterId, ...i }: any) => i),
      resources: character.resources.map(({ id, characterId, ...r }: any) => r),
    },
  };
  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${character.name.replace(/[^\w-]+/g, "_")}.dnd.json"`,
    },
  });
}
