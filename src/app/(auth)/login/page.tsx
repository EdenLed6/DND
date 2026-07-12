"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [displayName, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    const url = mode === "login" ? "/api/auth/login" : "/api/auth/register";
    const payload = mode === "login" ? { email, password } : { email, displayName, password };
    const res = await fetch(url, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    });
    setBusy(false);
    if (!res.ok) { setError((await res.json()).error ?? "Something went wrong"); return; }
    router.push("/dashboard"); router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="card w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="text-4xl">🐉</div>
          <h1 className="font-display text-2xl text-gold">D&D 5e Campaign Manager</h1>
          <p className="text-sm text-[#a9977c]">Campaign management · Characters · Live combat</p>
        </div>
        <div className="mb-4 flex gap-2">
          <button className={mode === "login" ? "btn-gold flex-1" : "btn-ghost flex-1"} onClick={() => setMode("login")}>Sign In</button>
          <button className={mode === "register" ? "btn-gold flex-1" : "btn-ghost flex-1"} onClick={() => setMode("register")}>Sign Up</button>
        </div>
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
            <label className="label">Password</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button className="btn-primary w-full" disabled={busy}>
            {busy ? "..." : mode === "login" ? "Sign In" : "Sign Up"}
          </button>
        </form>
      </div>
    </div>
  );
}
