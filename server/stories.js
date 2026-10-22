// Tonight's story, hand-written. The child picks who, where and something cozy; every combination
// gives a complete story built to wind down: four scenes that get shorter and slower (a yawn in
// scene 3, slow breathing in scene 4), then a last line read in the dark that hands the ending
// to the grown-up. The four ending lines go only to the parent's phone.
//
// Sentences starting with "+" are only read in a full-length routine (the demo skips them).

export const WORLDS = {
  animals: {
    who: [
      {id: 'dragon', emoji: '🐉', label: 'a little dragon', short: 'the little dragon'},
      {id: 'bunny', emoji: '🐰', label: 'a bunny', short: 'the bunny'},
      {id: 'fox', emoji: '🦊', label: 'a fox', short: 'the fox'},
    ],
    where: ['boat', 'forest', 'moon'],
    cozy: ['blanket', 'lullaby', 'teddy'],
  },
  sea: {
    who: [
      {id: 'whale', emoji: '🐳', label: 'a baby whale', short: 'the baby whale'},
      {id: 'turtle', emoji: '🐢', label: 'a turtle', short: 'the turtle'},
      {id: 'otter', emoji: '🦦', label: 'an otter', short: 'the otter'},
    ],
    where: ['reef', 'island', 'lighthouse'],
    cozy: ['shell', 'lullaby', 'blanket'],
  },
  space: {
    who: [
      {id: 'robot', emoji: '🤖', label: 'a small robot', short: 'the small robot'},
      {id: 'owlet', emoji: '🦉', label: 'a star owlet', short: 'the star owlet'},
      {id: 'comet', emoji: '☄️', label: 'a sleepy comet', short: 'the sleepy comet'},
    ],
    where: ['moon', 'cloud', 'train'],
    cozy: ['stars', 'lullaby', 'teddy'],
  },
};

export const PLACES = {
  boat: {emoji: '⛵', label: 'on a boat', in: 'on a little wooden boat', sound: 'The water went lap, lap, against the boat', rock: 'The boat rocked, slow and gentle', end: 'The boat rocked, slow and gentle, under the big round moon'},
  forest: {emoji: '🌲', label: 'in a forest', in: 'in a quiet green forest', sound: 'The leaves whispered, shh, shh', rock: 'The tall trees swayed, slow and gentle', end: 'The tall trees swayed, slow and gentle, and kept watch all night'},
  moon: {emoji: '🌙', label: 'on the moon', in: 'on the soft silver moon', sound: 'The stars hummed a quiet, silver song', rock: 'The moon turned, slow and gentle', end: 'The moon turned, slow and gentle, through the deep blue night'},
  reef: {emoji: '🪸', label: 'by a coral reef', in: 'by a coral reef', sound: 'The little fish swam home, one by one', rock: 'The sea swayed, slow and gentle', end: 'The sea swayed, slow and gentle, and the reef glowed softly'},
  island: {emoji: '🏝️', label: 'on an island', in: 'on a little sandy island', sound: 'The waves came in, and went out, hush, hush', rock: 'The palm trees swayed, slow and gentle', end: 'The waves came in, and went out, all through the night'},
  lighthouse: {emoji: '🗼', label: 'by a lighthouse', in: 'by an old lighthouse', sound: 'The lighthouse turned its light, round, and round', rock: 'The sea swayed, slow and gentle', end: 'The lighthouse dimmed its light, and the sea was still'},
  cloud: {emoji: '☁️', label: 'on a cloud', in: 'on a soft, fluffy cloud', sound: 'The wind sang a low, soft song', rock: 'The cloud drifted, slow and gentle', end: 'The cloud drifted, slow and gentle, across the sleepy sky'},
  train: {emoji: '🚂', label: 'on a night train', in: 'on a little night train', sound: 'The wheels went clickety, clack, clickety, clack', rock: 'The train rocked, slow and gentle', end: 'The night train rocked, slow and gentle, all the way to morning'},
};

