import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/api";

/** Search SRD equipment or magic items for the inventory picker. */
export async function GET(req: Request) {
  const { user, res } = await requireUser();
  if (!user) return res!;
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") ?? "equipment";
  const q = searchParams.get("q") ?? "";

  if (type === "magic") {
    const rows = await prisma.srdMagicItem.findMany({
      where: q ? { name: { contains: q } } : {}, orderBy: { name: "asc" }, take: 40,
      select: { id: true, name: true, rarity: true, type: true, requiresAttunement: true },
    });
    return NextResponse.json(rows.map((r) => ({ ...r, kind: "magic" })));
  }
  const rows = await prisma.srdEquipment.findMany({
    where: q ? { name: { contains: q } } : {}, orderBy: { name: "asc" }, take: 40,
    select: { id: true, name: true, category: true, costGp: true, costUnit: true, weight: true,
      damageDice: true, damageType: true, armorCategory: true, acBase: true },
  });
  return NextResponse.json(rows.map((r) => ({ ...r, kind: "equipment" })));
}
