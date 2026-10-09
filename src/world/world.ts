import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Game } from '../game/game';
import { softTex } from '../game/characters';
import { lerp, rng, segDist, smooth, damp } from '../core/util';
import { buildTerrain, height, edge, corr, mireAt, HUMMOCKS, SLOTS, SOFT, PLANK_LEN, MUD_Y, laid } from './terrain';

// PLACEHOLDER ART: the whole landscape is generated here from boxes, cones
// and icosahedra with flat shading and vertex colours. No authored models.

const V3 = THREE.Vector3;
const BOX = new THREE.BoxGeometry(1, 1, 1);
const CYL6 = new THREE.CylinderGeometry(1, 1, 1, 6);
const CYL10 = new THREE.CylinderGeometry(1, 1, 1, 10);
const CONE4 = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4).rotateY(Math.PI / 4);
const CONE6 = new THREE.ConeGeometry(1, 1, 6);
const ICO0 = new THREE.IcosahedronGeometry(1, 0);
const ICO1 = new THREE.IcosahedronGeometry(1, 1);
const ONE = new V3(1, 1, 1);

/** Collects coloured primitives and bakes them into a single mesh. */
class Batch {
  parts: THREE.BufferGeometry[] = [];
  private ctx = new THREE.Matrix4();
  at(x: number, y: number, z: number, ry = 0, rz = 0) {
    this.ctx.compose(new V3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, rz, 'YXZ')), ONE);
    return this;
  }
  home() { this.ctx.identity(); return this; }
  add(geo: THREE.BufferGeometry, color: number, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, ry = 0, rx = 0, rz = 0) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    const m = new THREE.Matrix4().compose(new V3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new V3(sx, sy, sz));
    g.applyMatrix4(m.premultiply(this.ctx));
    const c = new THREE.Color(color), n = g.attributes.position.count, arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    g.deleteAttribute('uv');
    this.parts.push(g);
    return this;
  }
  box(color: number, x: number, y: number, z: number, sx: number, sy: number, sz: number, ry = 0, rx = 0, rz = 0) {
    return this.add(BOX, color, x, y, z, sx, sy, sz, ry, rx, rz);
  }
  geo() { return mergeGeometries(this.parts); }
  mesh(mat: THREE.Material, shadow = true) {
    const mesh = new THREE.Mesh(this.geo(), mat);
    mesh.castShadow = shadow;
    mesh.receiveShadow = shadow;
    return mesh;
  }
}

interface Inst { x: number; y: number; z: number; s: number; sy?: number; ry: number; c?: number }
function instanced(geo: THREE.BufferGeometry, mat: THREE.Material, items: Inst[], shadow = false) {
  const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, items.length));
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), c = new THREE.Color();
  items.forEach((it, i) => {
    q.setFromEuler(e.set(0, it.ry, 0));
    m.compose(new V3(it.x, it.y, it.z), q, new V3(it.s, it.sy ?? it.s, it.s));
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, c.setHex(it.c ?? 0xffffff));
  });
  mesh.count = items.length;
  mesh.castShadow = shadow;
  mesh.frustumCulled = false;
  return mesh;
}

interface Atmo { fog: THREE.Color; near: number; far: number; top: THREE.Color; hor: THREE.Color; sun: THREE.Color; sunI: number; hemi: number; exp: number }
const A = (fog: number, near: number, far: number, top: number, hor: number, sun: number, sunI: number, hemi: number, exp = 1): Atmo =>
  ({ fog: new THREE.Color(fog), near, far, top: new THREE.Color(top), hor: new THREE.Color(hor), sun: new THREE.Color(sun), sunI, hemi, exp });
const CITY = A(0x5a4a44, 10, 95, 0x2e2a36, 0x8a5a44, 0xffb089, 1.3, 0.8);
const MARSH = A(0x55604f, 5, 52, 0x39413c, 0x66705e, 0xcfd8c0, 0.7, 0.8);
const SKY_KEYS: [number, Atmo][] = [
  [0, CITY], [50, CITY],
  [95, A(0x7a7a78, 18, 130, 0x4a5262, 0x9a9186, 0xffe0c0, 1.5, 0.85)],
  [140, MARSH], [198, MARSH],
  [225, A(0x8a9390, 25, 150, 0x56677c, 0xb3aa98, 0xfff0d8, 1.7, 0.9)],
  [295, A(0x93968a, 25, 150, 0x4f6380, 0xd9b98c, 0xffe6c0, 1.8, 0.95)],
  [345, A(0x7e7f93, 25, 160, 0x3c4a72, 0xe0a878, 0xffd0a0, 1.5, 0.85)],
  [620, A(0x7e7f93, 25, 160, 0x3c4a72, 0xe0a878, 0xffd0a0, 1.5, 0.85)],
];
const DAWN = A(0xcfe0ea, 45, 300, 0x4f8fd8, 0xffe6b8, 0xfff1d0, 2.6, 1.1, 1.08);
const SHADE = A(0x25222c, 4, 38, 0x1a1820, 0x3a3040, 0x8a80a0, 0.35, 0.4);
function mixAtmo(out: Atmo, a: Atmo, b: Atmo, t: number) {
  out.fog.lerpColors(a.fog, b.fog, t); out.top.lerpColors(a.top, b.top, t);
  out.hor.lerpColors(a.hor, b.hor, t); out.sun.lerpColors(a.sun, b.sun, t);
  out.near = lerp(a.near, b.near, t); out.far = lerp(a.far, b.far, t);
  out.sunI = lerp(a.sunI, b.sunI, t); out.hemi = lerp(a.hemi, b.hemi, t); out.exp = lerp(a.exp, b.exp, t);
  return out;
}

export const COVER = [{ x: -4, z: 272, r: 1.4 }, { x: 5, z: 278, r: 1.4 }, { x: -6, z: 284, r: 1.4 }, { x: 3, z: 289.5, r: 1.4 }, { x: -3, z: 294.5, r: 1.4 }];
export const TOWER = { x: 25, z: 284, y: 0 };
export const SUN_DIR = new V3(0.28, 0.5, 0.82).normalize();

