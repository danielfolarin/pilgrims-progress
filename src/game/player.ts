import * as THREE from 'three';
import type { Game } from './game';
import { Character, OLD_ROBE } from './characters';
import { angDiff, clamp, damp } from '../core/util';
import { groundY, height, mireAt, onPlank, WORLD_END_Z, PLANK_LEN } from '../world/terrain';

export type Collider =
  | { k: 'c'; x: number; z: number; r: number; on?: () => boolean; tall?: boolean }
  | { k: 'b'; x: number; z: number; hw: number; hd: number; rot: number; on?: () => boolean; tall?: boolean };

const RADIUS = 0.45;

/** The pilgrim: movement, the weight on their back, and the camera that follows. */
export class Player {
  ch = new Character({ robe: OLD_ROBE, trim: 0x3d342c, hat: 'hood', skin: 0xb98a64 });
  x = 0; z = 0; y = 0; vx = 0; vz = 0; vy = 0; yaw = 0;
  grounded = true;
  burden: 'real' | 'none' | 'shadow' = 'real';
  /** <1 when something (the hill of Legality) is adding to the load. */
  weightMul = 1;
  breath = 1;
  winded = 0;
  sink = 0;
  stagger = 0;
  carrying = -1;
  lastFirm = { x: 0, z: 0 };
  auto: { x: number; z: number; speed: number; stop: number; resolve: () => void; t: number } | null = null;
  /** For the story: how long the pilgrim has been running or how often they've leapt. */
  ranFor = 0;
  leaps = 0;
  camYaw = 0; camPitch = 0.3; camDist = 6.4;
  private camDistCur = 6.4;
  private lookIdle = 0;
  private tgt = new THREE.Vector3();
  private look = new THREE.Vector3();
  private runToggle = false;
  private stepPhase = 0;
  private told: Record<string, boolean> = {};

  constructor(private g: Game) {
    g.scene.add(this.ch.root);
  }

  get speed() { return Math.hypot(this.vx, this.vz); }
  get free() { return this.burden !== 'real'; }

  place(x: number, z: number, yaw: number) {
    this.x = x; this.z = z; this.yaw = yaw; this.camYaw = yaw;
    this.y = groundY(x, z);
    this.vx = this.vz = this.vy = 0;
    this.sink = 0; this.stagger = 0; this.grounded = true; this.auto = null;
    this.lastFirm = { x, z };
    this.tgt.set(x, this.y + 1.4, z);
    this.look.copy(this.tgt);
    this.ch.root.position.set(x, this.y, z);
    this.ch.root.rotation.y = yaw;
  }

  /** Walk under the game's control (cutscenes, and the automated play-test). */
  walkTo(x: number, z: number, speed = 2.2, stop = 0.25): Promise<void> {
    return new Promise((resolve) => (this.auto = { x, z, speed, stop, resolve, t: 0 }));
  }

  face(x: number, z: number) { this.yaw = Math.atan2(x - this.x, z - this.z); }

