import type { Script, Flags, Step } from '../game/dialogue';

// Scripture is quoted from the King James Version (public domain).

export const KNOCK: Script = {
  start: [
    ['thought', 'Over the gate, cut in the stone: KNOCK, AND IT SHALL BE OPENED UNTO YOU.'],
    ['goodwill', "(From within.) Who's there? Where have you come from, and what do you want?"],
    {
      choice: [
        {
          t: "From the City of Destruction. I'm told there's a way in here. I have nothing to pay with.",
          set: { gateAnswer: 'nothing' },
          then: [['goodwill', "Nothing to pay with. Good — there's nothing to pay."]],
        },
        {
          t: 'Someone with a great deal on their back and mud to the neck. Is this the right door?',
          set: { gateAnswer: 'mud' },
          then: [['goodwill', "It's the only door. And you're exactly the sort it was cut for."]],
        },
        { t: "Please — they're shooting —", set: { gateAnswer: 'please' }, then: [['goodwill', 'They always are. In with you!']] },
      ],
    },
  ],
};

export const GOODWILL: Script = {
  start: [
    ['goodwill', "There. That tower has a captain in it who can't abide anyone getting this far. He can't stop the gate from opening. So he tries to make you believe it won't."],
    ['you', "You pulled me in before I'd finished asking."],
    ['goodwill', "I am willing with all my heart. That's the whole of my work, and near enough my name. Goodwill."],
    { go: 'ask' },
  ],
  ask: [
    {
      choice: [
        {
          t: "Don't you need to know what I've done first?",
          once: true,
          then: [['goodwill', "I'll hear it gladly, if you want to tell it. It won't change which side of the gate you're standing on."]],
          go: 'ask',
        },
        {
          t: 'Whose gate is this?',
          once: true,
          then: [
            ['goodwill', "It belongs to the Lord of the hill — Jesus, the Christ. You'll see his hill within the hour. He said: 'I am the door: by me if any man enter in, he shall be saved.'"],
            ['goodwill', "So you didn't get in by knocking well. You got in because of him."],
          ],
          go: 'ask',
        },
        {
          t: 'Am I… in? Is that all?',
          once: true,
          then: [['goodwill', "You're in. You are his now, and this is home ground from here on, whatever the road looks like. That's all, and it's everything."]],
          go: 'ask',
        },
        { t: "But I've still got this on my back.", go: 'burden' },
      ],
    },
  ],
  burden: [
    ['goodwill', "You have. I can't lift it off, and I'd be lying if I told you how to stop feeling it."],
    ['goodwill', 'Be content to bear it until you come to the place of deliverance. There it will fall from your back of itself.'],
    ['goodwill', "Only hear me: you are not on trial between here and there. Nobody's let you in on approval. You were received at the door, for his sake. The hill is where you'll see why."],
    {
      choice: [
        { t: "And if I'd come later? Or worse?", then: [['goodwill', 'Same door. Same answer.']] },
        { t: 'Thank you.', then: [['goodwill', 'Thank him. Eat something first.']] },
      ],
    },
    ['goodwill', "Sit. There's bread on the table, and the well is sweet. Then it's straight up between the two walls; you can't miss it."],
    ['goodwill', "The Interpreter keeps the house by the road. He's out among the hill-farms today, more's the pity. He'd have shown you things. Another time."],
  ],
};

export const GOODWILL_AFTER = [
  "Straight up between the walls. And don't run at it as though it were an exam.",
  "Eat. Nobody here is counting what you've had.",
  'I watch every one of you go up that road. I have never yet got tired of it.',
];

export const INTERPRETER_HTML =
  '<p style="text-align:center"><b>THE INTERPRETER</b></p><p>Gone to the hill-farms. Back by lamp-lighting.</p><p>The door is on the latch for those who can wait.<br/>For those who cannot: the hill is that way. ↑</p><p><i>(His house is closed in this first build of the game.)</i></p>';

export const GARDEN_REST: Script = {
  start: [
    ['thought', 'You sit. The bench takes the weight of the thing on your back, and for the first time today you are not the one holding it up.'],
    ['thought', 'The bread is warm. You had forgotten bread could be warm. Nobody asks what you did to earn it.'],
    ['goodwill', '(Passing with a pail.) Stay as long as you like. The hill keeps.'],
  ],
};

