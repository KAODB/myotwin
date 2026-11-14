// Tests for the radiation trend's vertical scale: linear or logarithmic, and dose tick labels.
// Written with an SI tool (Claude) and reviewed by the team.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const charts = require('../js/charts.js');
const sim = require('../js/sim.js');
const engine = require('../js/engine.js');

// The doses the radiation trend plots: the nightly readings (the judged line uses the same values).
const doses = (id) => engine.series(sim.generate(id).records, 'dose').map((p) => p.value);

test('the solar-event scenario gets a log axis; Mars and the quiet Moon stay linear', () => {
  assert.equal(charts.useLogScale(doses('S3')), true);
  assert.equal(charts.useLogScale(doses('S1')), false);
  assert.equal(charts.useLogScale(doses('S2')), false);
});

test('the scale rule is a factor of 50, ignores zeros and missing values, and needs two values', () => {
  assert.equal(charts.useLogScale([1, 50]), false);
  assert.equal(charts.useLogScale([1, 50.1]), true);
  assert.equal(charts.useLogScale([0, null, undefined, NaN, -5, 80, 100]), false);
  assert.equal(charts.useLogScale([0, null, 80, 43539]), true);
  assert.equal(charts.useLogScale([0, 0, 1000]), false);
  assert.equal(charts.useLogScale([]), false);
  assert.equal(charts.useLogScale(null), false);
});

test('dose ticks use the card units and rounding, never exponent notation', () => {
  assert.equal(charts.doseTick(80), '80 µGy');
  assert.equal(charts.doseTick(100), '100 µGy');
  assert.equal(charts.doseTick(1000), '1 mGy');
  assert.equal(charts.doseTick(10000), '10 mGy');
  assert.equal(charts.doseTick(100000), '100 mGy');
  assert.equal(charts.doseTick(43539), '43.5 mGy');
  // Same number as the card shows, only without a trailing ".0".
  assert.deepStrictEqual(charts.doseParts(43539), ['43.5', 'mGy']);
  assert.deepStrictEqual(charts.doseParts(1000), ['1.0', 'mGy']);
  assert.deepStrictEqual(charts.doseParts(79.6), ['80', 'µGy']);
  for (let v = 1; v <= 1e6; v *= 10) assert.ok(!/e/i.test(charts.doseTick(v)), String(v));
});
