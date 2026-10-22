// Hand-written bedtime stories, in a wind-down shape: each chapter slower and shorter than the one
// before, a shared breath near the end, an ending that happens in bed, no exclamation marks after
// the first chapter. Chapters are separated by a "turn the page" press, which also keeps Fire TV
// from switching the display off mid-story (~5 min without input; friction-log.md #1).

export type Tale = {
  id: string;
  title: string;
  chapters: string[][]; // paragraphs, one voice clip and one caption each
  short: number[]; // chapters read on a short night
};

export const TALES: Tale[] = [
  {
    id: 'firefly',
    title: 'The last little firefly',
    short: [1, 2],
    chapters: [
      [
        'At the edge of a quiet forest, where the grass is soft and the path is made of round grey stones, there is a little wooden cottage. And in the little wooden cottage lives a bear.',
        'Every evening, when the sky turns from blue to purple, Bear takes his glass jar down from the shelf. He walks out into the garden, slowly, in his soft slippers. And he waits.',
        'One by one, the fireflies come. A little light by the roses. A little light by the gate. A little light, low in the long grass. They float to Bear and climb into his jar, because the jar is warm, and Bear is kind.',
        'Soon the jar is full of tiny lights, glowing gold, like a lantern made of summer.',
        'Bear carries the jar inside. He brushes his teeth. Little circles, nice and slow. He puts on his softest pajamas. And he sits by the window, with the jar on his knees.',
        'Then, one by one, the fireflies fly home. Up, through the open window, over the trees, into the deep blue sky. And every firefly that flies home becomes a star.',
        'That is how the sky fills up at night. One small light at a time.',
      ],
      [
        'But tonight, when all the other fireflies had flown home, one little light was still in the jar.',
        'It was the smallest firefly of all. Her name was Pip.',
        '"Pip," said Bear softly. "It is time to fly home."',
        '"I am too small," said Pip. "The sky is so big. What if my light is too little to see?"',
        'Bear thought about this, the way bears do. Slowly.',
        '"Let us look together," he said. He switched off the big lamp. Click. And the room went soft and dark.',
        'Out of the window, the stars were twinkling. Big stars and little stars. Bright stars and sleepy stars.',
        '"Look there," said Bear, pointing with one soft paw. "Do you see that tiny star, right above the tall pine tree? It is very small. And it is the one I look at every night, before I fall asleep."',
        'Pip looked. The tiny star blinked, slowly, as if it were saying hello.',
        '"Small lights are the easiest to love," said Bear. "They are gentle on sleepy eyes."',
        'Pip\'s light glowed a little warmer. "Will you watch me?" she asked.',
        '"Every night," said Bear. "From my bed."',
      ],
      [
        'So Bear climbed into his bed, and pulled the blanket up to his chin. His bunny was there too, soft and warm.',
        'Pip sat on the edge of the jar. She took a big breath in… … and a long breath out… …',
        'Shall we do it with her? A big breath in… … … and a long, slow breath out… … … One more. Breathe in… … … and out… … …',
        'Then Pip spread her tiny wings, and floated up. Past the curtains. Past the window. Over the garden, and the round grey stones. Over the tall pine tree. Up, and up, and up.',
        'And there, right above the tall pine tree, a new little star began to glow. It was not big. It was not bright. It was just right.',
        'Bear smiled. His eyes felt heavy. Heavy, and warm. "Goodnight, Pip," he whispered. And the little star blinked, very slowly.',
        'The forest was quiet now. The cottage was quiet. The jar was empty, and the sky was full.',
        'And if you close your eyes, in your own cozy bed, you might see a tiny light, just behind your eyelids. Soft, and warm.',
        'That is Pip, saying goodnight to you too. Goodnight.',
      ],
    ],
  },
  {
    id: 'boat',
    title: 'The sleepy little boat',
    short: [1],
    chapters: [
      [
        'Down by the lake, where the water is still and the reeds whisper shh, there is a little wooden boat.',
        'All day long, the little boat carries the ducks across the water, and the frogs, and sometimes a very small mouse in a very big hat.',
        'But when the sun goes down, and the water turns silver, the little boat gets sleepy. "Is it bedtime?" it asks.',
        '"Almost," says the moon, rising over the hill. "First, say goodnight to your friends."',
        'So the little boat says goodnight to the ducks, who tuck their heads under their wings. Goodnight, ducks.',
        'And goodnight to the frogs, who sing one last, low song. Goodnight, frogs.',
        'And goodnight to the mouse in the very big hat, who takes off the hat, and yawns. Goodnight, mouse.',
      ],
      [
        'Now the lake is quiet. The little boat rocks, slow and gentle. Back, and forth. Back, and forth.',
        'The water goes lap, lap, against its side. Lap. Lap.',
        'The moon pulls a soft blanket of mist across the water, cool and soft, like a whisper.',
        '"Will you stay?" asks the little boat. "All night," says the moon. "I will keep the light low."',
        'The little boat breathes in, with the water… … and breathes out, with the water… … In… … and out… …',
        'Its sail folds. Its ropes go still. Its little wooden heart goes slow, and slow, and slower.',
        'And the little boat sleeps, rocking gently, under the big round moon. Goodnight, little boat. Goodnight.',
      ],
    ],
  },
];

export const wordsOf = (paras: string[]) => paras.join(' ').split(/\s+/).length;

/** Spoken length in minutes, at Bear's slow story pace (~95 words a minute with pauses). */
export const taleMinutes = (t: Tale, short: boolean) => {
  const chapters = short ? t.short.map(i => t.chapters[i]) : t.chapters;
  return Math.max(1, Math.round(chapters.reduce((a, c) => a + wordsOf(c), 0) / 95));
};

/** Speaking rate per chapter (%): slower as the story goes on. */
export const CHAPTER_RATE = [84, 78, 72];
