import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/api";

/** Search spells, optionally filtered by class name and/or level. */
export async function GET(req: Request) {
  const { user, res } = await requireUser();
  if (!user) return res!;
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const klass = searchParams.get("class");
  const level = searchParams.get("level");

  const spells = await prisma.srdSpell.findMany({
    where: {
      AND: [
        q ? { name: { contains: q } } : {},
        level != null && level !== "" ? { level: Number(level) } : {},
        klass ? { classes: { contains: `"${klass}"` } } : {},
      ],
    },
    orderBy: [{ level: "asc" }, { name: "asc" }],
    take: 300,
    select: { id: true, name: true, level: true, school: true, castingTime: true, concentration: true, ritual: true },
  });
  return NextResponse.json(spells);
}
