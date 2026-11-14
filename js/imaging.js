/*
 * MyoTwin nightly whole-body image layers, synthesised from the phantom:
 * density (cosmic-ray scattering, experimental), pressure (an assumed mat under
 * the sleeper) and impedance (regional EIM reading painted on
 * the outline). Also the per-region difference against a baseline image.
 * All images are simulated and approximate; assumptions are in
 * imaging.ASSUMPTIONS. No drawing code here: the UI draws the arrays.
 *
 * Written with an SI tool (Claude) and reviewed by the team.
 */
(function (root) {
  'use strict';
  var ns = (root.MyoTwin = root.MyoTwin || {});
  var inNode = typeof module === 'object' && module.exports;
  var evidence = inNode ? require('./evidence.js') : ns.evidence;

  var ASSUMPTIONS = [
    { name: 'momentumSpreadFactor', value: 5, unit: '', status: 'assumption', note: 'Stands for the unknown momentum of each particle: the trackers measure the angle but not the momentum, so each track is a noisier estimate of x/X0. Our Gaussian-core estimate is 3 to 6 over the solar cycle for 7 to 22 cm of tissue; single-scattering tails make it larger. Both projections of each track are used. Multiplies the counting noise.' },
    { name: 'coneHalfAngleDeg', value: 20, unit: 'deg', status: 'assumption', note: 'Default acceptance cone around the vertical for usable tracks.' },
    { name: 'noLoadTransfer', value: true, unit: '', status: 'assumption', note: 'Pressure: each column of tissue rests on the mat cell directly below it, with no load transfer between cells.' },
    { name: 'outsideNoiseRefCm', value: 2, unit: 'cm', status: 'assumption', note: 'Density: cells outside the body get the absolute noise of a body cell this thick in muscle, around 0.' },
    { name: 'standardGravity', value: 9.80665, unit: 'm/s2', status: 'assumption', note: 'Standard Earth gravity (defined constant); Moon and Mars use the V14 ratios.' }
  ];
  function A(name) { for (var i = 0; i < ASSUMPTIONS.length; i++) if (ASSUMPTIONS[i].name === name) return ASSUMPTIONS[i].value; }
  var GRAVITY_RATIO = { earth: 1, moon: evidence.value('V14', 'moonRatio'), mars: evidence.value('V14', 'marsRatio') };

  function tracksPerCm2(o) {
    var ang = (o.coneHalfAngleDeg === undefined ? A('coneHalfAngleDeg') : o.coneHalfAngleDeg) * Math.PI / 180;
    var hours = o.hours === undefined ? 8 : o.hours, sf = o.shieldingFactor === undefined ? 1 : o.shieldingFactor;
    return o.verticalIntensity * 2 * Math.PI * (1 - Math.cos(ang)) * hours * 3600 * sf;
  }

  // Seeded uniform generator (mulberry32) and Box-Muller normal deviates.
  function mulberry32(a) {
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function normal(rand) { return Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand()); }

  function finish(p, values, unit, label) {
    var min = Infinity, max = -Infinity;
    for (var i = 0; i < values.length; i++) {
      var v = values[i];
      if (v === v) { if (v < min) min = v; if (v > max) max = v; }
    }
    if (min > max) min = max = NaN;
    return { w: p.w, h: p.h, values: values, unit: unit, min: min, max: max, label: label };
  }

  function render(layer, p, o) {
    o = o || {};
    var n = p.w * p.h, v = new Float32Array(n), i;
    if (layer === 'density') {
      var x0s = evidence.value('V31', 'muscleCm'), x0b = evidence.value('V31', 'compactBoneCm');
      var k = o.momentumSpreadFactor === undefined ? A('momentumSpreadFactor') : o.momentumSpreadFactor;
      var rel = k * Math.sqrt(1 / (o.tracksPerCm2 * p.cellCm * p.cellCm));
      var outside = rel * A('outsideNoiseRefCm') / x0s;
      var rand = mulberry32(o.seed === undefined ? 1 : o.seed);
      for (i = 0; i < n; i++) {
        var e = p.soft[i] / x0s + p.bone[i] / x0b;
        v[i] = p.region[i] ? e * (1 + rel * normal(rand)) : outside * normal(rand);
      }
      return finish(p, v, 'x/X0', 'Areal density from cosmic-ray scattering (simulated, experimental)');
    }
    if (layer === 'pressure') {
      var rs = evidence.value('V31', 'muscleDensityGPerCm3'), rb = evidence.value('V31', 'compactBoneDensityGPerCm3');
      var g = A('standardGravity') * GRAVITY_RATIO[o.env || 'moon'];
      var force = 0, area = Math.pow(p.cellCm / 100, 2);
      // g/cm2 -> kg/m2 is x10; Pa -> kPa is /1000.
      for (i = 0; i < n; i++) { v[i] = (p.soft[i] * rs + p.bone[i] * rb) * 10 * g / 1000; force += v[i] * 1000 * area; }
      var img = finish(p, v, 'kPa', 'Pressure under the sleeper (simulated)');
      img.massKg = force / g;
      return img;
    }
    if (layer === 'impedance') {
      var cl = p.REGIONS.indexOf('calf_L'), cr = p.REGIONS.indexOf('calf_R');
      for (i = 0; i < n; i++) {
        var r = p.region[i];
        v[i] = !r ? NaN : (r === cl || r === cr) ? o.eimPhaseDeg : o.baselinePhaseDeg;
      }
      return finish(p, v, 'deg', 'Calf muscle impedance phase at 50 kHz (simulated)');
    }
    throw new Error('Unknown image layer: ' + layer);
  }

  function regionStats(img, p) {
    var sum = new Float64Array(p.REGIONS.length), cnt = new Float64Array(p.REGIONS.length), out = {};
    for (var i = 0; i < img.values.length; i++) {
      var v = img.values[i];
      if (p.region[i] && v === v) { sum[p.region[i]] += v; cnt[p.region[i]]++; }
    }
    for (var r = 1; r < p.REGIONS.length; r++) out[p.REGIONS[r]] = { mean: cnt[r] ? sum[r] / cnt[r] : NaN, n: cnt[r] };
    return out;
  }

  function difference(now, base, p) {
    var pct = new Float32Array(p.w * p.h), i;
    for (i = 0; i < pct.length; i++) pct[i] = p.region[i] && base.values[i] ? (now.values[i] / base.values[i] - 1) * 100 : NaN;
    var s = regionStats({ values: pct }, p);
    for (i = 0; i < pct.length; i++) pct[i] = p.region[i] ? s[p.REGIONS[p.region[i]]].mean : NaN;
    return finish(p, pct, '%', 'Change versus baseline, averaged per body region (simulated)');
  }

  var api = { tracksPerCm2: tracksPerCm2, render: render, difference: difference, regionStats: regionStats, ASSUMPTIONS: ASSUMPTIONS };

  ns.imaging = api;
  if (inNode) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
