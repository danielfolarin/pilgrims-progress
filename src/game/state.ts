// Everything that persists. The world is rebuilt from this (see Story.sync),
// so a save is just this object in localStorage.

export const Stage = {
  City: 0, Leave: 1, Plain: 2, Slough: 3, Rescue: 4, Road: 5,
  Gate: 6, Way: 7, Free: 8, Accused: 9, After: 10, End: 11,
} as const;

export interface GameState {
  v: number;
  stage: number;
  /** Story memory: what the pilgrim said and did. Never a score. */
  flags: Record<string, any>;
  px: number; pz: number; yaw: number;
  /** Per board: -1 lying on the ground (see plankPos), -2 carried, 0..2 laid in that gap. */
  planks: number[];
  plankPos: number[][];
  playTime: number;
  label: string;
}

export interface Settings {
  textSize: number; sens: number; invertY: boolean; toggleRun: boolean; autoCam: boolean;
  shake: boolean; assist: boolean; captions: boolean; typewriter: boolean; contrast: boolean;
  music: number; sfx: number; voice: number; shadows: boolean;
  /** 0 fast, 1 balanced, 2 sharp: caps the render resolution on high-density screens. */
  quality: number;
}

const SAVE_VERSION = 1;
const KEY = 'pilgrim-road';

export const PLANK_HOME = [[7, 181.5, 0.4], [10, 193, -0.3], [21.7, 187.0, 1.2]];

export function freshState(): GameState {
  return {
    v: SAVE_VERSION, stage: Stage.City, flags: {},
    px: -12.4, pz: -14.6, yaw: -1.05,
    planks: [-1, -1, -1], plankPos: PLANK_HOME.map((p) => p.slice()),
    playTime: 0, label: 'The City of Destruction',
  };
}

export const defaultSettings = (): Settings => ({
  textSize: 1, sens: 5, invertY: false, toggleRun: false, autoCam: true, shake: true, assist: false,
  captions: true, typewriter: true, contrast: false, music: 7, sfx: 8, voice: 8, shadows: true, quality: 1,
});

function store(): Storage | null {
  try { return window.localStorage; } catch { return null; }
}

export function loadSettings(): Settings {
  try {
    const raw = store()?.getItem(KEY + '.settings');
    if (raw) return { ...defaultSettings(), ...JSON.parse(raw) };
  } catch { /* fall through to defaults */ }
  return defaultSettings();
}

export function hasSavedSettings() {
  try { return !!store()?.getItem(KEY + '.settings'); } catch { return false; }
}

export function saveSettings(s: Settings) {
  try { store()?.setItem(KEY + '.settings', JSON.stringify(s)); } catch { /* storage unavailable */ }
}

export type Slot = 'auto' | 'manual';

export function writeSave(slot: Slot, s: GameState): boolean {
  try {
    store()?.setItem(`${KEY}.save.${slot}`, JSON.stringify({ ...s, savedAt: Date.now() }));
    return !!store();
  } catch { return false; }
}

export function readSave(slot: Slot): (GameState & { savedAt?: number }) | null {
  try {
    const raw = store()?.getItem(`${KEY}.save.${slot}`);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (s.v !== SAVE_VERSION || typeof s.stage !== 'number') return null;
    return s;
  } catch { return null; }
}

/** The most recent of the two slots, if any. */
export function latestSave() {
  const a = readSave('auto'), m = readSave('manual');
  if (a && m) return (m.savedAt || 0) > (a.savedAt || 0) ? m : a;
  return a || m;
}
