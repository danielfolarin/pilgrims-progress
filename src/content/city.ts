import type { Script, Flags } from '../game/dialogue';

// Lines marked "dream" borrow the cadence — and here and there the words —
// of Bunyan's 1678 text, which is in the public domain. Everything else is original.

export const INTRO: Script = {
  start: [
    ['dream', 'As I walked through the wilderness of this world, I lighted on a certain place where was a den, and laid me down in that place to sleep; and as I slept, I dreamed a dream.'],
    ['dream', 'I dreamed, and behold: a city under a cracked wall, and in it one standing outside their own door, with a book in their hand and a great burden upon their back.'],
    ['thought', 'You have read it again by the last of the candle, and it says what it said yesterday. This city is coming down. And the thing on your back is yours.'],
    ['thought', 'It is worse indoors. You have come out to stand in the lane, as if the weight were something you could walk off.'],
  ],
};

export const CHRISTIANA: Script = {
  start: [
    {
      when: (f) => !f.metEvangelist,
      then: [{ when: (f) => !f.metChristiana, then: [{ go: 'first' }], else: [{ go: 'again' }] }],
      else: [{ when: (f) => !f.christianaParting, then: [{ go: 'parting' }], else: [{ go: 'after' }] }],
    },
  ],
  first: [
    ['christiana', "You're up. I heard you walking the boards again half the night."],
    ['you', "I couldn't lie still. It's heavier lying down."],
    ['christiana', "It's a book, love. You read a book, and now you can't carry your own back."],
    {
      choice: [
        {
          t: "It isn't the book. The book only named it.",
          then: [
            ['christiana', 'Named what? We pay what we owe. We chalk our marks like everyone in the Row. What is there to name?'],
            ['you', "That it's never enough. That the board is never going to say enough."],
            ['christiana', "…No. It isn't. But the children eat."],
          ],
        },
        {
          t: "I'm frightened for us. For the children.",
          then: [
            ['christiana', "So am I. Every day. That's called living here."],
            ['christiana', "The wall cracked again by the tannery last night. Obstinate's crew had it patched by lamplight. It holds. It always holds."],
          ],
        },
        {
          t: "I'm sorry. I know I've been poor company.",
          then: [
            ['christiana', "You've been no company at all. You've been a wall with a coat on."],
            ['thought', 'She straightens your collar anyway. The strap is in the way; she works round it, as she has for years.'],
          ],
        },
      ],
    },
    ['christiana', "There's an old stranger out in the stubble past the Field Gate, telling people there's a way out. Hester's brother listened to him and was gone by sunrise with a pack on."],
    ['christiana', "Don't you go and listen."],
    ['christiana', "…Or go. Go and hear that it's nonsense, and come home, and sleep."],
    { set: { metChristiana: true, knowsStranger: true } },
  ],
  again: [['christiana', "Go on, then, if you're going to hear him. The stubble field, past the Field Gate. I'll keep your supper."]],
  parting: [
    ['christiana', 'You went.'],
    ['you', 'I went.'],
    ['christiana', 'And?'],
    ['you', "There's a gate. Past the marsh, under a light. He says whoever keeps it is glad to open it — and that this comes off, somewhere beyond."],
    ['christiana', "A gate. On an old man's say-so."],
    {
      choice: [
        {
          t: 'Come with me. All of you. Today.',
          set: { christianaParting: 'tender' },
          then: [
            ['christiana', 'Across the Slough, with four children, and the tally due Friday? On a rumour?'],
            ['christiana', "Ask me again when you can tell me it's real. I mean that. Ask me again."],
          ],
          go: 'bread',
        },
        {
          t: "I have to go. I'll send word the moment I know it's true.",
          set: { christianaParting: 'tender' },
          then: [['christiana', "You'd better. Don't you dare just vanish into a story and leave me to explain you to them."]],
          go: 'bread',
        },
        {
          t: 'Stay, then. Stay and chalk your marks till the wall comes down on you.',
          set: { christianaParting: 'angry' },
          then: [
            ['christiana', '…'],
            ['christiana', "That's what that weight has done. It's made you cruel, and you've called it truth."],
            ['dream', 'And she went in, and shut the door; and the pilgrim stood in the lane with the words still in the air.'],
          ],
        },
      ],
    },
  ],
  bread: [
    ['christiana', "Here. It's yesterday's loaf. I'm not blessing this. I'm just not having you go hungry."],
    ['thought', 'She does not say goodbye. She stands in the doorway with her arms folded, and she is still standing there when you look back from the corner.'],
  ],
  after: [
    {
      when: (f) => f.christianaParting === 'angry',
      then: [
        ['thought', 'The door is shut. What you said is still on your side of it.'],
        {
          choice: [
            {
              t: '(Knock.) "That was the weight talking. And it was still me who said it. I\'m sorry."',
              set: { christianaParting: 'mended' },
              then: [
                ['thought', 'A long quiet. Then the latch.'],
                ['christiana', '…It was. Both.'],
                ['christiana', "I can't walk into a bog on a rumour. But I'd rather you went loved than went right. Take the loaf. Write to me."],
              ],
            },
            { t: '(Leave it. Go.)', then: [['thought', 'You cannot make your hand do it. You turn toward the Field Gate with one more thing on your back.']] },
          ],
        },
      ],
      else: [['christiana', 'Go, before I think of another reason. And write. You promised.']],
    },
  ],
};

