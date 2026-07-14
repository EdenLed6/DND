import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, bad } from "@/lib/api";
import { isDM } from "@/lib/auth/rbac";
import { limitOr429 } from "@/lib/rate-limit";
import { getIO, rooms } from "@/lib/realtime/io";

// Player notes — SPEC-PLAYER §14.
// Notes belong to the character's OWNER (the player). The campaign DM may only
// READ notes explicitly shared with them (sharedWithDm=true); the DM can never
// create, edit, or delete a player's notes.

// Categories are dynamic tabs: a fixed set of defaults plus any custom tab
// names the player creates ("+ New tab" in the UI). Stored as free strings.
const categorySchema = z.string().trim().min(1).max(30);

const createSchema = z.object({
  category: categorySchema.default("General"),
  title: z.string().max(120).default(""),
  body: z.string().max(8000).default(""),
  pinned: z.boolean().optional(),
  sharedWithDm: z.boolean().optional(),
});

const patchSchema = z.object({
  noteId: z.string().min(1),
  category: categorySchema.optional(),
  title: z.string().max(120).optional(),
  body: z.string().max(8000).optional(),
  pinned: z.boolean().optional(),
  sharedWithDm: z.boolean().optional(),
});

// Tab management: rename a category across all of its notes.
const renameSchema = z.object({
  op: z.literal("renameCategory"),
  from: categorySchema,
  to: categorySchema,
});

type Ctx = { params: Promise<{ id: string }> };

async function loadCharacter(id: string) {
  return prisma.character.findUnique({ where: { id }, select: { id: true, ownerId: true, campaignId: true } });
}

/** Notify the campaign DM room that a shared note changed (DM-only channel). */
function emitNoteShared(campaignId: string | null, characterId: string, noteId: string, by: string) {
  if (!campaignId) return;
  getIO()?.to(rooms.campaignDM(campaignId)).emit("note:shared", { characterId, noteId, by, ts: Date.now() });
}

export async function GET(req: Request, { params }: Ctx) {
  const { id } = await params;
  const { user, res } = await requireUser();
  if (!user) return res!;

  const character = await loadCharacter(id);
  if (!character) return bad("Character not found", 404);

  const isOwner = character.ownerId === user.id;
  let dmView = false;
  if (!isOwner) {
    dmView = !!character.campaignId && (await isDM(user.id, character.campaignId));
    if (!dmView) return bad("Not authorized to view these notes", 403);
  }

  const url = new URL(req.url);
  const category = url.searchParams.get("category");

  const notes = await prisma.characterNote.findMany({
    where: {
      characterId: id,
      ...(dmView ? { sharedWithDm: true } : {}),
      ...(category && categorySchema.safeParse(category).success ? { category } : {}),
    },
    orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
  });
  return NextResponse.json({ notes, dmView });
}

export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  const { user, res } = await requireUser();
  if (!user) return res!;

  const limited = limitOr429(req, "notes", 60, 60_000); // 60 notes ops / min / IP
  if (limited) return limited;

  const character = await loadCharacter(id);
  if (!character) return bad("Character not found", 404);
  // Notes are personal to the player — the DM cannot write them.
  if (character.ownerId !== user.id) return bad("Only the character's owner can create notes", 403);

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return bad("Invalid input");

  const note = await prisma.characterNote.create({
    data: {
      characterId: id,
      category: parsed.data.category,
      title: parsed.data.title,
      body: parsed.data.body,
      pinned: parsed.data.pinned ?? false,
      sharedWithDm: parsed.data.sharedWithDm ?? false,
    },
  });

  if (note.sharedWithDm) emitNoteShared(character.campaignId, id, note.id, user.id);
  return NextResponse.json({ note });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const { user, res } = await requireUser();
  if (!user) return res!;

  const limited = limitOr429(req, "notes", 60, 60_000);
  if (limited) return limited;

  const character = await loadCharacter(id);
  if (!character) return bad("Character not found", 404);
  if (character.ownerId !== user.id) return bad("Only the character's owner can edit notes", 403);

  const raw = await req.json().catch(() => null);

  // Tab rename op: retag every note in a category (used by dynamic note tabs).
  if (raw && typeof raw === "object" && (raw as { op?: unknown }).op === "renameCategory") {
    const op = renameSchema.safeParse(raw);
    if (!op.success) return bad("Invalid input");
    const { from, to } = op.data;
    const updated = await prisma.characterNote.updateMany({
      where: { characterId: id, category: from },
      data: { category: to },
    });
    return NextResponse.json({ ok: true, count: updated.count });
  }

  const parsed = patchSchema.safeParse(raw);
  if (!parsed.success) return bad("Invalid input");
  const { noteId, ...fields } = parsed.data;

  const existing = await prisma.characterNote.findUnique({ where: { id: noteId } });
  if (!existing || existing.characterId !== id) return bad("Note not found", 404);

  const note = await prisma.characterNote.update({ where: { id: noteId }, data: fields });

  if (note.sharedWithDm) emitNoteShared(character.campaignId, id, note.id, user.id);
  return NextResponse.json({ note });
}

export async function DELETE(req: Request, { params }: Ctx) {
  const { id } = await params;
  const { user, res } = await requireUser();
  if (!user) return res!;

  const character = await loadCharacter(id);
  if (!character) return bad("Character not found", 404);
  if (character.ownerId !== user.id) return bad("Only the character's owner can delete notes", 403);

  const url = new URL(req.url);
  const noteId = url.searchParams.get("noteId");
  const category = url.searchParams.get("category");

  // Tab delete: remove every note in a category (UI confirms first).
  if (!noteId && category) {
    if (!categorySchema.safeParse(category).success) return bad("Invalid category");
    const deleted = await prisma.characterNote.deleteMany({ where: { characterId: id, category } });
    return NextResponse.json({ ok: true, count: deleted.count });
  }
  if (!noteId) return bad("noteId or category is required");

  const existing = await prisma.characterNote.findUnique({ where: { id: noteId } });
  if (!existing || existing.characterId !== id) return bad("Note not found", 404);

  await prisma.characterNote.delete({ where: { id: noteId } });
  return NextResponse.json({ ok: true });
}