  update(dt: number) {
    const g = this.g, inp = g.input, free = this.free;
    let dx = 0, dz = 0, wantRun = false, maxSpeed = Infinity;

    if (this.stagger > 0) this.stagger -= dt;
    if (this.auto) {
      const a = this.auto, ex = a.x - this.x, ez = a.z - this.z, d = Math.hypot(ex, ez);
      a.t += dt;
      if (d < a.stop || a.t > 30) { this.auto = null; a.resolve(); }
      else { dx = ex / d; dz = ez / d; maxSpeed = a.speed; wantRun = a.speed > 5; }
    } else if (!g.busy && this.stagger <= 0) {
      const m = inp.move();
      const sn = Math.sin(this.camYaw), cs = Math.cos(this.camYaw);
      dx = sn * m.y - cs * m.x;
      dz = cs * m.y + sn * m.x;
      if (g.settings.toggleRun) { if (inp.pressed('run')) this.runToggle = !this.runToggle; wantRun = this.runToggle; }
      else wantRun = inp.held('run');
      if (inp.pressed('jump')) {
        if (free && this.grounded) { this.vy = 5.8; this.grounded = false; this.leaps++; g.audio.footstep('grass', false); }
        else if (!free) this.tell('jump', 'thought', 'With this on your back, your feet will not leave the ground.');
      }
    }
    const moving = Math.hypot(dx, dz) > 0.05;

    // speed: what the burden allows
    let walk = free ? 4.6 : 2.5 * this.weightMul;
    let run = free ? 7.4 : 3.5 * this.weightMul;
    if (!free && !this.auto) {
      if (wantRun && moving && this.winded <= 0) {
        this.breath -= dt / 5.5;
        if (this.breath <= 0) {
          this.winded = 3;
          g.audio.breath();
          g.ui.caption('sound', '[You are winded. The weight will not be hurried.]');
        }
      } else this.breath = Math.min(1, this.breath + dt / 7);
      if (this.winded > 0) { this.winded -= dt; walk *= 0.72; run = walk; }
    }
    let target = moving ? (wantRun ? run : walk) : 0;
    target = Math.min(target, maxSpeed);
    const mire = mireAt(this.x, this.z);
    if (mire) target *= mire === 2 ? 0.4 : 0.55;
    if (this.carrying >= 0) target *= 0.85;
    if (wantRun && moving && free && !this.auto) this.ranFor += dt;

    // the burden makes every start and stop sluggish
    const k = free ? 11 : 3.4;
    this.vx = damp(this.vx, dx * target, k, dt);
    this.vz = damp(this.vz, dz * target, k, dt);
    if (moving) this.yaw += angDiff(this.yaw, Math.atan2(dx, dz)) * Math.min(1, dt * (free ? 12 : 5));

    this.step(this.x + this.vx * dt, this.z + this.vz * dt);

    // vertical
    const gy = groundY(this.x, this.z);
    if (this.grounded) this.y = damp(this.y, gy, 20, dt);
    else {
      this.vy -= 15 * dt;
      this.y += this.vy * dt;
      if (this.y <= gy) { this.y = gy; this.vy = 0; this.grounded = true; g.audio.land(); }
    }

    // sinking
    const assist = g.settings.assist ? 0.5 : 1;
    if (mire && this.grounded) this.sink = Math.min(1, this.sink + (dt / (mire === 2 ? 1.3 : 7.5)) * assist);
    else this.sink = Math.max(0, this.sink - dt / 1.3);
    if (!mire && this.grounded) this.lastFirm = { x: this.x, z: this.z };

    // footsteps
    const sp = this.speed;
    if (sp > 0.4 && this.grounded) {
      this.stepPhase += dt * (1.5 + sp * 0.62);
      if (this.stepPhase > 1) {
        this.stepPhase = 0;
        const surf = mire ? 'mud' : onPlank(this.x, this.z) ? 'wood' : Math.hypot(this.x, this.z) < 44 ? 'stone' : this.z > 203 ? 'grass' : 'dirt';
        g.audio.footstep(surf, !free);
        if (!free && Math.random() < 0.18) g.audio.creak();
      }
    }

    // figure
    const wob = this.stagger > 0 ? Math.sin(this.stagger * 22) * 0.25 : 0;
    this.ch.root.position.set(this.x, this.y - this.sink * 0.78, this.z);
    this.ch.root.rotation.set(0, this.yaw, wob);
    const lean = free ? (sp > 5 ? 0.14 : 0) : 0.42 + (1 - this.weightMul) * 0.7 + (this.winded > 0 ? 0.12 : 0);
    this.ch.update(dt, sp, lean, free ? 0 : 0.34);
    this.ch.setCarry(this.carrying >= 0 ? PLANK_LEN[this.carrying] : 0);
  }

  private tell(key: string, kind: 'thought' | 'sound', text: string) {
    if (this.told[key]) return;
    this.told[key] = true;
    this.g.ui.caption(kind, text);
  }

