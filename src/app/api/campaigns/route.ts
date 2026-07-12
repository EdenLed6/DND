import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser, genInviteCode, bad } from "@/lib/api";

const schema = z.object({ name: z.string().min(1).max(100), description: z.string().max(1000).optional() });

export async function POST(req: Request) {
  const { user, res } = await requireUser();
  if (!user) return res!;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return bad("Invalid input");

  // ensure unique invite code
  let code = genInviteCode();
  for (let i = 0; i < 5; i++) {
    if (!(await prisma.campaign.findUnique({ where: { inviteCode: code } }))) break;
    code = genInviteCode();
  }

  const campaign = await prisma.campaign.create({
    data: {
      name: parsed.data.name,
      description: parsed.data.description,
      dmId: user.id,
      inviteCode: code,
      members: { create: { userId: user.id, role: "DM" } },
    },
  });
  return NextResponse.json(campaign);
}

export async function GET() {
  const { user, res } = await requireUser();
  if (!user) return res!;
  const campaigns = await prisma.campaign.findMany({
    where: { OR: [{ dmId: user.id }, { members: { some: { userId: user.id } } }] },
  });
  return NextResponse.json(campaigns);
}
