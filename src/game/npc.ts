import type { Game } from './game';
import { Character, Look } from './characters';
import { angDiff } from '../core/util';
import { groundY } from '../world/terrain';

export class Npc {
  ch: Character;
  x = 0; z = 0; yaw = 0;
  visible = true;
  /** Walks behind the pilgrim. */
  follow = false;
  /** Runs straight at the pilgrim at this speed (0 = not chasing). */
  chase = 0;
  /** No collision (figures in cutscenes, the Accuser). */
  ghost = false;
  /** How far below the ground the figure is drawn (stuck in the mire). */
  sunk = 0;
  label = '';
  talk: (() => void) | null = null;
  private walk: { x: number; z: number; speed: number; resolve: () => void; t: number } | null = null;
  private speed = 0;

  constructor(private g: Game, public id: string, look: Look) {
    this.ch = new Character(look);
    g.scene.add(this.ch.root);
  }

  place(x: number, z: number, yaw = 0) {
    this.x = x; this.z = z; this.yaw = yaw;
    this.walk = null;
    this.chase = 0;
    return this;
  }

  show(v: boolean) { this.visible = v; this.ch.root.visible = v; return this; }

  face(x: number, z: number) { this.yaw = Math.atan2(x - this.x, z - this.z); }

  walkTo(x: number, z: number, speed = 2.4): Promise<void> {
    return new Promise((resolve) => (this.walk = { x, z, speed, resolve, t: 0 }));
  }

  update(dt: number) {
    if (!this.visible) return;
    const p = this.g.player;
    let tx = this.x, tz = this.z, sp = 0;
    if (this.walk) {
      const w = this.walk;
      w.t += dt;
      const d = Math.hypot(w.x - this.x, w.z - this.z);
      if (d < 0.2 || w.t > 40) { this.walk = null; w.resolve(); }
      else { tx = w.x; tz = w.z; sp = w.speed; }
    } else if (this.chase > 0) {
      if (Math.hypot(p.x - this.x, p.z - this.z) > 0.9) { tx = p.x; tz = p.z; sp = this.chase; }
    } else if (this.follow) {
      // half a pace behind and to one side
      const fx = p.x - Math.sin(p.yaw) * 1.5 + Math.cos(p.yaw) * 1.1, fz = p.z - Math.cos(p.yaw) * 1.5 - Math.sin(p.yaw) * 1.1;
      const d = Math.hypot(fx - this.x, fz - this.z);
      if (d > 0.5) { tx = fx; tz = fz; sp = Math.min(4.2, 0.6 + d * 1.4); }
    }
    const dx = tx - this.x, dz = tz - this.z, d = Math.hypot(dx, dz);
    if (sp > 0 && d > 1e-3) {
      const st = Math.min(d, sp * dt);
      this.x += (dx / d) * st;
      this.z += (dz / d) * st;
      this.yaw += angDiff(this.yaw, Math.atan2(dx, dz)) * Math.min(1, dt * 8);
      this.speed = sp;
    } else this.speed = 0;
    this.ch.root.position.set(this.x, groundY(this.x, this.z) - this.sunk, this.z);
    this.ch.root.rotation.y = this.yaw;
    this.ch.update(dt, this.speed);
  }
}
