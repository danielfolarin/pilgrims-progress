import './style.css';
import { Game } from './game/game';
import { latestSave } from './game/state';

const canvas = document.getElementById('c') as HTMLCanvasElement;
const g = new Game(canvas);

// Hooks for automated play-testing (see DEV_NOTES.md). They drive the same
// update loop the player does, just without waiting for real time to pass.
(window as any).__pp = {
  g,
  async step(sec: number, dt = 1 / 30) {
    g.manual = true;
    const n = Math.ceil(sec / dt);
    for (let i = 0; i < n; i++) {
      g.update(dt);
      for (let k = 0; k < 12; k++) await null;
    }
    g.render();
    g.manual = false;
  },
  tp(x: number, z: number, yaw = 0) { g.player.place(x, z, yaw); g.player.snapCamera(); },
  adv(choice = 0) { return g.ui.testAdvance(choice); },
  resume() { const s = latestSave(); if (s) g.loadState(s); return !!s; },
  info() {
    const p = g.player;
    return {
      stage: g.state.stage, x: +p.x.toFixed(2), z: +p.z.toFixed(2), y: +p.y.toFixed(2), busy: g.busy, mode: g.mode,
      burden: p.burden, sink: +p.sink.toFixed(2), carrying: p.carrying, dialogue: g.ui.dialogueOpen, paper: g.ui.paperOpen,
      menu: g.ui.menuOpen, choices: g.ui.testChoices(), planks: g.state.planks, flags: g.state.flags,
    };
  },
};

if (import.meta.env.DEV) import('./dev/testkit');
