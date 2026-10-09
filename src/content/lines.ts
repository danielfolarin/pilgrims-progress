// Narration, thoughts and one-off spoken lines that are triggered by play rather than
// by a conversation. Each is [speaker, text] (see cast.ts for speakers); an optional
// third item is the name to show instead of the speaker's own.
// Keeping them here means the voice recorder can find every line in the game.

export type Note = readonly [who: string, text: string, shownAs?: string];

export const N = {
  book: ['thought', 'The book is in your coat. You know what it says. You have read it until the candle drowned.'],
  noJump: ['thought', 'With this on your back, your feet will not leave the ground.'],
  helpBusy: ['help', "I've got him. Boards, pilgrim — and mind the lengths."],
  shining1Idle: ['shining1', 'Go in peace. The road is before you, and so is he.'],
  shining2Idle: ['shining2', 'The garment suits you. It was cut for you before you ever knocked.'],
  cross1: ['thought', 'It is only wood. It is not the wood that did it.'],
  cross2: ['thought', 'You stand a while anyway. There is nowhere you are required to be.'],
  boardwalk: ['thought', 'The boardwalk reaches him.'],
  notHere: ['thought', 'Not here. The mire would have it.'],
  field: ['thought', 'Stubble, and wind, and room. On a rise ahead, someone is standing with a lamp on a staff.'],
  sloughSight: ['thought', 'The road runs down into reeds and grey water, and does not obviously come out again.'],
  sinai: ['thought', 'The hill leans out over the road. Was it leaning before?'],
  gateSight: ['thought', 'There: the light, over a little gate in a long wall. And across the field from it, a black tower.'],
  leaps: ['dream', 'Three leaps for joy. (Bunyan counted them, too.)'],
  skipTomb: ['thought', 'The burden went down into that hollow. Part of you wants to see where. It will keep; so will the road.'],
  shadowHint: ['thought', 'It feels exactly as heavy as the old one. Is it? (Try to run, or leap.)'],
  weighsNothing: ['thought', 'You run — and you can run. The shape on your back has no straps. It weighs what a shadow weighs.'],
  lookBack: ['thought', 'Behind you the hill is still there, and the Cross on it, small and plain. It has not moved.'],
  thinned: ['thought', 'It thinned as you walked. Not all at once, and not because you argued well. The burden is in the grave. This was only its shadow.'],
  harmTrue: ['thought', 'Some of what he said was true: the facts, not the verdict. There are things to put right. For the first time, you are not too afraid to look at them.'],
  harmNone: ['thought', 'He will be back. But you know now what he is made of.'],
  arrowBurden: ['thought', 'The arrow buries itself in the burden. For once the thing is good for something.'],
  gateVoice: ['goodwill', 'Not the open ground! Stone to stone — and then run for the door!', 'A voice from the gate'],
  oiStop: ['obstinate', 'Oi! Stop! Stop there!'],
  evBack: ['evangelist', "There. The light's ahead of you again. I shall not be far."],
  accuserIntro: ['dream', "A little below the hill, where the road pinched between two rocks, something waited that knew the pilgrim's name."],
  end1: ['dream', 'Then I saw that the road went down from that place to the foot of a hill; and the name of the hill was Difficulty.'],
  end2: ['thought', 'It is a long way. You find you are not afraid of its being long.'],
  evWarn: ['evangelist', "One thing more. Between here and the light there is bad ground — the Slough. People go into it believing they're the only one who ever has. They are not. Shout, if you sink."],
  chaseBell: ['thought', 'Behind you the Tally bell begins to toll. Someone has seen you go.'],
  chaseClear: ['thought', 'The milestone. Behind you the shouting has run out of breath.'],
  softGives: ['thought', 'The tussock gives under you. Not everything green will hold.'],
  vaneMark1: ['vane', 'One. Chalked.'],
  vaneMark2: ['vane', 'Two. You are rising.'],
  vaneMark3: ['vane', 'Three. Do not stop now. Nobody stops.'],
  mark1: ['thought', 'A stroke of chalk beside your name. You feel it, for about a breath.'],
  mark2: ['thought', 'Two. The straps bite deeper. Strange: the more the board says you are worth, the more there is to carry.'],
  mark3: ['thought', 'Three, and your name has climbed a line. Your back has noticed the three. It has not noticed the line.'],
  loadHeavy: ['thought', 'The crate is not the heavy part.'],
} satisfies Record<string, Note>;

/** Said when a board is too short for a gap: one line per board (short, middling, long). */
export const TOO_SHORT: Note[] = ['short', 'middling', 'long'].map(
  (name) => ['thought', `The ${name} board will not reach. It dips into the black water, and you haul it back.`] as const,
);
