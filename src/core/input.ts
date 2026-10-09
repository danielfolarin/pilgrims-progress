const MAP: Record<string, string[]> = {
  fwd: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  run: ['ShiftLeft', 'ShiftRight', 'Pad7', 'Pad10', 'Pad5', 'TouchRun'],
  jump: ['Space', 'Pad1'],
  interact: ['KeyE', 'Enter', 'NumpadEnter', 'Pad0'],
  remember: ['KeyR', 'Pad2'],
  pause: ['Escape', 'KeyP', 'Pad9'],
  camL: ['KeyJ'],
  camR: ['KeyL'],
  camU: ['KeyI'],
  camD: ['KeyK'],
  up: ['KeyW', 'ArrowUp', 'Pad12'],
  down: ['KeyS', 'ArrowDown', 'Pad13'],
  navL: ['KeyA', 'ArrowLeft', 'Pad14'],
  navR: ['KeyD', 'ArrowRight', 'Pad15'],
  confirm: ['KeyE', 'Enter', 'NumpadEnter', 'Space', 'Pad0'],
};

/** Keyboard, mouse and (standard-mapping) gamepad input, flattened into named actions. */
export class Input {
  down = new Set<string>();
  hit = new Set<string>();
  mdx = 0;
  mdy = 0;
  wheel = 0;
  locked = false;
  drag = false;
  clicked = false;
  pad = { mx: 0, mz: 0, lx: 0, ly: 0 };
  /** The on-screen joystick: x = right, y = forward. */
  touch = { x: 0, y: 0 };
  /** True once a finger has touched the screen (see touch.ts). */
  touchMode = false;
  /** Set by the game: whether a canvas click should capture the mouse. */
  wantLock = false;
  /** Fired when the browser drops pointer lock without us asking (usually Esc). */
  onLockLost: (() => void) | null = null;
  private padPrev: boolean[] = [];
  private selfUnlock = false;

  constructor(private canvas: HTMLCanvasElement) {
    window.addEventListener('keydown', (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
      if (!e.repeat) this.hit.add(e.code);
      this.down.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.down.delete(e.code));
    window.addEventListener('blur', () => { this.down.clear(); this.drag = false; });
    canvas.addEventListener('mousedown', () => {
      this.clicked = true;
      this.drag = true;
      if (this.wantLock && !this.locked && !this.touchMode) this.requestLock();
    });
    window.addEventListener('mouseup', () => (this.drag = false));
    window.addEventListener('mousemove', (e) => {
      if (this.locked || this.drag) {
        this.mdx += e.movementX || 0;
        this.mdy += e.movementY || 0;
      }
    });
    canvas.addEventListener('wheel', (e) => { this.wheel += e.deltaY; e.preventDefault(); }, { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('pointerlockchange', () => {
      const was = this.locked;
      this.locked = document.pointerLockElement === canvas;
      if (was && !this.locked && !this.selfUnlock && this.onLockLost) this.onLockLost();
      this.selfUnlock = false;
    });
  }

  requestLock() {
    try {
      const p: any = (this.canvas as any).requestPointerLock?.();
      if (p && p.catch) p.catch(() => {});
    } catch { /* pointer lock unavailable; drag-to-look still works */ }
  }

  releaseLock() {
    if (this.locked) {
      this.selfUnlock = true;
      document.exitPointerLock?.();
    }
  }

  held(a: string) { return MAP[a].some((c) => this.down.has(c)); }
  pressed(a: string) { return MAP[a].some((c) => this.hit.has(c)); }
  digit(): number {
    for (let i = 1; i <= 9; i++) if (this.hit.has('Digit' + i) || this.hit.has('Numpad' + i)) return i;
    return 0;
  }

  /** Movement intent in screen space: x = right, y = forward. */
  move() {
    let x = (this.held('right') ? 1 : 0) - (this.held('left') ? 1 : 0) + this.pad.mx + this.touch.x;
    let y = (this.held('fwd') ? 1 : 0) - (this.held('back') ? 1 : 0) - this.pad.mz + this.touch.y;
    const l = Math.hypot(x, y);
    if (l > 1) { x /= l; y /= l; }
    return { x, y };
  }

  pollPad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = Array.from(pads).find((p) => p && p.connected && p.mapping === 'standard');
    const dead = (v: number) => (Math.abs(v) < 0.18 ? 0 : v);
    if (!gp) {
      this.pad.mx = this.pad.mz = this.pad.lx = this.pad.ly = 0;
      return;
    }
    this.pad.mx = dead(gp.axes[0] || 0);
    this.pad.mz = dead(gp.axes[1] || 0);
    this.pad.lx = dead(gp.axes[2] || 0);
    this.pad.ly = dead(gp.axes[3] || 0);
    gp.buttons.forEach((b, i) => {
      const code = 'Pad' + i;
      if (b.pressed) {
        if (!this.padPrev[i]) this.hit.add(code);
        this.down.add(code);
      } else this.down.delete(code);
      this.padPrev[i] = b.pressed;
    });
  }

  endFrame() {
    this.hit.clear();
    this.mdx = this.mdy = this.wheel = 0;
    this.clicked = false;
  }
}
