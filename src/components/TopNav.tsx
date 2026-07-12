"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function TopNav({ user }: { user: { displayName: string } }) {
  const router = useRouter();
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login"); router.refresh();
  }
  return (
    <header className="flex items-center justify-between border-b border-[#3a2f24] bg-[#17130f] px-4 py-3">
      <Link href="/dashboard" className="flex items-center gap-2 font-display text-lg text-gold">
        🐉 <span>Campaign Manager</span>
      </Link>
      <nav className="flex items-center gap-3 text-sm">
        <Link href="/dashboard" className="text-parchment hover:text-gold">לוח בקרה</Link>
        <Link href="/compendium" className="text-parchment hover:text-gold">קומפנדיום</Link>
        <span className="text-[#a9977c]">·</span>
        <span className="text-[#a9977c]">{user.displayName}</span>
        <button onClick={logout} className="btn-ghost">יציאה</button>
      </nav>
    </header>
  );
}
