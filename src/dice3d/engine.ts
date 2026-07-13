// 3D dice physics engine — SPEC-PLAYER.he.md §19.3-19.4, §19.9.
// Plain TypeScript class (no React). Lazy singleton created on first throw.
// Three.js renders into a full-viewport transparent canvas (z-index 44, below
// the dice tray at 45); cannon-es simulates the throw. The logical result is
// decided by the game RNG — when a die settles, we compute the quaternion
// delta that maps the face carrying the TARGET value onto the current top
// orientation and slerp it in over ~140ms, so the top face shows the result.
import * as THREE from "three";
import * as CANNON from "cannon-es";
import { createDieMaterials, getDieData, type DieData, type DieKind } from "./geometry";

export interface ThrowDie { kind: DieKind; value: number; }

const PX_PER_UNIT = 60;        // 1 world unit ~= 60px on screen (die ~70-90px)
const GRAVITY = -60;           // -z, scaled for die-sized world units
const KEEP_MS = 6000;          // settled dice linger before fading out
const FADE_MS = 300;
const ALIGN_MS = 140;
const SETTLE_LIN = 0.08;
const SETTLE_ANG = 0.1;
const SETTLE_FRAMES = 12;
const SETTLE_TIMEOUT_MS = 3000;
export const MAX_ACTIVE_DICE = 20;

type DieState = "flying" | "aligning" | "settled" | "fading";

interface ActiveDie {
  id: number;
  kind: DieKind;
  value: number;
  mesh: THREE.Mesh;
  body: CANNON.Body;
  data: DieData;
  state: DieState;
  calmFrames: number;
  spawnedAt: number;
  alignFrom?: THREE.Quaternion;
  alignTo?: THREE.Quaternion;
  alignStart?: number;
  fadeStart?: number;
}

export class DiceEngine3D {
  private container: HTMLDivElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private dirLight: THREE.DirectionalLight;
  private floorMesh: THREE.Mesh;
  private world: CANNON.World;
  private walls: { body: CANNON.Body; place: (w: number, h: number) => void }[] = [];
  private dice: ActiveDie[] = [];
  private pool = new Map<DieKind, THREE.Mesh[]>();
  private shapes = new Map<DieKind, CANNON.Shape>();
  private spawnTimers: number[] = [];
  private pendingSpawns = 0;
  private fadeTimer: number | null = null;
  private raf: number | null = null;
  private lastTime = 0;
  private idSeq = 0;
  private throwSeq = 0;
  private W = 10;
  private H = 10;
  /** Notified (dieId, value) after a die settles and is aligned. */
  onDieSettled?: (id: number, value: number) => void;
  private onAllSettled?: () => void;

  constructor() {
    this.container = document.createElement("div");
    this.container.id = "dice3d-overlay";
    this.container.style.cssText =
      "position:fixed;inset:0;pointer-events:none;z-index:44;display:none;";
    document.body.appendChild(this.container);

    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(20, 1, 1, 200);
    this.camera.up.set(0, 1, 0);

    this.scene.add(new THREE.AmbientLight(0xfff6e8, 1.1));
    this.dirLight = new THREE.DirectionalLight(0xffffff, 1.6);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.set(1024, 1024);
    this.dirLight.shadow.radius = 4;
    this.scene.add(this.dirLight);
    this.scene.add(this.dirLight.target);

    // Floor only catches shadows; the app UI shows through everywhere else.
    this.floorMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.ShadowMaterial({ opacity: 0.25 }),
    );
    this.floorMesh.receiveShadow = true;
    this.scene.add(this.floorMesh);

    this.world = new CANNON.World({ gravity: new CANNON.Vec3(0, 0, GRAVITY) });
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    this.world.defaultContactMaterial.restitution = 0.4;
    this.world.defaultContactMaterial.friction = 0.25;
    (this.world.solver as CANNON.GSSolver).iterations = 12;
    this.world.allowSleep = false;

