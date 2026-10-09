import type { Game } from './game';
import { CAST } from '../content/cast';

// A conversation is a set of named nodes; each node is a list of steps.
//   ['hester', 'A line.']                      someone speaks
//   { choice: [{ t: 'Reply', then: [...] }] }  the pilgrim answers
//   { set: { flag: value } }                   the story remembers something
//   { go: 'node' }                             jump
//   { when: f => ..., then: [...], else: [...] }
//   { run: g => ... }                          anything else

export type Flags = Record<string, any>;
export interface Opt {
  t: string;
  if?: (f: Flags) => boolean;
  set?: Flags;
  then?: Step[];
  go?: string;
  /** Offered only until it has been picked once in this conversation. */
  once?: boolean;
}
export type Step =
  | [string, string]
  | { choice: Opt[] }
  | { go: string }
  | { set: Flags }
  | { run: (g: Game) => void | Promise<void> }
  | { when: (f: Flags) => boolean; then: Step[]; else?: Step[] };
export type Script = Record<string, Step[]>;

export async function say(g: Game, who: string, text: string) {
  const c = CAST[who] || { name: who, color: '#fff' };
  for (const n of g.npcs.values()) n.ch.talking = n.id === who;
  g.player.ch.talking = who === 'you';
  await g.ui.line(c.name, c.color, text, c.kind || 'say');
  for (const n of g.npcs.values()) n.ch.talking = false;
  g.player.ch.talking = false;
}

export async function play(g: Game, script: Script, start = 'start') {
  const f = g.state.flags;
  const used = new Set<string>();
  const runSteps = async (steps: Step[]): Promise<string | undefined> => {
    for (const st of steps) {
      if (Array.isArray(st)) await say(g, st[0], st[1]);
      else if ('choice' in st) {
        const opts = st.choice.filter((o) => (!o.if || o.if(f)) && !(o.once && used.has(o.t)));
        if (!opts.length) continue;
        const o = opts[await g.ui.choose(opts.map((x) => x.t))];
        used.add(o.t);
        if (o.set) Object.assign(f, o.set);
        if (o.then) { const r = await runSteps(o.then); if (r !== undefined) return r; }
        if (o.go) return o.go;
      } else if ('go' in st) return st.go;
      else if ('set' in st) Object.assign(f, st.set);
      else if ('run' in st) await st.run(g);
      else if ('when' in st) {
        const r = await runSteps(st.when(f) ? st.then : st.else || []);
        if (r !== undefined) return r;
      }
    }
    return undefined;
  };
  let node: string | undefined = start;
  while (node && script[node]) node = await runSteps(script[node]);
  g.ui.closeDialogue();
}
