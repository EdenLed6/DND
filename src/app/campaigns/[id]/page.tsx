import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { roleInCampaign } from "@/lib/auth/rbac";
import { loadCharacterView } from "@/lib/character-view";
import { levelForXp } from "@/lib/dnd/rules";
import { TopNav } from "@/components/TopNav";
import { CampaignView } from "./CampaignView";

export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: { dm: true, members: { include: { user: true } }, loot: true, encounters: true, maps: true },
  });
  if (!campaign) notFound();
  const role = await roleInCampaign(user.id, id);
  if (!role) redirect("/dashboard");
  const isDM = role === "DM";

  const chars = await prisma.character.findMany({ where: { campaignId: id }, include: { owner: true, classes: true } });
  const party = await Promise.all(chars.map(async (ch) => {
    const view = await loadCharacterView(ch.id);
    return {
      id: ch.id, name: ch.name, owner: ch.owner.displayName, ownerId: ch.ownerId,
      race: ch.raceId, classes: ch.classes.map((c) => `${c.classId} ${c.level}`).join(" / "),
      level: view?.derived.totalLevel ?? 1, xp: ch.xp, levelByXp: levelForXp(ch.xp),
      canLevelUp: (view?.derived.levelByXp ?? 1) > (view?.derived.totalLevel ?? 1),
      hp: ch.currentHp, maxHp: view?.derived.maxHp ?? 0, ac: view?.derived.ac ?? 10,
      pp: view ? 10 + view.derived.skills.Perception.value : 10,
      gold: view?.derived.totalCp ?? 0,
      conditions: safeArr(ch.conditions),
    };
  }));

  return (
    <div>
      <TopNav user={user} />
      <CampaignView
        campaign={{ id: campaign.id, name: campaign.name, description: campaign.description,
          // The invite code is DM-only material (used with the email invite).
          inviteCode: isDM ? campaign.inviteCode : null, partyGoldCp: campaign.partyGoldCp, xpMode: campaign.xpMode,
          dmName: campaign.dm.displayName }}
        members={campaign.members.map((m) => ({ id: m.id, name: m.user.displayName, role: m.role, userId: m.userId }))}
        party={party}
        loot={campaign.loot.map((l) => ({ id: l.id, name: l.name, quantity: l.quantity, goldValueCp: l.goldValueCp }))}
        // Players only see encounters that are underway; PLANNING is DM prep.
        encounters={campaign.encounters
          .filter((e) => isDM || e.status !== "PLANNING")
          .map((e) => ({ id: e.id, name: e.name, status: e.status }))}
        maps={isDM ? campaign.maps.map((m) => ({ id: m.id, name: m.name })) : []}
        isDM={isDM}
        me={{ id: user.id, name: user.displayName }}
      />
    </div>
  );
}

function safeArr(s: any): string[] { try { return JSON.parse(s); } catch { return []; } }
