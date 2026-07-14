import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, bad } from "@/lib/api";
import { canEditCharacter } from "@/lib/auth/rbac";
import { CASTER_TYPE, CASTING_ABILITY, abilityMod, spellSlots, pactSlots } from "@/lib/dnd/rules";
import { isPreparedCaster, prepareLimit, maxCastableSpellLevel } from "@/lib/dnd/spell-casting";

// Homebrew dataJson mirrors SrdSpell: {level, school, castingTime, range, duration, components, desc, classes, ...}
function parseHomebrew(row: { id: string; name: string; dataJson: string }) {
  let d: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(row.dataJson || "{}");
    if (parsed && typeof parsed === "object") d = parsed;
  } catch { /* empty */ }
  return {
    id: row.id,
    name: row.name,
    level: Number(d.level) || 0,
    school: (d.school as string) ?? null,
    castingTime: (d.castingTime as string) ?? null,
    concentration: !!d.concentration,
    ritual: !!d.ritual,
    classes: Array.isArray(d.classes) ? (d.classes as unknown[]).map((x) => String(x)) : null,
    homebrew: true as const,
  };
}

type PickerSpell = {
  id: number | string;
  name: string;
  level: number;
  school: string | null;
  castingTime?: string | null;
  concentration?: boolean;
  ritual?: boolean;
  homebrew: boolean;
  known: boolean;
  prepared: boolean;
  alwaysPrepared: boolean;
};

/**
 * GET spell-picker — everything this character can learn/prepare.
 *
 * Returns the caster meta (prepared vs. known, prepare limit/count, max castable
 * level, slot totals for pips) plus:
 *   - `available`: the full class spell list at castable levels + merged homebrew
 *     (campaign OR owner), each flagged with whether it's currently known/prepared.
 *   - `known`: the character's current spellbook resolved to spell details.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, res } = await requireUser();
  if (!user) return res!;
  if (!(await canEditCharacter(user.id, id))) return bad("Not authorized", 403);

  const c = await prisma.character.findUnique({ where: { id }, include: { classes: true, spells: true } });
  if (!c) return bad("Character not found", 404);

  const classes = c.classes.map((cl) => ({ name: cl.classId, level: cl.level, isPrimary: cl.isPrimary }));
  const casters = classes.filter((cl) => CASTER_TYPE[cl.name] && CASTER_TYPE[cl.name] !== "none");
  const primary = casters.find((cl) => cl.isPrimary) ?? casters[0] ?? null;
  const casterClass = primary?.name ?? null;
  const casterNames = casters.map((cl) => cl.name);

  const slots = spellSlots(classes);
  const pact = pactSlots(classes);
  const maxSpellLevel = maxCastableSpellLevel(slots, pact);
  const preparedCaster = isPreparedCaster(casterClass);
  const ability = casterClass ? CASTING_ABILITY[casterClass] : undefined;
  const mod = ability ? abilityMod(c[ability]) : 0;
  const limit = preparedCaster && primary ? prepareLimit(primary.level, mod) : 0;

  // ---- Current spellbook: {spellId → {prepared, alwaysPrepared}} ----
  const bySpellId = new Map(c.spells.map((s) => [s.spellId, s]));

  // ---- Resolve the known list to spell details (SRD numeric ids + homebrew cuids) ----
  const srdKnownIds = c.spells.map((s) => Number(s.spellId)).filter((n) => !isNaN(n));
  const hbKnownIds = c.spells.map((s) => s.spellId).filter((sid) => isNaN(Number(sid)));
  const [srdKnown, hbKnown] = await Promise.all([
    srdKnownIds.length
      ? prisma.srdSpell.findMany({
          where: { id: { in: srdKnownIds } },
          select: { id: true, name: true, level: true, school: true, castingTime: true, concentration: true, ritual: true },
        })
      : Promise.resolve([]),
    hbKnownIds.length ? prisma.homebrewSpell.findMany({ where: { id: { in: hbKnownIds } } }) : Promise.resolve([]),
  ]);
  const srdKnownById = new Map(srdKnown.map((s) => [String(s.id), s]));
  const hbKnownById = new Map(hbKnown.map((h) => [h.id, parseHomebrew(h)]));
  const known = c.spells
    .map((cs) => {
      const detail = srdKnownById.get(cs.spellId) ?? hbKnownById.get(cs.spellId);
      if (!detail) return null;
      return { ...detail, homebrew: "homebrew" in detail, prepared: cs.prepared, alwaysPrepared: cs.alwaysPrepared, source: cs.source };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));

  const preparedCount = known.filter((k) => k.level > 0 && k.prepared && !k.alwaysPrepared).length;

  // ---- Available list: full class spell list at castable levels + homebrew (campaign OR owner) ----
  const available: PickerSpell[] = [];
  if (casterNames.length && maxSpellLevel >= 0) {
    const hbWhere: { campaignId?: string; ownerId?: string }[] = [{ ownerId: c.ownerId }];
    if (c.campaignId) hbWhere.push({ campaignId: c.campaignId });

    const [srdAvail, hbAvail] = await Promise.all([
      prisma.srdSpell.findMany({
        where: {
          level: { lte: maxSpellLevel },
          OR: casterNames.map((n) => ({ classes: { contains: `"${n.toLowerCase()}"` } })),
        },
        orderBy: [{ level: "asc" }, { name: "asc" }],
        select: { id: true, name: true, level: true, school: true, castingTime: true, concentration: true, ritual: true },
      }),
      prisma.homebrewSpell.findMany({ where: { OR: hbWhere } }),
    ]);

    for (const s of srdAvail) {
      const cs = bySpellId.get(String(s.id));
      available.push({
        id: s.id, name: s.name, level: s.level, school: s.school, castingTime: s.castingTime,
        concentration: s.concentration, ritual: s.ritual, homebrew: false,
        known: !!cs, prepared: !!cs?.prepared, alwaysPrepared: !!cs?.alwaysPrepared,
      });
    }
    const seen = new Set<string>();
    for (const row of hbAvail) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      const h = parseHomebrew(row);
      if (h.level > maxSpellLevel) continue;
      // Respect a homebrew's declared class list when present; otherwise offer it to any caster.
      if (h.classes && h.classes.length && !h.classes.some((hc) => casterNames.some((cn) => cn.toLowerCase() === hc.toLowerCase()))) continue;
      const cs = bySpellId.get(String(h.id));
      available.push({
        id: h.id, name: h.name, level: h.level, school: h.school, castingTime: h.castingTime,
        concentration: h.concentration, ritual: h.ritual, homebrew: true,
        known: !!cs, prepared: !!cs?.prepared, alwaysPrepared: !!cs?.alwaysPrepared,
      });
    }
    available.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
  }

  return NextResponse.json({
    casterClass,
    casterKind: casterClass ? (preparedCaster ? "prepared" : "known") : null,
    preparedCaster,
    ability: ability ?? null,
    abilityMod: mod,
    casterLevel: primary?.level ?? 0,
    prepareLimit: limit,
    preparedCount,
    maxSpellLevel,
    slots,              // max slots per level (index 0 = L1) — for slot pips
    pact,               // { slots, level } | null
    known,
    available,
  });
}
