import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { TopNav } from "@/components/TopNav";
import { ContentManager } from "./ContentManager";

// Campaign Content Library (Agent E). DM-facing screen to browse the merged
// SRD + homebrew catalogue of spells, equipment, and magic items, and to author
// new homebrew scoped either to the DM's personal library or to a campaign.
export default async function LibraryPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Campaigns this user DMs — used to scope homebrew content. Writes are always
  // re-checked server-side by the homebrew APIs.
  const campaigns = await prisma.campaign.findMany({
    where: { dmId: user.id },
    select: { id: true, name: true },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div>
      <TopNav user={user} />
      <main className="mx-auto max-w-6xl space-y-4 p-4 md:p-6">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[.16em] text-heading">Dungeon Master Library</div>
          <h1 className="font-display text-2xl text-gold">Campaign Content</h1>
          <p className="muted text-sm">Browse SRD spells, equipment, and magic items, and create your own homebrew.</p>
        </div>
        <ContentManager campaigns={campaigns} />
      </main>
    </div>
  );
}
