import {aboutMinutes, clock, DEFAULT_SETTINGS, isShortTonight, readyAt, tonight} from '../src/routine';
import {sanitize} from '../src/store';
import {taleMinutes, TALES} from '../src/stories';

const at = (h: number, m: number) => new Date(2026, 9, 20, h, m);

describe('routine', () => {
  it('the default evening matches the design: about 20 minutes, ready for bed at 7:50 PM', () => {
    const plan = tonight(DEFAULT_SETTINGS, false);
    expect(plan.map(x => x.kind)).toEqual(['teeth', 'pajamas', 'lights', 'story', 'goodnight']);
    expect(aboutMinutes(plan)).toBe(20);
    expect(clock(readyAt(DEFAULT_SETTINGS))).toBe('7:50 PM');
  });

  it('goodnight always closes the evening, even if switched off', () => {
    const s = {...DEFAULT_SETTINGS, steps: DEFAULT_SETTINGS.steps.map(x => ({...x, on: x.kind === 'teeth'}))};
    expect(tonight(s, false).map(x => x.kind)).toEqual(['teeth', 'goodnight']);
  });

  it('a short night halves every step, never below a minute', () => {
    const plan = tonight(DEFAULT_SETTINGS, true);
    expect(plan.find(x => x.kind === 'teeth')!.minutes).toBe(1);
    expect(plan.find(x => x.kind === 'story')!.minutes).toBe(4);
  });

  it('is short only when running more than 15 minutes late, and only if allowed', () => {
    expect(isShortTonight(DEFAULT_SETTINGS, at(19, 40))).toBe(false);
    expect(isShortTonight(DEFAULT_SETTINGS, at(19, 50))).toBe(true);
    expect(isShortTonight({...DEFAULT_SETTINGS, short: false}, at(19, 50))).toBe(false);
    expect(isShortTonight(DEFAULT_SETTINGS, at(9, 0))).toBe(false);
  });

  it('stored settings are checked: bad values fall back, minutes stay in range', () => {
    const s = sanitize({steps: [{kind: 'teeth', minutes: 99}, {kind: 'nope', minutes: 2}], preset: 'loud', mix: {ocean: 3, bogus: 1, campfire: 0, ai_0a1b2c3d4e: 0.5}, voice: 3, start: -30});
    expect(s.steps).toEqual([{kind: 'teeth', minutes: 4, on: true}]);
    expect(s.preset).toBe('rain');
    expect(s.mix).toEqual({ocean: 1, ai_0a1b2c3d4e: 0.5});
    expect(s.voice).toBe(DEFAULT_SETTINGS.voice);
    expect(clock(s.start)).toBe('11:30 PM');
    expect(sanitize(null)).toBe(DEFAULT_SETTINGS);
    expect(sanitize({candleSeconds: 20}).candleSeconds).toBe(20);
    expect(sanitize({candleSeconds: 7}).candleSeconds).toBe(0); // only the offered speeds
  });
});

describe('stories', () => {
  it('wind down: no exclamation marks after the first chapter', () => {
    for (const t of TALES) {
      t.chapters.slice(1).forEach(c => expect(c.join(' ')).not.toMatch(/!/));
    }
  });

  it('fit between page turns: no chapter runs longer than ~4 minutes (Fire TV turns the display off after ~5 idle)', () => {
    for (const t of TALES) {
      for (const c of t.chapters) {
        expect(c.join(' ').split(/\s+/).length / 95).toBeLessThan(4);
      }
    }
  });

  it('reports a believable length', () => {
    expect(taleMinutes(TALES[0], false)).toBeGreaterThanOrEqual(6);
    expect(taleMinutes(TALES[0], true)).toBeLessThan(taleMinutes(TALES[0], false));
  });
});

describe('ask for a sound (offline words)', () => {
  const {mixFromWords} = require('../src/sounds');
  it('rain on a tent with a little stream', () => {
    const {mix} = mixFromWords('rain on a tent with a little stream');
    expect(mix.rain).toBeGreaterThan(0.3);
    expect(mix.brook).toBeLessThanOrEqual(0.3);
  });
  it('respects "no": ocean waves, no fire', () => {
    const {mix} = mixFromWords('ocean waves, no fire');
    expect(mix.ocean).toBeGreaterThan(0.3);
    expect(mix.campfire).toBeUndefined();
    expect(mix.fireplace).toBeUndefined();
  });
});
