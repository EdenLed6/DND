import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, bad } from "@/lib/api";
import { roleInCampaign } from "@/lib/auth/rbac";
import { limitOr429 } from "@/lib/rate-limit";
import { emitToCampaign } from "@/lib/realtime/io";

// Shared party inventory — SPEC-DM §11.
// The DM stocks the party stash (optionally hidden until revealed) and can give
// items to characters. Players see revealed items and may claim them into a
// character THEY OWN in this campaign; the transfer creates/merges a real
// InventoryItem on the character sheet.

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  quantity: z.number().int().min(1).max(9999).optional(),
  notes: z.string().max(1000).nullable().optional(),
  hidden: z.boolean().optional(),
}).strict();

const opSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("add"),
    name: z.string().min(1).max(120),
    quantity: z.number().int().min(1).max(9999).default(1),
    notes: z.string().max(1000).optional(),
    hidden: z.boolean().optional(),
    // SRD ids arrive as numbers from /api/srd/items; stored as strings.
    srcEquipmentId: z.number().int().optional(),
    srcMagicItemId: z.number().int().optional(),
  }),
  z.object({ op: z.literal("update"), itemId: z.string().min(1), patch: patchSchema }),
  z.object({ op: z.literal("delete"), itemId: z.string().min(1) }),
  z.object({ op: z.literal("reveal"), itemId: z.string().min(1) }),
  z.object({
    op: z.literal("give"),
    itemId: z.string().min(1),
    characterId: z.string().min(1),
    quantity: z.number().int().min(1).max(9999).default(1),
  }),
  z.object({
    op: z.literal("claim"),
    itemId: z.string().min(1),
    characterId: z.string().min(1),
    quantity: z.number().int().min(1).max(9999).default(1),
  }),
]);

type Ctx = { params: Promise<{ id: string }> };

type PartyItemRow = {
  id: string; name: string; quantity: number;
  srcEquipmentId: string | null; srcMagicItemId: string | null;
};

/** Move `qty` of a party item into a character's inventory (merge if the
 *  character already carries the same item), then decrement/delete the stash row. */
async function transferToCharacter(item: PartyItemRow, characterId: string, qty: number) {
  const take = Math.min(qty, item.quantity);
  const existing = await prisma.inventoryItem.findFirst({
    where: {
      characterId,
      name: item.name,
      srcEquipmentId: item.srcEquipmentId,
      srcMagicItemId: item.srcMagicItemId,
    },
  });
  if (existing) {
    await prisma.inventoryItem.update({
      where: { id: existing.id },
      data: { quantity: existing.quantity + take },
    });
  } else {
    await prisma.inventoryItem.create({
      data: {
        characterId,
        name: item.name,
        quantity: take,
        srcEquipmentId: item.srcEquipmentId,
        srcMagicItemId: item.srcMagicItemId,
      },
    });
  }
  if (item.quantity - take <= 0) {
    await prisma.partyItem.delete({ where: { id: item.id } });
  } else {
    await prisma.partyItem.update({
      where: { id: item.id },
      data: { quantity: item.quantity - take, claimedById: characterId },
    });
  }
  return take;
}

export async function GET(_req: Request, { params }: Ctx) {
  const { id: campaignId } = await params;
  const { user, res } = await requireUser();
  if (!user) return res!;

  const role = await roleInCampaign(user.id, campaignId);
  if (!role) return bad("Not a member of this campaign", 403);
  const dm = role === "DM";

  const items = await prisma.partyItem.findMany({
    where: { campaignId, ...(dm ? {} : { hidden: false }) },
    orderBy: [{ createdAt: "desc" }],
  });
  // Campaign characters for the DM's "Give to…" picker.
  const characters = dm
    ? await prisma.character.findMany({ where: { campaignId }, select: { id: true, name: true }, orderBy: { name: "asc" } })
    : [];
  return NextResponse.json({ items, characters, isDM: dm });
}

export async function POST(req: Request, { params }: Ctx) {
  const { id: campaignId } = await params;
  const { user, res } = await requireUser();
  if (!user) return res!;

  const limited = limitOr429(req, "partyitems", 60, 60_000); // 60 ops / min / IP
  if (limited) return limited;

  const role = await roleInCampaign(user.id, campaignId);
  if (!role) return bad("Not a member of this campaign", 403);
  const dm = role === "DM";

  const parsed = opSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return bad("Invalid input");
  const data = parsed.data;

  // Players may ONLY claim; every other op is DM-only.
  if (data.op !== "claim" && !dm) return bad("DM only", 403);

  if (data.op === "add") {
    const item = await prisma.partyItem.create({
      data: {
        campaignId,
        name: data.name,
        quantity: data.quantity,
        notes: data.notes,
        hidden: data.hidden ?? false,
        srcEquipmentId: data.srcEquipmentId != null ? String(data.srcEquipmentId) : null,
        srcMagicItemId: data.srcMagicItemId != null ? String(data.srcMagicItemId) : null,
      },
    });
    emitToCampaign(campaignId, "loot:changed", { itemId: item.id });
    return NextResponse.json({ item });
  }

  const existing = await prisma.partyItem.findUnique({ where: { id: data.itemId } });
  if (!existing || existing.campaignId !== campaignId) return bad("Item not found", 404);

  if (data.op === "update") {
    const item = await prisma.partyItem.update({ where: { id: existing.id }, data: data.patch });
    emitToCampaign(campaignId, "loot:changed", { itemId: item.id });
    return NextResponse.json({ item });
  }

  if (data.op === "delete") {
    await prisma.partyItem.delete({ where: { id: existing.id } });
    emitToCampaign(campaignId, "loot:changed", { itemId: existing.id });
    return NextResponse.json({ ok: true });
  }

  if (data.op === "reveal") {
    const item = await prisma.partyItem.update({ where: { id: existing.id }, data: { hidden: false } });
    emitToCampaign(campaignId, "loot:changed", { itemId: item.id });
    return NextResponse.json({ item });
  }

  // give / claim — transfer into a character's inventory.
  const character = await prisma.character.findUnique({
    where: { id: data.characterId },
    select: { id: true, ownerId: true, campaignId: true },
  });
  if (!character || character.campaignId !== campaignId) return bad("Character not found in this campaign", 404);

  if (data.op === "claim") {
    // Server-side ownership check: players can only claim into a character they own.
    if (character.ownerId !== user.id) return bad("You can only claim items for your own character", 403);
    if (existing.hidden) return bad("Item not found", 404); // hidden items don't exist for players
  }

  const given = await transferToCharacter(existing, character.id, data.quantity);
  emitToCampaign(campaignId, "loot:changed", { itemId: existing.id });
  emitToCampaign(campaignId, "character:updated", { characterId: character.id, by: user.id });
  return NextResponse.json({ ok: true, given });
}
