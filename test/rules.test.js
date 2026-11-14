// Checks for the NASA context in js/rules.js: each check maps to a NASA risk taken
// from the evidence table, and the five-hazard list follows NASA's own order.
// Written with an SI tool (Claude) and reviewed by the team.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const evidence = require('../js/evidence.js');
const rules = require('../js/rules.js');

const CARDS = ['muscle', 'sleep', 'cardio', 'radiation'];

test('CONTEXT covers the four cards with a V44 risk, a note and known sources', () => {
  assert.deepStrictEqual(Object.keys(rules.CONTEXT), CARDS);
  for (const id of CARDS) {
    const c = rules.CONTEXT[id];
    assert.strictEqual(c.risk, evidence.value('V44', id + 'Risk'), id + ' risk');
    assert.ok(typeof c.note === 'string' && c.note.length > 20, id + ' note');
    assert.ok(c.sourceIds.length > 0, id + ' sources');
    for (const s of c.sourceIds) assert.ok(evidence.get(s), id + ' source ' + s);
  }
  assert.match(rules.CONTEXT.radiation.note, new RegExp(evidence.value('V46', 'neutronSharePct') + '%'));
});

test('HAZARDS lists the five V43 hazards in order with a valid coverage', () => {
  const names = evidence.value('V43', 'hazards');
  assert.strictEqual(rules.HAZARDS.length, 5);
  rules.HAZARDS.forEach((h, i) => {
    assert.strictEqual(h.name, names[i]);
    assert.ok(['covered', 'partly', 'not covered'].includes(h.coverage), h.name + ' coverage');
    assert.ok(typeof h.text === 'string' && h.text.length > 20, h.name + ' text');
  });
});

// Literal expectations, so a change to the evidence table or a reordering is caught.
const HAZARD_LITERALS = ['Space Radiation', 'Isolation and Confinement', 'Distance from Earth', 'Gravity Fields', 'Hostile/Closed Environments'];
const HAZARD_SUBJECTS = [/radiation|dose/i, /sleep/i, /crew|ground/i, /muscle/i, /\bair\b/i];

test('V43 names the five hazards literally, in NASA order, and V46 gives a 30% neutron share', () => {
  assert.deepStrictEqual(evidence.value('V43', 'hazards'), HAZARD_LITERALS);
  assert.strictEqual(evidence.value('V46', 'neutronSharePct'), 30);
});

test('each HAZARDS row has the literal name and text about its own subject', () => {
  rules.HAZARDS.forEach((h, i) => {
    assert.strictEqual(h.name, HAZARD_LITERALS[i]);
    assert.match(h.text, HAZARD_SUBJECTS[i], h.name + ' text');
  });
});