    // Static floor + 4 viewport-edge walls (infinite half-space planes).
    const staticPlane = (orient: (q: CANNON.Quaternion) => void, place: (body: CANNON.Body, w: number, h: number) => void) => {
      const body = new CANNON.Body({ mass: 0, shape: new CANNON.Plane() });
      orient(body.quaternion);
      this.world.addBody(body);
      this.walls.push({ body, place: (w, h) => place(body, w, h) });
    };
    staticPlane(() => {}, (b) => b.position.set(0, 0, 0)); // floor, normal +z
    staticPlane((q) => q.setFromEuler(0, Math.PI / 2, 0), (b, w) => b.position.set(-w / 2, 0, 0));   // left, +x
    staticPlane((q) => q.setFromEuler(0, -Math.PI / 2, 0), (b, w) => b.position.set(w / 2, 0, 0));   // right, -x
    staticPlane((q) => q.setFromEuler(-Math.PI / 2, 0, 0), (b, _w, h) => b.position.set(0, -h / 2, 0)); // bottom, +y
    staticPlane((q) => q.setFromEuler(Math.PI / 2, 0, 0), (b, _w, h) => b.position.set(0, h / 2, 0));   // top, -y

    this.resize();
    window.addEventListener("resize", () => this.resize());

    // Warm the numeral font so face textures render in Cinzel.
    try { void document.fonts?.load("700 100px Cinzel"); } catch { /* ignore */ }
  }

  private resize() {
    const pw = window.innerWidth;
    const ph = window.innerHeight;
    this.W = pw / PX_PER_UNIT;
    this.H = ph / PX_PER_UNIT;
    this.renderer.setSize(pw, ph);
    this.camera.aspect = pw / ph;
    this.camera.position.set(0, 0, (this.H / 2) / Math.tan(THREE.MathUtils.degToRad(10)));
    this.camera.lookAt(0, 0, 0);
    this.camera.updateProjectionMatrix();

    this.dirLight.position.set(this.W * 0.25, this.H * 0.35, Math.max(this.W, this.H));
    this.dirLight.target.position.set(0, 0, 0);
    const cam = this.dirLight.shadow.camera;
    cam.left = -this.W / 2 - 2; cam.right = this.W / 2 + 2;
    cam.top = this.H / 2 + 2; cam.bottom = -this.H / 2 - 2;
    cam.near = 1; cam.far = Math.max(this.W, this.H) * 3;
    cam.updateProjectionMatrix();

    this.floorMesh.geometry.dispose();
    this.floorMesh.geometry = new THREE.PlaneGeometry(this.W + 4, this.H + 4);
    for (const w of this.walls) w.place(this.W, this.H);
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------
  /** Replace any existing dice and throw a new set. */
  throwSet(dice: ThrowDie[], onAllSettled?: () => void) {
    this.clearAll();
    const throwId = ++this.throwSeq;
    this.onAllSettled = onAllSettled;
    const capped = dice.slice(0, MAX_ACTIVE_DICE);
    this.pendingSpawns = capped.length;
    capped.forEach((die, i) => {
      const t = window.setTimeout(() => {
        this.spawnTimers = this.spawnTimers.filter((x) => x !== t);
        if (this.throwSeq !== throwId) return;
        this.pendingSpawns--;
        this.spawn(die);
      }, i * 60);
      this.spawnTimers.push(t);
    });
    this.container.style.display = "block";
    this.start();
  }

  /** Remove all dice/timers immediately. */
  clearAll() {
    this.throwSeq++;
    for (const t of this.spawnTimers) window.clearTimeout(t);
    this.spawnTimers = [];
    this.pendingSpawns = 0;
    if (this.fadeTimer !== null) { window.clearTimeout(this.fadeTimer); this.fadeTimer = null; }
    for (const d of [...this.dice]) this.remove(d);
    this.dice = [];
    this.onAllSettled = undefined;
    this.stopIfIdle();
  }

  // -------------------------------------------------------------------------
  // Spawning
  // -------------------------------------------------------------------------
  private shapeFor(kind: DieKind): CANNON.Shape {
    let s = this.shapes.get(kind);
    if (s) return s;
    const data = getDieData(kind);
    if (data.physics.type === "box") {
      const [x, y, z] = data.physics.halfExtents;
      s = new CANNON.Box(new CANNON.Vec3(x, y, z));
    } else {
      s = new CANNON.ConvexPolyhedron({
        vertices: data.physics.vertices.map((v) => new CANNON.Vec3(v[0], v[1], v[2])),
        faces: data.physics.faces.map((f) => [...f]),
      });
    }
    this.shapes.set(kind, s);
    return s;
  }

  private meshFor(kind: DieKind): THREE.Mesh {
    const pooled = this.pool.get(kind)?.pop();
    if (pooled) {
      for (const m of pooled.material as THREE.MeshStandardMaterial[]) {
        m.opacity = 1;
        m.transparent = false;
      }
      return pooled;
    }
    const mesh = new THREE.Mesh(getDieData(kind).geometry, createDieMaterials(kind));
    mesh.castShadow = true;
    return mesh;
  }

  private spawn(die: ThrowDie) {
    if (this.dice.length >= MAX_ACTIVE_DICE) return;
    const data = getDieData(die.kind);
    const mesh = this.meshFor(die.kind);
    this.scene.add(mesh);

    const body = new CANNON.Body({ mass: 1, shape: this.shapeFor(die.kind) });
    body.linearDamping = 0.12;
    body.angularDamping = 0.12;

    // Spawn near the top edge at a random x, elevated above the "table".
    const px = (Math.random() - 0.5) * this.W * 0.7;
    const py = this.H / 2 - data.radius - 0.6;
    const pz = 4 + Math.random() * 2;
    body.position.set(px, py, pz);
    body.quaternion.setFromEuler(Math.random() * Math.PI * 2, Math.random() * Math.PI * 2, Math.random() * Math.PI * 2);

    // Velocity toward (a jittered point near) the viewport center, +/-20%.
    const target = new THREE.Vector3(
      (Math.random() - 0.5) * this.W * 0.35,
      (Math.random() - 0.55) * this.H * 0.4,
      0,
    );
    const dir = target.sub(new THREE.Vector3(px, py, pz)).normalize();
    const dist = Math.hypot(target.x - px, target.y - py);
    const speed = THREE.MathUtils.clamp(dist * 1.6, 7, 17) * (0.8 + Math.random() * 0.4);
    body.velocity.set(dir.x * speed, dir.y * speed, Math.min(dir.z * speed, -1));
    body.angularVelocity.set(
      (Math.random() - 0.5) * 18,
      (Math.random() - 0.5) * 18,
      (Math.random() - 0.5) * 18,
    );
    this.world.addBody(body);

    this.dice.push({
      id: ++this.idSeq,
      kind: die.kind,
      value: die.value,
      mesh,
      body,
      data,
      state: "flying",
      calmFrames: 0,
      spawnedAt: performance.now(),
    });
  }

  // -------------------------------------------------------------------------
  // Settling + reorientation (face accuracy)
  // -------------------------------------------------------------------------
  private topFaceIndex(data: DieData, q: THREE.Quaternion): number {
    let best = 0;
    let bestZ = -Infinity;
    const v = new THREE.Vector3();
    for (let i = 0; i < data.faceNormals.length; i++) {
      v.copy(data.faceNormals[i]).applyQuaternion(q);
      if (v.z > bestZ) { bestZ = v.z; best = i; }
    }
    return best;
  }

  private beginAlign(d: ActiveDie) {
    // Freeze the body so late colliders bounce off without moving it.
    d.body.velocity.setZero();
    d.body.angularVelocity.setZero();
    d.body.type = CANNON.Body.STATIC;

    const q = new THREE.Quaternion(d.body.quaternion.x, d.body.quaternion.y, d.body.quaternion.z, d.body.quaternion.w);
    const topIdx = this.topFaceIndex(d.data, q);
    const targetIdx = d.data.faceValues.indexOf(d.value);

    let final = q.clone();
    if (targetIdx >= 0) {
      const nTop = d.data.faceNormals[topIdx];
      const nTarget = d.data.faceNormals[targetIdx];
      if (d.data.symmetry) {
        // d4: pick the tetrahedron symmetry rotation mapping target -> top,
        // so the resting pose is preserved exactly (no horizontal top face).
        let best: THREE.Quaternion | null = null;
        let bestDot = -Infinity;
        const v = new THREE.Vector3();
        for (const r of d.data.symmetry) {
          v.copy(nTarget).applyQuaternion(r);
          const dot = v.dot(nTop);
          if (dot > bestDot) { bestDot = dot; best = r; }
        }
        if (best) final = q.clone().multiply(best);
      } else {
        // 1) snap the current top face to point exactly up (world fix), then
        // 2) rotate locally so the TARGET face occupies the top slot.
        const up = new THREE.Vector3(0, 0, 1);
        const worldTop = nTop.clone().applyQuaternion(q).normalize();
        const fix = new THREE.Quaternion().setFromUnitVectors(worldTop, up);
        const snapped = fix.multiply(q);
        const local = new THREE.Quaternion().setFromUnitVectors(nTarget, nTop);
        final = snapped.multiply(local);
      }
    }

    d.state = "aligning";
    d.alignFrom = q;
    d.alignTo = final;
    d.alignStart = performance.now();
  }

  private finishAlign(d: ActiveDie) {
    d.mesh.quaternion.copy(d.alignTo!);
    d.body.quaternion.set(d.alignTo!.x, d.alignTo!.y, d.alignTo!.z, d.alignTo!.w);
    d.state = "settled";
    this.onDieSettled?.(d.id, d.value);
    const pending = this.dice.some((x) => x.state === "flying" || x.state === "aligning");
    if (!pending && this.pendingSpawns === 0) {
      this.onAllSettled?.();
      this.onAllSettled = undefined;
      if (this.fadeTimer !== null) window.clearTimeout(this.fadeTimer);
      this.fadeTimer = window.setTimeout(() => this.beginFade(), KEEP_MS);
    }
  }

  private beginFade() {
    const now = performance.now();
    for (const d of this.dice) {
      if (d.state === "settled") {
        d.state = "fading";
        d.fadeStart = now;
        for (const m of d.mesh.material as THREE.MeshStandardMaterial[]) m.transparent = true;
      }
    }
  }

  private remove(d: ActiveDie) {
    this.scene.remove(d.mesh);
    this.world.removeBody(d.body);
    for (const m of d.mesh.material as THREE.MeshStandardMaterial[]) { m.opacity = 1; m.transparent = false; }
    const pool = this.pool.get(d.kind) ?? [];
    if (pool.length < 8) { pool.push(d.mesh); this.pool.set(d.kind, pool); }
    this.dice = this.dice.filter((x) => x !== d);
  }

  // -------------------------------------------------------------------------
  // Animation loop — runs only while dice are active
  // -------------------------------------------------------------------------
  private start() {
    if (this.raf !== null) return;
    this.lastTime = performance.now();
    const tick = () => {
      this.raf = requestAnimationFrame(tick);
      this.step();
    };
    this.raf = requestAnimationFrame(tick);
  }

  private stopIfIdle() {
    if (this.dice.length > 0 || this.spawnTimers.length > 0) return;
    if (this.raf !== null) { cancelAnimationFrame(this.raf); this.raf = null; }
    this.renderer.clear();
    this.container.style.display = "none";
  }

  private step() {
    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;
    this.world.step(1 / 60, dt, 3);

    let anyLeft = false;
    for (const d of [...this.dice]) {
      anyLeft = true;
      if (d.state === "flying") {
        d.mesh.position.set(d.body.position.x, d.body.position.y, d.body.position.z);
        d.mesh.quaternion.set(d.body.quaternion.x, d.body.quaternion.y, d.body.quaternion.z, d.body.quaternion.w);
        const calm = d.body.velocity.length() < SETTLE_LIN && d.body.angularVelocity.length() < SETTLE_ANG;
        d.calmFrames = calm ? d.calmFrames + 1 : 0;
        const timedOut = now - d.spawnedAt > SETTLE_TIMEOUT_MS;
        if (d.calmFrames >= SETTLE_FRAMES || timedOut) this.beginAlign(d);
      } else if (d.state === "aligning") {
        const t = Math.min((now - d.alignStart!) / ALIGN_MS, 1);
        d.mesh.quaternion.slerpQuaternions(d.alignFrom!, d.alignTo!, t);
        if (t >= 1) this.finishAlign(d);
      } else if (d.state === "fading") {
        const t = Math.min((now - d.fadeStart!) / FADE_MS, 1);
        for (const m of d.mesh.material as THREE.MeshStandardMaterial[]) m.opacity = 1 - t;
        if (t >= 1) this.remove(d);
      }
    }

    this.renderer.render(this.scene, this.camera);
    if (!anyLeft && this.spawnTimers.length === 0) this.stopIfIdle();
  }
}

// Lazy singleton --------------------------------------------------------------
let engine: DiceEngine3D | null = null;
export function getEngine(): DiceEngine3D {
  if (!engine) {
    engine = new DiceEngine3D();
    // Debug/QA handle (harmless; used by tooling to inspect settled dice).
    (window as unknown as { __dice3dEngine?: DiceEngine3D }).__dice3dEngine = engine;
  }
  return engine;
}
export function peekEngine(): DiceEngine3D | null { return engine; }