  /** Move, refusing slopes too steep to climb and sliding around solid things. */
  private step(nx: number, nz: number) {
    const h0 = groundY(this.x, this.z);
    const maxRise = this.free ? 0.62 : 0.5;
    const ok = (tx: number, tz: number) => {
      const ex = tx - this.x, ez = tz - this.z, d = Math.hypot(ex, ez);
      if (d < 1e-6) return true;
      return groundY(this.x + (ex / d) * 0.6, this.z + (ez / d) * 0.6) - h0 < maxRise;
    };
    if (ok(nx, nz)) { this.x = nx; this.z = nz; }
    else if (ok(nx, this.z)) { this.x = nx; this.vz *= 0.5; }
    else if (ok(this.x, nz)) { this.z = nz; this.vx *= 0.5; }
    else { this.vx *= 0.5; this.vz *= 0.5; }

    for (const c of this.g.colliders) {
      if (Math.abs(c.z - this.z) > 26 || (c.on && !c.on())) continue;
      if (c.k === 'c') {
        const ex = this.x - c.x, ez = this.z - c.z, d = Math.hypot(ex, ez), min = c.r + RADIUS;
        if (d < min && d > 1e-5) { this.x = c.x + (ex / d) * min; this.z = c.z + (ez / d) * min; }
      } else {
        const cs = Math.cos(c.rot), sn = Math.sin(c.rot);
        const ex = this.x - c.x, ez = this.z - c.z;
        let lx = ex * cs - ez * sn, lz = ex * sn + ez * cs;
        const px = c.hw + RADIUS - Math.abs(lx), pz = c.hd + RADIUS - Math.abs(lz);
        if (px > 0 && pz > 0) {
          if (px < pz) lx += Math.sign(lx || 1) * px; else lz += Math.sign(lz || 1) * pz;
          this.x = c.x + lx * cs + lz * sn;
          this.z = c.z - lx * sn + lz * cs;
        }
      }
    }
    for (const n of this.g.npcs.values()) {
      if (!n.visible || n.follow || n.ghost) continue;
      const ex = this.x - n.x, ez = this.z - n.z, d = Math.hypot(ex, ez), min = 0.5 + RADIUS;
      if (d < min && d > 1e-5) { this.x = n.x + (ex / d) * min; this.z = n.z + (ez / d) * min; }
    }
    if (this.z > WORLD_END_Z) this.z = WORLD_END_Z;
  }

