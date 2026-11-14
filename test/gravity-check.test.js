// Tests for the check of the muscle model's gravity term against NASA OSDR
// partial-weight-bearing rat data (data/osdr-pwb.js, OSD-652 and OSD-616):
// data integrity, the builder, the pure comparison functions, the six shares,
// and every number of evidence entries V90-V91 recomputed from the data file.
//
// Written with an SI tool (Claude) and reviewed by the team.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const model = require('../js/model.js');
const evidence = require('../js/evidence.js');
const pwb = require('../data/osdr-pwb.js');

const root = path.join(__dirname, '..');
const r2 = (v) => Math.round(v * 100) / 100;
const pct = (v) => (v >= 0 ? '+' : '') + v.toFixed(1) + '%';

// ---- data ---------------------------------------------------------------------
test('osdr-pwb: provenance, all intact groups present, n 8-10, days in order', () => {
  for (const k of ['name', 'source', 'url', 'retrieved', 'units', 'processing', 'terms']) assert.ok(typeof pwb[k] === 'string' && pwb[k].length > 5, k);
  assert.equal(pwb.retrieved, '2026-11-14');
  assert.match(pwb.url, /^https:\/\//);
  assert.deepStrictEqual(pwb.columns, ['sex', 'loadingG', 'measure', 'day', 'n', 'mean']);
  assert.deepStrictEqual(pwb.loadings, [1, 0.4, 0]);
  const days = { grip: [0, 7, 14, 21, 28], calfGirth: [0, 28], plantarflexionTorque: [0, 28] };
  let expected = 0;
  for (const sex of ['F', 'M']) {
    for (const g of pwb.loadings) {
      for (const m of Object.keys(days)) {
        const got = pwb.rows.filter((r) => r[0] === sex && r[1] === g && r[2] === m).map((r) => r[3]);
        assert.deepStrictEqual(got, days[m], sex + ' ' + g + ' ' + m);
        expected += days[m].length;
      }
    }
  }
  assert.equal(pwb.rows.length, expected);
  for (const [sex, g, m, day, n, mean] of pwb.rows) {
    assert.ok(Number.isInteger(n) && n >= 8 && n <= 10, [sex, g, m, day, n].join(' '));
    assert.ok(typeof mean === 'number' && mean > 0, [sex, g, m, day].join(' '));
  }
});

test('osdr-pwb: the builder reproduces the committed file (skipped when the raw files are absent)', (t) => {
  const dirs = [process.env.OSDR_RAW_DIR, path.join(root, '..', 'data-recon', 'hrp', 'raw', 'osdr'), path.join(root, '..', '..', 'data-recon', 'hrp', 'raw', 'osdr')];
  const grip = 'OSD-652/LSDS-76_Force Transducer_Grip_Strength_Transformed.csv';
  const plate = 'OSD-616/LSDS-61_Force Plate_Force_Plate_Transformed_Reusable_Files.csv';
  const dir = dirs.find((d) => d && fs.existsSync(path.join(d, grip)) && fs.existsSync(path.join(d, plate)));
  if (!dir) return t.skip('raw OSDR files not available');
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'osdr-pwb-')), 'osdr-pwb.js');
  const run = spawnSync('python3', ['-I', path.join(root, 'tools/data/build_osdr_pwb.py'), path.join(dir, grip), path.join(dir, plate), out], { cwd: root, encoding: 'utf8' });
  if (run.error) return t.skip('python3 not available');
  assert.equal(run.status, 0, run.stderr);
  assert.equal(fs.readFileSync(out, 'utf8'), fs.readFileSync(path.join(root, 'data/osdr-pwb.js'), 'utf8'));
});

// ---- pure functions ---------------------------------------------------------------
test('shareOfUnloadedLoss on simple numbers, null when undefined', () => {
  assert.equal(model.shareOfUnloadedLoss(-30, -50, 0), 0.6);
  assert.equal(model.shareOfUnloadedLoss(-20, -40, 10), 0.6);   // control rose 10 points
  assert.equal(model.shareOfUnloadedLoss(-60, -50, 0), 1.2);    // partial lost more than unloaded
  assert.equal(model.shareOfUnloadedLoss(5, -50, 5), 0);
  assert.equal(model.shareOfUnloadedLoss(-10, 3, 3), null);     // control change equals unloaded change
});

