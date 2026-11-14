// Tests for js/sim.js: determinism, record shape and the scenario events.
// Written with an SI tool (Claude) and reviewed by the team.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const model = require('../js/model.js');
const sim = require('../js/sim.js');

const NIGHTS = { S1: 60, S2: 90, S3: 45, S4: 56 };
const surface = (recs) => recs.filter((r) => r.missionDay >= 0);

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

test('S3 has exactly one SPE night, on day 20, with a much higher dose', () => {
  const surf = surface(sim.generate('S3').records);
  const spe = surf.filter((r) => r.rad.spe);
  assert.equal(spe.length, 1);
  assert.equal(spe[0].missionDay, 20);
  assert.ok(spe[0].rad.dose_uGy > 20 * surf[10].rad.dose_uGy);
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
  const dose = (o) => surface(sim.generate('S1', o).records)[5].rad.dose_uGy;
  assert.ok(dose({ shieldingFactor: 0.5 }) < dose({}));
});

test('NOISE and ASSUMPTIONS are declared', () => {
  for (const group of [sim.NOISE, sim.ASSUMPTIONS]) {
    for (const [k, a] of Object.entries(group)) {
      assert.ok(a.value !== undefined && a.unit && a.note && a.note.length > 10, k);
    }
  }
});