export class World {
  solid = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95, metalness: 0 });
  glow = new THREE.MeshBasicMaterial({ vertexColors: true });
  sun = new THREE.DirectionalLight(0xffffff, 1.5);
  hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.8);
  fog = new THREE.Fog(0x5a4a44, 10, 95);
  sky!: THREE.Mesh;
  skyU!: Record<string, THREE.IUniform>;
  motes!: THREE.Points;
  planks: THREE.Mesh[] = [];
  slip!: THREE.Mesh;
  rope!: THREE.Line;
  beacon!: THREE.Sprite;
  ring!: THREE.Mesh;
  arrow!: THREE.Mesh;
  stuck: THREE.Mesh[] = [];
  shadowWall = new THREE.Group();
  shadowMat = new THREE.MeshBasicMaterial({ color: 0x08060c, transparent: true, opacity: 0.86, depthWrite: false });
  hillFlowers!: THREE.InstancedMesh;
  looseBurden = new THREE.Group();
  farHills = new THREE.Group();
  farMat = new THREE.MeshBasicMaterial({ color: 0x8fa9c6, fog: false });
  chalks: THREE.Mesh[] = [];
  softTops: THREE.Mesh[] = [];
  tombLight = new THREE.PointLight(0xffe2a8, 0, 22, 1.6);
  gateLight = new THREE.PointLight(0xffd08a, 70, 34, 1.7);
  sinaiLight = new THREE.PointLight(0xff5a2a, 0, 60, 1.4);
  private cur = A(0, 0, 0, 0, 0, 0, 0, 0);
  private tmp = A(0, 0, 0, 0, 0, 0, 0, 0);
  private R = rng(11);

  constructor(public g: Game) {
    const sc = g.scene;
    sc.fog = this.fog;
    sc.add(this.hemi, this.sun, this.sun.target);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const cam = this.sun.shadow.camera;
    cam.left = cam.bottom = -46; cam.right = cam.top = 46; cam.near = 1; cam.far = 220;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.06;

    sc.add(buildTerrain());
    this.buildSky();
    this.city();
    this.fields();
    this.slough();
    this.road();
    this.gate();
    this.hill();
    this.beyond();
    this.scatter();
    this.dynamic();
  }

  private col(c: any) { this.g.colliders.push(c); }

  private bake(b: Batch, gl?: Batch) {
    if (b.parts.length) this.g.scene.add(b.mesh(this.solid));
    if (gl && gl.parts.length) this.g.scene.add(gl.mesh(this.glow, false));
  }

  /** A crooked little house with its door on local +Z. */
  private house(b: Batch, gl: Batch, x: number, z: number, ry: number, w: number, d: number, h: number, wall: number, roof: number, lit = true, tilt = 0) {
    const R = this.R, y = height(x, z) - 0.3, rh = 1.4 + R() * 1.1, H = h + 0.3;
    b.at(x, y, z, ry, tilt); gl.at(x, y, z, ry, tilt);
    b.box(wall, 0, H / 2, 0, w, H, d);
    b.add(CONE4, roof, 0, H + rh / 2, 0, w + 0.7, rh, d + 0.7);
    b.box(0x2a2018, 0, 1.2, d / 2 + 0.03, 0.95, 1.8, 0.08);
    b.box(0x3a2c22, w * 0.28, H + rh * 0.55, -d * 0.1, 0.5, 1.3, 0.5);
    for (const sx of [-1, 1]) {
      if (lit) gl.box(R() < 0.6 ? 0xffc56a : 0xd88a4a, sx * w * 0.3, H * 0.62, d / 2 + 0.03, 0.62, 0.62, 0.07);
      else b.box(0x1d1815, sx * w * 0.3, H * 0.62, d / 2 + 0.03, 0.62, 0.62, 0.07);
    }
    b.home(); gl.home();
    this.col({ k: 'b', x, z, hw: w / 2 + 0.1, hd: d / 2 + 0.1, rot: ry, tall: true });
  }

  private wallSeg(b: Batch, x1: number, z1: number, x2: number, z2: number, h: number, th: number, color: number, collide = true) {
    const cx = (x1 + x2) / 2, cz = (z1 + z2) / 2, L = Math.hypot(x2 - x1, z2 - z1);
    const rot = Math.atan2(-(z2 - z1), x2 - x1);
    const y = Math.min(height(x1, z1), height(x2, z2), height(cx, cz)) - 0.5;
    b.box(color, cx, y + (h + 0.5) / 2, cz, L + 0.06, h + 0.5, th, rot);
    if (collide) this.col({ k: 'b', x: cx, z: cz, hw: L / 2, hd: th / 2, rot, tall: true });
  }

  private lamp(b: Batch, gl: Batch, x: number, z: number, h = 2.7, color = 0xffc978) {
    const y = height(x, z);
    b.add(CYL6, 0x2c2622, x, y + h / 2, z, 0.06, h, 0.06);
    gl.add(ICO0, color, x, y + h + 0.12, z, 0.17, 0.2, 0.17);
    this.col({ k: 'c', x, z, r: 0.2 });
  }

  private treeAt(b: Batch, x: number, z: number, s = 1, leaf = 0x4f8a44) {
    const y = height(x, z);
    b.add(CYL6, 0x4a3a2a, x, y + 0.9 * s, z, 0.17 * s, 1.8 * s, 0.17 * s);
    b.add(ICO1, leaf, x, y + 2.7 * s, z, 1.35 * s, 1.25 * s, 1.35 * s);
    b.add(ICO0, leaf, x + 0.7 * s, y + 2.1 * s, z + 0.3 * s, 0.8 * s, 0.75 * s, 0.8 * s);
    this.col({ k: 'c', x, z, r: 0.35 * s });
  }

  // ---- City of Destruction --------------------------------------------------

  private city() {
    const b = new Batch(), gl = new Batch(), R = this.R;
    const taken: { x: number; z: number; r: number }[] = [{ x: 20.5, z: -1, r: 2 }, { x: 27, z: 21, r: 3.5 }];
    const H = (x: number, z: number, ry: number, w: number, d: number, h: number, wall: number, roof: number, lit = true, tilt = 0) => {
      this.house(b, gl, x, z, ry, w, d, h, wall, roof, lit, tilt);
      taken.push({ x, z, r: Math.max(w, d) * 0.75 });
    };
    H(-19.5, -14, Math.PI / 2, 6, 5, 3.2, 0x6f6257, 0x4a3b36);            // the pilgrim's house
    H(17, -8, -Math.PI / 2, 6.5, 5.5, 3.4, 0x7a6a55, 0x5a3a30);           // Hester's bakery
    H(0, -30, 0, 13, 8, 6.5, 0x5a5650, 0x34343c);                         // the Tally-House

    // bakery stall
    let y = height(12.9, -6);
    b.box(0x6a5238, 12.9, y + 0.5, -6, 0.9, 1.0, 3.2);
    b.box(0x8a4a3a, 12.7, y + 2.5, -6, 2.4, 0.08, 3.8, 0, 0, 0.16);
    b.box(0x3a2c22, 11.7, y + 1.2, -4.3, 0.1, 2.4, 0.1).box(0x3a2c22, 11.7, y + 1.2, -7.7, 0.1, 2.4, 0.1);
    for (let i = 0; i < 5; i++) b.add(ICO0, 0xc99a5a, 12.9, y + 1.08, -7.2 + i * 0.6, 0.2, 0.12, 0.26);
    gl.box(0xff8a3a, 13.72, y + 1.0, -9.6, 0.07, 0.8, 0.9);
    this.col({ k: 'b', x: 12.9, z: -6, hw: 0.55, hd: 1.7, rot: 0 });

    // Tally-House portico and the board
    y = height(0, -25);
    b.box(0x6a665e, 0, y + 0.1, -25.2, 10, 0.3, 2.0);
    for (const cx of [-4.4, -1.5, 1.5, 4.4]) b.add(CYL10, 0x8a857a, cx, y + 2.9, -25.2, 0.33, 5.6, 0.33);
    b.box(0x4a4844, 0, y + 5.9, -25.2, 10.4, 0.5, 1.6);
    for (const cx of [-4.4, -1.5, 1.5, 4.4]) this.col({ k: 'c', x: cx, z: -25.2, r: 0.45 });
    y = height(-4.5, -21.2);
    b.box(0x3a2c22, -6.1, y + 1.7, -21.2, 0.16, 3.4, 0.16).box(0x3a2c22, -2.9, y + 1.7, -21.2, 0.16, 3.4, 0.16);
    b.box(0x23262b, -4.5, y + 2.2, -21.2, 3.5, 2.5, 0.14);
    for (let r = 0; r < 8; r++) {
      const n = Math.max(1, 15 - r * 2 + ((R() * 3) | 0));
      b.box(0xcfc9ba, -5.75, y + 3.2 - r * 0.28, -21.12, 0.5, 0.05, 0.02);
      for (let k = 0; k < n; k++) b.box(0xe8e4d8, -5.3 + k * 0.17, y + 3.2 - r * 0.28, -21.12, 0.035, 0.17, 0.02, 0, 0, 0.12);
    }
    this.col({ k: 'b', x: -4.5, z: -21.2, hw: 1.9, hd: 0.25, rot: 0 });
    // strokes chalked beside the pilgrim's name: one for the slip, one for each load carried
    for (let k = 0; k < 4; k++) {
      const m = new THREE.Mesh(BOX, new THREE.MeshBasicMaterial({ color: 0xffffff }));
      m.scale.set(0.04, 0.17, 0.02);
      m.rotation.z = 0.12;
      m.position.set(-4.96 + k * 0.17, y + 3.2 - 7 * 0.28, -21.11);
      m.visible = false;
      this.chalks.push(m);
      this.g.scene.add(m);
    }
    // where loads are set down, by the Tally-House steps
    y = height(6.4, -23.8);
    b.box(0x6a5238, 6.4, y + 0.3, -23.8, 0.7, 0.6, 0.6, 0.2).box(0x5e4830, 7.2, y + 0.3, -23.5, 0.7, 0.6, 0.6, -0.3).box(0x6a5238, 6.8, y + 0.9, -23.7, 0.65, 0.55, 0.55, 0.5);
    this.col({ k: 'c', x: 6.8, z: -23.7, r: 0.9 });

    // ring houses, facing the square
    const walls = [0x6a5e52, 0x74685a, 0x5e564e, 0x7a6f60, 0x665a50], roofs = [0x4a3b36, 0x3e3a40, 0x553a30, 0x44403a];
    for (const [rad, count, off] of [[25, 11, 0.28], [34.5, 17, 0.1]]) {
      for (let i = 0; i < count; i++) {
        const a = off + (i / count) * Math.PI * 2, x = Math.sin(a) * rad, z = Math.cos(a) * rad;
        if (Math.abs(x) < 5.5 && z > 0) continue;
        if (taken.some((o) => Math.hypot(x - o.x, z - o.z) < o.r + 5.2)) continue;
        H(x, z, Math.atan2(-x, -z) + (R() - 0.5) * 0.3, 4.4 + R() * 2, 4 + R() * 1.6, 2.6 + R() * 1.6,
          walls[(R() * walls.length) | 0], roofs[(R() * roofs.length) | 0], R() < 0.72, (R() - 0.5) * 0.08);
      }
    }

    // the wall: always cracking, always being patched
    const N = 36;
    for (let i = 1; i < N; i++) {
      const a0 = ((i - 0.5) / N) * Math.PI * 2, a1 = ((i + 0.5) / N) * Math.PI * 2;
      this.wallSeg(b, Math.sin(a0) * 41, Math.cos(a0) * 41, Math.sin(a1) * 41, Math.cos(a1) * 41, 4.4 + R() * 0.8, 1.3, i % 3 ? 0x57504a : 0x625a52);
      if (i % 4 === 1) {
        const am = (i / N) * Math.PI * 2;
        b.box(0x8a8072, Math.sin(am) * 40.3, height(Math.sin(am) * 40, Math.cos(am) * 40) + 1.2 + R() * 1.5, Math.cos(am) * 40.3, 1.6, 1.3, 0.2, am);
      }
    }
    for (const sx of [-1, 1]) {
      y = height(sx * 4.4, 40.8);
      b.box(0x4f4842, sx * 4.4, y + 3.4, 40.8, 2.2, 7.4, 2.2);
      b.add(CONE4, 0x34343c, sx * 4.4, y + 7.9, 40.8, 2.8, 1.8, 2.8);
      b.box(0x4a3424, sx * 3.0, y + 1.6, 42.4, 0.14, 3.0, 2.6, sx * 0.5);
      this.col({ k: 'b', x: sx * 4.4, z: 40.8, hw: 1.1, hd: 1.1, rot: 0, tall: true });
    }
    // scaffold where Obstinate's crew is patching
    for (let k = 0; k < 3; k++) {
      const a = -0.72 + k * 0.07, x = Math.sin(a) * 39.6, z = Math.cos(a) * 39.6;
      b.box(0x6a5238, x, height(x, z) + 1.8, z, 0.1, 3.6, 0.1);
      if (k < 2) b.box(0x7a6040, Math.sin(a + 0.035) * 39.6, height(x, z) + 2.4, Math.cos(a + 0.035) * 39.6, 2.9, 0.07, 0.6, a + 0.035);
    }

    // the square
    y = height(0, 2);
    b.add(CYL10, 0x6a645c, 0, y + 0.45, 2, 1.15, 0.9, 1.15).add(CYL10, 0x161c20, 0, y + 0.9, 2, 0.92, 0.04, 0.92);
    b.box(0x3a2c22, -1.05, y + 1.4, 2, 0.12, 2.0, 0.12).box(0x3a2c22, 1.05, y + 1.4, 2, 0.12, 2.0, 0.12).box(0x3a2c22, 0, y + 2.4, 2, 2.5, 0.12, 0.12);
    this.col({ k: 'c', x: 0, z: 2, r: 1.35 });
    for (const [sx, sz, c] of [[-8, 9, 0x6a3a3a], [8.5, 9.5, 0x3a4a5a]]) {
      y = height(sx, sz);
      b.box(0x5a4632, sx, y + 0.45, sz, 2.6, 0.9, 1.2).box(c, sx, y + 2.3, sz, 3.0, 0.07, 1.7, 0, 0.14);
      b.box(0x3a2c22, sx - 1.4, y + 1.15, sz + 0.75, 0.09, 2.3, 0.09).box(0x3a2c22, sx + 1.4, y + 1.15, sz + 0.75, 0.09, 2.3, 0.09);
      this.col({ k: 'b', x: sx, z: sz, hw: 1.4, hd: 0.7, rot: 0 });
    }
    for (const [lx, lz] of [[-5.5, -7], [6, 11.5], [-3.2, 22], [3.2, 34], [-13, -10], [9, -16]]) this.lamp(b, gl, lx, lz);
    // cart behind the bakery
    y = height(20.5, -1);
    b.box(0x5a4632, 20.5, y + 0.75, -1, 2.4, 0.5, 1.3, 0.4);
    b.add(CYL10, 0x2c2622, 19.9, y + 0.45, -0.1, 0.45, 0.1, 0.45, 0.4, Math.PI / 2).add(CYL10, 0x2c2622, 21.2, y + 0.45, -1.8, 0.45, 0.1, 0.45, 0.4, Math.PI / 2);
    this.col({ k: 'c', x: 20.5, z: -1, r: 1.3 });
    // porter's crates, a bench by the gate, a leaning tower, rubble
    for (const [cx, cz, s] of [[-10.2, -4.6, 0.8], [-10.9, -3.6, 0.6], [-10.3, -4.4, 0.55]]) b.box(0x6a5238, cx, height(cx, cz) + s / 2 + (s < 0.6 ? 0.8 : 0), cz, s, s, s, R());
    this.col({ k: 'c', x: -10.5, z: -4.2, r: 0.9 });
    b.box(0x5a4632, -7.2, height(-7.2, 31) + 0.42, 31, 0.5, 0.12, 1.7);
    this.col({ k: 'c', x: -7.2, z: 31, r: 0.7 });
    y = height(27, 21) - 0.6;
    b.at(27, y, 21, 0, 0.11).add(CYL10, 0x4f4944, 0, 8, 0, 2.4, 16, 2.4).add(CONE6, 0x34343c, 0, 17.4, 0, 2.9, 2.8, 2.9).box(0x16120f, 0.4, 9, 2.36, 0.12, 6, 0.1, 0, 0, 0.2).home();
    this.col({ k: 'c', x: 27, z: 21, r: 2.8, tall: true });
    for (let i = 0; i < 46; i++) {
      const a = R() * 6.28, r = 14 + R() * 25, x = Math.sin(a) * r, z = Math.cos(a) * r;
      if (taken.some((o) => Math.hypot(x - o.x, z - o.z) < o.r + 1.5)) continue;
      const s = 0.12 + R() * 0.25;
      b.add(ICO0, 0x4a433c, x, height(x, z) + s * 0.3, z, s, s * 0.7, s, R() * 6);
    }
    this.bake(b, gl);
  }

  // ---- the fields and the plain ----------------------------------------------

  private fields() {
    const b = new Batch();
    this.treeAt(b, 12.8, 62, 1.25, 0x6f7a48);
    for (let z = 48; z < 124; z += 6) {
      const c = corr(z);
      for (const s of [-1, 1]) {
        const x = c.cx + s * 3.3;
        b.box(0x4a3e30, x, height(x, z) + 0.5, z, 0.14, 1.1, 0.14, 0, 0, (this.R() - 0.5) * 0.3);
      }
    }
    let y = height(-11, 86);
    b.box(0x4a3e30, -11, y + 1.0, 86, 0.1, 2.0, 0.1).box(0x4a3e30, -11, y + 1.45, 86, 1.5, 0.08, 0.08).box(0x7a6a50, -11, y + 1.2, 86, 0.5, 0.7, 0.2).add(ICO0, 0xa89868, -11, y + 2.1, 86, 0.2, 0.22, 0.2);
    this.col({ k: 'c', x: -11, z: 86, r: 0.3 });
    y = height(-2.4, 104);
    b.box(0x8a857a, -2.4, y + 0.45, 104, 0.5, 0.95, 0.28, 0.3);
    this.col({ k: 'c', x: -2.4, z: 104, r: 0.4 });
    this.bake(b);
  }

  // ---- the Slough of Despond ----------------------------------------------------

  private slough() {
    const b = new Batch(), gl = new Batch();
    const mud = new THREE.Mesh(new THREE.PlaneGeometry(76, 76).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0x37351f, roughness: 0.35, metalness: 0.1, transparent: true, opacity: 0.95 }));
    mud.position.set(13, MUD_Y, 166.5);
    mud.receiveShadow = true;
    this.g.scene.add(mud);

    this.house(b, gl, 0.5, 192, Math.PI / 2, 4.4, 3.8, 2.4, 0x6a6a50, 0x4a4030);   // Help's hut
    this.lamp(b, gl, 9.5, 178.6, 2.4, 0xffd58a);
    this.lamp(b, gl, 4.2, 189.4, 2.2, 0xffd58a);
    const y = height(5, 194);
    b.add(CYL10, 0x8c7650, 5, y + 0.14, 194.6, 0.4, 0.28, 0.4);                       // rope coil
    b.box(0x5a4632, 6.5, y + 0.3, 191.2, 1.2, 0.12, 0.4);                             // a seat by the door
    // marker posts for the old boardwalk
    for (const s of SLOTS) {
      const dx = s.bx - s.ax, dz = s.bz - s.az, l = Math.hypot(dx, dz), px = -dz / l, pz = dx / l;
      for (const [ex, ez] of [[s.ax, s.az], [s.bx, s.bz]]) {
        for (const side of [-0.85, 0.85]) {
          const x = ex + px * side, z = ez + pz * side;
          b.box(0x4a4036, x, Math.max(height(x, z), MUD_Y) + 0.45, z, 0.13, 1.1, 0.13, 0, 0, (this.R() - 0.5) * 0.3);
        }
      }
    }
    for (const [x, z] of [[-10, 140], [15, 139], [-11, 156], [16, 158], [-9, 170], [26, 165], [41, 178], [44, 193], [30, 197], [-12, 188], [-7, 197]]) {
      const yy = Math.max(height(x, z), MUD_Y) - 0.2, s = 0.9 + this.R() * 0.5;
      b.add(CYL6, 0x3d352e, x, yy + 1.5 * s, z, 0.14 * s, 3.0 * s, 0.14 * s, 0, 0, (this.R() - 0.5) * 0.3);
      b.box(0x3d352e, x + 0.4 * s, yy + 2.3 * s, z, 0.9 * s, 0.07, 0.07, this.R() * 3, 0, 0.6);
      b.box(0x3d352e, x - 0.3 * s, yy + 2.7 * s, z + 0.2, 0.7 * s, 0.06, 0.06, this.R() * 3, 0, -0.7);
      this.col({ k: 'c', x, z, r: 0.35 });
    }
    this.bake(b, gl);
    // rotten tussocks: a shade yellower than the sound ones, for anyone looking closely
    for (const sp of SOFT) {
      const m = new THREE.Mesh(ICO0, new THREE.MeshStandardMaterial({ color: 0x66682e, flatShading: true, roughness: 1 }));
      m.scale.set(sp.r * 1.08, 0.36, sp.r * 1.08);
      m.position.set(sp.x, -0.22, sp.z);
      m.rotation.y = sp.x;
      m.receiveShadow = true;
      this.softTops.push(m);
      this.g.scene.add(m);
    }
    // The bank facing the main crossing can't be climbed with a burden on:
    // someone has to reach down.
    this.col({ k: 'b', x: 0, z: 175.3, hw: 21.5, hd: 0.25, rot: 0 });
  }

  // ---- the road, the crossroads, the hill that overhangs -------------------------

  private road() {
    const b = new Batch(), gl = new Batch();
    for (const [x, z, s] of [[9, 215, 1.1], [-9, 222, 1.3], [12, 229, 1], [11, 248, 1.2], [-6, 259, 1.1], [10, 262, 0.9]]) this.treeAt(b, x, z, s);
    // signpost
    let y = height(-4.4, 238.6);
    b.box(0x4a3e30, -4.4, y + 1.4, 238.6, 0.14, 2.8, 0.14);
    b.box(0x9a8a68, -5.0, y + 2.4, 238.75, 1.5, 0.34, 0.06, -0.28).box(0x8a7a5a, -3.9, y + 1.95, 238.6, 1.2, 0.3, 0.06, 1.45);
    this.col({ k: 'c', x: -4.4, z: 238.6, r: 0.3 });
    // the overhanging hill
    y = height(-58, 258);
    b.add(ICO0, 0x2e2a2c, -60, y + 10, 266, 13, 11, 11, 0.4);
    b.add(ICO0, 0x353033, -50, y + 13, 263, 9, 7, 8, 1.2);
    b.add(ICO0, 0x29262a, -66, y + 7, 256, 8, 9, 8, 2.2);
    b.add(ICO0, 0x2e2a2c, -57, y + 15, 257, 7, 4.5, 7, 0.9);
    for (const [gx, gy, gz, rz] of [[-56, 8, 259.5, 0.4], [-52, 10, 258.8, -0.5], [-60, 6, 257.5, 0.9], [-54, 13, 259, 0.1]]) {
      gl.box(0xff5a22, gx, y + gy, gz, 0.12, 2.4, 0.3, 0.3, 0, rz);
    }
    this.sinaiLight.position.set(-54, y + 6, 256);
    this.g.scene.add(this.sinaiLight);
    this.bake(b, gl);
  }

  // ---- the Wicket Gate and the garden behind it -----------------------------------

  private gate() {
    const b = new Batch(), gl = new Batch();
    for (const c of COVER) {
      const y = height(c.x, c.z);
      b.add(ICO0, 0x7a7a70, c.x, y + 0.8, c.z, 1.45, 1.75, 1.3, c.x);
      b.add(ICO0, 0x6c6c63, c.x + 0.9, y + 0.4, c.z + 0.5, 0.8, 0.8, 0.7, c.z);
      this.col({ k: 'c', x: c.x, z: c.z, r: c.r });
    }
    // the captain's tower, off the road
    let y = (TOWER.y = height(TOWER.x, TOWER.z));
    b.add(CYL10, 0x1f1c22, TOWER.x, y + 6.5, TOWER.z, 2.6, 15, 2.6).add(CONE6, 0x141217, TOWER.x, y + 15.6, TOWER.z, 3.2, 3.4, 3.2);
    gl.box(0xd8361c, TOWER.x - 2.5, y + 11, TOWER.z, 0.2, 1.3, 0.45).box(0xd8361c, TOWER.x - 1.9, y + 11, TOWER.z + 1.75, 0.2, 1.3, 0.4, -0.7);
    // the wall and the little gate
    y = height(0, 300);
    this.wallSeg(b, -17, 300, -1.3, 300, 5.3, 1.4, 0xb9ae96, false);
    this.wallSeg(b, 1.3, 300, 17, 300, 5.3, 1.4, 0xb9ae96, false);
    b.box(0xc9bea4, 0, y + 4.6, 300, 3.8, 1.5, 1.7).add(CONE4, 0x8a4a34, 0, y + 6.0, 300, 4.4, 1.3, 2.4);
    b.box(0x6a4a2c, 0, y + 1.9, 299.5, 2.5, 3.9, 0.22).box(0x2c2622, 0, y + 2.7, 299.37, 2.5, 0.12, 0.05).box(0x2c2622, 0, y + 1.0, 299.37, 2.5, 0.12, 0.05);
    b.box(0xe8dfc8, 0, y + 4.5, 299.12, 2.6, 0.5, 0.06);
    gl.add(ICO1, 0xffe6a8, 0, y + 7.3, 300, 0.36, 0.42, 0.36);
    this.gateLight.position.set(0, y + 6.6, 298.6);
    this.g.scene.add(this.gateLight);
    this.col({ k: 'b', x: 0, z: 300, hw: 18, hd: 0.85, rot: 0, tall: true });
    // Goodwill's lodge, table and well
    this.house(b, gl, 9, 309, -Math.PI / 2, 5, 4.5, 2.8, 0xc9b892, 0x8a4a34);
    y = height(-5, 309.5);
    b.box(0x7a6040, -5, y + 0.78, 309.5, 1.7, 0.08, 0.95);
    for (const [lx, lz] of [[-0.7, -0.35], [0.7, -0.35], [-0.7, 0.35], [0.7, 0.35]]) b.box(0x5a4632, -5 + lx, y + 0.38, 309.5 + lz, 0.09, 0.76, 0.09);
    b.box(0x7a6040, -5, y + 0.45, 310.6, 1.7, 0.09, 0.4).box(0x5a4632, -5.7, y + 0.22, 310.6, 0.09, 0.44, 0.34).box(0x5a4632, -4.3, y + 0.22, 310.6, 0.09, 0.44, 0.34);
    b.add(ICO0, 0xd2a25e, -5.2, y + 0.93, 309.4, 0.26, 0.14, 0.18).add(CYL10, 0x9a8a78, -4.5, y + 0.92, 309.6, 0.09, 0.2, 0.09);
    this.col({ k: 'c', x: -5, z: 309.6, r: 1.0 });
    y = height(-9.5, 314.5);
    b.add(CYL10, 0xa8a090, -9.5, y + 0.45, 314.5, 1.0, 0.9, 1.0).add(CYL10, 0x4f8fb0, -9.5, y + 0.9, 314.5, 0.8, 0.04, 0.8);
    this.col({ k: 'c', x: -9.5, z: 314.5, r: 1.15 });
    // the Interpreter's house (closed in this build)
    this.house(b, gl, -10.2, 324, Math.PI / 2, 6, 5, 3.6, 0xbfb49a, 0x4a5a78);
    y = height(-5.8, 321);
    b.box(0x4a3e30, -5.8, y + 0.8, 321, 0.12, 1.6, 0.12).box(0xe0d6ba, -5.8, y + 1.45, 321.05, 0.9, 0.6, 0.06, Math.PI / 2);
    this.col({ k: 'c', x: -5.8, z: 321, r: 0.3 });
    this.lamp(b, gl, -6.4, 326.5, 2.2, 0xffe0a0);
    for (const [x, z, s] of [[10, 319, 1.2], [-4.5, 331, 1.0], [10.5, 331, 1.3], [-11.5, 304.5, 1.1]]) this.treeAt(b, x, z, s, 0x5c9a4a);
    // the way fenced on either side with a wall
    for (let z = 338; z < 399; z += 3) {
      for (const s of [-1, 1]) this.wallSeg(b, s * 6.25, z, s * 6.25, z + 3, 0.95, 0.5, (z / 3) % 2 ? 0xd8cdb0 : 0xcfc4a6, false);
    }
    this.bake(b, gl);
  }

  // ---- the hill: the Cross, and a little below, the sepulchre ----------------------

  private hill() {
    const b = new Batch(), gl = new Batch();
    let y = height(0, 412);
    b.box(0x3a2a1c, 0, y + 2.6, 412, 0.34, 5.6, 0.34).box(0x3a2a1c, 0, y + 4.2, 412, 2.5, 0.32, 0.32);
    for (const [rx, rz, s] of [[0.5, 0.3, 0.4], [-0.45, 0.2, 0.33], [0.1, -0.5, 0.36], [-0.3, -0.35, 0.28]]) b.add(ICO0, 0x8c8878, rx, y + 0.12, 412 + rz, s, s * 0.7, s, rx * 9);
    this.col({ k: 'c', x: 0, z: 412, r: 0.5 });
    // the sepulchre, cut into the eastern rock
    y = height(19.6, 421);
    b.add(ICO0, 0x8c8878, 26.4, y + 1.9, 421, 4.8, 4.0, 5.6, 0.5);
    b.add(ICO0, 0x7f7b6c, 24.9, y + 1.0, 416.2, 2.9, 2.5, 2.7, 1.9);
    b.add(ICO0, 0x86826f, 25.1, y + 1.2, 425.9, 3.0, 2.7, 2.8, 3.1);
    b.box(0x9a9684, 21.5, y + 1.6, 421, 1.4, 4.0, 5.4);
    b.box(0x8c8878, 21.3, y + 3.75, 421, 1.9, 0.5, 6.0);
    b.box(0x0c0b0a, 20.78, y + 1.05, 421, 0.1, 2.1, 1.7);
    gl.box(0xffe9b8, 20.72, y + 0.8, 421.15, 0.05, 1.0, 1.0);
    b.box(0x9a9684, 20.5, y + 0.2, 421.3, 0.4, 0.22, 0.9).box(0xf6f2e8, 20.5, y + 0.35, 421.3, 0.3, 0.08, 0.5);
    b.add(CYL10, 0xa39e8c, 20.45, y + 1.1, 423.5, 1.25, 0.36, 1.25, 0.25, 0, Math.PI / 2 - 0.12);
    this.col({ k: 'c', x: 26.2, z: 421, r: 4.3, tall: true });
    this.col({ k: 'c', x: 20.6, z: 423.5, r: 0.9 });
    this.col({ k: 'b', x: 21.5, z: 421, hw: 0.8, hd: 2.8, rot: 0, tall: true });
    this.tombLight.position.set(19.6, y + 1.3, 421);
    this.g.scene.add(this.tombLight);
    this.bake(b, gl);
  }

  // ---- beyond the hill: the narrows, the spring, the view ----------------------------

  private beyond() {
    const b = new Batch();
    for (let z = 460; z <= 488; z += 4) {
      const c = corr(z);
      for (const s of [-1, 1]) {
        const x = c.cx + s * (c.hw + 1.4), sc = 2.0 + this.R() * 1.4;
        b.add(ICO0, 0x77786c, x, height(x, z) + sc * 0.3, z, sc, sc * 1.25, sc, this.R() * 6);
      }
    }
    // the spring and the milestone
    let y = height(-6, 498);
    b.add(CYL10, 0x6fb6d6, -6, y + 0.04, 498, 1.5, 0.06, 1.5);
    for (let i = 0; i < 9; i++) { const a = i * 0.7; b.add(ICO0, 0x8c8878, -6 + Math.sin(a) * 1.6, y + 0.1, 498 + Math.cos(a) * 1.6, 0.34, 0.26, 0.3, a); }
    b.box(0x9a9684, -3.6, y + 0.26, 499.6, 1.5, 0.5, 0.55, 0.3);
    this.col({ k: 'c', x: -6, z: 498, r: 1.7 });
    this.col({ k: 'c', x: -3.6, z: 499.6, r: 0.8 });
    y = height(2.6, 504.5);
    b.box(0xa39e8c, 2.6, y + 0.55, 504.5, 0.55, 1.15, 0.3, -0.2);
    this.col({ k: 'c', x: 2.6, z: 504.5, r: 0.45 });
    y = height(6.6, 499.4);
    b.box(0x7a6040, 6.6, y + 0.65, 499.4, 1.5, 0.5, 0.95, 0.5).add(CYL10, 0x3a2c22, 6.1, y + 0.36, 500.2, 0.36, 0.09, 0.36, 0.5, Math.PI / 2);
    b.box(0xd8d0bc, 6.6, y + 0.98, 499.4, 0.5, 0.2, 0.4, 0.9);
    this.col({ k: 'c', x: 6.6, z: 499.4, r: 1.05 });
    this.treeAt(b, 9, 492.5, 1.3, 0x6faa4e);
    this.treeAt(b, -9.5, 506, 1.1, 0x6faa4e);
    for (let x = -13; x <= 13; x += 2.6) b.box(0x7a6040, x, height(x, 512.2) + 0.5, 512.2, 0.13, 1.1, 0.13);
    b.box(0x7a6040, 0, height(0, 512.2) + 0.85, 512.2, 26.4, 0.09, 0.09);
    this.bake(b);
    // Hill Difficulty, far off, with a glint where Palace Beautiful stands
    const m1 = new THREE.Mesh(new THREE.ConeGeometry(150, 200, 7), this.farMat);
    m1.position.set(95, 50, 800);
    const m2 = new THREE.Mesh(new THREE.ConeGeometry(110, 120, 6), this.farMat);
    m2.position.set(-150, 20, 860);
    const m3 = new THREE.Mesh(new THREE.ConeGeometry(90, 90, 5), this.farMat);
    m3.position.set(250, 10, 760);
    const glint = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTex(), color: 0xfff0b0, fog: false, transparent: true, depthWrite: false }));
    glint.scale.setScalar(20);
    glint.position.set(84, 142, 722);
    this.farHills.add(m3);
    this.farHills.add(m1, m2, glint);
    this.g.scene.add(this.farHills);
  }

  // ---- trees, reeds, grass, flowers ------------------------------------------------

  private scatter() {
    const R = rng(5), sc = this.g.scene;
    const pine = new Batch().add(CYL6, 0x4a3a2a, 0, 0.6, 0, 0.14, 1.2, 0.14).add(CONE6, 0x2f5a3a, 0, 2.0, 0, 1.0, 2.2, 1.0).add(CONE6, 0x356642, 0, 3.1, 0, 0.7, 1.8, 0.7).geo();
    const round = new Batch().add(CYL6, 0x4a3a2a, 0, 0.8, 0, 0.16, 1.6, 0.16).add(ICO1, 0x4f8a44, 0, 2.6, 0, 1.3, 1.2, 1.3).add(ICO0, 0x457a3c, 0.6, 2.1, 0.3, 0.8, 0.75, 0.8).geo();
    const dead = new Batch().add(CYL6, 0x3d352e, 0, 1.4, 0, 0.13, 2.8, 0.13).box(0x3d352e, 0.4, 2.2, 0, 0.9, 0.07, 0.07, 0, 0, 0.6).box(0x3d352e, -0.3, 2.6, 0.1, 0.7, 0.06, 0.06, 1, 0, -0.7).box(0x3d352e, 0.1, 1.7, -0.3, 0.6, 0.06, 0.06, 2, 0, 0.5).geo();
    const P: Inst[] = [], Rd: Inst[] = [], D: Inst[] = [];
    const avoid = [[TOWER.x, TOWER.z, 5], [-58, 260, 18], [25, 421, 9], [0, 300, 4]];
    for (let i = 0; i < 3400; i++) {
      const x = -92 + R() * 164, z = -60 + R() * 670, e = edge(x, z);
      const valley = z > 534 && e < -2;
      if (!((e > 1.2 && e < 18) || (valley && R() < 0.5))) continue;
      if (avoid.some((a) => Math.hypot(x - a[0], z - a[1]) < a[2])) continue;
      if (z < 50 && R() < 0.55) continue;
      const it: Inst = { x, y: height(x, z) - 0.15, z, s: 0.8 + R() * 0.9, ry: R() * 6.28, c: new THREE.Color().setHSL(0, 0, 0.8 + R() * 0.2).getHex() };
      if (z < 128) (R() < (z < 50 ? 0.9 : 0.6) ? D : P).push(it);
      else if (z < 204) D.push(it);
      else (R() < 0.5 ? P : Rd).push(it);
    }
    sc.add(instanced(pine, this.solid, P, true), instanced(round, this.solid, Rd, true), instanced(dead, this.solid, D, true));

    const reed = new Batch().add(CONE4, 0x6a7040, 0, 0.6, 0, 0.07, 1.2, 0.07).add(CONE4, 0x5c6436, 0.12, 0.45, 0.05, 0.06, 0.9, 0.06, 0, 0, -0.15).add(CONE4, 0x747a48, -0.1, 0.5, 0.1, 0.06, 1.0, 0.06, 0, 0.12).add(CYL6, 0x3a2e20, 0, 1.15, 0, 0.045, 0.22, 0.045).geo();
    const reeds: Inst[] = [];
    for (let i = 0; i < 900; i++) {
      const x = -22 + R() * 72, z = 131 + R() * 71;
      if (!mireAt(x, z) || [...HUMMOCKS, ...SOFT].some((h) => Math.hypot(x - h.x, z - h.z) < h.r + 0.5)) continue;
      if (SLOTS.some((s) => segDist(x, z, s.ax, s.az, s.bx, s.bz).d < 1.4)) continue;
      if (Math.hypot(x - 38.7, z - 185.3) < 2 || (z > 174 && z < 177 && x < 17)) continue;
      reeds.push({ x, y: MUD_Y - 0.05, z, s: 0.8 + R() * 0.7, ry: R() * 6.28 });
    }
    sc.add(instanced(reed, this.solid, reeds));

    const tuft = new Batch().add(CONE4, 0xffffff, 0, 0.18, 0, 0.09, 0.36, 0.09).add(CONE4, 0xdddddd, 0.08, 0.14, 0.04, 0.07, 0.28, 0.07, 0, 0, -0.3).add(CONE4, 0xeeeeee, -0.07, 0.15, -0.03, 0.07, 0.3, 0.07, 0, 0, 0.3).geo();
    const tufts: Inst[] = [], gardenF: Inst[] = [], hillF: Inst[] = [];
    const petals = [0xffffff, 0xffd86a, 0xf29ab0, 0x8fb4f0, 0xffa25a];
    for (let i = 0; i < 9000; i++) {
      const x = -30 + R() * 80, z = 46 + R() * 466;
      if (edge(x, z) > -0.5) continue;
      const slough = z > 129 && z < 203;
      if (slough && (mireAt(x, z) || height(x, z) < MUD_Y + 0.15)) continue;
      const c = corr(z);
      if (!slough && Math.abs(x - c.cx) < 1.7) continue;
      const y = height(x, z);
      const flowerZone = (z > 302 && z < 336) || z > 398;
      if (flowerZone && R() < 0.45) {
        (z < 340 ? gardenF : hillF).push({ x, y: y + 0.16 + R() * 0.1, z, s: 0.07 + R() * 0.06, ry: R() * 6, c: petals[(R() * petals.length) | 0] });
        continue;
      }
      tufts.push({ x, y, z, s: 0.8 + R() * 1.1, ry: R() * 6.28, c: z < 128 ? 0xa89a58 : slough ? 0x5c6a38 : z < 340 ? 0x6fa04a : 0x8aba54 });
    }
    sc.add(instanced(tuft, this.solid, tufts));
    const fmat = new THREE.MeshBasicMaterial({ vertexColors: false });
    sc.add(instanced(ICO0, fmat, gardenF));
    // The hill is bare until the burden falls; then it flowers.
    this.hillFlowers = instanced(ICO0, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 }), hillF);
    sc.add(this.hillFlowers);
  }

  // ---- sky, weather, and things that move --------------------------------------------

  private buildSky() {
    this.skyU = {
      top: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, sunCol: { value: new THREE.Color() },
      sunDir: { value: SUN_DIR.clone() }, sunAmt: { value: 1 },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.skyU, side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
      vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `
        varying vec3 vDir; uniform vec3 top; uniform vec3 hor; uniform vec3 sunCol; uniform vec3 sunDir; uniform float sunAmt;
        void main(){
          vec3 d = normalize(vDir);
          vec3 c = mix(hor, top, smoothstep(0.0, 0.5, d.y));
          c = mix(c, hor * 0.75, smoothstep(0.0, -0.25, d.y));
          float s = max(dot(d, sunDir), 0.0);
          c += sunCol * (pow(s, 5.0) * 0.28 + pow(s, 60.0) * 0.5 + pow(s, 900.0) * 3.0) * sunAmt;
          gl_FragColor = vec4(c, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(900, 24, 14), mat);
    this.sky.renderOrder = -10;
    this.sky.frustumCulled = false;
    this.g.scene.add(this.sky);
  }

  private dynamic() {
    const sc = this.g.scene, wood = new THREE.MeshStandardMaterial({ color: 0x8a6a42, flatShading: true, roughness: 1 });
    PLANK_LEN.forEach((len) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(len, 0.09, 0.72), wood);
      m.castShadow = m.receiveShadow = true;
      this.planks.push(m);
      sc.add(m);
    });
    this.slip = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.02, 0.2), new THREE.MeshBasicMaterial({ color: 0xf4ecd4 }));
    this.slip.position.set(19.3, height(19.3, 0.6) + 0.04, 0.6);
    this.slip.rotation.y = 0.5;
    sc.add(this.slip);
    this.rope = new THREE.Line(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(16 * 3), 3)), new THREE.LineBasicMaterial({ color: 0xb09868 }));
    this.rope.frustumCulled = false;
    this.rope.visible = false;
    sc.add(this.rope);
    // the light over the Wicket Gate, seen from far off
    this.beacon = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTex(), color: 0xffe9a8, fog: false, depthTest: false, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.beacon.position.set(0, height(0, 300) + 7.3, 300);
    this.beacon.renderOrder = 5;
    this.beacon.visible = false;
    sc.add(this.beacon);
    // arrows from the tower
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.75, 1.0, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff5030, transparent: true, opacity: 0.85, depthWrite: false }));
    this.ring.visible = false;
    this.arrow = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.5, 4).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x18141a }));
    this.arrow.visible = false;
    sc.add(this.ring, this.arrow);
    for (let i = 0; i < 8; i++) {
      const s = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.2, 4), new THREE.MeshBasicMaterial({ color: 0x18141a }));
      s.visible = false;
      this.stuck.push(s);
      sc.add(s);
    }
    // the wall of shadow in the narrows: it looks solid
    const R = rng(3);
    for (let i = 0; i < 26; i++) {
      const m = new THREE.Mesh(CONE4, this.shadowMat);
      m.scale.set(0.8 + R() * 1.2, 3.5 + R() * 4, 0.8 + R() * 1.2);
      m.position.set(-10 + R() * 12, 0, 480 + (R() - 0.5) * 1.6);
      m.position.y = height(m.position.x, m.position.z) + m.scale.y / 2 - 0.2;
      m.rotation.set((R() - 0.5) * 0.4, R() * 3, (R() - 0.5) * 0.4);
      this.shadowWall.add(m);
    }
    this.shadowWall.visible = false;
    sc.add(this.shadowWall);
    // the burden, once it is off the pilgrim's back
    const sack = new THREE.MeshStandardMaterial({ color: 0x2b241f, roughness: 1, flatShading: true });
    for (const [r, x, y, z] of [[0.4, 0, 0, 0], [0.31, 0.12, 0.36, 0.06], [0.27, -0.16, -0.28, 0.02], [0.2, -0.1, 0.58, 0.12]]) {
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), sack);
      m.position.set(x, y, z);
      m.castShadow = true;
      this.looseBurden.add(m);
    }
    this.looseBurden.visible = false;
    sc.add(this.looseBurden);
    // drifting ash / mist / pollen
    const n = 520, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - 0.5) * 44; pos[i * 3 + 1] = Math.random() * 14; pos[i * 3 + 2] = (Math.random() - 0.5) * 44; }
    this.motes = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(pos, 3)),
      new THREE.PointsMaterial({ size: 0.11, color: 0xb0a8a0, transparent: true, opacity: 0.7, depthWrite: false, map: softTex() }));
    this.motes.frustumCulled = false;
    sc.add(this.motes);
  }

  /** Put the three boards where the save says they are. */
  syncPlanks() {
    const s = this.g.state;
    for (let i = 0; i < 3; i++) laid[i] = false;
    s.planks.forEach((where, i) => {
      const m = this.planks[i];
      m.visible = where !== -2;
      if (where >= 0) {
        const sl = SLOTS[where];
        laid[where] = true;
        m.position.set((sl.ax + sl.bx) / 2, 0.29, (sl.az + sl.bz) / 2);
        m.rotation.set(0, sl.rot, 0);
      } else if (where === -1) {
        const p = s.plankPos[i];
        m.position.set(p[0], height(p[0], p[1]) + 0.07, p[1]);
        m.rotation.set(0, p[2], 0.03);
      }
    });
  }

  setRope(ax: number, ay: number, az: number, bx: number, by: number, bz: number) {
    const p = this.rope.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < 16; i++) {
      const t = i / 15;
      p.setXYZ(i, lerp(ax, bx, t), lerp(ay, by, t) - Math.sin(t * Math.PI) * 0.5, lerp(az, bz, t));
    }
    p.needsUpdate = true;
  }

  update(dt: number) {
    const g = this.g, cam = g.camera.position;
    const z = g.mode === 'title' ? 0 : g.player.z;
    // atmosphere: keyed by how far along the road you are, then lit by the dawn or dimmed by accusation
    const K = SKY_KEYS;
    let i = 1;
    while (i < K.length - 1 && z > K[i][0]) i++;
    const t = Math.min(1, Math.max(0, (z - K[i - 1][0]) / (K[i][0] - K[i - 1][0])));
    mixAtmo(this.cur, K[i - 1][1], K[i][1], t);
    if (g.dawn > 0) mixAtmo(this.cur, mixAtmo(this.tmp, this.cur, this.cur, 0), DAWN, g.dawn);
    if (g.shade > 0) mixAtmo(this.cur, mixAtmo(this.tmp, this.cur, this.cur, 0), SHADE, g.shade * 0.85);
    const c = this.cur;
    const flick = g.fire > 0 ? g.fire * (0.5 + 0.5 * Math.sin(g.time * 13) * Math.sin(g.time * 7.3)) : 0;
    this.fog.color.copy(c.fog); this.fog.near = c.near; this.fog.far = c.far;
    this.skyU.top.value.copy(c.top); this.skyU.hor.value.copy(c.hor); this.skyU.sunCol.value.copy(c.sun);
    this.skyU.sunAmt.value = c.sunI / 1.6;
    this.sun.color.copy(c.sun); this.sun.intensity = c.sunI * 1.35 * (1 - flick * 0.5);
    this.hemi.color.copy(c.hor).lerp(new THREE.Color(0xffffff), 0.35).lerp(new THREE.Color(0xff4a1a), flick * 0.6);
    this.hemi.groundColor.copy(c.fog).multiplyScalar(0.8);
    this.hemi.intensity = c.hemi * 1.9;
    this.sinaiLight.intensity = flick * 900;
    g.renderer.toneMappingExposure = c.exp;
    this.sky.position.copy(cam);
    const fx = g.mode === 'title' ? cam.x : g.player.x, fz = g.mode === 'title' ? cam.z + 20 : g.player.z;
    this.sun.target.position.set(fx, height(fx, fz), fz);
    this.sun.position.copy(this.sun.target.position).addScaledVector(SUN_DIR, 110);
    this.sun.castShadow = g.settings.shadows;

    this.farHills.visible = z > 432;
    this.farMat.color.copy(c.hor).lerp(c.top, 0.55);
    SOFT.forEach((sp, k) => { this.softTops[k].position.y = -0.22 - sp.down * 0.7; });
    (this.hillFlowers.material as THREE.MeshBasicMaterial).opacity = g.dawn;
    this.hillFlowers.visible = g.dawn > 0.01;
    this.tombLight.intensity = g.dawn * 40;

    // the far light fades as you come up to the gate itself
    if (this.beacon.visible) {
      const d = Math.hypot(cam.x - this.beacon.position.x, cam.z - this.beacon.position.z);
      this.beacon.scale.setScalar(Math.max(1.5, d * 0.035) * (1 + Math.sin(g.time * 2.3) * 0.08));
      this.beacon.material.opacity = smooth(8, 40, d) * 0.95;
    }

    // motes
    const ash = 1 - smooth(46, 70, z), marsh = smooth(125, 138, z) * (1 - smooth(196, 206, z));
    const pm = this.motes.material as THREE.PointsMaterial;
    const gold = g.dawn * (1 - g.shade);
    pm.opacity = damp(pm.opacity, Math.max(ash * 0.7, marsh * 0.25, gold * 0.8), 2, dt);
    pm.color.setHex(gold > 0.5 ? 0xffe9a0 : marsh > 0.5 ? 0x9aa890 : 0xb0a8a0);
    const vy = gold > 0.5 ? 0.25 : ash > 0.5 ? -0.7 : -0.05;
    const p = this.motes.geometry.attributes.position as THREE.BufferAttribute, arr = p.array as Float32Array;
    for (let k = 0; k < arr.length; k += 3) {
      arr[k] += Math.sin(g.time * 0.4 + k) * 0.25 * dt;
      arr[k + 1] += vy * dt;
      if (arr[k] < cam.x - 22) arr[k] += 44; else if (arr[k] > cam.x + 22) arr[k] -= 44;
      if (arr[k + 2] < cam.z - 22) arr[k + 2] += 44; else if (arr[k + 2] > cam.z + 22) arr[k + 2] -= 44;
      if (arr[k + 1] < cam.y - 5) arr[k + 1] += 16; else if (arr[k + 1] > cam.y + 11) arr[k + 1] -= 16;
    }
    p.needsUpdate = true;
  }
}