export const WAY_LINES: [number, 'dream' | 'thought', string][] = [
  [344, 'dream', 'Now I saw in my dream that the highway was fenced on either side with a wall, and that wall was called Salvation.'],
  [362, 'dream', 'Up this way did the burdened pilgrim go — but not without great difficulty, because of the load upon their back.'],
  [380, 'thought', 'The straps creak. Something in them is working loose, and it is not you doing it.'],
];

export const CROSS_ARRIVE: Script = {
  start: [
    ['dream', 'So the pilgrim came at last to a place somewhat ascending; and upon that place stood a Cross, and a little below, in the bottom, a Sepulchre.'],
    ['thought', 'You look for the thing you are supposed to do here. A price. A form of words. There is nothing to do.'],
    ['thought', 'Someone has already been here. Someone has already done it.'],
  ],
};

export const CROSS_FALL_1 = 'So I saw in my dream, that just as the pilgrim came up with the Cross, the burden loosed from off their shoulders, and fell from off their back, and began to tumble —';
export const CROSS_FALL_2 = '— and so continued to do, till it came to the mouth of the Sepulchre, where it fell in, and I saw it no more.';

export const CROSS_AFTER: Script = {
  start: [
    ['thought', 'You are standing up straight. You had forgotten how tall you are.'],
    ['thought', 'You laugh. Then you find you are crying, and it turns out to be the same thing.'],
    ['dream', 'Then was the pilgrim glad and lightsome, and stood still awhile to look and wonder; for it was very surprising that the sight of the Cross should thus ease them of their burden.'],
    { run: (g) => g.story.shiningArrive() },
    ['dream', 'Now as they stood looking and weeping, behold, three Shining Ones came and saluted them.'],
    ['shining1', 'Peace be to thee. Thy sins be forgiven thee.'],
    { go: 'ask' },
  ],
  ask: [
    {
      choice: [
        {
          t: "I didn't do anything. It just fell.",
          once: true,
          then: [
            ['shining1', 'You did nothing. He did it.'],
            ['shining1', "On that wood he took the worst that we do to one another, and to him — and he answered it with 'Father, forgive them.' That is what God is like. It is what God has always been like."],
            ['shining1', 'He was making peace there: between you and God, and between you and everyone you have wronged or been wronged by. The second part you will have to walk out. The first is finished.'],
          ],
          go: 'ask',
        },
        {
          t: 'Whose was it? Where has it gone?',
          once: true,
          then: [
            ['shining1', 'It was yours, and he made it his. He carried it down into death; and when he came up out of that grave, he did not bring it with him.'],
            ['shining1', 'Look for it there, if you like. You will not find it.'],
          ],
          go: 'ask',
        },
        {
          t: 'What if I have earned it back by tomorrow?',
          once: true,
          then: [
            ['shining2', 'You will stumble tomorrow. You may hurt someone, and have to go and put it right, and that will cost you something.'],
            ['shining2', 'But that load was not lent back to you on conditions. It is in the grave, and the grave is empty, and he is alive. It cannot be handed back.'],
          ],
          go: 'ask',
        },
        { t: '(Say nothing more. Stand here.)', go: 'gifts' },
      ],
    },
  ],
  gifts: [
    { run: (g) => g.story.newGarment() },
    ['shining2', "Those rags were a debtor's coat. Wear this instead."],
    ['shining2', 'It is not a uniform you must keep clean to stay in the household. It is how the household sees you. It was given; it is yours.'],
    ['shining3', 'And here is a roll with a seal upon it. Read it as you go — especially when the old feeling comes back. For it will come back, long after the fact of it is gone.'],
    ['shining3', "Give it in at the Celestial Gate, if you like; they will smile at it. It is for your comfort, not for your admission."],
    ['shining3', 'He is ahead of you on this road, and beside you on it. You will learn his voice.'],
    ['dream', 'Then the pilgrim gave three leaps for joy, and went on singing.'],
  ],
};

export const TOMB: Script = {
  start: [
    ['dream', 'The stone was rolled away. Within: a ledge, and linen folded where a body had lain, and the morning coming in at the door. No burden. No body, either.'],
    ['shining3', 'Why seek ye the living among the dead? He is not here, but is risen.'],
    {
      choice: [
        {
          t: 'My burden went in there.',
          then: [['shining3', 'And did not come out. He did.']],
        },
        {
          t: "Then death isn't the end of anyone.",
          then: [['shining3', 'It was not the end of him. And he does not mean to keep that to himself.']],
        },
      ],
    },
    ['shining3', 'Not from you. Not from the city you left, nor the ones still in it, nor the ground under it. All that is broken, he means to mend. This is the first of it.'],
    ['thought', 'You think of the cracked wall. Of Christiana in the doorway. For the first time the thought of them does not arrive with a weight attached. It arrives with a hope.'],
  ],
};

