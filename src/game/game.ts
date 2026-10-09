import * as THREE from 'three';
import { Input } from '../core/input';
import { AudioSys } from '../core/audio';
import { UI, MenuItem } from '../core/ui';
import { World } from '../world/world';
import { Player, Collider } from './player';
import { Npc } from './npc';
import { Story } from './story';
import { GameState, Settings, Stage, freshState, hasSavedSettings, latestSave, loadSettings, readSave, saveSettings, writeSave, Slot } from './state';
import { ROLL_ACCUSED, ROLL_PEACE } from '../content/hill';
import { CAST } from '../content/cast';
import { N, type Note } from '../content/lines';
import { Voice } from './voice';
import { TouchControls } from '../core/touch';

// The games page one folder up, when this game is served from a folder of a bigger site
// (games.thecuriousseekers.com/pilgrims-progress/). Opened from a file or on its own
// domain there is nothing to link to.
const HUB_LINK =
  location.protocol.startsWith('http') && !/^(127\.0\.0\.1|localhost)$/.test(location.hostname) &&
  location.pathname.split('/').some((part) => part && !part.endsWith('.html'))
    ? '../'
    : null;

export interface Interactable {
  at: () => [number, number] | null;
  r: number;
  label: () => string | null;
  act: () => void;
}

export class Game {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(56, 1, 0.1, 1600);
  input: Input;
  ui: UI;
  audio = new AudioSys();
  voice = new Voice(this.audio);
  settings: Settings = loadSettings();
  state: GameState = freshState();
  colliders: Collider[] = [];
  interactables: Interactable[] = [];
  npcs = new Map<string, Npc>();
  player: Player;
  world: World;
  story: Story;

