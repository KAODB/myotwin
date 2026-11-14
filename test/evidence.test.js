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

test('the five resources listed on the challenge page are present, verified and quoted', () => {
  const items = evidence.items.filter((it) => it.topic === 'challenge resources');
  assert.equal(items.length, 5);
  for (const it of items) {
    assert.equal(it.status, 'verified', it.id);
    assert.ok(it.quote && it.quote.length > 40, it.id + ' needs a quote');
  }
  assert.equal(evidence.value('V44', 'muscleRisk'), 'Risk of Reduced Cardiorespiratory and Musculoskeletal Fitness');
  assert.equal(evidence.value('V43', 'hazards').length, 5);
});

test('the twelve NASA pages linked from the challenge resources are present, verified and quoted', () => {
  const items = evidence.items.filter((it) => it.topic === 'linked from the challenge resources');
  assert.equal(items.length, 12);
  for (const it of items) {
    assert.equal(it.status, 'verified', it.id);
    assert.ok(it.quote && it.quote.length > 40, it.id + ' needs a quote');
    assert.match(it.url, /^https:\/\/www\.nasa\.gov\//, it.id + ' must be a nasa.gov page');
  }
  assert.equal(evidence.value('V48', 'crewOver20PctHigh'), 38);
  assert.equal(evidence.value('V48', 'avgLossPctLow'), 10);
  assert.equal(evidence.value('V53', 'boneLossPctPerMonthHigh'), 1.5);
  assert.equal(evidence.value('V54', 'commDelayMinutesOneWay'), 20);
  // The sentences shown to the user as "what NASA says" must be inside the checked quote.
  for (const id of ['V48', 'V49', 'V50', 'V51', 'V52']) {
    const it = evidence.get(id);
    assert.ok(it.quote.includes(it.values.says), id + ' says');
    assert.ok(it.quote.includes(it.values.canBeDone), id + ' canBeDone');
  }
});

test('Human Research Roadmap ratings and NASA-STD-3001 requirements are present and well formed', () => {
  const cards = { V70: 'muscle', V71: 'sleep', V72: 'cardio', V73: 'radiation', V74: 'medical', V75: 'autonomy' };
  for (const id of Object.keys(cards)) {
    const v = evidence.get(id).values;
    assert.equal(v.card, cards[id], id);
    for (const k of ['lunarSurfaceLongOps', 'marsPlanetaryOps']) assert.match(v[k], /^[1-5]x[1-5]$/, id + ' ' + k);
    for (const k of ['lunarSurfaceLongOpsDisposition', 'marsPlanetaryOpsDisposition', 'gapId', 'gapText', 'lastPublished', 'risk']) assert.ok(v[k], id + ' ' + k);
    assert.match(evidence.get(id).url, /^https:\/\/humanresearchroadmap\.nasa\.gov\/Risks\/\?i=\d+$/);
  }
  // Values read from the rating tables on 2026-11-14; a change here must be deliberate.
  assert.equal(evidence.value('V70', 'marsPlanetaryOps'), '5x4');
  assert.equal(evidence.value('V70', 'lunarSurfaceLongOps'), '5x3');
  assert.equal(evidence.value('V75', 'marsPlanetaryOps'), '5x5');
  assert.equal(evidence.value('V73', 'marsPlanetaryHealth'), '3x3');
  assert.equal(evidence.value('V83', 'surfaceLimitMSvPerDay'), 0.9);
  assert.equal(evidence.value('V78', 'recommendedSleepPeriodHours'), 8.5);
  assert.equal(evidence.value('V85', 'crewLosingOver20Pct'), 31);
  for (const id of ['V76', 'V77', 'V78', 'V79', 'V80', 'V81', 'V82', 'V83', 'V84', 'V85', 'V86', 'V87', 'V88', 'V89']) {
    const it = evidence.get(id);
    assert.equal(it.status, 'verified', id);
    assert.ok(it.quote && it.quote.length > 20, id + ' needs a quote');
  }
});

test('V92 (RAD on Mars, September 2017) and V93 (CRaTER layout) are verified, quoted and carry their numbers', () => {
  const v92 = evidence.get('V92'), v93 = evidence.get('V93');
  assert.equal(v92.status, 'verified');
  assert.equal(v93.status, 'verified');
  assert.ok(v92.quote.includes('23 g/cm2 of CO2') && v92.quote.includes('factors of 2 to 3'));
  assert.deepStrictEqual([evidence.value('V92', 'atmosphereGPerCm2'), evidence.value('V92', 'doseRateRiseFactorLow'), evidence.value('V92', 'doseRateRiseFactorHigh')], [23, 2, 3]);
  assert.ok(v93.quote.includes('53.992 mm') && v93.quote.includes('26.972') && v93.quote.includes('812.8'));
  assert.equal(evidence.value('V93', 'tepZenithMm'), 53.992);
  assert.equal(evidence.value('V93', 'tepNadirMm'), 26.972);
});

test('V94-V96 (sarcopenia consensus tools and phase angle review) are verified, quoted and carry their cut-offs', () => {
  for (const id of ['V94', 'V95', 'V96']) {
    const it = evidence.get(id);
    assert.equal(it.status, 'verified', id);
    assert.equal(it.topic, 'muscle', id);
    assert.ok(it.quote && it.quote.length > 100, id + ' needs a quote');
  }
  const v94 = evidence.get('V94').quote;
  assert.ok(v94.includes('Find-Assess-Confirm-Severity') && v94.includes('SARC-F') && v94.includes('grip strength and chair stand') && v94.includes('DXA and BIA'));
  assert.deepStrictEqual([evidence.value('V94', 'lowGripMenBelowKg'), evidence.value('V94', 'lowGripWomenBelowKg'), evidence.value('V94', 'lowChairStandFiveRisesAboveSec')], [27, 16, 15]);
  assert.equal(evidence.value('V94', 'lowAsmPerHeight2WomenBelowKgM2'), 5.5);
  assert.equal(evidence.value('V94', 'calfCircumferenceProxyBelowCm'), 31);
  const v95 = evidence.get('V95').quote;
  assert.ok(v95.includes('calf circumference (<34 cm in men, <33 cm in women)') && v95.includes('SARC-CalF (≥11)') && v95.includes('bioimpedance'));
  assert.deepStrictEqual([evidence.value('V95', 'calfCircumferenceMenBelowCm'), evidence.value('V95', 'calfCircumferenceWomenBelowCm')], [34, 33]);
  assert.deepStrictEqual([evidence.value('V95', 'sarcFAtLeast'), evidence.value('V95', 'sarcCalFAtLeast')], [4, 11]);
  assert.deepStrictEqual([evidence.value('V95', 'lowGripMenBelowKg'), evidence.value('V95', 'lowGripWomenBelowKg'), evidence.value('V95', 'lowChairStandFiveTimesAtLeastSec')], [28, 18, 12]);
  assert.deepStrictEqual([evidence.value('V95', 'lowMuscleBiaMenBelowKgM2'), evidence.value('V95', 'lowMuscleBiaWomenBelowKgM2')], [7.0, 5.7]);
  assert.ok(evidence.get('V96').quote.includes('PhA is decreased in sarcopenic subjects'));
  assert.deepStrictEqual([evidence.value('V96', 'cutoffLowDeg'), evidence.value('V96', 'cutoffHighDeg')], [4.05, 5.05]);
});
