// 3D dice geometry — SPEC-PLAYER.he.md §19.3.
// Builds each die as a non-indexed BufferGeometry with one material GROUP per
// logical face, plus per-face data (value, label, local normal) and physics
// hull data so the engine can read/reorient the top face after settling.
//
// Face-accuracy strategy: the assignment of values to faces is internal and
// consistent — after the physics settles, the engine rotates the die so the
// face carrying the TARGET value sits where the current top face is.
// Note on the d4: a resting tetrahedron has no horizontal top face; by visual
// convention (authorized by the spec adaptation) we label faces 1-4 and treat
// the most-upward-facing slanted face as "the result face", aligning it via a
// symmetry rotation of the tetrahedron so the resting pose is preserved.
import * as THREE from "three";

export type DieKind = 4 | 6 | 8 | 10 | 12 | 20 | 100 | 101; // 100 = percentile tens (00-90), 101 = percentile units (0-9)

export interface DiePhysicsBox { type: "box"; halfExtents: [number, number, number]; }
export interface DiePhysicsHull {
  type: "hull";
  vertices: [number, number, number][];
  faces: number[][]; // vertex indices per face, CCW seen from outside
}

export interface DieData {
  kind: DieKind;
  geometry: THREE.BufferGeometry; // non-indexed; group i == logical face i
  faceValues: number[];           // group index -> logical value
  faceLabels: string[];           // group index -> printed label
  faceNormals: THREE.Vector3[];   // group index -> local unit normal (outward)
  physics: DiePhysicsBox | DiePhysicsHull;
  radius: number;                 // bounding-sphere radius (world units)
  symmetry?: THREE.Quaternion[];  // d4 only: rotation group (12 elements)
}

type V3 = THREE.Vector3;
interface Tri { v: [V3, V3, V3]; n: V3; }

// ---------------------------------------------------------------------------
// Triangle helpers
// ---------------------------------------------------------------------------
function makeTri(a: V3, b: V3, c: V3): Tri {
  const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
  const centroid = new THREE.Vector3().addVectors(a, b).add(c).multiplyScalar(1 / 3);
  // Ensure outward winding (solids here are centered on the origin).
  if (n.dot(centroid) < 0) { const t = b; b = c; c = t; n.negate(); }
  return { v: [a.clone(), b.clone(), c.clone()], n: n.normalize() };
}

function trisFromGeometry(src: THREE.BufferGeometry): Tri[] {
  const geo = src.index ? src.toNonIndexed() : src;
  const pos = geo.getAttribute("position");
  const tris: Tri[] = [];
  for (let i = 0; i < pos.count; i += 3) {
    tris.push(makeTri(
      new THREE.Vector3().fromBufferAttribute(pos, i),
      new THREE.Vector3().fromBufferAttribute(pos, i + 1),
      new THREE.Vector3().fromBufferAttribute(pos, i + 2),
    ));
  }
  if (geo !== src) geo.dispose();
  return tris;
}

/**
 * Group triangles that share an identical face normal (within epsilon).
 * Robust regardless of triangle ordering — triangles are re-sorted into
 * group order when the final geometry is assembled.
 */
function groupByNormal(tris: Tri[], expected: number): Tri[][] {
  const groups: { n: V3; tris: Tri[] }[] = [];
  for (const t of tris) {
    const g = groups.find((x) => x.n.dot(t.n) > 0.9999);
    if (g) g.tris.push(t);
    else groups.push({ n: t.n.clone(), tris: [t] });
  }
  if (groups.length !== expected) {
    throw new Error(`dice3d: expected ${expected} face groups, got ${groups.length}`);
  }
  return groups.map((g) => g.tris);
}

// ---------------------------------------------------------------------------
// d10 / percentile — pentagonal trapezohedron (classic dice-lib construction)
// ---------------------------------------------------------------------------
function buildD10Groups(): Tri[][] {
  const h = 0.105;
  const ring: V3[] = [];
  for (let i = 0; i < 10; i++) {
    const b = (i * Math.PI) / 5;
    ring.push(new THREE.Vector3(Math.cos(b), Math.sin(b), h * (i % 2 ? 1 : -1)));
  }
  const top = new THREE.Vector3(0, 0, 1);
  const bottom = new THREE.Vector3(0, 0, -1);
  const groups: Tri[][] = [];
  // 5 kites meeting the top pole: [pole, upper, lower(far), upper]
  for (let k = 0; k < 5; k++) {
    const a = ring[(2 * k + 1) % 10], far = ring[(2 * k + 2) % 10], b = ring[(2 * k + 3) % 10];
    groups.push([makeTri(top, a, far), makeTri(top, far, b)]);
  }
  // 5 kites meeting the bottom pole: [pole, lower, upper(far), lower]
  for (let k = 0; k < 5; k++) {
    const a = ring[(2 * k) % 10], far = ring[(2 * k + 1) % 10], b = ring[(2 * k + 2) % 10];
    groups.push([makeTri(bottom, a, far), makeTri(bottom, far, b)]);
  }
  return groups;
}

