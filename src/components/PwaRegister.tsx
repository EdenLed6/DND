"use client";
import { useEffect, useState } from "react";

export function PwaRegister() {
  const [prompt, setPrompt] = useState<any>(null);
  const [dismissed, setDismissed] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [standalone, setStandalone] = useState(true);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const inStandalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true;
    setIsIOS(ios);
    setStandalone(inStandalone);
    if (typeof localStorage !== "undefined" && localStorage.getItem("pwa-dismissed") === "1") setDismissed(true);

    const onPrompt = (e: any) => { e.preventDefault(); setPrompt(e); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  function dismiss() { setDismissed(true); try { localStorage.setItem("pwa-dismissed", "1"); } catch {} }

  async function install() {
    if (!prompt) return;
    prompt.prompt();
    await prompt.userChoice;
    setPrompt(null); dismiss();
  }

  if (standalone || dismissed) return null;
  // Android/desktop: show button when the browser offers install. iOS: show manual hint.
  if (!prompt && !isIOS) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] p-3" style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}>
      <div className="mx-auto flex max-w-md items-center gap-3 rounded-xl border border-[#3a2f24] bg-[#1c1712] p-3 shadow-2xl">
        <img src="/icons/icon-192.png" alt="" width={40} height={40} className="rounded-lg" />
        <div className="flex-1 text-sm">
          <div className="font-display text-gold">Install the app</div>
          {isIOS ? (
            <div className="muted text-xs">Tap the Share icon, then “Add to Home Screen”.</div>
          ) : (
            <div className="muted text-xs">Add to your home screen for a full-screen app.</div>
          )}
        </div>
        {!isIOS && <button className="btn-gold" onClick={install}>Install</button>}
        <button className="btn-ghost" onClick={dismiss} aria-label="Dismiss">✕</button>
      </div>
    </div>
  );
}
