import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, bad } from "@/lib/api";
import { canEditCharacter } from "@/lib/auth/rbac";
import { loadCharacterView } from "@/lib/character-view";
import { HIT_DIE, abilityMod, type Ability } from "@/lib/dnd/rules";
import { emitToCampaign } from "@/lib/realtime/io";

const schema = z.object({
  className: z.string(),                    // class to level (existing or new for multiclass)
  isNewClass: z.boolean().default(false),   // true -> add a multiclass at level 1
  subclass: z.string().nullish(),           // set when reaching subclass level
  hpMode: z.enum(["roll", "average", "max"]).default("average"),
  hpRoll: z.number().int().optional(),      // client-provided roll result (validated to die range)
  asi: z.record(z.enum(["str", "dex", "con", "int", "wis", "cha"]), z.number().int()).optional(),
  feat: z.object({ name: z.string(), description: z.string().optional() }).optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, res } = await requireUser();
  if (!user) return res!;
  if (!(await canEditCharacter(user.id, id))) return bad("Not authorized", 403);
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return bad("Invalid input");
  const d = parsed.data;

  const view = await loadCharacterView(id);
  if (!view) return bad("Not found", 404);
  const ch = view.character;
  const die = HIT_DIE[d.className] ?? 8;
  const conMod = abilityMod(ch.con);

  // 1) apply the level
  let targetClass = ch.classes.find((c) => c.classId === d.className);
  if (d.isNewClass && !targetClass) {
    await prisma.characterClass.create({ data: { characterId: id, classId: d.className, level: 1, isPrimary: false, subclass: d.subclass ?? null } });
  } else if (targetClass) {
    if (targetClass.level >= 20) return bad("Already max level for this class");
    await prisma.characterClass.update({ where: { id: targetClass.id }, data: { level: targetClass.level + 1, ...(d.subclass ? { subclass: d.subclass } : {}) } });
  } else {
    return bad("Class not found on character");
  }

  // 2) HP gain — derive() uses the average per level; store the (roll - average) delta in maxHpBonus
  const avg = Math.floor(die / 2) + 1;
  let hpDelta = 0;
  if (d.hpMode === "roll") {
    const roll = Math.max(1, Math.min(die, d.hpRoll ?? avg));
    hpDelta = roll - avg;            // keep derive's average baseline correct
  } else if (d.hpMode === "max") {
    hpDelta = die - avg;
  }
  let newMaxHpBonus = ch.maxHpBonus + hpDelta;

  // 3) ASI or feat
  const abilityPatch: Partial<Record<Ability, number>> = {};
  if (d.asi) {
    for (const [k, v] of Object.entries(d.asi)) {
      const cur = (ch as any)[k] as number;
      abilityPatch[k as Ability] = Math.min(20, cur + (v as number));
    }
  }
  let featuresJson = ch.featuresJson;
  if (d.feat) {
    let feats: any[] = [];
    try { feats = JSON.parse(ch.featuresJson || "[]"); } catch {}
    feats.push({ type: "feat", name: d.feat.name, description: d.feat.description ?? "" });
    featuresJson = JSON.stringify(feats);
  }

  await prisma.character.update({
    where: { id },
    data: { maxHpBonus: newMaxHpBonus, featuresJson, ...abilityPatch },
  });

  // 4) bump current HP by the max-HP increase
  const after = await loadCharacterView(id);
  const gained = after!.derived.maxHp - view.derived.maxHp;
  const newCurrent = Math.min(after!.derived.maxHp, ch.currentHp + Math.max(0, gained));
  await prisma.character.update({ where: { id }, data: { currentHp: newCurrent } });

  if (ch.campaignId) emitToCampaign(ch.campaignId, "character:updated", { characterId: id, patch: { levelup: true }, by: user.id });
  return NextResponse.json({ ok: true, maxHp: after!.derived.maxHp, currentHp: newCurrent, totalLevel: after!.derived.totalLevel });
}
