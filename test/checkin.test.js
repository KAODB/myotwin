// The morning check-in judged by engine.checkin (js/engine.js) from rules.CHECKIN and the three
// check-in thresholds (js/rules.js), set beside real nights of the simulator.
//
// Written with an SI tool (Claude) and reviewed by the team.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const sim = require('../js/sim.js');
const rules = require('../js/rules.js');
const engine = require('../js/engine.js');

const C = rules.CHECKIN;
const T = rules.THRESHOLDS;

function cardsAt(s, d) {
  const g = sim.generate(s);
  const i = g.records.findIndex((r) => r.missionDay === d);
  return engine.assess(g.records, i, { expectedChangePct: g.plan.expectedChangePct }).cards;
}
const MARS42 = cardsAt('S2', 42);     // muscle on Watch
const MARS62 = cardsAt('S2', 62);     // heart and breathing on Watch
const MOON36 = cardsAt('S1', 36);     // sleep on Report
const BASE = cardsAt('S2', -14);      // first baseline night: no check has data
const status = (cards, id) => cards.filter((c) => c.id === id)[0].status;

function input(o) {
  o = o || {};
  return { mood: o.mood == null ? null : o.mood, tempC: o.tempC == null ? null : o.tempC,
    symptoms: { legs: !!o.legs, tired: !!o.tired, ill: !!o.ill } };
}
const verdicts = (r) => r.rows.map((x) => x.card + ':' + x.verdict).join(' ');

test('the fixtures are the nights the brief names', () => {
  assert.strictEqual(status(MARS42, 'muscle'), 'amber');
  assert.strictEqual(status(MARS42, 'sleep'), 'green');
  assert.strictEqual(status(MARS62, 'cardio'), 'amber');
  assert.strictEqual(status(MOON36, 'sleep'), 'red');
  assert.ok(BASE.every((c) => c.status === 'grey'));
  assert.strictEqual(T.checkinTempRiseC.value, 1.1);
  assert.deepStrictEqual(T.checkinTempRiseC.sourceIds, ['V97']);
  assert.strictEqual(T.checkinBaselineTempC.value, 36.6);
  assert.strictEqual(T.checkinLowMoodAtMost.value, 2);
});

test('not done: grey, the prompt, no actions and no rows', () => {
  const r = engine.checkin(input(), MARS42);
  assert.strictEqual(r.done, false);
  assert.strictEqual(r.status, 'grey');
  assert.deepStrictEqual(r.flags, []);
  assert.strictEqual(r.temp, null);
  assert.strictEqual(r.meaning, C.meaning.notDone);
  assert.deepStrictEqual(r.actions, []);
  assert.deepStrictEqual(r.rows, []);
  assert.strictEqual(r.summary, '');
  assert.strictEqual(r.decides, 'You and the crew medical officer');
});

test('done with no flags: green, nothing needs action', () => {
  const r = engine.checkin(input({ mood: 4, tempC: 36.8 }), MARS62);
  assert.strictEqual(r.done, true);
  assert.strictEqual(r.status, 'green');
  assert.deepStrictEqual(r.flags, []);
  assert.strictEqual(r.meaning, 'Nothing in your check-in needs action today.');
  assert.deepStrictEqual(r.actions, ['No change needed.']);
  assert.deepStrictEqual(r.temp, { valueC: 36.8, baselineC: 36.6, riseC: 0.2, raised: false, low: false });
  // A mood alone counts as done.
  assert.strictEqual(engine.checkin(input({ mood: 3 }), MARS62).done, true);
});

test('temperature boundary in whole tenths: 37.7 is not raised, 37.8 is', () => {
  const a = engine.checkin(input({ tempC: 37.7 }), MARS42).temp;
  assert.strictEqual(a.raised, false);
  assert.strictEqual(a.riseC, 1.1);
  const b = engine.checkin(input({ tempC: 37.8 }), MARS42);
  assert.strictEqual(b.temp.raised, true);
  assert.strictEqual(b.temp.riseC, 1.2);
  assert.deepStrictEqual(b.flags, ['fever']);
  assert.strictEqual(b.status, 'amber');
});

