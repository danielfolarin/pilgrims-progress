# The Unburdened Road

A single-player 3D adventure: an original adaptation of John Bunyan's *The Pilgrim's Progress*.
This is the **first playable build** — a 20–30 minute vertical slice from the City of Destruction
to the Cross and one accusation beyond it.

## Play it

**Online:** <https://games.thecuriousseekers.com/pilgrims-progress/> (listed on the games page at
<https://games.thecuriousseekers.com>). Every push to `main` on GitHub (`danielfolarin/pilgrims-progress`)
rebuilds and republishes it; see `.github/workflows/deploy.yml`.

**Easiest:** double-click `PLAY.html`. It is the whole game in one file; it needs no server and no
internet. (Chrome, Edge, Safari or Firefox on a laptop or desktop. Keyboard and mouse, or a gamepad.)

**While developing:**

```bash
npm install
npm run dev      # http://127.0.0.1:5175
npm run build    # type-checks, builds dist/, refreshes PLAY.html
npm run voices   # record any new or changed lines (needs FISH_API_KEY in .env.local)
```

On Daniel's Mac, Node is not on the PATH; use the Codex runtime's Node directly:

```bash
NODE=~/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node
$NODE node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5175          # dev
$NODE node_modules/typescript/bin/tsc --noEmit && $NODE node_modules/vite/bin/vite.js build && cp dist/play.html PLAY.html
```

## Controls

| | |
|---|---|
| W A S D / arrow keys | Walk |
| Mouse (click the view to capture it), or J L I K | Look · wheel zooms |
| Shift | Hurry — as far as the burden allows. After the Cross: run |
| Space | Leap (after the Cross) |
| E / Enter | Talk, use, continue a conversation |
| 1–4, or ↑ ↓ then Enter | Choose a reply |
| R | Read what you carry (the parchment; later, the sealed roll) |
| Esc / P | Pause · save · load · settings |

**On a phone or tablet** (turn it sideways): the left thumb walks, dragging the right side looks
around, and you tap the prompt to talk, tap to continue, and tap a reply to choose it.
Buttons: Hurry/Run, Leap, Read, and II for pause.

Every spoken line has a recorded voice (computer-generated; see `DEV_NOTES.md`, section 9).

The whole slice can be played on the keyboard alone, or by touch alone. Settings include text size, high-contrast
panels, sound captions, an assist mode (gentler mire and arrows), hold/toggle run, camera
auto-follow, camera shake off, look sensitivity and inversion, volumes, shadows and picture quality.

## What is in the slice

1. **The City of Destruction** — Christiana, Hester the baker, Pip the runner, Reckoner Vane and his
   Tally, Obstinate and Pliable, and Evangelist in the stubble field. One optional thread (a lost
   debt slip) with three different outcomes, and the porter's pile: carry loads for chalk marks,
   and feel each one added to your back. Then a chase out across the stubble field.
2. **The plain and the Slough of Despond** — Pliable turns back; wade tussock to tussock, some of
   them rotten; the far bank cannot be climbed alone.
3. **Help** — accept his hand; then lay three boards of different lengths across three gaps to
   reach another traveller in the deep mire (the environmental puzzle).
4. **The fork** — Mr Worldly Wiseman's road to Morality (an optional, costly detour), then the
   arrow-swept field before **the Wicket Gate**, and Goodwill's welcome.
5. **The Cross and the sepulchre** — the burden falls by no doing of the player's; movement,
   posture, camera, light and music all change.
6. **The Accuser** — a shadow of the burden returns. It weighs nothing. The player finds that out
   by moving, not by choosing the right sentence. Then a spring, a prayer, and letters home.

See `DEV_NOTES.md` for scope, technical limits, the placeholder list, the design rules the build
follows, and how the automated play-test works.
