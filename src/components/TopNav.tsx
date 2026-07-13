"use client";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";

export function TopNav({ user }: { user: { displayName: string } }) {
  const router = useRouter();
  const pathname = usePathname();
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login"); router.refresh();
  }
  const active = (href: string) => pathname === href || (href !== "/dashboard" && pathname.startsWith(href));

  return (
    <>
      {/* Top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[#cdbf9f] bg-[#fbf7ea]/95 px-4 py-3 backdrop-blur"
        style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top))" }}>
        <Link href="/dashboard" className="flex items-center gap-2 font-display text-lg text-gold">
          🐉 <span className="hidden sm:inline">Campaign Manager</span>
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          <Link href="/dashboard" className="hidden text-ink hover:text-gold sm:inline">Dashboard</Link>
          <Link href="/compendium" className="hidden text-ink hover:text-gold sm:inline">Compendium</Link>
          <span className="muted hidden max-w-[10rem] truncate sm:inline">{user.displayName}</span>
          <button onClick={logout} className="btn-ghost">Sign Out</button>
        </nav>
      </header>

      {/* Mobile bottom nav */}
      <nav className="bottom-nav sm:hidden" aria-label="Primary">
        <Link href="/dashboard" data-active={active("/dashboard")}>
          <span className="ico">🏠</span><span>Home</span>
        </Link>
        <Link href="/characters/new" data-active={active("/characters/new")}>
          <span className="ico">🎭</span><span>New</span>
        </Link>
        <Link href="/compendium" data-active={active("/compendium")}>
          <span className="ico">📚</span><span>Compendium</span>
        </Link>
      </nav>
    </>
  );
}
