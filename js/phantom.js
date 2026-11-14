/*
 * MyoTwin body phantom: a simplified supine adult on a 2 cm grid, built from
 * ellipses and tapered limbs. For each cell it gives the vertical path length
 * (cm) through soft tissue and through bone, and a body-region label. Every
 * dimension is an illustrative assumption, listed in phantom.ASSUMPTIONS.
 *
 * Written with an SI tool (Claude) and reviewed by the team.
 */
(function (root) {
  'use strict';
  var ns = (root.MyoTwin = root.MyoTwin || {});
  var inNode = typeof module === 'object' && module.exports;
  var evidence = inNode ? require('./evidence.js') : ns.evidence;

  var REGIONS = ['none', 'head', 'torso', 'arm_L', 'arm_R', 'pelvis', 'thigh_L', 'thigh_R', 'calf_L', 'calf_R', 'foot_L', 'foot_R'];
  var W = 32, H = 96, CELL = 2;
  var MUSCLE_FRACTION = { calf: 0.7, thigh: 0.6 };

  // y0..y1: extent from the top of the head (cm). xc: centre offset from the
  // midline (cm); paired parts are mirrored, '_L' on the image right (+x),
  // as in a radiograph viewed from the feet. a: half-width, t: thickness (cm),
  // each at y0 and y1 (linear taper between). The cross-section is elliptical
  // in x; ellipsoid parts are also elliptical in y. bone: compact-bone path
  // length (cm) in a band of half-width bw (cm) around xc.
  var PARTS = [
    { name: 'head', region: 'head', y0: 1, y1: 23, xc: 0, a: [8, 8], t: [19, 19], ellipsoid: true, bone: 1.4, bw: 8, boneName: 'skull' },
    { name: 'neck', region: 'torso', y0: 22, y1: 29, xc: 0, a: [6, 6], t: [11, 11], bone: 1.5, bw: 2, boneName: 'cervical spine' },
    { name: 'torso', region: 'torso', y0: 29, y1: 92, xc: 0, a: [16, 15], t: [22, 21], bone: 3, bw: 2, boneName: 'spine' },
    { name: 'pelvis', region: 'pelvis', y0: 92, y1: 106, xc: 0, a: [16, 16], t: [21, 20], bone: 1.5, bw: 14, boneName: 'pelvis' },
    { name: 'arm', region: 'arm', y0: 30, y1: 110, xc: 21, a: [4.5, 3], t: [9, 5], bone: 0.9, bw: 1, boneName: 'arm bones' },
    { name: 'thigh', region: 'thigh', y0: 106, y1: 148, xc: 9, a: [8, 6], t: [17, 12], bone: 1.3, bw: 1, boneName: 'femur' },
    { name: 'calf', region: 'calf', y0: 148, y1: 184, xc: 7, a: [6, 3.5], t: [11, 7], bone: 1.2, bw: 1, boneName: 'tibia' },
    { name: 'foot', region: 'foot', y0: 184, y1: 192, xc: 7, a: [4.5, 4.5], t: [9, 9], ellipsoid: true, bone: 0, bw: 0, boneName: null }
  ];

  var ASSUMPTIONS = [
    { name: 'gridCell', value: CELL, unit: 'cm', status: 'assumption', note: 'Grid of ' + W + ' x ' + H + ' cells (64 x 192 cm), supine, head at the top.' },
    { name: 'leftSide', value: '+x', unit: '', status: 'assumption', note: "Patient's left is drawn on the image right, as when viewing a radiograph." }
  ];
  PARTS.forEach(function (p) {
    var pre = p.name + (p.xc ? ' (each side, centre ' + p.xc + ' cm from the midline)' : '');
    ASSUMPTIONS.push({ name: p.name + 'Extent', value: [p.y0, p.y1], unit: 'cm from top', status: 'assumption', note: pre + ': head-to-foot extent.' });
    ASSUMPTIONS.push({ name: p.name + 'HalfWidth', value: p.a, unit: 'cm', status: 'assumption', note: pre + ': half-width at top and bottom, linear taper.' });
    ASSUMPTIONS.push({ name: p.name + 'Thickness', value: p.t, unit: 'cm', status: 'assumption', note: pre + ': front-to-back thickness at top and bottom, elliptical profile across the width' + (p.ellipsoid ? ' and along the length.' : '.') });
    if (p.bone) ASSUMPTIONS.push({ name: p.name + 'Bone', value: p.bone, unit: 'cm', status: 'assumption', note: p.boneName + ': compact-bone path length in a band of half-width ' + p.bw + ' cm; replaces soft tissue.' });
  });
  ASSUMPTIONS.push({ name: 'calfMuscleFraction', value: MUSCLE_FRACTION.calf, unit: '', status: 'assumption', note: 'Share of calf soft-tissue path that is muscle; muscle change scales soft tissue by 1 + fraction x change.' });
  ASSUMPTIONS.push({ name: 'thighMuscleFraction', value: MUSCLE_FRACTION.thigh, unit: '', status: 'assumption', note: 'Share of thigh soft-tissue path that is muscle; same rule as the calf.' });

  function build(opts) {
    opts = opts || {};
    var change = { calf: opts.calfMuscleChangePct || 0, thigh: opts.thighMuscleChangePct || 0 };
    var soft = new Float32Array(W * H), bone = new Float32Array(W * H), region = new Uint8Array(W * H);
    for (var row = 0; row < H; row++) {
      var y = (row + 0.5) * CELL;
      for (var col = 0; col < W; col++) {
        var x = (col + 0.5) * CELL - W * CELL / 2, i = row * W + col;
        var best = 0, bestPart = null, side = '';
        PARTS.forEach(function (p) {
          if (y < p.y0 || y > p.y1) return;
          var f = (y - p.y0) / (p.y1 - p.y0);
          var a = p.a[0] + f * (p.a[1] - p.a[0]), t = p.t[0] + f * (p.t[1] - p.t[0]);
          var dx = Math.abs(x) - p.xc, s = x > 0 ? '_L' : '_R';
          if (!p.xc) { dx = x; s = ''; }
          var q = 1 - (dx / a) * (dx / a);
          if (p.ellipsoid) { var dy = (2 * f - 1); q -= dy * dy; }
          var th = q > 0 ? t * Math.sqrt(q) : 0;
          if (th > best) { best = th; bestPart = p; side = s; }
        });
        if (!bestPart) continue;
        var dxb = bestPart.xc ? Math.abs(x) - bestPart.xc : x;
        var b = Math.abs(dxb) < bestPart.bw ? Math.min(bestPart.bone, best) : 0;
        var sf = best - b;
        var mf = MUSCLE_FRACTION[bestPart.region];
        if (mf) sf *= 1 + mf * change[bestPart.region] / 100;
        soft[i] = sf; bone[i] = b;
        region[i] = REGIONS.indexOf(bestPart.region + side);
      }
    }
    return { w: W, h: H, cellCm: CELL, soft: soft, bone: bone, region: region, REGIONS: REGIONS };
  }

  /** Total mass (kg) from the evidence V31 densities. */
  function massKg(p) {
    var rs = evidence.value('V31', 'muscleDensityGPerCm3'), rb = evidence.value('V31', 'compactBoneDensityGPerCm3');
    var g = 0;
    for (var i = 0; i < p.soft.length; i++) g += p.soft[i] * rs + p.bone[i] * rb;
    return g * p.cellCm * p.cellCm / 1000;
  }

  var api = { build: build, massKg: massKg, REGIONS: REGIONS, ASSUMPTIONS: ASSUMPTIONS };

  ns.phantom = api;
  if (inNode) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
