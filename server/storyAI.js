// Tonight's story, personalised: Amazon Nova writes it from the child's three picks and the
// parent's one line about today ("lost his first tooth", "nervous about the school trip"), inside
// the same wind-down shape as the hand-written library. Every story is checked; anything that
// fails a check falls back to the hand-written story, so bedtime never depends on the model.
import {BedrockRuntimeClient, ConverseCommand} from '@aws-sdk/client-bedrock-runtime';
import {buildStory, handoff, WORLDS, PLACES, COZY} from './stories.js';

const bedrock = new BedrockRuntimeClient({region: process.env.AWS_REGION || 'us-east-1'});
export const BEDROCK_MODEL = process.env.STORY_MODEL || 'us.amazon.nova-2-lite-v1:0';
const NOVA_API_MODEL = 'nova-2-lite-v1';

const WORDS = {demo: [[28, 42], [24, 36], [16, 28], [12, 22]], full: [[70, 100], [60, 85], [40, 60], [28, 45]]};
const BANNED = /\b(monster|scary|scared|fright|dark forest|lost|alone|cry|cried|blood|hurt|die|died|dead|kill|fight|attack|witch|ghost|nightmare|storm|thunder|danger|chase|trap|angry|shout|scream)\b/i;

export async function personalStory({name, age, picks, thread, full = false, world = 'animals'}) {
  const base = buildStory(world, picks, name, {full}); // the hand-written story: our fallback and the shape to follow
  const w = WORLDS[world] ?? WORLDS.animals;
  const who = w.who.find(x => x.id === picks.who) ?? w.who[0];
  const place = PLACES[picks.where] ?? PLACES[w.where[0]];
  const cozy = COZY[picks.cozy] ?? COZY[w.cozy[0]];
  const words = WORDS[full ? 'full' : 'demo'];
  const t0 = Date.now();
  const prompt = [
    `Write tonight's bedtime story for ${name}, age ${age}. The hero is ${who.label}, ${place.in}, with ${cozy.label}.`,
    thread ? `Something on ${name}'s mind today, from the parent: "${thread}". Weave it in gently, as something the hero also has, so it feels safe, small and handled by the end. Never make it frightening.` : '',
    'Rules: calm and warm; no danger, no villains, no surprises, no questions, no exclamation marks; simple words for a young child; past tense.',
    `Exactly 4 scenes. Word counts: scene 1 ${words[0].join('-')}, scene 2 ${words[1].join('-')}, scene 3 ${words[2].join('-')}, scene 4 ${words[3].join('-')}. Each scene slower and quieter than the last.`,
    'Scene 3 includes a big, slow yawn. Scene 4 is slow breathing: "in… and out…", the hero getting heavy and still. Do not let the hero fall asleep yet.',
    `Then "ending": exactly 4 short sentences that finish the story, for a parent to whisper in bed: the hero falls asleep with ${cozy.label}; the last sentence is "Goodnight, ${name}."`,
    'Reply with JSON only: {"title": string, "scenes": [4 strings], "ending": [4 strings]}',
  ]
    .filter(Boolean)
    .join('\n');

  const errors = [];
  for (const [label, call] of [
    [BEDROCK_MODEL, () => viaBedrock(prompt)],
    [`nova-api:${NOVA_API_MODEL}`, () => viaNovaApi(prompt)],
  ]) {
    try {
      const {text, usage} = await call();
      const j = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
      check(j, words, name);
      return {
        ...base,
        title: j.title,
        scenes: [...j.scenes, handoff(name)],
        finalLines: j.ending,
        thread: thread || null,
        source: label,
        ms: Date.now() - t0,
        usage,
        errors,
      };
    } catch (e) {
      errors.push(`${label}: ${e.message}`);
    }
  }
  return {...base, thread: thread || null, source: 'hand-written', ms: Date.now() - t0, errors};
}

/** Throws if the story breaks the wind-down shape or the safety rules. */
export function check(j, words, name) {
  if (!j || typeof j.title !== 'string' || !Array.isArray(j.scenes) || j.scenes.length !== 4 || !Array.isArray(j.ending) || j.ending.length !== 4) {
    throw new Error('shape');
  }
  const all = [j.title, ...j.scenes, ...j.ending].join(' ');
  if (/!|\?/.test(all)) throw new Error('exclamation or question');
  if (BANNED.test(all)) throw new Error(`banned word: ${all.match(BANNED)[0]}`);
  const n = j.scenes.map(s => s.trim().split(/\s+/).length);
  n.forEach((c, i) => {
    if (c < words[i][0] * 0.7 || c > words[i][1] * 1.4) throw new Error(`scene ${i + 1} has ${c} words`);
  });
  if (!(n[2] < Math.max(n[0], n[1]) && n[3] < Math.max(n[0], n[1]))) throw new Error('does not wind down');
  if (!/yawn/i.test(j.scenes[2])) throw new Error('no yawn in scene 3');
  if (!/breath|in… and out|in\.\.\. and out/i.test(j.scenes[3])) throw new Error('no breathing in scene 4');
  if (!new RegExp(`Goodnight, ${name}\\.?$`).test(j.ending[3].trim())) throw new Error('ending does not say goodnight');
}

async function viaBedrock(prompt) {
  const res = await bedrock.send(
    new ConverseCommand({modelId: BEDROCK_MODEL, messages: [{role: 'user', content: [{text: prompt}]}], inferenceConfig: {maxTokens: 1200, temperature: 0.7}}),
  );
  return {text: res.output?.message?.content?.map(c => c.text || '').join('') || '', usage: res.usage};
}

// The same Nova 2 Lite model through the Amazon Nova API, used while this account's Bedrock text
// models answer "Operation not allowed".
export async function viaNovaApi(prompt) {
  const key = (process.env.NOVA_API_KEY || '').trim();
  if (!key) throw new Error('no NOVA_API_KEY');
  const res = await fetch('https://api.nova.amazon.com/v1/chat/completions', {
    method: 'POST',
    headers: {Authorization: `Bearer ${key}`, 'Content-Type': 'application/json'},
    body: JSON.stringify({model: NOVA_API_MODEL, max_tokens: 1200, temperature: 0.7, messages: [{role: 'user', content: prompt}]}),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const j = await res.json();
  return {text: j.choices?.[0]?.message?.content || '', usage: j.usage};
}

/** Short, warm rewording of a coach tip by Nova (falls back to the rule's own words). */
export async function phrase(text, name) {
  const prompt = `Rewrite this bedtime tip for a tired parent in at most two short, warm, practical sentences. Keep every number and the advice exactly. No exclamation marks. The child is ${name}.\nTip: ${text}`;
  for (const call of [() => viaBedrock(prompt), () => viaNovaApi(prompt)]) {
    try {
      const {text: out} = await call();
      const clean = out.trim().replace(/^"|"$/g, '');
      if (clean && clean.length < 300 && !/!/.test(clean)) return clean;
    } catch {}
  }
  return text;
}
