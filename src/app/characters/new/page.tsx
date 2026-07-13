import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { TopNav } from "@/components/TopNav";
import { CharacterWizard } from "./CharacterWizard";

export default async function NewCharacter({ searchParams }: { searchParams: Promise<{ campaign?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { campaign } = await searchParams;
  let campaignName: string | null = null;
  if (campaign) {
    const c = await prisma.campaign.findUnique({ where: { id: campaign } });
    campaignName = c?.name ?? null;
  }
  return (
    <div>
      <TopNav user={user} />
      <main className="mx-auto max-w-3xl p-6">
        <h1 className="mb-1 font-display text-2xl text-gold">Create New Character</h1>
        {campaignName && <p className="mb-4 text-sm text-[#5e5448]">In campaign: {campaignName}</p>}
        <CharacterWizard campaignId={campaign ?? null} />
      </main>
    </div>
  );
}
