import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser, bad } from "@/lib/api";

/** Full detail for one SRD entity, for compendium modals. */
export async function GET(req: Request) {
  const { user, res } = await requireUser();
  if (!user) return res!;
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") ?? "";
  const id = Number(searchParams.get("id"));
  if (!id) return bad("id required");

  switch (type) {
    case "spells": return NextResponse.json(await prisma.srdSpell.findUnique({ where: { id } }));
    case "monsters": return NextResponse.json(await prisma.srdMonster.findUnique({ where: { id } }));
    case "equipment": return NextResponse.json(await prisma.srdEquipment.findUnique({ where: { id } }));
    case "magic": return NextResponse.json(await prisma.srdMagicItem.findUnique({ where: { id } }));
    case "races": return NextResponse.json(await prisma.srdRace.findUnique({ where: { id } }));
    case "classes": return NextResponse.json(await prisma.srdClass.findUnique({ where: { id } }));
    case "conditions": return NextResponse.json(await prisma.srdCondition.findUnique({ where: { id } }));
    default: return bad("Unknown type");
  }
}