test('fever: meaning and actions', () => {
  const r = engine.checkin(input({ tempC: 38.2 }), MARS42);
  assert.strictEqual(r.meaning, 'Your temperature is 1.6 °C above your own baseline of 36.6 °C. In care homes on Earth, a rise of more than 1.1 °C over a person\'s own baseline counts as fever.');
  assert.deepStrictEqual(r.actions, ['Tell the crew medical officer today.', 'Take your temperature again this evening.']);
});

test('ill without a temperature asks for one; with a normal temperature says so', () => {
  const a = engine.checkin(input({ ill: true }), MARS42);
  assert.deepStrictEqual(a.flags, ['ill']);
  assert.strictEqual(a.meaning, 'You feel ill this morning.');
  assert.deepStrictEqual(a.actions, ['Take your temperature and enter it here.']);
  const b = engine.checkin(input({ ill: true, tempC: 36.9 }), MARS42);
  assert.strictEqual(b.meaning, 'You feel ill this morning. Your temperature is within 1.1 °C of your own baseline.');
  assert.deepStrictEqual(b.actions, ['Tell the crew medical officer if you still feel ill this evening.']);
  // Ill with a fever: the fever flag stands for both.
  const c = engine.checkin(input({ ill: true, tempC: 37.9 }), MARS42);
  assert.deepStrictEqual(c.flags, ['fever']);
});

test('low mood: the word in lower case, the journal and the medic', () => {
  const r = engine.checkin(input({ mood: 2 }), MARS42);
  assert.deepStrictEqual(r.flags, ['mood']);
  assert.strictEqual(r.meaning, 'You rated your mood low this morning.');
  assert.deepStrictEqual(r.actions, ['Write a few lines in your journal. NASA encourages a regular journal as self-care.',
    'Tell the crew medical officer if your mood is still low tomorrow.']);
  assert.strictEqual(engine.checkin(input({ mood: 1 }), MARS42).meaning, 'You rated your mood very low this morning.');
  assert.deepStrictEqual(engine.checkin(input({ mood: 3 }), MARS42).flags, []);
});

test('legs and not rested: follow the check when the bunk agrees, else check in again', () => {
  const a = engine.checkin(input({ legs: true }), MARS42);
  assert.strictEqual(a.meaning, 'Your legs feel weaker or sore this morning.');
  assert.deepStrictEqual(a.actions, ['Do the muscle check\'s actions today.']);
  assert.deepStrictEqual(engine.checkin(input({ legs: true }), MARS62).actions, ['Check in again tomorrow.']);
  const b = engine.checkin(input({ tired: true }), MOON36);
  assert.strictEqual(b.meaning, 'You did not feel rested this morning.');
  assert.deepStrictEqual(b.actions, ['Do the sleep check\'s actions today.']);
  assert.deepStrictEqual(engine.checkin(input({ tired: true }), MARS42).actions, ['Check in again tomorrow.']);
});

test('more flags: the first one\'s sentence, then "Also noted"', () => {
  const r = engine.checkin(input({ mood: 2, legs: true, tired: true }), MARS62);
  assert.deepStrictEqual(r.flags, ['mood', 'legs', 'tired']);
  assert.strictEqual(r.meaning, 'You rated your mood low this morning. Also noted: legs weaker or sore, not rested.');
  // "Check in again tomorrow." appears once.
  assert.deepStrictEqual(r.actions, ['Write a few lines in your journal. NASA encourages a regular journal as self-care.',
    'Tell the crew medical officer if your mood is still low tomorrow.', 'Check in again tomorrow.']);
});

