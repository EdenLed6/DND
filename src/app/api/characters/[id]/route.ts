import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, bad } from "@/lib/api";
import { canEditCharacter } from "@/lib/auth/rbac";
import { emitToCampaign } from "@/lib/realtime/io";

const patchSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  currentHp: z.number().int().optional(),
  tempHp: z.number().int().min(0).optional(),
  hitDiceUsed: z.number().int().min(0).optional(),
  deathSuccess: z.number().int().min(0).max(3).optional(),
  deathFail: z.number().int().min(0).max(3).optional(),
  exhaustion: z.number().int().min(0).max(6).optional(),
  conditions: z.array(z.string()).optional(),
  concentration: z.string().nullable().optional(),
  inspiration: z.boolean().optional(),
  xp: z.number().int().min(0).optional(),
  cp: z.number().int().min(0).optional(),
  sp: z.number().int().min(0).optional(),
  ep: z.number().int().min(0).optional(),
  gp: z.number().int().min(0).optional(),
  pp: z.number().int().min(0).optional(),
  acOverride: z.number().int().nullable().optional(),
  speedOverride: z.number().int().nullable().optional(),
  maxHpBonus: z.number().int().optional(),
  str: z.number().int().optional(), dex: z.number().int().optional(), con: z.number().int().optional(),
  int: z.number().int().optional(), wis: z.number().int().optional(), cha: z.number().int().optional(),
  alignment: z.string().nullable().optional(),
  personality: z.string().nullable().optional(),
  ideals: z.string().nullable().optional(),
  bonds: z.string().nullable().optional(),
  flaws: z.string().nullable().optional(),
  backstory: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  spellcastingJson: z.string().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, res } = await requireUser();
  if (!user) return res!;
  if (!(await canEditCharacter(user.id, id))) return bad("Not authorized to edit this character", 403);

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return bad("Invalid input");

  const data: any = { ...parsed.data };
  if (data.conditions) data.conditions = JSON.stringify(data.conditions);

  const character = await prisma.character.update({ where: { id }, data });
  if (character.campaignId) {
    emitToCampaign(character.campaignId, "character:updated", { characterId: id, patch: parsed.data, by: user.id });
  }
  return NextResponse.json({ ok: true });
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, res } = await requireUser();
  if (!user) return res!;
  const character = await prisma.character.findUnique({
    where: { id }, include: { classes: true, skills: true, items: true, spells: true, resources: true },
  });
  if (!character) return bad("Not found", 404);
  return NextResponse.json(character);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, res } = await requireUser();
  if (!user) return res!;
  const c = await prisma.character.findUnique({ where: { id } });
  if (!c) return bad("Not found", 404);
  if (c.ownerId !== user.id) return bad("Only the owner can delete", 403);
  await prisma.character.delete({ where: { id } });
  if (c.campaignId) emitToCampaign(c.campaignId, "character:deleted", { characterId: id });
  return NextResponse.json({ ok: true });
}
