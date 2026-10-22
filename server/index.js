// Goodnight TV hub, on the home network: the TV app plays from it, the parent's phone talks to it.
//   ws://<hub>:8790/tv      the Fire TV app
//   ws://<hub>:8790/parent  the companion page (http://<hub>:8790/)
// No AI: Bramble's lines and the stories are hand-written; his voice is recorded once and cached.
// Run: node index.js
import {appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {networkInterfaces} from 'node:os';
import {WebSocketServer} from 'ws';
import {LINES, RATE, fill} from './lines.js';
import {WORLDS, buildStory, choices} from './stories.js';
import {clip, prewarm, voiceName} from './voice.js';
import {personalStory} from './storyAI.js';
import {coachTip} from './coach.js';
import {phrase} from './storyAI.js';
import {plan} from './plan.js';
import {askMix} from './mix.js';
import {lyriaClip} from './lyria.js';
import {makeLoop} from './loop.js';
import {createHash} from 'node:crypto';

const PORT = Number(process.env.PORT || 8790);
mkdirSync('evidence', {recursive: true});
const EVIDENCE = `evidence/run-${new Date().toISOString().replace(/[:.]/g, '-')}.jsonl`;
const ev = (kind, data = {}) => appendFileSync(EVIDENCE, JSON.stringify({at: new Date().toISOString(), kind, ...data}) + '\n');

// ---------------------------------------------------------------- settings and history
const CONFIG_FILE = 'config.json';
const DEFAULTS = {
  childName: 'Leo',
  age: 5,
  wake: '07:00', // school wake-up
  steps: {teeth: true, pajamas: true, potty: false, light: true},
  world: 'animals',
  noise: 'soft', // green noise: off | soft | cozy
  end: 'noise', // after dark: noise (until the TV sleeps) | silence
  captions: true,
  onboarded: false, // first launch done on the TV
  thread: '', // tonight only: one line from the parent about the child's day, woven into the story
};
const pick = (o, keys) => Object.fromEntries(Object.entries(o || {}).filter(([k]) => keys.includes(k)));
let config = {...DEFAULTS, ...pick(existsSync(CONFIG_FILE) ? JSON.parse(readFileSync(CONFIG_FILE, 'utf8')) : {}, Object.keys(DEFAULTS))};
config.steps = {...DEFAULTS.steps, ...config.steps};

const MEMORY_FILE = 'memory.json';
const memory = {nights: [], ...(existsSync(MEMORY_FILE) ? JSON.parse(readFileSync(MEMORY_FILE, 'utf8')) : {})};

/** Story heroes from past nights who now live on Bramble's hill (newest first, up to 3). */
function friends() {
  const out = [];
  for (const n of [...memory.nights].reverse()) {
    if (n.hero && !out.some(f => f.short === n.hero.short)) out.push(n.hero);
    if (out.length === 3) break;
  }
  return out;
}
const lastFriend = () => memory.nights.at(-1)?.hero?.short ?? null;

const lanIp = () =>
  Object.values(networkInterfaces())
    .flat()
    .find(i => i && i.family === 'IPv4' && !i.internal)?.address || 'localhost';
const companionUrl = () => `http://${lanIp()}:${PORT}`;

// ---------------------------------------------------------------- live state (companion)
const state = {phase: 'idle', lightPct: null, light: [], noise: null, startedAt: null, endedAt: null, checks: {}, audio: null};
let story = null; // tonight's full story (with the ending lines)
let storyJob = null; // the story being written and voiced while the child brushes
let phaseAt = {}; // when each step started (step durations for the morning coach)
let tonightStory = null; // v11: the hand-written story the child chose on the TV

const tvs = new Set();
const parents = new Set();
const send = (ws, m) => ws.readyState === 1 && ws.send(JSON.stringify(m));
/**
 * Audio goes as binary frames with their own length, never as big JSON: Vega's WebSocket hands a
 * large message to the app in ~10 KB pieces, as separate message events (friction #15), so the TV
 * reassembles a byte stream. Frame: ['GNTV'][u32 total length][u16 header length][header JSON]
 * [PCM16 LE samples].
 */
const MAGIC = Buffer.from('GNTV');
const sendPcm = (ws, header, pcm) => {
  if (ws.readyState !== 1) return;
  const h = Buffer.from(JSON.stringify(header));
  const lens = Buffer.alloc(6);
  lens.writeUInt32LE(4 + 6 + h.length + pcm.length, 0);
  lens.writeUInt16LE(h.length, 4);
  ws.send(Buffer.concat([MAGIC, lens, h, pcm]), {binary: true});
};
const parentView = () => ({
  type: 'state',
  state: {...state, story: story ? {title: story.title, ...(state.endedAt ? {finalLines: story.finalLines} : {})} : null},
  config,
  plan: plan(config),
  nights: memory.nights,
  friends: friends(),
  coach: memory.coach ?? null,
});
const pushState = () => parents.forEach(ws => send(ws, parentView()));
/** The last 7 nights, oldest first: was there a finished bedtime? */
const week = () => {
  const done = new Set(memory.nights.map(n => n.date));
  return Array.from({length: 7}, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - 6 + i);
    return done.has(d.toISOString().slice(0, 10));
  });
};
// Only the animals world is illustrated so far, so the TV always gets it.
const WORLD = 'animals';
const tvHello = () => ({type: 'hello', config: {...config, world: WORLD}, friends: friends(), week: week(), choices: choices(WORLD), companionUrl: companionUrl()});

