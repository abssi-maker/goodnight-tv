// The family's bedtime: the steps in order, how long each takes, when it starts, and tonight's sound.
// Set once by a grown-up on the TV (Setup, Sounds); the same every night, because predictability is
// the point (Mindell et al. 2009/2015).

export type StepKind = 'teeth' | 'pajamas' | 'lights' | 'potty' | 'water' | 'toys' | 'story' | 'goodnight';
import type {Mix} from './sounds';

export type SceneKey = 'tonight' | 'teeth' | 'pajamas' | 'pajamasDark' | 'story' | 'storyDark' | 'goodnight' | 'sounds';

export type RoutineStep = {kind: StepKind; minutes: number; on: boolean};

export type Settings = {
  steps: RoutineStep[];
  start: number; // minutes after midnight the routine starts ("Start routine 7:30 PM")
  short: boolean; // "Short routine available": on late nights every step is halved
  preset: string; // the sound preset the mix started from ('custom' once a grown-up changed it)
  mix: Mix; // tonight's sound: layer → level 0–1
  mixName: string; // what the grown-up asked for, or the preset's name
  voice: number; // 0–1
  background: number; // 0–1, the whole sound bed
  fadeOut: boolean; // sound fades out 20 min after goodnight (otherwise it plays until the TV sleeps)
  candleSeconds: number; // how long the candle burns (and the screen warms and dims): 0 = the whole routine
};

type Meta = {
  setup: string; // label in Setup
  trail: string; // label in the step trail
  icon: string;
  title: string;
  sub: string;
  scene: SceneKey;
  min: number;
  max: number;
  say: {go: string; mid?: string; end: string; done: string};
};

export const STEP: Record<StepKind, Meta> = {
  teeth: {
    setup: 'Brush teeth',
    trail: 'Teeth',
    icon: 'tooth',
    title: 'Brush with Bear',
    sub: 'Little circles, nice and slow.',
    scene: 'teeth',
    min: 1,
    max: 4,
    say: {
      go: "Let's brush with Bear. Little circles, nice and slow. Top teeth first.",
      mid: 'Now the bottom teeth. Little circles.',
      end: 'Sparkly teeth. Press the button when you are done.',
      done: 'Lovely, sparkly teeth.',
    },
  },
  pajamas: {
    setup: 'Pajamas',
    trail: 'Pajamas',
    icon: 'pajamas',
    title: 'Pajamas on',
    sub: 'Arms in, head through. So cozy.',
    scene: 'pajamas',
    min: 1,
    max: 6,
    say: {go: 'Pajamas time. Arms in, head through. Nice and cozy.', end: 'All cozy? Press the button when you are ready.', done: 'So cozy.'},
  },
  lights: {
    setup: 'Dim the lights',
    trail: 'Lights',
    icon: 'lamp',
    title: 'Dim the lights',
    sub: 'Grown-up, switch off the big light.',
    scene: 'pajamas',
    min: 1,
    max: 3,
    say: {go: 'Grown-up, can you switch off the big light? Then our candle will be the only light.', end: 'Press the button when the big light is off.', done: 'There. Just us, the candle, and the moon.'},
  },
  potty: {
    setup: 'Potty',
    trail: 'Potty',
    icon: 'soap',
    title: 'Potty time',
    sub: 'Then wash your hands.',
    scene: 'teeth',
    min: 1,
    max: 5,
    say: {go: 'Potty time, and then wash your hands. I will wait right here.', end: 'Press the button when you are back.', done: 'All done.'},
  },
  water: {
    setup: 'Sip of water',
    trail: 'Water',
    icon: 'cup',
    title: 'A sip of water',
    sub: 'Just a little one.',
    scene: 'pajamas',
    min: 1,
    max: 3,
    say: {go: 'A little sip of water. Just a little one.', end: 'Press the button when you are back.', done: 'Mmm. Lovely.'},
  },
  toys: {
    setup: 'Toys to bed',
    trail: 'Toys',
    icon: 'bunny',
    title: 'Toys to bed',
    sub: 'Every toy needs a bed too.',
    scene: 'pajamas',
    min: 1,
    max: 5,
    say: {go: 'Time to put the toys to bed. They are sleepy too.', end: 'Press the button when they are all tucked in.', done: 'Shh. They are sleeping now.'},
  },
  story: {
    setup: 'Story',
    trail: 'Story',
    icon: 'book',
    title: '',
    sub: '',
    scene: 'story',
    min: 3,
    max: 12,
    say: {go: 'Story time. Snuggle up with your grown-up.', end: '', done: ''},
  },
  goodnight: {
    setup: 'Cuddle & goodnight',
    trail: 'Goodnight',
    icon: 'moon',
    title: 'Goodnight, little one.',
    sub: 'Time for a cuddle. Bear is sleeping too.',
    scene: 'goodnight',
    min: 1,
    max: 10,
    say: {go: 'Goodnight, little one. Time for a cuddle. I am sleeping too.', end: '', done: ''},
  },
};

