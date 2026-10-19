// All sound in this build is synthesised at runtime with the Web Audio API: a small
// band per mood (pad, bass, arpeggio, drums, and a written theme or a free line), and
// noise/sine based effects. PLACEHOLDER: stands in for a recorded soundtrack.

// A mood is a small band: pad chords (one per bar), an optional bass line, arpeggio and
// drum kit (16-step patterns), and a lead, either a written theme or a gentle random line.
// Adventurous moods carry the road; only the Slough, the hill of Legality and the
// Accuser's narrows are left dark on purpose.
type Theme = [deg: number, len16ths: number][];
interface Mood {
  root: number; scale: number[]; bpm: number;
  chords: number[][];
  pad: number; padWave?: 'sine' | 'strings';
  drone: number; cutoff: number;
  lead: number; wave: OscillatorType; bright?: number;
  /** written theme ([degree, length in 16ths], -1 = rest) */
  theme?: Theme;
  /** random lead instead: chance per eighth note */
  density?: number;
  /** chord tone index per 16th ('0'..'3', '.' = rest) */
  arp?: { level: number; pat: string; oct?: number };
  /** 'x' root, 'f' fifth, 'o' octave, '.' rest */
  bass?: { level: number; pat: string };
  drums?: { level: number; kick?: string; snare?: string; hat?: string; tom?: string };
}

const MIN = [0, 2, 3, 5, 7, 8, 10], DOR = [0, 2, 3, 5, 7, 9, 10], MAJ = [0, 2, 4, 5, 7, 9, 11];
const MIX = [0, 2, 4, 5, 7, 9, 10], PHR = [0, 1, 3, 5, 7, 8, 10];

// Original themes.
const ROAD: Theme = [
  [4, 4], [4, 2], [5, 2], [7, 6], [4, 2],
  [6, 4], [5, 2], [4, 2], [1, 8],
  [2, 4], [4, 2], [5, 2], [7, 4], [9, 4],
  [8, 6], [7, 2], [5, 4], [-1, 4],
  [4, 4], [4, 2], [5, 2], [7, 6], [9, 2],
  [8, 4], [6, 2], [4, 2], [6, 4], [8, 4],
  [7, 4], [5, 2], [3, 2], [5, 4], [7, 4],
  [7, 12], [-1, 4],
];
const PLAIN: Theme = [
  [0, 4], [2, 2], [3, 2], [4, 8],
  [5, 4], [4, 2], [3, 2], [2, 8],
  [0, 4], [2, 2], [4, 2], [7, 6], [6, 2],
  [5, 4], [3, 4], [4, 8],
];
const FREE: Theme = [
  [0, 2], [2, 2], [4, 2], [7, 6], [4, 2], [5, 2],
  [3, 2], [5, 2], [7, 4], [8, 4], [7, 4],
  [5, 2], [7, 2], [9, 4], [8, 2], [7, 2], [5, 4],
  [4, 4], [6, 4], [8, 6], [-1, 2],
  [7, 2], [8, 2], [9, 4], [7, 2], [4, 2], [7, 4],
  [10, 4], [8, 2], [7, 2], [5, 4], [3, 4],
  [4, 2], [6, 2], [8, 4], [6, 2], [8, 2], [11, 4],
  [7, 10], [-1, 6],
];
const CHASE: Theme = [
  [4, 2], [4, 2], [4, 2], [5, 2], [7, 8],
  [7, 2], [5, 2], [4, 2], [5, 2], [4, 4], [2, 4],
  [3, 4], [5, 4], [7, 4], [8, 4],
  [7, 4], [6, 4], [4, 8],
];
// The hymn on the hill, unchanged from the first build (written in eighths there).
const CROSS: Theme = [
  [0, 4], [2, 4], [4, 4], [7, 4], [5, 4], [4, 2], [5, 2], [7, 8],
  [9, 4], [7, 4], [5, 4], [7, 2], [9, 2], [8, 4], [6, 4], [4, 8],
  [4, 4], [5, 4], [7, 4], [9, 4], [10, 4], [9, 2], [7, 2], [5, 8],
  [8, 4], [6, 4], [4, 2], [6, 2], [8, 4], [7, 16],
];

