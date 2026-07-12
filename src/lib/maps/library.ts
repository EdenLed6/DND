import type { MapCategory } from "./generator";

export interface MapPreset { id: string; name: string; category: MapCategory; cols: number; rows: number; seed: number; }

const CATS: { cat: MapCategory; label: string; sizes: [number, number][]; icon: string }[] = [
  { cat: "dungeon", label: "Dungeon", icon: "🏰", sizes: [[16, 12], [20, 14], [24, 18], [12, 10]] },
  { cat: "cave", label: "Cave", icon: "🕳", sizes: [[18, 14], [22, 16], [14, 12]] },
  { cat: "tavern", label: "Tavern", icon: "🍺", sizes: [[16, 12], [20, 14], [12, 10]] },
  { cat: "forest", label: "Forest", icon: "🌲", sizes: [[20, 16], [24, 18], [16, 14]] },
  { cat: "crypt", label: "Crypt", icon: "⚰", sizes: [[16, 14], [20, 16]] },
  { cat: "ruins", label: "Ruins", icon: "🏛", sizes: [[20, 16], [24, 18], [16, 12]] },
  { cat: "sewer", label: "Sewer", icon: "🌊", sizes: [[16, 14], [20, 16]] },
  { cat: "grid", label: "Blank Grid", icon: "▦", sizes: [[20, 14], [30, 20], [12, 10]] },
];

export const MAP_ICON: Record<MapCategory, string> = Object.fromEntries(CATS.map((c) => [c.cat, c.icon])) as any;

export const MAP_LIBRARY: MapPreset[] = (() => {
  const out: MapPreset[] = [];
  for (const { cat, label, sizes } of CATS) {
    sizes.forEach(([cols, rows], si) => {
      // seed variants per size for variety
      const variants = cat === "grid" ? 1 : 3;
      for (let v = 0; v < variants; v++) {
        const seed = (cat.charCodeAt(0) * 131 + si * 17 + v * 7919) % 100000;
        out.push({
          id: `${cat}-${cols}x${rows}-${v}`,
          name: `${label} ${cols}×${rows}${variants > 1 ? ` #${v + 1}` : ""}`,
          category: cat, cols, rows, seed,
        });
      }
    });
  }
  return out;
})();

export function findPreset(id: string) {
  return MAP_LIBRARY.find((p) => p.id === id) ?? null;
}
