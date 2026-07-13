import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { TopNav } from "@/components/TopNav";
import { EnemyLibrary } from "./EnemyLibrary";

// Enemy Library (SPEC-DM §9): DM-oriented bestiary — SRD monsters plus the
// user's homebrew creations. Any signed-in user may browse.
export default async function EnemiesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div>
      <TopNav user={user} />
      <main className="mx-auto max-w-6xl space-y-4 p-4 md:p-6">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[.16em] text-heading">Dungeon Master Library</div>
          <h1 className="font-display text-2xl text-gold">Enemy Library</h1>
        </div>
        <EnemyLibrary />
      </main>
    </div>
  );
}
