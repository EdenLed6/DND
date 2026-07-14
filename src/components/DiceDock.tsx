"use client";
// Global dice surface: the collapsible bottom Dice Tray + the floating dice
// builder button, available on every authenticated page (no dedicated route).
// Hidden on public / auth pages where there's no character context.
import { usePathname } from "next/navigation";
import { DiceTray } from "@/components/DiceTray";
import { FloatingDice } from "@/components/FloatingDice";

const HIDDEN = ["/", "/login", "/portal", "/privacy", "/forgot", "/reset", "/offline"];

export function DiceDock() {
  const pathname = usePathname() || "/";
  if (HIDDEN.includes(pathname)) return null;
  return (
    <>
      <FloatingDice />
      <DiceTray />
    </>
  );
}
