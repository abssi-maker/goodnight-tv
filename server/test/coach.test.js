import {test} from 'node:test';
import assert from 'node:assert/strict';
import {coachTip} from '../coach.js';
import {check} from '../storyAI.js';

const night = (dayOffset, darkH, darkM, steps = {}) => {
  const d = new Date(2026, 9, 20 + dayOffset, darkH, darkM);
  return {startedAt: d.getTime() - 22 * 60000, darkAt: d.getTime(), steps, plan: {lightsOutMinutes: 20 * 60}};
};

test('faded bedtime: lights out drifting late means start earlier', () => {
  const tip = coachTip([night(0, 20, 25), night(1, 20, 30)]);
  assert.equal(tip.kind, 'start-earlier');
  assert.match(tip.text, /10 minutes earlier/);
});

test('a slow step gets one practical fix', () => {
  const tip = coachTip([night(0, 20, 2, {pajamas: 560}), night(1, 20, 4, {pajamas: 600})]);
  assert.equal(tip.kind, 'slow-step');
  assert.match(tip.text, /pajamas out/);
});

test('on track: keep it the same, with the real number', () => {
  const tip = coachTip([night(0, 20, 1)]);
  assert.equal(tip.kind, 'on-track');
  assert.match(tip.text, /22 minutes/);
});

test('story checks reject a frightening or shapeless story', () => {
  const words = [[28, 42], [24, 36], [16, 28], [12, 22]];
  const w = n => Array(n).fill('soft').join(' ');
  const good = {title: 'A Calm Night', scenes: [w(34), w(30), w(18) + ' yawn', w(14) + ' breathed'], ending: ['a.', 'b.', 'c.', 'Goodnight, Leo.']};
  assert.doesNotThrow(() => check(good, words, 'Leo'));
  assert.throws(() => check({...good, scenes: [w(34) + ' monster', ...good.scenes.slice(1)]}, words, 'Leo'), /banned/);
  assert.throws(() => check({...good, ending: ['a.', 'b.', 'c.', 'The end!']}, words, 'Leo'), /exclamation/);
});
