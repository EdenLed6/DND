import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { TopNav } from "@/components/TopNav";
import { VerifyBanner } from "@/components/VerifyBanner";
import { DashboardActions } from "./DashboardActions";
import { levelForXp } from "@/lib/dnd/rules";

export default async function Dashboard() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [owned, memberships, characters] = await Promise.all([
    prisma.campaign.findMany({ where: { dmId: user.id }, include: { _count: { select: { members: true, characters: true } } } }),
    prisma.campaignMember.findMany({
      where: { userId: user.id, role: { not: "DM" } },
      include: { campaign: { include: { dm: true } } },
    }),
    prisma.character.findMany({ where: { ownerId: user.id }, include: { classes: true, campaign: true } }),
  ]);

  return (
    <div>
      <TopNav user={user} />
      <main className="mx-auto max-w-5xl space-y-8 p-6">
        <VerifyBanner verified={!!(user as { emailVerified?: Date | null }).emailVerified} />
        <DashboardActions />

        <section>
          <h2 className="mb-3 font-display text-xl text-gold">Campaigns I DM</h2>
          {owned.length === 0 ? (
            <p className="text-sm text-[#6b5a42]">Nothing yet. Create a new campaign to get started.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {owned.map((c) => (
                <Link key={c.id} href={`/campaigns/${c.id}`} className="card hover:border-gold">
                  <div className="font-display text-lg">{c.name}</div>
                  <div className="text-sm text-[#6b5a42]">{c.description || "—"}</div>
                  <div className="mt-2 flex gap-2 text-xs">
                    <span className="chip">👥 {c._count.members} players</span>
                    <span className="chip">🎭 {c._count.characters} characters</span>
                    <span className="chip">DM</span>
                  </div>
                  <div className="mt-2 text-xs text-[#6b5a42]">Invite code: <code className="text-gold">{c.inviteCode}</code></div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 font-display text-xl text-gold">Campaigns I Play In</h2>
          {memberships.length === 0 ? (
            <p className="text-sm text-[#6b5a42]">Join a campaign with an invite code from your DM.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {memberships.map((m) => (
                <Link key={m.id} href={`/campaigns/${m.campaign.id}`} className="card hover:border-gold">
                  <div className="font-display text-lg">{m.campaign.name}</div>
                  <div className="text-sm text-[#6b5a42]">DM: {m.campaign.dm.displayName}</div>
                  <span className="chip mt-2">{m.role === "PLAYER" ? "Player" : "Spectator"}</span>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 font-display text-xl text-gold">My Characters</h2>
          {characters.length === 0 ? (
            <p className="text-sm text-[#6b5a42]">Create a new character.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {characters.map((ch) => {
                const cls = ch.classes.map((c) => `L${c.level}`).join(" / ");
                return (
                  <Link key={ch.id} href={`/characters/${ch.id}`} className="card hover:border-gold">
                    <div className="font-display text-lg">{ch.name}</div>
                    <div className="text-sm text-[#6b5a42]">
                      Level {levelForXp(ch.xp)} · {ch.classes.map((c) => c.classId).join(", ") || "—"} {cls}
                    </div>
                    {ch.campaign && <span className="chip mt-2">📖 {ch.campaign.name}</span>}
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
