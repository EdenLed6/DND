import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, bad } from "@/lib/api";
import { canEditCharacter } from "@/lib/auth/rbac";
import { emitToCampaign } from "@/lib/realtime/io";

const addSchema = z.object({
  name: z.string().min(1),
  quantity: z.number().int().min(1).default(1),
  srcEquipmentId: z.number().int().optional(),
  srcMagicItemId: z.number().int().optional(),
  equipped: z.boolean().optional(),
});
const patchSchema = z.object({
  itemId: z.string(),
  quantity: z.number().int().min(1).optional(),
  equipped: z.boolean().optional(),
  attuned: z.boolean().optional(),
});

async function broadcast(characterId: string, userId: string) {
  const c = await prisma.character.findUnique({ where: { id: characterId }, select: { campaignId: true } });
  if (c?.campaignId) emitToCampaign(c.campaignId, "character:updated", { characterId, patch: { items: true }, by: userId });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, res } = await requireUser();
  if (!user) return res!;
  if (!(await canEditCharacter(user.id, id))) return bad("Not authorized", 403);
  const parsed = addSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return bad("Invalid input");
  const d = parsed.data;
  const item = await prisma.inventoryItem.create({
    data: {
      characterId: id, name: d.name, quantity: d.quantity, equipped: d.equipped ?? false,
      srcEquipmentId: d.srcEquipmentId != null ? String(d.srcEquipmentId) : null,
      srcMagicItemId: d.srcMagicItemId != null ? String(d.srcMagicItemId) : null,
    },
  });
  await broadcast(id, user.id);
  return NextResponse.json(item);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, res } = await requireUser();
  if (!user) return res!;
  if (!(await canEditCharacter(user.id, id))) return bad("Not authorized", 403);
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return bad("Invalid input");
  const { itemId, ...data } = parsed.data;
  const item = await prisma.inventoryItem.findFirst({ where: { id: itemId, characterId: id } });
  if (!item) return bad("Not found", 404);
  await prisma.inventoryItem.update({ where: { id: itemId }, data });
  await broadcast(id, user.id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, res } = await requireUser();
  if (!user) return res!;
  if (!(await canEditCharacter(user.id, id))) return bad("Not authorized", 403);
  const { searchParams } = new URL(req.url);
  const itemId = searchParams.get("itemId");
  if (!itemId) return bad("itemId required");
  await prisma.inventoryItem.deleteMany({ where: { id: itemId, characterId: id } });
  await broadcast(id, user.id);
  return NextResponse.json({ ok: true });
}
