"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const ERRORS: Record<string, string> = {
  google_not_configured: "Google sign-in isn't configured yet.",
  google_denied: "Google sign-in was cancelled.",
  google_state: "Google sign-in failed (session mismatch). Please try again.",
  google_failed: "Google sign-in failed. Please try again.",
  google_unverified: "Your Google email isn't verified, so we can't link it to an existing account. Sign in with your password instead.",
};

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [displayName, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("mode") === "register") setMode("register");
    const err = params.get("error");
    if (err) setError(ERRORS[err] ?? "Sign-in failed.");
    fetch("/api/auth/providers").then((r) => r.json()).then((d) => setGoogleEnabled(!!d.google)).catch(() => {});
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null); setNotice(null);
    const url = mode === "login" ? "/api/auth/login" : "/api/auth/register";
    const payload = mode === "login" ? { email, password } : { email, displayName, password };
    const res = await fetch(url, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(data.error ?? "Something went wrong"); return; }
    // Register may return a neutral "pending" response (email already in use) —
    // we can't tell the client whether it was a new account, so show a notice.
    if (mode === "register" && data.pending) {
      setNotice("Check your email to finish setting up your account.");
      return;
    }
    router.push("/portal"); router.refresh();
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center p-4">
      <div className="card w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="text-4xl">🐉</div>
          <h1 className="font-display text-2xl text-gold">D&D 5e Campaign Manager</h1>
          <p className="text-sm text-[#5e5448]">Campaign management · Characters · Live combat</p>
        </div>

        <div className="mb-4 flex gap-2">
          <button className={mode === "login" ? "btn-gold flex-1" : "btn-ghost flex-1"} onClick={() => { setMode("login"); setError(null); }}>Sign In</button>
          <button className={mode === "register" ? "btn-gold flex-1" : "btn-ghost flex-1"} onClick={() => { setMode("register"); setError(null); }}>Sign Up</button>
        </div>

        {googleEnabled && (
          <>
            <a href="/api/auth/google" className="btn-ghost mb-3 w-full">
              <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs font-bold text-[#4285F4]">G</span>
              Continue with Google
            </a>
            <div className="mb-3 flex items-center gap-2 text-xs text-[#857866]">
              <div className="h-px flex-1 bg-[#dfd5b8]" /> or <div className="h-px flex-1 bg-[#dfd5b8]" />
            </div>
          </>
        )}

        <form onSubmit={submit} className="space-y-3">
          {mode === "register" && (
            <div>
              <label className="label">Display Name</label>
              <input className="input" value={displayName} onChange={(e) => setName(e.target.value)} required />
            </div>
          )}
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label className="label">Password</label>
              {mode === "login" && <Link href="/forgot" className="mb-1 text-xs text-[#5e5448] hover:text-gold">Forgot password?</Link>}
            </div>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={mode === "register" ? 8 : undefined} />
            {mode === "register" && <p className="mt-1 text-xs text-[#857866]">At least 8 characters.</p>}
          </div>
          {mode === "register" && (
            <label className="flex items-start gap-2 text-xs text-[#5e5448]">
              <input type="checkbox" className="mt-0.5" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
              <span>I agree to the <Link href="/privacy" className="text-gold underline" target="_blank">Privacy Policy</Link> and understand my email and campaign data are stored to run the service.</span>
            </label>
          )}
          {error && <p className="text-sm text-red-700">{error}</p>}
          {notice && <p className="text-sm text-emerald-700">{notice}</p>}
          <button className="btn-primary w-full" disabled={busy || (mode === "register" && !agreed)}>
            {busy ? "..." : mode === "login" ? "Sign In" : "Sign Up"}
          </button>
          {mode === "login" && (
            <p className="text-center text-xs text-[#857866]">
              By continuing you agree to our <Link href="/privacy" className="text-gold underline" target="_blank">Privacy Policy</Link>.
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
