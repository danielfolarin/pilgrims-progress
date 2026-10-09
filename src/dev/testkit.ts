// Dev-only automated play-test. Loaded by main.ts when running `vite` (never in a build).
// It drives the real game loop — same movement, collisions, triggers and dialogue —
// with the pilgrim on auto-walk and replies picked by index, so a whole route can be
// checked for soft-locks in seconds:   await T.all('kind')   or   await T.all('harsh')

type Route = 'kind' | 'harsh';
const pp = () => (window as any).__pp;
const g = () => pp().g;
const info = () => pp().info();
const el = (id: string) => document.getElementById(id)!;

const T = {
  sunk: 0,
  async step(sec: number) {
    const G = g();
    G.manual = true;
    const n = Math.ceil(sec * 30);
    for (let i = 0; i < n; i++) { G.update(1 / 30); for (let k = 0; k < 12; k++) await null; }
    G.manual = false;
  },
  /** Advance a conversation to its end, answering choices from `choices` in order (default: the first). */
  async talk(choices: number[] = []) {
    let i = 0;
    const log: string[] = [];
    for (let guard = 0; guard < 900; guard++) {
      await T.step(0.2);
      const inf = info();
      if (inf.paper) { pp().adv(); continue; }
      if (inf.choices.length) {
        const c = Math.min(choices[i++] ?? 0, inf.choices.length - 1);
        log.push('   > ' + inf.choices[c].slice(1, 80));
        pp().adv(c);
        continue;
      }
      if (inf.dialogue) { pp().adv(); continue; }
      if (!inf.busy) break;
    }
    return log;
  },
  /** Auto-walk through waypoints; stops early if a scene takes over. */
  async walk(pts: number[][], speed = 9, timeout = 90) {
    const G = g();
    for (const [x, z] of pts) {
      let done = false, t = 0;
      let mine: any = null;
      const go = () => { G.player.walkTo(x, z, speed, 0.5).then(() => (done = true)); mine = G.player.auto; };
      go();
      while (!done && t < timeout) {
        await T.step(0.25);
        t += 0.25;
        if (!G.busy) continue;
        if (G.player.auto === mine) G.player.auto = null;   // never cancel a walk the scene itself started
        // a conversation means the story has taken over; anything else (sinking) passes, and we try again
        while (G.busy && !G.ui.dialogueOpen && t < timeout) { await T.step(0.25); t += 0.25; }
        if (G.busy) return false;
        T.sunk++;
        go();
      }
      if (!done) { G.player.auto = null; return false; }
    }
    return true;
  },
  prompt() { return el('prompt').classList.contains('on') ? el('prompt').textContent || '' : ''; },
  /** Press E on whatever is offered, then see the conversation through. */
  async use(expect: string, choices: number[] = []) {
    await T.step(0.15);
    const pr = T.prompt();
    if (!pr.includes(expect)) return [`!! expected prompt "${expect}", saw "${pr}" at ${info().x},${info().z}`];
    g().input.hit.add('KeyE');
    await T.step(0.04);
    return [`[${pr.slice(1).trim()}]`, ...(await T.talk(choices))];
  },
  expect(log: string[], what: string, ok: boolean) { log.push((ok ? 'ok  ' : '!! FAIL ') + what); },

  async city(r: Route) {
    const L: string[] = [], kind = r === 'kind';
    g().newGame();
    await T.talk();
    await T.walk([[-14.3, -13.5]]);
    L.push(...(await T.use('Christiana', [1])));
    await T.walk([[-2, -9], [9.7, -6]]);
    L.push(...(await T.use('Hester', [0, 0])));
    await T.walk([[2, -4], [-4.4, 2.6]]);
    L.push(...(await T.use('Pip', [0, 0])));
    await T.walk([[-3, -3], [8, 1.5], [17.6, 1.4]]);
    L.push(...(await T.use('paper')));
    if (kind) {
      await T.walk([[9.7, -5.2]]);
      L.push(...(await T.use('Hester', [0])));
    }
    await T.walk([[6, -3], [1.5, -14], [0, -19]]);
    L.push(...(await T.use('Vane', kind ? [2] : [0, 0])));
    await T.walk([[-3.6, -18.4]]);
    L.push(...(await T.use('Tally')));
    T.expect(L, 'slip resolved as ' + info().flags.slip, info().flags.slip === (kind ? 'hester' : 'vane'));
    await T.walk([[-3, -6], [-3.6, 8], [-0.5, 20], [0, 40], [4, 52], [8.3, 58.6]]);
    L.push(...(await T.use('stranger', [0, 0, 0, 0, 0])));
    T.expect(L, 'met Evangelist, stage Leave', info().stage === 1);
    await T.walk([[4, 52], [0, 40], [-0.5, 20], [-3.6, 8], [-6, -6], [-14.3, -13.5]]);
    L.push(...(await T.use('Christiana', [kind ? 0 : 2])));
    await T.walk([[-6, -6], [-3.6, 8], [-0.5, 20], [0, 40], [2, 60], [3, 76]]);
    L.push(...(await T.talk([0])));
    T.expect(L, 'left the city with Pliable, stage Plain', info().stage === 2);
    return L;
  },

  async slough(r: Route) {
    const L: string[] = [], kind = r === 'kind';
    await T.walk([[-5, 100], [2, 126], [2, 134.5]]);
    L.push(...(await T.talk(kind ? [0, 0] : [2, 2])));
    T.expect(L, 'Pliable turned back, stage Slough', info().stage === 3);
    // wade straight in first, to check that sinking returns you to firm ground instead of ending the game
    await T.walk([[-4, 141]], 9, 14);
    await T.step(3);
    L.push(`   (waded off the tussocks: now at ${info().x},${info().z}, sink ${info().sink})`);
    T.sunk = 0;
    const ok = await T.walk([[2, 137], [6, 143], [0.5, 148], [7, 153.5], [1, 159], [8, 164], [3, 169.5], [3, 173]], 9, 40);
    L.push(`   (went under ${T.sunk} time(s) and was returned to firm ground)`);
    T.expect(L, 'crossed by the tussocks to the far bank', !ok && info().busy);
    L.push(...(await T.talk(kind ? [1, 0, 0, 0, 0] : [0, 1, 1, 2, 0, 0])));
    T.expect(L, 'drawn out by Help, stage Rescue', info().stage === 4);
    return L;
  },

  async rescue() {
    const L: string[] = [];
    await T.walk([[7, 180.8]]);
    L.push(...(await T.use('short board')));
    await T.walk([[14, 185.6], [16.6, 186]]);
    L.push(...(await T.use('Lay the board')));
    await T.walk([[19.5, 186], [21.3, 186.4]]);
    L.push(...(await T.use('long board')));
    await T.walk([[23.1, 186.4]]);
    L.push(...(await T.use('Lay the board')));
    await T.walk([[21.5, 186], [16.5, 186], [10.4, 192.2]]);
    L.push(...(await T.use('middling board')));
    // a deliberate mistake: the middling board is too short for the widest gap? (it is already bridged, so try the far one with the wrong board first)
    await T.walk([[16.5, 186], [21.5, 186], [26, 187.1], [29.45, 188], [30.9, 187.3]]);
    L.push(...(await T.use('Lay the board')));
    T.expect(L, 'all three gaps bridged', info().planks.every((p: number) => p >= 0));
    await T.walk([[33, 186.3], [35.9, 184.9], [37.5, 185.1]]);
    L.push(...(await T.use('Joss', [0, 0])));
    T.expect(L, 'Joss is out, stage Road', info().stage === 5);
    return L;
  },

  async road(r: Route) {
    const L: string[] = [], kind = r === 'kind';
    await T.walk([[6, 199], [0, 207], [0, 230], [-1.4, 234.6]]);
    L.push(...(await T.use('gentleman', kind ? [0, 0, 1] : [0, 0, 0])));
    if (!kind) {
      const ok = await T.walk([[-10, 240.4], [-30, 246], [-52, 252.3]], 9, 120);
      T.expect(L, 'the hill stopped the pilgrim', !ok && info().busy);
      L.push(...(await T.talk([0, 0])));
      T.expect(L, 'Evangelist brought the pilgrim back to the fork', info().flags.detourDone && Math.abs(info().x) < 3);
    }
    await T.walk([[2, 255], [4, 262], [2, 266]]);
    T.expect(L, 'in sight of the gate, stage Gate', info().stage === 6);
    return L;
  },

  async gate() {
    const L: string[] = [];
    // stone to stone, as the hint suggests
    const ok = await T.walk([[-5.6, 270.2], [3.4, 276.4], [-7.6, 282.6], [1.4, 288], [-4.6, 293], [0, 298.5]], 9, 200);
    L.push(`   (reached the gate: ${ok}; arrows that struck: ${g().story.arrow.hits})`);
    L.push(...(await T.use('Knock', [0, 0, 0, 0, 0, 0])));
    T.expect(L, 'received at the gate, stage Way', info().stage === 7 && info().z > 301);
    return L;
  },

  async way() {
    const L: string[] = [];
    await T.walk([[-4.4, 312.2]]);
    L.push(...(await T.use('Sit and eat')));
    const ok = await T.walk([[0, 320], [0, 338], [0, 402]], 9, 200);
    T.expect(L, 'the hill takes over', !ok && info().busy);
    const before = info().burden;
    L.push(...(await T.talk([0, 0, 0, 0])));
    T.expect(L, `burden ${before} -> ${info().burden}, stage Free`, info().stage === 8 && info().burden === 'none');
    return L;
  },

  async free() {
    const L: string[] = [];
    await T.walk([[10, 415], [17.2, 420.4]]);
    L.push(...(await T.use('sepulchre', [1])));
    T.expect(L, 'saw the empty tomb', !!info().flags.sawTomb);
    const ok = await T.walk([[6, 432], [0, 441], [-3, 456], [-4, 466]], 9, 120);
    T.expect(L, 'the Accuser stops the road', !ok && info().busy);
    L.push(...(await T.talk([2])));
    T.expect(L, 'shadow burden, stage Accused', info().stage === 9 && info().burden === 'shadow');
    return L;
  },

  async after(r: Route) {
    const L: string[] = [], G = g();
    // real key presses this time (W + Shift), not auto-walk, so the input path is exercised too
    G.player.camYaw = 0;
    G.input.down.add('KeyW'); G.input.down.add('ShiftLeft');
    await T.step(0.9);
    const sp = G.player.speed;
    G.input.down.delete('KeyW'); G.input.down.delete('ShiftLeft');
    L.push(`   (running with the shadow on your back: ${sp.toFixed(1)} m/s; with the real burden the most was 3.5)`);
    T.expect(L, 'the shadow weighs nothing: full running speed', sp > 6.5);
    await T.step(1);
    T.expect(L, 'the pilgrim noticed', !!info().flags.weighsNothing);
    const ok = await T.walk([[-4, 480]], 9);
    T.expect(L, 'walked through the wall of thorns', !ok && info().busy);
    L.push(...(await T.talk()));
    T.expect(L, 'stage After', info().stage === 10);
    await T.walk([[-3, 490], [-2.4, 497.6]]);
    T.expect(L, 'the shadow has thinned away', info().burden === 'none');
    L.push(...(await T.use('pray', [0, 0, 0, 0])));
    await T.walk([[3.2, 497.6]]);
    L.push(...(await T.use('carrier', r === 'kind' ? [0, 0, 0] : [0, 0, 0, 0, 0, 0])));
    T.expect(L, 'letters sent', !!info().flags.lettersDone);
    const ok2 = await T.walk([[1, 503], [0, 509.5]], 9);
    L.push(...(await T.talk()));
    T.expect(L, 'reached the end of the slice', info().stage === 11 && info().menu);
    return L;
  },

  async all(r: Route = 'kind') {
    const L: string[] = [];
    for (const part of ['city', 'slough', 'rescue', 'road', 'gate', 'way', 'free', 'after'] as const) {
      L.push('== ' + part);
      L.push(...(await (T as any)[part](r)));
    }
    const fails = L.filter((l) => l.startsWith('!!'));
    L.push(`== ${fails.length ? fails.length + ' PROBLEM(S)' : 'ALL CHECKS PASSED'} — game time ${Math.round(g().state.playTime)}s`);
    return L;
  },
};

(window as any).T = T;
export {};
