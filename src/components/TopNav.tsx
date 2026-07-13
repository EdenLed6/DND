"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PlayerNav } from "@/components/PlayerNav";

export function TopNav({ user }: { user: { displayName: string } }) {
  const router = useRouter();
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login"); router.refresh();
  }

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
          <Link href="/portal?choose=1" className="muted hidden text-xs hover:text-gold sm:inline">Switch Portal</Link>
          <button onClick={logout} className="btn-ghost">Sign Out</button>
        </nav>
      </header>

      {/* Mobile bottom nav (Player Portal) */}
      <PlayerNav />
    </>
  );
}
