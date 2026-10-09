import type { Script } from '../game/dialogue';

// Said once the chase is over: out past the milestone, everyone out of breath.
export const LEAVE: Script = {
  start: [
    {
      when: (f) => (f.chaseGrabs || 0) >= 3,
      then: [['obstinate', "(Bent double.) Three times I've had hold of you, and three times you've pulled loose. I'll not break your arm to save your neck."]],
    },
    ['obstinate', "(Hands on his knees, panting.) Your wife's standing in the lane looking at the gate. Come back. Whatever the old man sold you, come back, and I'll say nothing, and nobody'll chalk it."],
    {
      choice: [
        {
          t: 'Come with me instead. Both of you.',
          then: [['obstinate', 'And leave the wall? Leave everyone under it? You call that conscience. I call it running.']],
        },
        {
          t: "I can't, Ob. I can't carry this another year.",
          then: [['obstinate', "Everyone carries something! You think you're special because yours shows?"]],
        },
      ],
    },
    ['you', "I think there's someone who takes it. That's all I've got."],
    ['pliable', 'Ob… what if there is?'],
    ['pliable', "I'm only going to look. I'll walk as far as the marsh. If it's nothing, I'll be home for supper."],
    ['obstinate', "(Lower, to you.) When it goes wrong — the Field Gate doesn't lock. I'll see to that."],
  ],
};

/** Shouted during the chase out of the city. */
export const CHASE_BARKS: [string, string][] = [
  ['obstinate', "Stop! You'll not get past the marsh!"],
  ['pliable', 'Wait! Just wait — tell me what he said!'],
  ['obstinate', 'Come back, you fool! Think of the children!'],
  ['obstinate', "I'm not chasing you all the way to the Slough!"],
];
export const GRAB_BARKS: [string, string][] = [
  ['obstinate', 'Got you. Home. Now.'],
  ['obstinate', "Don't make me carry you back!"],
  ['obstinate', "Hold still, will you? It's for your own good!"],
];

export const PLIABLE_BARKS = [
  "So what's there, exactly? At the end? Go on.",
  'Crowns, I heard. Somebody said crowns.',
  "You're slow with that thing on. No offence.",
  "Do you think they'd let Ob in? He'd argue with the gatepost.",
  "It's quiet out here. I've never been where you couldn't hear the Tally bell.",
];

export const PLIABLE_FALLS: Script = {
  start: [
    ['pliable', "Urgh — it's — I can't feel the bottom —"],
    ['pliable', 'Is THIS it? Is this the road to your shining country? You said —'],
    {
      choice: [
        { t: "I didn't know it was here. I'm sorry — I didn't know.", then: [['pliable', 'If this is how it starts, you can keep the end of it!']] },
        { t: "Keep going! It can't be far across!", then: [['pliable', "You don't know that! You don't know anything, you've just got a book!"]] },
        { t: 'Nobody made you come, Pliable.', then: [['pliable', "No. Nobody did. And nobody's making me stay."]] },
      ],
    },
    ['dream', 'And with that he gave a desperate struggle or two, and got out of the mire on that side of the slough which was next to his own house.'],
    ['pliable', "(From the bank, dripping.) …You're still going? With that on your back? You'll drown, and I'll be the one who has to tell her."],
    {
      choice: [
        { t: "Tell her I'm still walking.", set: { pliableParting: 'kind' }, then: [['pliable', "(He almost says something. Then he doesn't.)"]] },
        { t: "Go home, Pliable. It's all right. Truly.", set: { pliableParting: 'kind' }, then: [['pliable', "Don't be kind about it. It's worse when you're kind."]] },
        { t: 'Go on, then. Run back to the board.', set: { pliableParting: 'bitter' }, then: [['pliable', "At least the board never said it was anything but a board."]] },
      ],
    },
    ['thought', 'He does not look back. You are alone in the marsh, and the marsh knows it.'],
  ],
};