export const HESTER: Script = {
  start: [{ when: (f) => !f.hesterTalked, then: [{ go: 'first' }], else: [{ when: (f) => f.slipFound && !f.slip, then: [{ go: 'slip' }], else: [{ go: 'again' }] }] }],
  first: [
    ['hester', "If you're after bread, it's a ha'penny more than yesterday. Don't look at me. Look at the Tally-House."],
    ['you', 'You look done in, Hester.'],
    ['hester', "I've been up since the second bell doing two people's kneading. Joss left. My brother. Put a pedlar's pack on at dawn and went out of the Field Gate like a man going to market."],
    {
      choice: [
        {
          t: 'Where was he going?',
          then: [['hester', "To find a gate. Some stranger in the stubble told him there's a way out from under all this — (she slaps the dough) — and my clever brother believed him. He'll be in the Slough by now. Everyone who goes ends in the Slough."]],
        },
        {
          t: 'Why would he leave you with all this?',
          then: [['hester', "Because he couldn't breathe. He said that. 'Hes, I can't breathe here.' As if I can."]],
        },
      ],
    },
    ['hester', "We owe Vane forty marks on the oven. With Joss, that was three years' work. Without him I don't know what it is."],
    {
      choice: [
        {
          t: 'If I see him on the road, what should I tell him?',
          set: { jossMessage: true },
          then: [['hester', "Tell him — tell him the oven's still lit. That's all. He'll know."]],
        },
        { t: "I'm sorry, Hester.", then: [['hester', "Sorry's a ha'penny more than yesterday, too. (But she pushes a heel of bread across the board.)"]] },
      ],
    },
    { set: { hesterTalked: true, knowsJoss: true, knowsStranger: true } },
    { when: (f) => f.slipFound && !f.slip, then: [{ go: 'slip' }] },
  ],
  slip: [
    ['you', "Hester. This was under the cart behind your shop. It has Vane's seal."],
    ['hester', '(She reads it. The colour goes out of her face.) Forty. Called in full. He waited till Joss was gone.'],
    ['you', "Pip was carrying it. If it isn't delivered, he's chalked a liar."],
    {
      choice: [
        { t: 'What will you do?' },
        { t: "I could lose it again. Somewhere it won't be found.", then: [['hester', "And the boy takes the chalk for it? No. I'm not buying myself a week with a child."]] },
      ],
    },
    ['hester', "(A long breath.) Then it gets delivered. By me. With the boy beside me and half Baker's Lane behind me, at the noon bell, when the square is full."],
    ['hester', 'Let him call in forty marks on an oven to my face, where people can hear what that sounds like.'],
    { set: { slip: 'hester' } },
    ['thought', 'It may not save the oven. But she will not be alone when it is said, and neither will the boy.'],
    { run: (g) => g.story.sync() },
  ],
  again: [
    {
      when: (f) => f.slip === 'hester',
      then: [['hester', "Noon bell. Me, the boy, and half the lane. You've done your part. Go on, if you're going."]],
      else: [
        {
          when: (f) => f.slip === 'pip',
          then: [['hester', "Vane's called the forty. The runner came an hour since — poor mite couldn't look at me. I've till Friday. (She goes on kneading. There is nothing else to do with her hands.)"]],
          else: [
            {
              when: (f) => f.slip === 'vane',
              then: [
                {
                  when: (f) => !f.hesterOwned,
                  then: [
                    ['hester', "They've chalked the oven. Vane's man came with the seal."],
                    ['hester', "Somebody told me who carried the slip in. I said they'd got it wrong. (She looks at you for a long moment.) Have they got it wrong?"],
                    {
                      choice: [
                        {
                          t: "No. It was me. I'm sorry, Hester.",
                          set: { hesterOwned: true },
                          then: [['hester', "…Sorry. (She nods slowly.) Well. That's more than Vane ever said. It doesn't light the oven."]],
                        },
                        { t: '(Say nothing.)', then: [['hester', 'No. I thought not.']] },
                      ],
                    },
                  ],
                  else: [['hester', "You said it to my face. I'll give you that. I've nothing else to give you today."]],
                },
              ],
              else: [['hester', "If you see Joss on that road — the oven's still lit. That's all."]],
            },
          ],
        },
      ],
    },
  ],
};

