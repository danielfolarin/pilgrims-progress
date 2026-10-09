// A burst of paper for the moments that deserve one, drawn on a 2D canvas over the game.
//   joy      the burden falls; the three leaps; the end of the road
//   welcome  the gate opens
//   chalk    a stroke on the Tally: a grey puff of dust that is gone at once, on purpose

type Kind = 'joy' | 'welcome' | 'chalk';
interface Bit { x: number; y: number; vx: number; vy: number; rot: number; vr: number; w: number; h: number; color: string; life: number; max: number; drag: number; g: number }

const COLORS: Record<Kind, string[]> = {
  joy: ['#f7d57a', '#fff3cf', '#ffffff', '#f2a65a', '#9fd0ff', '#f6b5c8'],
  welcome: ['#f7d57a', '#fff3cf', '#ffe2a0', '#ffffff'],
  chalk: ['#d9d6cc', '#bdb9ae', '#eeeae0'],
};

export class Confetti {
  private canvas = document.createElement('canvas');
  private ctx = this.canvas.getContext('2d')!;
  private bits: Bit[] = [];
  private still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  constructor() {
    this.canvas.id = 'fx';
    document.getElementById('ui')!.appendChild(this.canvas);
  }

  get active() { return this.bits.length; }

  /** x, y: where it starts, as fractions of the screen (0..1). */
  burst(kind: Kind, x = 0.5, y = 0.4) {
    if (this.still && kind !== 'chalk') return;
    const W = window.innerWidth, H = window.innerHeight, colors = COLORS[kind];
    const n = kind === 'joy' ? 170 : kind === 'welcome' ? 80 : 22;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = kind === 'chalk' ? 40 + Math.random() * 90 : 220 + Math.random() * (kind === 'joy' ? 620 : 380);
      const up = kind === 'chalk' ? 0.3 : 1;
      this.bits.push({
        x: x * W + (Math.random() - 0.5) * (kind === 'joy' ? W * 0.5 : 60),
        y: y * H + (Math.random() - 0.5) * 30,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.7 - sp * 0.55 * up,
        rot: Math.random() * 6, vr: (Math.random() - 0.5) * 12,
        w: kind === 'chalk' ? 3 + Math.random() * 4 : 6 + Math.random() * 7,
        h: kind === 'chalk' ? 3 + Math.random() * 4 : 9 + Math.random() * 9,
        color: colors[(Math.random() * colors.length) | 0],
        life: 0, max: kind === 'chalk' ? 0.7 + Math.random() * 0.5 : 2.6 + Math.random() * 2.2,
        drag: kind === 'chalk' ? 4 : 1.6, g: kind === 'chalk' ? 260 : 520,
      });
    }
  }

  clear() { this.bits = []; this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); }

  update(dt: number) {
    const c = this.canvas, W = window.innerWidth, H = window.innerHeight;
    if (!this.bits.length) { if (c.style.display !== 'none') { c.style.display = 'none'; } return; }
    if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
    c.style.display = 'block';
    const x = this.ctx;
    x.clearRect(0, 0, W, H);
    this.bits = this.bits.filter((b) => {
      b.life += dt;
      if (b.life > b.max || b.y > H + 40) return false;
      b.vx -= b.vx * b.drag * dt;
      b.vy += (b.g - b.vy * b.drag * 0.5) * dt;
      b.x += b.vx * dt + Math.sin(b.life * 5 + b.rot) * 22 * dt;
      b.y += b.vy * dt;
      b.rot += b.vr * dt;
      x.save();
      x.globalAlpha = Math.min(1, (b.max - b.life) * 1.6);
      x.translate(b.x, b.y);
      x.rotate(b.rot);
      x.scale(1, Math.cos(b.life * 7 + b.rot));   // flutter
      x.fillStyle = b.color;
      x.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
      x.restore();
      return true;
    });
  }
}
