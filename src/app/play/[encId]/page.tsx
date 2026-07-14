import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { roleInCampaign } from "@/lib/auth/rbac";
import { resolveSettings } from "@/lib/campaign-settings";
import { encounterState, filterStateForRole } from "@/lib/combat-service";
import { TopNav } from "@/components/TopNav";
import { PlayScreen } from "./PlayScreen";

export default async function PlayPage({ params }: { params: Promise<{ encId: string }> }) {
  const { encId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const enc = await prisma.encounter.findUnique({ where: { id: encId } });
  if (!enc) notFound();
  const role = await roleInCampaign(user.id, enc.campaignId);
  if (!role) redirect("/dashboard");
  const isDM = role === "DM";

  // Players cannot open an encounter the DM is still prepping.
  if (!isDM && enc.status === "PLANNING") redirect(`/campaigns/${enc.campaignId}`);

  const campaign = await prisma.campaign.findUnique({ where: { id: enc.campaignId } });
  const enemyHpVisible = campaign ? resolveSettings(campaign.settingsJson, campaign.xpMode).enemyHpVisible : false;

  const [rawState, campaignChars, allMaps, myChars] = await Promise.all([
    encounterState(encId),
    prisma.character.findMany({ where: { campaignId: enc.campaignId }, select: { id: true, name: true } }),
    prisma.gameMap.findMany({ where: { campaignId: enc.campaignId } }),
    prisma.character.findMany({ where: { campaignId: enc.campaignId, ownerId: user.id }, select: { id: true } }),
  ]);
  // Redact DM-hidden combatants/tokens/stat blocks/exact HP + log for players.
  const state = filterStateForRole(rawState, isDM, enemyHpVisible);
  // The full map library is DM prep — players only get the map used by THIS encounter.
  const maps = isDM ? allMaps : allMaps.filter((m) => m.id === enc.mapId);

  return (
    <div>
      <TopNav user={user} />
      <PlayScreen
        encId={encId}
        campaignId={enc.campaignId}
        initialState={JSON.parse(JSON.stringify(state))}
        campaignChars={campaignChars}
        maps={JSON.parse(JSON.stringify(maps))}
        isDM={isDM}
        myCharacterIds={myChars.map((c) => c.id)}
      />
    </div>
  );
}
