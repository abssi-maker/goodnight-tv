// Bramble's voice: every line is recorded once (text-to-speech at setup time), cached on disk as
// 24 kHz PCM, and played from the cache at bedtime, so the routine never waits on the network.
// A parent's or an actor's recording can replace any cached clip (same file name).
import {createHash} from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const run = promisify(execFile);
import {PollyClient, SynthesizeSpeechCommand} from '@aws-sdk/client-polly';
import {resample} from './pcm.js';

export const VOICE = process.env.BRAMBLE_VOICE || 'Amy';
// Without AWS credentials, record with the Mac's own voice instead (development only).
const MAC_VOICE = process.env.BRAMBLE_MAC_VOICE || 'Daniel';
let usePolly = process.env.BRAMBLE_TTS !== 'mac';
const DIR = 'cache/voice';
mkdirSync(DIR, {recursive: true});
const polly = new PollyClient({region: process.env.AWS_REGION || 'us-east-1'});

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** SSML: slow, with breathing room after sentences and long pauses on "…". */
export function ssml(text, rate) {
  const body = esc(text)
    .replace(/…\s*/g, '<break time="900ms"/> ')
    .replace(/([.?])\s+/g, '$1 <break time="450ms"/> ')
    .replace(/,\s+/g, ', <break time="150ms"/> ');
  return `<speak><prosody rate="${rate}%">${body}</prosody></speak>`;
}

// Amy's clip and the Mac fallback are cached under separate keys. Amy's is always tried first, so a
// Polly outage (an expired `aws login`) never replaces lines she has already recorded.
const keyFor = (voice, text, rate) => createHash('sha1').update(`${voice}|${rate}|${text}`).digest('hex').slice(0, 16);
const POLLY_KEY = VOICE;
const MAC_KEY = 'mac:' + MAC_VOICE;
const inflight = new Map();
// After a Polly failure, new lines use the Mac voice for a few minutes, then Polly is tried again.
const RETRY_MS = 5 * 60 * 1000;
let pollyDownUntil = 0;

/** 24 kHz 16-bit mono PCM for `text`, from the cache or recorded now. */
export async function clip(text, rate = 90) {
  const amy = `${DIR}/${keyFor(POLLY_KEY, text, rate)}.pcm`;
  if (existsSync(amy)) return readFileSync(amy);
  const tryPolly = usePolly && Date.now() >= pollyDownUntil;
  const mac = `${DIR}/${keyFor(MAC_KEY, text, rate)}.pcm`;
  if (!tryPolly && existsSync(mac)) return readFileSync(mac);
  const file = tryPolly ? amy : mac;
  if (inflight.has(file)) return inflight.get(file);
  const job = (async () => {
    let pcm;
    if (tryPolly) {
      try {
        const res = await polly.send(
          new SynthesizeSpeechCommand({Text: ssml(text, rate), TextType: 'ssml', VoiceId: VOICE, Engine: process.env.BRAMBLE_ENGINE || 'generative', OutputFormat: 'pcm', SampleRate: '16000'}),
        );
        pcm = resample(Buffer.from(await res.AudioStream.transformToByteArray()), 16000, 24000);
      } catch (e) {
        console.warn(`[voice] Polly unavailable (${e.message}); new lines use the Mac voice "${MAC_VOICE}" for 5 min (run \`aws login\` to get ${VOICE} back)`);
        pollyDownUntil = Date.now() + RETRY_MS;
        inflight.delete(file);
        return clip(text, rate);
      }
    } else {
      pcm = await macSay(text, rate);
    }
    writeFileSync(file, pcm);
    return pcm;
  })().finally(() => inflight.delete(file));
  inflight.set(file, job);
  return job;
}

/** macOS `say` → 24 kHz PCM via ffmpeg. Rate: ~175 wpm at 100%. */
async function macSay(text, rate) {
  const tmp = `${DIR}/tmp-${process.pid}-${Math.random().toString(36).slice(2)}`;
  const spoken = text.replace(/…/g, '... ');
  await run('say', ['-v', MAC_VOICE, '-r', String(Math.round(1.75 * rate)), '-o', `${tmp}.aiff`, spoken]);
  const {stdout} = await run('ffmpeg', ['-loglevel', 'error', '-i', `${tmp}.aiff`, '-f', 's16le', '-ac', '1', '-ar', '24000', '-'], {encoding: 'buffer', maxBuffer: 64 << 20});
  await run('rm', ['-f', `${tmp}.aiff`]);
  return stdout;
}

/** Which voice is recording right now (for logs). */
export const voiceName = () => (usePolly && Date.now() >= pollyDownUntil ? `Polly ${VOICE}` : `Mac ${MAC_VOICE} (Polly ${VOICE} for cached lines)`);

/** Recorded in Amy's voice already (a Mac fallback does not count: prewarm records it again in Amy). */
export const isCached = (text, rate = 90) => existsSync(`${DIR}/${keyFor(POLLY_KEY, text, rate)}.pcm`);

/** Record a batch ahead of time, a few at a time. Returns how many were newly recorded. */
export async function prewarm(items, concurrency = 4) {
  const todo = items.filter(([t, r]) => !isCached(t, r));
  let i = 0;
  await Promise.all(
    Array.from({length: concurrency}, async () => {
      while (i < todo.length) {
        const [t, r] = todo[i++];
        try {
          await clip(t, r);
        } catch (e) {
          console.warn('[voice]', e.message);
        }
      }
    }),
  );
  return todo.length;
}
