import * as THREE from 'three';
import { clamp, lerp, smooth, vnoise, segDist } from '../core/util';

// The whole slice is one continuous strip of land running along +Z:
// a round city at the origin, then a corridor whose centre, half-width and
// base height are keyed by z. Outside the walkable shape the ground rears
// up into cliffs, which is what keeps the pilgrim on the map.

export const MUD_Y = -0.3;
const MIRE_H = -0.6;
export const WORLD_END_Z = 511.3;

/** [z, centre x, half-width, base height] */
const KEYS: number[][] = [
  [40, 0, 16, 0.0], [70, 3, 18, 0.3], [100, -5, 13, 0.8], [126, 2, 14, 0.4],
  [134, 8, 22, 0.0], [172, 8, 22, 0.0], [178, 14, 34, 1.3], [198, 14, 34, 1.3],
  [206, 0, 13, 1.3], [235, 0, 16, 1.6], [262, 4, 12, 2.0], [285, 0, 18, 2.4],
  [300, 0, 14, 2.6], [325, 0, 14, 3.0], [340, 0, 6, 3.6], [395, 0, 6, 13.0],
  [405, 4, 20, 14.0], [428, 4, 20, 14.0], [440, 0, 8, 13.0], [468, -4, 5, 9.0],
  [486, -4, 5, 8.0], [496, 0, 12, 7.6], [512, 0, 14, 7.4], [530, 0, 40, 7.4], [620, 0, 60, 7.4],
];

export function corr(z: number) {
  const K = KEYS;
  if (z <= K[0][0]) return { cx: K[0][1], hw: K[0][2], h: K[0][3] };
  for (let i = 1; i < K.length; i++) {
    if (z <= K[i][0]) {
      const a = K[i - 1], b = K[i], t = smooth(0, 1, (z - a[0]) / (b[0] - a[0]));
      return { cx: lerp(a[1], b[1], t), hw: lerp(a[2], b[2], t), h: lerp(a[3], b[3], t) };
    }
  }
  const l = K[K.length - 1];
  return { cx: l[1], hw: l[2], h: l[3] };
}

// Mr Worldly Wiseman's side road, toward the hill that overhangs the way.
export const DETOUR = { ax: -2, az: 238, bx: -58, bz: 254, r: 7 };
const DETOUR_H0 = corr(238).h;
export function detour(x: number, z: number) {
  const s = segDist(x, z, DETOUR.ax, DETOUR.az, DETOUR.bx, DETOUR.bz);
  return { e: s.d - DETOUR.r, t: s.t };
}

function shape(x: number, z: number) {
  let e = Math.hypot(x, z) - 46, base = 0;
  const c = corr(z);
  const eC = Math.max(Math.abs(x - c.cx) - c.hw, 40 - z, z - 620);
  if (eC < e) { e = eC; base = c.h; }
  const d = detour(x, z);
  if (d.e < e) { e = d.e; base = DETOUR_H0 + smooth(0.3, 1, d.t) * 1.4; }
  return { e, base };
}

/** Distance outside the walkable area (negative = inside). */
export const edge = (x: number, z: number) => shape(x, z).e;

// ---- the Slough ------------------------------------------------------------

export interface Hummock { x: number; z: number; r: number }
const H1 = { x: 21.5, z: 186, r: 2.2 }, H2 = { x: 29.45, z: 187.99, r: 2.0 }, H3 = { x: 35.93, z: 184.85, r: 2.2 };
export const HUMMOCKS: Hummock[] = [
  { x: 2, z: 137, r: 2.4 }, { x: 6, z: 143, r: 2 }, { x: 0.5, z: 148, r: 1.8 }, { x: 7, z: 153.5, r: 2.2 },
  { x: 1, z: 159, r: 1.8 }, { x: 8, z: 164, r: 2 }, { x: 3, z: 169.5, r: 2.2 },
  { x: -7, z: 150, r: 1.6 }, { x: -8, z: 162, r: 1.5 }, { x: 13, z: 147, r: 1.5 },
  H1, H2, H3,
];
export const JOSS_SPOT = { x: 38.75, z: 185.3 };

