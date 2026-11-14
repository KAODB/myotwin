// Tests for the real-data modules in data/ and the evidence entries that quote
// them: row counts, date order, plausible ranges, documented gaps, and every
// number in V60-V63 recomputed from the data files.
//
// Written with an SI tool (Claude) and reviewed by the team.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const evidence = require('../js/evidence.js');
const msl = require('../data/msl-rad.js');
const crater = require('../data/lro-crater.js');
const donki = require('../data/donki-sep-2017.js');
const omni = require('../data/omni-protons.js');

const median = (a) => { const s = a.slice().sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const round = (v, d) => Math.round(v * 10 ** d) / 10 ** d;
const DAY = 86400000;
const daysApart = (a, b) => (Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / DAY;

test('every data module carries provenance', () => {
  for (const d of [msl, crater, donki, omni]) {
    for (const k of ['source', 'url', 'retrieved', 'units', 'processing', 'terms']) assert.ok(typeof d[k] === 'string' && d[k].length > 5, k);
    assert.equal(d.retrieved, '2026-11-14');
    assert.match(d.url, /^https:\/\//);
  }
});

test('msl-rad: 94 sols, 13..112, only the documented sols missing, plausible values', () => {
  assert.equal(msl.rows.length, 94);
  assert.deepStrictEqual(msl.missingSols, [29, 30, 31, 32, 33, 64]);
  const sols = msl.rows.map((r) => r[0]);
  const expect = [];
  for (let s = 13; s <= 112; s++) if (!msl.missingSols.includes(s)) expect.push(s);
  assert.deepStrictEqual(sols, expect);
  for (let i = 1; i < msl.rows.length; i++) assert.ok(msl.rows[i][1] >= msl.rows[i - 1][1], 'date order at sol ' + sols[i]);
  for (const [sol, date, b, n] of msl.rows) {
    assert.match(date, /^2012-\d\d-\d\d$/);
    assert.ok(b > 5 && b < 15, 'sol ' + sol + ' B ' + b);
    assert.ok(n >= 10 && n <= 60, 'sol ' + sol + ' n ' + n);
  }
});

test('lro-crater: complete nightly windows, no gaps, plausible values', () => {
  assert.deepStrictEqual(crater.droppedNights, []);
  for (const [name, first, last, n] of [['quiet', '2017-04-21', '2017-06-19', 60], ['event', '2017-08-21', '2017-10-05', 46]]) {
    const rows = crater[name];
    assert.equal(rows.length, n, name);
    assert.equal(rows[0][0], first);
    assert.equal(rows[rows.length - 1][0], last);
    for (let i = 1; i < rows.length; i++) assert.equal(daysApart(rows[i - 1][0], rows[i][0]), 1, name + ' gap at ' + rows[i][0]);
    for (const [date, d56, d12] of rows) assert.ok(d56 > 50 && d12 > 50 && d56 < 1e5 && d12 < 1e6, name + ' ' + date);
  }
  // Quiet window: every night within 20% of the window median behind D5&6.
  const q = median(crater.quiet.map((r) => r[1]));
  assert.ok(crater.quiet.every((r) => Math.abs(r[1] / q - 1) < 0.2));
});

test('donki: ten SEP records in September 2017, sorted, inside the query coverage', () => {
  assert.equal(donki.rows.length, 10);
  for (let i = 0; i < donki.rows.length; i++) {
    const [id, start, inst, linked] = donki.rows[i];
    assert.match(id, /-SEP-\d{3}$/);
    assert.ok(Date.parse(start) >= Date.parse(donki.coverage[0]) && Date.parse(start) < Date.parse(donki.coverage[1]), id);
    assert.ok(Array.isArray(inst) && Array.isArray(linked));
    if (i) assert.ok(start >= donki.rows[i - 1][1]);
  }
});

test('omni: 312 consecutive hours from 2017-09-04T00Z, no fill values', () => {
  assert.equal(omni.rows.length, 312);
  assert.equal(omni.rows[0][0], '2017-09-04T00:00Z');
  for (let i = 1; i < omni.rows.length; i++) assert.equal(Date.parse(omni.rows[i][0]) - Date.parse(omni.rows[i - 1][0]), 3600000);
  assert.ok(omni.rows.every((r) => typeof r[1] === 'number' && r[1] > 0));
});

// ---- evidence numbers equal values recomputed from the data -----------------
test('V60 (Curiosity RAD series) matches data/msl-rad.js', () => {
  const v = evidence.get('V60').values;
  const b = msl.rows.map((r) => r[2]);
  assert.equal(v.sols, msl.rows.length);
  assert.equal(v.firstSol, msl.rows[0][0]);
  assert.equal(v.lastSol, msl.rows[msl.rows.length - 1][0]);
  assert.equal(v.firstDate, msl.rows[0][1]);
  assert.equal(v.lastDate, msl.rows[msl.rows.length - 1][1]);
  assert.equal(v.meanOfSolMediansUGyPerH, round(b.reduce((x, y) => x + y, 0) / b.length, 2));
  assert.equal(v.minSolMedianUGyPerH, Math.min(...b));
  assert.equal(v.maxSolMedianUGyPerH, Math.max(...b));
  assert.deepStrictEqual(v.missingSols, msl.missingSols);
});

test('V61 (LRO CRaTER quiet level and 10 Sep 2017 multiple) matches data/lro-crater.js', () => {
  const it = evidence.get('V61');
  const v = it.values;
  assert.equal(it.quote, crater.fileHeader);
  const qD56 = median(crater.quiet.map((r) => r[1]));
  const qD12 = median(crater.quiet.map((r) => r[2]));
  const sep10 = crater.event.find((r) => r[0] === '2017-09-10');
  assert.equal(v.quietNights, crater.quiet.length);
  assert.equal(v.quietMedianD56UGyPerNight, round(qD56, 1));
  assert.equal(v.quietMedianD12UGyPerNight, round(qD12, 1));
  assert.equal(v.sep10D56UGyPerNight, sep10[1]);
  assert.equal(v.sep10D12UGyPerNight, sep10[2]);
  assert.equal(v.sep10MultipleD56, Math.round(sep10[1] / qD56));
  assert.equal(v.sep10MultipleD12, Math.round(sep10[2] / qD12));
});

test('V62 (DONKI 2017-09-10T16:45:00-SEP-001) matches data/donki-sep-2017.js', () => {
  const v = evidence.get('V62').values;
  const r = donki.rows.find((x) => x[0] === v.id);
  assert.equal(v.id, '2017-09-10T16:45:00-SEP-001');
  assert.equal(v.start, r[1]);
  assert.deepStrictEqual(v.instruments, r[2]);
  assert.equal(v.flareId, r[3].find((x) => x.includes('-FLR-')));
  assert.equal(v.cmeId, r[3].find((x) => x.includes('-CME-')));
});

test('V63 (OMNI2 peak above 10 MeV) matches data/omni-protons.js', () => {
  const v = evidence.get('V63').values;
  const peak = omni.rows.reduce((a, b) => (b[1] > a[1] ? b : a));
  assert.equal(v.peakGt10MeVPfu, peak[1]);
  assert.equal(v.peakHour, peak[0]);
});

test('V12 (Chang\'E-4) is gone; the new entries are verified dataset records', () => {
  assert.throws(() => evidence.get('V12'));
  for (const id of ['V60', 'V61', 'V62', 'V63']) {
    const it = evidence.get(id);
    assert.equal(it.topic, 'radiation');
    assert.equal(it.status, 'verified');
    assert.equal(it.level, 'dataset-record');
  }
});
