// Audio on the TV: raw 24 kHz mono PCM through keplerscript-audio-lib's AudioPlaybackStream.
// (URL-mode AudioPlayer is unreliable on the Virtual Device; see friction-log.md.)
//
// Two tracks:
//   voice: Bear's recorded voice (flushable, e.g. when the child presses Back).
//   bed:   tonight's sound, a mix of layers (looped field recordings from the hub + noises and a
//          music box generated here), plus soft chimes and the lights-out click.
// If the platform refuses a second stream, everything is mixed into one.
import {
  AudioChannelMask,
  AudioContentType,
  AudioFlags,
  AudioPlaybackStream,
  AudioPlaybackStreamBuilder,
  AudioSampleFormat,
  AudioSampleRate,
  AudioUsageType,
} from '@amazon-devices/keplerscript-audio-lib';
import {Gen, makeSynth, SynthId} from './noise';
import {isRecorded, LayerId, Mix} from '../sounds';

type Layer = {id: LayerId; src: Gen | Int16Array | null; pos: number; gain: number; target: number; step: number; want: number};

const RATE = 24000;
const CHUNK = 960; // 40 ms
const LEAD = RATE * 0.24; // keep ~240 ms queued in the native buffer
const TICK_MS = 40;

type Fill = (out: Float32Array) => void;

/** A native call that may never return (a stalled stream): give up waiting after `ms`. */
const within = <T,>(p: Promise<T>, ms: number) => Promise.race([p, new Promise<void>(r => setTimeout(r, ms))]);

class Track {
  stream: AudioPlaybackStream | null = null;
  private t0 = 0;
  private written = 0;
  private writing = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private buf = new Float32Array(CHUNK);
  private pcm = new Int16Array(CHUNK);
  resyncs = 0;

  constructor(readonly name: string, private fill: Fill, private onChunk?: (pcm: Float32Array, playAt: number) => void) {}

  async start(usage: AudioUsageType, contentType: AudioContentType) {
    const b = new AudioPlaybackStreamBuilder();
    b.setAudioConfig({
      sampleRate: AudioSampleRate.SAMPLE_RATE_24_KHZ,
      channelMask: AudioChannelMask.CHANNEL_MONO,
      format: AudioSampleFormat.FORMAT_PCM_16_BIT,
    } as any);
    b.setAudioAttributes({contentType, usage, flags: AudioFlags.FLAG_NONE, tag: `goodnight-${this.name}`} as any);
    this.stream = await b.buildAsync();
    await this.stream.startAsync();
    this.t0 = Date.now();
    this.written = 0;
    this.timer = setInterval(() => this.pump(), TICK_MS);
    this.pump();
  }

  private async pump() {
    if (this.writing || !this.stream) {
      return;
    }
    this.writing = true;
    try {
      const played = ((Date.now() - this.t0) / 1000) * RATE;
      if (played > this.written) {
        // We fell behind (JS stall): the device has underrun. Resync instead of bursting.
        this.resyncs++;
        this.t0 = Date.now();
        this.written = 0;
      }
      while (this.stream && this.written < ((Date.now() - this.t0) / 1000) * RATE + LEAD) {
        this.buf.fill(0);
        this.fill(this.buf);
        for (let i = 0; i < CHUNK; i++) {
          const v = this.buf[i];
          this.pcm[i] = v >= 1 ? 32767 : v <= -1 ? -32768 : (v * 32767) | 0;
        }
        const playAt = this.t0 + (this.written / RATE) * 1000;
        this.onChunk?.(this.buf, playAt);
        await this.stream.writeAsync(this.pcm.buffer.slice(0) as ArrayBuffer);
        this.written += CHUNK;
      }
    } catch (e) {
      console.warn(`[audio:${this.name}] write failed`, e);
    } finally {
      this.writing = false;
    }
  }

  /** Drop everything already queued in the native buffer. */
  async flush() {
    if (!this.stream) {
      return;
    }
    await this.stream.pauseAsync();
    await this.stream.flushAsync();
    await this.stream.startAsync();
    this.t0 = Date.now();
    this.written = 0;
  }

  async underruns(): Promise<number> {
    try {
      // telemetry must not queue up behind a stalled stream
      return this.stream ? ((await within(this.stream.getUnderrunCountAsync(), 500)) ?? -1) : -1;
    } catch {
      return -1;
    }
  }

