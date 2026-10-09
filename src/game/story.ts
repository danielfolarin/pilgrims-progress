import * as THREE from 'three';
import type { Game } from './game';
import { Npc } from './npc';
import { Stage } from './state';
import { NEW_ROBE, OLD_ROBE } from './characters';
import { play, say, Script } from './dialogue';
import { CAST } from '../content/cast';
import { damp, segDist, smooth } from '../core/util';
import { detour, groundY, height, mireAt, onPlank, JOSS_SPOT, SLOTS, SOFT, PLANK_NAME, plankFits, laid, MUD_Y } from '../world/terrain';
import { COVER, TOWER } from '../world/world';
import { N, TOO_SHORT, type Note } from '../content/lines';
import { AMBIENT, CHRISTIANA, EVANGELIST, HESTER, INTRO, PIP, PORTER, SLIP_HTML, VANE, WELL, tallyHtml } from '../content/city';
import { BANK, CHASE_BARKS, DETOUR, GRAB_BARKS, HELP_AFTER, HELP_BUSY, HELP_WALK, JOSS, JOSS_AFTER, JOSS_BARKS, LANDING, LEAVE, PLIABLE_BARKS, PLIABLE_FALLS, RESCUED, SIGN_HTML, SUNK, WHISPERS, WISEMAN } from '../content/road';
import { ACCUSER_PASSED, CARRIER, CROSS_AFTER, CROSS_ARRIVE, CROSS_FALL_1, CROSS_FALL_2, GARDEN_REST, GOODWILL, GOODWILL_AFTER, GOODWILL_ASK, GOODWILL_WALK, INTERPRETER_HTML, KNOCK, PRAYER, TOMB, WAY_LINES, accuserScript } from '../content/hill';

const ROLL_PATH = [[1.0, 409.4], [7.5, 414.2], [14.5, 419.6], [19.6, 421], [21.2, 421]];

/** Sequences the journey: where everyone stands, what triggers what, and every scripted scene. */
export class Story {
  private barkT = 12;
  private barkI = 0;
  private whisperT = 6;
  private whisperI = 0;
  private tremorT = 22;
  private hintT = 0;
  private sunkN = 0;
  private cycle: Record<string, number> = {};
  arrow = { phase: 'idle', t: 2.5, tx: 0, tz: 0, from: new THREE.Vector3(), to: new THREE.Vector3(), n: 0, hits: 0, second: false };
  /** The run out of the city: how often the pilgrim has been caught, and how long the pursuers hang back. */
  chase: { grabs: number; cool: number; barkT: number; barkI: number } | null = null;
  private roll: { t: number; dur: number; done: () => void } | null = null;
  private dawning = false;
  private shadeT = 0;
  private accFade = 0;
  private moodHold = 0;

  constructor(private g: Game) {
    for (const [id, c] of Object.entries(CAST)) if (c.look) g.npcs.set(id, new Npc(g, id, c.look));
    this.wire();
  }

  private get f() { return this.g.state.flags; }
  private get st() { return this.g.state.stage; }
  private N(id: string) { return this.g.npcs.get(id)!; }

  // ---- wiring: who can be spoken to, what can be used ----------------------------

