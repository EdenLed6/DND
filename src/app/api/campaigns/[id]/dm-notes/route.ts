import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, bad } from "@/lib/api";
import { roleInCampaign, isDM } from "@/lib/auth/rbac";
import { limitOr429 } from "@/lib/rate-limit";
import { emitToCampaign } from "@/lib/realtime/io";

// DM Notes & Secrets — SPEC-DM §14.
// The DM writes campaign notes; visibility "players" marks a note as revealed
// (a handout everyone in the campaign can read). Players only ever see revealed
// notes; everything else stays behind the screen.

const CATEGORIES = [
  "Campaign", "Session", "NPC", "Location", "Quest",
  "Encounter", "Character", "Secret", "Handout",
] as const;

const patchSchema = z.object({
  title: z.string().max(120).optional(),
  body: z.string().max(10000).optional(),
  category: z.enum(CATEGORIES).optional(),
  pinned: z.boolean().optional(),
}).strict();

const opSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("create"),
    title: z.string().max(120).default(""),
    body: z.string().max(10000).default(""),
    category: z.enum(CATEGORIES).default("Campaign"),
    visibility: z.enum(["dm", "players"]).default("dm"),
    pinned: z.boolean().optional(),
  }),
  z.object({ op: z.literal("update"), noteId: z.string().min(1), patch: patchSchema }),
  z.object({ op: z.literal("delete"), noteId: z.string().min(1) }),
  z.object({ op: z.literal("reveal"), noteId: z.string().min(1), visibility: z.enum(["dm", "players"]) }),
]);

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id: campaignId } = await params;
  const { user, res } = await requireUser();
  if (!user) return res!;

  const role = await roleInCampaign(user.id, campaignId);
  if (!role) return bad("Not a member of this campaign", 403);

  const dm = role === "DM";
  const notes = await prisma.dmNote.findMany({
    where: { campaignId, ...(dm ? {} : { visibility: "players" }) },
    // DM: pinned first; players: newest revealed handout first.
    orderBy: dm ? [{ pinned: "desc" }, { updatedAt: "desc" }] : [{ updatedAt: "desc" }],
  });
  return NextResponse.json({ notes, isDM: dm });
}

export async function POST(req: Request, { params }: Ctx) {
  const { id: campaignId } = await params;
  const { user, res } = await requireUser();
  if (!user) return res!;

  const limited = limitOr429(req, "dmnotes", 60, 60_000); // 60 ops / min / IP
  if (limited) return limited;

  if (!(await isDM(user.id, campaignId))) return bad("DM only", 403);

  const parsed = opSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return bad("Invalid input");
  const data = parsed.data;

  if (data.op === "create") {
    const note = await prisma.dmNote.create({
      data: {
        campaignId,
        title: data.title,
        body: data.body,
        category: data.category,
        visibility: data.visibility,
        pinned: data.pinned ?? false,
      },
    });
    if (note.visibility === "players") {
      emitToCampaign(campaignId, "note:revealed", { noteId: note.id, title: note.title });
    }
    emitToCampaign(campaignId, "dmnotes:changed", { noteId: note.id });
    return NextResponse.json({ note });
  }

  // All remaining ops target an existing note of THIS campaign.
  const existing = await prisma.dmNote.findUnique({ where: { id: data.noteId } });
  if (!existing || existing.campaignId !== campaignId) return bad("Note not found", 404);

  if (data.op === "update") {
    const note = await prisma.dmNote.update({ where: { id: existing.id }, data: data.patch });
    emitToCampaign(campaignId, "dmnotes:changed", { noteId: note.id });
    return NextResponse.json({ note });
  }

  if (data.op === "delete") {
    await prisma.dmNote.delete({ where: { id: existing.id } });
    emitToCampaign(campaignId, "dmnotes:changed", { noteId: existing.id });
    return NextResponse.json({ ok: true });
  }

  // op === "reveal" — set visibility; announce the dm→players transition so
  // player tabs can refetch and highlight the freshly revealed handout.
  const note = await prisma.dmNote.update({
    where: { id: existing.id },
    data: { visibility: data.visibility },
  });
  if (existing.visibility === "dm" && note.visibility === "players") {
    emitToCampaign(campaignId, "note:revealed", { noteId: note.id, title: note.title });
  }
  emitToCampaign(campaignId, "dmnotes:changed", { noteId: note.id });
  return NextResponse.json({ note });
}
