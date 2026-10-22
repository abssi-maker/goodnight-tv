import {makeSynth, SynthId} from '../src/audio/noise';

const render = (id: SynthId, seconds = 6) => {
  const g = makeSynth(id);
  const x = new Float32Array(24000 * seconds);
  for (let i = 0; i < x.length; i++) {
    x[i] = g.next();
  }
  return x.subarray(24000); // skip the filters' first second
};
const rms = (x: Float32Array) => Math.sqrt(x.reduce((a, v) => a + v * v, 0) / x.length);
const peak = (x: Float32Array) => x.reduce((a, v) => Math.max(a, Math.abs(v)), 0);

// Goertzel power of `x` at frequency f (24 kHz sample rate), averaged over neighbours to tame variance.
function band(x: Float32Array, f: number) {
  let total = 0;
  for (const k of [0.94, 1, 1.06]) {
    const w = (2 * Math.PI * f * k) / 24000;
    const c = 2 * Math.cos(w);
    let s1 = 0;
    let s2 = 0;
    for (let i = 0; i < x.length; i++) {
      const s = x[i] + c * s1 - s2;
      s2 = s1;
      s1 = s;
    }
    total += s1 * s1 + s2 * s2 - c * s1 * s2;
  }
  return total;
}

describe('sounds generated on the TV', () => {
  it('white, pink and brown noise are about equally loud, so levels mean the same thing', () => {
    const levels = (['white', 'pink', 'brown'] as const).map(id => rms(render(id)));
    for (const l of levels) {
      expect(l).toBeGreaterThan(0.06);
      expect(l).toBeLessThan(0.3);
    }
    expect(Math.max(...levels) / Math.min(...levels)).toBeLessThan(2.5);
  });

  it('the colours are right: brown is darker than pink, pink darker than white', () => {
    const tilt = (id: SynthId) => {
      const x = render(id, 4);
      return band(x, 200) / band(x, 4000);
    };
    expect(tilt('brown')).toBeGreaterThan(tilt('pink'));
    expect(tilt('pink')).toBeGreaterThan(tilt('white'));
  });

  it('nothing clips', () => {
    for (const id of ['white', 'pink', 'brown'] as const) {
      expect(peak(render(id, 12))).toBeLessThan(1);
    }
  });

});
