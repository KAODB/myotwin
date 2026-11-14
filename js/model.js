/*
 * MyoTwin muscle model: a first-order model of calf muscle change under
 * unloading (micro- or partial gravity) and exercise, fitted to bed-rest and
 * ISS anchors, plus the assumed mapping from muscle change to EIM phase.
 *
 * Written with an SI tool (Claude) and reviewed by the team.
 */
(function (root) {
  'use strict';
  var ns = (root.MyoTwin = root.MyoTwin || {});
  var inNode = typeof module === 'object' && module.exports;
  var evidence = inNode ? require('./evidence.js') : ns.evidence;

  var PARAMS = {
    maxLossFraction: {
      value: 0.38, unit: 'fraction of calf muscle volume', status: 'fitted', anchors: ['V4', 'V5'],
      note: 'Long-run loss at g = 0 without exercise (plateau -38%). Fitted with timeConstantDays 42 and exerciseEfficacy 0.72; ' +
        'the model then gives V4 control 60 d -28.9% (published -29%), V4 exercise 60 d -8.1% (published -8%), ' +
        'V5 ISS 180 d with exercise -10.5% (published -13 +/- 2%). V5 used a different, less effective exercise programme, ' +
        'so it is underestimated; matching all three exactly would need a plateau above 50%, so the smaller plateau was kept. ' +
        'The plateau is an extrapolation: there are no human data without countermeasures beyond a few months. ' +
        'Two equivalences are assumed in the fit: 6-degree head-down bed rest (V4) is treated as g = 0, and the ISS crews (V5) as full exercise adherence.'
    },
    timeConstantDays: {
      value: 42, unit: 'days', status: 'fitted', anchors: ['V4', 'V5'],
      note: 'Time constant of the approach to the loss target. Fitted together with maxLossFraction and exerciseEfficacy (see there).'
    },
    exerciseEfficacy: {
      value: 0.72, unit: 'fraction of loss prevented at full adherence', status: 'fitted', anchors: ['V4', 'V5'],
      note: 'From the V4 ratio of exercise to control loss (8/29 = 0.28, so efficacy about 0.72). Applied to V5 as well, ' +
        'although that programme differed (see maxLossFraction).'
    },
    recoveryTimeConstantDays: {
      value: 30, unit: 'days', status: 'assumption', anchors: [],
      note: 'Time constant of recovery toward baseline at g >= 1. No fitted source; chosen to be shorter than the loss time constant.'
    },
    gravityShape: {
      value: 1, unit: 'exponent', status: 'assumption', anchors: ['V6'],
      note: 'Unloading = (1 - g) ^ gravityShape; 1 means loss scales linearly with missing gravity. ' +
        'Mouse data in V6 (0.33 g preserved soleus size, 0.67 g needed for function) suggest the relation may not be linear.'
    },
    eimPhasePctPerMusclePct: {
      value: 1.0, unit: '% phase change per % muscle change', status: 'assumption', anchors: ['V8'],
      note: 'Assumed one-to-one. V8 reports a 28.4% lower 50 kHz phase in the tibialis anterior after 10-59 days in a cast, ' +
        'but with no paired muscle-size measurement, so the slope is not fitted.'
    }
  };

  var GRAVITY = {
    microgravity: 0,
    moon: evidence.value('V14', 'moonRatio'),
    mars: evidence.value('V14', 'marsRatio'),
    earth: 1
  };

  function step(prevChangePct, o) {
    var shape = o.gravityShape == null ? PARAMS.gravityShape.value : o.gravityShape;
    if (o.g >= 1) {
      return prevChangePct * Math.exp(-1 / PARAMS.recoveryTimeConstantDays.value);
    }
    var target = -100 * PARAMS.maxLossFraction.value * Math.pow(1 - o.g, shape) *
      (1 - PARAMS.exerciseEfficacy.value * o.exerciseAdherence);
    return prevChangePct + (target - prevChangePct) * (1 - Math.exp(-1 / PARAMS.timeConstantDays.value));
  }

  function simulate(phases, opts) {
    var shape = opts && opts.gravityShape;
    var out = [0];
    phases.forEach(function (p) {
      for (var d = 0; d < p.days; d++) {
        out.push(step(out[out.length - 1], { g: p.g, exerciseAdherence: p.exerciseAdherence, gravityShape: shape }));
      }
    });
    return out;
  }

  function eimPhase(baselinePhaseDeg, muscleChangePct) {
    return Math.max(0, baselinePhaseDeg * (1 + PARAMS.eimPhasePctPerMusclePct.value * muscleChangePct / 100));
  }

  var api = { PARAMS: PARAMS, GRAVITY: GRAVITY, step: step, simulate: simulate, eimPhase: eimPhase };

  ns.model = api;
  if (inNode) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
