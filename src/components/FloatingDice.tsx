"use client";
// Floating dice action button — SPEC-v2 §5 + SPEC-PLAYER §19.6.
// Tapping toggles the 3D Dice Builder drawer; if the 3D overlay is
// unavailable (no WebGL / reduced motion / disabled), falls back to the
// original behavior of rolling a d20 into the dice tray.
import { useState } from "react";
import { rollToTray } from "@/components/DiceTray";

export function FloatingDice() {
  const [pressed, setPressed] = useState(false);

  function rollFallback() {
    rollToTray("D20", "1d20");
    window.dispatchEvent(new CustomEvent("dice-tray-expand"));
  }

  function onClick() {
    setPressed(true);
    window.setTimeout(() => setPressed(false), 180);
    void import("@/dice3d")
      .then((m) => {
        if (m.isOverlayAvailable()) m.toggleBuilder();
        else rollFallback();
      })
      .catch(() => rollFallback());
  }

  return (
    <button
      type="button"
      className={`fab-dice${pressed ? " is-pressed" : ""}`}
      onClick={onClick}
      aria-label="Open dice builder"
      title="Dice builder"
    >
      <svg
        width="26"
        height="26"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M12 2l8.5 5v10L12 22l-8.5-5V7L12 2z" />
        <path d="M12 2v5.5M3.5 7L12 7.5 20.5 7M12 7.5L7 15h10l-5-7.5zM3.5 17L7 15M20.5 17L17 15M12 22l-5-7M12 22l5-7" />
      </svg>
    </button>
  );
}
