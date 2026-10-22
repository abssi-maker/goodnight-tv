// Everything Bramble says outside the story, written by hand. {name} is the child, {friend} is
// last night's story hero ("the little dragon"). Every finished step lets one firefly out of
// Bramble's jar. Short, warm, calmer as the night goes on: no exclamation marks after the big light.

export const LINES = {
  greet: 'Hello, {name}. The moon is coming up, and it is nearly time for bed.',
  greetFriend: 'Hello, {name}. Look, {friend} came back, and is very sleepy too. It is nearly time for bed.',
  teethGo: 'First, teeth. Off you go to brush, and I will wait right here. Press the button when you are back.',
  teethBack: 'Sparkly teeth. Well done. One firefly can go home.',
  pajamasGo: 'Now, pajamas. Go and get cozy, and press the button when you are back.',
  pajamasBack: 'So cozy. Another firefly can go home.',
  pottyGo: 'Potty, and wash your hands. I will wait. Press the button when you are back.',
  pottyBack: 'All done. Good job. One more firefly can go home.',
  bigLight: 'Now let us make it dark and cozy. Grown-up, can you switch off the big light? {name}, press the button when it is off.',
  lightOff: 'There. Just us, and the moon. Another firefly goes home.',
  pickWho: 'Before we start, let us make tonight\'s story. Who is in it?',
  pickWhere: 'And where are they?',
  pickCozy: 'And what makes it cozy?',
  picked: 'Oh, I like that. I will keep your story safe in my jar until story time.',
  storyTime: 'Now, it is story time. Snuggle up.',
  waitHum: 'Hmm, hm, hmm. I am still here, with my jar.',
  waitName: '{name}? I am waiting right here. Press the button when you are back.',
  lastFirefly: 'There is one firefly left. Will you let it go home? Press the button, very gently.',
  lastFireflyOut: 'Goodnight, little light.',
};

/** Speaking rate per line (Polly SSML %): slower as the evening goes on. */
export const RATE = {
  greet: 92, greetFriend: 92, teethGo: 92, teethBack: 92, pajamasGo: 90, pajamasBack: 90, pottyGo: 90, pottyBack: 90,
  bigLight: 86, lightOff: 82, pickWho: 84, pickWhere: 84, pickCozy: 84, picked: 86, storyTime: 80, waitHum: 84, waitName: 86, lastFirefly: 76, lastFireflyOut: 70,
};

export const fill = (text, vars) => text.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
