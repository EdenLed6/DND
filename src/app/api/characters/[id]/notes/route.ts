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

const CATEGORIES = ["General", "Session", "NPCs", "Locations", "Quests", "Secrets", "Rules"] as const;

const createSchema = z.object({
  category: z.enum(CATEGORIES).default("General"),
  title: z.string().max(120).default(""),
  body: z.string().max(8000).default(""),
  pinned: z.boolean().optional(),
  sharedWithDm: z.boolean().optional(),
});

const patchSchema = z.object({
  noteId: z.string().min(1),
  category: z.enum(CATEGORIES).optional(),
  title: z.string().max(120).optional(),
  body: z.string().max(8000).optional(),
  pinned: z.boolean().optional(),
  sharedWithDm: z.boolean().optional(),
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
      ...(category && (CATEGORIES as readonly string[]).includes(category) ? { category } : {}),
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

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
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

  const noteId = new URL(req.url).searchParams.get("noteId");
  if (!noteId) return bad("noteId is required");

  const existing = await prisma.characterNote.findUnique({ where: { id: noteId } });
  if (!existing || existing.characterId !== id) return bad("Note not found", 404);

  await prisma.characterNote.delete({ where: { id: noteId } });
  return NextResponse.json({ ok: true });
}