  private wire() {
    const g = this.g, p = g.player;
    const talk = (id: string, fn: (n: Npc) => Promise<void>) => {
      const n = this.N(id);
      n.talk = () => g.run(async () => {
        n.face(p.x, p.z);
        p.face(n.x, n.z);
        await fn(n);
      });
    };
    const lines = (id: string, list: string[]) => async () => {
      const i = this.cycle[id] || 0;
      this.cycle[id] = (i + 1) % list.length;
      await say(g, id, list[i]);
      g.ui.closeDialogue();
    };
    talk('christiana', () => play(g, CHRISTIANA));
    talk('hester', () => play(g, HESTER));
    talk('pip', () => play(g, PIP));
    talk('vane', () => play(g, VANE));
    talk('obstinate', () => play(g, WELL));
    talk('pliable', async () => { if (this.st === Stage.Plain) await lines('pliable', PLIABLE_BARKS)(); else await play(g, WELL); });
    talk('porter', () => play(g, PORTER));
    for (const id of ['chalker', 'oldman']) talk(id, lines(id, AMBIENT[id]));
    talk('evangelist', async () => {
      const first = !this.f.metEvangelist;
      await play(g, EVANGELIST);
      g.cine = null;
      if (first && this.f.metEvangelist) {
        this.setStage(Stage.Leave, 'The stubble field');
        this.walkTalk([N.evWarn], 1.2);   // called after the pilgrim as they go
      }
    });
    talk('help', async () => {
      if (this.st === Stage.Rescue) await play(g, HELP_BUSY);
      else await lines('help', HELP_AFTER)();
    });
    talk('joss', async () => { if (this.st === Stage.Rescue) await this.rescueScene(); else await lines('joss', JOSS_AFTER)(); });
    talk('wiseman', () => play(g, WISEMAN));
    talk('goodwill', async () => { if ((this.f.askedGoodwill || 0) >= 3) await lines('goodwill', GOODWILL_AFTER)(); else await play(g, GOODWILL_ASK); });
    talk('shining1', lines('shining1', [N.shining1Idle[1]]));
    talk('shining2', lines('shining2', [N.shining2Idle[1]]));
    talk('shining3', () => this.tombScene());
    talk('carrier', () => play(g, CARRIER));

    const at = (x: number, z: number) => () => [x, z] as [number, number];
    const add = (pos: () => [number, number] | null, r: number, label: () => string | null, act: () => void) => g.interactables.push({ at: pos, r, label, act });
    const scene = (fn: () => Promise<void>) => () => { g.run(fn); };

    add(at(-4.5, -20.3), 2.6, () => 'Read the Tally', scene(async () => { await g.ui.read('The Tally', tallyHtml(this.f)); this.f.tallyRead = true; }));
    add(at(19.3, 0.6), 2.3, () => (this.f.slipFound ? null : 'Pick up the paper'), scene(async () => {
      g.audio.chime();
      await g.ui.read('A debt slip', SLIP_HTML);
      this.f.slipFound = true;
      this.sync();
    }));
    add(at(-4.4, 238.6), 2.6, () => 'Read the signpost', scene(() => g.ui.read('At the fork', SIGN_HTML)));
    add(at(0, 298.6), 2.7, () => (this.st === Stage.Gate ? 'Knock at the gate' : null), scene(() => this.gateScene()));
    add(at(-5, 310.6), 2.3, () => (this.st >= Stage.Way && !this.f.rested ? 'Sit and eat' : null), scene(async () => {
      await g.ui.fade(true, 0.5);
      p.place(-5, 311.4, Math.PI);
      p.ch.sit = true;
      g.cineTo(-8.5, height(-5, 311) + 2.0, 314.5, -4.6, height(-5, 311) + 1.0, 310.4, 3);
      await g.ui.fade(false, 0.6);
      await play(g, GARDEN_REST);
      this.f.rested = true;
      p.ch.sit = false;
      g.cine = null;
    }));
    add(at(-5.8, 321), 2.5, () => 'Read the notice', scene(() => g.ui.read("At the Interpreter's door", INTERPRETER_HTML)));
    add(at(19.4, 421), 3.0, () => (this.st >= Stage.Free ? 'Look into the sepulchre' : null), scene(() => this.tombScene()));
    add(at(0, 412), 2.5, () => (this.st >= Stage.Free ? 'Stand at the Cross' : null), scene(async () => {
      await say(g, N.cross1[0], N.cross1[1]);
      await say(g, N.cross2[0], N.cross2[1]);
      g.ui.closeDialogue();
    }));
    add(at(-4.2, 498.9), 2.5, () => (this.st >= Stage.After ? 'Sit by the spring and pray' : null), scene(async () => {
      p.ch.sit = true;
      await play(g, PRAYER);
      p.ch.sit = false;
    }));

    // the city's one way up: carry loads from the porter's pile to the Tally-House for chalk
    add(at(-11.3, -5.3), 2.6, () => (this.st <= Stage.Leave && this.f.porterTalked && !p.crate && (this.f.loads || 0) < 3 && !this.chase ? 'Shoulder a load' : null), () => {
      p.crate = true;
      g.audio.footstep('wood', true);
      if (this.once('loadHeavy')) g.note(N.loadHeavy);
    });
    add(at(5.0, -23.0), 3.0, () => (p.crate ? 'Set the load down' : null), () => this.deliver());

    // the three boards and the three gaps
    for (let i = 0; i < 3; i++) {
      add(() => (g.state.planks[i] === -1 ? [g.state.plankPos[i][0], g.state.plankPos[i][1]] : null), 2.3,
        () => (this.st === Stage.Rescue && p.carrying < 0 ? `Lift the ${PLANK_NAME[i]} board` : null),
        () => { g.state.planks[i] = -2; p.carrying = i; g.audio.footstep('wood', true); g.world.syncPlanks(); });
    }
    SLOTS.forEach((s, si) => {
      add(at(s.ax, s.az), 2.0, () => {
        if (this.st !== Stage.Rescue || onPlank(p.x, p.z)) return null;
        if (p.carrying >= 0 && !laid[si]) return 'Lay the board across the gap';
        if (p.carrying < 0 && laid[si]) return 'Take the board up again';
        return null;
      }, () => {
        const pl = g.state.planks;
        if (p.carrying >= 0) {
          if (plankFits(p.carrying, si)) {
            pl[p.carrying] = si;
            p.carrying = -1;
            g.audio.thud();
            g.world.syncPlanks();
            g.ui.caption('sound', '[The board drops across the gap and holds.]');
            if (laid.every(Boolean)) g.note(N.boardwalk);
          } else {
            g.audio.splash();
            g.note(TOO_SHORT[p.carrying]);
          }
        } else {
          const i = pl.indexOf(si);
          if (i >= 0) { pl[i] = -2; p.carrying = i; g.world.syncPlanks(); g.audio.footstep('wood', true); }
        }
      });
    });
  }

  /** A load set down at the Tally-House: one more stroke of chalk, one more weight on the back. */
  private deliver() {
    const g = this.g, p = g.player, f = this.f;
    p.crate = false;
    f.loads = Math.min(3, (f.loads || 0) + 1);
    g.audio.thud();
    this.applyWork();
    g.fx.burst('chalk', 0.5, 0.42);
    g.note((N as any)['vaneMark' + f.loads]);
    this.later(g.wait(3.4), () => g.note((N as any)['mark' + f.loads], 9));
  }

  /** What has been earned is carried: slower, more bent, a bigger pack, until the Cross. */
  private applyWork() {
    const g = this.g, p = g.player, f = this.f, n = f.loads || 0;
    p.workMul = 1 - 0.065 * n;
    p.ch.burden.scale.setScalar(1 + 0.1 * n);
    const strokes = n + (f.slip === 'vane' ? 1 : 0);
    g.world.chalks.forEach((m, k) => (m.visible = k < strokes));
  }

  /** Lines spoken in passing while the player keeps moving (not a conversation). */
  private async walkTalk(list: readonly Note[] | readonly (readonly [string, string])[], delay: number) {
    const g = this.g, ep = g.epoch, st = this.st;
    await g.wait(delay);
    for (const l of list) {
      for (let k = 0; k < 60 && g.busy; k++) await g.wait(0.5);
      if (ep !== g.epoch || this.st !== st) return;
      g.note([l[0], l[1]]);
      await g.wait(Math.max(2.6, l[1].length * 0.062 + 1.2));
    }
  }

  private startChase() {
    const g = this.g, p = g.player, ob = this.N('obstinate'), pl = this.N('pliable');
    p.crate = false;
    this.chase = { grabs: 0, cool: 2.4, barkT: 6.5, barkI: 0 };
    ob.place(p.x - 1.5, p.z - 19, 0);
    pl.place(p.x + 1.5, p.z - 21, 0);
    g.audio.bell();
    g.note(N.chaseBell);
    this.later(g.wait(2.2), () => { if (this.chase) g.note(N.oiStop); });
    g.ui.hint(`They are faster than you. ${g.input.touchMode ? '<b>Hurry</b>' : 'Hurry (<b>Shift</b>)'} in bursts, and keep going if they catch you. Make for the milestone.`, 10);
  }

  private updateChase(dt: number) {
    const g = this.g, p = g.player, c = this.chase!, ob = this.N('obstinate'), pl = this.N('pliable');
    c.cool -= dt;
    const running = c.cool <= 0;
    ob.chase = running ? 3.7 : 0;
    pl.chase = running ? 3.3 : 0;
    if (running) {
      c.barkT -= dt;
      if (c.barkT <= 0 && c.barkI < CHASE_BARKS.length) { c.barkT = 5.5; g.note(CHASE_BARKS[c.barkI++]); }
      if (Math.hypot(ob.x - p.x, ob.z - p.z) < 1.3 && p.stagger <= 0) {
        c.grabs++;
        this.f.chaseGrabs = c.grabs;
        c.cool = 3.6;
        p.stagger = 1.0;
        p.vx = 0; p.vz = -4.8;      // hauled back toward the city
        g.shake = 0.6;
        g.audio.thud();
        g.note(GRAB_BARKS[c.grabs - 1]);
      }
    }
    if (p.z > 103 || c.grabs >= 3) g.run(() => this.leaveScene());
  }

