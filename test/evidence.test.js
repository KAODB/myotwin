// Integrity checks for the evidence table: the smallest test that fails if an
// entry loses its source or a number is used without being declared.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const evidence = require('../js/evidence.js');

const STATUSES = new Set(['verified', 'secondary', 'assumption']);

test('every entry has an id, a claim, a source and a known status', () => {
  const seen = new Set();
  for (const it of evidence.items) {
    assert.match(it.id, /^V\d+$/, 'id format ' + it.id);
    assert.ok(!seen.has(it.id), 'duplicate id ' + it.id);
    seen.add(it.id);
    assert.ok(it.claim && it.claim.length > 20, it.id + ' needs a claim');
    assert.ok(it.source && it.source.length > 10, it.id + ' needs a source');
    assert.ok(STATUSES.has(it.status), it.id + ' has unknown status ' + it.status);
    assert.match(it.url, /^https:\/\//, it.id + ' needs an https url');
    assert.equal(typeof it.values, 'object');
  }
});

test('get and value throw on unknown ids or keys instead of returning undefined', () => {
  assert.equal(evidence.value('V1', 'minStrengthFraction'), 0.8);
  assert.throws(() => evidence.get('V999'));
  assert.throws(() => evidence.value('V1', 'nope'));
});

test('numbers the rules rely on are present', () => {
  assert.equal(evidence.value('V10', 'meanVariabilityPct'), 4.2);
  assert.equal(evidence.value('V10', 'maxVariabilityPct'), 16.8);
  assert.equal(evidence.value('V25', 'minSleepHours'), 7);
  assert.equal(evidence.value('V14', 'moonRatio'), 0.165);
  assert.equal(evidence.value('V14', 'marsRatio'), 0.38);
  assert.equal(evidence.value('V31', 'muscleCm'), 35.14);
});