  async stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    const s = this.stream;
    this.stream = null;
    if (s) {
      // a stream whose writes are stuck may not answer stop either; don't hold the next start hostage
      await within(
        (async () => {
          try {
            await s.stopAsync();
            await AudioPlaybackStreamBuilder.destroyAsync(s);
          } catch {}
        })(),
        1500,
      );
    }
  }
}

/** FIFO of PCM samples (float -1..1). */
class Queue {
  private parts: Float32Array[] = [];
  private pos = 0;
  length = 0;
  push(p: Float32Array) {
    this.parts.push(p);
    this.length += p.length;
  }
  clear() {
    this.parts = [];
    this.pos = 0;
    this.length = 0;
  }
  /** Mix up to out.length samples into out (adds, scaled by gain). Returns samples read. */
  mixInto(out: Float32Array, gain: number): number {
    let i = 0;
    while (i < out.length && this.parts.length) {
      const p = this.parts[0];
      const n = Math.min(out.length - i, p.length - this.pos);
      for (let k = 0; k < n; k++) {
        out[i + k] += p[this.pos + k] * gain;
      }
      i += n;
      this.pos += n;
      this.length -= n;
      if (this.pos >= p.length) {
        this.parts.shift();
        this.pos = 0;
      }
    }
    return i;
  }
}

/** Sine notes with soft attack and long decay: [[frequency, seconds], ...]. */
function tones(notes: Array<[number, number]>, gain: number): Float32Array {
  const total = notes.reduce((a, [, d]) => a + d, 0);
  const out = new Float32Array(Math.floor(RATE * (total + 0.8)));
  let start = 0;
  for (const [f, d] of notes) {
    const s0 = Math.floor(start * RATE);
    const len = Math.floor((d + 0.8) * RATE);
    for (let i = 0; i < len && s0 + i < out.length; i++) {
      const tt = i / RATE;
      const env = Math.min(1, tt / 0.02) * Math.exp(-tt * 3.2);
      out[s0 + i] += Math.sin(2 * Math.PI * f * tt) * env * gain;
    }
    start += d;
  }
  return out;
}

export const int16ToFloat = (a: Int16Array) => {
  const f = new Float32Array(a.length);
  for (let i = 0; i < a.length; i++) {
    f[i] = a[i] / 32768;
  }
  return f;
};

export type AudioStats = {underrunsVoice: number; underrunsBed: number; resyncs: number; tracks: number; flushMs: number | null};

class Engine {
  private voiceQ = new Queue();
  private fx = new Queue();
  private layers = new Map<LayerId, Layer>();
  private loops = new Map<LayerId, Int16Array>();
  private mixBuf = new Float32Array(CHUNK);
  /** Asked when a recorded layer is needed and not loaded yet (the hub sends it). */
  onNeedLoop: ((id: LayerId) => void) | null = null;
  private voice: Track | null = null;
  private bed: Track | null = null;
  private single = false;
  started = false;
  failed: string | null = null;

  // gains
  voiceGain = 1;
  private noiseGain = 0;
  private noiseTarget = 0;
  private noiseStep = 0;
  private duck = 1;

  /** Mouth openness 0–1, following the bear audio as it is heard. */
  level = 0;
  private levels: Array<[number, number]> = [];
  private voiceWasBusy = false;
  onVoiceIdle: (() => void) | null = null;
  lastFlushMs: number | null = null;
  private fxGain = 1;
  private fxFade = 1;
  private heardUntil = 0;
  private levelTimer: ReturnType<typeof setInterval> | null = null;
  /** start() and stopAll() run one after the other: a quick Back → Start must not end with no streams. */
  private op: Promise<void> = Promise.resolve();
  private flushing = false;

  start() {
    this.op = this.op.then(() => this.open());
    return this.op;
  }

  private async open() {
    if (this.started) {
      return;
    }
    this.started = true;
    this.fxFade = 1;
    const voiceFill: Fill = out => this.fillVoice(out);
    const bedFill: Fill = out => this.fillBed(out);
    const meter = (pcm: Float32Array, playAt: number) => {
      let s = 0;
      for (let i = 0; i < pcm.length; i += 4) {
        s += pcm[i] * pcm[i];
      }
      this.levels.push([playAt, Math.min(1, Math.sqrt(s / (pcm.length / 4)) * 5)]);
    };
    try {
      this.voice = new Track('voice', voiceFill, meter);
      await this.voice.start(AudioUsageType.USAGE_MEDIA, AudioContentType.CONTENT_TYPE_SPEECH);
      try {
        this.bed = new Track('bed', bedFill);
        await this.bed.start(AudioUsageType.USAGE_MEDIA, AudioContentType.CONTENT_TYPE_MUSIC);
      } catch (e) {
        console.warn('[audio] second stream refused, mixing into one', e);
        this.bed = null;
        this.single = true;
      }
    } catch (e: any) {
      this.failed = String(e?.message ?? e);
      console.warn('[audio] could not start', e);
    }
    this.levelTimer = this.levelTimer ?? setInterval(() => this.tickLevel(), 50);
  }

