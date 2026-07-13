import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { TopNav } from "@/components/TopNav";
import { levelForXp } from "@/lib/dnd/rules";
import { DmHomeActions } from "./DmHomeActions";

// DM Home (SPEC-DM §2): campaign command center with the DS dark-wood sidebar.
export default async function DmHome() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const campaigns = await prisma.campaign.findMany({
    where: { dmId: user.id },
    include: {
      _count: { select: { members: true, characters: true } },
      characters: { select: { xp: true } },
      encounters: { where: { status: "ACTIVE" }, select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const partyLevel = (chars: { xp: number }[]) =>
    chars.length ? Math.round(chars.reduce((s, c) => s + levelForXp(c.xp), 0) / chars.length) : 0;

  return (
    <div>
      <TopNav user={user} />
      <div className="mx-auto flex max-w-6xl gap-0 md:gap-6 md:p-6">
        {/* DS dark-wood DM sidebar (desktop) */}
        <aside className="hidden w-56 shrink-0 self-start rounded-xl border border-[#60452E] bg-gradient-to-b from-[#2B2119] via-[#3A2A1F] to-[#201711] p-4 text-[#F7EEDC] md:block">
          <div className="mb-4 border-b border-[#D7C08A]/25 pb-3">
            <div className="font-display text-sm text-[#E8CC91]">Dungeon Master</div>
            <div className="mt-1 text-xs text-[#C8BBA6]">{user.displayName}</div>
          </div>
          <nav className="grid gap-1 text-sm font-semibold">
            <span className="px-2 pt-1 text-[9px] uppercase tracking-[.13em] text-[#A99782]">Campaigns</span>
            <Link href="/dm" className="rounded-lg bg-[#B58A42]/20 px-3 py-2 text-white">Dashboard</Link>
            {campaigns.slice(0, 5).map((c) => (
              <Link key={c.id} href={`/campaigns/${c.id}`} className="truncate rounded-lg px-3 py-2 text-[#DCCFBE] hover:bg-[#B58A42]/15 hover:text-white">{c.name}</Link>
            ))}
            <span className="px-2 pt-3 text-[9px] uppercase tracking-[.13em] text-[#A99782]">Library</span>
            <Link href="/compendium" className="rounded-lg px-3 py-2 text-[#DCCFBE] hover:bg-[#B58A42]/15 hover:text-white">Enemies &amp; Rules</Link>
            <Link href="/dashboard" className="rounded-lg px-3 py-2 text-[#DCCFBE] hover:bg-[#B58A42]/15 hover:text-white">My Characters</Link>
            <Link href="/portal?choose=1" className="rounded-lg px-3 py-2 text-[#DCCFBE] hover:bg-[#B58A42]/15 hover:text-white">Switch Portal</Link>
          </nav>
        </aside>

        <main className="min-w-0 flex-1 space-y-6 p-4 md:p-0">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[.16em] text-heading">Dungeon Master Portal</div>
            <h1 className="font-display text-2xl text-gold">Campaign Dashboard</h1>
          </div>

          <DmHomeActions />

          {campaigns.length === 0 ? (
            <div className="card">
              <p className="muted">You are not running any campaigns yet. Create one to get started.</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {campaigns.map((c) => (
                <div key={c.id} className="card space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <Link href={`/campaigns/${c.id}`} className="font-display text-lg text-gold hover:underline">{c.name}</Link>
                      {c.description && <p className="muted line-clamp-1 text-sm">{c.description}</p>}
                    </div>
                    {c.encounters.length > 0 && (
                      <Link href={`/play/${c.encounters[0].id}`} className="chip chip-gold whitespace-nowrap" title={c.encounters[0].name}>⚔ Live</Link>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="stat-box"><span className="text-[9px] uppercase text-[#5e5448]">Players</span><b className="font-display text-lg">{c._count.members}</b></div>
                    <div className="stat-box"><span className="text-[9px] uppercase text-[#5e5448]">Characters</span><b className="font-display text-lg">{c._count.characters}</b></div>
                    <div className="stat-box"><span className="text-[9px] uppercase text-[#5e5448]">Party Level</span><b className="font-display text-lg">{partyLevel(c.characters) || "—"}</b></div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/campaigns/${c.id}`} className="btn-primary flex-1 justify-center">Open Campaign</Link>
                    <Link href={`/campaigns/${c.id}#combat`} className="btn-gold">Encounters</Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