  dropPlank() {
    const g = this.g, p = g.player;
    if (p.carrying < 0) return;
    if (mireAt(p.x, p.z)) { g.note(N.notHere); return; }
    const fx = p.x + Math.sin(p.yaw) * 0.9, fz = p.z + Math.cos(p.yaw) * 0.9;
    const ok = !mireAt(fx, fz);
    g.state.plankPos[p.carrying] = [ok ? fx : p.x, ok ? fz : p.z, p.yaw + Math.PI / 2];
    g.state.planks[p.carrying] = -1;
    p.carrying = -1;
    g.audio.thud();
    g.world.syncPlanks();
  }

  // ---- the world as a function of the save ----------------------------------------

  objective(): string {
    const f = this.f, p = this.g.player;
    const o = (main: string, small = '') => main + (small ? `<small>${small}</small>` : '');
    switch (this.st) {
      case Stage.City: {
        const side = p.crate ? 'Carry the load to the Tally-House steps.'
          : f.slipFound && !f.slip ? "You are carrying Hester's debt slip. Pip, Hester and Vane each have a claim on it."
          : f.pipAsked && !f.slipFound ? "Pip's lost slip: by the cart behind the bakery."
          : f.porterTalked && (f.loads || 0) < 3 ? "The porter's pile: a stroke of chalk for every load carried to the Tally-House." : '';
        if (!f.knowsStranger) return o('Someone in this city must know what to do with a weight like this. Ask around.', side || 'Christiana is at your door.');
        return o('Find the stranger in the stubble field, out through the Field Gate.', side || 'The gate is north of the square, past the well.');
      }
      case Stage.Leave: return this.chase ? o('Run for the milestone. Do not let them drag you back.') : o('Follow the light across the plain.', f.christianaParting ? '' : 'Say your goodbyes first, if you mean to.');
      case Stage.Plain: return o('Cross the plain toward the light.', 'Pliable is walking with you.');
      case Stage.Slough: return o('Cross the Slough of Despond.', 'Sound tussocks will hold you. The mire will not, for long.');
      case Stage.Rescue: return o('Lay boards across the three gaps to reach the traveller in the deep mire.', p.carrying >= 0 ? `You are carrying the ${PLANK_NAME[p.carrying]} board.` : 'One board at a time. They are not all the same length.');
      case Stage.Road: return f.wiseman === 'followed' && !f.detourDone ? o('Take the west road to the village of Morality.') : o('Follow the road north, toward the light.');
      case Stage.Gate: return o('Reach the Wicket Gate, and knock.', 'Arrows fall where the red ring shows. Keep moving, or keep a stone between you and the tower.');
      case Stage.Way: return o('Go up the walled way to the hill.', f.rested ? '' : "Rest in Goodwill's garden first, if you like.");
      case Stage.Free: return f.sawTomb ? o('Go on. The road continues beyond the hill.') : o('Look into the sepulchre, a little below the Cross.', 'You can run now, and leap.');
      case Stage.Accused: return o('The weight feels real. Find out whether it is.');
      case Stage.After: return f.lettersDone ? o('Walk on, to where the road looks out over the valley.') : o('Rest at the spring. A carrier waits by the milestone.');
      default: return o('The first part of the journey is complete.', 'You may keep walking.');
    }
  }

  /** Stand everyone where the story says they are. Safe to call at any time. */
  sync() {
    const g = this.g, f = this.f, st = this.st, p = g.player, w = g.world, N = (id: string) => this.N(id);
    const E = Math.PI / 2, W = -Math.PI / 2, S = Math.PI;

    p.burden = st < Stage.Free ? 'real' : st === Stage.Accused || (st === Stage.After && !f.shadowGone) ? 'shadow' : 'none';
    p.ch.setBurden(p.burden);
    p.ch.setRobe(st >= Stage.Free ? NEW_ROBE : OLD_ROBE);
    p.ch.sit = false;
    p.ch.armLT = p.ch.armRT = null;
    p.weightMul = 1;
    p.crate = false;
    this.chase = null;
    for (const sp of SOFT) sp.down = 0;
    p.carrying = g.state.planks.indexOf(-2);
    p.ranFor = 0; p.leaps = 0;
    g.dawn = st >= Stage.Free ? 1 : 0;
    g.shade = st === Stage.Accused ? 1 : st === Stage.After && !f.shadowGone ? 0.4 : 0;
    this.shadeT = g.shade;
    g.fire = 0;
    this.roll = null;
    this.dawning = false;
    this.moodHold = 0;
    this.hintT = 0;
    this.arrow.phase = 'idle'; this.arrow.t = 2.5; this.arrow.hits = 0; this.arrow.second = false;
    w.ring.visible = w.arrow.visible = false;
    w.stuck.forEach((s) => (s.visible = false));
    w.looseBurden.visible = false;
    w.syncPlanks();
    w.slip.visible = !f.slipFound;
    this.applyWork();
    w.rope.visible = st === Stage.Rescue;
    w.beacon.visible = (!!f.metEvangelist || !!f.sawLight) && st <= Stage.Gate;
    w.shadowWall.visible = st === Stage.Accused;
    w.shadowMat.opacity = 0.86;
    g.ui.setVignette(st === Stage.Accused ? 0.75 : 0);

    // the city
    N('christiana').place(-15.8, -12.6, 2.0).show(f.christianaParting !== 'angry');
    N('hester').place(11.4, -6, W);
    N('vane').place(-1.6, -20.6, 0.3);
    if (f.slip === 'hester') N('pip').place(10.9, -3.9, W); else if (f.slip) N('pip').place(-0.2, -22.4, 0.6); else N('pip').place(-2.6, 3.6, 2.4);
    N('pip').ch.sit = !f.slip;
    N('porter').place(-8.6, -1.9, 2.4);
    N('chalker').place(9.2, 15.2, 3.6);
    N('oldman').place(-6.4, 31, E).ch.sit = true;
    const ob = N('obstinate'), pl = N('pliable');
    pl.follow = false; pl.sunk = 0;
    if (st === Stage.Plain) { ob.place(0.8, 45.5, 0); pl.place(p.x - 1.2, p.z - 1.6, 0); pl.follow = true; }
    else { ob.place(3.4, 4.6, -2.2); pl.place(4.9, 2.6, -1.9); }
    pl.show(true); ob.show(true);
    N('evangelist').place(9.6, 60.4, -2.6).show(st <= Stage.Leave);

    // the Slough
    const help = N('help'), joss = N('joss');
    help.show(st >= Stage.Rescue);
    help.ch.armLT = help.ch.armRT = null;
    help.ch.sit = false;
    joss.show(true);
    if (st <= Stage.Rescue) { help.place(15.6, 184.4, E); joss.place(JOSS_SPOT.x, JOSS_SPOT.z, W); joss.sunk = 0.8; joss.ch.sit = false; joss.ch.armLT = joss.ch.armRT = -2.6; }
    else { help.place(8.2, 190.2, 0.6); joss.place(6.5, 191.25, E); joss.sunk = 0; joss.ch.sit = true; joss.ch.armLT = joss.ch.armRT = null; }

    // the road and the gate
    N('wiseman').place(-3, 236, 2.6).show(st <= Stage.Road && !f.detourDone);
    N('goodwill').place(1.9, 307.3, 2.9).show(st >= Stage.Way);

    // the hill
    for (const id of ['shining1', 'shining2', 'shining3']) { N(id).show(st >= Stage.Free); N(id).ghost = true; }
    N('shining1').place(-2.7, 411.2, 2.2);
    N('shining2').place(2.9, 411.4, -2.2);
    N('shining3').place(17.3, 418.5, -2.4);
    const acc = N('accuser');
    acc.ghost = true;
    acc.place(-4, 475.6, S).show(st === Stage.Accused);
    acc.ch.setOpacity(1);
    this.accFade = st === Stage.Accused ? 1 : 0;
    N('carrier').place(4.6, 498.6, -1.9);

    // what the prompt says
    const L: Record<string, string> = {
      christiana: 'Talk to Christiana', hester: 'Talk to Hester', pip: 'Talk to Pip', vane: 'Talk to Reckoner Vane', obstinate: 'Talk to Obstinate',
      pliable: 'Talk to Pliable', porter: 'Talk to the porter', chalker: 'Talk to the woman chalking her step', oldman: 'Talk to the old man',
      evangelist: f.metEvangelist ? 'Talk to Evangelist' : 'Talk to the stranger', help: 'Talk to Help',
      joss: st === Stage.Rescue ? "Take Joss's arm" : 'Talk to Joss', wiseman: 'Talk to the gentleman', goodwill: 'Talk to Goodwill',
      shining1: 'Speak with the Shining One', shining2: 'Speak with the Shining One', shining3: 'Look into the sepulchre', carrier: 'Talk to the carrier', accuser: '',
    };
    for (const [id, label] of Object.entries(L)) this.N(id).label = label;
    for (const n of g.npcs.values()) n.update(0);
    g.ui.setObjective(g.mode === 'play' ? this.objective() : '');
  }

