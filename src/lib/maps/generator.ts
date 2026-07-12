// Procedural, self-contained SVG battle maps (no external assets/network).
// Rendered as data-URI backgrounds. 5ft per grid cell. See docs/06-COMBAT-AND-MAPS.md.

export type MapCategory = "dungeon" | "cave" | "tavern" | "forest" | "crypt" | "ruins" | "sewer" | "grid";

// deterministic PRNG so a preset always renders identically
function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Ctx { W: number; H: number; cell: number; cols: number; rows: number; r: () => number; }
const ri = (r: () => number, a: number, b: number) => Math.floor(r() * (b - a + 1)) + a;

function frame(inner: string, W: number, H: number, bg: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<rect width="${W}" height="${H}" fill="${bg}"/>${inner}</svg>`;
}

function stoneTiles(c: Ctx, fill: string, line: string) {
  let s = `<rect x="0" y="0" width="${c.W}" height="${c.H}" fill="${fill}"/>`;
  for (let x = 0; x <= c.cols; x++) s += `<line x1="${x * c.cell}" y1="0" x2="${x * c.cell}" y2="${c.H}" stroke="${line}" stroke-width="1" opacity="0.25"/>`;
  for (let y = 0; y <= c.rows; y++) s += `<line x1="0" y1="${y * c.cell}" x2="${c.W}" y2="${y * c.cell}" stroke="${line}" stroke-width="1" opacity="0.25"/>`;
  return s;
}

function walls(c: Ctx, color: string, t = 10) {
  return `<rect x="0" y="0" width="${c.W}" height="${c.H}" fill="none" stroke="${color}" stroke-width="${t * 2}"/>`;
}

function dungeon(c: Ctx) {
  let s = stoneTiles(c, "#2c2b31", "#000");
  s += walls(c, "#111015", 9);
  // interior partition walls with a doorway
  const midX = ri(c.r, Math.floor(c.cols * 0.35), Math.floor(c.cols * 0.65)) * c.cell;
  const doorY = ri(c.r, 1, c.rows - 2) * c.cell;
  s += `<rect x="${midX - 5}" y="0" width="10" height="${doorY}" fill="#14131a"/>`;
  s += `<rect x="${midX - 5}" y="${doorY + c.cell}" width="10" height="${c.H - doorY - c.cell}" fill="#14131a"/>`;
  // pillars
  for (let i = 0; i < ri(c.r, 2, 5); i++) {
    const px = ri(c.r, 1, c.cols - 2) * c.cell + c.cell / 2;
    const py = ri(c.r, 1, c.rows - 2) * c.cell + c.cell / 2;
    s += `<circle cx="${px}" cy="${py}" r="${c.cell * 0.32}" fill="#1c1b22" stroke="#0c0b10" stroke-width="3"/>`;
  }
  return frame(s, c.W, c.H, "#0c0b10");
}

function cave(c: Ctx) {
  // organic blob floor
  const cx = c.W / 2, cy = c.H / 2;
  const pts: string[] = [];
  const steps = 26;
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const rad = Math.min(c.W, c.H) * (0.34 + c.r() * 0.14);
    pts.push(`${(cx + Math.cos(a) * rad).toFixed(0)},${(cy + Math.sin(a) * rad).toFixed(0)}`);
  }
  let s = `<polygon points="${pts.join(" ")}" fill="#4a3f33" stroke="#2a2118" stroke-width="14"/>`;
  s += `<polygon points="${pts.join(" ")}" fill="#57493a" opacity="0.5"/>`;
  // stalagmites / rocks
  for (let i = 0; i < ri(c.r, 5, 10); i++) {
    const px = ri(c.r, 2, c.cols - 3) * c.cell + c.cell / 2;
    const py = ri(c.r, 2, c.rows - 3) * c.cell + c.cell / 2;
    s += `<circle cx="${px}" cy="${py}" r="${c.cell * (0.2 + c.r() * 0.2)}" fill="#3a2f24" stroke="#241c14" stroke-width="2"/>`;
  }
  return frame(s, c.W, c.H, "#17120d");
}

function tavern(c: Ctx) {
  // wooden plank floor
  let s = `<rect width="${c.W}" height="${c.H}" fill="#5b3f28"/>`;
  for (let y = 0; y < c.rows; y++) s += `<rect x="0" y="${y * c.cell}" width="${c.W}" height="${c.cell}" fill="${y % 2 ? "#4f3722" : "#5b3f28"}"/>`;
  for (let x = 0; x <= c.cols; x++) s += `<line x1="${x * c.cell}" y1="0" x2="${x * c.cell}" y2="${c.H}" stroke="#3a2817" stroke-width="1" opacity="0.5"/>`;
  s += walls(c, "#3a2817", 9);
  // bar along the top
  s += `<rect x="${c.cell}" y="${c.cell * 0.5}" width="${c.W - c.cell * 4}" height="${c.cell * 0.9}" rx="6" fill="#2f2013" stroke="#1c130a" stroke-width="3"/>`;
  // round tables
  for (let i = 0; i < ri(c.r, 3, 6); i++) {
    const px = ri(c.r, 2, c.cols - 3) * c.cell + c.cell / 2;
    const py = ri(c.r, 3, c.rows - 2) * c.cell + c.cell / 2;
    s += `<circle cx="${px}" cy="${py}" r="${c.cell * 0.5}" fill="#6b4a2e" stroke="#2f2013" stroke-width="3"/>`;
    s += `<circle cx="${px}" cy="${py}" r="${c.cell * 0.18}" fill="#7d5836"/>`;
  }
  // hearth
  s += `<rect x="${c.W - c.cell * 2.2}" y="${c.cell * 0.4}" width="${c.cell * 1.6}" height="${c.cell}" rx="4" fill="#7a2d16" stroke="#3a1608" stroke-width="3"/>`;
  return frame(s, c.W, c.H, "#2a1c10");
}

