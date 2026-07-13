"use client";
import { useState } from "react";
import Link from "next/link";

export default function ForgotPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    await fetch("/api/auth/forgot", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }),
    });
    setBusy(false); setSent(true);
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center p-4">
      <div className="card w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="text-4xl">🔑</div>
          <h1 className="font-display text-2xl text-gold">Reset your password</h1>
        </div>
        {sent ? (
          <div className="text-center">
            <p className="text-sm text-[#4a3a24]">If an account exists for <b>{email}</b>, we've sent a password reset link. Check your inbox (and spam).</p>
            <Link href="/login" className="btn-ghost mt-4 inline-flex">Back to sign in</Link>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <p className="text-sm text-[#6b5a42]">Enter your email and we'll send you a reset link.</p>
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <button className="btn-primary w-full" disabled={busy}>{busy ? "..." : "Send reset link"}</button>
            <Link href="/login" className="block text-center text-xs text-[#6b5a42] hover:text-gold">Back to sign in</Link>
          </form>
        )}
      </div>
    </div>
  );
}
