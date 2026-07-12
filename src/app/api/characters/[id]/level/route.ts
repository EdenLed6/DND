import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, bad } from "@/lib/api";
import { canEditCharacter } from "@/lib/auth/rbac";
import { loadCharacterView } from "@/lib/character-view";
import { emitToCampaign } from "@/lib/realtime/io";

const schema = z.object({
  classId: z.string().optional(),          // which class to level (default primary)
  delta: z.number().int().default(1),      // +1 level up, -1 down
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, res } = await requireUser();
  if (!user) return res!;
  if (!(await canEditCharacter(user.id, id))) return bad("אין הרשאה", 403);
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return bad("Invalid input");

  const before = await loadCharacterView(id);
  if (!before) return bad("Not found", 404);
  const hpBefore = before.derived.maxHp;

  const cls = parsed.data.classId
    ? before.character.classes.find((c) => c.classId === parsed.data.classId)
    : (before.character.classes.find((c) => c.isPrimary) ?? before.character.classes[0]);
  if (!cls) return bad("No class");
  const newLevel = Math.min(20, Math.max(1, cls.level + parsed.data.delta));
  await prisma.characterClass.update({ where: { id: cls.id }, data: { level: newLevel } });

  const after = await loadCharacterView(id);
  const hpAfter = after!.derived.maxHp;
  const hpDelta = hpAfter - hpBefore;
  // bump current HP by the same amount (convenience), clamp to new max
  const newCurrent = Math.max(0, Math.min(hpAfter, before.character.currentHp + Math.max(0, hpDelta)));
  await prisma.character.update({ where: { id }, data: { currentHp: newCurrent } });

  if (before.character.campaignId) {
    emitToCampaign(before.character.campaignId, "character:updated", {
      characterId: id, patch: { level: newLevel, maxHp: hpAfter, currentHp: newCurrent }, by: user.id,
    });
  }
  return NextResponse.json({ className: cls.classId, level: newLevel, maxHp: hpAfter, currentHp: newCurrent });
}
