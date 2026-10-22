// Build tonight's sound layers:
//   nature: real field recordings from Wikimedia Commons (design/sounds/commons/raw, credits in
//           design/sounds/CREDITS.md), the steadiest stretch made into a seamless loop
//   music:  two soundscapes composed by Lyria 3 (design/sounds/lyria)
// Writes server/cache/loops/<id>.pcm and an MP3 preview (two passes, to hear the seam) per layer
// into design/sounds/. Run: node tools/loops.js
import {execFileSync} from 'node:child_process';
import {makeLoop, LOOP_DIR} from '../loop.js';

const RAW = '../design/sounds/commons/raw';
const LYRIA = '../design/sounds/lyria';
// id: [source file(s), loop seconds]; two sources are mixed (richer, less repetitive)
const PLAN = {
  rain: [[`${RAW}/rain_window.ogg`], 40],
  rain_soft: [[`${RAW}/rain_light.ogg`], 40],
  rain_trees: [[`${RAW}/rain_leaves.wav`], 45],
  ocean: [[`${RAW}/ocean.ogg`], 60],
  river: [[`${RAW}/stream.wav`], 45],
  brook: [[`${RAW}/brook.ogg`], 14],
  campfire: [[`${RAW}/bonfire.ogg`, `${RAW}/fire.ogg`], 45],
  fireplace: [[`${RAW}/fire_cat.ogg`], 32],
  wind: [[`${RAW}/wind.wav`], 45],
  crickets: [[`${RAW}/crickets.ogg`], 35],
  purr: [[`${RAW}/purr.ogg`], 30],
  lullaby: [[`${LYRIA}/lullaby.mp3`], 24],
  dreams: [[`${LYRIA}/dreams.mp3`], 24],
};

for (const [id, [files, seconds]] of Object.entries(PLAN)) {
  let src = files[0];
  if (files.length > 1) {
    src = `cache/mix-${id}.wav`;
    const ins = files.flatMap(f => ['-stream_loop', '-1', '-i', f]);
    const norm = files.map((_, i) => `[${i}]loudnorm=I=-26[a${i}]`).join(';');
    execFileSync('ffmpeg', ['-loglevel', 'error', '-y', ...ins, '-filter_complex', `${norm};${files.map((_, i) => `[a${i}]`).join('')}amix=inputs=${files.length}:normalize=0`, '-t', String(seconds + 8), '-ac', '1', '-ar', '24000', src]);
  }
  const r = await makeLoop(src, id, seconds);
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 's16le', '-ar', '24000', '-ac', '1', '-i', `${LOOP_DIR}/${id}.pcm`, '-af', `aloop=loop=1:size=${Math.round(r.seconds * 24000)}`, '-b:a', '96k', `../design/sounds/${id}.mp3`]);
  console.log(`${id.padEnd(11)} ${r.seconds} s from @${r.start} s · steadiness ${r.steadiness}`);
}