export const PIP: Script = {
  start: [
    {
      when: (f) => !!f.slip,
      then: [{ go: 'done' }],
      else: [
        {
          when: (f) => f.slipFound,
          then: [{ go: 'give' }],
          else: [{ when: (f) => f.pipAsked, then: [['pip', "Did you find it? By the cart behind Hester's. I looked twice."]], else: [{ go: 'first' }] }],
        },
      ],
    },
  ],
  first: [
    ['pip', "Don't. I'm not crying. It's the ash."],
    { choice: [{ t: "What's happened?" }, { t: "All right. It's the ash.", then: [['pip', "…It's not the ash."]] }] },
    ['pip', "I had a slip to run to the Tally-House. Master Vane's own seal. I had it in my hand at the bakery corner, and then the ground did its shake, and I ran, and now I haven't got it."],
    ['pip', "A runner who loses a slip gets chalked a liar. Liars don't get run-work. My mam needs the run-work."],
    {
      choice: [
        { t: 'Where did you last have it?', then: [['pip', "By the cart behind Hester's. I looked. I looked twice."]] },
        { t: "I'll keep an eye out.", then: [['pip', "Everyone says that. (He sniffs.) By the cart behind Hester's, if you mean it."]] },
      ],
    },
    { set: { pipAsked: true } },
  ],
  give: [
    ['you', 'Pip. Is this it?'],
    ['pip', "That's it! That's the seal! Oh — give it here, I can still make the bell —"],
    ['you', "It's Hester's. He's calling in the whole debt on her oven."],
    ['pip', "I don't read them. I just run them. …Is it bad?"],
    {
      choice: [
        {
          t: "It's bad. But it isn't yours to carry. Here.",
          set: { slip: 'pip' },
          then: [
            ['pip', "(He takes it in both hands.) I'll run it slow. That's all I can do. I'll run it slow."],
            ['thought', 'He goes. The slip will arrive. The city will do what it does.'],
            { run: (g) => g.story.sync() },
          ],
        },
        {
          t: 'Come with me. Hester should see this before Vane does.',
          then: [
            ['pip', "I'll get chalked."],
            ['you', 'Not if she walks in with you.'],
            ['thought', 'He weighs it. Then he gets up and wipes his face on his sleeve. (Take the slip to Hester.)'],
          ],
        },
        { t: 'Not yet. Let me think.' },
      ],
    },
  ],
  done: [
    {
      when: (f) => f.slip === 'pip',
      then: [['pip', "I ran it. Slow as I could. (He doesn't look at the bakery.)"]],
      else: [
        {
          when: (f) => f.slip === 'hester',
          then: [['pip', "She says I'm to stand next to her and not say anything and look small. I can look small."]],
          else: [
            ['pip', 'You gave it to him. For a mark. (He looks at you the way children look at a thing they are learning about the world.)'],
            {
              choice: [
                {
                  t: "I did. It was wrong, Pip. I'm sorry you saw it, and sorrier I did it.",
                  if: (f) => !f.pipOwned,
                  set: { pipOwned: true },
                  then: [["pip", "…Grown-ups don't say that. (He scuffs the ground.) You still did it."]],
                },
                { t: '(Say nothing.)' },
              ],
            },
          ],
        },
      ],
    },
  ],
};

