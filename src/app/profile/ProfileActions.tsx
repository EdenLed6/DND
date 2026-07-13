"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function ProfileActions() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" className="btn-primary" onClick={signOut} disabled={busy}>
        {busy ? "..." : "Sign Out"}
      </button>
      <Link href="/portal?choose=1" className="btn-ghost">Switch Portal</Link>
    </div>
  );
}
