"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

function ResetForm() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get("token") ?? "");
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) { setError("Passwords don't match"); return; }
    setBusy(true);
    const res = await fetch("/api/auth/reset", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password }),
    });
    setBusy(false);
    if (!res.ok) { setError((await res.json()).error ?? "Reset failed"); return; }
    router.push("/dashboard"); router.refresh();
  }

  if (!token) {
    return (
      <div className="text-center">
        <p className="text-sm text-red-700">Missing or invalid reset link.</p>
        <Link href="/forgot" className="btn-ghost mt-4 inline-flex">Request a new link</Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className="label">New Password</label>
        <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
        <p className="mt-1 text-xs text-[#857866]">At least 8 characters.</p>
      </div>
      <div>
        <label className="label">Confirm Password</label>
        <input className="input" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} />
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
      <button className="btn-primary w-full" disabled={busy}>{busy ? "..." : "Set new password"}</button>
    </form>
  );
}

export default function ResetPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center p-4">
      <div className="card w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="text-4xl">🔒</div>
          <h1 className="font-display text-2xl text-gold">Choose a new password</h1>
        </div>
        <Suspense fallback={<p className="text-center text-sm text-[#5e5448]">Loading…</p>}>
          <ResetForm />
        </Suspense>
      </div>
    </div>
  );
}
