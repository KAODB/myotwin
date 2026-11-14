// Tests for the body phantom and the three nightly image layers.
// Written with an SI tool (Claude) and reviewed by the team.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const evidence = require('../js/evidence.js');
const phantom = require('../js/phantom.js');
const imaging = require('../js/imaging.js');

const X0_SOFT = evidence.value('V31', 'muscleCm');
const X0_BONE = evidence.value('V31', 'compactBoneCm');
const HUGE = 1e10; // tracks per cm2: noise far below every tolerance

function expected(p, i) { return p.soft[i] / X0_SOFT + p.bone[i] / X0_BONE; }
function rmsNoise(img, p) {
  let s = 0, n = 0;
  for (let i = 0; i < img.values.length; i++) {
    if (!p.region[i]) continue;
    const r = img.values[i] / expected(p, i) - 1;
    s += r * r; n++;
  }
  return Math.sqrt(s / n);
}

// ---- phantom ---------------------------------------------------------------

test('phantom: grid, mass 70-80 kg, every region present', () => {
  const p = phantom.build({});
  assert.equal(p.w, 32); assert.equal(p.h, 96); assert.equal(p.cellCm, 2);
  assert.equal(p.soft.length, 32 * 96);
  const m = phantom.massKg(p);
  assert.ok(m >= 70 && m <= 80, 'mass ' + m);
  const seen = new Set(p.region);
  p.REGIONS.forEach((name, k) => { if (name !== 'none') assert.ok(seen.has(k), 'missing ' + name); });
});

test('phantom: left and right are mirror images', () => {
  const p = phantom.build({ calfMuscleChangePct: -10, thighMuscleChangePct: -5 });
  for (let y = 0; y < p.h; y++) {
    for (let x = 0; x < p.w; x++) {
      const a = y * p.w + x, b = y * p.w + (p.w - 1 - x);
      assert.equal(p.soft[a], p.soft[b]);
      assert.equal(p.bone[a], p.bone[b]);
      const ra = p.REGIONS[p.region[a]], rb = p.REGIONS[p.region[b]];
      assert.equal(ra.replace('_L', '_R'), rb.replace('_L', '_R'));
    }
  }
});

test('phantom: muscle change thins calf soft tissue by muscleFraction', () => {
  const a = phantom.build({}), b = phantom.build({ calfMuscleChangePct: -10 });
  const calf = a.REGIONS.indexOf('calf_L');
  const i = a.region.indexOf(calf);
  assert.ok(Math.abs(b.soft[i] / a.soft[i] - 0.93) < 1e-6);
  assert.ok(phantom.ASSUMPTIONS.every((x) => x.name && 'value' in x && x.unit !== undefined && x.note));
});

// ---- density ---------------------------------------------------------------

test('tracksPerCm2(0.2, 20 deg, 8 h) is between 2100 and 2250', () => {
  const n = imaging.tracksPerCm2({ verticalIntensity: 0.2, coneHalfAngleDeg: 20, hours: 8 });
  assert.ok(n > 2100 && n < 2250, String(n));
});

test('density: seeded and reproducible', () => {
  const p = phantom.build({});
  const a = imaging.render('density', p, { tracksPerCm2: 2000, seed: 7 });
  const b = imaging.render('density', p, { tracksPerCm2: 2000, seed: 7 });
  const c = imaging.render('density', p, { tracksPerCm2: 2000, seed: 8 });
  assert.deepStrictEqual(a.values, b.values);
  assert.notDeepStrictEqual(a.values, c.values);
  assert.equal(a.unit, 'x/X0');
  assert.ok(a.label.length > 10 && a.min < a.max);
});

test('density: huge track count equals expected x/X0 within 0.5%', () => {
  const p = phantom.build({});
  const img = imaging.render('density', p, { tracksPerCm2: HUGE });
  for (let i = 0; i < img.values.length; i++) {
    if (p.region[i]) assert.ok(Math.abs(img.values[i] / expected(p, i) - 1) < 0.005, 'cell ' + i);
  }
});

test('density: doubling the track count lowers noise by 0.6-0.82', () => {
  const p = phantom.build({});
  const n1 = rmsNoise(imaging.render('density', p, { tracksPerCm2: 2000, seed: 3 }), p);
  const n2 = rmsNoise(imaging.render('density', p, { tracksPerCm2: 4000, seed: 4 }), p);
  const ratio = n2 / n1;
  console.log('# noise ratio (2x tracks) = ' + ratio.toFixed(3));
  assert.ok(ratio > 0.6 && ratio < 0.82, String(ratio));
});

test('density: relative noise is momentumSpreadFactor x sqrt(1 / tracks per cell), factor 5', () => {
  assert.equal(imaging.ASSUMPTIONS.find((a) => a.name === 'momentumSpreadFactor').value, 5);
  const p = phantom.build({});
  const n = rmsNoise(imaging.render('density', p, { tracksPerCm2: 2000, seed: 5 }), p);
  const want = 5 * Math.sqrt(1 / (2000 * p.cellCm * p.cellCm));
  assert.ok(Math.abs(n / want - 1) < 0.1, n + ' vs ' + want);
});

