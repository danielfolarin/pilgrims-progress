import type { Script, Step } from '../game/dialogue';
import * as city from './city';
import * as road from './road';
import * as hill from './hill';
import { N, TOO_SHORT } from './lines';

// Every line anyone can say or think in the game, as [speaker, text] pairs.
// The voice recorder (scripts/generate-voices.mjs) records exactly this list,
// so anything added to the content files must be reachable from here.

type Pair = [string, string];

function walk(steps: Step[], out: Pair[]) {
  for (const st of steps) {
    if (Array.isArray(st)) out.push([st[0], st[1]]);
    else if ('choice' in st) for (const o of st.choice) if (o.then) walk(o.then, out);
    if (!Array.isArray(st) && 'when' in st) { walk(st.then, out); if (st.else) walk(st.else, out); }
  }
}
const script = (s: Script, out: Pair[]) => Object.values(s).forEach((steps) => walk(steps, out));
const said = (who: string, list: string[], out: Pair[]) => list.forEach((t) => out.push([who, t]));

export function allLines(): Pair[] {
  const out: Pair[] = [];
  for (const s of [city.INTRO, city.CHRISTIANA, city.HESTER, city.PIP, city.VANE, city.WELL, city.EVANGELIST, city.PORTER,
    road.LEAVE, road.PLIABLE_FALLS, road.BANK, road.LANDING, road.HELP_BUSY, road.JOSS, road.RESCUED, road.WISEMAN, road.DETOUR,
    hill.KNOCK, hill.GOODWILL, hill.GOODWILL_ASK, hill.GARDEN_REST, hill.CROSS_ARRIVE, hill.CROSS_AFTER, hill.TOMB, hill.ACCUSER_PASSED,
    hill.PRAYER, hill.CARRIER]) script(s, out);
  // the Accuser's charges depend on what the player did: take both ends of each
  script(hill.accuserScript({}), out);
  script(hill.accuserScript({ christianaParting: 'angry', slip: 'vane', pliableParting: 'bitter', detourDone: true, helpRefused: true }), out);
  for (const [who, list] of Object.entries(city.AMBIENT)) said(who, list, out);
  said('pliable', road.PLIABLE_BARKS, out);
  said('thought', road.WHISPERS, out);
  said('thought', road.SUNK, out);
  said('joss', road.JOSS_BARKS, out);
  said('help', road.HELP_AFTER, out);
  said('joss', road.JOSS_AFTER, out);
  said('goodwill', hill.GOODWILL_AFTER, out);
  for (const list of [road.CHASE_BARKS, road.GRAB_BARKS, road.HELP_WALK, hill.GOODWILL_WALK]) for (const [who, text] of list) out.push([who, text]);
  for (const [, kind, text] of hill.WAY_LINES) out.push([kind, text]);
  out.push(['dream', hill.CROSS_FALL_1], ['dream', hill.CROSS_FALL_2]);
  for (const n of [...Object.values(N), ...TOO_SHORT]) out.push([n[0], n[1]]);
  return out;
}
