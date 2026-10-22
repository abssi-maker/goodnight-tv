// Tonight's sound, composed by Lyria 3 (Gemini API, lyria-3-clip-preview): a 30 s instrumental clip
// from the grown-up's own words, wrapped in a fixed sleep-safe brief. The hub loops it (loop.js).
// Needs GEMINI_API_KEY in the environment. Lyria's filter refuses some words (it refused "crickets"
// and "young child" on Oct 20), so callers always keep a fallback.
import {writeFileSync} from 'node:fs';

const BRIEF = 'Ambient instrumental sleep soundscape, no vocals, no drums, no percussion, about 55 bpm.';
const CALM = 'Calm, even and slow from start to end, no sudden sounds, no build-ups. Seamless loop.';

export async function lyriaClip(words, outFile) {
  const key = (process.env.GEMINI_API_KEY || '').trim();
  if (!key) throw new Error('no GEMINI_API_KEY');
  const input = `${BRIEF} ${String(words).replace(/["\n]/g, ' ').slice(0, 200)}. ${CALM}`;
  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST',
    headers: {'x-goog-api-key': key, 'Content-Type': 'application/json'},
    body: JSON.stringify({model: 'lyria-3-clip-preview', input}),
    signal: AbortSignal.timeout(60000),
  });
  const j = await res.json();
  if (j.error) throw new Error(`${j.error.code ?? res.status}: ${j.error.message}`);
  for (const step of j.steps ?? []) {
    for (const c of step.type === 'model_output' ? step.content ?? [] : []) {
      if (c.type === 'audio' && c.data) {
        writeFileSync(outFile, Buffer.from(c.data, 'base64'));
        return outFile;
      }
    }
  }
  throw new Error('no audio in the answer');
}
