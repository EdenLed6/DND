import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { TopNav } from "@/components/TopNav";
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
        <DashboardActions />

        <section>
          <h2 className="mb-3 font-display text-xl text-gold">קמפיינים שאני מנחה (DM)</h2>
          {owned.length === 0 ? (
            <p className="text-sm text-[#a9977c]">עדיין אין. צור קמפיין חדש כדי להתחיל.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {owned.map((c) => (
                <Link key={c.id} href={`/campaigns/${c.id}`} className="card hover:border-gold">
                  <div className="font-display text-lg">{c.name}</div>
                  <div className="text-sm text-[#a9977c]">{c.description || "—"}</div>
                  <div className="mt-2 flex gap-2 text-xs">
                    <span className="chip">👥 {c._count.members} שחקנים</span>
                    <span className="chip">🎭 {c._count.characters} דמויות</span>
                    <span className="chip">DM</span>
                  </div>
                  <div className="mt-2 text-xs text-[#a9977c]">קוד הזמנה: <code className="text-gold">{c.inviteCode}</code></div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 font-display text-xl text-gold">קמפיינים שאני משחק בהם</h2>
          {memberships.length === 0 ? (
            <p className="text-sm text-[#a9977c]">הצטרף לקמפיין עם קוד הזמנה מה-DM.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {memberships.map((m) => (
                <Link key={m.id} href={`/campaigns/${m.campaign.id}`} className="card hover:border-gold">
                  <div className="font-display text-lg">{m.campaign.name}</div>
                  <div className="text-sm text-[#a9977c]">DM: {m.campaign.dm.displayName}</div>
                  <span className="chip mt-2">{m.role === "PLAYER" ? "שחקן" : "צופה"}</span>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 font-display text-xl text-gold">הדמויות שלי</h2>
          {characters.length === 0 ? (
            <p className="text-sm text-[#a9977c]">צור דמות חדשה.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {characters.map((ch) => {
                const cls = ch.classes.map((c) => `L${c.level}`).join(" / ");
                return (
                  <Link key={ch.id} href={`/characters/${ch.id}`} className="card hover:border-gold">
                    <div className="font-display text-lg">{ch.name}</div>
                    <div className="text-sm text-[#a9977c]">
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
