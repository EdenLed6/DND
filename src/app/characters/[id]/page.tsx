import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { loadCharacterView } from "@/lib/character-view";
import { roleInCampaign } from "@/lib/auth/rbac";
import { TopNav } from "@/components/TopNav";
import { DiceTray } from "@/components/DiceTray";
import { RollFeedListener } from "@/components/RollFeedListener";
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
    <div className="has-dice-tray">
      <TopNav user={user} />
      <CharacterSheet
        initialCharacter={serialize(view.character)}
        derived={view.derived}
        spellDetails={serialize(view.spellDetails ?? [])}
        features={serialize(view.features ?? [])}
        weapons={view.weapons ?? []}
        encumbrance={view.encumbrance}
        resources={view.resources}
        senses={view.senses}
        proficiencies={view.proficiencies}
        canEdit={canEdit}
        isDM={isDM}
      />
      <DiceTray />
      {view.character.campaignId && (
        <RollFeedListener campaignId={view.character.campaignId} selfName={user.displayName} characterName={view.character.name} />
      )}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function serialize(c: any) {
  return JSON.parse(JSON.stringify(c));
}
