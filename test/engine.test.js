// Tests for js/rules.js and js/engine.js: one test per status-rule boundary,
// built on the deterministic fixture.
// Written with an SI tool (Claude) and reviewed by the team.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { build } = require('./fixture.js');
const rules = require('../js/rules.js');
const engine = require('../js/engine.js');

const BASE = 14;                       // fixture baseline nights
const at = (day) => BASE + day;        // record index of a mission day
const card = (a, id) => a.cards.find((c) => c.id === id);
const assessDay = (shape, day = 20, opts) => engine.assess(build({ shape }), at(day), opts);
const close = (a, b, tol = 1e-3) => assert.ok(Math.abs(a - b) < tol, a + ' != ' + b);

// ---- baseline ---------------------------------------------------------------
test('baseline numbers on the fixture', () => {
  const b = engine.baseline(build());
  close(b.eim.median, 9.0);
  close(b.eim.sd, Math.sqrt(14 * 0.05 * 0.05 / 13), 1e-6);
  assert.equal(b.eim.n, 14);
  close(b.sleep.median, 7.4);
  close(b.rr.median, 14);
  close(b.hr.median, 55);
  close(b.hr.sd, Math.sqrt(14 / 13), 1e-6);
});

test('baseline returns null fields with fewer than 3 values', () => {
  const recs = build().map((r) => (r.missionDay < -2 ? Object.assign({}, r, { eim: null }) : r));
  const b = engine.baseline(recs);
  assert.deepStrictEqual(b.eim, { median: null, sd: null, n: 2 });
});

// ---- muscle -----------------------------------------------------------------
test('muscle green just inside 4.2%', () => {
  const c = card(assessDay(() => ({ eim: { phase50_deg: 8.631 } })), 'muscle'); // -4.1%
  assert.equal(c.status, 'green');
  close(c.deltaPct, -4.1);
  assert.equal(c.unit, 'deg');
});

test('muscle amber just beyond 4.2%', () => {
  const c = card(assessDay(() => ({ eim: { phase50_deg: 8.6 } })), 'muscle'); // -4.44%
  assert.equal(c.status, 'amber');
  assert.match(c.reason, /8\.60 deg/);
  assert.deepStrictEqual(c.sourceIds, ['V10']);
});

test('muscle red beyond 16.8%', () => {
  const c = card(assessDay(() => ({ eim: { phase50_deg: 7.4 } })), 'muscle'); // -17.8%
  assert.equal(c.status, 'red');
});

test('muscle red by three falling weekly medians', () => {
  // w3 = baseline week (8.95), then 8.8, 8.65, 8.55: level drop only 5% (amber), trend fires.
  const c = card(assessDay((d) => ({ eim: { phase50_deg: d < 7 ? 8.8 : d < 14 ? 8.65 : 8.55 } })), 'muscle');
  assert.equal(c.status, 'red');
  assert.match(c.reason, /three weeks in a row/);
});

test('muscle grey with only 2 usable nights in the last 7', () => {
  const c = card(assessDay((d) => (d === 18 || d === 20 ? {} : d === 19 ? { eim: { scans: 0 } } : { eim: null })), 'muscle');
  assert.equal(c.status, 'grey');
  assert.equal(c.value, null);
});

// ---- sleep ------------------------------------------------------------------
test('sleep 7.0 h is green', () => {
  assert.equal(card(assessDay(() => ({ radar: { sleep_h: 7.0 } })), 'sleep').status, 'green');
});
test('sleep 6.99 h is amber', () => {
  assert.equal(card(assessDay(() => ({ radar: { sleep_h: 6.99 } })), 'sleep').status, 'amber');
});
test('sleep 5.99 h is red', () => {
  assert.equal(card(assessDay(() => ({ radar: { sleep_h: 5.99 } })), 'sleep').status, 'red');
});
test('sleep grey with 3 radar nights in the last 7', () => {
  assert.equal(card(assessDay((d) => (d >= 14 && d <= 17 ? { radar: null } : {})), 'sleep').status, 'grey');
});

// ---- cardio -----------------------------------------------------------------
test('cardio amber with only heart rate high', () => {
  const c = card(assessDay(() => ({ radar: { hr_bpm: 58 } })), 'cardio');
  assert.equal(c.status, 'amber');
  assert.equal(c.value, 58);
  assert.equal(c.unit, 'bpm');
  assert.match(c.reason, /breathing rate 14\.3/);
});
test('cardio red with both high on each of the last 3 nights', () => {
  assert.equal(card(assessDay(() => ({ radar: { hr_bpm: 58, rr_bpm: 15 } })), 'cardio').status, 'red');
});
test('cardio grey with 1 radar night in the last 3', () => {
  assert.equal(card(assessDay((d) => (d >= 19 ? { radar: null } : {})), 'cardio').status, 'grey');
});

