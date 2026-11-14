// Tests for js/sim.js: determinism, record shape and the scenario events.
// Written with an SI tool (Claude) and reviewed by the team.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const model = require('../js/model.js');
const sim = require('../js/sim.js');

const NIGHTS = { S1: 60, S2: 90, S3: 45, S4: 63 };
const surface = (recs) => recs.filter((r) => r.missionDay >= 0);
const median = (a) => { const s = a.slice().sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

function assertNoNaN(v, path) {
  if (typeof v === 'number') assert.ok(Number.isFinite(v), 'non-finite at ' + path);
  else if (v && typeof v === 'object') for (const k of Object.keys(v)) assertNoNaN(v[k], path + '.' + k);
}

test('same seed gives identical output, a different seed differs', () => {
  for (const id of Object.keys(NIGHTS)) {
    assert.deepStrictEqual(sim.generate(id, { seed: 7 }), sim.generate(id, { seed: 7 }));
    assert.notDeepStrictEqual(sim.generate(id, { seed: 7 }).records, sim.generate(id, { seed: 8 }).records);
  }
});

test('each scenario: night count, 14 baseline nights, sorted dates, no NaN', () => {
  for (const [id, n] of Object.entries(NIGHTS)) {
    const { scenario, records } = sim.generate(id);
    assert.equal(scenario.id, id);
    assert.ok(scenario.title && scenario.summary.includes('simulated'), id);
    const base = records.filter((r) => r.missionDay < 0);
    assert.equal(base.length, 14, id);
    assert.deepStrictEqual(base.map((r) => r.missionDay), Array.from({ length: 14 }, (_, i) => i - 14));
    assert.ok(base.every((r) => r.env === 'earth' && r._truth.muscleChangePct === 0), id);
    const surf = surface(records);
    assert.equal(surf.length, n, id);
    assert.deepStrictEqual(surf.map((r) => r.missionDay), Array.from({ length: n }, (_, i) => i));
    assert.ok(surf.every((r) => r.env === scenario.env), id);
    for (let i = 1; i < records.length; i++) {
      assert.match(records[i].night, /^\d{4}-\d{2}-\d{2}$/);
      assert.ok(records[i].night > records[i - 1].night, id + ' dates not sorted at ' + i);
    }
    assertNoNaN(records, id);
  }
});

test('records follow the NightRecord shape', () => {
  const r = surface(sim.generate('S1').records)[3];
  assert.deepStrictEqual(Object.keys(r.eim).sort(), ['contact', 'phase50_deg', 'scans', 'site']);
  assert.ok(r.eim.contact >= 0.6 && r.eim.contact <= 0.95 && r.eim.scans >= 3 && r.eim.scans <= 6);
  assert.deepStrictEqual(Object.keys(r.radar).sort(), ['efficiency', 'hr_bpm', 'movement', 'rr_bpm', 'sleep_h']);
  assert.equal(r.rad.dir.length, 8);
  const total = r.rad.dir.reduce((a, b) => a + b, 0);
  assert.ok(total > 70 && total < 130, 'dir total ' + total);
  assert.equal(typeof r.log.exercise_done, 'boolean');
  assert.ok(r._truth.tracksPerCm2 > 0);
});

// ---- replayed radiation measurements ----------------------------------------
const msl = require('../data/msl-rad.js');
const crater = require('../data/lro-crater.js');
const donki = require('../data/donki-sep-2017.js');
const engine = require('../js/engine.js');

test('S2 replays one Curiosity RAD sol per night: median dose rate x 8 h, with provenance', () => {
  const surf = surface(sim.generate('S2').records);
  surf.forEach((r, k) => {
    const [sol, date, b] = msl.rows[k];
    assert.equal(r.rad.dose_uGy, Math.round(b * 8 * 10) / 10, 'night ' + k);
    assert.deepStrictEqual(r.rad.measured, { dataset: 'msl-rad', sol: sol, date: date });
    assert.equal(r.rad.spe, false);
  });
  assert.equal(surf[89].rad.measured.sol, 108);
});

test('S1 replays the quiet CRaTER window night by night (D5&6)', () => {
  const surf = surface(sim.generate('S1').records);
  surf.forEach((r, k) => {
    assert.equal(r.rad.dose_uGy, crater.quiet[k][1], 'night ' + k);
    assert.deepStrictEqual(r.rad.measured, { dataset: 'lro-crater', date: crater.quiet[k][0], pair: 'D5&6' });
    assert.equal(r.rad.spe, false);
  });
});

test('S3 replays the September 2017 CRaTER window; night 20 is 2017-09-10 and carries the DONKI record', () => {
  const surf = surface(sim.generate('S3').records);
  surf.forEach((r, k) => {
    assert.equal(r.rad.dose_uGy, crater.event[k][1], 'night ' + k);
    assert.deepStrictEqual(r.rad.measured, { dataset: 'lro-crater', date: crater.event[k][0], pair: 'D5&6' });
  });
  const n20 = surf[20];
  assert.equal(n20.rad.measured.date, '2017-09-10');
  assert.ok(n20.rad.events.some((e) => e.id === '2017-09-10T16:45:00-SEP-001' && e.start === '2017-09-10T16:45Z'));
  const quiet = median(crater.quiet.map((r) => r[1]));
  assert.ok(n20.rad.dose_uGy / quiet > 400, String(n20.rad.dose_uGy / quiet));
});

test('S3 spe flags fall exactly where a GOES DONKI record starts 16 h before to the end of the sleep window', () => {
  const surf = surface(sim.generate('S3').records);
  const H = 3600000;
  const expected = surf.map((r) => {
    const open = Date.parse(r.rad.measured.date + 'T22:00:00Z');
    const lo = open - 16 * H, hi = open + 8 * H;
    const covered = lo >= Date.parse(donki.coverage[0]) && hi <= Date.parse(donki.coverage[1]);
    const goes = donki.rows.filter((e) => e[2].some((i) => i.startsWith('GOES')));
    const ids = goes.filter((e) => Date.parse(e[1]) >= lo && Date.parse(e[1]) < hi).map((e) => e[0]);
    return { spe: ids.length > 0, ids: covered ? ids : null };
  });
  surf.forEach((r, k) => {
    assert.equal(r.rad.spe, expected[k].spe, 'night ' + k);
    assert.deepStrictEqual(r.rad.events && r.rad.events.map((e) => e.id), expected[k].ids, 'night ' + k);
  });
  assert.deepStrictEqual(surf.filter((r) => r.rad.spe).map((r) => r.missionDay), [14, 16, 20]);
});

test('S3 event labels cover exactly the nights above 2x the scenario median dose', () => {
  const { scenario, records } = sim.generate('S3');
  const surf = surface(records);
  const usual = median(surf.map((r) => r.rad.dose_uGy));
  const raised = surf.filter((r) => r.rad.dose_uGy > 2 * usual).map((r) => r.missionDay);
  const labelled = [];
  scenario.events.forEach((e) => { for (let d = e.from; d <= e.to; d++) labelled.push(d); });
  assert.deepStrictEqual(labelled, raised);
});

test('track count scales with the night-to-usual dose ratio on quiet nights only', () => {
  const surf = surface(sim.generate('S3').records);
  const usual = median(surf.map((r) => r.rad.dose_uGy));
  const base = surf.find((r) => r.rad.dose_uGy === usual)._truth.tracksPerCm2;
  assert.equal(base, 2183);
  const q = surf.find((r) => r._truth.tracksUsable && r.rad.dose_uGy > usual);
  assert.ok(Math.abs(q._truth.tracksPerCm2 / base - q.rad.dose_uGy / usual) < 0.01);
  assert.equal(surf[20]._truth.tracksPerCm2, 2183);   // a solar-event night does not multiply the tracks
});

test('density image: exactly the solar-event and raised-dose nights of S3 are left out', () => {
  const ratio = sim.ASSUMPTIONS.trackQuietMaxRatio;
  assert.equal(ratio.value, 1.15);
  assert.deepStrictEqual(ratio.sourceIds, ['V61', 'V62']);
  const out = surface(sim.generate('S3').records).filter((r) => r._truth.tracksUsable === false).map((r) => r.missionDay);
  assert.deepStrictEqual(out, [14, 15, 16, 17, 18, 20, 21, 22, 23, 24, 25, 26]);
  for (const s of ['S1', 'S2']) assert.ok(surface(sim.generate(s).records).every((r) => r._truth.tracksUsable === true), s);
  for (const s of ['S1', 'S2', 'S3']) assert.ok(sim.generate(s).records.filter((r) => r.missionDay < 0).every((r) => r._truth.tracksUsable === null), s);
  assert.ok(sim.generate('S4').records.every((r) => r._truth.tracksUsable === null));
});

test('LRO CRaTER: D5&6 within 2% of D1&2 on quiet nights, about a quarter of it on 10 Sep 2017', () => {
  const crater = require('../data/lro-crater.js');
  const d56 = median(crater.quiet.map((r) => r[1])), d12 = median(crater.quiet.map((r) => r[2]));
  assert.ok(Math.abs(d56 / d12 - 1) < 0.02, d56 + ' vs ' + d12);
  const n = crater.event.find((r) => r[0] === '2017-09-10');
  assert.ok(n[1] / n[2] > 0.25 && n[1] / n[2] < 0.27, String(n[1] / n[2]));
});

test('engine: S3 night 20 is red for radiation and the brief says Report', () => {
  const { records } = sim.generate('S3');
  const i = records.findIndex((r) => r.missionDay === 20);
  const a = engine.assess(records, i);
  assert.equal(a.cards.find((c) => c.id === 'radiation').status, 'red');
  assert.match(a.headline, /^Report to the flight surgeon today: radiation/);
});

test('S2 first surface night carries the 180-day transit loss', () => {
  const transit = model.simulate([{ days: 180, g: 0, exerciseAdherence: 0.9 }])[180];
  const first = surface(sim.generate('S2').records)[0];
  assert.ok(Math.abs(first._truth.muscleChangePct - transit) <= 1, first._truth.muscleChangePct + ' vs ' + transit);
});

test('S1 has null eim exactly on days 44-49', () => {
  const nulls = surface(sim.generate('S1').records).filter((r) => r.eim === null).map((r) => r.missionDay);
  assert.deepStrictEqual(nulls, [44, 45, 46, 47, 48, 49]);
});

test('S4 has rad null on every night', () => {
  assert.ok(sim.generate('S4').records.every((r) => r.rad === null && r._truth.tracksPerCm2 === null));
});

test('what-if overrides change the outcome in the expected direction', () => {
  const end = (o) => surface(sim.generate('S1', o).records)[59]._truth.muscleChangePct;
  assert.ok(end({ exerciseAdherence: 0 }) < end({}));
  // Shielding scales the tracks only; the cosmic-ray dose is the measured one.
  const night = (o) => surface(sim.generate('S1', o).records)[5];
  assert.equal(night({ shieldingFactor: 0.6 }).rad.dose_uGy, night({}).rad.dose_uGy);
  assert.equal(night({ shieldingFactor: 0.6 })._truth.tracksPerCm2, Math.round(night({})._truth.tracksPerCm2 * 0.6));
});

test('S3 summary says a real crew would move to a storm shelter', () => {
  assert.match(sim.SCENARIOS.S3.summary, /storm shelter; the replay shows what a lightly shielded detector on an orbiter recorded\.$/);
});

test('NOISE and ASSUMPTIONS are declared', () => {
  for (const group of [sim.NOISE, sim.ASSUMPTIONS]) {
    for (const [k, a] of Object.entries(group)) {
      assert.ok(a.value !== undefined && a.unit && a.note && a.note.length > 10, k);
    }
  }
});

test('plan: one value per record, 0 on baseline nights', () => {
  for (const id of Object.keys(NIGHTS)) {
    const { records, plan } = sim.generate(id);
    assert.equal(plan.expectedChangePct.length, records.length, id);
    records.forEach((r, i) => { if (r.missionDay < 0) assert.equal(plan.expectedChangePct[i], 0, id); });
    assertNoNaN(plan, id);
  }
});

test('plan equals truth for S1 and S3, which are flown as planned', () => {
  for (const id of ['S1', 'S3']) {
    const { records, plan } = sim.generate(id);
    records.forEach((r, i) => assert.ok(Math.abs(plan.expectedChangePct[i] - r._truth.muscleChangePct) <= 0.01, id + ' ' + r.missionDay));
  }
});

test('S2 plan matches truth before the lapse and is above it by more than 3 points on day 42', () => {
  const { records, plan } = sim.generate('S2');
  records.forEach((r, i) => {
    if (r.missionDay >= 0 && r.missionDay < 22) assert.ok(Math.abs(plan.expectedChangePct[i] - r._truth.muscleChangePct) <= 0.01, 'day ' + r.missionDay);
  });
  const i42 = records.findIndex((r) => r.missionDay === 42);
  assert.ok(plan.expectedChangePct[i42] - records[i42]._truth.muscleChangePct > 3);
});

test('S4 plan is 0 on every night', () => {
  assert.ok(sim.generate('S4').plan.expectedChangePct.every((v) => v === 0));
});

test('exerciseAdherence override changes the truth but not the plan', () => {
  const a = sim.generate('S1');
  const b = sim.generate('S1', { exerciseAdherence: 0 });
  assert.notDeepStrictEqual(b.records.map((r) => r._truth.muscleChangePct), a.records.map((r) => r._truth.muscleChangePct));
  assert.deepStrictEqual(b.plan, a.plan);
});

const sd = (a) => { const m = a.reduce((x, y) => x + y, 0) / a.length; return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1)); };
const baselineOf = (records, f) => records.filter((r) => r.missionDay < 0).map(f);

