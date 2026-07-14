import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, bad } from "@/lib/api";
import { isDM, roleInCampaign } from "@/lib/auth/rbac";
import { logAudit } from "@/lib/audit";
import { limitOr429 } from "@/lib/rate-limit";

// Homebrew items (DM content library). dataJson mirrors the SrdEquipment /
// SrdMagicItem shapes so the content manager / inventory pickers can merge
// SRD + homebrew seamlessly. `kind` distinguishes "equipment" (gear/weapons/
// armor, priced in gp) from "magic" (magic items with a rarity).
// Authorization: the creator (ownerId) may always edit/delete; if scoped to a
// campaign, that campaign's DM may too.

const MAX_JSON = 8000;

/** Loose SRD-equipment / magic-item shape validation (extra keys allowed). */
const itemData = z
  .object({
    kind: z.enum(["equipment", "magic"]).nullish(),
    category: z.string().max(60).nullish(),
    costGp: z.number().min(0).max(10_000_000).nullish(),
    costUnit: z.string().max(20).nullish(),
    weight: z.number().min(0).max(1_000_000).nullish(),
    description: z.string().max(6000).nullish(),
    descMd: z.string().max(6000).nullish(),
    damageDice: z.string().max(40).nullish(),
    damageType: z.string().max(60).nullish(),
    acBase: z.number().int().min(0).max(30).nullish(),
    acBonus: z.number().int().min(-10).max(10).nullish(),
    armorCategory: z.string().max(60).nullish(),
    properties: z.union([z.string().max(400), z.array(z.string().max(60))]).nullish(),
    rarity: z.string().max(40).nullish(),
    requiresAttunement: z.boolean().nullish(),
  })
  .passthrough();

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  campaignId: z.string().max(64).nullish(),
  dataJson: z.string().max(MAX_JSON),
});

const patchSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().trim().min(1).max(80).optional(),
  campaignId: z.string().max(64).nullish().optional(),
  dataJson: z.string().max(MAX_JSON).optional(),
});

/** Parse + loosely validate a dataJson string. */
function checkData(raw: string): { ok: true } | { ok: false; error: string } {
  if (raw.length > MAX_JSON) return { ok: false, error: `dataJson too large (max ${MAX_JSON} chars)` };
  let obj: unknown;
  try {
    obj = JSON.parse(raw);
  } catch {
    return { ok: false, error: "dataJson is not valid JSON" };
  }
  const parsed = itemData.safeParse(obj);
  if (!parsed.success) {
    const issues = parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    return { ok: false, error: `Invalid item data — ${issues}` };
  }
  return { ok: true };
}

/** GET ?mine=1 (own + DM'd campaigns) or ?campaignId=xxx (that campaign only). */
export async function GET(req: Request) {
  const { user, res } = await requireUser();
  if (!user) return res!;
  const { searchParams } = new URL(req.url);
  const campaignId = searchParams.get("campaignId");

  if (campaignId) {
    if (!(await roleInCampaign(user.id, campaignId))) return bad("Not a member of this campaign", 403);
    const items = await prisma.homebrewItem.findMany({ where: { campaignId }, orderBy: { name: "asc" } });
    return NextResponse.json(items);
  }

  const dmCampaigns = await prisma.campaign.findMany({ where: { dmId: user.id }, select: { id: true } });
  const items = await prisma.homebrewItem.findMany({
    where: {
      OR: [
        { ownerId: user.id },
        ...(dmCampaigns.length ? [{ campaignId: { in: dmCampaigns.map((c) => c.id) } }] : []),
      ],
    },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(items);
}

export async function POST(req: Request) {
  const { user, res } = await requireUser();
  if (!user) return res!;
  const limited = limitOr429(req, "homebrew-items", 30, 60_000);
  if (limited) return limited;

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return bad("Invalid input: " + parsed.error.issues.map((i) => i.path.join(".")).join(", "));
  const d = parsed.data;

  const chk = checkData(d.dataJson);
  if (!chk.ok) return bad(chk.error);
  if (d.campaignId && !(await isDM(user.id, d.campaignId))) {
    return bad("Only the DM may attach homebrew to this campaign", 403);
  }

  const item = await prisma.homebrewItem.create({
    data: { ownerId: user.id, campaignId: d.campaignId || null, name: d.name, dataJson: d.dataJson },
  });
  if (item.campaignId) await logAudit(item.campaignId, user.id, "homebrew.item.create", item.name);
  return NextResponse.json(item);
}

export async function PATCH(req: Request) {
  const { user, res } = await requireUser();
  if (!user) return res!;
  const limited = limitOr429(req, "homebrew-items", 30, 60_000);
  if (limited) return limited;

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return bad("Invalid input: " + parsed.error.issues.map((i) => i.path.join(".")).join(", "));
  const d = parsed.data;

  const existing = await prisma.homebrewItem.findUnique({ where: { id: d.id } });
  if (!existing) return bad("Homebrew item not found", 404);
  const isOwner = existing.ownerId === user.id;
  const isCampaignDm = !!existing.campaignId && (await isDM(user.id, existing.campaignId));
  if (!isOwner && !isCampaignDm) return bad("Not allowed to edit this homebrew item", 403);

  if (d.dataJson !== undefined) {
    const chk = checkData(d.dataJson);
    if (!chk.ok) return bad(chk.error);
  }
  if (d.campaignId && !(await isDM(user.id, d.campaignId))) {
    return bad("Only the DM may attach homebrew to this campaign", 403);
  }

  const data: { name?: string; campaignId?: string | null; dataJson?: string } = {};
  if (d.name !== undefined) data.name = d.name;
  if (d.campaignId !== undefined) data.campaignId = d.campaignId || null;
  if (d.dataJson !== undefined) data.dataJson = d.dataJson;

  const item = await prisma.homebrewItem.update({ where: { id: d.id }, data });
  if (item.campaignId) await logAudit(item.campaignId, user.id, "homebrew.item.update", item.name);
  return NextResponse.json(item);
}

export async function DELETE(req: Request) {
  const { user, res } = await requireUser();
  if (!user) return res!;
  const limited = limitOr429(req, "homebrew-items", 30, 60_000);
  if (limited) return limited;

  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!id) return bad("id required");
  const existing = await prisma.homebrewItem.findUnique({ where: { id } });
  if (!existing) return bad("Homebrew item not found", 404);
  const isOwner = existing.ownerId === user.id;
  const isCampaignDm = !!existing.campaignId && (await isDM(user.id, existing.campaignId));
  if (!isOwner && !isCampaignDm) return bad("Not allowed to delete this homebrew item", 403);

  await prisma.homebrewItem.delete({ where: { id } });
  if (existing.campaignId) await logAudit(existing.campaignId, user.id, "homebrew.item.delete", existing.name);
  return NextResponse.json({ ok: true });
}