  private fillVoice(out: Float32Array) {
    const n = this.voiceQ.mixInto(out, this.voiceGain);
    this.voiceOut += n;
    const busy = n > 0;
    if (busy) {
      this.heardUntil = Date.now() + (LEAD / RATE) * 1000; // still in the native buffer for LEAD ms
    }
    if (this.voiceWasBusy && !busy && this.voiceQ.length === 0) {
      // queue just drained; it will be heard for another LEAD ms
      setTimeout(() => this.onVoiceIdle?.(), (LEAD / RATE) * 1000);
    }
    this.voiceWasBusy = busy;
    if (this.single) {
      this.fillBed(out);
    }
  }

  private fillBed(out: Float32Array) {
    // every layer glides to its level; the whole bed follows the master fade, and ducks a little
    // under Bear's voice
    const n = out.length;
    const mix = this.mixBuf.length === n ? this.mixBuf : (this.mixBuf = new Float32Array(n));
    mix.fill(0);
    for (const l of this.layers.values()) {
      const src = l.src;
      if (!src) {
        continue;
      }
      let g = l.gain;
      if (src instanceof Int16Array) {
        const len = src.length;
        let pos = l.pos;
        for (let i = 0; i < n; i++) {
          if (g !== l.target) {
            g += l.step;
            if ((l.step > 0 && g > l.target) || (l.step < 0 && g < l.target)) {
              g = l.target;
            }
          }
          mix[i] += src[pos] * 3.0518e-5 * g;
          pos = pos + 1 === len ? 0 : pos + 1;
        }
        l.pos = pos;
      } else {
        for (let i = 0; i < n; i++) {
          if (g !== l.target) {
            g += l.step;
            if ((l.step > 0 && g > l.target) || (l.step < 0 && g < l.target)) {
              g = l.target;
            }
          }
          mix[i] += src.next() * g;
        }
      }
      l.gain = g;
      if (g === 0 && l.want === 0) {
        this.layers.delete(l.id);
      }
    }
    const talking = this.voiceQ.length > 0;
    this.duck += ((talking ? 0.6 : 1) - this.duck) * 0.08;
    for (let i = 0; i < n; i++) {
      if (this.noiseGain !== this.noiseTarget) {
        this.noiseGain += this.noiseStep;
        if ((this.noiseStep > 0 && this.noiseGain > this.noiseTarget) || (this.noiseStep < 0 && this.noiseGain < this.noiseTarget)) {
          this.noiseGain = this.noiseTarget;
        }
      }
      out[i] += mix[i] * this.noiseGain * this.duck;
    }
    this.fx.mixInto(out, this.fxGain);
  }

  private tickLevel() {
    const now = Date.now();
    let v = 0;
    while (this.levels.length && this.levels[0][0] <= now) {
      v = this.levels.shift()![1];
    }
    this.level += (v - this.level) * 0.6;
  }

  get voiceBusy() {
    return this.voiceQ.length > 0;
  }

  /** True once the bear's last queued sample has actually been played out. */
  get voiceIdle() {
    return this.voiceQ.length === 0 && Date.now() > this.heardUntil;
  }

  pushVoice(pcm: Int16Array) {
    this.voiceQ.push(int16ToFloat(pcm));
    this.voiceIn += pcm.length;
  }

  /** Voice diagnostics for telemetry: samples received, still queued, played out. */
  voiceIn = 0;
  voiceOut = 0;
  get voiceQueued() {
    return this.voiceQ.length;
  }

  /** A soft two-note chime (step done). Quieter each time, like the rest of the evening. */
  chime() {
    this.fx.push(tones([[784, 0.35], [1047, 0.6]], 0.22 * this.fxFade));
    this.fxFade = Math.max(0.35, this.fxFade * 0.85);
  }