test('inherited names are rejected with a clear error', () => {
  for (const id of ['__proto__', 'constructor', 'toString', 'S9']) {
    assert.throws(() => sim.generate(id), /Unknown scenario/, id);
  }
});

test('each scenario shows a different person', () => {
  const keys = { baselinePhaseDeg: (r) => r.eim.phase50_deg, hrBpm: (r) => r.radar.hr_bpm, rrBpm: (r) => r.radar.rr_bpm };
  for (const [k, f] of Object.entries(keys)) {
    const meds = Object.keys(NIGHTS).map((id) => {
      const { scenario, records } = sim.generate(id);
      const m = median(baselineOf(records, f));
      assert.ok(Math.abs(m - scenario.person[k]) <= 0.03 * scenario.person[k], id + ' ' + k + ' ' + m);
      return m;
    });
    assert.equal(new Set(meds).size, 4, k + ' ' + meds);
  }
});

test('default seeds differ per scenario and opts.seed overrides', () => {
  const seeds = Object.keys(NIGHTS).map((id) => sim.SCENARIOS[id].seed);
  assert.equal(new Set(seeds).size, 4);
  const s1 = sim.SCENARIOS.S1.seed;
  assert.deepStrictEqual(sim.generate('S1'), sim.generate('S1', { seed: s1 }));
  assert.notDeepStrictEqual(sim.generate('S1').records, sim.generate('S1', { seed: s1 + 1 }).records);
});

