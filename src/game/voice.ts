import type { AudioSys } from '../core/audio';
import manifest from '../content/voice-manifest.json';

// Recorded voices. Each spoken line has one clip in public/audio/, named from the
// speaker and a fingerprint of the words, so changing a line simply means its old
// recording is no longer used. Lines with no recording are just shown as text.

/** What is actually said aloud: stage directions in brackets are left out. */
export function spoken(text: string) {
  return text
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\s*[—–]\s*/g, ', ')
    .replace(/…/g, '...')
    .replace(/\s+/g, ' ')
    .replace(/^[\s,.]+/, '')
    .replace(/\s+([,.!?;:])/g, '$1')
    .replace(/,(\s*,)+/g, ',')
    .replace(/([.!?;:]),/g, '$1')
    .trim();
}

/** The clip for a line, or null if there is nothing to say (a look, a silence). */
export function clipId(who: string, text: string): string | null {
  const s = spoken(text);
  if (!/[A-Za-z]/.test(s)) return null;
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return `${who}-${(h >>> 0).toString(36)}`;
}

const HOSTED = 'https://games.thecuriousseekers.com/pilgrims-progress/';

export class Voice {
  on = true;
  volume = 1;
  /** Lines asked for that have no recording (handy when checking a new script). */
  missing = new Set<string>();
  private have = new Set<string>(manifest as string[]);
  private cache = new Map<string, AudioBuffer>();
  private gain: GainNode | null = null;
  private src: AudioBufferSourceNode | null = null;
  private ticket = 0;
  private queue: string[] = [];
  // Opened as a file from disk there is no audio folder beside the page, so use the published one.
  private base = (typeof location !== 'undefined' && location.protocol === 'file:' ? HOSTED : import.meta.env.BASE_URL) + 'audio/';

  constructor(private audio: AudioSys) {}

  get count() { return this.have.size; }

  /** Speak a line now, cutting off whatever was being said. */
  say(who: string, text: string) {
    this.queue = [];
    this.stop();
    const clip = this.find(who, text);
    if (clip) this.play(clip);
  }

  /** Speak a passing line (a thought, a call from across the marsh) after anything already being said. */
  aside(who: string, text: string) {
    const clip = this.find(who, text);
    if (!clip) return;
    if (this.src) { if (this.queue.length < 2) this.queue.push(clip); } else this.play(clip);
  }

  stop() {
    this.ticket++;
    if (this.src) { this.src.onended = null; try { this.src.stop(); } catch { /* already ended */ } this.src = null; }
    this.audio.duck(false);
  }

  private find(who: string, text: string) {
    const clip = clipId(who, text);
    if (!clip) return null;
    if (!this.have.has(clip)) { this.missing.add(`${who}: ${text}`); return null; }
    return this.on && this.volume > 0 && this.audio.ctx ? clip : null;
  }

  private async play(clip: string) {
    const ctx = this.audio.ctx!;
    const ticket = ++this.ticket;
    try {
      let buf = this.cache.get(clip);
      if (!buf) {
        const res = await fetch(this.base + clip + '.mp3');
        if (!res.ok) return;
        buf = await ctx.decodeAudioData(await res.arrayBuffer());
        if (this.cache.size > 60) this.cache.delete(this.cache.keys().next().value!);
        this.cache.set(clip, buf);
      }
      if (ticket !== this.ticket) return;   // something else was said while this was loading
      if (!this.gain) { this.gain = ctx.createGain(); this.gain.connect(this.audio.output!); }
      this.gain.gain.value = this.volume * 1.4;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(this.gain);
      src.onended = () => {
        if (this.src !== src) return;
        this.src = null;
        const next = this.queue.shift();
        if (next) this.play(next); else this.audio.duck(false);
      };
      this.src = src;
      this.audio.duck(true);
      src.start();
    } catch { /* offline, or the clip would not decode: the text is still on screen */ }
  }
}
