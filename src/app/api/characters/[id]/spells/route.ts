import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, bad } from "@/lib/api";
import { canEditCharacter } from "@/lib/auth/rbac";
import { emitToCampaign } from "@/lib/realtime/io";

const addSchema = z.object({ spellId: z.number().int(), source: z.string().optional(), prepared: z.boolean().optional() });
const patchSchema = z.object({ spellId: z.number().int(), prepared: z.boolean() });

async function broadcast(characterId: string, userId: string) {
  const c = await prisma.character.findUnique({ where: { id: characterId }, select: { campaignId: true } });
  if (c?.campaignId) emitToCampaign(c.campaignId, "character:updated", { characterId, patch: { spells: true }, by: userId });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, res } = await requireUser();
  if (!user) return res!;
  if (!(await canEditCharacter(user.id, id))) return bad("Not authorized", 403);
  const parsed = addSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return bad("Invalid input");
  await prisma.characterSpell.upsert({
    where: { characterId_spellId: { characterId: id, spellId: String(parsed.data.spellId) } },
    update: { prepared: parsed.data.prepared ?? false, source: parsed.data.source },
    create: { characterId: id, spellId: String(parsed.data.spellId), prepared: parsed.data.prepared ?? false, source: parsed.data.source },
  });
  await broadcast(id, user.id);
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, res } = await requireUser();
  if (!user) return res!;
  if (!(await canEditCharacter(user.id, id))) return bad("Not authorized", 403);
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return bad("Invalid input");
  await prisma.characterSpell.updateMany({
    where: { characterId: id, spellId: String(parsed.data.spellId) }, data: { prepared: parsed.data.prepared },
  });
  await broadcast(id, user.id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, res } = await requireUser();
  if (!user) return res!;
  if (!(await canEditCharacter(user.id, id))) return bad("Not authorized", 403);
  const { searchParams } = new URL(req.url);
  const spellId = searchParams.get("spellId");
  if (!spellId) return bad("spellId required");
  await prisma.characterSpell.deleteMany({ where: { characterId: id, spellId } });
  await broadcast(id, user.id);
  return NextResponse.json({ ok: true });
}