export const WHISPERS = [
  "Look at you. You couldn't keep one friend to the first mile.",
  'Nobody else falls in here. Only you.',
  "Don't call out. If someone came, they would see.",
  'This is what you are under the coat. Mud, all the way through.',
  'Go back. You were never the sort they meant.',
];

export const SUNK = [
  'The mire closes over your knees, your belt. You claw back to the last sound ground.',
  'Down again. Nobody saw. That is somehow worse.',
  'You drag yourself out by the reeds, shaking.',
];

export const BANK: Script = {
  start: [
    ['dream', 'The pilgrim got hands upon the far bank; and the weight took them off it again, as it always had.'],
    {
      choice: [
        {
          t: '(Try again. Quietly.)',
          set: { helpRefused: true },
          then: [
            ['thought', 'You try again — quietly, so that nobody will know you needed to. The bank does not care how quiet you are.'],
            {
              choice: [
                { t: '(Call out.)', go: 'call' },
                {
                  t: '(Once more. You can do this alone.)',
                  then: [
                    ['thought', 'Your fingers come away full of mud. You are very tired. Above you, on the bank: a pair of boots.'],
                    { run: (g) => g.story.helpArrives() },
                    ['help', "I heard the splashing. I'd have come quicker if you'd shouted."],
                  ],
                  go: 'help',
                },
              ],
            },
          ],
        },
        { t: '(Call out.)', go: 'call' },
      ],
    },
  ],
  call: [
    ['you', "Is anyone there? I can't — I can't get out!"],
    { run: (g) => g.story.helpArrives() },
    ['help', "Here. Here — I've got eyes on you. Stop thrashing."],
    { go: 'help' },
  ],
  help: [
    ['help', 'What are you doing in there?'],
    ['you', "I was told to go this way, to the gate. I didn't look where I was walking."],
    ['help', "There are steps. Good ones; the King's surveyors laid them. Why didn't you look for the steps?"],
    {
      choice: [
        { t: 'I was afraid. I just ran.', then: [['help', "Mm. That's most of us. Fear's a poor surveyor."]] },
        {
          t: "I didn't think there would be steps. Not for someone like me.",
          then: [['help', "Ah. That one. The marsh tells everyone that. It tells each of them they're the only one it has ever told."]],
        },
      ],
    },
    ['help', 'Give me your hand.'],
    {
      choice: [
        { t: '(Take his hand.)' },
        { t: "I'm filthy. I'll pull you in with me.", then: [["help", "I've been pulled in by better and by worse. Hand."]] },
        {
          t: "Just tell me where the steps are. I'll manage.",
          set: { helpRefused: true },
          then: [
            ['help', "They're under you and behind you, and you can't reach either with that on your back. I'm not offering directions. I'm offering a hand."],
            ['thought', 'It is harder than the mire. You put your hand up.'],
          ],
        },
      ],
    },
  ],
};

export const LANDING: Script = {
  start: [
    ['dream', 'Then Help gave the pilgrim his hand, and drew them out, and set them upon sound ground.'],
    ['help', "There. Sit a minute. Nobody's timing you."],
    ['joss', '(Far off, across the water.) — is somebody there? Please —'],
    ['help', "That's the other one. East arm; that's the deep side. He went in before first light. I've had a line on him since, but I can't haul and hold both, and the boardwalk out to him rotted through this winter."],
    ['help', "I'd not ask, with that on your back. I'm asking."],
    {
      choice: [
        { t: 'Tell me what to do.' },
        { t: 'I only just got out myself.', then: [['help', "I know. That's why you'll know what to say to him."]] },
      ],
    },
    ['help', "Three gaps between this bank and him. Three boards lying about — different lengths, so mind which goes where. One at a time; you'll not carry more. I'll keep the line taut."],
  ],
};

/** Said across the bank while the pilgrim is fetching boards, not in a conversation. */
export const HELP_WALK: [string, string][] = [
  ['you', "Why doesn't someone mend this place? People must fall in every week."],
  ['help', "Every day. And it's been mended longer than I've been here: cartloads of good sound teaching, tipped in. It's what drains down to this spot that's the trouble — every fear, every 'I'm not the sort they'd want.' The ground won't hold under it."],
  ['help', "So there are steps. And there's me."],
];