function forest(c: Ctx) {
  let s = `<rect width="${c.W}" height="${c.H}" fill="#2f4a2a"/>`;
  // grass mottling
  for (let i = 0; i < c.cols * c.rows * 0.6; i++) {
    const px = c.r() * c.W, py = c.r() * c.H;
    s += `<circle cx="${px.toFixed(0)}" cy="${py.toFixed(0)}" r="${(2 + c.r() * 5).toFixed(0)}" fill="${c.r() > 0.5 ? "#365732" : "#294024"}" opacity="0.5"/>`;
  }
  // winding path
  const pathY = c.H * (0.4 + c.r() * 0.2);
  s += `<path d="M0 ${pathY} Q ${c.W * 0.3} ${pathY - c.cell * 2}, ${c.W * 0.5} ${pathY} T ${c.W} ${pathY - c.cell}" stroke="#6b5637" stroke-width="${c.cell * 0.8}" fill="none" opacity="0.85" stroke-linecap="round"/>`;
  // trees
  for (let i = 0; i < ri(c.r, 10, 18); i++) {
    const px = ri(c.r, 0, c.cols) * c.cell + c.cell / 2;
    const py = ri(c.r, 0, c.rows) * c.cell + c.cell / 2;
    const rad = c.cell * (0.35 + c.r() * 0.35);
    s += `<circle cx="${px}" cy="${py}" r="${rad}" fill="#1e3a1c" stroke="#12250f" stroke-width="2"/>`;
    s += `<circle cx="${px}" cy="${py}" r="${rad * 0.6}" fill="#26471f" opacity="0.8"/>`;
  }
  return frame(s, c.W, c.H, "#20361d");
}