export const ROLL_PEACE = '<p><i>Peace I leave with you, my peace I give unto you: not as the world giveth, give I unto you. Let not your heart be troubled, neither let it be afraid.</i></p>';
export const ROLL_ACCUSED = '<p><i>There is therefore now no condemnation to them which are in Christ Jesus.</i></p><p><i>Who shall lay any thing to the charge of God\'s elect? It is God that justifieth.</i></p>';

/** The Accuser quotes the player's own journey back at them. All of it is true. None of it is the verdict. */
export function accuserScript(f: Flags): Script {
  const charges: Step[] = [];
  if (f.christianaParting === 'angry') charges.push(['accuser', 'You told your wife to stay and be buried. Those are the last words she had from you.']);
  else charges.push(['accuser', 'You left a wife and four children in a city you believe is falling. Walked out of the gate and called it faith.']);
  if (f.slip === 'vane') charges.push(['accuser', "You sold a baker's oven for a stroke of chalk. A child watched you do it."]);
  if (f.pliableParting === 'bitter') charges.push(['accuser', 'You sneered at a frightened boy in a bog.']);
  if (f.detourDone) charges.push(['accuser', 'Scarcely out of the mire, and you were off down the first easy road that was offered you.']);
  if (f.helpRefused) charges.push(['accuser', 'Too proud to shout. You would sooner have drowned than be seen.']);
  return {
    start: [
      ['accuser', 'Lightsome, are we? Leaping? I have your account here.'],
      ...charges,
      ['accuser', 'And you think that falls off? At the sight of a tree?'],
      { run: (g) => g.story.shadowFalls() },
      ['thought', 'And there it is on your back again. The shape of it. The exact old shape.'],
      {
        choice: [
          {
            t: "That isn't all of it. I tried. You're leaving out everything I tried.",
            set: { accuserReply: 'defend' },
            then: [['accuser', 'Oh, let us weigh it, then. I have scales. I am very fair. I only ever ask for more.']],
          },
          {
            t: "…It's true. I did those things.",
            set: { accuserReply: 'agree' },
            then: [['accuser', 'Then be honest about what you are, and turn round. They will have found the mistake at the gate by now.']],
          },
          {
            t: '(Open the roll.)',
            set: { accuserReply: 'roll' },
            then: [
              { run: (g) => g.ui.read('The sealed roll', ROLL_ACCUSED) },
              ['accuser', 'Ink. Feel your back, and then tell me about ink.'],
            ],
          },
        ],
      },
      ['thought', 'Nothing you say moves him. He is not here to be answered.'],
      ['thought', 'The road behind him is a wall of thorn and shadow. On your back, the old weight — or the shape of it.'],
    ],
  };
}

export const ACCUSER_PASSED: Script = {
  start: [
    ['accuser', 'You will feel me again! Every time you fail, you will feel me!'],
    ['you', 'I expect I shall.'],
    ['thought', 'You keep walking. Feeling condemned, and being condemned: you had always taken them for one thing.'],
  ],
};

export const PRAYER: Script = {
  start: [
    ['thought', 'You have never prayed without bargaining. You are not sure how it starts without an offer.'],
    { go: 'pray' },
  ],
  pray: [
    {
      choice: [
        {
          t: '"Thank you. I haven\'t a better word. Thank you."',
          once: true,
          then: [['thought', 'It is a strange thing, to give thanks and not hear the bill arriving behind it.']],
          go: 'pray',
        },
        {
          t: '"I\'m afraid for them. Christiana, the children. I am not at peace about it, and I won\'t pretend I am."',
          once: true,
          then: [['thought', 'Nothing answers in words. But the fear, said aloud to someone, is a different size from the fear kept.']],
          go: 'pray',
        },
        {
          t: '(Say nothing. Listen.)',
          once: true,
          then: [['thought', 'Water over stone. Wind in the grass. And under them, steady, the sense of being accompanied. You stay with it a while.']],
          go: 'pray',
        },
        { t: '(Rise.)', go: 'rise' },
      ],
    },
  ],
  rise: [
    { when: (f) => !f.lettersDone, then: [['thought', 'You get up with something to do. There is a carrier by the milestone, and people at home who should hear from you.']], else: [['thought', 'You get up lighter than you sat down, and the road is still there.']] },
    { set: { prayed: true } },
  ],
};