/** If the pilgrim stops to talk to Help while he is holding the line. */
export const HELP_BUSY: Script = {
  start: [
    {
      when: (f) => !f.askedLimp,
      then: [
        ['help', "I've got him. Boards, pilgrim — and mind the lengths."],
        {
          choice: [
            {
              t: "You're limping.",
              set: { askedLimp: true },
              then: [
                ['help', 'Since I was nineteen. I ask about it most mornings. Still asking.'],
                ['help', "Meanwhile there's the rope. Don't make a sermon of it; I don't."],
              ],
            },
            { t: '(Go back to the boards.)' },
          ],
        },
      ],
      else: [['help', "I've got him. Boards, pilgrim — and mind the lengths."]],
    },
  ],
};

export const JOSS_BARKS = [
  "Don't come out here! It's not worth two of us!",
  "I can't feel my feet. Is that bad? That's bad.",
  "Whoever you are — mind the black water. It's the black water that takes you.",
];

export const JOSS: Script = {
  start: [
    ['joss', "I know you. You're from Tanner's Row. Oh, don't look at me."],
    ['you', "Joss. Hester's brother."],
    ['joss', "She'll have told you I ran off. I did. Got this far, and then stood here four hours being too proud to shout."],
    {
      choice: [
        { t: 'I did the same. Just over there.', then: [['joss', '(A cracked laugh.) Did you. Did you really.']] },
        { t: "Nobody's keeping count out here. Take my arm." },
      ],
    },
    ['you', "Help's on the line. On three."],
  ],
};

export const RESCUED: Script = {
  start: [
    ['help', "(He has the boot off and the ankle in both hands.) Twisted, not broken. It'll take your weight in a week. Not today, whatever you tell it."],
    ['joss', 'A week. I meant to be at the gate by now.'],
    ['help', "The gate's not going anywhere. Nor's the welcome. You'll sleep at mine, and you'll eat, and you'll go when the leg says."],
    {
      when: (f) => f.jossMessage,
      then: [
        ['you', "Hester said to tell you: the oven's still lit."],
        ['joss', "(He laughs, and then he doesn't.) She said that? That's what our mother used to say. It means come home whenever. There'll be bread."],
      ],
    },
    {
      when: (f) => f.slip === 'vane',
      then: [
        ['joss', "At least the oven's safe till the quarter. Vane gave his word on that."],
        ['thought', 'You say nothing. The new chalk stroke beside your name sits on you like a brand.'],
      ],
    },
    ['joss', "If you send word back — don't tell her I had to be fished out."],
    {
      choice: [
        {
          t: "She'd rather know you're alive than know you're proud.",
          set: { jossPromise: 'tell' },
          then: [['joss', '…Yes. She would. Tell her, then. Tell her I looked a right fool.']],
        },
        { t: "It's yours to tell. I won't.", set: { jossPromise: 'keep' }, then: [['joss', "Thanks. I will tell her. I'd just like to do it standing up."]] },
      ],
    },
    ['help', "Road goes north off this bank. You'll come to a fork. Keep to the one that looks like less."],
    ['help', "And, pilgrim: you did well out there. I mean that as a fact. It isn't wages."],
  ],
};

export const HELP_AFTER = [
  "Go on. He's in good hands — well, he's in mine.",
  "North, and keep to the road that looks like less.",
];
export const JOSS_AFTER = [
  "I'll come on after you. A week, he says. I'll hop it in five days.",
  'When you get to the gate — tell them one more is on the way, and slow.',
];

export const SIGN_HTML =
  '<p style="text-align:center"><b>← MORALITY, ½ mile</b><br/>Burdens eased by sound method.<br/>Enquire of Mr LEGALITY, or his son CIVILITY.<br/>Good houses to let.</p><hr/><p style="text-align:center"><b>↑ the wicket gate</b><br/><span style="opacity:.7">(in an older, plainer hand)</span></p>';