// ---------------------------------------------------------------- Bramble speaks
/** Stream a recorded clip to the TV, with its caption; the TV knows when it has been heard. */
async function speak(ws, id, text, rate) {
  const t0 = Date.now();
  // GNTV_SILENT_VOICE=1 (demo takes only): same length, silent, so the app's pacing is unchanged and
  // the take's audio holds only the app's own sounds; the edit lays Amy's recordings back on top.
  const pcm = process.env.GNTV_SILENT_VOICE ? Buffer.alloc((await clip(text, rate)).length) : await clip(text, rate);
  send(ws, {type: 'caption', text});
  for (let i = 0; i < pcm.length; i += 24000) sendPcm(ws, {type: 'voice'}, pcm.subarray(i, i + 24000));
  send(ws, {type: 'clipEnd', id, seconds: +(pcm.length / 48000).toFixed(2)});
  ev('speak', {id, seconds: +(pcm.length / 48000).toFixed(2), readyMs: Date.now() - t0, text, rate}); // text, rate: captions and Amy's clip for the demo edit
}

const lineFor = key => {
  const k = key === 'greet' && lastFriend() ? 'greetFriend' : key;
  return LINES[k] ? [fill(LINES[k], {name: config.childName, friend: lastFriend() ?? ''}), RATE[k] ?? 88] : null;
};
const SCENE_RATE = [86, 82, 78, 74, 70];

/** Record everything tonight can need, so bedtime never waits on the network. */
async function warmUp() {
  const items = Object.keys(LINES)
    .filter(k => k !== 'greetFriend' || lastFriend())
    .map(k => [fill(LINES[k], {name: config.childName, friend: lastFriend() ?? ''}), RATE[k] ?? 88]);
  const w = WORLDS[WORLD];
  for (const full of [false, true]) {
    for (const who of w.who) for (const where of w.where) for (const cozy of w.cozy) {
      buildStory(WORLD, {who: who.id, where, cozy}, config.childName, {full}).scenes.forEach((s, i) => items.push([s, SCENE_RATE[i]]));
    }
  }
  const t0 = Date.now();
  const n = await prewarm(items);
  if (n) console.log(`[voice] recorded ${n} new clips in ${((Date.now() - t0) / 1000).toFixed(0)} s (${voiceName()})`);
  ev('warmUp', {clips: items.length, recorded: n, ms: Date.now() - t0});
}