export interface Slot { ax: number; az: number; bx: number; bz: number; gap: number; rot: number }
function between(a: Hummock, b: Hummock): Slot {
  const dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz), ux = dx / l, uz = dz / l;
  return { ax: a.x + ux * a.r, az: a.z + uz * a.r, bx: b.x - ux * b.r, bz: b.z - uz * b.r, gap: l - a.r - b.r, rot: Math.atan2(-uz, ux) };
}
/** The three gaps in the rotted boardwalk, nearest the bank first. */
export const SLOTS: Slot[] = [
  { ax: 17.3, az: 186, bx: H1.x - H1.r, bz: 186, gap: H1.x - H1.r - 17.3, rot: 0 },
  between(H1, H2),
  between(H2, H3),
];
export const PLANK_LEN = [2.6, 3.5, 4.5];
export const PLANK_NAME = ['short', 'middling', 'long'];
export const plankFits = (plank: number, slot: number) => PLANK_LEN[plank] >= SLOTS[slot].gap + 0.4;

/** Which gaps currently have a board across them (kept in step with the save state). */
export const laid: boolean[] = [false, false, false];
export function onPlank(x: number, z: number) {
  for (let i = 0; i < SLOTS.length; i++) {
    if (!laid[i]) continue;
    const s = SLOTS[i], dx = s.bx - s.ax, dz = s.bz - s.az, l = Math.hypot(dx, dz), ux = dx / l, uz = dz / l;
    if (segDist(x, z, s.ax - ux * 0.5, s.az - uz * 0.5, s.bx + ux * 0.5, s.bz + uz * 0.5).d < 0.62) return true;
  }
  return false;
}

/** 0 = sound ground, 1 = mire you can wade, 2 = deep mire. */
export function mireAt(x: number, z: number): 0 | 1 | 2 {
  if (z < 132.5 || z > 200.8) return 0;
  if (edge(x, z) > 0.2) return 0;
  if (z > 175.6 && x < 17.3) return 0;
  for (const m of HUMMOCKS) if (Math.hypot(x - m.x, z - m.z) < m.r) return 0;
  if (onPlank(x, z)) return 0;
  return x > 17.5 ? 2 : 1;
}

// ---- height ----------------------------------------------------------------

const bump = (x: number, z: number, cx: number, cz: number, r: number, amp: number) => {
  const d2 = (x - cx) * (x - cx) + (z - cz) * (z - cz), s = r * 0.5;
  return d2 > r * r * 4 ? 0 : amp * Math.exp(-d2 / (2 * s * s));
};

export function height(x: number, z: number) {
  const s = shape(x, z);
  let h = s.base;
  const e = s.e;
  const zw = smooth(128, 134, z) * (1 - smooth(200, 201.5, z));
  if (zw > 0) {
    let hs = lerp(MIRE_H, 1.3, smooth(174.6, 176, z) * (1 - smooth(12, 20, x)));
    for (const m of HUMMOCKS) {
      const d = Math.hypot(x - m.x, z - m.z);
      if (d < m.r * 1.5) hs = Math.max(hs, lerp(MIRE_H, 0.3, 1 - smooth(m.r * 0.75, m.r * 1.45, d)));
    }
    h = lerp(h, hs, zw);
  }
  h += bump(x, z, 10, 60, 7, 1.0) + bump(x, z, 0, 412, 5, 1.3) - bump(x, z, 15, 421, 8, 3.0);
  if (z > 512) h -= smooth(512, 526, z) * 30;
  const inCity = Math.hypot(x, z) < 44;
  h += (vnoise(x * 0.09, z * 0.09) - 0.5) * (inCity ? 0.12 : 0.34) * (1 - zw);
  if (e > 0) h += smooth(0, 6, e) * 10 + Math.max(0, e - 6) * 0.35 + vnoise(x * 0.12 + 7, z * 0.12) * smooth(1, 8, e) * 5;
  return h;
}

