/*
 * MyoTwin night-data simulator. Generates seeded, deterministic NightRecords
 * (see docs/CONTRACT.md) for four scenarios: 14 baseline nights on Earth, then
 * surface nights. Muscle change comes from js/model.js; every other level is
 * either an evidence value (by id) or a declared assumption in ASSUMPTIONS or
 * NOISE below. All output is simulated data.
 *
 * Written with an SI tool (Claude) and reviewed by the team.
 */
(function (root) {
  'use strict';
  var ns = (root.MyoTwin = root.MyoTwin || {});
  var inNode = typeof module === 'object' && module.exports;
  var evidence = inNode ? require('./evidence.js') : ns.evidence;
  var model = inNode ? require('./model.js') : ns.model;

  function a(value, unit, note, sourceIds) {
    return { value: value, unit: unit, status: 'assumption', note: note, sourceIds: sourceIds || [] };
  }

  var ASSUMPTIONS = {
    baselineNights: a(14, 'nights', 'Pre-departure baseline nights on Earth (missionDay -14 .. -1).'),
    firstNightIso: a('2031-01-01', 'ISO date', 'Date of the first baseline night; any date works.'),
    baselinePhaseDeg: a(9.0, 'deg', 'Baseline 50 kHz EIM phase of the calf; same order as the 9.46 deg uncasted leg in V8.', ['V8']),
    arrivalFluidOffsetPct: a(-1.0, '% of phase', 'Offset on moon and mars nights for changed fluid distribution under partial gravity; size assumed. Bioimpedance is fluid-sensitive (V28).', ['V28']),
    contactMin: a(0.6, '0..1', 'Lowest contact quality of a usable scan (contract: usable = contact >= 0.6).'),
    contactMax: a(0.95, '0..1', 'Highest simulated contact quality.'),
    scansMin: a(3, 'scans', 'Fewest usable EIM scans per night.'),
    scansMax: a(6, 'scans', 'Most usable EIM scans per night.'),
    sleepEfficiency: a(0.88, '0..1', 'Mean sleep efficiency.'),
    rrBpm: a(14, 'breaths/min', 'Mean night respiratory rate.'),
    hrBpm: a(54, 'beats/min', 'Mean night heart rate.'),
    movement: a(0.2, '0..1', 'Mean movement index.'),
    sleepHoursPerNight: a(8, 'h', 'Hours of dose accumulation per sleep period.'),
    shieldingFactor: a(1, 'fraction', 'Default multiplier on dose and tracks for habitat shielding at the sleep station (1 = as measured by the surface instrument).'),
    hotSectorIndex: a(2, 'sector', 'Azimuth sector facing a thinner-shielded side.'),
    hotSectorExcess: a(0.3, 'fraction', 'Extra particle count in the hot sector versus the other sectors.'),
    dirCountsPerNight: a(100, 'counts', 'Total counts in the 8-sector direction histogram (a fixed sample, not scaled with dose).'),
    verticalIntensity: a(0.2, 'per cm2 per s per sr', 'Vertical GCR intensity; inside the 0.12-0.40 range implied by V33 (1.5-5.0 per cm2 per s over 4 pi). Used for moon and mars alike (the Mars atmosphere is ignored).', ['V33']),
    coneHalfAngleDeg: a(20, 'deg', 'Half-angle of the accepted track cone.'),
    s2TransitDays: a(180, 'days', 'Earth-Mars transit at g = 0 before the first surface night.'),
    s2TransitAdherence: a(0.9, 'fraction', 'Exercise adherence during the transit.'),
    s4LowActivityG: a(0.7, 'g equivalent', 'Low activity after hospital discharge represented as partial unloading. Not a sourced equivalence.')
  };

  var NOISE = {
    eimPhaseSdFraction: { value: 0.02, unit: 'fraction of value', status: 'assumption', note: 'Night-to-night SD of the EIM phase (median of several scans).' },
    sleepHoursSd: { value: 0.4, unit: 'h', status: 'assumption', note: 'Night-to-night SD of hours asleep.' },
    sleepEfficiencySd: { value: 0.04, unit: '0..1', status: 'assumption', note: 'Night-to-night SD of sleep efficiency.' },
    rrSd: { value: 0.5, unit: 'breaths/min', status: 'assumption', note: 'Night-to-night SD of the respiratory-rate median.' },
    hrSd: { value: 2, unit: 'beats/min', status: 'assumption', note: 'Night-to-night SD of the heart-rate median.' },
    movementSd: { value: 0.05, unit: '0..1', status: 'assumption', note: 'Night-to-night SD of the movement index.' },
    doseSdFraction: { value: 0.05, unit: 'fraction of value', status: 'assumption', note: 'Night-to-night SD of the nightly dose.' },
    dirCounts: { value: 'Poisson', unit: 'counts', status: 'assumption', note: 'Sector counts with Poisson counting noise (normal approximation).' }
  };

  // Clamp ranges for physiological plausibility (assumptions).
  var CLAMP = {
    sleep_h: [2, 11], efficiency: [0.5, 0.99], rr_bpm: [8, 30], hr_bpm: [35, 130], movement: [0, 1]
  };
  NOISE.clamps = { value: CLAMP, unit: 'per field', status: 'assumption', note: 'Radar values are clamped to these plausible ranges.' };

  var G = model.GRAVITY;

  var SCENARIOS = {
    S1: {
      id: 'S1', title: 'Moon base, 60 nights', env: 'moon', baselineNights: 14, sleepMeanH: 7.5,
      summary: 'Sixty nights at a lunar base with full exercise; a week of poor sleep and a misplaced EIM liner. All data are simulated.',
      phases: [{ days: 60, g: G.moon, exerciseAdherence: 1 }],
      planPhases: [{ days: 60, g: G.moon, exerciseAdherence: 1 }],
      events: [
        { from: 30, to: 36, label: 'Poor sleep', sleepMeanH: 5.5 },
        { from: 44, to: 49, label: 'EIM liner misplaced', eimMissing: true }
      ]
    },
    S2: {
      id: 'S2', title: 'Mars surface, first 90 nights', env: 'mars', baselineNights: 14, sleepMeanH: 7.4,
      summary: 'The first 90 nights on Mars after a 180-day transit, with a three-week exercise lapse and a short illness. All data are simulated.',
      phases: [
        { days: ASSUMPTIONS.s2TransitDays.value, g: G.microgravity, exerciseAdherence: ASSUMPTIONS.s2TransitAdherence.value, transit: true },
        { days: 22, g: G.mars, exerciseAdherence: 1 },
        { days: 21, g: G.mars, exerciseAdherence: 0 },
        { days: 47, g: G.mars, exerciseAdherence: 1 }
      ],
      planPhases: [
        { days: ASSUMPTIONS.s2TransitDays.value, g: G.microgravity, exerciseAdherence: ASSUMPTIONS.s2TransitAdherence.value, transit: true },
        { days: 90, g: G.mars, exerciseAdherence: 1 }
      ],
      events: [
        { from: 22, to: 42, label: 'Exercise lapse' },
        { from: 60, to: 63, label: 'Illness', rrAddBpm: 3, hrAddBpm: 9 }
      ]
    },
    S3: {
      id: 'S3', title: 'Moon base, solar particle event', env: 'moon', baselineNights: 14, sleepMeanH: 7.5,
      summary: 'Forty-five nights at a lunar base with a solar particle event on night 20. All data are simulated.',
      phases: [{ days: 45, g: G.moon, exerciseAdherence: 1 }],
      planPhases: [{ days: 45, g: G.moon, exerciseAdherence: 1 }],
      events: [
        { from: 20, to: 20, label: 'Solar particle event', doseFactor: 40, spe: true },
        { from: 21, to: 21, label: 'Event tail', doseFactor: 4 }
      ]
    },
    S4: {
      id: 'S4', title: 'Earth, older adult after hospital discharge', env: 'earth', baselineNights: 14, sleepMeanH: 6.4,
      summary: 'Eight weeks at home after discharge: four weeks of low activity, modelled as partial unloading (g = 0.7, an assumption), then normal activity. All data are simulated.',
      phases: [
        { days: 28, g: ASSUMPTIONS.s4LowActivityG.value, exerciseAdherence: 0 },
        { days: 28, g: G.earth, exerciseAdherence: 0 }
      ],
      planPhases: [{ days: 56, g: G.earth, exerciseAdherence: 0 }],
      events: []
    }
  };

  function mulberry32(seed) {
    var t = seed >>> 0;
    return function () {
      t = (t + 0x6D2B79F5) >>> 0;
      var r = Math.imul(t ^ (t >>> 15), 1 | t);
      r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  function clamp(v, k) { return Math.min(CLAMP[k][1], Math.max(CLAMP[k][0], v)); }
  function round(v, d) { var f = Math.pow(10, d); return Math.round(v * f) / f; }
  function isoDay(offset) {
    var d = new Date(ASSUMPTIONS.firstNightIso.value + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + offset);
    return d.toISOString().slice(0, 10);
  }

  function generate(scenarioId, opts) {
    opts = opts || {};
    var sc = SCENARIOS[scenarioId];
    if (!sc) throw new Error('Unknown scenario: ' + scenarioId);
    var rand = mulberry32(opts.seed == null ? 1 : opts.seed);
    var normal = function () {
      return Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand());
    };
    var A = ASSUMPTIONS, N = NOISE;
    var shield = opts.shieldingFactor == null ? A.shieldingFactor.value : opts.shieldingFactor;
    var sleepMean = opts.sleepOpportunityH == null ? sc.sleepMeanH : opts.sleepOpportunityH;

    // Overrides apply to surface phases only, not to the S2 transit.
    var phases = sc.phases.map(function (p) {
      return p.transit || opts.exerciseAdherence == null ? p :
        { days: p.days, g: p.g, exerciseAdherence: opts.exerciseAdherence };
    });
    var muscle = model.simulate(phases, { gravityShape: opts.gravityShape });
    // The plan is the scenario as intended, so the adherence override does not touch it.
    var planMuscle = model.simulate(sc.planPhases, { gravityShape: opts.gravityShape });
    var planTransitDays = sc.planPhases.reduce(function (t, p) { return t + (p.transit ? p.days : 0); }, 0);
    var transitDays = 0, dayAdherence = [];
    phases.forEach(function (p) {
      if (p.transit) { transitDays += p.days; return; }
      for (var i = 0; i < p.days; i++) dayAdherence.push(p.exerciseAdherence);
    });

    var doseRate = sc.env === 'moon' ? evidence.value('V12', 'doseRateUGyPerH') :
      sc.env === 'mars' ? evidence.value('V16', 'doseRateSiUGyPerH') : null;
    var cone = 2 * Math.PI * (1 - Math.cos(A.coneHalfAngleDeg.value * Math.PI / 180));
    var tracksBase = A.verticalIntensity.value * cone * A.sleepHoursPerNight.value * 3600 * shield;
    var sectorWeight = [];
    for (var s = 0; s < 8; s++) sectorWeight.push(s === A.hotSectorIndex.value ? 1 + A.hotSectorExcess.value : 1);
    var weightSum = sectorWeight.reduce(function (x, y) { return x + y; }, 0);

    var records = [], expected = [];
    var base = A.baselineNights.value;
    for (var k = 0; k < base + dayAdherence.length; k++) {
      var md = k - base;
      var surf = md >= 0;
      var env = surf ? sc.env : 'earth';
      var ev = {};
      sc.events.forEach(function (e) {
        if (md >= e.from && md <= e.to) Object.keys(e).forEach(function (key) { ev[key] = e[key]; });
      });
      // Baseline nights log exercise with the first surface day's adherence.
      var adherence = surf ? dayAdherence[md] : dayAdherence[0];
      var change = surf ? muscle[transitDays + md + 1] : 0;

      // Draw every random number every night so streams stay aligned across what-if overrides.
      var u = {
        phase: normal(), contact: rand(), scans: rand(),
        sleep: normal(), eff: normal(), rr: normal(), hr: normal(), mov: normal(),
        dose: normal(), dir: sectorWeight.map(normal), exercise: rand()
      };

      var phase = model.eimPhase(A.baselinePhaseDeg.value, change) *
        (env === 'moon' || env === 'mars' ? 1 + A.arrivalFluidOffsetPct.value / 100 : 1) *
        (1 + N.eimPhaseSdFraction.value * u.phase);
      var eim = ev.eimMissing ? null : {
        site: 'calf_L',
        phase50_deg: round(phase, 3),
        contact: round(A.contactMin.value + (A.contactMax.value - A.contactMin.value) * u.contact, 2),
        scans: A.scansMin.value + Math.floor(u.scans * (A.scansMax.value - A.scansMin.value + 1))
      };

      var radar = {
        sleep_h: round(clamp((ev.sleepMeanH == null ? sleepMean : ev.sleepMeanH) + N.sleepHoursSd.value * u.sleep, 'sleep_h'), 2),
        efficiency: round(clamp(A.sleepEfficiency.value + N.sleepEfficiencySd.value * u.eff, 'efficiency'), 3),
        rr_bpm: round(clamp(A.rrBpm.value + (ev.rrAddBpm || 0) + N.rrSd.value * u.rr, 'rr_bpm'), 1),
        hr_bpm: round(clamp(A.hrBpm.value + (ev.hrAddBpm || 0) + N.hrSd.value * u.hr, 'hr_bpm'), 1),
        movement: round(clamp(A.movement.value + N.movementSd.value * u.mov, 'movement'), 3)
      };

      var factor = ev.doseFactor || 1;
      var hasRad = surf && doseRate !== null;
      var rad = hasRad ? {
        dose_uGy: round(Math.max(0, doseRate * A.sleepHoursPerNight.value * shield * factor * (1 + N.doseSdFraction.value * u.dose)), 1),
        dir: sectorWeight.map(function (w, i) {
          var mean = A.dirCountsPerNight.value * w / weightSum;
          return Math.max(0, Math.round(mean + Math.sqrt(mean) * u.dir[i]));
        }),
        spe: !!ev.spe
      } : null;

      expected.push(surf ? round(planMuscle[planTransitDays + md + 1], 3) : 0);
      records.push({
        night: isoDay(surf ? k + transitDays : k),
        missionDay: md,
        env: env,
        eim: eim,
        radar: radar,
        rad: rad,
        log: { exercise_done: u.exercise < adherence, note: ev.label || '' },
        _truth: {
          muscleChangePct: round(change, 3),
          tracksPerCm2: hasRad ? Math.round(tracksBase * factor) : null
        }
      });
    }
    return { scenario: sc, records: records, plan: { expectedChangePct: expected } };
  }

  var api = { SCENARIOS: SCENARIOS, ASSUMPTIONS: ASSUMPTIONS, NOISE: NOISE, generate: generate };

  ns.sim = api;
  if (inNode) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