  mode: 'title' | 'play' = 'title';
  /** A scene or conversation has the reins; the player cannot move. */
  busy = false;
  /** Bumped on every load so that abandoned scenes can never resume. */
  epoch = 0;
  time = 0;
  dawn = 0;
  shade = 0;
  fire = 0;
  shake = 0;
  cine: { pos: THREE.Vector3; look: THREE.Vector3; k: number } | null = null;
  /** True while the automated play-test is stepping the simulation by hand. */
  manual = false;
  touch!: TouchControls;
  private timers: { t: number; res: () => void }[] = [];
  private last = 0;
  private titleT = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.input = new Input(canvas);
    this.ui = new UI(this);
    this.player = new Player(this);
    this.world = new World(this);
    this.story = new Story(this);
    this.touch = new TouchControls(this);
    this.input.onLockLost = () => { if (this.mode === 'play' && !this.ui.menuOpen) this.pauseMenu(); };
    window.addEventListener('resize', () => this.resize());
    this.resize();
    this.applySettings();
    this.player.place(this.state.px, this.state.pz, this.state.yaw);
    this.story.sync();
    this.titleMenu();
    requestAnimationFrame((t) => this.frame(t));
  }

  npc(id: string) { return this.npcs.get(id)!; }

  /** Called once, the first time a finger touches the screen. */
  onTouchMode() {
    // phones: lighter picture unless the player has already chosen their own settings
    if (!hasSavedSettings()) { this.settings.shadows = false; this.applySettings(); }
  }

  /** Fill the screen and, where the phone allows it, turn to landscape. */
  async fullscreen() {
    try {
      if (document.fullscreenElement) { await document.exitFullscreen(); return; }
      await document.documentElement.requestFullscreen();
      await (screen.orientation as any)?.lock?.('landscape');
    } catch { /* not supported here (iPhone): the game still plays in the browser window */ }
  }

  // ---- time and scenes --------------------------------------------------------

  /** Resolves after `sec` of game time (pausing pauses it). */
  wait(sec: number): Promise<void> {
    return new Promise((res) => this.timers.push({ t: this.time + sec, res }));
  }

  /** Run a scene with the player's hands off the controls. */
  async run(fn: () => Promise<void>) {
    if (this.busy) return;
    const ep = this.epoch;
    this.busy = true;
    this.ui.prompt(null);
    try { await fn(); } finally { if (ep === this.epoch) this.busy = false; }
  }

  /** A passing line outside a conversation: shown as a subtitle and, if recorded, spoken. */
  note(n: Note, dur = 0) {
    const c = CAST[n[0]];
    const kind = c.kind || 'say';
    this.ui.caption(kind, n[1], kind === 'say' ? n[2] || c.name : '', c.color, dur);
    if (!this.ui.dialogueOpen) this.voice.aside(n[0], n[1]);
  }

  cineTo(px: number, py: number, pz: number, lx: number, ly: number, lz: number, k = 2.2) {
    this.cine = { pos: new THREE.Vector3(px, py, pz), look: new THREE.Vector3(lx, ly, lz), k };
  }

  // ---- saving -----------------------------------------------------------------

  private capture() {
    const p = this.player;
    this.state.px = p.x; this.state.pz = p.z; this.state.yaw = p.yaw;
  }

  checkpoint(label: string, x?: number, z?: number) {
    this.capture();
    if (x !== undefined && z !== undefined) { this.state.px = x; this.state.pz = z; }
    this.state.label = label;
    if (writeSave('auto', this.state)) this.ui.toast('Checkpoint — ' + label);
  }

  save(slot: Slot) {
    this.capture();
    const ok = writeSave(slot, this.state);
    this.ui.toast(ok ? 'Saved.' : 'Could not save (browser storage is unavailable).');
  }

  loadState(s: GameState) {
    this.epoch++;
    this.timers = [];
    this.busy = false;
    this.cine = null;
    this.shake = 0;
    this.ui.reset();
    this.voice.stop();
    this.ui.closeMenu();
    this.state = JSON.parse(JSON.stringify(s));
    this.mode = 'play';
    this.story.sync();
    this.player.place(this.state.px, this.state.pz, this.state.yaw);
    this.player.snapCamera();
    this.ui.fade(true, 0);
    this.ui.fade(false, 0.8);
  }

  newGame() {
    this.loadState(freshState());
    this.story.intro();
  }

  // ---- menus ------------------------------------------------------------------

  titleMenu() {
    this.mode = 'title';
    this.epoch++;
    this.timers = [];
    this.busy = false;
    this.cine = null;
    this.ui.reset();
    this.voice.stop();
    this.ui.setObjective('');
    this.ui.fade(false, 0.5);
    this.input.releaseLock();
    const sv = latestSave();
    const begin = () => {
      if (!sv) return this.newGame();
      this.ui.openMenu({
        title: 'Begin again?', sub: 'Your checkpoint will be replaced as you play.',
        items: [{ label: 'Begin a new journey', act: () => this.newGame() }, { label: 'Back', act: () => this.titleMenu() }],
        back: () => this.titleMenu(),
      });
    };
    this.ui.openMenu({
      big: true,
      title: 'The Unburdened Road',
      sub: "A pilgrim's journey from the City of Destruction — the first part of a dream",
      items: [
        { label: sv ? `Continue — ${sv.label}` : 'Continue', disabled: !sv, act: () => sv && this.loadState(sv) },
        { label: 'New journey', act: begin },
        { label: 'Settings & accessibility', act: () => this.settingsMenu(() => this.titleMenu()) },
        { label: 'Controls', act: () => this.controlsMenu(() => this.titleMenu()) },
        { label: 'About this build', act: () => this.aboutMenu(() => this.titleMenu()) },
        ...(this.input.touchMode && document.fullscreenEnabled ? [{ label: 'Full screen', act: () => { this.fullscreen(); } }] : []),
        ...(HUB_LINK ? [{ label: 'All games', act: () => { location.href = HUB_LINK; } }] : []),
      ],
      foot: this.input.touchMode ? 'Tap to choose · About 20–30 minutes · Best with the phone turned sideways' : '↑ ↓ choose · Enter select · Vertical slice, about 20–30 minutes',
    });
  }

  pauseMenu() {
    if (this.mode !== 'play') return;
    this.input.releaseLock();
    const resume = () => this.ui.closeMenu();
    const auto = readSave('auto'), manual = readSave('manual');
    this.ui.openMenu({
      title: 'Paused',
      sub: this.state.label,
      items: [
        { label: 'Resume', act: resume },
        { label: 'Save here', disabled: this.busy, act: () => { this.save('manual'); resume(); } },
        { label: manual ? `Load my save — ${manual.label}` : 'Load my save', disabled: !manual, act: () => manual && this.loadState(manual) },
        { label: auto ? `Load last checkpoint — ${auto.label}` : 'Load last checkpoint', disabled: !auto, act: () => auto && this.loadState(auto) },
        { label: 'Settings & accessibility', act: () => this.settingsMenu(() => this.pauseMenu()) },
        { label: 'Controls', act: () => this.controlsMenu(() => this.pauseMenu()) },
        ...(this.input.touchMode && document.fullscreenEnabled ? [{ label: 'Full screen', act: () => { this.fullscreen(); resume(); } }] : []),
        { label: 'Quit to title', act: () => this.titleMenu() },
      ],
      back: resume,
    });
  }

  settingsMenu(back: () => void) {
    const s = this.settings;
    const done = () => { saveSettings(s); this.applySettings(); };
    const onoff = (label: string, key: keyof Settings): MenuItem => {
      const flip = () => { (s as any)[key] = !s[key]; done(); };
      return { label, value: () => (s[key] ? 'On' : 'Off'), left: flip, right: flip };
    };
    const range = (label: string, key: keyof Settings, min: number, max: number, names?: string[]): MenuItem => {
      const step = (d: number) => () => { (s as any)[key] = Math.min(max, Math.max(min, (s[key] as number) + d)); done(); };
      return { label, value: () => (names ? names[s[key] as number] : String(s[key])), left: step(-1), right: step(1) };
    };
    this.ui.openMenu({
      title: 'Settings & accessibility',
      items: [
        range('Text size', 'textSize', 0, 3, ['Small', 'Medium', 'Large', 'Very large']),
        onoff('High-contrast panels', 'contrast'),
        onoff('Typewriter text', 'typewriter'),
        onoff('Sound captions', 'captions'),
        onoff('Assist: gentler mire and arrows', 'assist'),
        { label: 'Hurry / run', value: () => (s.toggleRun ? 'Toggle' : 'Hold'), left: () => { s.toggleRun = !s.toggleRun; done(); }, right: () => { s.toggleRun = !s.toggleRun; done(); } },
        onoff('Camera swings behind you', 'autoCam'),
        onoff('Camera sway and shake', 'shake'),
        onoff('Invert vertical look', 'invertY'),
        range('Look sensitivity', 'sens', 1, 10),
        range('Voice volume', 'voice', 0, 10),
        range('Music volume', 'music', 0, 10),
        range('Sound volume', 'sfx', 0, 10),
        onoff('Shadows', 'shadows'),
        range('Picture quality', 'quality', 0, 2, ['Fast', 'Balanced', 'Sharp']),
        { label: 'Back', act: back },
      ],
      back,
    });
  }

  controlsMenu(back: () => void) {
    this.ui.openMenu({
      title: 'Controls',
      body: `<table>
        <tr><td><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> / arrows</td><td>Walk</td></tr>
        <tr><td>Mouse (click the view to capture) or <kbd>J</kbd><kbd>L</kbd><kbd>I</kbd><kbd>K</kbd></td><td>Look around · wheel zooms</td></tr>
        <tr><td><kbd>Shift</kbd></td><td>Hurry — as far as the burden allows. Later: run.</td></tr>
        <tr><td><kbd>Space</kbd></td><td>Leap (once you are able)</td></tr>
        <tr><td><kbd>E</kbd> / <kbd>Enter</kbd></td><td>Talk, use, continue a conversation</td></tr>
        <tr><td><kbd>1</kbd>–<kbd>4</kbd>, or ↑ ↓ then <kbd>Enter</kbd></td><td>Choose a reply</td></tr>
        <tr><td><kbd>R</kbd></td><td>Read what you carry (the parchment; later, the roll)</td></tr>
        <tr><td><kbd>Esc</kbd> / <kbd>P</kbd></td><td>Pause · save · load · settings</td></tr>
        </table>
        <p><b>On a phone or tablet:</b> left thumb walks (a joystick appears under it), drag the right side to look, tap the prompt to talk or use, tap anywhere to continue a conversation, and tap a reply to choose it. Buttons: Hurry/Run, Leap, Read, and II for pause.</p>
        <p>Gamepad (standard layout, untested on hardware): left stick walk, right stick look, A talk/confirm, B leap, X read, RT hurry, Start pause.</p>
        <p>The whole slice can be played on the keyboard alone, or by touch alone.</p>`,
      items: [{ label: 'Back', act: back }],
      back,
    });
  }

  aboutMenu(back: () => void) {
    this.ui.openMenu({
      title: 'About this build',
      body: `<p>An original adaptation of John Bunyan's <i>The Pilgrim's Progress</i> (1678, public domain). This first build is a vertical slice: the City of Destruction, the Slough of Despond, the Wicket Gate, the Cross and the sepulchre, and one accusation afterward.</p>
        <h3>How it handles grace</h3>
        <p>There is no faith meter, no holiness score and no fail state tied to belief. Choices change relationships and what is said later; they never change whether the pilgrim is welcome. The burden falls by no skill of the player's.</p>
        <h3>What is placeholder</h3>
        <p>All figures and scenery are procedural low-poly shapes; all music and sound effects are synthesised in the browser; the voices are computer-generated readings, one designed voice per character (every line is also subtitled). See <b>DEV_NOTES.md</b> in the project folder for scope, limits and the full placeholder list.</p>
        <h3>Sources</h3>
        <p>Narration marked “The Dreamer” adapts Bunyan's own wording. Scripture is quoted from the King James Version. The theological emphases are the adaptor's reading of widely taught themes of grace; no living teacher is quoted, imitated, or implied to endorse this game.</p>`,
      items: [{ label: 'Back', act: back }],
      back,
    });
  }

  endMenu(lines: string[]) {
    this.input.releaseLock();
    this.ui.openMenu({
      title: 'Here the first part of the dream ends',
      body: `<p>The road goes down from this place to the foot of Hill Difficulty, and on toward Palace Beautiful. That part is not yet built.</p>
        <h3>What the road remembers</h3><p>${lines.join('<br/>')}</p>
        <p><i>None of this is a score. It is only what happened, and what is still open.</i></p>`,
      items: [
        { label: 'Keep walking here a while', act: () => this.ui.closeMenu() },
        { label: 'Return to the title', act: () => this.titleMenu() },
      ],
    });
  }

  applySettings() {
    const s = this.settings;
    this.ui.applySettings();
    this.audio.musicVol = s.music / 10;
    this.audio.sfxVol = s.sfx / 10;
    this.audio.applyVolumes();
    this.voice.volume = s.voice / 10;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, [1, 1.5, 2][s.quality] ?? 1.5));
    this.resize();
  }

  // ---- loop -------------------------------------------------------------------

  private resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
  }

  private frame(now: number) {
    requestAnimationFrame((t) => this.frame(t));
    const dt = Math.min(0.05, (now - this.last) / 1000 || 0.016);
    this.last = now;
    if (this.manual) return;
    this.update(dt);
    this.render();
  }

  render() { this.renderer.render(this.scene, this.camera); }

  update(dt: number) {
    const inp = this.input, ui = this.ui;
    inp.pollPad();
    const wasOpen = ui.menuOpen || ui.paperOpen;
    ui.update(dt);
    const playing = this.mode === 'play' && !ui.menuOpen;
    inp.wantLock = playing;
    this.touch.update();

    if (playing) {
      if (!wasOpen && inp.pressed('pause')) this.pauseMenu();
      this.time += dt;
      if (this.mode === 'play') this.state.playTime += dt;
      for (let i = this.timers.length - 1; i >= 0; i--) {
        if (this.timers[i].t <= this.time) this.timers.splice(i, 1)[0].res();
      }
      this.story.update(dt);
      this.player.update(dt);
      for (const n of this.npcs.values()) n.update(dt);
      this.interact();
      this.shake = Math.max(0, this.shake - dt * 0.9);
    } else if (this.mode === 'title') {
      this.titleT += dt;
      const a = this.titleT * 0.035 + 3.6;
      this.camera.position.set(Math.sin(a) * 74, 30, Math.cos(a) * 74 + 6);
      this.camera.lookAt(0, 4, 8);
      this.audio.setMood('title');
      for (const n of this.npcs.values()) n.update(dt);
    }
    this.world.update(dt);
    if (this.mode === 'play') this.player.updateCamera(dt);
    inp.endFrame();
  }

  /** Find the nearest thing or person to talk to or use, and offer it. */
  private interact() {
    const p = this.player, ui = this.ui;
    if (this.busy || ui.dialogueOpen || ui.paperOpen || p.stagger > 0) { ui.prompt(null); return; }
    let best: { label: string; act: () => void } | null = null, bd = 1e9;
    for (const n of this.npcs.values()) {
      if (!n.visible || !n.talk || !n.label) continue;
      const d = Math.hypot(n.x - p.x, n.z - p.z);
      if (d < 2.8 && d < bd) { bd = d; best = { label: n.label, act: n.talk }; }
    }
    for (const it of this.interactables) {
      const pos = it.at();
      if (!pos) continue;
      const d = Math.hypot(pos[0] - p.x, pos[1] - p.z);
      if (d >= it.r || d >= bd) continue;
      const label = it.label();
      if (label) { bd = d; best = { label, act: it.act }; }
    }
    if (!best && p.carrying >= 0) best = { label: 'Set the board down', act: () => this.story.dropPlank() };
    ui.prompt(best ? (this.input.touchMode ? best.label : `<b>E</b> ${best.label}`) : null);
    if (best && this.input.pressed('interact')) { this.audio.blip(); best.act(); return; }
    if (this.input.pressed('remember')) {
      const st = this.state.stage, f = this.state.flags;
      if (st >= Stage.Free) this.run(() => ui.read('The sealed roll', st === Stage.Accused || (st === Stage.After && !f.shadowGone) ? ROLL_ACCUSED : ROLL_PEACE));
      else if (f.metEvangelist) this.run(() => ui.read('A parchment roll', '<p><i>Come unto me, all ye that labour and are heavy laden, and I will give you rest.</i></p>'));
      else this.note(N.book);
    }
  }
}
