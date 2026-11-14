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

// ---- muscle against the mission plan ----------------------------------------
const planOf = (fn) => build().map((r) => (r.missionDay < 0 ? 0 : fn(r.missionDay)));
const muscleWith = (phase, plan) => card(engine.assess(build({ shape: () => ({ eim: { phase50_deg: phase } }) }), at(20), { expectedChangePct: plan }), 'muscle');

test('muscle: with no plan a 5% drop is amber', () => {
  assert.equal(muscleWith(8.55).status, 'amber');
});
test('muscle: with a plan expecting 5%, a 5% drop is green', () => {
  const c = muscleWith(8.55, planOf(() => -5));
  assert.equal(c.status, 'green');
  assert.match(c.reason, /The mission plan expects a drop of about 5\.0% at this point\./);
});
test('muscle: with a plan expecting 5%, a 10% drop is amber', () => {
  const c = muscleWith(8.1, planOf(() => -5));
  assert.equal(c.status, 'amber');
  assert.match(c.reason, /5\.0% worse than the plan\.$/);
});
test('muscle: an 18% drop is red with or without a plan', () => {
  assert.equal(muscleWith(7.38).status, 'red');
  assert.equal(muscleWith(7.38, planOf(() => -18)).status, 'red');
});
test('muscle: a steady 1.2%/week decline that matches the plan stays green', () => {
  const perDay = 1.2 / 7;
  const recs = build({ shape: (d) => ({ eim: { phase50_deg: 9 * (1 - perDay * d / 100) } }) });
  const plan = planOf((d) => -perDay * d);
  for (let i = at(2); i < recs.length; i++) {   // nights 0-1 are grey: too few nights since arrival
    assert.equal(card(engine.assess(recs, i, { expectedChangePct: plan }), 'muscle').status, 'green', 'index ' + i);
  }
  // Same data without the plan does turn amber by the end, so the plan is what keeps it green.
  assert.equal(card(engine.assess(recs, recs.length - 1), 'muscle').status, 'amber');
});
test('muscle: expectedDeltaPct is null without a plan and equals the plan with one', () => {
  assert.equal(muscleWith(8.55).expectedDeltaPct, null);
  close(muscleWith(8.55, planOf(() => -5)).expectedDeltaPct, -5);
  assert.equal(muscleWith(8.55, planOf(() => 0)).expectedDeltaPct, 0);
  assert.equal(card(assessDay(() => ({ eim: null })), 'muscle').expectedDeltaPct, null);
});
test('muscle: the plan is only read at indices up to index', () => {
  const read = [];
  const plan = new Proxy(planOf(() => -5), {
    get(target, key) { if (/^\d+$/.test(String(key))) read.push(Number(key)); return target[key]; }
  });
  engine.assess(build(), at(20), { expectedChangePct: plan });
  assert.ok(read.length > 0);
  assert.ok(Math.max(...read) <= at(20));
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
test('cardio is never red: both high for 3 nights stays amber and is marked sustained', () => {
  const c = card(assessDay(() => ({ radar: { hr_bpm: 58, rr_bpm: 15 } })), 'cardio');
  assert.equal(c.status, 'amber');
  assert.equal(c.extra.sustained, true);
  assert.match(c.meaning, /early sign of illness/);
  assert.ok(c.actions.includes('Tell the crew medical officer today.'));
  assert.equal(card(assessDay(() => ({ radar: { hr_bpm: 58 } })), 'cardio').extra.sustained, false);
  assert.equal(rules.TEXT.cardio.red, undefined);
  for (let d = 0; d < 30; d++) {
    assert.notEqual(card(assessDay(() => ({ radar: { hr_bpm: 90, rr_bpm: 30 } }), d), 'cardio').status, 'red');
  }
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
test('radiation 10.5x is red and carries ratio and cumulative dose', () => {
  const c = card(assessDay(tonightRad({ dose_uGy: 1050 })), 'radiation');
  assert.equal(c.status, 'red');
  close(c.extra.ratio, 10.5);
  assert.equal(c.extra.usualUGy, 100);
  assert.equal(c.extra.cumulativeUGy, 10 * 98 + 10 * 102 + 1050);   // mission nights 0-20 only
  assert.match(c.reason, /10\.5x the usual level/);
  assert.match(c.reason, /\u00b5Gy/);
  assert.ok(!/uGy/.test(c.reason));
  assert.match(c.meaning, /record of what happened overnight/);
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
  assert.equal(a.headline, '1 check to watch: sleep.');
});

test('overall and headline: red', () => {
  const a = assessDay(tonightRad({ spe: true }));
  assert.equal(a.overall, 'red');
  assert.equal(a.headline, 'Report to the flight surgeon today: radiation.');
});

test('headline: two ambers, red plus amber, the heart and breathing name, never Urgent', () => {
  assert.equal(assessDay(() => ({ eim: { phase50_deg: 8.6 }, radar: { sleep_h: 6.5 } })).headline, '2 checks to watch: muscle, sleep.');
  assert.equal(assessDay((d) => (d === 20 ? { radar: { sleep_h: 6.5 }, rad: { spe: true } } : { radar: { sleep_h: 6.5 } })).headline,
    'Report to the flight surgeon today: radiation. 1 check to watch: sleep.');
  assert.equal(assessDay(() => ({ radar: { hr_bpm: 58 } })).headline, '1 check to watch: heart and breathing.');
  assert.equal(assessDay(tonightRad({ spe: true }), 20, { mode: 'eldercare' }).headline, 'Report to the physician today: radiation.');
});

// ---- phases never mix -------------------------------------------------------
// The fixture places surface night 0 right after the last baseline night, as S2 does after its transit.
test('muscle on surface nights 0-1 is grey "since arrival"; night 2 uses surface nights only', () => {
  const recs = build({ shape: () => ({ eim: { phase50_deg: 8.0 } }) });
  for (const d of [0, 1]) {
    const c = card(engine.assess(recs, at(d)), 'muscle');
    assert.equal(c.status, 'grey');
    assert.equal(c.reason, 'Only ' + (d + 1) + ' nights since arrival (need 3).');
    assert.equal(c.extra.dropPct, null);
    close(c.extra.redLimitPct, 16.8);
  }
  const c2 = card(engine.assess(recs, at(2)), 'muscle');
  assert.equal(c2.value, 8.0);
  close(c2.deltaPct, -100 / 9);
  close(c2.extra.dropPct, 100 / 9);
  const s0 = card(engine.assess(recs, at(0)), 'sleep');
  assert.equal(s0.status, 'grey');
  assert.match(s0.reason, /since arrival/);
  assert.equal(card(engine.assess(recs, at(0)), 'cardio').status, 'grey');
});

test('windows on baseline nights use baseline nights only and do not say "since arrival"', () => {
  const recs = build({ shape: () => ({ radar: { sleep_h: 3 } }) });
  const s = card(engine.assess(recs, at(-1)), 'sleep');
  assert.equal(s.extra.nights, 7);
  close(s.value, 7.4 - 0.1 / 7);    // 4 short and 3 long baseline nights, no surface nights
  const m = card(engine.assess(build({ shape: () => ({}) }), 1), 'muscle');
  assert.equal(m.status, 'grey');
  assert.ok(!/arrival/.test(m.reason));
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

test('project needs 3 complete surface weeks and never returns under 1 day', () => {
  const recs = build({ shape: (d) => ({ eim: { phase50_deg: 9 * (1 - 0.001 * d) } }) });
  for (let d = -14; d < 20; d++) assert.equal(engine.project(recs, at(d)), null, 'day ' + d);
  assert.ok(engine.project(recs, at(20)) !== null);
  for (let i = 0; i < recs.length; i++) {
    const p = engine.project(recs, i);
    assert.ok(p === null || p.daysToRed >= 1);
  }
  // Steep weekly steps ending just short of the red line: the line crosses in under a day -> null.
  const steep = build({ shape: (d) => ({ eim: { phase50_deg: 9 * (1 - (d < 7 ? 0.065 : d < 14 ? 0.115 : 0.165)) } }) });
  assert.notEqual(card(engine.assess(steep, at(20)), 'muscle').status, 'red');
  assert.equal(engine.project(steep, at(20)), null);
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

// ---- regression on the real simulator -------------------------------------
test('S2 after the transit: no projection on days 2-20, muscle follows the plan on day 3', () => {
  const sim = require('../js/sim.js');
  const g = sim.generate('S2', { seed: 1 });
  const idx = (d) => g.records.findIndex((r) => r.missionDay === d);
  for (let d = 2; d <= 20; d++) assert.equal(engine.project(g.records, idx(d)), null, 'day ' + d);
  const i3 = idx(3);
  const c = card(engine.assess(g.records, i3, { expectedChangePct: g.plan.expectedChangePct }), 'muscle');
  assert.notEqual(c.status, 'grey');
  assert.ok(Math.abs(c.deltaPct - g.plan.expectedChangePct[i3]) <= 3, c.deltaPct + ' vs plan ' + g.plan.expectedChangePct[i3]);
});
