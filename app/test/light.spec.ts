import {lightAt} from '../src/light';

const steps = Array.from({length: 19}, (_, i) => (i / 18) * 0.9);

describe('the light of the evening (the candle)', () => {
  it('only ever gets darker and warmer as the candle burns, never brighter', () => {
    for (const lamp of [false, true]) {
      const ls = steps.map(b => lightAt(b, lamp));
      for (let i = 1; i < ls.length; i++) {
        expect(ls[i].veil).toBeGreaterThanOrEqual(ls[i - 1].veil);
        expect(ls[i].dark).toBeGreaterThanOrEqual(ls[i - 1].dark);
        expect(ls[i].warm).toBeGreaterThanOrEqual(ls[i - 1].warm);
        expect(ls[i].cct).toBeLessThanOrEqual(ls[i - 1].cct);
      }
    }
  });

  it('is clearly visible: half-burned is noticeably darker and warmer than fresh', () => {
    const fresh = lightAt(0, false);
    const half = lightAt(0.45, false);
    expect(half.veil - fresh.veil).toBeGreaterThan(0.2);
    expect(half.warm - fresh.warm).toBeGreaterThan(0.2);
  });

  it('switching the big light off makes the candle the main light, and the room darker', () => {
    for (const b of steps) {
      const on = lightAt(b, false);
      const off = lightAt(b, true);
      expect(off.veil).toBeGreaterThan(on.veil);
      expect(off.dark).toBeGreaterThan(on.dark);
      expect(off.room).toBeGreaterThanOrEqual(on.room);
    }
  });

  it('ends candle-coloured (about 1900 K) and never fully black while the flame is lit', () => {
    const end = lightAt(0.9, true);
    expect(end.cct).toBeLessThan(2100);
    expect(end.veil).toBeLessThan(0.8);
  });
});