/** Steps a grown-up can add, in the order "Add a step" offers them. */
export const EXTRA: StepKind[] = ['potty', 'water', 'toys'];

export const LINES = {
  hello: "Hello. The moon is up, and it's nearly time for bed. I'll light our bedtime candle… … It burns while we get ready. When it's very small, it's time to sleep.",
  // the finale: three candle breaths ("smell the flower, blow out the candle"), then the child blows it out
  blow1: 'Now, let us blow out the candle together. Smell the flower… … … and blow, very slowly… … …',
  blow2: 'Again. Smell the flower… … … and blow… … …',
  blow3: 'One last time. Smell the flower… … … and press the button, to blow out the candle.',
  sparkle: 'A little spark flies up, to be a star.',
  moreTime: "That's okay. Take your time.",
  turnPage: 'Can you turn the page? Very gently.',
  voiceCheck: 'Hello. Is this a cozy voice for bedtime?',
  mixed: 'Here is your sound. Listen. Is it cozy?',
};

export const DEFAULT_SETTINGS: Settings = {
  steps: [
    {kind: 'teeth', minutes: 2, on: true},
    {kind: 'pajamas', minutes: 3, on: true},
    {kind: 'lights', minutes: 1, on: true},
    {kind: 'story', minutes: 8, on: true},
    {kind: 'goodnight', minutes: 5, on: true},
  ],
  start: 19 * 60 + 30,
  short: true,
  preset: 'rain',
  mix: {rain: 0.75, rain_soft: 0.3},
  mixName: 'Rain',
  voice: 0.7,
  background: 0.7,
  fadeOut: true,
  candleSeconds: 0,
};

/** "Candle burns in": the whole routine (real use), or shorter to watch the dimming (tests, demos). */
export const CANDLE_SPEEDS: Array<{seconds: number; label: string}> = [
  {seconds: 0, label: 'Whole routine'},
  {seconds: 300, label: '5 min'},
  {seconds: 120, label: '2 min'},
  {seconds: 60, label: '1 min'},
  {seconds: 20, label: '20 s (test)'},
];

export const clock = (m: number) => {
  const mm = ((m % 1440) + 1440) % 1440;
  const h = Math.floor(mm / 60);
  return `${((h + 11) % 12) + 1}:${String(mm % 60).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};

/** Minutes from the start until the child is in bed and the cuddle is done (goodnight always counts). */
export const readyMinutes = (s: Settings) => s.steps.filter(x => x.on || x.kind === 'goodnight').reduce((a, x) => a + x.minutes, 0);

/** "Ready for bed": start + the routine, rounded up to five minutes like a person would say it. */
export const readyAt = (s: Settings) => Math.ceil((s.start + readyMinutes(s)) / 5) * 5;

/** Running late? With "short routine" on, more than 15 minutes past the start halves every step. */
export function isShortTonight(s: Settings, now = new Date()): boolean {
  if (!s.short) {
    return false;
  }
  const n = now.getHours() * 60 + now.getMinutes();
  let late = n - s.start;
  if (late < -12 * 60) {
    late += 1440;
  }
  return late > 15 && late < 4 * 60;
}

/** Tonight's steps, in order, with tonight's minutes. Goodnight always closes the evening. */
export function tonight(s: Settings, short: boolean): RoutineStep[] {
  const steps = s.steps.filter(x => x.on && x.kind !== 'goodnight').map(x => ({...x, minutes: short ? Math.max(1, Math.round(x.minutes / 2)) : x.minutes}));
  const gn = s.steps.find(x => x.kind === 'goodnight') ?? {kind: 'goodnight' as const, minutes: 5, on: true};
  return [...steps, {...gn, on: true}];
}

/** "20 minutes": the routine's length, rounded to five like a person would say it. */
export const aboutMinutes = (steps: RoutineStep[]) => {
  const m = steps.reduce((a, x) => a + x.minutes, 0);
  return Math.max(5, Math.round(m / 5) * 5);
};