// ---------------------------------------------------------------- TV messages
async function onTV(ws, m) {
  switch (m.type) {
    case 'begin':
      Object.assign(state, {startedAt: Date.now(), endedAt: null, light: [], checks: {}, phase: 'hello'});
      story = null;
      storyJob = null;
      tonightStory = null;
      phaseAt = {};
      ev('begin', {config});
      pushState();
      break;
    case 'phase':
      // a step is checked off when the next one starts
      if (['teeth', 'pajamas', 'potty', 'light', 'lights', 'water', 'toys'].includes(state.phase) && state.phase !== m.phase) state.checks[state.phase] = true;
      if (state.phase && phaseAt[state.phase]) phaseAt[state.phase] = {...phaseAt[state.phase], end: Date.now()};
      phaseAt[m.phase] = {start: Date.now()};
      state.phase = m.phase;
      ev('phase', {phase: m.phase});
      pushState();
      break;
    case 'speak': {
      // v11: the TV owns every word (lines and stories); the hub only gives Bear his voice
      if (typeof m.text === 'string' && m.text.length < 2000) await speak(ws, m.id, m.text, Math.max(60, Math.min(100, Number(m.rate) || 86)));
      else send(ws, {type: 'clipEnd', id: m.id, seconds: 0});
      break;
    }
    case 'prewarm': {
      const items = (Array.isArray(m.items) ? m.items : []).filter(([t]) => typeof t === 'string' && t.length < 2000).slice(0, 400);
      const t0 = Date.now();
      prewarm(items, 3)
        .then(n => n && console.log(`[voice] recorded ${n} new clips for the TV in ${((Date.now() - t0) / 1000).toFixed(0)} s (${voiceName()})`))
        .catch(e => console.warn('[voice] prewarm failed:', e.message));
      break;
    }
    case 'loop': {
      // a sound layer for tonight's mix: the seamless loop made by tools/loops.js, sent in 1 s parts
      const file = `cache/loops/${String(m.id).replace(/[^a-z0-9_]/g, '')}.pcm`;
      if (!existsSync(file)) break;
      const pcm = readFileSync(file);
      const part = 48000;
      const total = Math.ceil(pcm.length / part);
      for (let i = 0; i < total; i++) sendPcm(ws, {type: 'loop', id: m.id, seq: i, total}, pcm.subarray(i * part, (i + 1) * part));
      ev('loop', {id: m.id, seconds: +(pcm.length / 48000).toFixed(1)});
      break;
    }
    case 'askMix': {
      // Nature in the words → Nova mixes the real recordings. Music in the words ("a gentle piano
      // lullaby with rain") → Lyria composes a new piece on the spot (looped here), laid over the
      // nature layers Nova picked. If Lyria refuses or fails, Nova's mix alone is used.
      const t0 = Date.now();
      const text = String(m.text || '').slice(0, 200);
      const musical = /music|lullab|piano|song|melod|sing|instrument|guitar|harp|violin|flute|cello|celest|chime|bells/i.test(text);
      const id = 'ai_' + createHash('sha1').update(text.toLowerCase()).digest('hex').slice(0, 10);
      const [nova, made] = await Promise.allSettled([
        askMix(text, Array.isArray(m.layers) ? m.layers.slice(0, 30) : []),
        !musical ? Promise.reject(new Error('not a musical request')) : existsSync(`cache/loops/${id}.pcm`) ? Promise.resolve('cached') : lyriaClip(text, `cache/${id}.mp3`).then(f => makeLoop(f, id, 24)),
      ]);
      const n = nova.status === 'fulfilled' ? nova.value : null;
      let res = n ? {...n, source: 'nova-mix'} : null;
      if (made.status === 'fulfilled') {
        const nature = Object.fromEntries(Object.entries(n?.mix ?? {}).filter(([k]) => k !== 'lullaby' && k !== 'dreams').map(([k, v]) => [k, Math.min(v, 0.45)]).slice(0, 3));
        res = {name: n?.name || text.replace(/^./, c => c.toUpperCase()).slice(0, 40), mix: {[id]: 0.7, ...nature}, line: n?.line || '', source: 'lyria+nature'};
      } else if (musical) {
        console.warn('[lyria]', made.reason?.message);
      }
      ev('askMix', {text, musical, res, lyriaError: musical && made.status === 'rejected' ? made.reason?.message : null, ms: Date.now() - t0});
      if (res?.line) await clip(res.line, 86).catch(() => {});
      send(ws, {type: 'mix', name: res?.name ?? '', mix: res?.mix ?? null, line: res?.line ?? ''});
      break;
    }
    case 'story':
      tonightStory = {id: m.id, title: m.title};
      ev('story', {id: m.id, title: m.title});
      break;
    case 'settings':
      ev('settings', {settings: m.settings});
      break;
    case 'say': {
      const line = lineFor(m.key);
      if (line) await speak(ws, m.id, ...line);
      else send(ws, {type: 'clipEnd', id: m.id, seconds: 0});
      break;
    }
    case 'makeStory': {
      // the picks come first in the evening; the story is written and voiced while the child brushes
      const picks = m.picks;
      storyJob = (async () => {
        const st = await personalStory({name: config.childName, age: config.age, picks, thread: config.thread, full: !!m.full, world: WORLD});
        story = st;
        ev('story', {id: st.id, title: st.title, source: st.source, ms: st.ms, thread: st.thread, errors: st.errors, usage: st.usage});
        send(ws, {type: 'story', story: {title: st.title, scenes: st.scenes, picks: st.picks, hero: st.hero}});
        pushState();
        prewarm(st.scenes.map((sc, i) => [sc, SCENE_RATE[i] ?? 72]), 2).catch(() => {});
        return st;
      })();
      break;
    }
    case 'narrate':
      if (!story && storyJob) await storyJob;
      if (story?.scenes[m.index]) await speak(ws, m.id, story.scenes[m.index], SCENE_RATE[m.index] ?? 72);
      else send(ws, {type: 'clipEnd', id: m.id, seconds: 0});
      break;
    case 'end':
      state.phase = 'dark';
      state.endedAt = Date.now();
      state.checks.story = true;
      if (!story && (tonightStory || m.title)) story = {title: tonightStory?.title ?? m.title, id: tonightStory?.id ?? null, hero: null, finalLines: [], source: 'library'};
      if (story) {
        const steps = Object.fromEntries(Object.entries(phaseAt).filter(([, v]) => v.end).map(([k, v]) => [k, Math.round((v.end - v.start) / 1000)]));
        const p = plan(config);
        const [lh, lm] = p.lightsOut.split(':').map(Number);
        memory.nights.push({
          date: new Date().toISOString().slice(0, 10),
          startedAt: state.startedAt,
          darkAt: state.endedAt,
          title: story.title,
          hero: story.hero,
          checks: state.checks,
          steps,
          thread: story.thread,
          storySource: story.source,
          plan: {lightsOutMinutes: ((lh % 12) + 12) * 60 + lm, lightsOut: p.lightsOut},
        });
        memory.nights = memory.nights.slice(-60);
        const tip = coachTip(memory.nights, {childName: config.childName});
        memory.coach = tip ? {...tip, text: await phrase(tip.text, config.childName).catch(() => tip.text), raw: tip.text, at: Date.now()} : null;
        writeFileSync(MEMORY_FILE, JSON.stringify(memory, null, 2));
        if (config.thread) {
          config.thread = ''; // tonight only
          writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
        }
      }
      ev('end', {minutes: state.startedAt ? +((state.endedAt - state.startedAt) / 60000).toFixed(2) : null, story: story?.id});
      pushState();
      warmUp().catch(() => {}); // tomorrow's greeting mentions tonight's hero
      break;
    case 'reset':
      state.phase = 'idle';
      pushState();
      break;
    case 'telemetry':
      Object.assign(state, {lightPct: m.lightPct, noise: m.noise, audio: m.audio});
      if (state.startedAt && !state.endedAt) state.light.push([Math.round((Date.now() - state.startedAt) / 1000), m.lightPct]);
      ev('telemetry', m);
      pushState();
      break;
    case 'key':
      ev('key', {eventType: m.eventType});
      break;
    case 'pick':
      ev('pick', m);
      break;
    case 'setConfig':
      // first launch on the TV: age, wake-up, steps
      await applyConfig(m.config);
      break;
  }
}