/** Where feet rest: terrain, the mud's surface, or a laid board. */
export function groundY(x: number, z: number) {
  let h = height(x, z);
  if (z > 128 && z < 203) {
    if (h < MUD_Y) h = MUD_Y;
    if (onPlank(x, z)) h = Math.max(h, 0.34);
  }
  return h;
}

// ---- mesh ------------------------------------------------------------------

const C = (hex: number) => new THREE.Color(hex);
const GROUND: [number, THREE.Color][] = [
  [0, C(0x5b5148)], [44, C(0x5b5148)], [56, C(0x8a7f4f)], [122, C(0x7d7a4a)], [132, C(0x4a5230)],
  [200, C(0x4a5230)], [208, C(0x5f8a45)], [330, C(0x659246)], [345, C(0x7fa24e)], [440, C(0x86b04f)], [620, C(0x8fb857)],
];
const ROCK: [number, THREE.Color][] = [
  [0, C(0x4a4038)], [120, C(0x57524a)], [135, C(0x3f4438)], [200, C(0x3f4438)], [215, C(0x6a6e62)], [400, C(0x868a78)], [620, C(0x8f927f)],
];
function ramp(table: [number, THREE.Color][], z: number, out: THREE.Color) {
  if (z <= table[0][0]) return out.copy(table[0][1]);
  for (let i = 1; i < table.length; i++) {
    if (z <= table[i][0]) return out.lerpColors(table[i - 1][1], table[i][1], (z - table[i - 1][0]) / (table[i][0] - table[i - 1][0]));
  }
  return out.copy(table[table.length - 1][1]);
}
const PATH = C(0x9a8662), PAVE = C(0x6a6058), BED = C(0x2a2c1c);

export function buildTerrain(): THREE.Mesh {
  const x0 = -94, x1 = 74, z0 = -64, z1 = 622, step = 1.6;
  const nx = Math.round((x1 - x0) / step), nz = Math.round((z1 - z0) / step);
  const pos = new Float32Array((nx + 1) * (nz + 1) * 3);
  const col = new Float32Array((nx + 1) * (nz + 1) * 3);
  const c = new THREE.Color(), r = new THREE.Color();
  let i = 0;
  for (let iz = 0; iz <= nz; iz++) {
    for (let ix = 0; ix <= nx; ix++, i += 3) {
      const x = x0 + ix * step, z = z0 + iz * step;
      const h = height(x, z), e = edge(x, z);
      pos[i] = x; pos[i + 1] = h; pos[i + 2] = z;
      ramp(GROUND, z, c);
      const city = Math.hypot(x, z);
      if (city < 13) c.lerp(PAVE, 0.8);
      if (e < 0) {
        const cr = corr(z);
        const onRoad = (z > 40 && z < 129) || (z > 203 && z < 512);
        if (onRoad) c.lerp(PATH, 0.85 * (1 - smooth(1.2, 2.4, Math.abs(x - cr.cx))));
        const d = detour(x, z);
        if (d.e < 0) c.lerp(PATH, 0.7 * (1 - smooth(1.0, 2.2, d.e + DETOUR.r)));
        if (city < 44 && Math.abs(x) < 2.2 && z > 0) c.lerp(PAVE, 0.7);
      }
      if (z > 130 && z < 202 && h < MUD_Y) c.lerp(BED, 0.9);
      if (e > 0) c.lerp(ramp(ROCK, z, r), smooth(0.4, 3, e));
      c.multiplyScalar(0.88 + vnoise(x * 0.7, z * 0.7) * 0.24);
      col[i] = c.r; col[i + 1] = c.g; col[i + 2] = c.b;
    }
  }
  const idx: number[] = [];
  for (let iz = 0; iz < nz; iz++) {
    for (let ix = 0; ix < nx; ix++) {
      const a = iz * (nx + 1) + ix, b = a + 1, d = a + nx + 1, f = d + 1;
      // Alternate the diagonal so the flat-shaded facets don't all lean one way.
      if ((ix + iz) & 1) idx.push(a, d, b, b, d, f); else idx.push(a, d, f, a, f, b);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, metalness: 0 }));
  mesh.receiveShadow = true;
  return mesh;
}

export { clamp };