test('gravityTerm is (1 - g) ^ shape and step uses it unchanged', () => {
  assert.equal(model.gravityTerm(0.4, 1), 0.6);
  assert.equal(model.gravityTerm(0, 2), 1);
  assert.equal(model.gravityTerm(0.4, 2), Math.pow(0.6, 2));
  const P = model.PARAMS;
  for (const g of [0, 0.165, 0.38, 0.4, 0.9]) {
    for (const a of [0, 0.5, 1]) {
      for (const shape of [undefined, 0.5, 1, 2]) {
        for (const prev of [0, -5, -20]) {
          const s = shape == null ? 1 : shape;
          const target = -100 * P.maxLossFraction.value * Math.pow(1 - g, s) * (1 - P.exerciseEfficacy.value * a);
          const want = prev + (target - prev) * (1 - Math.exp(-1 / P.timeConstantDays.value));
          assert.equal(model.step(prev, { g, exerciseAdherence: a, gravityShape: shape }), want);
        }
      }
    }
  }
});

// ---- the check on the data ------------------------------------------------------------
test('checkGravityTerm: six shares at day 28 and their minimum, median and maximum', () => {
  const c = model.checkGravityTerm(pwb, 1);
  assert.equal(c.partialG, 0.4);
  assert.equal(c.model, 0.6);
  assert.equal(c.measures.length, 6);
  const got = Object.fromEntries(c.measures.map((m) => [m.measure + '_' + m.sex, r2(m.share)]));
  // Read from the output on 2026-11-14; a change here must be deliberate.
  assert.deepStrictEqual(got, {
    grip_F: 0.66, grip_M: 0.93,
    plantarflexionTorque_F: 0.46, plantarflexionTorque_M: 0.25,
    calfGirth_F: 1.05, calfGirth_M: 0.44
  });
  assert.equal(r2(c.min), 0.25);
  assert.equal(r2(c.median), 0.56);
  assert.equal(r2(c.max), 1.05);
  assert.ok(c.measures.every((m) => m.unstable === false));
  assert.equal(r2(model.checkGravityTerm(pwb, 2).model), 0.36);
  // percent changes recomputed from the group means
  for (const m of c.measures) {
    const mean = (g, day) => pwb.rows.find((r) => r[0] === m.sex && r[1] === g && r[2] === m.measure && r[3] === day)[5];
    assert.equal(m.pct1g, 100 * (mean(1, 28) / mean(1, 0) - 1));
    assert.equal(m.pct04g, 100 * (mean(0.4, 28) / mean(0.4, 0) - 1));
    assert.equal(m.pct0g, 100 * (mean(0, 28) / mean(0, 0) - 1));
    assert.equal(m.share, model.shareOfUnloadedLoss(m.pct04g, m.pct0g, m.pct1g));
  }
});

test('gravityShape stays a linear assumption and its note quotes the check', () => {
  const p = model.PARAMS.gravityShape;
  const c = model.checkGravityTerm(pwb, p.value);
  assert.equal(p.value, 1);
  assert.equal(p.status, 'assumption');
  assert.ok(p.anchors.includes('V90') && p.anchors.includes('V91'));
  for (const v of [c.min, c.median, c.max, c.model]) assert.ok(p.note.includes(v.toFixed(2)), p.note);
});

// ---- evidence numbers equal values recomputed from the data ----------------------------
test('V90 (OSD-652 grip) and V91 (OSD-616 torque and girth) match data/osdr-pwb.js', () => {
  const c = model.checkGravityTerm(pwb, 1);
  const find = (measure, sex) => c.measures.find((m) => m.measure === measure && m.sex === sex);
  const spec = { V90: ['grip'], V91: ['plantarflexionTorque', 'calfGirth'] };
  for (const id of Object.keys(spec)) {
    const it = evidence.get(id);
    assert.equal(it.topic, 'muscle');
    assert.equal(it.status, 'verified');
    assert.equal(it.level, 'dataset-record');
    assert.match(it.claim, /rats/i);
    assert.match(it.claim, /not human data/);
    const want = {};
    for (const measure of spec[id]) {
      for (const sex of ['F', 'M']) {
        const m = find(measure, sex);
        const k = measure + sex;
        want[k + '1gPct'] = Math.round(m.pct1g * 10) / 10;
        want[k + '04gPct'] = Math.round(m.pct04g * 10) / 10;
        want[k + '0gPct'] = Math.round(m.pct0g * 10) / 10;
        want[k + 'Share'] = r2(m.share);
        for (const v of [m.pct1g, m.pct04g, m.pct0g]) assert.ok(it.claim.includes(pct(v)), id + ' claim lacks ' + pct(v));
        assert.ok(it.claim.includes(m.share.toFixed(2)), id + ' claim lacks share ' + m.share.toFixed(2));
      }
    }
    const ns = pwb.rows.filter((r) => spec[id].includes(r[2])).map((r) => r[4]);
    want.nMin = Math.min(...ns);
    want.nMax = Math.max(...ns);
    assert.deepStrictEqual(it.values, want, id);
  }
});
