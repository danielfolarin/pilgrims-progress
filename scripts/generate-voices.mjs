// Records every spoken line of the game with Fish Audio (https://fish.audio)
// and saves the recordings in public/audio/, where the game finds them.
//
//   1. Put your Fish Audio API key in a file called .env.local:
//        FISH_API_KEY=your-key-here
//      (.env.local is never uploaded to GitHub.)
//   2. Choose a voice for each speaker in voices.config.json.
//   3. Run:  npm run voices                 record anything not yet recorded
//            npm run voices -- --dry        just count lines, record nothing
//            npm run voices -- --redo=pip   re-record one speaker
//            npm run voices -- --only=dream record only one speaker's missing lines
//            npm run voices -- --check      list recordings whose length looks wrong for their words
//
// It is safe to stop and run again: lines already recorded are skipped.
// Afterwards, build and publish as usual; the recordings travel with the game.

import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'audio');
const manifestFile = join(root, 'src', 'content', 'voice-manifest.json');
const args = process.argv.slice(2);
const dry = args.includes('--dry');
const redo = args.find((a) => a.startsWith('--redo='))?.slice(7);
const only = args.find((a) => a.startsWith('--only='))?.slice(7);

function readKey() {
  if (process.env.FISH_API_KEY) return process.env.FISH_API_KEY;
  const file = join(root, '.env.local');
  if (!existsSync(file)) return null;
  const match = readFileSync(file, 'utf8').match(/^\s*FISH_API_KEY\s*=\s*(.+)\s*$/m);
  return match ? match[1].trim().replace(/^["']|["']$/g, '') : null;
}

// Load the game's own script, so this says exactly what the game says.
const vite = await createServer({ root, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error', plugins: [] });
const { allLines } = await vite.ssrLoadModule('/src/content/all-lines.ts');
const { clipId, spoken } = await vite.ssrLoadModule('/src/game/voice.ts');
const lines = new Map();
for (const [who, text] of allLines()) {
  const clip = clipId(who, text);
  if (clip && !lines.has(clip)) lines.set(clip, { clip, who, text: spoken(text) });
}
await vite.close();

const config = JSON.parse(readFileSync(join(root, 'voices.config.json'), 'utf8'));
const bySpeaker = {};
let characters = 0;
for (const l of lines.values()) { bySpeaker[l.who] = (bySpeaker[l.who] ?? 0) + 1; characters += l.text.length; }
const unvoiced = Object.keys(bySpeaker).filter((who) => !config.voices?.[who]);
mkdirSync(outDir, { recursive: true });
const recorded = () => readdirSync(outDir).filter((f) => f.endsWith('.mp3')).map((f) => f.slice(0, -4));
const todo = [...lines.values()].filter((l) => (!only || l.who === only) && (!existsSync(join(outDir, `${l.clip}.mp3`)) || l.who === redo));

console.log(`Lines in the game: ${lines.size} (${characters.toLocaleString()} characters)`);
console.log('By speaker:', bySpeaker);
if (unvoiced.length) console.log('No voice chosen in voices.config.json for:', unvoiced.join(', '));
console.log(`Already recorded: ${lines.size - [...lines.values()].filter((l) => !existsSync(join(outDir, `${l.clip}.mp3`))).length}. To record now: ${todo.length}.`);

function saveManifest() {
  const wanted = new Set(lines.keys());
  const kept = recorded().filter((id) => {
    if (wanted.has(id)) return true;
    unlinkSync(join(outDir, `${id}.mp3`)); // a line that is no longer in the game
    return false;
  });
  writeFileSync(manifestFile, JSON.stringify(kept.sort()) + '\n');
  return kept.length;
}

// --check: compare each recording's length with its words, to catch readings that went wrong
// (a clip far too short was cut off; far too long usually means the voice rambled or repeated).
if (args.includes('--check')) {
  const { statSync } = await import('node:fs');
  let total = 0, odd = 0;
  for (const l of lines.values()) {
    const file = join(outDir, `${l.clip}.mp3`);
    if (!existsSync(file)) { console.log(`MISSING   ${l.who}: ${l.text.slice(0, 70)}`); odd++; continue; }
    const seconds = (statSync(file).size * 8) / 64000;   // recorded at 64 kbit/s
    total += seconds;
    const rate = l.text.length / seconds;
    if (rate < 7 || rate > 24) { console.log(`${rate < 7 ? 'TOO LONG ' : 'TOO SHORT'} ${seconds.toFixed(1)}s for ${l.text.length} letters  ${l.who}: ${l.text.slice(0, 70)}`); odd++; }
  }
  console.log(`${lines.size} lines, about ${Math.round(total / 60)} minutes of speech. ${odd} look odd.`);
  process.exit(0);
}

if (dry) {
  if (args.includes('--list')) for (const l of lines.values()) console.log(`${l.who.padEnd(11)} ${l.text}`);
  console.log('Dry run: nothing recorded.');
  process.exit(0);
}

const key = readKey();
if (!key) {
  console.error('\nNo API key found. Create .env.local containing:  FISH_API_KEY=your-key-here');
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let done = 0;
for (const l of todo) {
  const voice = config.voices?.[l.who];
  const body = {
    text: l.text,
    format: 'mp3',
    mp3_bitrate: 64,
    prosody: { speed: config.speed?.[l.who] ?? 1, volume: 0, normalize_loudness: true },
    ...(voice ? { reference_id: voice } : {}),
  };
  let saved = false;
  for (let attempt = 1; attempt <= 5 && !saved; attempt++) {
    let response;
    try {
      response = await fetch('https://api.fish.audio/v1/tts', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', model: config.model ?? 's2.1-pro-free' },
        body: JSON.stringify(body),
      });
    } catch { await sleep(3000 * attempt); continue; }   // network hiccup
    if (response.ok) {
      writeFileSync(join(outDir, `${l.clip}.mp3`), Buffer.from(await response.arrayBuffer()));
      saved = true;
    } else if (response.status === 429 || response.status >= 500) {
      await sleep(4000 * attempt); // busy or rate-limited: wait and try again
    } else {
      const detail = await response.text();
      console.error(`\nFish Audio refused the request (${response.status}): ${detail.slice(0, 300)}`);
      console.error(`Stopped after ${done} new recordings. Fix the problem and run again; finished lines are kept.`);
      saveManifest();
      process.exit(1);
    }
  }
  if (!saved) {
    console.error(`\nGave up on one line after several tries. Stopped after ${done} new recordings; run again later.`);
    saveManifest();
    process.exit(1);
  }
  done += 1;
  if (done % 10 === 0 || done === todo.length) console.log(`  recorded ${done} of ${todo.length}`);
  await sleep(350);
}
console.log(`Done. ${saveManifest()} recordings are ready in public/audio/.`);