  setStage(stage: number, label: string, x?: number, z?: number) {
    this.g.state.stage = stage;
    this.sync();
    this.g.checkpoint(label, x, z);
  }

  private once(key: string) {
    if (this.f['b_' + key]) return false;
    this.f['b_' + key] = true;
    return true;
  }

  /** Run `fn` when `pr` settles, unless a save has been loaded in the meantime. */
  private later(pr: Promise<void>, fn: () => void) {
    const ep = this.g.epoch;
    pr.then(() => { if (ep === this.g.epoch) fn(); });
  }

  // ---- every frame ---------------------------------------------------------------

  update(dt: number) {
    const g = this.g, p = g.player, f = this.f, st = this.st, ui = g.ui, w = g.world;

    // animation the scenes lean on
    if (this.roll) this.updateRoll(dt);
    if (this.dawning) { g.dawn = Math.min(1, g.dawn + dt / 7); if (g.dawn >= 1) this.dawning = false; }
    g.shade = damp(g.shade, this.shadeT, 1.4, dt);
    const acc = this.N('accuser');
    if (acc.visible) {
      const target = st === Stage.Accused || g.busy ? 1 : 0;
      this.accFade = damp(this.accFade, target, 1.6, dt);
      acc.ch.setOpacity(this.accFade);
      acc.face(p.x, p.z);
      if (target === 0 && this.accFade < 0.03) acc.show(false);
    }
    if (st === Stage.Rescue) {
      const h = this.N('help'), j = this.N('joss');
      w.setRope(h.x + 0.3, groundY(h.x, h.z) + 1.15, h.z + 0.2, j.x, MUD_Y + 0.75, j.z);
      h.ch.armLT = h.ch.armRT = -1.2;
    }
    ui.setMud(p.sink > 0.05 ? Math.min(1, p.sink * 1.1) : 0);
    this.music();
    if (g.busy) return;
    ui.setObjective(this.objective());

    if (p.sink >= 1) { this.sunk(); return; }
    for (const sp of SOFT) {
      if (sp.down >= 1 || !p.grounded || Math.hypot(p.x - sp.x, p.z - sp.z) > sp.r) continue;
      sp.down = Math.min(1, sp.down + dt / 1.6);
      if (sp.down > 0.45 && this.once('soft')) g.note(N.softGives);
      if (sp.down >= 1) g.audio.splash();
    }

    switch (st) {
      case Stage.City:
      case Stage.Leave: {
        if (Math.hypot(p.x, p.z) < 44) {
          this.tremorT -= dt;
          if (this.tremorT <= 0) {
            this.tremorT = 38 + Math.random() * 20;
            g.shake = 1;
            g.audio.rumble(1.8, 0.5);
            ui.caption('sound', this.once('tremor') ? '[The ground shudders. Somewhere a wall cracks. Nobody looks up.]' : '[A tremor. Dust sifts down.]');
          }
        }
        if (st === Stage.City && p.z > 52 && this.once('field')) g.note(N.field);
        if (st === Stage.Leave && !f.chaseDone) {
          if (!this.chase && p.z > 66) this.startChase();
          if (this.chase) this.updateChase(dt);
        }
        break;
      }
      case Stage.Plain: {
        this.barkT -= dt;
        if (this.barkT <= 0 && this.barkI < PLIABLE_BARKS.length && p.z < 126) {
          this.barkT = 9;
          g.note(['pliable', PLIABLE_BARKS[this.barkI++]]);
        }
        if (p.z > 122 && this.once('sloughsight')) g.note(N.sloughSight);
        if (mireAt(p.x, p.z)) g.run(() => this.pliableFalls());
        break;
      }
      case Stage.Slough: {
        this.whisperT -= dt;
        if (this.whisperT <= 0 && p.z > 134) {
          this.whisperT = 11;
          g.note(['thought', WHISPERS[this.whisperI++ % WHISPERS.length]]);
        }
        if (p.z > 171.4 && p.x < 16) g.run(() => this.bankScene());
        break;
      }
      case Stage.Rescue: {
        this.barkT -= dt;
        if (this.barkT <= 0) {
          this.barkT = 16;
          g.note(['joss', JOSS_BARKS[this.barkI++ % JOSS_BARKS.length]]);
        }
        break;
      }
      case Stage.Road: {
        const d = detour(p.x, p.z);
        if (!f.detourDone && d.e < 1) {
          const wgt = smooth(0.28, 0.86, d.t);
          p.weightMul = 1 - 0.42 * wgt;
          g.fire = wgt;
          if (d.t > 0.45 && this.once('sinai')) g.note(N.sinai);
          if (d.t > 0.62 && this.once('sinai2')) { g.audio.rumble(2.2, 0.6); g.shake = 0.8; ui.caption('sound', '[Fire flickers in the rock. The straps bite deeper.]'); }
          if (d.t > 0.85) g.run(() => this.detourScene());
        } else { p.weightMul = 1; g.fire = 0; }
        if (p.z > 263.5) {
          this.setStage(Stage.Gate, 'In sight of the Gate');
          g.note(N.gateSight);
        }
        break;
      }
      case Stage.Gate:
        this.arrows(dt);
        break;
      case Stage.Way: {
        for (let i = 0; i < WAY_LINES.length; i++) {
          const [z, kind, text] = WAY_LINES[i];
          if (p.z > z && this.once('way' + i)) g.note([kind, text], 8);
        }
        if (p.z > 401.5) g.run(() => this.crossScene());
        break;
      }
      case Stage.Free: {
        if (p.leaps >= 3 && this.once('leaps')) { g.note(N.leaps); g.fx.burst('joy', 0.5, 0.5); g.audio.chime(); }
        if (p.z > 440 && !f.sawTomb && this.once('skiptomb')) g.note(N.skipTomb);
        if (p.z > 464) g.run(() => this.accuserScene());
        break;
      }
      case Stage.Accused: {
        this.hintT += dt;
        if (this.hintT > 9 && this.once('shint')) g.note(N.shadowHint, 9);
        if ((p.ranFor > 0.7 || p.leaps > 0) && !f.weighsNothing) {
          f.weighsNothing = true;
          g.note(N.weighsNothing, 8);
        }
        if (p.z < 452 && this.once('lookback')) g.note(N.lookBack);
        if (p.z > 478.4) g.run(() => this.throughScene());
        break;
      }
      case Stage.After: {
        if (!f.shadowGone) {
          const k = 1 - smooth(481, 494, p.z);
          this.shadeT = 0.4 * k;
          (p.ch.shadowBurden.children[0] as THREE.Mesh<any, THREE.MeshBasicMaterial>).material.opacity = 0.42 * k;
          ui.setVignette(0.45 * k);
          if (p.z > 494) {
            f.shadowGone = true;
            this.shadeT = 0;
            p.burden = 'none';
            p.ch.setBurden('none');
            (p.ch.shadowBurden.children[0] as THREE.Mesh<any, THREE.MeshBasicMaterial>).material.opacity = 0.42;
            ui.setVignette(0);
            g.note(N.thinned, 10);
            const harm = f.slip === 'vane' || f.christianaParting === 'angry' || f.pliableParting === 'bitter';
            this.later(g.wait(8), () => g.note(harm ? N.harmTrue : N.harmNone, 10));
            g.checkpoint('The spring');
          }
        }
        if (p.z > 508.4) g.run(() => this.endScene());
        break;
      }
    }
  }

