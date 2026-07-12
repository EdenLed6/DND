import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { MAP_LIBRARY, MAP_ICON } from "@/lib/maps/library";

export async function GET() {
  const { user, res } = await requireUser();
  if (!user) return res!;
  return NextResponse.json(MAP_LIBRARY.map((p) => ({ ...p, icon: MAP_ICON[p.category] })));
}