// ---------------------------------------------------------------------------
// Assembly: grouped tris -> BufferGeometry + face data + physics hull
// ---------------------------------------------------------------------------
function assemble(
  kind: DieKind,
  groups: Tri[][],
  values: number[],
  labels: string[],
  scale: number,
  boxPhysics = false,
): DieData {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const geometry = new THREE.BufferGeometry();
  const faceNormals: V3[] = [];

  // Global vertex dedupe for the physics hull.
  const hullVerts: [number, number, number][] = [];
  const hullIndex = new Map<string, number>();
  const hullFaces: number[][] = [];
  const vkey = (p: V3) => `${Math.round(p.x * 1e4)},${Math.round(p.y * 1e4)},${Math.round(p.z * 1e4)}`;
  const hullIdx = (p: V3) => {
    const k = vkey(p);
    let i = hullIndex.get(k);
    if (i === undefined) { i = hullVerts.length; hullVerts.push([p.x, p.y, p.z]); hullIndex.set(k, i); }
    return i;
  };

  let radius = 0;
  let cursor = 0;
  groups.forEach((tris, gi) => {
    // Face normal = area-weighted average (kite halves may differ minutely).
    const n = new THREE.Vector3();
    for (const t of tris) n.add(t.n);
    n.normalize();
    faceNormals.push(n.clone());

    // Unique vertices of this face.
    const unique: V3[] = [];
    for (const t of tris) for (const p of t.v) {
      if (!unique.some((q) => q.distanceToSquared(p) < 1e-10)) unique.push(p);
    }
    const centroid = unique.reduce((s, p) => s.add(p), new THREE.Vector3()).multiplyScalar(1 / unique.length);

    // Tangent basis aligned with the first edge, so numbers sit parallel to an edge.
    const e = new THREE.Vector3().subVectors(tris[0].v[1], tris[0].v[0]);
    const t = e.sub(n.clone().multiplyScalar(e.dot(n))).normalize();
    const b = new THREE.Vector3().crossVectors(n, t);

    // UV scale: centroid maps to (0.5, 0.5), face fits inside [0.15, 0.85].
    let maxExtent = 0;
    const local = (p: V3): [number, number] => {
      const d = new THREE.Vector3().subVectors(p, centroid);
      return [d.dot(t), d.dot(b)];
    };
    for (const p of unique) {
      const [x, y] = local(p);
      maxExtent = Math.max(maxExtent, Math.abs(x), Math.abs(y));
    }
    const uvScale = 0.35 / (maxExtent || 1);

    for (const tri of tris) for (const p of tri.v) {
      positions.push(p.x * scale, p.y * scale, p.z * scale);
      normals.push(n.x, n.y, n.z);
      const [x, y] = local(p);
      uvs.push(0.5 + x * uvScale, 0.5 + y * uvScale);
      radius = Math.max(radius, p.length() * scale);
    }
    geometry.addGroup(cursor, tris.length * 3, gi);
    cursor += tris.length * 3;

    // Physics face polygon: unique verts ordered CCW around the face normal.
    const ordered = unique
      .map((p) => ({ p, a: Math.atan2(local(p)[1], local(p)[0]) }))
      .sort((u, v) => u.a - v.a)
      .map((x) => x.p);
    hullFaces.push(ordered.map((p) => hullIdx(p.clone().multiplyScalar(scale))));
  });

  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));

  let physics: DiePhysicsBox | DiePhysicsHull;
  if (boxPhysics) {
    geometry.computeBoundingBox();
    const bb = geometry.boundingBox!;
    physics = { type: "box", halfExtents: [(bb.max.x - bb.min.x) / 2, (bb.max.y - bb.min.y) / 2, (bb.max.z - bb.min.z) / 2] };
  } else {
    physics = { type: "hull", vertices: hullVerts, faces: hullFaces };
  }

  const data: DieData = { kind, geometry, faceValues: values, faceLabels: labels, faceNormals, physics, radius };
  if (kind === 4) data.symmetry = tetraSymmetry(hullVerts, faceNormals);
  return data;
}

/** The 12 rotations of the tetrahedron (identity + 8 vertex/face + 3 edge). */
function tetraSymmetry(verts: [number, number, number][], faceNormals: V3[]): THREE.Quaternion[] {
  const quats: THREE.Quaternion[] = [new THREE.Quaternion()];
  for (const n of faceNormals) {
    quats.push(new THREE.Quaternion().setFromAxisAngle(n, (2 * Math.PI) / 3));
    quats.push(new THREE.Quaternion().setFromAxisAngle(n, (4 * Math.PI) / 3));
  }
  const v = verts.map((p) => new THREE.Vector3(...p));
  if (v.length === 4) {
    const pairs: [number, number, number, number][] = [[0, 1, 2, 3], [0, 2, 1, 3], [0, 3, 1, 2]];
    for (const [a, b, c, d] of pairs) {
      const axis = new THREE.Vector3().addVectors(v[a], v[b]).multiplyScalar(0.5)
        .sub(new THREE.Vector3().addVectors(v[c], v[d]).multiplyScalar(0.5)).normalize();
      quats.push(new THREE.Quaternion().setFromAxisAngle(axis, Math.PI));
    }
  }
  return quats;
}