  private music() {
    const g = this.g, z = g.player.z, st = this.st, a = g.audio;
    if (g.time < this.moodHold) return;
    let m = 'city';
    if (this.chase) m = 'danger';
    else if (st >= Stage.Free) m = g.shade > 0.25 ? 'shade' : 'free';
    else if (st === Stage.Way) m = z < 336 ? 'gate' : 'way';
    else if (st === Stage.Gate) m = z > 266 && z < 300 ? 'danger' : 'gate';
    else if (g.fire > 0.2) m = 'sinai';
    else if (z > 203) m = 'road';
    else if (z > 129) m = 'slough';
    else if (z > 48) m = 'plain';
    a.setMood(m);
  }

  private async sunk() {
    const g = this.g, p = g.player;
    await g.run(async () => {
      g.audio.splash();
      await g.ui.fade(true, 0.4);
      p.place(p.lastFirm.x, p.lastFirm.z, p.yaw);
      p.snapCamera();
      g.note(['thought', SUNK[this.sunkN++ % SUNK.length]]);
      await g.wait(0.5);
      await g.ui.fade(false, 0.5);
    });
  }

  // ---- arrows from the tower -------------------------------------------------------

  private covered(px: number, pz: number) {
    return COVER.some((c) => {
      const s = segDist(c.x, c.z, TOWER.x, TOWER.z, px, pz);
      return s.d < c.r + 0.1 && s.t < 0.99 && Math.hypot(px - c.x, pz - c.z) < 4.8;
    });
  }