test('flag priority and the five-action cap', () => {
  const r = engine.checkin(input({ mood: 1, tempC: 38.4, legs: true, tired: true, ill: true }), MOON36);
  assert.deepStrictEqual(r.flags, ['fever', 'mood', 'legs', 'tired']);
  assert.strictEqual(r.meaning.split(' Also noted: ')[1], 'low mood, legs weaker or sore, not rested.');
  assert.strictEqual(r.actions.length, 5);
  assert.deepStrictEqual(r.actions, ['Tell the crew medical officer today.', 'Take your temperature again this evening.',
    'Write a few lines in your journal. NASA encourages a regular journal as self-care.',
    'Tell the crew medical officer if your mood is still low tomorrow.', 'Check in again tomorrow.']);
  const s = engine.checkin(input({ mood: 2, ill: true, legs: true }), MARS42);
  assert.deepStrictEqual(s.flags, ['ill', 'mood', 'legs']);
  assert.match(s.meaning, /^You feel ill this morning\. Also noted: low mood, legs weaker or sore\.$/);
});

test('all six verdicts on real nights', () => {
  // Mars night 42, nothing noticed: the bunk sees the muscle change.
  const a = engine.checkin(input({ mood: 4, tempC: 36.8 }), MARS42);
  assert.strictEqual(verdicts(a), 'muscle:bunk-only sleep:agree-clear cardio:agree-clear radiation:cannot-feel');
  assert.deepStrictEqual(a.rows.map((x) => x.said), [false, false, false, null]);
  assert.deepStrictEqual(a.rows.map((x) => x.bunk), ['amber', 'green', 'green', 'green']);
  // Mars night 62, feeling ill with a fever and sore legs: both agree on the heart; the legs only felt.
  const b = engine.checkin(input({ mood: 2, tempC: 38.2, legs: true, ill: true }), MARS62);
  assert.strictEqual(verdicts(b), 'muscle:self-only sleep:agree-clear cardio:agree-flag radiation:cannot-feel');
  // A fever alone counts as said on the heart row.
  assert.strictEqual(engine.checkin(input({ tempC: 38.2 }), MARS62).rows[2].verdict, 'agree-flag');
  // Moon night 36, not rested: both agree on sleep.
  assert.strictEqual(engine.checkin(input({ tired: true }), MOON36).rows[1].verdict, 'agree-flag');
  // First baseline night: nothing to compare with.
  const d = engine.checkin(input({ legs: true }), BASE);
  assert.strictEqual(verdicts(d), 'muscle:no-bunk sleep:no-bunk cardio:no-bunk radiation:cannot-feel');
  assert.strictEqual(C.verdicts['self-only'], 'You notice it and the bunk does not show it. Your answer still counts.');
  for (const v of ['agree-clear', 'bunk-only', 'self-only', 'agree-flag', 'no-bunk', 'cannot-feel']) assert.ok(C.verdicts[v], v);
});

test('the one-line summary for the first screen', () => {
  assert.strictEqual(engine.checkin(input({ mood: 4, tempC: 36.8 }), MARS42).summary, 'mood good; 36.8 °C; nothing else');
  assert.strictEqual(engine.checkin(input({ tempC: 37.9, ill: true }), MARS42).summary, '37.9 °C (1.3 °C above your baseline); feeling ill');
  assert.strictEqual(engine.checkin(input({ legs: true }), MARS42).summary, 'legs weaker or sore');
  assert.strictEqual(engine.checkin(input({ tempC: 37 }), MARS42).summary, '37.0 °C; nothing else');
  assert.strictEqual(engine.checkin(input({ mood: 2, legs: true, tired: true, ill: true }), MARS42).summary,
    'mood low; legs weaker or sore; not rested; feeling ill');
});

test('every meaning, action and summary is filled', () => {
  const nights = [MARS42, MARS62, MOON36, BASE];
  for (let mood = 0; mood <= 5; mood++) {
    for (const tempC of [null, 36.6, 37.7, 37.8, 41.9]) {
      for (let m = 0; m < 8; m++) {
        for (const cards of nights) {
          const r = engine.checkin(input({ mood: mood || null, tempC, legs: !!(m & 1), tired: !!(m & 2), ill: !!(m & 4) }), cards);
          const all = [r.meaning, r.summary, r.decides].concat(r.actions).join(' | ');
          assert.doesNotMatch(all, /[{}]|undefined|NaN/, all);
          assert.ok(r.actions.length <= 5);
          assert.strictEqual(new Set(r.actions).size, r.actions.length);
        }
      }
    }
  }
});

