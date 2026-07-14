// GDPR Art. 15/20 — full account data export (machine-readable JSON).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/api";

export async function GET() {
  const { user, res } = await requireUser();
  if (!user) return res!;

  const [full, characters, memberships, ownedCampaigns, homebrew, characterNotes] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, email: true, displayName: true, avatarUrl: true, googleId: true, emailVerified: true, createdAt: true },
    }),
    prisma.character.findMany({ where: { ownerId: user.id } }),
    prisma.campaignMember.findMany({
      where: { userId: user.id },
      select: { campaignId: true, role: true, createdAt: true, campaign: { select: { name: true } } },
    }),
    prisma.campaign.findMany({
      where: { dmId: user.id },
      include: { npcs: true, quests: true, dmNotes: true, sessions: true, notes: true },
    }),
    prisma.homebrewMonster.findMany({ where: { ownerId: user.id } }),
    prisma.characterNote.findMany({ where: { character: { ownerId: user.id } } }),
  ]);

  const bundle = {
    exportedAt: new Date().toISOString(),
    account: full,
    characters,
    characterNotes,
    campaignMemberships: memberships,
    campaignsAsDM: ownedCampaigns,
    homebrewMonsters: homebrew,
  };

  return new NextResponse(JSON.stringify(bundle, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="my-dnd-data-${user.id}.json"`,
    },
  });
}