function crypt(c: Ctx) {
  let s = stoneTiles(c, "#33313a", "#000");
  s += walls(c, "#15141b", 9);
  // sarcophagi rows
  const rowsN = ri(c.r, 2, 3);
  for (let rr = 0; rr < rowsN; rr++) {
    const y = (1 + rr * Math.floor(c.rows / (rowsN + 1))) * c.cell;
    for (let x = 1; x < c.cols - 1; x += 3) {
      s += `<rect x="${x * c.cell + 4}" y="${y + 4}" width="${c.cell * 2 - 8}" height="${c.cell - 8}" rx="4" fill="#26242c" stroke="#454150" stroke-width="2"/>`;
      s += `<ellipse cx="${x * c.cell + c.cell}" cy="${y + c.cell * 0.5}" rx="${c.cell * 0.3}" ry="${c.cell * 0.28}" fill="#3a3644"/>`;
    }
  }
  // columns
  for (const cx of [0.25, 0.75]) for (const cy of [0.2, 0.8]) {
    s += `<circle cx="${c.W * cx}" cy="${c.H * cy}" r="${c.cell * 0.3}" fill="#1c1b22" stroke="#0c0b10" stroke-width="3"/>`;
  }
  return frame(s, c.W, c.H, "#0e0d13");
}

function ruins(c: Ctx) {
  let s = `<rect width="${c.W}" height="${c.H}" fill="#3b4632"/>`;
  for (let i = 0; i < c.cols * c.rows * 0.4; i++) {
    const px = c.r() * c.W, py = c.r() * c.H;
    s += `<circle cx="${px.toFixed(0)}" cy="${py.toFixed(0)}" r="${(2 + c.r() * 4).toFixed(0)}" fill="#33402b" opacity="0.5"/>`;
  }
  // broken wall segments
  for (let i = 0; i < ri(c.r, 5, 9); i++) {
    const x = ri(c.r, 0, c.cols - 3) * c.cell, y = ri(c.r, 0, c.rows - 1) * c.cell;
    const len = ri(c.r, 1, 3) * c.cell;
    const horiz = c.r() > 0.5;
    s += `<rect x="${x}" y="${y}" width="${horiz ? len : 10}" height="${horiz ? 10 : len}" fill="#6d6154" stroke="#4a4137" stroke-width="2"/>`;
  }
  // rubble
  for (let i = 0; i < ri(c.r, 8, 14); i++) {
    const px = c.r() * c.W, py = c.r() * c.H;
    s += `<circle cx="${px.toFixed(0)}" cy="${py.toFixed(0)}" r="${(3 + c.r() * 6).toFixed(0)}" fill="#5a5147" stroke="#3d362d" stroke-width="1"/>`;
  }
  return frame(s, c.W, c.H, "#28301f");
}

function sewer(c: Ctx) {
  let s = stoneTiles(c, "#2a2c2a", "#000");
  s += walls(c, "#141514", 9);
  // water channel (cross or T)
  const chan = c.cell * 1.6;
  const cx = Math.floor(c.cols / 2) * c.cell;
  const cy = Math.floor(c.rows / 2) * c.cell;
  s += `<rect x="${cx - chan / 2}" y="0" width="${chan}" height="${c.H}" fill="#1c3b3a"/>`;
  s += `<rect x="0" y="${cy - chan / 2}" width="${c.W}" height="${chan}" fill="#1c3b3a"/>`;
  s += `<rect x="${cx - chan / 2}" y="0" width="${chan}" height="${c.H}" fill="#245150" opacity="0.4"/>`;
  return frame(s, c.W, c.H, "#101110");
}

function gridBlank(c: Ctx) {
  return frame(stoneTiles(c, "#1b1c22", "#3a3b45"), c.W, c.H, "#14141a");
}

const GEN: Record<MapCategory, (c: Ctx) => string> = {
  dungeon, cave, tavern, forest, crypt, ruins, sewer, grid: gridBlank,
};

export function generateMapSvg(category: MapCategory, cols: number, rows: number, seed: number, cell = 64): string {
  const ctx: Ctx = { W: cols * cell, H: rows * cell, cell, cols, rows, r: mulberry32(seed) };
  return (GEN[category] ?? gridBlank)(ctx);
}

export function svgToDataUri(svg: string): string {
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}