// ---------------------------------------------------------------------------
// Die construction per kind
// ---------------------------------------------------------------------------
const range = (n: number, from = 1) => Array.from({ length: n }, (_, i) => i + from);

function buildDie(kind: DieKind): DieData {
  switch (kind) {
    case 4: {
      const groups = groupByNormal(trisFromGeometry(new THREE.TetrahedronGeometry(1)), 4);
      return assemble(4, groups, range(4), range(4).map(String), 1.0);
    }
    case 6: {
      // BoxGeometry face (group) discovery order: +x,-x,+y,-y,+z,-z.
      // Values chosen so opposite faces sum to 7, like a real die.
      const groups = groupByNormal(trisFromGeometry(new THREE.BoxGeometry(1.15, 1.15, 1.15)), 6);
      const values = [1, 6, 2, 5, 3, 4];
      return assemble(6, groups, values, values.map(String), 1.0, true);
    }
    case 8: {
      const groups = groupByNormal(trisFromGeometry(new THREE.OctahedronGeometry(1)), 8);
      return assemble(8, groups, range(8), range(8).map(String), 0.88);
    }
    case 12: {
      // 36 tris = 12 pentagons x 3 tris; groupByNormal verifies this at runtime.
      const groups = groupByNormal(trisFromGeometry(new THREE.DodecahedronGeometry(1)), 12);
      return assemble(12, groups, range(12), range(12).map(String), 0.82);
    }
    case 20: {
      const groups = groupByNormal(trisFromGeometry(new THREE.IcosahedronGeometry(1)), 20);
      return assemble(20, groups, range(20), range(20).map(String), 0.82);
    }
    case 10: {
      const values = range(10); // 1..10
      return assemble(10, buildD10Groups(), values, values.map(String), 0.85);
    }
    case 100: {
      const values = range(10, 0); // 0..9 == tens digit
      return assemble(100, buildD10Groups(), values, values.map((v) => String(v * 10).padStart(2, "0")), 0.85);
    }
    case 101: {
      const values = range(10, 0); // 0..9 == units digit
      return assemble(101, buildD10Groups(), values, values.map(String), 0.85);
    }
  }
}

const dieCache = new Map<DieKind, DieData>();
export function getDieData(kind: DieKind): DieData {
  let d = dieCache.get(kind);
  if (!d) { d = buildDie(kind); dieCache.set(kind, d); }
  return d;
}

export const SUPPORTED_KINDS: DieKind[] = [4, 6, 8, 10, 12, 20, 100, 101];

// ---------------------------------------------------------------------------
// Face textures — obsidian body, red numerals (design-system "dice" section)
// ---------------------------------------------------------------------------
const textureCache = new Map<string, THREE.CanvasTexture>();

const FONT_SCALE: Partial<Record<DieKind, number>> = {
  4: 0.4, 8: 0.44, 20: 0.4, 12: 0.48, 6: 0.6, 10: 0.52, 100: 0.48, 101: 0.52,
};

function faceTexture(kind: DieKind, label: string): THREE.CanvasTexture {
  const key = `${kind}:${label}`;
  const cached = textureCache.get(key);
  if (cached) return cached;

  const S = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext("2d")!;

  // Obsidian base: dark radial gradient #2A2624 -> #141110.
  const grad = ctx.createRadialGradient(S / 2, S / 2, S * 0.1, S / 2, S / 2, S * 0.72);
  grad.addColorStop(0, "#2A2624");
  grad.addColorStop(1, "#141110");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, S, S);

  // Subtle antique-gold ring.
  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = "#D7C08A";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(S / 2, S / 2, S * 0.42, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Red numeral, Cinzel (falls back to Georgia/serif until the webfont loads).
  let px = Math.round(S * (FONT_SCALE[kind] ?? 0.5));
  ctx.font = `700 ${px}px Cinzel, Georgia, serif`;
  const maxW = S * 0.56;
  const w = ctx.measureText(label).width;
  if (w > maxW) { px = Math.floor((px * maxW) / w); ctx.font = `700 ${px}px Cinzel, Georgia, serif`; }
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#E23D35";
  ctx.fillText(label, S / 2, S / 2);

  // Underline 6 and 9 (and 60/90 on the percentile die) to disambiguate.
  if (["6", "9", "60", "90"].includes(label)) {
    const lw = ctx.measureText(label).width;
    ctx.strokeStyle = "#E23D35";
    ctx.lineWidth = Math.max(3, px * 0.07);
    ctx.beginPath();
    ctx.moveTo(S / 2 - lw / 2, S / 2 + px * 0.62);
    ctx.lineTo(S / 2 + lw / 2, S / 2 + px * 0.62);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  textureCache.set(key, tex);
  return tex;
}

/** One MeshStandardMaterial per logical face (fresh set per mesh, shared textures). */
export function createDieMaterials(kind: DieKind): THREE.MeshStandardMaterial[] {
  const data = getDieData(kind);
  return data.faceLabels.map((label) =>
    new THREE.MeshStandardMaterial({
      map: faceTexture(kind, label),
      roughness: 0.35,
      metalness: 0.15,
    }),
  );
}
