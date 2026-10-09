import type { Look } from '../game/characters';

export interface CastEntry { name: string; color: string; kind?: 'say' | 'thought' | 'dream'; look?: Look }

/** Everyone who speaks. `dream` is the Dreamer's narration; `thought` is the pilgrim's own mind. */
export const CAST: Record<string, CastEntry> = {
  you: { name: 'You', color: '#e9c47a' },
  thought: { name: '', color: '#fff', kind: 'thought' },
  dream: { name: 'The Dreamer', color: '#b9c4ea', kind: 'dream' },

  christiana: { name: 'Christiana', color: '#e0a0b4', look: { robe: 0x7a4b5a, hat: 'scarf', hatColor: 0xd8c8a8, apron: true, scale: 0.96 } },
  hester: { name: 'Hester', color: '#e6c08a', look: { robe: 0xa5803f, hat: 'cap', hatColor: 0xe6dcc6, apron: true, girth: 1.12, scale: 0.97 } },
  pip: { name: 'Pip', color: '#c8d890', look: { robe: 0x8a7a50, hat: 'cap', hatColor: 0x5a4a3a, scale: 0.66 } },
  vane: { name: 'Reckoner Vane', color: '#a9b4c8', look: { robe: 0x2f3540, trim: 0x15171c, hat: 'tall', hatColor: 0x1c1f26, girth: 0.9, scale: 1.1, skin: 0xd2b49a } },
  obstinate: { name: 'Obstinate', color: '#d89a6a', look: { robe: 0x6b4a36, hat: 'cap', hatColor: 0x3a2c22, girth: 1.3, scale: 1.05, skin: 0xb07a52 } },
  pliable: { name: 'Pliable', color: '#8fd0b8', look: { robe: 0x4f7a6a, hat: 'none', girth: 0.92, skin: 0xcaa07a } },
  porter: { name: 'Porter', color: '#c8b8a0', look: { robe: 0x5a5046, hat: 'cap', hatColor: 0x3a342c, girth: 1.15 } },
  chalker: { name: 'Woman chalking her step', color: '#c8b8a0', look: { robe: 0x5a6070, hat: 'scarf', hatColor: 0x8a6a5a, apron: true } },
  oldman: { name: 'Old man', color: '#c8b8a0', look: { robe: 0x6a6258, hat: 'wide', hatColor: 0x3a342c, scale: 0.94, skin: 0xc8a888 } },
  evangelist: { name: 'Evangelist', color: '#9db8f0', look: { robe: 0x3d4f7a, trim: 0x2a3350, hat: 'wide', hatColor: 0x2a3350, staff: true, lamp: true, scale: 1.04, skin: 0x8a6444 } },
  help: { name: 'Help', color: '#a8cc80', look: { robe: 0x5a7045, hat: 'wide', hatColor: 0x6a5a3a, staff: true, girth: 1.15, skin: 0x9a7050 } },
  joss: { name: 'Joss', color: '#e0a878', look: { robe: 0xa0683c, hat: 'none', satchel: true, skin: 0xc79a72 } },
  wiseman: { name: 'Mr Worldly Wiseman', color: '#c8a0e0', look: { robe: 0x5a3d6b, trim: 0xc9a24a, hat: 'tall', hatColor: 0x3a2848, staff: true, girth: 1.18, scale: 1.06, skin: 0xd8b8a0 } },
  goodwill: { name: 'Goodwill', color: '#f0c878', look: { robe: 0xc9a85a, trim: 0x8a4a34, hat: 'none', girth: 1.1, skin: 0x7a5238 } },
  shining1: { name: 'First Shining One', color: '#fff0c0', look: { robe: 0xffffff, kind: 'shining', scale: 1.25 } },
  shining2: { name: 'Second Shining One', color: '#fff0c0', look: { robe: 0xffffff, kind: 'shining', scale: 1.22 } },
  shining3: { name: 'Third Shining One', color: '#fff0c0', look: { robe: 0xffffff, kind: 'shining', scale: 1.28 } },
  accuser: { name: 'The Accuser', color: '#b0a0d8', look: { robe: 0x000000, kind: 'shadow', scale: 1.7, hat: 'hood' } },
  carrier: { name: 'Tam the carrier', color: '#8fc0e0', look: { robe: 0x3f6f8f, hat: 'cap', hatColor: 0x8a4a34, satchel: true, skin: 0xa87a56 } },
};
