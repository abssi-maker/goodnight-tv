// "Ask Bear for a sound": a grown-up describes tonight's sound in their own words, Amazon Nova turns
// it into a mix of the layers the TV actually has, and Bear says one short line about it.
// The answer is checked (known layers only, levels 0–1, at most five, calm wording); anything off
// returns null and the TV falls back to matching the words itself.
import {viaNovaApi} from './storyAI.js';

const BANNED = /thunder|scream|siren|alarm|storm|monster|scary|!/i;
// Layers Nova likes to add for "coziness"; kept only when the parent asked for them.
const ONLY_IF_ASKED = {purr: /cat|kitt|purr|pet/i, lullaby: /music|lullab|song|melod|box|sing/i, dreams: /music|piano|dream|melod|song/i};

export async function askMix(text, layers) {
  const ids = new Set(layers.map(l => l.id));
  const catalogue = layers.map(l => `- ${l.id}: ${l.label}`).join('\n');
  const prompt = `You mix calm sleep sounds for a young child's bedtime on a TV.
A parent asked for: "${String(text).slice(0, 200)}"

Available layers (use only these ids):
${catalogue}

Rules:
- Pick only the layers the request names or clearly implies (1 to 3), plus at most ONE quiet supporting layer if it truly helps. Do not add animals or music unless asked.
- Levels from 0.1 to 0.9: the main sound 0.6-0.8. Anything described as "a little", "a bit of", "soft" or "distant" gets 0.2-0.35.
- If the parent says "no X" or "without X", leave X out. Never add anything loud or startling.
- "name": a cozy 2-5 word title for the mix (no quotes, no emoji).
- "line": one short, warm sentence Bear says to the child about the sound (max 14 words, no exclamation marks).

Answer with JSON only: {"name": "...", "mix": {"layer_id": level, ...}, "line": "..."}`;
  try {
    const out = await viaNovaApi(prompt).catch(() => viaNovaApi(prompt)).then(r => r.text); // one retry
    const json = JSON.parse(out.slice(out.indexOf('{'), out.lastIndexOf('}') + 1));
    const mix = {};
    for (const [id, v] of Object.entries(json.mix || {})) {
      const n = Number(v);
      if (ids.has(id) && n > 0.05 && (!ONLY_IF_ASKED[id] || ONLY_IF_ASKED[id].test(text))) mix[id] = Math.round(Math.min(0.9, n) * 100) / 100;
    }
    const top = Object.entries(mix).sort((a, b) => b[1] - a[1]).slice(0, 5);
    if (!top.length) return null;
    const name = String(json.name || '').replace(/["*]/g, '').trim().slice(0, 40) || 'Bear\'s mix';
    const line = String(json.line || '').trim();
    return {name, mix: Object.fromEntries(top), line: line && line.length < 120 && !BANNED.test(line) ? line : ''};
  } catch (e) {
    console.warn('[mix] Nova unavailable:', e.message);
    return null;
  }
}