const MOODS: Record<string, Mood> = {
  silence: { root: 50, scale: MAJ, bpm: 60, chords: [[0, 2, 4]], pad: 0, drone: 0, cutoff: 400, lead: 0, wave: 'sine' },
  // the title: the road theme, quietly, as a promise
  title: {
    root: 50, scale: MAJ, bpm: 84, chords: [[0, 2, 4], [4, 6, 8], [5, 7, 9], [3, 5, 7]],
    pad: 0.85, padWave: 'strings', drone: 0.15, cutoff: 900, lead: 0.7, wave: 'triangle', theme: ROAD,
    arp: { level: 0.42, pat: '0.1.2.1.0.1.2.1.' },
  },
  // the city: uneasy and busy, minor, with a pulse rather than a dirge
  city: {
    root: 50, scale: MIN, bpm: 92, chords: [[0, 2, 4], [5, 7, 9], [3, 5, 7], [4, 6, 8]],
    pad: 0.45, padWave: 'strings', drone: 0.2, cutoff: 800, lead: 0.4, wave: 'triangle', density: 0.16,
    arp: { level: 0.32, pat: '0..1..2.0..1..2.' },
    bass: { level: 0.5, pat: 'x..x..x.x..x..f.' },
    drums: { level: 0.5, hat: '..x...x...x...x.', tom: 'x.......x.......' },
  },
  // out across the stubble: modal, marching, hopeful
  plain: {
    root: 52, scale: DOR, bpm: 96, chords: [[0, 2, 4], [3, 5, 7], [0, 2, 4], [6, 8, 10]],
    pad: 0.5, padWave: 'strings', drone: 0.1, cutoff: 1100, lead: 0.6, wave: 'sawtooth', bright: 1700, theme: PLAIN,
    arp: { level: 0.3, pat: '0.1.2.1.0.1.2.1.' },
    bass: { level: 0.55, pat: 'x...x...x...x.f.' },
    drums: { level: 0.55, kick: 'x.......x.......', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.' },
  },
  // dark on purpose
  slough: { root: 47, scale: PHR, bpm: 50, chords: [[0, 3, 4], [1, 3, 5]], pad: 0.5, drone: 0.65, cutoff: 420, lead: 0.35, wave: 'sine', density: 0.12 },
  // pulled out by Help: warm, unhurried, the worst is over
  help: {
    root: 53, scale: MIX, bpm: 80, chords: [[0, 2, 4], [6, 8, 10], [3, 5, 7], [0, 2, 4]],
    pad: 0.6, padWave: 'strings', drone: 0.1, cutoff: 1000, lead: 0.45, wave: 'triangle', density: 0.22,
    arp: { level: 0.3, pat: '0.1.2.3.2.1.0...' },
    bass: { level: 0.4, pat: 'x.......f.......' },
  },
  // the open road: the main theme, a full band
  road: {
    root: 55, scale: MAJ, bpm: 104, chords: [[0, 2, 4], [4, 6, 8], [5, 7, 9], [3, 5, 7]],
    pad: 0.5, padWave: 'strings', drone: 0, cutoff: 1400, lead: 0.7, wave: 'sawtooth', bright: 2200, theme: ROAD,
    arp: { level: 0.32, pat: '0.1.2.1.0.1.2.1.' },
    bass: { level: 0.6, pat: 'x..x..x.x..x..x.' },
    drums: { level: 0.6, kick: 'x.....x.x.......', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.xx' },
  },
  // the hill of Legality: dark on purpose
  sinai: { root: 46, scale: PHR, bpm: 58, chords: [[0, 1, 4], [0, 3, 5]], pad: 0.5, drone: 0.85, cutoff: 380, lead: 0.4, wave: 'sawtooth', density: 0.1 },
  // chases and arrows: driving, heroic minor
  danger: {
    root: 50, scale: MIN, bpm: 138, chords: [[0, 2, 4], [5, 7, 9], [3, 5, 7], [4, 6, 8]],
    pad: 0.4, padWave: 'strings', drone: 0.2, cutoff: 1200, lead: 0.7, wave: 'sawtooth', bright: 2400, theme: CHASE,
    arp: { level: 0.3, pat: '0120012001200120' },
    bass: { level: 0.7, pat: 'x.x.x.x.x.x.x.xo' },
    drums: { level: 0.75, kick: 'x...x...x...x...', snare: '....x.......x..x', hat: 'xxxxxxxxxxxxxxxx', tom: '............x.x.' },
  },
  // the gate and the garden: warm and bright
  gate: {
    root: 53, scale: MAJ, bpm: 84, chords: [[0, 2, 4], [5, 7, 9], [3, 5, 7], [4, 6, 8]],
    pad: 0.8, padWave: 'strings', drone: 0, cutoff: 1300, lead: 0.62, wave: 'triangle', density: 0.28,
    arp: { level: 0.4, pat: '0.1.2.3.2.1.0.1.' },
    bass: { level: 0.4, pat: 'x.......x...f...' },
    drums: { level: 0.3, hat: '..x...x...x...x.' },
  },
  // up the walled way: building toward the hill
  way: {
    root: 50, scale: MAJ, bpm: 76, chords: [[0, 2, 4], [3, 5, 7], [5, 7, 9], [4, 6, 8]],
    pad: 0.75, padWave: 'strings', drone: 0.1, cutoff: 1200, lead: 0.45, wave: 'triangle', density: 0.18,
    arp: { level: 0.3, pat: '0.1.2.1.0.1.2.1.' },
    bass: { level: 0.45, pat: 'x...x...x...x...' },
    drums: { level: 0.3, kick: 'x.......x.......' },
  },
  hush: { root: 50, scale: MAJ, bpm: 60, chords: [[0, 4, 7]], pad: 0.25, drone: 0.2, cutoff: 600, lead: 0, wave: 'sine' },
  cross: {
    root: 50, scale: MAJ, bpm: 66, chords: [[0, 2, 4], [3, 5, 7], [5, 7, 9], [4, 6, 8], [0, 2, 4], [3, 5, 7], [4, 6, 8], [0, 2, 4]],
    pad: 1.0, padWave: 'strings', drone: 0.3, cutoff: 1500, lead: 0.75, wave: 'triangle', theme: CROSS,
  },
  // after the Cross: running, leaping, light
  free: {
    root: 57, scale: MAJ, bpm: 112, chords: [[0, 2, 4], [3, 5, 7], [5, 7, 9], [4, 6, 8]],
    pad: 0.45, padWave: 'strings', drone: 0, cutoff: 1800, lead: 0.7, wave: 'square', bright: 2600, theme: FREE,
    arp: { level: 0.3, pat: '0.1.2.3.0.1.2.3.' },
    bass: { level: 0.55, pat: 'x..x..x.x..x..f.' },
    drums: { level: 0.55, kick: 'x.....x...x.....', snare: '....x.......x...', hat: '..x...x...x...x.' },
  },
  // the Accuser: dark on purpose
  shade: { root: 45, scale: PHR, bpm: 54, chords: [[0, 1, 4]], pad: 0.4, drone: 0.85, cutoff: 330, lead: 0.35, wave: 'sawtooth', density: 0.14 },
};

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

export class AudioSys {
  ctx: AudioContext | null = null;
  moodName = 'silence';
  musicVol = 0.7;
  sfxVol = 0.8;
  private mood: Mood = MOODS.silence;
  private master!: GainNode;
  private musicBus!: GainNode;
  private sfxBus!: GainNode;
  private rev!: GainNode;
  private noise!: AudioBuffer;
  private d1!: OscillatorNode;
  private d2!: OscillatorNode;
  private dGain!: GainNode;
  private dFilt!: BiquadFilterNode;
  private step = 0;
  private nextT = 0;
  private lastDeg = 4;
  private melIdx = 0;
  private melRem = 0;
  private ducked = false;

  /** Where other sound sources (the recorded voices) should connect. */
  get output(): AudioNode | null { return this.ctx ? this.master : null; }

  /** Lower the music while someone is speaking. */
  duck(on: boolean) {
    if (this.ducked === on) return;
    this.ducked = on;
    this.applyVolumes();
  }

  /** Must be called from a user gesture (browsers block audio before one). */
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    const ctx: AudioContext = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    this.master.connect(comp).connect(ctx.destination);
    this.musicBus = ctx.createGain();
    this.sfxBus = ctx.createGain();
    this.musicBus.connect(this.master);
    this.sfxBus.connect(this.master);
    // Cheap reverb: two cross-fed delays behind a low-pass.
    this.rev = ctx.createGain();
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200;
    const a = ctx.createDelay(1), b = ctx.createDelay(1);
    a.delayTime.value = 0.29; b.delayTime.value = 0.43;
    const fa = ctx.createGain(), fb = ctx.createGain();
    fa.gain.value = 0.42; fb.gain.value = 0.38;
    this.rev.connect(lp); lp.connect(a); lp.connect(b);
    a.connect(fa).connect(b); b.connect(fb).connect(a);
    const wet = ctx.createGain(); wet.gain.value = 0.5;
    a.connect(wet); b.connect(wet); wet.connect(this.master);
    // Noise source for effects.
    this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // Drone.
    this.dFilt = ctx.createBiquadFilter(); this.dFilt.type = 'lowpass'; this.dFilt.frequency.value = 400;
    this.dGain = ctx.createGain(); this.dGain.gain.value = 0;
    this.d1 = ctx.createOscillator(); this.d2 = ctx.createOscillator();
    this.d1.type = 'sawtooth'; this.d2.type = 'sawtooth'; this.d2.detune.value = 9;
    this.d1.connect(this.dFilt); this.d2.connect(this.dFilt);
    this.dFilt.connect(this.dGain).connect(this.musicBus);
    this.dGain.connect(this.rev);
    this.d1.start(); this.d2.start();
    this.nextT = ctx.currentTime + 0.1;
    this.applyVolumes();
    this.applyMood();
    setInterval(() => this.tick(), 90);
  }

  applyVolumes() {
    if (!this.ctx) return;
    this.musicBus.gain.setTargetAtTime(this.musicVol * 0.55 * (this.ducked ? 0.4 : 1), this.ctx.currentTime, this.ducked ? 0.15 : 0.6);
    this.sfxBus.gain.setTargetAtTime(this.sfxVol, this.ctx.currentTime, 0.1);
  }

  setMood(name: string) {
    if (name === this.moodName || !MOODS[name]) return;
    this.moodName = name;
    this.mood = MOODS[name];
    this.step = 0;
    this.melIdx = 0;
    this.melRem = 0;
    this.applyMood();
  }

  private applyMood() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, m = this.mood;
    this.d1.frequency.setTargetAtTime(mtof(m.root - 12), t, 1.2);
    this.d2.frequency.setTargetAtTime(mtof(m.root - 5), t, 1.2);
    this.dFilt.frequency.setTargetAtTime(m.cutoff, t, 1.5);
    this.dGain.gain.setTargetAtTime(m.drone * 0.05, t, 1.5);
  }

  private note(deg: number, oct = 0) {
    const s = this.mood.scale, n = s.length;
    const o = Math.floor(deg / n);
    return mtof(this.mood.root + 12 * (o + oct) + s[((deg % n) + n) % n]);
  }

  private tick() {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const m = this.mood;
    const stepDur = 60 / m.bpm / 4;   // sixteenth notes; a bar is 16 steps
    if (this.nextT < ctx.currentTime) this.nextT = ctx.currentTime + 0.05;
    while (this.nextT < ctx.currentTime + 0.25) {
      const t = this.nextT, st = this.step, s16 = st % 16;
      const chord = m.chords[Math.floor(st / 16) % m.chords.length];
      if (s16 === 0 && m.pad > 0) {
        for (const d of chord) {
          if (m.padWave === 'strings') this.strings(this.note(d), t, stepDur * 17, m.pad * 0.03);
          else this.tone(this.note(d), t, stepDur * 17, m.pad * 0.045, 'sine', stepDur * 5, this.musicBus, 0.5);
        }
      }
      if (m.bass) {
        const c = m.bass.pat[s16];
        if (c !== '.') {
          const d = chord[0] + (c === 'f' ? 4 : c === 'o' ? 7 : 0);
          this.tone(this.note(d, -1), t, stepDur * 2.2, m.bass.level * 0.14, 'triangle', 0.008, this.musicBus, 0.05, 700);
        }
      }
      if (m.arp) {
        const c = m.arp.pat[s16];
        if (c !== '.') {
          const k = +c;
          const d = k < chord.length ? chord[k] : chord[0] + 7;
          this.tone(this.note(d, m.arp.oct ?? 1), t, stepDur * 1.8, m.arp.level * 0.06, 'triangle', 0.005, this.musicBus, 0.35);
        }
      }
      if (m.drums) this.drums(m.drums, s16, t);
      if (m.theme && m.lead > 0) {
        if (this.melRem <= 0) {
          const [d, len] = m.theme[this.melIdx++ % m.theme.length];
          this.melRem = len;
          if (d >= 0) this.tone(this.note(d), t, Math.max(stepDur * 1.5, stepDur * len * 0.92), m.lead * 0.075, m.wave, 0.015, this.musicBus, 0.45, m.bright);
        }
        this.melRem--;
      } else if (m.density && st % 2 === 0 && Math.random() < m.density * (s16 % 4 === 0 ? 1.6 : 0.8)) {
        const moves = [-2, -1, -1, 1, 1, 2, 3, -3];
        this.lastDeg = Math.max(0, Math.min(11, this.lastDeg + moves[(Math.random() * moves.length) | 0]));
        this.tone(this.note(this.lastDeg, 1), t, stepDur * 5, m.lead * 0.075, m.wave, 0.012, this.musicBus, 0.55, m.bright);
      }
      this.step++;
      this.nextT += stepDur;
    }
  }

  private drums(k: NonNullable<Mood['drums']>, s: number, t: number) {
    const v = k.level;
    if (k.kick?.[s] === 'x') this.hit(t, 'kick', v);
    if (k.snare?.[s] === 'x') this.hit(t, 'snare', v);
    if (k.hat?.[s] === 'x') this.hit(t, 'hat', v);
    if (k.tom?.[s] === 'x') this.hit(t, 'tom', v);
  }

  private hit(t: number, kind: 'kick' | 'snare' | 'hat' | 'tom', v: number) {
    const ctx = this.ctx!;
    if (kind === 'kick' || kind === 'tom') {
      const o = ctx.createOscillator(), g = ctx.createGain();
      const [f0, f1, d, vol] = kind === 'kick' ? [130, 42, 0.32, 0.5] : [190, 95, 0.28, 0.32];
      o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + d * 0.8);
      g.gain.setValueAtTime(vol * v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g).connect(this.musicBus);
      o.start(t); o.stop(t + d + 0.02);
      return;
    }
    const src = ctx.createBufferSource(); src.buffer = this.noise;
    const f = ctx.createBiquadFilter(), g = ctx.createGain();
    const d = kind === 'snare' ? 0.16 : 0.045;
    f.type = kind === 'snare' ? 'bandpass' : 'highpass';
    f.frequency.value = kind === 'snare' ? 1900 : 7500;
    g.gain.setValueAtTime((kind === 'snare' ? 0.28 : 0.08) * v, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    src.connect(f).connect(g).connect(this.musicBus);
    if (kind === 'snare') { const s = ctx.createGain(); s.gain.value = 0.25; g.connect(s).connect(this.rev); this.tone(185, t, 0.08, 0.12 * v, 'triangle', 0.002, this.musicBus); }
    src.start(t, Math.random() * 0.5); src.stop(t + d + 0.02);
  }

  /** A soft string section: two detuned saws through a low-pass, slow to swell. */
  private strings(f: number, t: number, dur: number, vol: number) {
    const ctx = this.ctx!;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1300;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + dur * 0.3);
    g.gain.linearRampToValueAtTime(vol * 0.8, t + dur * 0.8);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    for (const det of [-7, 6]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det;
      o.connect(lp); o.start(t); o.stop(t + dur + 0.05);
    }
    lp.connect(g).connect(this.musicBus);
    const s = ctx.createGain(); s.gain.value = 0.5; g.connect(s).connect(this.rev);
  }

  private tone(f: number, t: number, dur: number, vol: number, wave: OscillatorType, attack: number, bus: GainNode, send = 0, bright = 0) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = wave; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    if (bright > 0) {   // tame buzzy waves into something like a horn
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = bright; lp.Q.value = 0.7;
      o.connect(lp).connect(g);
    } else o.connect(g);
    g.connect(bus);
    if (send > 0) { const s = ctx.createGain(); s.gain.value = send; g.connect(s).connect(this.rev); }
    o.start(t); o.stop(t + dur + 0.05);
  }

  private burst(dur: number, vol: number, type: BiquadFilterType, f0: number, f1 = f0, q = 1, send = 0.1, delay = 0) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource(); src.buffer = this.noise; src.loop = true;
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.Q.value = q;
    fl.frequency.setValueAtTime(f0, t); fl.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + Math.min(0.02, dur * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(fl).connect(g).connect(this.sfxBus);
    if (send > 0) { const s = ctx.createGain(); s.gain.value = send; g.connect(s).connect(this.rev); }
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
  }

  private thump(f0: number, f1: number, dur: number, vol: number, delay = 0) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.sfxBus);
    o.start(t); o.stop(t + dur + 0.05);
  }

  footstep(surface: 'dirt' | 'mud' | 'stone' | 'grass' | 'wood', heavy: boolean) {
    if (surface === 'mud') { this.burst(0.22, 0.2, 'lowpass', 700, 180, 3); this.thump(90, 50, 0.12, 0.12); return; }
    const f = surface === 'stone' ? 1500 : surface === 'wood' ? 600 : surface === 'grass' ? 2600 : 900;
    this.burst(surface === 'grass' ? 0.1 : 0.07, heavy ? 0.16 : 0.1, 'bandpass', f, f * 0.7, 1.2, 0.05);
    if (heavy) this.thump(75, 45, 0.11, 0.16);
    if (surface === 'wood') this.thump(170, 110, 0.07, 0.12);
  }
  land() { this.burst(0.1, 0.16, 'bandpass', 700, 300, 1); this.thump(110, 50, 0.14, 0.2); }
  whoosh() { this.burst(0.32, 0.28, 'bandpass', 700, 3200, 2.5); }
  thud() { this.thump(140, 45, 0.2, 0.4); this.burst(0.09, 0.2, 'lowpass', 900, 300); }
  knock() { for (let i = 0; i < 3; i++) { this.thump(210, 130, 0.09, 0.5, i * 0.22); this.burst(0.04, 0.18, 'bandpass', 1100, 800, 2, 0.3, i * 0.22); } }
  creak() { this.burst(0.35, 0.09, 'bandpass', 300, 520, 14, 0.2); }
  snap() { this.burst(0.06, 0.35, 'highpass', 1800, 900); this.thump(320, 80, 0.12, 0.3); }
  rumble(dur = 1.6, vol = 0.5) { this.burst(dur, vol, 'lowpass', 110, 50, 0.8, 0.3); }
  splash() { this.burst(0.5, 0.3, 'lowpass', 1400, 200, 1.5, 0.2); }
  breath() { this.burst(0.5, 0.07, 'bandpass', 1100, 700, 1.2, 0); this.burst(0.6, 0.06, 'bandpass', 700, 1000, 1.2, 0, 0.7); }
  hiss() { this.burst(1.6, 0.14, 'bandpass', 2400, 500, 4, 0.6); }
  blip(up = true) {
    if (!this.ctx) return;
    this.tone(up ? 660 : 440, this.ctx.currentTime, 0.12, 0.05, 'triangle', 0.005, this.sfxBus);
  }
  chime() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [880, 1320, 1760].forEach((f, i) => this.tone(f, t + i * 0.09, 0.9, 0.05, 'sine', 0.005, this.sfxBus, 0.7));
  }
  bell() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [1, 2.4, 3.9, 5.2].forEach((r, i) => this.tone(294 * r, t, 3.2 - i * 0.5, 0.07 / (i + 1), 'sine', 0.004, this.sfxBus, 0.8));
  }
}
