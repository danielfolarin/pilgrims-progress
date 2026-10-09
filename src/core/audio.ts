// All sound in this build is synthesised at runtime with the Web Audio API:
// a small generative score (drone + pad chords + plucked line) per mood, and
// noise/sine based effects. PLACEHOLDER: stands in for a recorded soundtrack.

interface Mood {
  root: number; scale: number[]; bpm: number; density: number;
  pluck: number; pad: number; drone: number; wave: OscillatorType; cutoff: number;
  chords: number[][]; melody?: number[];
}

const MIN = [0, 2, 3, 5, 7, 8, 10], DOR = [0, 2, 3, 5, 7, 9, 10], MAJ = [0, 2, 4, 5, 7, 9, 11];
const PHR = [0, 1, 3, 5, 7, 8, 10], PENT = [0, 2, 4, 7, 9];

const MOODS: Record<string, Mood> = {
  silence: { root: 50, scale: MIN, bpm: 60, density: 0, pluck: 0, pad: 0, drone: 0, wave: 'sine', cutoff: 400, chords: [[0, 2, 4]] },
  title: { root: 50, scale: DOR, bpm: 60, density: 0.18, pluck: 0.5, pad: 0.6, drone: 0.4, wave: 'triangle', cutoff: 800, chords: [[0, 2, 4], [3, 5, 7], [6, 8, 10], [0, 2, 4]] },
  city: { root: 50, scale: MIN, bpm: 66, density: 0.22, pluck: 0.5, pad: 0.4, drone: 0.55, wave: 'triangle', cutoff: 700, chords: [[0, 2, 4], [5, 7, 9], [3, 5, 7], [4, 6, 8]] },
  plain: { root: 52, scale: DOR, bpm: 76, density: 0.3, pluck: 0.55, pad: 0.4, drone: 0.3, wave: 'triangle', cutoff: 900, chords: [[0, 2, 4], [3, 5, 7], [6, 8, 10], [0, 2, 4]] },
  slough: { root: 47, scale: PHR, bpm: 50, density: 0.12, pluck: 0.35, pad: 0.5, drone: 0.85, wave: 'sine', cutoff: 420, chords: [[0, 3, 4], [1, 3, 5]] },
  road: { root: 55, scale: MAJ, bpm: 80, density: 0.34, pluck: 0.55, pad: 0.45, drone: 0.22, wave: 'triangle', cutoff: 1100, chords: [[0, 2, 4], [3, 5, 7], [4, 6, 8], [0, 2, 4]] },
  sinai: { root: 46, scale: PHR, bpm: 58, density: 0.1, pluck: 0.4, pad: 0.5, drone: 1.1, wave: 'sawtooth', cutoff: 380, chords: [[0, 1, 4], [0, 3, 5]] },
  danger: { root: 49, scale: MIN, bpm: 116, density: 0.55, pluck: 0.6, pad: 0.4, drone: 0.7, wave: 'square', cutoff: 800, chords: [[0, 2, 4], [5, 7, 9]] },
  gate: { root: 53, scale: MAJ, bpm: 70, density: 0.28, pluck: 0.5, pad: 0.65, drone: 0.25, wave: 'triangle', cutoff: 1200, chords: [[0, 2, 4], [5, 7, 9], [3, 5, 7], [4, 6, 8]] },
  way: { root: 50, scale: MAJ, bpm: 62, density: 0.2, pluck: 0.45, pad: 0.7, drone: 0.35, wave: 'triangle', cutoff: 1000, chords: [[0, 2, 4], [3, 5, 7], [0, 2, 4], [4, 6, 8]] },
  hush: { root: 50, scale: MAJ, bpm: 60, density: 0, pluck: 0, pad: 0.25, drone: 0.2, wave: 'sine', cutoff: 600, chords: [[0, 4, 7]] },
  // Original eight-bar tune for the hill; scale degrees, -1 = rest.
  cross: {
    root: 50, scale: MAJ, bpm: 66, density: 0, pluck: 0.75, pad: 1.0, drone: 0.4, wave: 'triangle', cutoff: 1500,
    chords: [[0, 2, 4], [3, 5, 7], [5, 7, 9], [4, 6, 8], [0, 2, 4], [3, 5, 7], [4, 6, 8], [0, 2, 4]],
    melody: [
      0, -1, 2, -1, 4, -1, 7, -1, 5, -1, 4, 5, 7, -1, -1, -1,
      9, -1, 7, -1, 5, -1, 7, 9, 8, -1, 6, -1, 4, -1, -1, -1,
      4, -1, 5, -1, 7, -1, 9, -1, 10, -1, 9, 7, 5, -1, -1, -1,
      8, -1, 6, -1, 4, 6, 8, -1, 7, -1, -1, -1, -1, -1, -1, -1,
    ],
  },
  free: { root: 57, scale: PENT, bpm: 98, density: 0.5, pluck: 0.7, pad: 0.5, drone: 0.15, wave: 'triangle', cutoff: 1600, chords: [[0, 2, 4], [3, 5, 7], [2, 4, 6], [0, 2, 4]] },
  shade: { root: 45, scale: PHR, bpm: 54, density: 0.14, pluck: 0.35, pad: 0.4, drone: 1.1, wave: 'sawtooth', cutoff: 330, chords: [[0, 1, 4]] },
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
    const stepDur = 60 / m.bpm / 2;
    if (this.nextT < ctx.currentTime) this.nextT = ctx.currentTime + 0.05;
    while (this.nextT < ctx.currentTime + 0.25) {
      const t = this.nextT, st = this.step;
      if (st % 8 === 0 && m.pad > 0) {
        const ch = m.chords[Math.floor(st / 8) % m.chords.length];
        for (const d of ch) this.tone(this.note(d), t, stepDur * 8.6, m.pad * 0.045, 'sine', stepDur * 2.5, this.musicBus, 0.5);
      }
      if (m.melody) {
        const d = m.melody[st % m.melody.length];
        if (d >= 0) this.tone(this.note(d, 1), t, stepDur * 3.2, m.pluck * 0.085, m.wave, 0.02, this.musicBus, 0.6);
      } else if (m.density > 0 && Math.random() < m.density * (st % 2 === 0 ? 1.3 : 0.7)) {
        const moves = [-2, -1, -1, 1, 1, 2, 3, -3];
        this.lastDeg = Math.max(0, Math.min(11, this.lastDeg + moves[(Math.random() * moves.length) | 0]));
        this.tone(this.note(this.lastDeg, 1), t, stepDur * 2.6, m.pluck * 0.075, m.wave, 0.012, this.musicBus, 0.55);
      }
      this.step++;
      this.nextT += stepDur;
    }
  }

  private tone(f: number, t: number, dur: number, vol: number, wave: OscillatorType, attack: number, bus: GainNode, send = 0) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = wave; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(bus);
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