// ---- radiation --------------------------------------------------------------
const tonightRad = (rad) => (d) => (d === 20 ? { rad } : {});
test('radiation 1.9x is green', () => {
  const c = card(assessDay(tonightRad({ dose_uGy: 190 })), 'radiation');
  assert.equal(c.status, 'green');
  close(c.deltaPct, 90);
});
test('radiation 2.1x is amber', () => {
  assert.equal(card(assessDay(tonightRad({ dose_uGy: 210 })), 'radiation').status, 'amber');
});
test('radiation 10.5x is red', () => {
  assert.equal(card(assessDay(tonightRad({ dose_uGy: 1050 })), 'radiation').status, 'red');
});
test('radiation solar particle event flag is red', () => {
  assert.equal(card(assessDay(tonightRad({ spe: true })), 'radiation').status, 'red');
});
test('radiation grey with 6 earlier mission nights', () => {
  assert.equal(card(assessDay(() => ({}), 6), 'radiation').status, 'grey');
});
test('radiation grey when rad is null tonight', () => {
  assert.equal(card(assessDay((d) => (d === 20 ? { rad: null } : {})), 'radiation').status, 'grey');
});

// ---- whole assessment -------------------------------------------------------
test('same result when _truth is deleted from every record', () => {
  const shape = (d) => ({ eim: { phase50_deg: 9 - 0.03 * d }, radar: { sleep_h: 7.4 - 0.05 * d } });
  const withTruth = build({ shape });
  const without = build({ shape }).map((r) => { const c = Object.assign({}, r); delete c._truth; return c; });
  for (const i of [0, at(0), at(10), at(29)]) {
    assert.deepStrictEqual(engine.assess(without, i), engine.assess(withTruth, i));
  }
});

test('overall and headline: all green', () => {
  const a = assessDay(() => ({}));
  assert.deepStrictEqual(a.cards.map((c) => c.id), ['muscle', 'sleep', 'cardio', 'radiation']);
  assert.equal(a.overall, 'green');
  assert.equal(a.headline, 'All four checks are in your normal range.');
  assert.equal(a.missionDay, 20);
});

test('overall and headline: one amber', () => {
  const a = assessDay(() => ({ radar: { sleep_h: 6.5 } }));
  assert.equal(a.overall, 'amber');
  assert.equal(a.headline, '1 check needs attention: sleep.');
});

test('overall and headline: red', () => {
  const a = assessDay(tonightRad({ spe: true }));
  assert.equal(a.overall, 'red');
  assert.equal(a.headline, 'Urgent: radiation. Follow the actions below.');
});

test('eldercare mode swaps the wording', () => {
  const shape = () => ({ eim: { phase50_deg: 8.6 } });
  const astro = card(assessDay(shape), 'muscle');
  const elder = card(assessDay(shape, 20, { mode: 'eldercare' }), 'muscle');
  assert.equal(astro.decides, 'flight surgeon');
  assert.equal(elder.decides, 'physician');
  assert.ok(astro.actions.some((s) => s.includes('resistance-exercise log')));
  assert.ok(elder.actions.some((s) => s.includes('activity and exercise log')));
  const red = card(assessDay(() => ({ eim: { phase50_deg: 7 } }), 20, { mode: 'eldercare' }), 'muscle');
  assert.ok(red.actions.includes('Confirm with a standard strength test.'));
});

test('no unfilled placeholders in any card text', () => {
  for (const mode of Object.keys(rules.WORDING)) {
    for (const shape of [() => ({}), () => ({ eim: { phase50_deg: 7 }, radar: { sleep_h: 5, hr_bpm: 70, rr_bpm: 20 }, rad: { spe: true } })]) {
      for (const c of assessDay(shape, 20, { mode }).cards) {
        assert.ok(!/[{}]/.test(c.meaning + c.actions.join(' ')), mode + ' ' + c.id);
      }
    }
  }
});

// ---- projection -------------------------------------------------------------
test('project returns a positive daysToRed for a steady decline', () => {
  const recs = build({ shape: (d) => ({ eim: { phase50_deg: 9 * (1 - 0.001 * d) } }) });
  const p = engine.project(recs, at(27));
  assert.equal(p.cardId, 'muscle');
  close(p.slopePctPerWeek, -0.7, 0.01);
  close(p.daysToRed, 144, 1);
});

test('project returns null for a flat series', () => {
  assert.equal(engine.project(build({ shape: () => ({ eim: { phase50_deg: 9 } }) }), at(27)), null);
});

// ---- robustness and series --------------------------------------------------
test('assess never throws when eim, radar and rad are all null', () => {
  const recs = build({ shape: () => ({ eim: null, radar: null, rad: null }) });
  const a = engine.assess(recs, at(20));
  assert.equal(a.overall, 'grey');
  assert.ok(a.cards.every((c) => c.status === 'grey' && c.value === null));
  assert.doesNotThrow(() => engine.assess(recs, 0));
  assert.doesNotThrow(() => engine.project(recs, at(20)));
});

test('series returns one point per night with null when missing', () => {
  const s = engine.series(build({ shape: (d) => (d === 0 ? { rad: null } : {}) }), 'dose');
  assert.equal(s.length, 44);
  assert.deepStrictEqual(s[at(0)], { missionDay: 0, value: null });
  assert.equal(s[at(1)].value, 98);
});