test('density: femur centre line is 10-30% denser than neighbouring thigh tissue', () => {
  const p = phantom.build({});
  const img = imaging.render('density', p, { tracksPerCm2: HUGE });
  const thigh = p.REGIONS.indexOf('thigh_L');
  let centre = 0, side = 0;
  for (let y = 0; y < p.h; y++) {
    for (let x = 1; x < p.w - 1; x++) {
      const i = y * p.w + x;
      if (p.region[i] === thigh && p.bone[i] > 0) {
        centre += img.values[i];
        side += (img.values[i - 1] + img.values[i + 1]) / 2;
      }
    }
  }
  assert.ok(centre > 0);
  const r = centre / side;
  assert.ok(r > 1.1 && r < 1.3, String(r));
});

// ---- pressure --------------------------------------------------------------

test('pressure: force balance, moon = earth x V14 ratio, massKg reported', () => {
  const p = phantom.build({});
  const m = phantom.massKg(p);
  const earth = imaging.render('pressure', p, { env: 'earth' });
  const moon = imaging.render('pressure', p, { env: 'moon' });
  const ratio = evidence.value('V14', 'moonRatio');
  const g0 = imaging.ASSUMPTIONS.find((a) => a.name === 'standardGravity').value;
  let forceN = 0;
  for (let i = 0; i < moon.values.length; i++) {
    forceN += moon.values[i] * 1000 * (p.cellCm / 100) ** 2;
    assert.ok(Math.abs(moon.values[i] - earth.values[i] * ratio) <= 1e-6 * (1 + earth.values[i]));
  }
  assert.ok(Math.abs(forceN / (m * g0 * ratio) - 1) < 0.01);
  assert.ok(Math.abs(moon.massKg / m - 1) < 0.01, String(moon.massKg));
  assert.equal(moon.unit, 'kPa');
});

// ---- difference ------------------------------------------------------------

function diffStats(tracks, seedNow, seedBase) {
  const base = phantom.build({});
  const now = phantom.build({ calfMuscleChangePct: -10 });
  const d = imaging.difference(
    imaging.render('density', now, { tracksPerCm2: tracks, seed: seedNow }),
    imaging.render('density', base, { tracksPerCm2: tracks, seed: seedBase }), now);
  assert.equal(d.unit, '%');
  return { d, s: imaging.regionStats(d, now), p: now };
}

test('difference: -10% calf muscle shows about -7% in the calves, 0% in the torso', () => {
  const { d, s, p } = diffStats(HUGE, 1, 2);
  console.log('# calf_L ' + s.calf_L.mean.toFixed(2) + '%, calf_R ' + s.calf_R.mean.toFixed(2) + '%, torso ' + s.torso.mean.toFixed(3) + '% (huge tracks)');
  assert.ok(Math.abs(s.calf_L.mean + 7) < 1, String(s.calf_L.mean));
  assert.ok(Math.abs(s.calf_R.mean + 7) < 1, String(s.calf_R.mean));
  assert.ok(Math.abs(s.torso.mean) < 0.5, String(s.torso.mean));
  const out = p.region.indexOf(0);
  assert.ok(Number.isNaN(d.values[out]));
});

test('difference: calves still clearly negative at 2000 tracks per cm2', () => {
  const { s } = diffStats(2000, 11, 12);
  console.log('# calf_L ' + s.calf_L.mean.toFixed(2) + '%, calf_R ' + s.calf_R.mean.toFixed(2) + '%, torso ' + s.torso.mean.toFixed(2) + '% (2000 tracks/cm2)');
  assert.ok(s.calf_L.mean < -3 && s.calf_R.mean < -3);
});

// ---- impedance -------------------------------------------------------------

test('impedance: calf cells carry the EIM phase, outside is NaN', () => {
  const p = phantom.build({});
  const img = imaging.render('impedance', p, { eimPhaseDeg: 8.1, baselinePhaseDeg: 9.4 });
  const calfL = p.REGIONS.indexOf('calf_L'), calfR = p.REGIONS.indexOf('calf_R'), torso = p.REGIONS.indexOf('torso');
  for (let i = 0; i < img.values.length; i++) {
    const r = p.region[i];
    if (r === 0) assert.ok(Number.isNaN(img.values[i]));
    else if (r === calfL || r === calfR) assert.ok(Math.abs(img.values[i] - 8.1) < 1e-5);
    else if (r === torso) assert.ok(Math.abs(img.values[i] - 9.4) < 1e-5);
  }
  assert.equal(img.unit, 'deg');
  assert.ok(Math.abs(img.min - 8.1) < 1e-5 && Math.abs(img.max - 9.4) < 1e-5);
});
