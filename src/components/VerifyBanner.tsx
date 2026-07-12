"use client";
import { useEffect, useState } from "react";

export function VerifyBanner({ verified }: { verified: boolean }) {
  const [dismissed, setDismissed] = useState(false);
  const [status, setStatus] = useState<null | "sent" | "sending" | "error">(null);
  const [flash, setFlash] = useState<null | "ok" | "invalid">(null);

  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get("verified");
    if (v === "1") setFlash("ok");
    else if (v === "invalid") setFlash("invalid");
  }, []);

  async function resend() {
    setStatus("sending");
    const res = await fetch("/api/auth/verify/resend", { method: "POST" });
    setStatus(res.ok ? "sent" : "error");
  }

  if (flash === "ok") {
    return <div className="mb-3 rounded-lg border border-[#3a5a3a] bg-[#16240f] px-4 py-2 text-sm text-green-300">✓ Your email has been verified. Thanks!</div>;
  }
  if (verified || dismissed) return flash === "invalid"
    ? <div className="mb-3 rounded-lg border border-[#5a3a3a] bg-[#241010] px-4 py-2 text-sm text-red-300">That verification link was invalid or expired.</div>
    : null;

  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#5a4a2a] bg-[#241d10] px-4 py-2 text-sm">
      <span className="text-[#d1a000]">
        ✉️ Please verify your email address to secure your account.
        {status === "sent" && <span className="ml-2 text-green-300">Verification email sent!</span>}
        {status === "error" && <span className="ml-2 text-red-300">Couldn't send — try again later.</span>}
      </span>
      <span className="flex gap-2">
        <button className="btn-ghost !py-1" onClick={resend} disabled={status === "sending" || status === "sent"}>
          {status === "sending" ? "Sending…" : "Resend email"}
        </button>
        <button className="btn-ghost !py-1" onClick={() => setDismissed(true)} aria-label="Dismiss">✕</button>
      </span>
    </div>
  );
}
