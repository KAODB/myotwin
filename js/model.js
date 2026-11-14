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
  // Rat partial-weight-bearing data (NASA OSDR), read only to add the result of checkGravityTerm
  // to the gravityShape note below. In the browser it is there only if data/osdr-pwb.js loads first.
  var pwb = inNode ? require('../data/osdr-pwb.js') : (ns.data && ns.data.osdrPwb);

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
      value: 1, unit: 'exponent', status: 'assumption', anchors: ['V6', 'V90', 'V91'],
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

  // Declared threshold for checkGravityTerm (not a model parameter, so not in PARAMS).
  var GRAVITY_CHECK = {
    unstablePoints: {
      value: 5, unit: 'percentage points', status: 'assumption',
      note: 'A share is flagged unstable when the 0 g change minus the 1 g change is smaller than this ' +
        '(a small denominator makes the share swing). Chosen by judgement, not fitted.'
    }
  };

  // Fraction of the full-unloading loss that the model keeps at gravity g (1 at g = 0, 0 at g = 1).
  function gravityTerm(g, shape) {
    return Math.pow(1 - g, shape);
  }

  // Share of the fully unloaded loss that remained at partial loading:
  // (changePartial - changeControl) / (changeUnloaded - changeControl), all percent changes over
  // the same period. Subtracting the 1 g control change removes growth, ageing or practice effects
  // seen without unloading. 0 = no loss beyond the controls, 1 = the same loss as full unloading,
  // above 1 = more loss than full unloading. The model's counterpart is gravityTerm(g, shape).
  // When the control change equals the unloaded change the share is undefined: returns null.
  function shareOfUnloadedLoss(changePartial, changeUnloaded, changeControl) {
    var d = changeUnloaded - changeControl;
    return d === 0 ? null : (changePartial - changeControl) / d;
  }

  // Applies shareOfUnloadedLoss to data shaped like data/osdr-pwb.js (passed in, not read here):
  // for each measure and sex, the percent change of the group mean from day 0 to day 28 at each
  // loading, the share at the partial loading, and the model's gravityTerm there for `shape`.
  function checkGravityTerm(data, shape) {
    var L = data.loadings;                       // [1, partial, 0]
    var day = Math.max.apply(null, data.rows.map(function (x) { return x[3]; }));   // last day (28)
    function mean(sex, g, m, d) {
      var r = data.rows.filter(function (x) { return x[0] === sex && x[1] === g && x[2] === m && x[3] === d; })[0];
      return r ? r[5] : null;
    }
    function change(sex, g, m) { return 100 * (mean(sex, g, m, day) / mean(sex, g, m, 0) - 1); }
    var measures = [];
    ['grip', 'plantarflexionTorque', 'calfGirth'].forEach(function (m) {
      ['F', 'M'].forEach(function (sex) {
        var c1 = change(sex, L[0], m), cp = change(sex, L[1], m), c0 = change(sex, L[2], m);
        measures.push({
          measure: m, sex: sex, day: day, pct1g: c1, pct04g: cp, pct0g: c0,
          share: shareOfUnloadedLoss(cp, c0, c1),
          unstable: Math.abs(c0 - c1) < GRAVITY_CHECK.unstablePoints.value
        });
      });
    });
    var s = measures.map(function (x) { return x.share; }).filter(function (v) { return v != null; })
      .sort(function (a, b) { return a - b; });
    var h = s.length >> 1;
    return {
      partialG: L[1], shape: shape, model: gravityTerm(L[1], shape), measures: measures,
      min: s[0], median: s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2, max: s[s.length - 1]
    };
  }

  // Plain-language text for the page, composed only from a checkGravityTerm result `c`:
  // { marks: [{ measure, sex, label, share }], sentences: [3], caveats: [...], closing }.
  var CHECK_NAMES = { grip: 'Grip', plantarflexionTorque: 'Plantarflexion torque', calfGirth: 'Calf girth' };
  var CHECK_SEX = { F: 'females', M: 'males' };
  function describeGravityCheck(c) {
    function f2(v) { return v.toFixed(2); }
    function name(m) { return CHECK_NAMES[m.measure] + ', ' + CHECK_SEX[m.sex]; }
    var day = c.measures[0].day, wb = Math.round(c.partialG * 100) + '%';
    var shares = c.measures.filter(function (m) { return m.share != null; });
    var n = shares.length, below = shares.filter(function (m) { return m.share < c.model; }).length;
    var where = below === 0 ? 'sits below all ' + n + ' shares: it assumes partial gravity protects muscle more than any measure showed' :
      below === n ? 'sits above all ' + n + ' shares: it assumes partial gravity protects muscle less than any measure showed' :
      below === Math.floor(n / 2) || below === Math.ceil(n / 2) ? 'sits near the middle of a wide spread' :
      below < n / 2 ? 'sits in the lower part of a wide spread, below its median: it assumes more protection than most measures showed' :
      'sits in the upper part of a wide spread, above its median: it assumes less protection than most measures showed';
    var caveats = [
      'Rats in a harness for ' + day + ' days: ' + wb + ' weight bearing is an analog of partial gravity, not reduced gravity, and these are not human data.',
      'Grip, plantarflexion torque and calf girth measure strength and girth, not muscle volume, which is what the model tracks.'
    ];
    var mg = c.measures.filter(function (m) { return m.measure === 'grip' && m.sex === 'M'; })[0];
    if (mg && mg.share != null) {
      caveats.push('The male rats at full weight bearing ' + (mg.pct1g >= 0 ? 'gained ' : 'lost ') + Math.abs(Math.round(mg.pct1g)) +
        '% grip over the ' + day + ' days; subtracting that change moves the male grip share to ' + f2(mg.share) + '.');
    }
    var over = shares.filter(function (m) { return m.share > 1; });
    if (over.length) {
      caveats.push((over.length === 1 ? 'One share is' : over.length + ' shares are') + ' above 1 (' +
        over.map(function (m) { return name(m).toLowerCase() + ', ' + f2(m.share); }).join('; ') +
        '): there the rats at ' + wb + ' weight bearing lost more than the fully unloaded rats.');
    }
    var shaky = c.measures.filter(function (m) { return m.unstable; });
    if (shaky.length) {
      caveats.push('Unstable (the 0 g and 1 g changes differ by less than ' + GRAVITY_CHECK.unstablePoints.value + ' points): ' +
        shaky.map(function (m) { return name(m).toLowerCase(); }).join('; ') + '.');
    }
    return {
      marks: c.measures.map(function (m) { return { measure: m.measure, sex: m.sex, label: name(m), share: m.share }; }),
      sentences: [
        'Rats kept at ' + wb + ' weight bearing for ' + day + ' days lost between ' + f2(c.min) + ' and ' + f2(c.max) +
          ' (median ' + f2(c.median) + ') of what fully unloaded rats lost, across ' + n + ' measures, after subtracting the change in rats at full weight bearing.',
        'With the partial-gravity shape at ' + c.shape + ', the model\'s share at ' + c.partialG + ' g is ' + f2(c.model) + '.',
        (c.shape === 1 ? 'The linear assumption ' : 'This shape ') + where + '.'
      ],
      caveats: caveats,
      closing: 'A plausibility check of one assumption, not a fit.'
    };
  }

  if (pwb) {
    var chk = checkGravityTerm(pwb, PARAMS.gravityShape.value);
    PARAMS.gravityShape.note += ' In rats after 28 days at ' + chk.partialG + ' g weight bearing (V90, V91; six measures, 1 g change subtracted), ' +
      'the loss was ' + chk.min.toFixed(2) + ' to ' + chk.max.toFixed(2) + ' (median ' + chk.median.toFixed(2) + ') of the fully unloaded loss; ' +
      'the model uses ' + chk.model.toFixed(2) + ' at ' + chk.partialG + ' g.';
  }

  function step(prevChangePct, o) {
    var shape = o.gravityShape == null ? PARAMS.gravityShape.value : o.gravityShape;
    if (o.g >= 1) {
      return prevChangePct * Math.exp(-1 / PARAMS.recoveryTimeConstantDays.value);
    }
    var target = -100 * PARAMS.maxLossFraction.value * gravityTerm(o.g, shape) *
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

  var api = {
    PARAMS: PARAMS, GRAVITY: GRAVITY, step: step, simulate: simulate, eimPhase: eimPhase,
    GRAVITY_CHECK: GRAVITY_CHECK, gravityTerm: gravityTerm, shareOfUnloadedLoss: shareOfUnloadedLoss, checkGravityTerm: checkGravityTerm,
    describeGravityCheck: describeGravityCheck
  };

  ns.model = api;
  if (inNode) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
