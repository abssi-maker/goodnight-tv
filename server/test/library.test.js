import {test} from 'node:test';
import assert from 'node:assert/strict';
import {WORLDS, buildStory, choices} from '../stories.js';
import {LINES} from '../lines.js';
import {plan, sleepWindow} from '../plan.js';

const words = s => s.split(/\s+/).length;

test('every pick combination in every world builds a complete wind-down story', () => {
  let n = 0;
  for (const [world, w] of Object.entries(WORLDS)) {
    for (const who of w.who) for (const where of w.where) for (const cozy of w.cozy) {
      for (const full of [false, true]) {
        const s = buildStory(world, {who: who.id, where, cozy}, 'Leo', {full});
        n++;
        assert.equal(s.scenes.length, 5);
        assert.equal(s.finalLines.length, 4);
        assert.ok(!/[{}]|undefined|null/.test([s.title, ...s.scenes, ...s.finalLines].join(' ')), `holes in ${s.id}`);
        // scenes 3 and 4 are shorter than the opening ones: the story slows down
        const [a, b, c, d] = s.scenes.map(words);
        assert.ok(c < Math.max(a, b) && d < Math.max(a, b), `${s.id} does not wind down: ${[a, b, c, d]}`);
        assert.match(s.scenes[4], /Goodnight, Leo\.$/);
        assert.ok(!/!/.test(s.scenes.join(' ')), 'no exclamation marks in a bedtime story');
      }
    }
  }
  assert.equal(n, 3 * 27 * 2);
});

test('the cards offer three choices per question', () => {
  for (const world of Object.keys(WORLDS)) {
    const c = choices(world);
    assert.deepEqual([c.who.length, c.where.length, c.cozy.length], [3, 3, 3]);
  }
});

test('lines after the big light is off have no exclamation marks', () => {
  for (const k of ['lightOff', 'pickWho', 'pickWhere', 'pickCozy', 'picked', 'lastFirefly', 'lastFireflyOut']) assert.ok(!LINES[k].includes('!'), k);
});

test('school-night plan works back from the alarm', () => {
  assert.deepEqual(plan({age: 5, wake: '07:00'}), {hours: 11, range: '10–13', lightsOut: '8:00', start: '7:40', wake: '7:00'});
  assert.equal(plan({age: 8, wake: '06:30'}).lightsOut, '8:30');
  const dark = new Date(2026, 9, 20, 20, 24).getTime();
  assert.equal(sleepWindow(dark, '07:00'), '10 h 36 min');
});