test('low temperature: 35.5 is not low, 35.4 is; meaning, actions, summary', () => {
  assert.strictEqual(T.checkinTempDropC.value, 1.1);
  assert.strictEqual(T.checkinTempDropC.status, 'assumption');
  const a = engine.checkin(input({ tempC: 35.5 }), MARS42);
  assert.strictEqual(a.temp.low, false);
  assert.deepStrictEqual(a.flags, []);
  const b = engine.checkin(input({ tempC: 35.4 }), MARS42);
  assert.strictEqual(b.temp.low, true);
  assert.strictEqual(b.temp.raised, false);
  assert.deepStrictEqual(b.flags, ['low']);
  assert.strictEqual(b.status, 'amber');
  assert.strictEqual(b.meaning, 'Your temperature is 1.2 °C below your own baseline of 36.6 °C.');
  assert.deepStrictEqual(b.actions, ['Take your temperature again.', 'Tell the crew medical officer if it is still low.']);
  assert.strictEqual(b.summary, '35.4 °C (1.2 °C below your baseline); nothing else');
  // 34.0 is no longer called fine.
  assert.notStrictEqual(engine.checkin(input({ mood: 4, tempC: 34 }), MARS42).meaning, C.meaning.none);
});

test('low temperature: second in priority, beside ill, never with fever; heart row unchanged', () => {
  const r = engine.checkin(input({ tempC: 34.8, ill: true, mood: 2 }), MARS42);
  assert.deepStrictEqual(r.flags, ['low', 'ill', 'mood']);
  assert.strictEqual(r.meaning, 'Your temperature is 1.8 °C below your own baseline of 36.6 °C. Also noted: feeling ill, low mood.');
  assert.strictEqual(r.rows[2].said, true);                     // said because of "ill"
  assert.strictEqual(engine.checkin(input({ tempC: 34.8 }), MARS42).rows[2].said, false);
  for (let t = 340; t <= 420; t++) {
    const x = engine.checkin(input({ tempC: t / 10 }), MARS42);
    assert.ok(!(x.flags.includes('fever') && x.flags.includes('low')), String(t / 10));
  }
});

test('ill first: the "within" sentence only when the reading is neither raised nor low', () => {
  // Ill is first only without fever and low; check the sentence never appears beside a low reading.
  const low = engine.checkin(input({ tempC: 35, ill: true }), MARS42);
  assert.doesNotMatch(low.meaning, /within/);
  const ok = engine.checkin(input({ tempC: 36.9, ill: true }), MARS42);
  assert.match(ok.meaning, /within 1\.1 °C/);
});

test('odd input counts as not given and never throws', () => {
  for (const mood of [0, 6, NaN, '3', 2.5, -1]) {
    const r = engine.checkin({ mood, tempC: null, symptoms: {} }, MARS42);
    assert.strictEqual(r.done, false, String(mood));
    assert.doesNotMatch(r.summary + r.meaning, /undefined|NaN/);
  }
  for (const tempC of [NaN, Infinity, '37.9', undefined]) {
    const r = engine.checkin({ mood: null, tempC, symptoms: {} }, MARS42);
    assert.strictEqual(r.temp, null, String(tempC));
    assert.strictEqual(r.done, false);
  }
  assert.strictEqual(engine.checkin(null, MARS42).done, false);
  assert.strictEqual(engine.checkin(undefined, undefined).status, 'grey');
  const r = engine.checkin(input({ legs: true }), undefined);
  assert.deepStrictEqual(r.rows.map((x) => x.verdict), ['no-bunk', 'no-bunk', 'no-bunk', 'cannot-feel']);
});
