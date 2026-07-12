import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";

export default async function Home() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  const features = [
    { icon: "🎭", title: "Character Sheets", text: "Build and manage full 5e characters — abilities, spells, inventory, features, level-ups. Live on every device." },
    { icon: "📖", title: "Campaign Control", text: "As DM, run everything: XP, leveling, party gold & loot, rest, and edit any character — all in real time." },
    { icon: "⚔️", title: "Live Combat & Maps", text: "Battle maps with a 5ft grid, draggable tokens, initiative tracker, attack rolls, fog of war, and AoE tools." },
    { icon: "📚", title: "Full SRD Compendium", text: "334 monsters, 319 spells, hundreds of items, all classes, races, and rules — searchable at your fingertips." },
  ];

  return (
    <div className="min-h-[100dvh]">
      {/* Header */}
      <header className="mx-auto flex max-w-5xl items-center justify-between p-4">
        <div className="flex items-center gap-2 font-display text-lg text-gold">🐉 <span>D&D Campaign Manager</span></div>
        <div className="flex gap-2">
          <Link href="/login" className="btn-ghost">Sign In</Link>
          <Link href="/login?mode=register" className="btn-gold">Get Started</Link>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-4 pt-10 pb-8 text-center sm:pt-16">
        <div className="text-6xl">🐉</div>
        <h1 className="mt-4 font-display text-4xl leading-tight text-gold sm:text-5xl">Run your D&D 5e campaign,<br />together and in real time.</h1>
        <p className="muted mx-auto mt-4 max-w-2xl text-base sm:text-lg">
          Players manage their heroes on their phone. The Dungeon Master runs the world from any device.
          Everything syncs live — HP, spells, loot, maps, and battles.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/login?mode=register" className="btn-primary px-6 text-base">Create your free account</Link>
          <Link href="/login" className="btn-ghost px-6 text-base">Sign In</Link>
        </div>
        <p className="faint mt-3 text-xs">Install it to your phone's home screen for a full-screen app.</p>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-5xl px-4 pb-16">
        <div className="grid gap-4 sm:grid-cols-2">
          {features.map((f) => (
            <div key={f.title} className="card">
              <div className="text-3xl">{f.icon}</div>
              <h3 className="mt-2 font-display text-lg text-gold">{f.title}</h3>
              <p className="muted mt-1 text-sm">{f.text}</p>
            </div>
          ))}
        </div>

        {/* Roles */}
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="card">
            <div className="chip chip-gold mb-2">For Players</div>
            <p className="text-sm">Open your character on your phone. Track HP and spell slots with a tap, roll from your sheet, grab loot the DM hands you, and jump straight into the battle map when combat starts.</p>
          </div>
          <div className="card">
            <div className="chip chip-gold mb-2">For Dungeon Masters</div>
            <p className="text-sm">Invite players with a code, award XP and level-ups, control party gold and rests, build encounters from the bestiary, place tokens, roll enemy attacks, and reveal the map with fog of war — from phone or desktop.</p>
          </div>
        </div>

        <div className="mt-10 text-center">
          <Link href="/login?mode=register" className="btn-gold px-6 text-base">Start your campaign →</Link>
        </div>
      </section>

      <footer className="border-t border-[#2a2119] py-6 text-center text-xs text-[#7d6f5c]">
        Includes material from the System Reference Document 5.1, © Wizards of the Coast, licensed under CC-BY-4.0.
      </footer>
    </div>
  );
}
