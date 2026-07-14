// World / Lore pages (custom DM-authored tabs). Each page is a tab the DM
// creates, edits, and toggles Public/Private (visibility).
//
// SECURITY: pages with visibility="dm" are PRIVATE. Players must never receive
// them — GET filters to visibility="public" for anyone who is not the DM, so
// dm-only content never reaches a player-rendered prop.
//
// GET    — DM: all pages; player/member: only visibility="public".
// POST   — DM only: create a page.
// PATCH  — DM only: update title / content / visibility / sortOrder.
// DELETE — DM only: remove a page.
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, bad } from "@/lib/api";
import { isDM, roleInCampaign } from "@/lib/auth/rbac";
import { emitToCampaign } from "@/lib/realtime/io";
import { logAudit } from "@/lib/audit";

const VISIBILITIES = ["public", "dm"] as const;

const createSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(120),
  content: z.string().max(20000).optional().default(""),
  visibility: z.enum(VISIBILITIES).optional().default("dm"),
  sortOrder: z.number().int().min(0).max(100000).optional(),
});

const patchSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1).max(120).optional(),
  content: z.string().max(20000).optional(),
  visibility: z.enum(VISIBILITIES).optional(),
  sortOrder: z.number().int().min(0).max(100000).optional(),
});

const deleteSchema = z.object({ id: z.string().min(1) });

// Fields returned to clients. Identical shape for DM and players; the row-level
// WHERE filter (visibility="public") is what protects private pages, not the
// projection — private pages are never fetched for players in the first place.
function serialize(p: {
  id: string; campaignId: string; title: string; content: string;
  visibility: string; sortOrder: number; createdAt: Date; updatedAt: Date;
}) {
  return {
    id: p.id, campaignId: p.campaignId, title: p.title, content: p.content,
    visibility: p.visibility, sortOrder: p.sortOrder,
    createdAt: p.createdAt, updatedAt: p.updatedAt,
  };
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: campaignId } = await params;
  const { user, res } = await requireUser();
  if (!user) return res!;
  const role = await roleInCampaign(user.id, campaignId);
  if (!role) return bad("Not a member of this campaign", 403);

  // DM sees all pages; everyone else sees ONLY public pages. This is the single
  // enforcement point that keeps visibility="dm" pages away from players.
  const where = role === "DM" ? { campaignId } : { campaignId, visibility: "public" };
  const pages = await prisma.worldPage.findMany({
    where,
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json({ pages: pages.map(serialize) });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: campaignId } = await params;
  const { user, res } = await requireUser();
  if (!user) return res!;
  if (!(await isDM(user.id, campaignId))) return bad("DM only", 403);

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return bad(parsed.error.issues[0]?.message ?? "Invalid input");
  const d = parsed.data;

  // Default new pages to the end of the list when no sortOrder is given.
  let sortOrder = d.sortOrder;
  if (sortOrder === undefined) {
    const max = await prisma.worldPage.aggregate({ where: { campaignId }, _max: { sortOrder: true } });
    sortOrder = (max._max.sortOrder ?? -1) + 1;
  }

  const page = await prisma.worldPage.create({
    data: { campaignId, title: d.title, content: d.content, visibility: d.visibility, sortOrder },
  });
  await logAudit(campaignId, user.id, "worldPage.create", `"${page.title}" (${page.visibility})`);
  emitToCampaign(campaignId, "world:changed", { kind: "page", id: page.id });
  return NextResponse.json({ page: serialize(page) });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: campaignId } = await params;
  const { user, res } = await requireUser();
  if (!user) return res!;
  if (!(await isDM(user.id, campaignId))) return bad("DM only", 403);

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return bad(parsed.error.issues[0]?.message ?? "Invalid input");
  const { id, ...patch } = parsed.data;

  const existing = await prisma.worldPage.findFirst({ where: { id, campaignId } });
  if (!existing) return bad("Page not found", 404);

  const data: Record<string, unknown> = {};
  if (patch.title !== undefined) data.title = patch.title;
  if (patch.content !== undefined) data.content = patch.content;
  if (patch.visibility !== undefined) data.visibility = patch.visibility;
  if (patch.sortOrder !== undefined) data.sortOrder = patch.sortOrder;

  const page = await prisma.worldPage.update({ where: { id: existing.id }, data });
  await logAudit(campaignId, user.id, "worldPage.update", `"${page.title}": ${Object.keys(data).join(", ") || "no-op"}`);
  emitToCampaign(campaignId, "world:changed", { kind: "page", id: page.id });
  return NextResponse.json({ page: serialize(page) });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: campaignId } = await params;
  const { user, res } = await requireUser();
  if (!user) return res!;
  if (!(await isDM(user.id, campaignId))) return bad("DM only", 403);

  // Accept id from the query string or the JSON body.
  const url = new URL(req.url);
  const bodyId = (await req.json().catch(() => null))?.id;
  const parsed = deleteSchema.safeParse({ id: url.searchParams.get("id") ?? bodyId });
  if (!parsed.success) return bad("Page id required");

  const existing = await prisma.worldPage.findFirst({ where: { id: parsed.data.id, campaignId } });
  if (!existing) return bad("Page not found", 404);

  await prisma.worldPage.delete({ where: { id: existing.id } });
  await logAudit(campaignId, user.id, "worldPage.delete", `"${existing.title}"`);
  emitToCampaign(campaignId, "world:changed", { kind: "page", id: existing.id });
  return NextResponse.json({ ok: true });
}
