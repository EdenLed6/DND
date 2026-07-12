import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { loadCharacterView } from "@/lib/character-view";
import { roleInCampaign } from "@/lib/auth/rbac";
import { TopNav } from "@/components/TopNav";
import { CharacterSheet } from "./CharacterSheet";

export default async function CharacterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const view = await loadCharacterView(id);
  if (!view) notFound();

  const isOwner = view.character.ownerId === user.id;
  const role = view.character.campaignId ? await roleInCampaign(user.id, view.character.campaignId) : null;
  const isDM = role === "DM";
  if (!isOwner && !role) redirect("/dashboard"); // no access
  const canEdit = isOwner || isDM;

  return (
    <div>
      <TopNav user={user} />
      <CharacterSheet
        initialCharacter={serialize(view.character)}
        derived={view.derived}
        canEdit={canEdit}
        isDM={isDM}
      />
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function serialize(c: any) {
  return JSON.parse(JSON.stringify(c));
}
