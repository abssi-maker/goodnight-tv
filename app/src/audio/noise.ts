// The layers of tonight's sound that are generated on the TV, sample by sample (24 kHz), so they
// work without the hub: white, pink and brown noise. Soundscapes (rain, ocean, campfire…, composed
// by Lyria) come from the hub as loops (see engine.ts).
// Noises sit at RMS ≈ 0.16, like the recorded loops, so levels mean the same thing everywhere.

export const RATE = 24000;
const white = () => Math.random() * 2 - 1;

class Biquad {
  private x1 = 0;
  private x2 = 0;
  private y1 = 0;
  private y2 = 0;
  constructor(private b0: number, private b1: number, private b2: number, private a1: number, private a2: number) {}
  static bandpass(f0: number, q: number) {
    const w = (2 * Math.PI * f0) / RATE;
    const alpha = Math.sin(w) / (2 * q);
    const a0 = 1 + alpha;
    return new Biquad(alpha / a0, 0, -alpha / a0, (-2 * Math.cos(w)) / a0, (1 - alpha) / a0);
  }
  static lowpass(f0: number, q = 0.707) {
    const w = (2 * Math.PI * f0) / RATE;
    const alpha = Math.sin(w) / (2 * q);
    const c = Math.cos(w);
    const a0 = 1 + alpha;
    return new Biquad((1 - c) / 2 / a0, (1 - c) / a0, (1 - c) / 2 / a0, (-2 * c) / a0, (1 - alpha) / a0);
  }
  static highpass(f0: number, q = 0.707) {
    const w = (2 * Math.PI * f0) / RATE;
    const alpha = Math.sin(w) / (2 * q);
    const c = Math.cos(w);
    const a0 = 1 + alpha;
    return new Biquad((1 + c) / 2 / a0, -(1 + c) / a0, (1 + c) / 2 / a0, (-2 * c) / a0, (1 - alpha) / a0);
  }
  run(x: number) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1;
    this.x1 = x;
    this.y2 = this.y1;
    this.y1 = y;
    return y;
  }
}

/** Pink noise (Paul Kellet's economy filter), unit-ish RMS ≈ 0.3. */
class Pink {
  private b0 = 0;
  private b1 = 0;
  private b2 = 0;
  next() {
    const w = white();
    this.b0 = 0.99765 * this.b0 + w * 0.099046;
    this.b1 = 0.963 * this.b1 + w * 0.2965164;
    this.b2 = 0.57 * this.b2 + w * 1.0526913;
    return (this.b0 + this.b1 + this.b2 + w * 0.1848) * 0.11;
  }
}

/** Brown noise (integrated white), for low rumble. */
class Brown {
  private v = 0;
  next() {
    this.v = (this.v + 0.02 * white()) / 1.02;
    return this.v * 3.5;
  }
}

/** A slow random wobble between lo and hi, changing over `seconds`. */
class Drift {
  private v = 0.5;
  private target = 0.5;
  private n = 0;
  constructor(private lo: number, private hi: number, private seconds: number) {}
  next() {
    if (--this.n <= 0) {
      this.target = Math.random();
      this.n = Math.floor(this.seconds * RATE * (0.6 + Math.random() * 0.8));
    }
    this.v += (this.target - this.v) / (this.seconds * RATE * 0.5);
    return this.lo + (this.hi - this.lo) * this.v;
  }
}

export interface Gen {
  next(): number;
}

class White implements Gen {
  next() {
    return white() * 0.28;
  }
}

class PinkNoise implements Gen {
  private pink = new Pink();
  private lp = Biquad.lowpass(6000);
  next() {
    return this.lp.run(this.pink.next()) * 0.6;
  }
}

class BrownNoise implements Gen {
  private brown = new Brown();
  private hp = Biquad.highpass(30);
  private air = new Drift(0.85, 1.05, 8);
  next() {
    return this.hp.run(this.brown.next()) * 0.55 * this.air.next();
  }
}

export type SynthId = 'white' | 'pink' | 'brown';
export const makeSynth = (id: SynthId): Gen => (id === 'white' ? new White() : id === 'pink' ? new PinkNoise() : new BrownNoise());