export const WISEMAN: Script = {
  start: [{ when: (f) => !!f.wiseman, then: [{ go: 'again' }], else: [{ go: 'first' }] }],
  first: [
    ['wiseman', "Good heavens. You've come out of the Slough with that on you? My dear friend — who sent you this way?"],
    ['you', 'A man called Evangelist.'],
    ['wiseman', "Him. He means well; they always do. Has he mentioned what's ahead? Hills, lions, dark valleys, hunger. I'm not being dramatic. I'm reading you the itinerary."],
    ['wiseman', "You want the weight off. Entirely reasonable. I can tell you where that's done sensibly, this afternoon, by people who know their business."],
    { choice: [{ t: 'Go on.' }, { t: 'Evangelist said the gate.', then: [['wiseman', "The gate, the gate. And was he carrying anything when he said it? No. They never are."]] }] },
    ['wiseman', "The village of Morality — that road, under the hill. A gentleman named Legality lives there, and his son Civility. They've a method: rules of life, properly kept. The weight comes off by degrees."],
    ['wiseman', 'And there are houses standing empty. You could send for your family by the month\'s end.'],
    {
      choice: [
        { t: 'My family could come?', once: true, then: [['wiseman', 'Next week, if you apply yourself. Everything there depends on applying yourself.']], go: 'decide' },
        { t: 'By degrees. How many degrees does it take?', once: true, then: [['wiseman', "(He smiles.) That's rather up to you, isn't it? That is the dignity of it."]], go: 'decide' },
      ],
    },
  ],
  decide: [
    {
      choice: [
        {
          t: '(Take the road to Morality.)',
          set: { wiseman: 'followed' },
          then: [['wiseman', 'Sensible. Straight along, under the hill; first house past it. Mention my name.']],
        },
        {
          t: "Thank you. I'll keep to the road I was given.",
          set: { wiseman: 'declined' },
          then: [["wiseman", "As you like. When you're halfway up some hill wishing you had listened — well. I shan't say it."]],
        },
      ],
    },
  ],
  again: [
    {
      when: (f) => f.wiseman === 'followed',
      then: [['wiseman', 'That way, friend. Under the hill. You can hardly miss the hill.']],
      else: [['wiseman', 'Still here? The offer stands. The sensible ones always do.']],
    },
  ],
};

export const DETOUR: Script = {
  start: [
    ['dream', "The hill hung so far over the road that the pilgrim was afraid to go on, lest it should fall on their head; and with every step toward it the burden seemed heavier than before."],
    ['thought', 'You stop. You cannot make the next step, and you cannot tell whether that is fear or sense.'],
    { run: (g) => g.story.evangelistArrives() },
    ['evangelist', 'What are you doing here?'],
    {
      choice: [
        { t: 'A gentleman told me there was a quicker way to be rid of it.', then: [['evangelist', "There are a great many quicker ways. I've not met the person they worked for."]] },
        { t: 'I wanted my family near. He said it could be done by the month\'s end.', then: [['evangelist', "That's no bad thing to want. It's a bad road to want it by."]] },
        { t: '(Say nothing.)', then: [['evangelist', "No? Then I'll say it: there's no shame in wanting the weight gone by the nearest road offered."]] },
      ],
    },
    ['evangelist', "Legality has never taken a burden off anyone. He can measure it for you, very exactly — he's honest that way. Stand under this hill long enough and you'll know your weight to the ounce."],
    ['you', 'It got heavier.'],
    ['evangelist', "It does. Now listen. The gate has not moved since you turned off. Neither has the one who keeps it. You are not starting again from further back."],
    {
      choice: [
        { t: "I've wasted the morning.", then: [['evangelist', "You've learned a road. Walk with me to the fork."]] },
        { t: 'Will it still open? After this?', then: [['evangelist', "If it only opened to people who'd taken no wrong turns, the hinges would have rusted solid long ago. Come."]] },
      ],
    },
    { set: { detourDone: true } },
  ],
};
