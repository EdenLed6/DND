import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { TopNav } from "@/components/TopNav";

const TABS = [
  { key: "spells", label: "קסמים" },
  { key: "monsters", label: "מפלצות" },
  { key: "equipment", label: "ציוד" },
  { key: "magic", label: "פריטי קסם" },
  { key: "races", label: "גזעים" },
  { key: "classes", label: "מקצועות" },
  { key: "conditions", label: "מצבים" },
] as const;

export default async function Compendium({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { tab = "spells", q = "" } = await searchParams;
  const like = { contains: q };

  let rows: { id: string | number; title: string; sub: string; href?: string }[] = [];
  if (tab === "spells") {
    const d = await prisma.srdSpell.findMany({ where: q ? { name: like } : {}, orderBy: [{ level: "asc" }, { name: "asc" }], take: 500 });
    rows = d.map((s) => ({ id: s.id, title: s.name, sub: `${s.level === 0 ? "Cantrip" : `Level ${s.level}`} · ${s.school ?? ""}` }));
  } else if (tab === "monsters") {
    const d = await prisma.srdMonster.findMany({ where: q ? { name: like } : {}, orderBy: { name: "asc" }, take: 500 });
    rows = d.map((m) => ({ id: m.id, title: m.name, sub: `CR ${m.cr} · ${m.type ?? ""} · ${m.size ?? ""} · AC ${m.ac} · HP ${m.hp}` }));
  } else if (tab === "equipment") {
    const d = await prisma.srdEquipment.findMany({ where: q ? { name: like } : {}, orderBy: { name: "asc" }, take: 500 });
    rows = d.map((e) => ({ id: e.id, title: e.name, sub: `${e.category ?? ""}${e.costGp ? ` · ${e.costGp} ${e.costUnit}` : ""}${e.damageDice ? ` · ${e.damageDice} ${e.damageType}` : ""}` }));
  } else if (tab === "magic") {
    const d = await prisma.srdMagicItem.findMany({ where: q ? { name: like } : {}, orderBy: { name: "asc" }, take: 500 });
    rows = d.map((m) => ({ id: m.id, title: m.name, sub: `${m.rarity ?? ""} · ${m.type ?? ""}${m.requiresAttunement ? " · attunement" : ""}` }));
  } else if (tab === "races") {
    const d = await prisma.srdRace.findMany({ where: q ? { name: like } : {}, orderBy: { name: "asc" } });
    rows = d.map((r) => ({ id: r.id, title: r.name, sub: `${r.size ?? ""} · speed ${r.speed}` }));
  } else if (tab === "classes") {
    const d = await prisma.srdClass.findMany({ where: q ? { name: like } : {}, orderBy: { name: "asc" } });
    rows = d.map((c) => ({ id: c.id, title: c.name, sub: `Hit die d${c.hitDie}${c.spellcastingAbility ? ` · caster (${c.spellcastingAbility})` : ""}` }));
  } else if (tab === "conditions") {
    const d = await prisma.srdCondition.findMany({ where: q ? { name: like } : {}, orderBy: { name: "asc" } });
    rows = d.map((c) => ({ id: c.id, title: c.name, sub: (c.description ?? "").slice(0, 80) + "…" }));
  }

  return (
    <div>
      <TopNav user={user} />
      <main className="mx-auto max-w-5xl space-y-4 p-6">
        <h1 className="font-display text-2xl text-gold">קומפנדיום SRD</h1>
        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <Link key={t.key} href={`/compendium?tab=${t.key}`}
              className={t.key === tab ? "btn-gold" : "btn-ghost"}>{t.label}</Link>
          ))}
        </div>
        <form className="flex gap-2">
          <input type="hidden" name="tab" value={tab} />
          <input className="input" name="q" defaultValue={q} placeholder="חיפוש לפי שם..." />
          <button className="btn-primary">חפש</button>
        </form>
        <div className="text-xs text-[#a9977c]">{rows.length} תוצאות</div>
        <div className="grid gap-2 sm:grid-cols-2">
          {rows.map((r) => (
            <div key={`${tab}-${r.id}`} className="card">
              <div className="font-display">{r.title}</div>
              <div className="text-xs text-[#a9977c]">{r.sub}</div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
