"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function ProfileActions({ hasPassword }: { hasPassword: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function signOut() {
    setBusy(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  async function deleteAccount() {
    setBusy(true); setErr(null);
    const res = await fetch("/api/account", {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm, password: hasPassword ? password : undefined }),
    });
    setBusy(false);
    if (!res.ok) { setErr((await res.json().catch(() => ({}))).error ?? "Could not delete account"); return; }
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn-primary" onClick={signOut} disabled={busy}>
          {busy ? "..." : "Sign Out"}
        </button>
        <Link href="/portal?choose=1" className="btn-ghost">Switch Portal</Link>
      </div>

      <div className="border-t border-[#dfd5b8] pt-4">
        <h3 className="mb-1 font-display text-gold">Your data &amp; privacy</h3>
        <p className="muted mb-3 text-sm">Download everything we hold about you, or permanently delete your account. See our <Link href="/privacy" className="link-gold">Privacy Policy</Link>.</p>
        <div className="flex flex-wrap items-center gap-2">
          <a href="/api/account/export" className="btn-ghost">⬇ Download my data</a>
          {!showDelete
            ? <button className="btn-ghost !text-red-700" onClick={() => setShowDelete(true)}>Delete my account</button>
            : null}
        </div>
      </div>

      {showDelete && (
        <div className="rounded-lg border border-red-300 bg-red-50/60 p-4">
          <h4 className="font-display text-red-800">Delete account permanently</h4>
          <p className="mt-1 text-sm text-red-900/80">
            This deletes your account, characters, and any campaigns you run as DM (including all
            their content and members&apos; shared data). This <b>cannot be undone</b>.
          </p>
          {hasPassword && (
            <div className="mt-3">
              <label className="label">Confirm your password</label>
              <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
          )}
          <div className="mt-3">
            <label className="label">Type <b>DELETE</b> to confirm</label>
            <input className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="DELETE" />
          </div>
          {err && <p className="mt-2 text-sm text-red-700">{err}</p>}
          <div className="mt-3 flex gap-2">
            <button className="btn-ghost" onClick={() => { setShowDelete(false); setErr(null); }} disabled={busy}>Cancel</button>
            <button className="btn-primary !bg-red-700" disabled={busy || confirm !== "DELETE"} onClick={deleteAccount}>
              {busy ? "Deleting…" : "Permanently delete"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
