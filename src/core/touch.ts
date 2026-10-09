import type { Game } from '../game/game';

// Phone and tablet controls. Nothing here shows until the first finger touches the
// screen, so a laptop with a mouse never sees it.
//   left side of the screen   a joystick appears under the thumb: walk
//   right side                drag to look around
//   buttons                   hurry/run (stays on until tapped again), leap, read, pause
//   the prompt ("Talk to …")  tap it
//   conversations             tap anywhere to go on; tap a reply to choose it

const RADIUS = 58;

export class TouchControls {
  private layer = document.createElement('div');
  private stick = document.createElement('div');
  private knob = document.createElement('div');
  private run = this.button('t-run', 'Hurry');
  private jump = this.button('t-jump', 'Leap');
  private read = this.button('t-read', 'Read');
  private pause = this.button('t-pause', 'II');
  private rotate = document.createElement('div');
  private stickId = -1;
  private lookId = -1;
  private ox = 0; private oy = 0; private lx = 0; private ly = 0;
  private running = false;
  private dismissedRotate = false;

  constructor(private g: Game) {
    const inp = g.input, root = document.getElementById('ui')!;
    this.layer.id = 'touch';
    this.stick.id = 'stick';
    this.knob.id = 'knob';
    this.stick.appendChild(this.knob);
    this.layer.append(this.stick, this.run, this.jump, this.read, this.pause);
    root.prepend(this.layer);
    this.rotate.id = 'rotate';
    this.rotate.innerHTML = '<div><p>Turn your phone sideways to play.</p><button type="button">Play upright anyway</button></div>';
    this.rotate.querySelector('button')!.addEventListener('click', () => { this.dismissedRotate = true; });
    root.appendChild(this.rotate);

    // A phone or tablet starts in touch mode; anything else switches on the first touch.
    const enable = () => {
      if (inp.touchMode) return;
      inp.touchMode = true;
      root.classList.add('touch');
      g.onTouchMode();
    };
    if (window.matchMedia?.('(pointer: coarse)').matches) enable();
    window.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') enable(); }, true);

    const L = this.layer;
    L.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (g.ui.dialogueOpen || g.ui.paperOpen) { inp.clicked = true; return; }
      if (e.target !== L) return;
      L.setPointerCapture(e.pointerId);
      if (e.clientX < window.innerWidth * 0.45 && this.stickId < 0) {
        this.stickId = e.pointerId;
        this.ox = e.clientX; this.oy = e.clientY;
        this.stick.style.left = this.ox + 'px';
        this.stick.style.top = this.oy + 'px';
        this.stick.classList.add('on');
        this.knob.style.transform = '';
      } else if (this.lookId < 0) {
        this.lookId = e.pointerId;
        this.lx = e.clientX; this.ly = e.clientY;
      }
    });
    L.addEventListener('pointermove', (e) => {
      if (e.pointerId === this.stickId) {
        let dx = e.clientX - this.ox, dy = e.clientY - this.oy;
        const d = Math.hypot(dx, dy);
        if (d > RADIUS) { dx *= RADIUS / d; dy *= RADIUS / d; }
        this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
        const m = Math.min(1, d / RADIUS);
        inp.touch.x = m < 0.18 ? 0 : dx / RADIUS;
        inp.touch.y = m < 0.18 ? 0 : -dy / RADIUS;
      } else if (e.pointerId === this.lookId) {
        inp.mdx += (e.clientX - this.lx) * 2.4;
        inp.mdy += (e.clientY - this.ly) * 2.0;
        this.lx = e.clientX; this.ly = e.clientY;
      }
    });
    const end = (e: PointerEvent) => {
      if (e.pointerId === this.stickId) {
        this.stickId = -1;
        inp.touch.x = inp.touch.y = 0;
        this.stick.classList.remove('on');
      } else if (e.pointerId === this.lookId) this.lookId = -1;
    };
    L.addEventListener('pointerup', end);
    L.addEventListener('pointercancel', end);

    const tap = (el: HTMLElement, fn: () => void) => el.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); fn(); });
    tap(this.run, () => {
      this.running = !this.running;
      if (this.running) inp.down.add('TouchRun'); else inp.down.delete('TouchRun');
    });
    tap(this.jump, () => inp.hit.add('Space'));
    tap(this.read, () => inp.hit.add('KeyR'));
    tap(this.pause, () => inp.hit.add('Escape'));

    // taps that work with a mouse too: the prompt, the dialogue box, a paper being read
    document.getElementById('prompt')!.addEventListener('click', () => inp.hit.add('KeyE'));
    document.getElementById('dlg')!.addEventListener('click', (e) => {
      if (!(e.target as HTMLElement).closest('.choice')) inp.clicked = true;
    });
    document.getElementById('paper')!.addEventListener('click', () => { inp.clicked = true; });
  }

  private button(id: string, label: string) {
    const b = document.createElement('button');
    b.id = id;
    b.type = 'button';
    b.className = 'tbtn';
    b.textContent = label;
    return b;
  }

  /** Let go of everything (when a menu opens or a scene takes over). */
  release() {
    this.stickId = this.lookId = -1;
    this.g.input.touch.x = this.g.input.touch.y = 0;
    this.stick.classList.remove('on');
  }

  update() {
    const g = this.g, inp = g.input;
    if (!inp.touchMode) return;
    const playing = g.mode === 'play' && !g.ui.menuOpen;
    this.layer.style.display = playing ? 'block' : 'none';
    if (!playing || g.busy) { if (this.stickId >= 0 || inp.touch.x || inp.touch.y) this.release(); }
    const free = g.player.free, talking = g.busy;
    this.run.textContent = free ? 'Run' : 'Hurry';
    this.run.classList.toggle('active', this.running);
    this.run.style.display = this.read.style.display = this.pause.style.display = talking ? 'none' : '';
    this.jump.style.display = free && !talking ? '' : 'none';
    this.rotate.style.display = !this.dismissedRotate && window.innerHeight > window.innerWidth * 1.05 ? 'flex' : 'none';
  }
}