export const VANE: Script = {
  start: [{ when: (f) => !f.vaneTalked, then: [{ go: 'first' }], else: [{ go: 'again' }] }],
  first: [
    ['vane', 'Stand where I can see your name. …Ah. Yes. Low. Lower than last quarter.'],
    {
      choice: [
        { t: 'What would raise it?', then: [['vane', 'Work. Thrift. A timely word about a neighbour who is hiding stock. The board is very fair. It only ever asks for more.']] },
        {
          t: 'Who decided a board gets to say what we are?',
          then: [['vane', 'Nobody decided. It was here when my father kept it, and his before him. A city must know who is worth what. How else would we know whom to feed?']],
        },
        {
          t: 'Your own name is at the top. Does that help?',
          then: [
            ['vane', '(A pause, as of a man finding a stair missing.) I have been first on that board for nineteen years. I look at it every morning before I can eat.'],
            ['vane', 'That is not a thing I say. Good day.'],
          ],
        },
      ],
    },
    { set: { vaneTalked: true } },
    { go: 'slipq' },
  ],
  again: [
    {
      when: (f) => f.slip === 'vane',
      then: [['vane', 'The oven has been chalked. You need not look so. You did a correct thing; I never said it was a pleasant one.']],
      else: [
        {
          when: (f) => f.slip === 'hester',
          then: [['vane', 'The baker means to bring the lane with her at noon, I hear. (He adjusts his cuffs. His hands are not quite steady.) It is irregular.']],
          else: [['vane', 'The board does not change by being looked at. I have tried.']],
        },
      ],
    },
    { go: 'slipq' },
  ],
  slipq: [
    {
      when: (f) => f.slipFound && !f.slip,
      then: [
        {
          choice: [
            {
              t: 'I found this. It carries your seal.',
              set: { slip: 'vane' },
              then: [
                ['vane', 'Ah. The boy lost it. (He reads it as if he had not written it.) Honest of you. Honesty is rare, and I mark it.'],
                ['dream', "And he took the chalk, and set a stroke beside the pilgrim's name."],
                ['vane', 'There. You will feel that.'],
                ['thought', 'You do feel it. For about a breath. Then the weight settles back exactly where it was — and behind you, by the well, a small boy has stopped crying to watch.'],
                { run: (g) => g.story.sync() },
              ],
            },
            { t: '(Keep the slip in your coat.)' },
          ],
        },
      ],
    },
  ],
};

export const WELL: Script = {
  start: [{ when: (f) => !f.wellTalked, then: [{ go: 'first' }], else: [['obstinate', "Still here? Good. Stay here. There's a wall wants holding up."], ['pliable', '(Behind his back, Pliable mouths: tell me if you go.)']] }],
  first: [
    ['obstinate', 'Look at the state of you. Bent like a hod-carrier with nothing in the hod.'],
    ['pliable', "Leave off, Ob. — Is it true you've been reading that book? The one that says there's somewhere else?"],
    {
      choice: [
        {
          t: "It says the city won't stand.",
          then: [["obstinate", "I built the north wall. My father's mortared into the footings; he fell off it. It stands because people like me get up and make it stand. Not because people like you read."]],
        },
        {
          t: 'It says there is a country where none of this is owed.',
          then: [
            ['pliable', 'None of it? No tally?'],
            ['obstinate', "Somebody's always keeping a tally, lad. At least ours is up where you can see it."],
          ],
        },
      ],
    },
    ['pliable', 'If you ever do go… would you say? Before?'],
    ['obstinate', "Nobody's going anywhere. They get as far as the Slough and come home green to the knees."],
    { set: { wellTalked: true } },
  ],
};

export const AMBIENT: Record<string, string[]> = {
  porter: [
    "Mind your back — ha. Sorry. Didn't mean yours.",
    "Third load before noon. Third mark. Doesn't feel like three.",
    "My knees say stop. The board says don't. The board's louder.",
  ],
  chalker: [
    "You have to chalk your own step fresh each morning, or they say you've let yourself go.",
    'My neighbour chalks hers twice. Twice! Showing off.',
    "If it rains, we all start again. I used to like rain.",
  ],
  oldman: [
    "I watched that wall go up when I was a boy. They said it'd be finished in my lifetime. (He laughs.) It's been finished four times.",
    "The stranger in the stubble? I listened. I said I'm too old to carry anything to a gate. He said that wasn't how it worked. I didn't follow him.",
    "Go on, if you're going. Somebody ought to find out.",
  ],
};

