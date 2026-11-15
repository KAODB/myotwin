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
  assert.strictEqual(rules.CONTEXT.radiation.note, 'Neutrons are about 30% of total radiation on the ISS. The Canadian Space Agency\'s CANS spectrometer is designed to measure them continuously.');
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

// ---- NASA context per check (rules.NASA) and the sleep line from a NASA brief ----
const ROADMAP = { muscle: 'V70', sleep: 'V71', cardio: 'V72', radiation: 'V73' };
const RISK_PAGE = { muscle: 'V48', sleep: 'V49', cardio: 'V50', radiation: 'V51' };
const PREFIX = { moon: 'lunarSurfaceLong', mars: 'marsPlanetary' };
const ids = (s) => s.match(/\bV\d+\b/g) || [];

test('every evidence id used by rules.NASA and the hazard facts exists', () => {
  const used = [];
  for (const id of CARDS) {
    const n = rules.NASA[id];
    used.push(n.roadmapId, n.riskPageId, ...n.riskSourceIds);
    for (const s of n.standard) used.push(...s.sourceIds);
  }
  for (const h of rules.HAZARDS) {
    if (h.fact) used.push(...h.fact.sourceIds);
    if (h.worldFact) for (const w of ['moon', 'mars']) used.push(...h.worldFact[w].sourceIds);
  }
  assert.ok(used.length > 20);
  for (const id of used) assert.ok(evidence.get(id), 'unknown evidence id ' + id);
});

test('each check uses the right Roadmap entry, risk page and gap', () => {
  assert.deepStrictEqual(Object.keys(rules.NASA), CARDS);
  for (const id of CARDS) {
    const n = rules.NASA[id];
    assert.strictEqual(n.roadmapId, ROADMAP[id]);
    assert.strictEqual(evidence.value(n.roadmapId, 'card'), id);
    assert.strictEqual(n.riskPageId, RISK_PAGE[id]);
    assert.strictEqual(n.risk, evidence.value('V44', id + 'Risk'));
    assert.strictEqual(n.gap.id, evidence.value(n.roadmapId, 'gapId'));
    assert.strictEqual(n.gap.text, evidence.value(n.roadmapId, 'gapText'));
    assert.strictEqual(n.lastPublished, evidence.value(n.roadmapId, 'lastPublished'));
  }
});

test('the rating shown follows the mission type: lunarSurfaceLong for the Moon, marsPlanetary for Mars', () => {
  assert.deepStrictEqual(rules.MISSIONS.moon.prefix, 'lunarSurfaceLong');
  assert.deepStrictEqual(rules.MISSIONS.mars.prefix, 'marsPlanetary');
  for (const id of CARDS) {
    const n = rules.NASA[id], kind = id === 'radiation' ? 'Health' : 'Ops';
    for (const w of ['moon', 'mars']) {
      const r = n.ratings[w], key = PREFIX[w] + kind;
      assert.strictEqual(r.code, evidence.value(n.roadmapId, key), id + ' ' + w + ' code');
      assert.strictEqual(r.disposition, evidence.value(n.roadmapId, key + 'Disposition'), id + ' ' + w + ' disposition');
      assert.ok(r.text.includes(r.code + ', ' + r.disposition), id + ' ' + w + ' text');
      assert.ok(r.text.includes(rules.MISSIONS[w].label), id + ' ' + w + ' mission label');
    }
  }
  // Literal spot checks so that a change in the evidence table is deliberate.
  assert.strictEqual(rules.NASA.muscle.ratings.mars.code, '5x4');
  assert.strictEqual(rules.NASA.muscle.ratings.moon.code, '5x3');
  assert.strictEqual(rules.NASA.radiation.ratings.mars.code, '3x3');
  assert.match(rules.NASA.radiation.ratings.moon.text, /previous 3x4 matrix/);
  assert.match(rules.NASA.radiation.ratings.moon.text, /1x1, Accepted/);
  assert.match(rules.NASA.muscle.scale, /each from 1 to 5/);
});

test('the quotations are the evidence says/canBeDone strings, unaltered', () => {
  for (const id of CARDS) {
    const n = rules.NASA[id];
    assert.strictEqual(n.says, evidence.value(RISK_PAGE[id], 'says'));
    assert.strictEqual(n.canBeDone, evidence.value(RISK_PAGE[id], 'canBeDone'));
  }
});

test('sleepAmberHours now reads V79 (NASA brief) and equals 7', () => {
  const t = rules.THRESHOLDS.sleepAmberHours;
  assert.deepStrictEqual(t.sourceIds, ['V79']);
  assert.strictEqual(t.value, evidence.value('V79', 'adultSleepHoursLow'));
  assert.strictEqual(t.value, 7);
  assert.doesNotMatch(t.note, /V25/);
});