  /** The lights-out click and a low breath of air. */
  click() {
    const n = Math.floor(RATE * 0.5);
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const tt = i / RATE;
      const clickEnv = tt < 0.012 ? 1 - tt / 0.012 : 0;
      out[i] = (Math.random() * 2 - 1) * (clickEnv * 0.5 + 0.06 * Math.exp(-tt * 6) * Math.min(1, tt * 20));
    }
    this.fx.push(out);
  }

  /** A candle blown out: a soft breath of air, "phff". */
  blowOut() {
    const n = Math.floor(RATE * 0.9);
    const out = new Float32Array(n);
    let lp = 0;
    for (let i = 0; i < n; i++) {
      const tt = i / RATE;
      const env = Math.min(1, tt / 0.04) * Math.exp(-tt * 4.5);
      lp += ((Math.random() * 2 - 1) - lp) * 0.18; // a soft, breathy low-pass
      out[i] = lp * env * 0.55;
    }
    this.fx.push(out);
  }

  /**
   * Stop Bear mid-line (a button press, Back). The queue is dropped at once; the native buffer is
   * flushed too, but the routine waits at most 300 ms for it: on a stalled stream the flush can take
   * as long as the stall, and the child's press must still move the evening on.
   */
  async stopVoice() {
    const t = Date.now();
    this.voiceQ.clear();
    this.levels = [];
    this.voiceWasBusy = false;
    this.heardUntil = 0;
    const v = this.voice;
    if (!v || this.flushing || (this.single && this.fx.length > 0)) {
      return; // single-stream mode: only flush when it won't cut a chime
    }
    this.flushing = true;
    const done = v
      .flush()
      .catch(() => {})
      .finally(() => {
        this.flushing = false;
        this.lastFlushMs = Date.now() - t;
      });
    await within(done, 300);
  }

  /** Fade the whole bed (tonight's sound) to `gain` (0–1) over `seconds`. */
  setNoise(gain: number, seconds: number) {
    this.noiseTarget = gain;
    this.noiseStep = (gain - this.noiseGain) / Math.max(1, seconds * RATE);
  }

  private glide(l: Layer, to: number, seconds: number) {
    l.target = to;
    l.step = (to - l.gain) / Math.max(1, seconds * RATE);
  }

  /** Tonight's mix: each layer glides to its level (perceptual curve); layers not in it fade out. */
  setMix(mix: Mix, seconds = 2) {
    for (const id of new Set([...Object.keys(mix), ...this.layers.keys()])) {
      const level = mix[id] ?? 0;
      const want = level > 0.01 ? Math.pow(level, 1.4) : 0;
      let l = this.layers.get(id);
      if (!l && want > 0) {
        const src = isRecorded(id) ? this.loops.get(id) ?? null : makeSynth(id as SynthId);
        l = {id, src, pos: src instanceof Int16Array ? Math.floor(Math.random() * src.length) : 0, gain: 0, target: 0, step: 0, want};
        this.layers.set(id, l);
        if (!src) {
          this.onNeedLoop?.(id);
        }
      }
      if (l) {
        l.want = want;
        if (l.src) {
          this.glide(l, want, seconds);
        }
      }
    }
  }

  /** A recorded layer arrived from the hub: keep it, and fade it in if the mix wants it. */
  provideLoop(id: LayerId, pcm: Int16Array) {
    this.loops.set(id, pcm);
    const l = this.layers.get(id);
    if (l && !l.src) {
      l.src = pcm;
      l.pos = Math.floor(Math.random() * pcm.length);
      this.glide(l, l.want, 2.5);
    }
  }

  hasLoop(id: LayerId) {
    return this.loops.has(id);
  }

  get noiseLevel() {
    return this.noiseGain;
  }

  async stats(): Promise<AudioStats> {
    return {
      underrunsVoice: this.voice ? await this.voice.underruns() : -1,
      underrunsBed: this.bed ? await this.bed.underruns() : -1,
      resyncs: (this.voice?.resyncs ?? 0) + (this.bed?.resyncs ?? 0),
      tracks: this.single ? 1 : this.bed ? 2 : this.voice ? 1 : 0,
      flushMs: this.lastFlushMs,
    };
  }

  stopAll() {
    this.voiceQ.clear();
    this.fx.clear();
    this.noiseGain = 0;
    this.noiseTarget = 0;
    this.noiseStep = 0;
    this.layers.clear(); // the loops stay cached, so tomorrow's bedtime needs no download
    this.op = this.op.then(() => this.close());
    return this.op;
  }

  private async close() {
    const {voice, bed} = this;
    this.voice = null;
    this.bed = null;
    await voice?.stop();
    await bed?.stop();
    this.single = false;
    this.started = false;
  }
}

export const audio = new Engine();