export const CARRIER: Script = {
  start: [{ when: (f) => f.lettersDone, then: [['carrier', "They're in the bag, and the bag's on the cart. Go well, pilgrim."]], else: [{ go: 'first' }] }],
  first: [
    ['carrier', "Morning! You've the look of someone fresh off the hill. I can always tell: they walk like they've just set down an anvil."],
    ['carrier', "Tam. I carry letters back along the King's road — the Gate, the marsh, even the City, when they'll take them in at the Field Gate. Anyone you want word sent to?"],
    { go: 'letters' },
  ],
  letters: [
    {
      choice: [
        {
          t: 'To Christiana.',
          once: true,
          then: [
            {
              when: (f) => f.christianaParting === 'angry',
              then: [
                {
                  choice: [
                    {
                      t: '"I said a cruel thing at the door, and it was a lie. I am sorry. The gate is real. Come when you can — or send, and I will come back for you."',
                      set: { letterChristiana: 'sorry' },
                      then: [['carrier', "(He reads none of it, but he sees your face.) That one'll go on top."]],
                    },
                    {
                      t: '"The gate is real. The weight is gone. Come when you can."',
                      set: { letterChristiana: 'plain' },
                      then: [['thought', 'You leave the door out of it. The carrier folds the page without comment.']],
                    },
                  ],
                },
              ],
              else: [
                ['you', '"It\'s real. The gate opened before I\'d finished asking. The weight is gone — I can\'t explain it yet; I\'ll try. Come when you can. Bring the children. There is bread here."'],
                { set: { letterChristiana: 'glad' } },
              ],
            },
          ],
          go: 'letters',
        },
        {
          t: 'To Hester, the baker.',
          once: true,
          then: [
            {
              when: (f) => f.slip === 'vane',
              then: [
                {
                  choice: [
                    {
                      t: '"It was I who carried Vane\'s slip in, for a chalk mark. I was wrong. Here is every coin I have toward the forty; I will send more. Joss is alive."',
                      set: { letterHester: 'restitution' },
                      then: [
                        ['carrier', "(He weighs the purse in his hand, and then looks at you rather than at it.) That's a harder letter than most people send from this stone."],
                        ['you', "I couldn't have written it yesterday. I'd have been too afraid of what it made me."],
                        ['carrier', 'And today?'],
                        ['you', "Today it's a thing I did. And have to put right."],
                      ],
                    },
                    {
                      t: '"Joss is alive, and safe with Help at the marsh." (Say nothing of the slip.)',
                      set: { letterHester: 'silent' },
                      then: [['thought', 'It is true, every word. It is not all of the truth, and you know which part you left on the stone. It will keep. It will not go away.']],
                    },
                  ],
                },
              ],
              else: [
                {
                  when: (f) => f.jossPromise === 'tell',
                  then: [['you', '"Joss is alive. He went into the Slough and stood there four hours too proud to shout — and so did I. He\'s at Help\'s hut with a twisted ankle and a full plate. I told him the oven was still lit. He laughed."']],
                  else: [['you', '"Joss is alive and safe, at Help\'s hut by the marsh. He will tell you the rest himself — standing up, he says."']],
                },
                { set: { letterHester: 'news' } },
              ],
            },
          ],
          go: 'letters',
        },
        {
          t: 'To Pliable.',
          once: true,
          if: (f) => f.pliableParting === 'bitter',
          then: [
            ['you', '"I was sharp with you in the marsh, and you had every right to be frightened. I was frightened too. If you ever want to try again, there are steps — and a man called Help. Ask for him."'],
            { set: { letterPliable: true } },
          ],
          go: 'letters',
        },
        { t: "That's all. Thank you, Tam.", go: 'bye' },
      ],
    },
  ],
  bye: [
    { set: { lettersDone: true } },
    ['carrier', "They'll go tonight. Now: the road drops from here to the foot of a hill they call Difficulty. It's well named. But there's a house past the top — Palace Beautiful — and they keep a table."],
    ['carrier', "Go well. You'll not walk it alone, whatever it looks like."],
  ],
};