export const COZY = {
  blanket: {emoji: '🧣', label: 'a soft blanket', find: 'a soft blanket, warm as a hug', act: 'pulled the soft blanket up, right up to its chin', thing: 'the soft blanket'},
  lullaby: {emoji: '🎵', label: 'a lullaby', find: 'a quiet little lullaby', act: 'hummed the lullaby, very, very quietly', thing: 'the lullaby'},
  teddy: {emoji: '🧸', label: 'a tiny teddy', find: 'a tiny teddy, with one soft ear', act: 'held the tiny teddy close', thing: 'the tiny teddy'},
  shell: {emoji: '🐚', label: 'a humming shell', find: 'a shell that hummed the sound of the sea', act: 'held the shell to its ear and listened', thing: 'the humming shell'},
  stars: {emoji: '✨', label: 'a blanket of stars', find: 'a blanket made of tiny stars', act: 'wrapped itself in the blanket of stars', thing: 'the blanket of stars'},
};

const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const SMALL = new Set(['a', 'an', 'and', 'the', 'of', 'on', 'in', 'by']);
const titleCase = s => s.split(' ').map((w, i) => (i > 0 && SMALL.has(w) ? w : cap(w))).join(' ');

/** All the choices for a world, as the TV's cards show them. */
export function choices(world) {
  const w = WORLDS[world] ?? WORLDS.animals;
  return {
    who: w.who.map(({id, emoji, label}) => ({id, emoji, label})),
    where: w.where.map(id => ({id, emoji: PLACES[id].emoji, label: PLACES[id].label})),
    cozy: w.cozy.map(id => ({id, emoji: COZY[id].emoji, label: COZY[id].label})),
  };
}

export const handoff = name => `And then the sleepiest, most wonderful thing happened. But that part only happens in bed. Your grown-up has it. Goodnight, ${name}.`;

/**
 * Build tonight's story. picks = {who, where, cozy} ids. full = real-length routine.
 * Returns {id, title, hero, scenes: string[5], finalLines: string[4]}.
 */
export function buildStory(world, picks, name, {full = false} = {}) {
  const w = WORLDS[world] ?? WORLDS.animals;
  const who = w.who.find(x => x.id === picks.who) ?? w.who[0];
  const place = PLACES[picks.where] ?? PLACES[w.where[0]];
  const cozy = COZY[picks.cozy] ?? COZY[w.cozy[0]];
  const s = who.short;

  const raw = [
    [
      `Once upon a time, ${who.label} lived ${place.in}.`,
      `+All day long, ${s} had been busy: looking, and finding, and wondering.`,
      'Now the sky was turning orange, then pink, then a soft, deep blue.',
      `${place.sound}.`,
      "+Far away, an owl said hoo, very softly, as if to say: it's nearly time.",
    ],
    [
      `${cap(s)} found ${cozy.find}.`,
      'It was just the right size, and just the right warmth.',
      `${cap(s)} ${cozy.act}.`,
      `+Everything around was getting slower. ${place.rock}.`,
      '+One little star came out. Then another. Then another.',
    ],
    [
      `${cap(s)} rubbed its eyes.`,
      'Then it opened its mouth for a big, slow yawn. Aaah.',
      '+Its paws felt heavy, like warm sand.',
      `${place.rock}.`,
    ],
    [`${cap(s)} breathed in, slowly. And out.`, 'In… and out.', '+In… and out.', 'Its eyes were closing, little by little.'],
  ];
  const scenes = raw.map(lines =>
    lines
      .filter(l => full || !l.startsWith('+'))
      .map(l => l.replace(/^\+/, ''))
      .join(' '),
  );
  return {
    id: `${world}-${who.id}-${picks.where}-${picks.cozy}`,
    title: `${titleCase(s)} and ${titleCase(cozy.thing).replace(/^The /, 'the ')}`,
    hero: {id: who.id, emoji: who.emoji, short: s},
    picks: {who: who.emoji, where: place.emoji, cozy: cozy.emoji},
    scenes: [...scenes, handoff(name)],
    finalLines: [
      `${cap(s)} snuggled up with ${cozy.thing}.`,
      `${place.end}.`,
      'One last slow breath, in… and out.',
      `And ${s} was fast asleep. Goodnight, ${name}.`,
    ],
  };
}