test('S4: 63 nights, at least 6% loss by night 34, recovering at the end, plan 0', () => {
  const { records, plan } = sim.generate('S4');
  const surf = surface(records);
  assert.equal(surf.length, 63);
  assert.ok(surf[34]._truth.muscleChangePct <= -6, String(surf[34]._truth.muscleChangePct));
  assert.ok(surf[62]._truth.muscleChangePct > surf[61]._truth.muscleChangePct);
  assert.ok(surf[62]._truth.muscleChangePct > surf[34]._truth.muscleChangePct);
  assert.ok(plan.expectedChangePct.every((v) => v === 0));
});

test('eimNoiseSdFraction widens the baseline phase spread; out-of-range values are ignored', () => {
  const spread = (o) => sd(baselineOf(sim.generate('S1', o).records, (r) => r.eim.phase50_deg));
  assert.ok(spread({ eimNoiseSdFraction: 0.06 }) > 2 * spread({}));
  for (const bad of [-0.1, 0.5, '0.06', NaN]) {
    assert.deepStrictEqual(sim.generate('S1', { eimNoiseSdFraction: bad }), sim.generate('S1'), String(bad));
  }
});

test('transitDays is exposed for the chart', () => {
  assert.deepStrictEqual(Object.keys(NIGHTS).map((id) => sim.SCENARIOS[id].transitDays), [0, 180, 0, 0]);
});
