import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { roleInCampaign } from "@/lib/auth/rbac";
import { encounterState } from "@/lib/combat-service";
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

  const [state, campaignChars, maps, myChars] = await Promise.all([
    encounterState(encId),
    prisma.character.findMany({ where: { campaignId: enc.campaignId }, select: { id: true, name: true } }),
    prisma.gameMap.findMany({ where: { campaignId: enc.campaignId } }),
    prisma.character.findMany({ where: { campaignId: enc.campaignId, ownerId: user.id }, select: { id: true } }),
  ]);

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