  private arrows(dt: number) {
    const g = this.g, p = g.player, a = this.arrow, w = g.world, assist = g.settings.assist;
    const inField = p.z > 267 && p.z < 299.4;
    if (a.phase === 'idle') {
      w.ring.visible = false;
      if (!inField) return;
      a.t -= dt;
      if (a.t > 0) return;
      const lead = assist ? 0.7 : 1.2;
      a.tx = p.x + p.vx * lead; a.tz = Math.min(298.6, p.z + p.vz * lead);
      a.phase = 'aim'; a.t = assist ? 1.5 : 0.95;
      w.ring.position.set(a.tx, groundY(a.tx, a.tz) + 0.06, a.tz);
      w.ring.visible = true;
      g.audio.creak();
      if (this.once('arrowhint')) {
        g.ui.caption('sound', '[A bowstring creaks in the tower.]');
        g.ui.hint('Arrows land on the <b>red ring</b>, and they come in pairs. Step out of it — or keep a standing stone between you and the tower.', 11);
      }
    } else if (a.phase === 'aim') {
      a.t -= dt;
      w.ring.scale.setScalar(1 + Math.max(0, a.t) * 0.9);
      if (a.t > 0) return;
      a.phase = 'fly'; a.t = 0;
      a.from.set(TOWER.x - 2.4, TOWER.y + 11, TOWER.z);
      a.to.set(a.tx, groundY(a.tx, a.tz) + 0.3, a.tz);
      w.arrow.visible = true;
      w.arrow.position.copy(a.from);
      w.arrow.lookAt(a.to);
      g.audio.whoosh();
    } else {
      a.t += dt / 0.3;
      w.arrow.position.lerpVectors(a.from, a.to, Math.min(1, a.t));
      if (a.t < 1) return;
      w.arrow.visible = false;
      w.ring.visible = false;
      const hit = Math.hypot(p.x - a.tx, p.z - a.tz) < 1.0 && !this.covered(p.x, p.z) && p.grounded;
      if (hit) {
        a.hits++;
        g.audio.thud();
        g.shake = 0.9;
        p.stagger = 1.25;
        p.vx = -1.5; p.vz = -8.5;    // knocked back down the field
        if (this.once('arrowhit')) g.note(N.arrowBurden); else g.ui.caption('sound', '[An arrow strikes your pack and spins you round.]');
        if (a.hits === 3) g.note(N.gateVoice);
      } else {
        g.audio.thud();
        const s = w.stuck[a.n++ % w.stuck.length];
        s.visible = true;
        s.position.copy(a.to).y += 0.35;
        s.rotation.set(0.5, Math.random() * 6, 0.25);
        if (this.covered(p.x, p.z) && this.once('covered')) g.ui.caption('sound', '[The arrow shatters on the stone in front of you.]');
      }
      // The archer looses in pairs: the second arrow comes for wherever the first one drove you.
      if (!hit && !assist && !a.second && inField) {
        a.second = true;
        a.tx = p.x + p.vx * 0.55; a.tz = Math.min(298.6, p.z + p.vz * 0.55);
        a.phase = 'aim'; a.t = 0.6;
        w.ring.position.set(a.tx, groundY(a.tx, a.tz) + 0.06, a.tz);
        w.ring.visible = true;
        g.audio.creak();
      } else {
        a.second = false;
        a.phase = 'idle'; a.t = assist ? 3.2 : 1.4;
      }
    }
  }

  // ---- scenes ------------------------------------------------------------------------

  intro() {
    const g = this.g, p = g.player;
    g.run(async () => {
      g.audio.setMood('city');
      this.moodHold = 0;
      g.cineTo(-44, 24, -50, -6, 3, -4, 50);
      g.ui.setObjective('');
      await g.wait(0.2);
      g.ui.card('The City of Destruction', 'the first part of the dream', 5);
      g.cineTo(-34, 14, -40, -12, 2, -12, 0.12);
      await g.wait(3.2);
      g.cineTo(-9.4, height(-9.4, -18.6) + 2.3, -18.6, p.x, p.y + 1.25, p.z, 0.7);
      await play(g, INTRO);
      g.cine = null;
      g.ui.hint(g.input.touchMode
        ? 'Left thumb: walk. Drag the right side: look around.<br/>Tap the prompt to talk. <b>II</b> pauses.'
        : '<b>W</b><b>A</b><b>S</b><b>D</b> walk &nbsp;·&nbsp; mouse or <b>J</b><b>L</b> look<br/><b>Shift</b> hurry &nbsp;·&nbsp; <b>E</b> talk &nbsp;·&nbsp; <b>Esc</b> pause', 14);
    });
  }

  showLight() {
    const g = this.g, p = g.player;
    this.f.sawLight = true;
    g.world.beacon.visible = true;
    g.audio.chime();
    g.cineTo(p.x + 2.5, p.y + 2.6, p.z - 6, 0, height(0, 300) + 7.3, 300, 1.3);
  }

  private async leaveScene() {
    const g = this.g, p = g.player, ob = this.N('obstinate'), pl = this.N('pliable');
    this.chase = null;
    ob.chase = pl.chase = 0;
    this.f.chaseDone = true;
    g.cineTo(p.x + 4.5, p.y + 2.4, p.z + 5, p.x, p.y + 1.2, p.z - 3, 1.6);
    p.face(p.x, p.z - 10);
    await Promise.all([ob.walkTo(p.x - 1.1, p.z - 2.5, 4.2), pl.walkTo(p.x + 1.3, p.z - 2.8, 4.2)]);
    ob.face(p.x, p.z); pl.face(p.x, p.z);
    if ((this.f.chaseGrabs || 0) < 3) await say(g, N.chaseClear[0], N.chaseClear[1]);
    await play(g, LEAVE);
    g.cine = null;
    this.setStage(Stage.Plain, 'The plain');
    ob.place(p.x - 1.1, p.z - 2.5, Math.PI);
    ob.walkTo(0.8, 45.5, 2.4);
  }

  private async pliableFalls() {
    const g = this.g, p = g.player, pl = this.N('pliable');
    pl.follow = false;
    pl.place(p.x + 1.4, p.z + 0.3, 0);
    pl.sunk = 0.55;
    pl.ch.armLT = pl.ch.armRT = -2.4;
    g.audio.splash();
    g.cineTo(p.x - 3.5, 2.6, p.z - 5, p.x + 0.7, 0.8, p.z, 2);
    await play(g, PLIABLE_FALLS);
    pl.sunk = 0;
    pl.ch.armLT = pl.ch.armRT = null;
    g.cine = null;
    this.setStage(Stage.Slough, 'The Slough of Despond', 2, 130.4);
    // he trudges home; he'll be back at the well by the time anyone looks
    pl.place(p.x + 1.4, 131, Math.PI);
    this.later(pl.walkTo(0, 108, 3.2), () => pl.place(4.9, 2.6, -1.9));
    this.whisperT = 7;
    g.ui.hint('In the mire you <b>sink</b>: rest on a tussock before it takes you. Some tussocks are rotten — they hold a moment, then give.', 12);
  }

  helpArrives() {
    const g = this.g, p = g.player, h = this.N('help');
    h.show(true).place(Math.max(-9, Math.min(11, p.x)), 177.3, Math.PI);
    h.ch.armRT = -0.9;
    g.audio.blip();
    g.cineTo(p.x + 4, 2.8, p.z - 4.5, p.x, 1.3, 176.6, 1.8);
  }

