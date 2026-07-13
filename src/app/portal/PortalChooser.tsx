"use client";
import { useRouter } from "next/navigation";

function setPortalCookie(portal: "player" | "dm") {
  document.cookie = `dnd_portal=${portal}; path=/; max-age=31536000; samesite=lax`;
}

export function PortalChooser({ displayName }: { displayName: string }) {
  const router = useRouter();

  function choose(portal: "player" | "dm") {
    setPortalCookie(portal);
    router.push(portal === "dm" ? "/dm" : "/dashboard");
    router.refresh();
  }

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center p-6">
      <div className="mb-8 text-center">
        <div className="text-4xl">🐉</div>
        <h1 className="font-display text-3xl text-gold">D&D 5e Campaign Manager</h1>
        <p className="muted mt-1 text-sm">Welcome back, {displayName}. Choose how you want to enter.</p>
      </div>

      <div className="grid w-full max-w-3xl gap-4 sm:grid-cols-2">
        <button type="button" className="card portal-card" onClick={() => choose("player")}>
          <span className="portal-card-ico" aria-hidden>
            {/* d20 hexagon */}
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
              <path d="M12 2l8.5 5v10L12 22l-8.5-5V7L12 2z" />
              <path d="M12 2v6.5M3.5 7L12 8.5 20.5 7M12 8.5l-5 8h10l-5-8zM3.5 17L7 16.5M20.5 17L17 16.5M12 22v-5.5" />
            </svg>
          </span>
          <span className="font-display text-xl text-gold">Player Portal</span>
          <span className="muted text-sm">Play your characters — sheets, spells, dice</span>
        </button>

        <button type="button" className="card portal-card" onClick={() => choose("dm")}>
          <span className="portal-card-ico" aria-hidden>
            {/* castle / DM screen */}
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
              <path d="M4 21V8l3-2 2 1.5L12 5l3 2.5L17 6l3 2v13" />
              <path d="M2 21h20M10 21v-4a2 2 0 0 1 4 0v4M4 8V4h2v2M18 8V4h-2v2" />
            </svg>
          </span>
          <span className="font-display text-xl text-gold">Dungeon Master Portal</span>
          <span className="muted text-sm">Run your campaigns — party, encounters, maps</span>
        </button>
      </div>

      <p className="faint mt-6 text-xs">You can switch portals at any time from the top navigation.</p>
    </div>
  );
}
