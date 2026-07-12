import { prisma } from "@/lib/db";

export type Role = "DM" | "PLAYER" | "VIEWER";

/** Returns the user's role in a campaign, or null if not a member. */
export async function roleInCampaign(userId: string, campaignId: string): Promise<Role | null> {
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) return null;
  if (campaign.dmId === userId) return "DM";
  const m = await prisma.campaignMember.findUnique({
    where: { campaignId_userId: { campaignId, userId } },
  });
  return (m?.role as Role) ?? null;
}

export async function isDM(userId: string, campaignId: string) {
  return (await roleInCampaign(userId, campaignId)) === "DM";
}

/** Can this user edit this character? DM of its campaign, or the owner. */
export async function canEditCharacter(userId: string, characterId: string): Promise<boolean> {
  const c = await prisma.character.findUnique({ where: { id: characterId } });
  if (!c) return false;
  if (c.ownerId === userId) return true;
  if (c.campaignId) return await isDM(userId, c.campaignId);
  return false;
}

export async function canViewCampaign(userId: string, campaignId: string) {
  return (await roleInCampaign(userId, campaignId)) !== null;
}
