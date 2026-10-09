# The Unburdened Road — development notes

First playable build, 2026-10-08.

## 1. Engine, and why

**Three.js (WebGL) + TypeScript + Vite, running in the browser.** No game engine install, no
licence, nothing to download to play: the build is one HTML file (`PLAY.html`, about 650 KB).
It can be hosted free on any static host. The cost of that choice is listed under "Technical
limitations" below; the main one is that everything a commercial engine gives for free
(physics, animation tooling, navigation, an editor) is hand-written here and kept simple.

## 2. Scope of this build

A complete vertical slice, designed for 20–30 minutes at a first-time pace. That figure is an
estimate from walking distances and reading time; no person has timed it yet. (The automated run,
which hurries everywhere and skips reading, covers it in about 6½ minutes of game time.)

| Beat | Place | What the player does |
|---|---|---|
| 1 | City of Destruction | Explore, talk to nine residents, meet Evangelist, part from Christiana |
| 2 | The plain, the Slough | Pliable joins and turns back; cross the mire tussock to tussock |
| 3 | Help's bank | Accept Help; bridge three gaps with three boards to reach Joss |
| 4 | The fork, the Wicket Gate | Optional detour toward Morality; cross the arrow field; knock |
| 5 | The Cross, the sepulchre | The burden falls; three Shining Ones; the empty tomb |
| 6 | The narrows, the spring | The Accuser and the shadow burden; prayer; letters home |

Working systems: third-person movement and orbit camera, burden effects, branching dialogue with
remembered choices, one environmental puzzle, a danger encounter with no fail state, a
checkpoint at every story beat (a dozen), manual save/load, pause, settings, subtitles and sound captions.

**Not in this build:** the Interpreter's House (its door carries a notice), Hill Difficulty,
Palace Beautiful, Apollyon, the Valley of the Shadow, Vanity Fair, Doubting Castle, the Delectable
Mountains, the Enchanted Ground, the River and the Celestial City. The end screen says so.

## 3. Design rules the build follows

These come straight from the brief, and each one is a decision in the code rather than a hope.

- **No score for the soul.** There is no faith meter, holiness stat, currency or karma value
  anywhere in the save. `state.flags` records only what was said and done, so later scenes can
  refer to it. The one scoreboard in the game is the city's own Tally, and the story treats it
  as the lie the pilgrim is leaving.
- **Welcome is not conditional.** Every reply at the Wicket Gate opens it. Goodwill says so in
  plain words: the pilgrim is received for Christ's sake, not on approval.
- **The burden falls without a test.** At the Cross the game takes the controls away, the
  straps part, and the burden rolls into the sepulchre. Nothing is collected, timed or answered.
- **The burden never returns.** After the Cross, `burden` can only be `none` or `shadow`. The
  shadow looks and feels like the old weight (dark sky, vignette, the same shape on the back)
  but changes no movement number. Running speed with the shadow is 7.4 m/s; with the real
  burden the most was 3.5.
- **No correct phrase beats the Accuser.** All three replies leave him unmoved, including
  reading the roll. What ends his hold is walking on, through a wall that was never solid, and
  the feeling fades over the next stretch of road rather than at once.
- **Choices cost something real, and repair is offered.** Handing Hester's debt slip to Vane
  gets her oven seized, in front of a child. Parting cruelly from Christiana shuts her door.
  Each harm has an opening for honesty in the city, and again at the milestone, where letters
  can own it and (for Hester) send restitution. Declining is allowed and is remembered.
- **Suffering is not a verdict.** Help has limped since he was nineteen, prays about it, and
  still pulls people out. Joss's ankle is bound, not instantly mended; he will follow in a week.
- **Prayer is not a mechanic.** At the spring the pilgrim can give thanks, say the fear aloud,
  listen, and get up with something to do. Nothing is granted for it.
- **Force is for the powers, not for people.** No human can be struck. Danger comes from the
  mire, the tower's arrows and the Accuser; none of them can kill, and none is beaten by violence.

## 4. On the four named influences

The brief asks for themes drawn selectively from Andrew Farley, Andrew Wommack, Joseph Prince
and Brian Zahnd. None of them is quoted, imitated or named in the game, and nothing here should
be read as their endorsement. Where the build leans on a theme each is widely known for:

- *Secure identity and finished forgiveness* (Farley): the roll is "for your comfort, not for
  your admission"; the Accuser's facts are true and his verdict is not.
- *Renewing the mind and acting on what is given* (Wommack): the shadow burden is defeated by
  discovering, in motion, that one is already free.
- *Grace received, righteousness as gift, rest* (Prince): the new garment "is not a uniform you
  must keep clean"; the bench and bread in Goodwill's garden.
- *Jesus shows what God is like; enemy-love; no domination* (Zahnd): the First Shining One's
  account of the Cross; Hester facing Vane with her neighbours instead of with force.

These teachers disagree with one another on real matters, including how the atonement works and
what to expect about physical healing. The slice does not settle those questions. The Cross is
described in several images at once (borne, forgiven, peace made, the grave emptied), and Help's
limp is left unanswered on purpose. **This paragraph is the adaptor's reading and should be
checked by someone who knows these writers well before the game is shown publicly.**

Narration by "The Dreamer" adapts Bunyan's 1678 wording (public domain). Scripture is quoted
from the King James Version (public domain).

