import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, bad, safeImageUrl } from "@/lib/api";
import { canEditCharacter, roleInCampaign } from "@/lib/auth/rbac";
import { emitToCampaign } from "@/lib/realtime/io";

const patchSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  currentHp: z.number().int().optional(),
  tempHp: z.number().int().min(0).optional(),
  hitDiceUsed: z.number().int().min(0).optional(),
  deathSuccess: z.number().int().min(0).max(3).optional(),
  deathFail: z.number().int().min(0).max(3).optional(),
  exhaustion: z.number().int().min(0).max(6).optional(),
  conditions: z.array(z.string().max(40)).max(30).optional(),
  concentration: z.string().max(120).nullable().optional(),
  inspiration: z.boolean().optional(),
  avatarUrl: z.string().max(2000).nullable().optional(),
  xp: z.number().int().min(0).max(1_000_000).optional(),
  cp: z.number().int().min(0).max(100_000_000).optional(),
  sp: z.number().int().min(0).max(100_000_000).optional(),
  ep: z.number().int().min(0).max(100_000_000).optional(),
  gp: z.number().int().min(0).max(100_000_000).optional(),
  pp: z.number().int().min(0).max(100_000_000).optional(),
  acOverride: z.number().int().min(0).max(50).nullable().optional(),
  speedOverride: z.number().int().min(0).max(1000).nullable().optional(),
  maxHpBonus: z.number().int().min(-1000).max(10000).optional(),
  str: z.number().int().min(1).max(30).optional(), dex: z.number().int().min(1).max(30).optional(), con: z.number().int().min(1).max(30).optional(),
  int: z.number().int().min(1).max(30).optional(), wis: z.number().int().min(1).max(30).optional(), cha: z.number().int().min(1).max(30).optional(),
  alignment: z.string().max(40).nullable().optional(),
  personality: z.string().max(4000).nullable().optional(),
  ideals: z.string().max(4000).nullable().optional(),
  bonds: z.string().max(4000).nullable().optional(),
  flaws: z.string().max(4000).nullable().optional(),
  backstory: z.string().max(20000).nullable().optional(),
  notes: z.string().max(20000).nullable().optional(),
  spellcastingJson: z.string().max(20000).optional(),
  defensesJson: z.string().max(4000).optional(),
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
  // Sanitize user-supplied image URL (reject javascript:/data:/other schemes).
  if ("avatarUrl" in data) data.avatarUrl = data.avatarUrl ? safeImageUrl(data.avatarUrl) : null;

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
  // Authorization: owner, or a member of the character's campaign.
  const allowed = character.ownerId === user.id ||
    (character.campaignId ? !!(await roleInCampaign(user.id, character.campaignId)) : false);
  if (!allowed) return bad("Not authorized", 403);
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