  private async bankScene() {
    const g = this.g, p = g.player, h = this.N('help');
    p.face(p.x, 177);
    p.ch.armLT = p.ch.armRT = -2.5;
    g.cineTo(p.x - 3, 1.6, p.z - 4, p.x, 0.9, 175.5, 2);
    await play(g, BANK);
    await g.ui.fade(true, 0.5);
    g.audio.splash();
    p.ch.armLT = p.ch.armRT = null;
    p.place(6, 180.6, 0.6);
    p.ch.sit = true;
    h.place(7.8, 182, 0);
    h.face(p.x, p.z);
    h.ch.armRT = null;
    g.cineTo(2.2, height(6, 180) + 2.2, 177.6, 7, height(6, 180) + 1.0, 181.4, 50);
    await g.wait(0.5);
    await g.ui.fade(false, 0.7);
    await play(g, LANDING);
    p.ch.sit = false;
    g.cine = null;
    p.snapCamera();
    this.setStage(Stage.Rescue, 'Sound ground');
    this.barkT = 34;
    this.walkTalk(HELP_WALK, 5);
    g.ui.hint((g.input.touchMode ? 'Tap the prompt to lift a board, lay it across a gap, or take it up again.' : '<b>E</b> lifts a board, lays it across a gap, or takes it up again.') + ' Three boards, three gaps — the lengths matter.', 12);
  }

  private async rescueScene() {
    const g = this.g, p = g.player, joss = this.N('joss'), help = this.N('help');
    g.cineTo(p.x - 3.5, 2.6, p.z + 4, joss.x, 0.6, joss.z, 2);
    await play(g, JOSS);
    g.audio.splash();
    await g.ui.fade(true, 0.6);
    g.audio.splash();
    this.g.state.stage = Stage.Road;
    this.sync();
    p.place(8.7, 192.5, -2.2);
    help.place(7.6, 190.7, 0);
    help.face(joss.x, joss.z);
    help.ch.sit = true;
    g.cineTo(11.6, height(8, 191) + 2.0, 194.6, 7.2, height(8, 191) + 0.9, 191.2, 50);
    await g.wait(0.9);
    await g.ui.fade(false, 0.7);
    g.fx.burst('welcome', 0.5, 0.4);
    await play(g, RESCUED);
    help.ch.sit = false;
    g.cine = null;
    p.snapCamera();
    this.setStage(Stage.Road, 'Beyond the Slough');
  }

  evangelistArrives() {
    const g = this.g, p = g.player, ev = this.N('evangelist');
    ev.show(true).place(p.x + 9, p.z - 4, 0);
    ev.walkTo(p.x + 2.2, p.z - 0.8, 3);
    g.cineTo(p.x + 5, p.y + 2.4, p.z - 6, p.x, p.y + 1.4, p.z, 1.6);
  }

  private async detourScene() {
    const g = this.g, p = g.player, ev = this.N('evangelist');
    g.audio.rumble(2.5, 0.6);
    g.shake = 1;
    await play(g, DETOUR);
    await g.ui.fade(true, 0.7);
    this.sync();
    p.place(-0.6, 241, 0);
    ev.show(true).place(1.3, 242.6, 0);
    ev.face(p.x, p.z);
    await g.wait(0.6);
    await g.ui.fade(false, 0.8);
    await say(g, N.evBack[0], N.evBack[1]);
    g.ui.closeDialogue();
    this.later(ev.walkTo(9, 228, 2.8), () => ev.show(false));
    g.checkpoint('The fork in the road');
  }

  private async gateScene() {
    const g = this.g, p = g.player, gw = this.N('goodwill');
    g.world.ring.visible = g.world.arrow.visible = false;
    this.arrow.phase = 'idle';
    p.face(0, 300);
    g.audio.knock();
    g.ui.caption('sound', '[You knock. Three times, and again, harder.]');
    await g.wait(1.0);
    await play(g, KNOCK);
    g.audio.creak();
    await g.ui.fade(true, 0.35);
    this.g.state.stage = Stage.Way;
    this.sync();
    p.place(0, 305.4, 0);
    gw.place(1.9, 307.3, 2.9);
    gw.face(p.x, p.z);
    p.face(gw.x, gw.z);
    g.audio.whoosh();
    await g.wait(0.45);
    g.audio.thud();
    g.cineTo(-3.6, p.y + 1.9, 302.4, 1.2, p.y + 1.25, 306.6, 50);
    await g.ui.fade(false, 0.6);
    g.ui.caption('sound', '[An arrow thuds into the gate as it shuts behind you.]');
    g.fx.burst('welcome', 0.5, 0.3);
    g.audio.chime();
    await play(g, GOODWILL);
    g.cine = null;
    p.snapCamera();
    this.setStage(Stage.Way, 'Inside the Gate');
    this.walkTalk(GOODWILL_WALK, 2.5);
  }

  private updateRoll(dt: number) {
    const r = this.roll!, b = this.g.world.looseBurden;
    r.t = Math.min(1, r.t + dt / r.dur);
    // ease in: slow off the shoulders, quicker down the slope
    const u = r.t * r.t * (3 - 2 * r.t), n = ROLL_PATH.length - 1;
    const s = Math.min(n - 1e-4, u * n), i = Math.floor(s), k = s - i;
    const x = ROLL_PATH[i][0] + (ROLL_PATH[i + 1][0] - ROLL_PATH[i][0]) * k;
    const z = ROLL_PATH[i][1] + (ROLL_PATH[i + 1][1] - ROLL_PATH[i][1]) * k;
    const drop = Math.max(0, 1 - r.t * 9);
    const into = smooth(0.9, 1, r.t);
    b.position.set(x, height(x, z) + 0.45 + drop * 0.9 + Math.abs(Math.sin(r.t * 30)) * 0.12 * (1 - into), z);
    b.rotation.x += dt * (2 + r.t * 9);
    b.rotation.z += dt * 1.3;
    b.scale.setScalar((1 + 0.1 * (this.f.loads || 0)) * (1 - into * 0.85));
    if (this.g.cine) this.g.cine.look.copy(b.position);
    if (Math.random() < dt * 5) this.g.audio.footstep('dirt', true);
    if (r.t >= 1) { b.visible = false; this.roll = null; r.done(); }
  }