## 5. Technical limitations

- **Desktop browsers only.** No touch controls, so phones and tablets cannot play it yet.
- **No voice acting.** Every line is on-screen text; "subtitles" here means the dialogue box,
  passing captions for ambient speech and thoughts, and optional captions for sounds.
- **Simple collision.** The pilgrim is a circle sliding over a height-map, around circles and
  boxes. There is no physics engine; nothing can be pushed, climbed or fallen from.
- **Camera** avoids terrain and marked buildings, not small props; in tight spots it pulls in close.
- **Characters do not path-find.** They walk in straight lines and only where the story has
  cleared the way.
- **One figure rig.** No facial animation; emotion is carried by text, posture and staging.
- **Saves live in the browser** (localStorage), per browser and per device. Clearing site data
  erases them. One checkpoint slot and one manual slot.
- **Performance.** Measured at roughly 50 fps at 2× (Retina) resolution on the development Mac
  (Intel, macOS 13); not measured on any other machine. The default
  "Balanced" picture quality renders at 1.5× instead of 2×. "Fast" and shadows-off are in Settings.
- **Gamepad support is written but has not been tried on hardware.**
- **Not yet tested:** Safari, Firefox, Windows, and opening `PLAY.html` straight from disk
  (it was verified served over http and is live at games.thecuriousseekers.com/pilgrims-progress/;
  it contains nothing that should need a server).
- A small debug handle (`window.__pp`) ships in the build. It is harmless; remove before release.

## 6. Placeholder assets

Everything you see and hear is a stand-in, generated in code. Nothing is licensed from anyone.

| Area | What is there now | What it stands in for |
|---|---|---|
| Characters | One procedural low-poly figure, recoloured, with five hats | Modelled, rigged, animated cast |
| The burden | Four dark icosahedra and rope bands | A sculpted prop with cloth and strap animation |
| Landscape | A height function, vertex colours, flat shading | Sculpted terrain, textures, set dressing |
| Buildings, trees, rocks | Boxes, pyramids, cones, icosahedra | Modelled kits per region |
| Shining Ones, Accuser | The same figure, glowing or darkened | Bespoke designs and effects |
| Sky and weather | A gradient shader, fog, drifting points | Skyboxes, volumetrics, particles |
| Music | A generative synth score: drone, pad chords, plucked line, one written 8-bar tune at the Cross | A composed, recorded soundtrack |
| Sound effects | Filtered noise and sine thumps | Recorded foley and ambience |
| Voices | None | Cast recordings |
| Fonts, UI | System serif, CSS panels | Designed typography and interface art |
| Text | Final-draft quality, but unedited by a second reader | Edited script; theological review |

## 7. How it was tested

`src/dev/testkit.ts` (loaded only by `npm run dev`) drives the real game loop: same movement,
collisions, triggers and dialogue code, with the pilgrim on auto-walk and replies picked by
index. In the browser console:

```js
await T.all('kind')    // kind choices; declines the detour
await T.all('harsh')   // sells the slip, parts cruelly, refuses Help twice, takes the detour
```

Both routes complete with every check passing. They cover: every conversation and both ends of
each consequential choice; sinking in the mire and being returned to firm ground; the board
puzzle; the detour and return; crossing the arrow field (arrows do strike, and never end the
game); the gate; the Cross sequence; the tomb; the Accuser; running at full speed under the
shadow using real key events; prayer; all letter branches; the end screen.

Checked by hand as well: resuming from a checkpoint after a page reload, keyboard walking,
hurrying until winded, the refused jump, keyboard camera, pause freezing game time, and the
single-file production build. Screens were inspected at the city, the Slough, Help's bank, the
arrow field, the gate garden, the walled way, each shot of the Cross scene, the narrows and the end.

**Not machine-testable and still wanted:** a person playing it through with a mouse for feel
(camera speed, arrow fairness, how long the Slough takes), and with sound on.

## 8. Where things are

```
index.html            page shell and UI containers
src/main.ts           start-up, debug handle
src/style.css         all interface styling
src/core/             input.ts  audio.ts (synth score + effects)  ui.ts (dialogue, menus)  util.ts
src/world/terrain.ts  the shape of the land, the mire, the board gaps
src/world/world.ts    scenery, sky, light, weather, moving props
src/game/game.ts      loop, saving, menus, interaction
src/game/player.ts    movement, burden effects, camera
src/game/npc.ts  characters.ts  dialogue.ts  state.ts
src/game/story.ts     who stands where, triggers, every scripted scene
src/content/          cast.ts  city.ts  road.ts  hill.ts   <- all the words are here
src/dev/testkit.ts    automated play-test
```

To change what anyone says, edit `src/content/`. To add a chapter: extend the corridor keys in
`terrain.ts`, dress it in `world.ts`, add a stage in `state.ts`, and sequence it in `story.ts`.

## 9. Suggested next steps

1. A human play-through, then tune the Slough, the arrows and camera feel from what is found.
2. Theological and editorial read of `src/content/`, and of section 4 above.
3. The Interpreter's House as an interactive interior (the brief's "teach through environments").
4. Hill Difficulty and Palace Beautiful: perseverance, the lost roll, hospitality, friendship.
5. Replace placeholders in the order players notice them: characters, music, then landscape.
6. Touch controls, if phones matter.