test('numbers in the NASA standard sentences come from evidence values', () => {
  const text = (id) => rules.NASA[id].standard.map((s) => s.text).join(' ');
  const pct = Math.round(evidence.value('V81', 'minStrengthFraction') * 100);
  assert.strictEqual(evidence.value('V81', 'minStrengthFraction'), 0.8);
  assert.ok(text('muscle').includes(pct + '% of baseline'));
  assert.ok(text('muscle').includes('“Currently, no standard in-flight measurement of strength exists.”'));
  assert.ok(evidence.get('V85').quote.includes('Currently, no standard in-flight measurement of strength exists.'));
  assert.ok(text('muscle').includes('about ' + evidence.value('V85', 'testDaysAfterLandingAbout') + ' days after landing'));

  assert.strictEqual(evidence.value('V78', 'recommendedSleepPeriodHours'), 8.5);
  assert.ok(text('sleep').includes(evidence.value('V78', 'recommendedSleepPeriodHours') + '-hour sleep period'));
  assert.match(text('sleep'), /recommends/);
  assert.doesNotMatch(text('sleep'), /\brequires\b|\bprotects\b/);
  assert.ok(text('sleep').includes(evidence.value('V79', 'adultSleepHoursLow') + ' to ' + evidence.value('V79', 'adultSleepHoursHigh') + ' hours'));
  assert.ok(text('sleep').includes('about ' + evidence.value('V79', 'inSpaceSleepHoursAbout') + ' hours'));

  assert.ok(text('cardio').includes('“Assessing, recording, monitoring, and trending vital signs”'));
  assert.ok(evidence.get('V77').quote.includes('Assessing, recording, monitoring, and trending vital signs'));

  assert.strictEqual(evidence.value('V83', 'surfaceLimitMSvPerDay'), 0.9);
  assert.ok(text('radiation').includes('less than ' + evidence.value('V83', 'surfaceLimitMSvPerDay') + ' mSv per day'));
  assert.match(text('radiation'), /absorbed dose/);
  assert.match(text('radiation'), /alert the crew/);

  for (const id of CARDS) {
    for (const s of rules.NASA[id].standard) assert.ok(s.sourceIds.length > 0, id + ' standard sources');
  }
  assert.deepStrictEqual(rules.NASA.muscle.standard.map((s) => s.sourceIds[0]), ['V81', 'V85', 'V82']);
  assert.match(text('muscle'), /2023 evidence report/);   // the quote carries its year, beside the 2026 bulletin
  assert.deepStrictEqual(rules.NASA.sleep.standard.map((s) => s.sourceIds[0]), ['V78', 'V79']);
  assert.deepStrictEqual(rules.NASA.cardio.standard.map((s) => s.sourceIds[0]), ['V77']);
  assert.deepStrictEqual(rules.NASA.radiation.standard.map((s) => s.sourceIds[0]), ['V83', 'V84']);
});

test('hazard facts: one NASA fact on each of the first four rows, numbers from evidence', () => {
  const H = rules.HAZARDS;
  for (let i = 0; i < 4; i++) assert.ok(H[i].fact && H[i].fact.text.length > 20 && H[i].fact.sourceIds.length, H[i].name + ' fact');
  assert.strictEqual(H[4].fact, undefined);
  assert.deepStrictEqual(H[0].fact.sourceIds, ['V56']);
  assert.deepStrictEqual(H[1].fact.sourceIds, ['V55']);
  assert.deepStrictEqual(H[2].fact.sourceIds, ['V54']);
  assert.deepStrictEqual(H[3].fact.sourceIds, ['V53']);
  assert.strictEqual(evidence.value('V54', 'commDelayMinutesOneWay'), 20);
  assert.ok(H[2].fact.text.includes('up to ' + evidence.value('V54', 'commDelayMinutesOneWay') + ' minutes one way'));
  assert.ok(H[3].fact.text.includes(evidence.value('V53', 'boneLossPctPerMonthLow') + '% to ' + evidence.value('V53', 'boneLossPctPerMonthHigh') + '%'));
  assert.match(H[3].text + ' ' + H[3].fact.text, /not track|not tracked/i);
  for (const w of ['moon', 'mars']) {
    const f = H[2].worldFact[w], p = PREFIX[w];
    assert.deepStrictEqual(f.sourceIds, ['V75', 'V74']);
    assert.ok(f.text.includes(evidence.value('V75', p + 'Ops')), w + ' V75');
    assert.ok(f.text.includes(evidence.value('V74', p + 'Ops')), w + ' V74');
    assert.ok(f.text.includes(rules.MISSIONS[w].label), w + ' label');
  }
  assert.ok(H[2].worldFact.mars.text.includes('5x5'));
  assert.ok(H[2].worldFact.moon.text.includes('5x3'));
  // No status alarm words in any visible NASA text.
  const all = CARDS.map((id) => JSON.stringify(rules.NASA[id])).join(' ') + JSON.stringify(H);
  assert.doesNotMatch(all, /\b(red|urgent|alarm)\b/i);
  assert.deepStrictEqual(ids(all).filter((x) => !evidence.get(x)), []);
});

test('radiation wording: the solar particle event is on record', () => {
  assert.match(rules.TEXT.radiation.red.meaning, /a solar particle event was recorded/);
  assert.doesNotMatch(rules.TEXT.radiation.red.meaning, /detector flagged/);
});

test('radiation wording names the dose of last night, and the direction map is not a shielding claim', () => {
  assert.match(rules.TEXT.radiation.green.meaning, /^Last night's dose /);
  assert.match(rules.TEXT.radiation.red.meaning, /^Last night's dose /);
  assert.doesNotMatch(JSON.stringify(rules.TEXT.radiation), /sleep station/);
  assert.ok(rules.TEXT.radiation.red.actions.includes('Use the direction map to see which side more particles came from.'));
  // The alert requirement and its rationale are told apart.
  assert.match(rules.NASA.radiation.standard[1].text, /the rationale adds that the crew must be alerted even if ground communication is disrupted/);
});