export const EVANGELIST: Script = {
  start: [
    { when: (f) => f.metEvangelist, then: [['evangelist', "Keep the light in your eye. And shout if you sink — you won't be the first, whatever the marsh tells you."]], else: [{ go: 'first' }] },
  ],
  first: [
    ['evangelist', "You're the one who reads on the doorstep before light. I've passed your lane three mornings. What is in that book, that it bends you so?"],
    {
      choice: [
        {
          t: "That the city is coming down. And that I helped build what's wrong with it.",
          then: [['evangelist', 'Both true. It will not be mended by another course of stone — though the one who made this place has not given it up. Mind that.']],
        },
        {
          t: 'That I owe more than the board has room for.',
          then: [['evangelist', "The board is a small liar. But yes: there is a debt, and it isn't in marks."]],
        },
        {
          t: "I don't know that it's the book. I've carried this as long as I can remember.",
          then: [['evangelist', 'Most have. The book only turns the lamp up on it.']],
        },
      ],
    },
    ['you', "Then what do I do? I've tried working it off. I've tried not looking at it."],
    ['evangelist', 'If that is your condition, why are you standing still?'],
    ['you', "Because I don't know where to go."],
    ['evangelist', '(He points with his staff, out over the plain.) Past the marsh. Do you see a little gate?'],
    ['you', '…No.'],
    ['evangelist', 'Do you see a light?'],
    ['you', 'I think I do.'],
    ['evangelist', "Keep that light in your eye, and go straight up to it, and knock. You'll be told what to — no. You'll be let in. That's the truer way to say it."],
    { run: (g) => g.story.showLight() },
    { go: 'ask' },
  ],
  ask: [
    {
      choice: [
        { t: 'What does it cost?', once: true, then: [['evangelist', "Everything it cost has been paid by someone else. You'll see where."]], go: 'ask' },
        {
          t: 'My family —',
          once: true,
          then: [['evangelist', "Tell them. Ask them. Some come at once; some come after; the gate is kept for both. Don't make your going a verdict on their staying."]],
          go: 'ask',
        },
        { t: 'And if the gate is shut to someone like me?', once: true, then: [['evangelist', "It isn't that kind of gate."]], go: 'ask' },
        { t: "I'll go.", go: 'send' },
      ],
    },
  ],
  send: [
    ['evangelist', 'Take this. Read it when your back says you were a fool to start.'],
    { run: (g) => g.ui.read('A parchment roll', '<p><i>Come unto me, all ye that labour and are heavy laden, and I will give you rest.</i></p>') },
    ['evangelist', "One thing more. Between here and the light there is bad ground — the Slough. People go into it believing they're the only one who ever has. They are not. Shout, if you sink."],
    { set: { metEvangelist: true } },
  ],
};

export function tallyHtml(f: Flags) {
  const rows: [string, string, boolean?][] = [
    ['Vane, Reckoner', '||||| ||||| ||||| |||'],
    ['Crook, tanner', '||||| ||||| ||||'],
    ['Obstinate, mason', '||||| ||||| |'],
    ['Ledger, widow', '||||| ||||'],
    ['Hester, baker', f.slip === 'vane' ? '— oven called in —' : '||||| |'],
    ["Joss, baker's man", '— struck off: absent —'],
    ['Pliable', '|||'],
    ['(your name)', f.slip === 'vane' ? '|||' : '||', true],
    ['Pip, runner', '|'],
  ];
  const body = rows.map(([n, m, mine]) => `<span class="${mine ? 'mine' : ''}">${n.padEnd(22, ' ')}${m}</span>`).join('\n');
  return `<div class="tally">${body}</div><p><i>Everyone you know, in a column. Your own name is near the bottom, where it has always been.${f.slip === 'vane' ? ' The newest stroke beside it is still white.' : ''}</i></p>`;
}

export const SLIP_HTML =
  '<p><b>BY ORDER OF THE RECKONER</b></p><p>HESTER, baker, of Baker\'s Lane — oven and premises —<br/>FORTY MARKS, <u>called in full</u>, payable Friday.</p><p>— Vane (his seal)</p><p><i>Called in. She does not know yet.</i></p>';
