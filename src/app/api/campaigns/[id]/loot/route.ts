import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, bad } from "@/lib/api";
import { isDM } from "@/lib/auth/rbac";
import { emitToCampaign } from "@/lib/realtime/io";

const addSchema = z.object({
  name: z.string().min(1), quantity: z.number().int().min(1).default(1),
  srcMagicItemId: z.number().int().optional(), srcEquipmentId: z.number().int().optional(),
  goldValueCp: z.number().int().default(0),
});
const assignSchema = z.object({ lootId: z.string(), characterId: z.string() });

// Add loot to the party pool
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: campaignId } = await params;
  const { user, res } = await requireUser();
  if (!user) return res!;
  if (!(await isDM(user.id, campaignId))) return bad("רק ה-DM", 403);
  const parsed = addSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return bad("Invalid input");
  const loot = await prisma.lootItem.create({ data: { campaignId, ...parsed.data } });
  emitToCampaign(campaignId, "loot:added", { loot });
  return NextResponse.json(loot);
}

// Assign a loot item to a character (moves to their inventory)
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: campaignId } = await params;
  const { user, res } = await requireUser();
  if (!user) return res!;
  if (!(await isDM(user.id, campaignId))) return bad("רק ה-DM", 403);
  const parsed = assignSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return bad("Invalid input");

  const loot = await prisma.lootItem.findFirst({ where: { id: parsed.data.lootId, campaignId } });
  if (!loot) return bad("Loot not found", 404);
  const ch = await prisma.character.findFirst({ where: { id: parsed.data.characterId, campaignId } });
  if (!ch) return bad("Character not in campaign", 404);

  await prisma.inventoryItem.create({
    data: { characterId: ch.id, name: loot.name, quantity: loot.quantity,
      srcMagicItemId: loot.srcMagicItemId ? String(loot.srcMagicItemId) : null,
      srcEquipmentId: loot.srcEquipmentId ? String(loot.srcEquipmentId) : null },
  });
  await prisma.lootItem.delete({ where: { id: loot.id } });
  emitToCampaign(campaignId, "loot:assigned", { characterId: ch.id, name: loot.name, lootId: loot.id });
  emitToCampaign(campaignId, "character:updated", { characterId: ch.id, patch: {}, by: user.id });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: campaignId } = await params;
  const { user, res } = await requireUser();
  if (!user) return res!;
  if (!(await isDM(user.id, campaignId))) return bad("רק ה-DM", 403);
  const { searchParams } = new URL(req.url);
  const lootId = searchParams.get("lootId");
  if (!lootId) return bad("lootId required");
  await prisma.lootItem.deleteMany({ where: { id: lootId, campaignId } });
  emitToCampaign(campaignId, "loot:removed", { lootId });
  return NextResponse.json({ ok: true });
}