  updateCamera(dt: number) {
    const g = this.g, inp = g.input, cam = g.camera, s = g.settings;
    const sens = 0.4 + s.sens * 0.12;
    if (!g.ui.menuOpen && g.mode === 'play') {
      const kx = (inp.held('camR') ? 1 : 0) - (inp.held('camL') ? 1 : 0) + inp.pad.lx;
      const ky = (inp.held('camD') ? 1 : 0) - (inp.held('camU') ? 1 : 0) + inp.pad.ly;
      const lx = inp.mdx * 0.0024 * sens + kx * 2.0 * dt * sens;
      const ly = (inp.mdy * 0.002 * sens + ky * 1.3 * dt * sens) * (s.invertY ? -1 : 1);
      if (lx || ly) this.lookIdle = 0; else this.lookIdle += dt;
      this.camYaw -= lx;
      this.camPitch = clamp(this.camPitch + ly, -0.2, 1.25);
      this.camDist = clamp(this.camDist + inp.wheel * 0.004, 3, 11);
      // gently swing round behind a walking pilgrim, so the game is playable on the keyboard alone
      if (s.autoCam && this.lookIdle > 1.1 && this.speed > 0.6 && !g.cine) {
        const d = angDiff(this.camYaw, this.yaw);
        if (Math.abs(d) < 2.5) this.camYaw += d * Math.min(1, dt * 1.1);
      }
    }
    const free = this.free;
    const sway = !free && s.shake ? Math.sin(this.ch.phase) * 0.035 * Math.min(1, this.speed) : 0;
    const ty = this.y - this.sink * 0.5 + (free ? 1.55 : 1.32) + sway;
    this.tgt.set(damp(this.tgt.x, this.x, 12, dt), damp(this.tgt.y, ty, 8, dt), damp(this.tgt.z, this.z, 12, dt));

    if (g.cine) {
      const k = g.cine.k;
      cam.position.set(damp(cam.position.x, g.cine.pos.x, k, dt), damp(cam.position.y, g.cine.pos.y, k, dt), damp(cam.position.z, g.cine.pos.z, k, dt));
      this.look.set(damp(this.look.x, g.cine.look.x, k, dt), damp(this.look.y, g.cine.look.y, k, dt), damp(this.look.z, g.cine.look.z, k, dt));
    } else {
      const cp = Math.cos(this.camPitch), sp = Math.sin(this.camPitch);
      const ox = -Math.sin(this.camYaw) * cp, oz = -Math.cos(this.camYaw) * cp;
      // pull in if the ground would come between the camera and the pilgrim
      let allowed = this.camDist;
      for (let i = 1; i <= 12; i++) {
        const d = (this.camDist * i) / 12;
        const sx = this.tgt.x + ox * d, sz = this.tgt.z + oz * d;
        if (this.tgt.y + sp * d < height(sx, sz) + 0.4 || this.inWall(sx, sz)) { allowed = Math.max(1.3, d * 0.86 - 0.25); break; }
      }
      this.camDistCur = damp(this.camDistCur, allowed, allowed < this.camDistCur ? 18 : 3.5, dt);
      const d = this.camDistCur;
      let px = this.tgt.x + ox * d, py = this.tgt.y + sp * d, pz = this.tgt.z + oz * d;
      py = Math.max(py, height(px, pz) + 0.45);
      const k = 16;
      cam.position.set(damp(cam.position.x, px, k, dt), damp(cam.position.y, py, k, dt), damp(cam.position.z, pz, k, dt));
      this.look.set(damp(this.look.x, this.tgt.x, 20, dt), damp(this.look.y, this.tgt.y + 0.15, 20, dt), damp(this.look.z, this.tgt.z, 20, dt));
    }
    if (g.shake > 0 && s.shake) {
      cam.position.x += (Math.random() - 0.5) * g.shake * 0.12;
      cam.position.y += (Math.random() - 0.5) * g.shake * 0.12;
    }
    cam.lookAt(this.look);
    const fov = free ? 62 : 56;
    if (Math.abs(cam.fov - fov) > 0.05) { cam.fov = damp(cam.fov, fov, 2, dt); cam.updateProjectionMatrix(); }
  }

  /** Is this point inside a building or wall? (Keeps the camera out of them.) */
  private inWall(x: number, z: number) {
    for (const c of this.g.colliders) {
      if (!c.tall || Math.abs(c.z - z) > 24) continue;
      if (c.k === 'c') { if (Math.hypot(x - c.x, z - c.z) < c.r + 0.3) return true; }
      else {
        const cs = Math.cos(c.rot), sn = Math.sin(c.rot), ex = x - c.x, ez = z - c.z;
        if (Math.abs(ex * cs - ez * sn) < c.hw + 0.3 && Math.abs(ex * sn + ez * cs) < c.hd + 0.3) return true;
      }
    }
    return false;
  }

  /** Snap the camera to its resting place behind the pilgrim (after loads and teleports). */
  snapCamera() {
    const cp = Math.cos(this.camPitch), d = this.camDist;
    this.tgt.set(this.x, this.y + 1.4, this.z);
    this.look.copy(this.tgt);
    this.g.camera.position.set(this.x - Math.sin(this.camYaw) * cp * d, this.y + 1.4 + Math.sin(this.camPitch) * d, this.z - Math.cos(this.camYaw) * cp * d);
  }
}
