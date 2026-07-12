import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/api";

export async function GET(req: Request) {
  const { user, res } = await requireUser();
  if (!user) return res!;
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const cr = searchParams.get("cr");
  const monsters = await prisma.srdMonster.findMany({
    where: { AND: [q ? { name: { contains: q } } : {}, cr ? { cr } : {}] },
    orderBy: { name: "asc" }, take: 40,
    select: { id: true, name: true, cr: true, type: true, size: true, ac: true, hp: true, xp: true },
  });
  return NextResponse.json(monsters);
}