async function onParent(m) {
  if (m.type === 'config') await applyConfig(m.config);
}

async function applyConfig(patch) {
  const before = `${config.childName}|${config.world}`;
  config = {...config, ...pick(patch, Object.keys(DEFAULTS))};
  config.steps = {...DEFAULTS.steps, ...config.steps};
  config.age = Math.max(2, Math.min(12, Number(config.age) || 5));
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  ev('config', {config});
  tvs.forEach(ws => send(ws, tvHello()));
  pushState();
  if (`${config.childName}|${config.world}` !== before) warmUp().catch(() => {});
}

// ---------------------------------------------------------------- HTTP + WebSocket
const server = createServer((req, res) => {
  if (req.method === 'GET' && (req.url === '/' || req.url.startsWith('/?'))) {
    res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8'});
    return res.end(readFileSync(new URL('./companion/index.html', import.meta.url)));
  }
  if (req.method === 'GET' && req.url.startsWith('/api/debug/say')) {
    // development only: make Bear speak on every connected TV, to test the voice path without a remote
    const text = new URL(req.url, 'http://x').searchParams.get('text') || 'Hello. The moon is up, and it is nearly time for bed.';
    tvs.forEach(ws => send(ws, {type: 'debugSay', text}));
    res.writeHead(200, {'Content-Type': 'text/plain'});
    return res.end(`sent to ${tvs.size} TV(s)\n`);
  }
  if (req.method === 'GET' && req.url.startsWith('/api/debug/lab')) {
    // development only: set the TV's Light lab, to tune the light curve and take stills without a remote
    //   ?burned=0.45&lamp=1&room=story&flame=1&play=1  ·  &veil=..&warm=..&room_glow=..&dark=.. override the curve  ·  &curve=1 clears it
    const q = new URL(req.url, 'http://x').searchParams;
    const n = k => (q.has(k) ? Number(q.get(k)) : undefined);
    const state = {};
    if (q.has('burned')) state.burned = n('burned');
    if (q.has('lamp')) state.lampOff = q.get('lamp') === '1';
    if (q.has('room')) state.room = q.get('room');
    if (q.has('flame')) state.flame = n('flame');
    if (q.has('play')) state.playing = q.get('play') === '1';
    if (q.has('bend')) state.bend = n('bend');
    const o = Object.fromEntries([['veil', 'veil'], ['warm', 'warm'], ['room', 'room_glow'], ['dark', 'dark']].filter(([, k]) => q.has(k)).map(([key, k]) => [key, n(k)]));
    if (Object.keys(o).length) state.override = o;
    if (q.get('curve') === '1') state.override = null;
    tvs.forEach(ws => send(ws, {type: 'debugLab', state}));
    res.writeHead(200, {'Content-Type': 'application/json'});
    return res.end(JSON.stringify({tvs: tvs.size, state}) + '\n');
  }
  if (req.method === 'GET' && req.url === '/api/state') {
    res.writeHead(200, {'Content-Type': 'application/json'});
    return res.end(JSON.stringify(parentView()));
  }
  res.writeHead(404).end();
});

const wss = new WebSocketServer({noServer: true});
server.on('upgrade', (req, sock, head) => {
  const path = req.url.split('?')[0];
  if (path !== '/tv' && path !== '/parent') return sock.destroy();
  wss.handleUpgrade(req, sock, head, ws => {
    const handle = fn => d => {
      try {
        Promise.resolve(fn(JSON.parse(d))).catch(e => console.error(`[${path}]`, e.message));
      } catch (e) {
        console.error(`[${path}] bad message`, e.message);
      }
    };
    if (path === '/tv') {
      tvs.add(ws);
      ev('tvConnected', {from: req.socket.remoteAddress});
      send(ws, tvHello());
      ws.on('message', handle(m => onTV(ws, m)));
      ws.on('close', () => tvs.delete(ws));
    } else {
      parents.add(ws);
      send(ws, parentView());
      ws.on('message', handle(onParent));
      ws.on('close', () => parents.delete(ws));
    }
  });
});

server.listen(PORT, () => {
  console.log(`Goodnight TV hub on :${PORT} · companion ${companionUrl()}/ · evidence ${EVIDENCE}`);
  warmUp().catch(e => console.warn('[voice] warm-up failed:', e.message));
});