  private async crossScene() {
    const g = this.g, p = g.player, w = g.world;
    const hy = height(0, 409);
    this.moodHold = 1e9;
    g.audio.setMood('hush');
    g.cineTo(-3.4, hy + 1.6, 401.6, 0.2, hy + 3.1, 412, 0.9);
    await p.walkTo(0.9, 408.8, 1.5);
    p.face(0, 412);
    await play(g, CROSS_ARRIVE);

    // the straps give; nothing the pilgrim does causes it
    g.audio.snap();
    g.shake = 0.5;
    g.ui.caption('sound', '[The straps part.]');
    p.burden = 'none';
    p.ch.setBurden('none');
    p.workMul = 1;
    w.looseBurden.visible = true;
    w.looseBurden.scale.setScalar(1);
    const rolled = new Promise<void>((done) => (this.roll = { t: 0, dur: 9, done }));
    this.updateRoll(0);
    g.cineTo(-2.2, hy + 2.6, 405.2, 1, hy + 1, 409.4, 1.6);
    await say(g, 'dream', CROSS_FALL_1);
    const ty = height(19.6, 421);
    g.cineTo(13.6, ty + 2.5, 416.2, 19, ty + 1, 421, 1.1);
    await say(g, 'dream', CROSS_FALL_2);
    g.ui.closeDialogue();
    await rolled;
    g.audio.thud();
    g.cineTo(16.4, ty + 1.5, 419.8, 20.8, ty + 1.0, 421.1, 1.2);
    await g.wait(1.4);

    // morning
    this.dawning = true;
    g.audio.setMood('cross');
    g.audio.bell();
    g.fx.burst('joy', 0.5, 0.3);
    g.cineTo(p.x + 2.4, hy + 1.5, p.z + 4.6, p.x, p.y + 1.45, p.z, 0.9);
    p.ch.armLT = p.ch.armRT = -0.5;
    await g.wait(2.4);
    await play(g, CROSS_AFTER);
    p.ch.armLT = p.ch.armRT = null;
    g.cine = null;
    p.snapCamera();
    this.setStage(Stage.Free, 'The hill of the Cross');
    this.moodHold = g.time + 75;
    g.audio.setMood('cross');
    const s3 = this.N('shining3');
    s3.place(4.4, 409.6, 0);
    s3.walkTo(17.3, 418.5, 2.6);
    g.ui.hint(g.input.touchMode ? 'The weight is gone. <b>Run</b> runs. <b>Leap</b> leaps. <b>Read</b> opens the roll you were given.' : 'The weight is gone. <b>Shift</b> runs. <b>Space</b> leaps. <b>R</b> reads the roll you were given.', 14);
  }

  shiningArrive() {
    const g = this.g, hy = height(0, 409);
    this.N('shining1').show(true).place(-2.7, 411.2, 2.2);
    this.N('shining2').show(true).place(2.9, 411.4, -2.2);
    this.N('shining3').show(true).place(4.4, 409.6, -1.4);
    g.audio.chime();
    g.cineTo(-5.4, hy + 2.6, 404.2, 0.8, hy + 1.9, 411, 1.2);
  }

  newGarment() {
    const g = this.g;
    g.player.ch.setRobe(NEW_ROBE);
    g.audio.chime();
    g.fx.burst('joy', 0.5, 0.35);
    g.ui.caption('sound', '[Your rags are gone. The new coat is light, and it fits.]');
  }

  private async tombScene() {
    const g = this.g, ty = height(19.6, 421);
    g.cineTo(16.2, ty + 1.6, 419.6, 20.8, ty + 0.95, 421.1, 1.6);
    await play(g, TOMB);
    this.f.sawTomb = true;
    g.cine = null;
  }

  shadowFalls() {
    const g = this.g, p = g.player;
    p.burden = 'shadow';
    p.ch.setBurden('shadow');
    g.audio.rumble(1.8, 0.5);
    g.ui.setVignette(0.75);
  }

  private async accuserScene() {
    const g = this.g, p = g.player, acc = this.N('accuser');
    this.moodHold = 0;
    g.audio.hiss();
    this.shadeT = 1;
    this.accFade = 0;
    acc.ch.setOpacity(0);
    acc.place(-4, 475.6, Math.PI).show(true);
    g.world.shadowWall.visible = true;
    g.world.shadowMat.opacity = 0.86;
    g.cineTo(p.x + 2.6, p.y + 2.0, p.z - 4.6, -4, height(-4, 475.6) + 2.3, 475.6, 1.2);
    p.face(acc.x, acc.z);
    await g.wait(1.2);
    await say(g, N.accuserIntro[0], N.accuserIntro[1]);
    await play(g, accuserScript(this.f));
    g.cine = null;
    p.snapCamera();
    this.setStage(Stage.Accused, 'The narrows');
  }

  private async throughScene() {
    const g = this.g, w = g.world;
    g.audio.hiss();
    g.ui.caption('sound', '[The thorns part like smoke. There was never anything there.]');
    for (let i = 0; i < 12; i++) { w.shadowMat.opacity = 0.86 * (1 - (i + 1) / 12); await g.wait(0.06); }
    w.shadowWall.visible = false;
    await play(g, ACCUSER_PASSED);
    this.f.weighsNothing = true;
    this.g.state.stage = Stage.After;
    this.sync();
    this.N('accuser').show(true);
    this.accFade = 1;
    g.checkpoint('Past the Accuser');
  }

  private async endScene() {
    const g = this.g, p = g.player, f = this.f;
    g.cineTo(p.x - 2.5, p.y + 3.2, p.z - 7.5, 20, p.y + 30, 700, 0.8);
    await say(g, N.end1[0], N.end1[1]);
    await say(g, N.end2[0], N.end2[1]);
    g.ui.closeDialogue();
    this.setStage(Stage.End, 'The view toward Hill Difficulty');
    g.cine = null;
    const L: string[] = [];
    L.push(f.christianaParting === 'angry' ? (f.letterChristiana === 'sorry' ? 'You left Christiana with a cruel word, and have written to take it back.' : 'You left Christiana with a cruel word. It is still unsaid-for.')
      : f.letterChristiana ? 'Christiana has a letter coming: it is real; come when you can.' : 'Christiana is still standing in a doorway, waiting for word.');
    L.push(f.slip === 'hester' ? 'Hester went to face Vane at the noon bell, with Pip beside her and the lane behind her.'
      : f.slip === 'pip' ? 'Pip ran the slip slowly. The city did what it does.'
      : f.slip === 'vane' ? (f.letterHester === 'restitution' ? "You sold Hester's oven for a chalk mark — and have owned it, and sent what you had." : f.hesterOwned ? "You sold Hester's oven for a chalk mark, and told her so to her face." : "You sold Hester's oven for a chalk mark. She does not yet know it from you.")
      : "A debt slip lies under a cart in Baker's Lane.");
    L.push(f.pliableParting === 'bitter' ? (f.letterPliable ? 'You sneered at Pliable, and have written to say so.' : 'Pliable went home with your scorn in his ears.') : 'Pliable went home. You let him go kindly.');
    L.push('Joss is at Help\'s hut, with a twisted ankle and a full plate, a week from the gate.');
    if (f.detourDone) L.push('You know the road to Morality now, and what waits under that hill.');
    g.fx.burst('joy', 0.5, 0.25);
    g.endMenu(L);
  }
}
