// Tests for js/model.js: the fitted anchors and the basic shape of the
// first-order muscle model.
// Written with an SI tool (Claude) and reviewed by the team.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const model = require('../js/model.js');

const last = (a) => a[a.length - 1];
const run = (days, g, exerciseAdherence) => model.simulate([{ days, g, exerciseAdherence }]);

function inRange(v, lo, hi, label) {
  assert.ok(v >= lo && v <= hi, label + ': ' + v + ' not in [' + lo + ', ' + hi + ']');
}

test('V4 anchor: 60 days at g = 0, no exercise, about -29%', () => {
  inRange(last(run(60, 0, 0)), -32, -26, 'V4 control');
});

test('V4 anchor: 60 days at g = 0, full exercise, about -8%', () => {
  inRange(last(run(60, 0, 1)), -11, -5, 'V4 exercise');
});

test('V5 anchor: 180 days at g = 0, full exercise, about -13%', () => {
  inRange(last(run(180, 0, 1)), -17, -9, 'V5 ISS');
});

test('simulate returns one value per day starting at 0', () => {
  const s = model.simulate([{ days: 10, g: 0, exerciseAdherence: 0 }, { days: 5, g: 1, exerciseAdherence: 0 }]);
  assert.equal(s.length, 16);
  assert.equal(s[0], 0);
});

test('loss is monotonic while unloaded', () => {
  const s = run(200, 0, 0.5);
  for (let i = 1; i < s.length; i++) assert.ok(s[i] < s[i - 1], 'day ' + i);
});

test('recovery at g = 1 moves toward 0', () => {
  const s = model.simulate([{ days: 60, g: 0, exerciseAdherence: 0 }, { days: 60, g: 1, exerciseAdherence: 0 }]);
  for (let i = 61; i < s.length; i++) {
    assert.ok(s[i] > s[i - 1] && s[i] < 0, 'day ' + i);
  }
  assert.ok(model.step(-10, { g: 1, exerciseAdherence: 0 }) > -10);
});

test('partial gravity gives less loss than g = 0', () => {
  const zero = last(run(90, 0, 0));
  const mars = last(run(90, model.GRAVITY.mars, 0));
  const moon = last(run(90, model.GRAVITY.moon, 0));
  assert.ok(mars > moon && moon > zero, [zero, moon, mars].join(' '));
});

test('gravityShape changes partial-gravity loss but not g = 0', () => {
  const g = model.GRAVITY.moon;
  assert.ok(model.step(0, { g, exerciseAdherence: 0, gravityShape: 2 }) > model.step(0, { g, exerciseAdherence: 0 }));
  assert.equal(model.step(0, { g: 0, exerciseAdherence: 0, gravityShape: 2 }), model.step(0, { g: 0, exerciseAdherence: 0 }));
});

test('eimPhase returns the baseline at 0 change and falls with loss', () => {
  assert.equal(model.eimPhase(9, 0), 9);
  assert.ok(model.eimPhase(9, -10) < 9);
});

test('GRAVITY comes from evidence V14 and PARAMS are declared', () => {
  assert.deepStrictEqual(model.GRAVITY, { microgravity: 0, moon: 0.165, mars: 0.38, earth: 1 });
  for (const [k, p] of Object.entries(model.PARAMS)) {
    assert.ok(Number.isFinite(p.value), k);
    assert.ok(p.status === 'fitted' || p.status === 'assumption', k);
    assert.ok(Array.isArray(p.anchors) && p.note.length > 20 && p.unit, k);
  }
});
