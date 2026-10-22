// Turn a recording (or a Lyria clip) into a seamless sleep-sound loop for the TV.
//   - mono, 24 kHz, high-passed at 40 Hz, loudness-matched (EBU R128, -26 LUFS)
//   - the steadiest stretch is chosen (no swells, no sudden sounds)
//   - the end is crossfaded into the start (equal power), so the loop never clicks
// Writes cache/loops/<id>.pcm (s16le), which the hub streams to the TV in 1 s parts.
import {execFile} from 'node:child_process';
import {mkdirSync, writeFileSync} from 'node:fs';
import {promisify} from 'node:util';
const run = promisify(execFile);

const RATE = 24000;
export const LOOP_DIR = 'cache/loops';
mkdirSync(LOOP_DIR, {recursive: true});

async function decode(file) {
  const {stdout} = await run('ffmpeg', ['-loglevel', 'error', '-i', file, '-ac', '1', '-ar', String(RATE), '-af', 'highpass=f=40,loudnorm=I=-26:TP=-3:LRA=7', '-f', 'f32le', '-'], {encoding: 'buffer', maxBuffer: 1 << 30});
  return new Float32Array(stdout.buffer, stdout.byteOffset, stdout.length / 4);
}

/** Start of the steadiest window of `len` samples (lowest spread of 0.5 s loudness), skipping the edges. */
function steadiest(x, len) {
  const hop = RATE / 2;
  const rms = [];
  for (let i = 0; i + hop <= x.length; i += hop) {
    let s = 0;
    for (let k = i; k < i + hop; k++) s += x[k] * x[k];
    rms.push(Math.sqrt(s / hop));
  }
  const win = Math.ceil(len / hop);
  const edge = rms.length - win > 8 ? 4 : Math.max(0, Math.floor((rms.length - win) / 2));
  let best = edge;
  let bestScore = Infinity;
  for (let w = edge; w + win <= rms.length - edge; w++) {
    const seg = rms.slice(w, w + win);
    const mean = seg.reduce((a, b) => a + b, 0) / win || 1e-9;
    const sd = Math.sqrt(seg.reduce((a, b) => a + (b - mean) ** 2, 0) / win);
    const score = sd / mean + 0.5 * (Math.max(...seg) / mean - 1);
    if (score < bestScore) [bestScore, best] = [score, w];
  }
  return {start: best * hop, score: bestScore};
}

/** Make `<id>.pcm` from `file`. Returns the loop length and how steady the chosen stretch was. */
export async function makeLoop(file, id, seconds = 24, xfade = 3) {
  const x = await decode(file);
  const X = xfade * RATE;
  const L = Math.min(seconds * RATE, x.length - X - RATE);
  const {start, score} = steadiest(x, L + X);
  const s = x.subarray(start, start + L + X);
  const out = new Float32Array(L);
  for (let i = 0; i < L - X; i++) out[i] = s[i + X];
  for (let j = 0; j < X; j++) {
    const w = (j / X) * (Math.PI / 2);
    out[L - X + j] = s[L + j] * Math.cos(w) + s[j] * Math.sin(w);
  }
  let peak = 0;
  for (const v of out) peak = Math.max(peak, Math.abs(v));
  const g = Math.min(1, 0.7 / (peak || 1));
  const pcm = Buffer.alloc(L * 2);
  for (let i = 0; i < L; i++) pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, out[i] * g)) * 32767), i * 2);
  writeFileSync(`${LOOP_DIR}/${id}.pcm`, pcm);
  return {seconds: +(L / RATE).toFixed(1), start: +(start / RATE).toFixed(1), steadiness: +score.toFixed(2)};
}
