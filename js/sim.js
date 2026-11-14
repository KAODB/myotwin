/*
 * MyoTwin night-data simulator. Generates seeded, deterministic NightRecords
 * (see docs/CONTRACT.md) for four scenarios: 14 baseline nights on Earth, then
 * surface nights. Muscle change comes from js/model.js. The nightly radiation
 * dose on Moon and Mars nights replays real measurements night by night (LRO
 * CRaTER, Curiosity RAD, with DONKI event records; see data/README.md). Every
 * other level is either an evidence value (by id) or a declared assumption in
 * ASSUMPTIONS or NOISE below, and is simulated.
 *
 * Written with an SI tool (Claude) and reviewed by the team.
 */
(function (root) {
  'use strict';
  var ns = (root.MyoTwin = root.MyoTwin || {});
  var inNode = typeof module === 'object' && module.exports;
  var model = inNode ? require('./model.js') : ns.model;

  // Real-data modules (data/*.js). In the browser they must be loaded by script tags before this file.
  function need(name, file) {
    var d;
    try { d = inNode ? require('../data/' + file) : (ns.data || {})[name]; } catch (err) { d = null; }
    if (!d || !d.columns) throw new Error('MyoTwin sim: real-data module data/' + file + ' is missing; load it before js/sim.js.');
    return d;
  }
  var MSL = need('mslRad', 'msl-rad.js');
  var CRATER = need('lroCrater', 'lro-crater.js');
  var DONKI = need('donkiSep2017', 'donki-sep-2017.js');

  function a(value, unit, note, sourceIds) {
    return { value: value, unit: unit, status: 'assumption', note: note, sourceIds: sourceIds || [] };
  }

  var ASSUMPTIONS = {
    baselineNights: a(14, 'nights', 'Pre-departure baseline nights on Earth (missionDay -14 .. -1).'),
    firstNightIso: a('2031-01-01', 'ISO date', 'Date of the first baseline night; any date works.'),
    baselinePhaseDeg: a(9.0, 'deg', 'Default baseline 50 kHz EIM phase of the calf; same order as the 9.46 deg uncasted leg in V8. Each scenario person overrides it.', ['V8']),
    arrivalFluidOffsetPct: a(-1.0, '% of phase', 'Offset on moon and mars nights for changed fluid distribution under partial gravity; size assumed. Bioimpedance is fluid-sensitive (V28).', ['V28']),
    contactMin: a(0.6, '0..1', 'Lowest contact quality of a usable scan (contract: usable = contact >= 0.6).'),
    contactMax: a(0.95, '0..1', 'Highest simulated contact quality.'),
    scansMin: a(3, 'scans', 'Fewest usable EIM scans per night.'),
    scansMax: a(6, 'scans', 'Most usable EIM scans per night.'),
    sleepEfficiency: a(0.88, '0..1', 'Mean sleep efficiency.'),
    rrBpm: a(14, 'breaths/min', 'Default mean night respiratory rate; each scenario person overrides it.'),
    hrBpm: a(54, 'beats/min', 'Default mean night heart rate; each scenario person overrides it.'),
    personS1: a({ baselinePhaseDeg: 9.2, hrBpm: 52, rrBpm: 13.5 }, 'deg, beats/min, breaths/min', 'S1 crew member; values chosen so the four scenarios show different people.'),
    personS2: a({ baselinePhaseDeg: 8.8, hrBpm: 56, rrBpm: 14.5 }, 'deg, beats/min, breaths/min', 'S2 crew member; values chosen so the four scenarios show different people.'),
    personS3: a({ baselinePhaseDeg: 9.5, hrBpm: 50, rrBpm: 13 }, 'deg, beats/min, breaths/min', 'S3 crew member; values chosen so the four scenarios show different people.'),
    personS4: a({ baselinePhaseDeg: 7.4, hrBpm: 64, rrBpm: 16 }, 'deg, beats/min, breaths/min', 'S4 older adult. EIM phase falls with age (V9), so the baseline phase is lower; the value itself is an assumption.', ['V9']),
    scenarioSeeds: a({ S1: 11, S2: 23, S3: 37, S4: 41 }, 'seed', 'Default random seed per scenario so each scenario shows its own nights; opts.seed overrides.'),
    eimNoiseSdMax: a(0.2, 'fraction of value', 'Largest accepted what-if EIM noise (opts.eimNoiseSdFraction); other values are ignored.'),
    movement: a(0.2, '0..1', 'Mean movement index.'),
    sleepHoursPerNight: a(8, 'h', 'Hours of dose accumulation per sleep period. On Mars nights the replayed sol median dose rate is multiplied by it.'),
    shieldingFactor: a(1, 'fraction', 'Default multiplier on dose and tracks for habitat shielding at the sleep station (1 = as measured by the instrument).'),
    sleepWindowUtc: a('22:00-06:00', 'UTC', 'Fixed sleep window used to sum the hourly LRO CRaTER dose rates of a Moon night (eight hourly values; nights with fewer are dropped, none were in the two windows used). A real crew schedule would differ.', ['V61']),
    craterPair: a('D5&6', 'detector pair', 'LRO CRaTER pair behind both tissue-equivalent plastic blocks (about 81 mm, from the instrument paper), used as the stand-in for someone inside a habitat. It is not a habitat measurement; D1&2, behind the thinnest shielding, is kept in the data file for comparison.', ['V61']),
    moonNightMapping: a({ S1: '2017-04-21', S3: '2017-08-21' }, 'first replayed night (UTC date)', 'Mission night k replays the CRaTER night starting k days after this date: S1 the quiet window 2017-04-21 to 2017-06-19, S3 the window that contains the September 2017 events, so that mission night 20 is the night starting 2017-09-10. The choice of windows is ours.', ['V61']),
    marsNightMapping: a('sols 13-108', 'Curiosity RAD sols', 'Mars night k replays the k-th of the 94 sols with data between sol 13 and sol 112 (sols 29-33 and 64 have no file and are skipped, not filled), using the median of detector B over that sol (dose in silicon). Sol length (24 h 40 min) is ignored.', ['V60']),
    speRule: a(16, 'h before the sleep window opens', 'A night is flagged as a solar particle event when a DONKI SEP record starts between 16 h before the sleep window opens and the moment it closes (start inclusive, end exclusive). Only S3 is checked; DONKI records were retrieved for September 2017 only, so nights whose look-up span leaves that month carry events = null (not checked), and S1 and S2 nights are never flagged.', ['V62']),
    hotSectorIndex: a(2, 'sector', 'Azimuth sector facing a thinner-shielded side.'),
    hotSectorExcess: a(0.3, 'fraction', 'Extra particle count in the hot sector versus the other sectors.'),
    dirCountsPerNight: a(100, 'counts', 'Total counts in the 8-sector direction histogram (a fixed sample, not scaled with dose).'),
    verticalIntensity: a(0.2, 'per cm2 per s per sr', 'Vertical GCR intensity; inside the 0.12-0.40 range implied by V33 (1.5-5.0 per cm2 per s over 4 pi). Used for moon and mars alike (the Mars atmosphere is ignored).', ['V33']),
    coneHalfAngleDeg: a(20, 'deg', 'Half-angle of the accepted track cone.'),
    s2TransitDays: a(180, 'days', 'Earth-Mars transit at g = 0 before the first surface night.'),
    s2TransitAdherence: a(0.9, 'fraction', 'Exercise adherence during the transit.'),
    s4LowActivityG: a(0.6, 'g equivalent', 'Five weeks of low activity after hospital discharge represented as partial unloading at g = 0.6. Not a sourced equivalence.'),
    s4LowActivityDays: a(35, 'days', 'Length of the low-activity period after discharge.'),
    s4SleepMeanH: a(7.3, 'h', 'S4 mean sleep. The 7 h recommendation (V25) was written for adults in general and may not apply to an older adult, so a permanently amber sleep card would mislead.', ['V25'])
  };

  var NOISE = {
    eimPhaseSdFraction: { value: 0.02, unit: 'fraction of value', status: 'assumption', note: 'Night-to-night SD of the EIM phase. Operator-applied EIM varies by 4.2% between sessions (V10). A night gives several scans and their median is used, so 2% is assumed. A bed-integrated sensor may be noisier; use the what-if to see the effect.' },
    sleepHoursSd: { value: 0.4, unit: 'h', status: 'assumption', note: 'Night-to-night SD of hours asleep.' },
    sleepEfficiencySd: { value: 0.04, unit: '0..1', status: 'assumption', note: 'Night-to-night SD of sleep efficiency.' },
    rrSd: { value: 0.5, unit: 'breaths/min', status: 'assumption', note: 'Night-to-night SD of the respiratory-rate median.' },
    hrSd: { value: 2, unit: 'beats/min', status: 'assumption', note: 'Night-to-night SD of the heart-rate median.' },
    movementSd: { value: 0.05, unit: '0..1', status: 'assumption', note: 'Night-to-night SD of the movement index.' },
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
      id: 'S1', title: 'Moon base, 60 nights', env: 'moon', baselineNights: 14, transitDays: 0, sleepMeanH: 7.5,
      person: ASSUMPTIONS.personS1.value, seed: ASSUMPTIONS.scenarioSeeds.value.S1,
      summary: 'Sixty nights at a lunar base with full exercise; a week of poor sleep and a misplaced EIM liner. Radiation replays LRO CRaTER, 21 Apr to 19 Jun 2017; the rest is simulated.',
      rad: { dataset: 'lro-crater', window: 'quiet' },
      phases: [{ days: 60, g: G.moon, exerciseAdherence: 1 }],
      planPhases: [{ days: 60, g: G.moon, exerciseAdherence: 1 }],
      events: [
        { from: 30, to: 36, label: 'Poor sleep', sleepMeanH: 5.5 },
        { from: 44, to: 49, label: 'EIM liner misplaced', eimMissing: true }
      ]
    },
    S2: {
      id: 'S2', title: 'Mars surface, first 90 nights', env: 'mars', baselineNights: 14, transitDays: ASSUMPTIONS.s2TransitDays.value, sleepMeanH: 7.4,
      person: ASSUMPTIONS.personS2.value, seed: ASSUMPTIONS.scenarioSeeds.value.S2,
      summary: 'The first 90 nights on Mars after a 180-day transit, with a three-week exercise lapse and a short illness. Radiation replays Curiosity RAD sols 13-108 (2012); the rest is simulated.',
      rad: { dataset: 'msl-rad' },
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
      id: 'S3', title: 'Moon base, solar particle event', env: 'moon', baselineNights: 14, transitDays: 0, sleepMeanH: 7.5,
      person: ASSUMPTIONS.personS3.value, seed: ASSUMPTIONS.scenarioSeeds.value.S3,
      summary: 'Forty-five nights at a lunar base. Radiation replays LRO CRaTER, 21 Aug to 4 Oct 2017, with the solar particle events of September; night 20 is 10 Sep. The rest is simulated.',
      rad: { dataset: 'lro-crater', window: 'event', checkSpe: true },
      phases: [{ days: 45, g: G.moon, exerciseAdherence: 1 }],
      planPhases: [{ days: 45, g: G.moon, exerciseAdherence: 1 }],
      events: [
        { from: 14, to: 17, label: 'Measured: solar particle events of 4-7 Sep 2017 (LRO CRaTER)' },
        { from: 20, to: 24, label: 'Measured: solar particle event of 10 Sep 2017 and its tail (LRO CRaTER)' }
      ]
    },
    S4: {
      id: 'S4', title: 'Earth, older adult after hospital discharge', env: 'earth', baselineNights: 14, transitDays: 0,
      sleepMeanH: ASSUMPTIONS.s4SleepMeanH.value,
      person: ASSUMPTIONS.personS4.value, seed: ASSUMPTIONS.scenarioSeeds.value.S4,
      summary: 'Nine weeks at home after discharge: five weeks of low activity, modelled as partial unloading (g = 0.6, an assumption, not a sourced equivalence), then four weeks of normal activity. All data are simulated.',
      phases: [
        { days: ASSUMPTIONS.s4LowActivityDays.value, g: ASSUMPTIONS.s4LowActivityG.value, exerciseAdherence: 0 },
        { days: 28, g: G.earth, exerciseAdherence: 0 }
      ],
      planPhases: [{ days: ASSUMPTIONS.s4LowActivityDays.value + 28, g: G.earth, exerciseAdherence: 0 }],
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

  function median(xs) {
    var s = xs.slice().sort(function (x, y) { return x - y; }), m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }

  // Measured, unshielded sleep-period dose and provenance for each surface night of a scenario.
  function replay(sc, nights) {
    var H = 3600000, out = [];
    for (var k = 0; k < nights; k++) {
      if (sc.rad.dataset === 'msl-rad') {
        var m = MSL.rows[k];
        if (!m) throw new Error('MyoTwin sim: no Curiosity RAD sol for night ' + k);
        out.push({ dose: m[2] * ASSUMPTIONS.sleepHoursPerNight.value, measured: { dataset: 'msl-rad', sol: m[0], date: m[1] } });
        continue;
      }
      var c = CRATER[sc.rad.window][k];
      if (!c) throw new Error('MyoTwin sim: no LRO CRaTER night for night ' + k);
      var n = { dose: c[1], measured: { dataset: 'lro-crater', date: c[0], pair: 'D5&6' } };
      if (sc.rad.checkSpe) {
        var open = Date.parse(c[0] + 'T22:00:00Z');
        var lo = open - ASSUMPTIONS.speRule.value * H, hi = open + 8 * H;
        var ev = DONKI.rows.filter(function (e) { var t = Date.parse(e[1]); return t >= lo && t < hi; })
          .map(function (e) { return { id: e[0], start: e[1] }; });
        n.spe = ev.length > 0;
        n.events = lo >= Date.parse(DONKI.coverage[0]) && hi <= Date.parse(DONKI.coverage[1]) ? ev : null;
      }
      out.push(n);
    }
    return out;
  }

  function generate(scenarioId, opts) {
    opts = opts || {};
    if (!Object.prototype.hasOwnProperty.call(SCENARIOS, scenarioId)) throw new Error('Unknown scenario: ' + scenarioId);
    var sc = SCENARIOS[scenarioId];
    var rand = mulberry32(opts.seed == null ? sc.seed : opts.seed);
    var normal = function () {
      return Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand());
    };
    var A = ASSUMPTIONS, N = NOISE;
    var shield = opts.shieldingFactor == null ? A.shieldingFactor.value : opts.shieldingFactor;
    var sleepMean = opts.sleepOpportunityH == null ? sc.sleepMeanH : opts.sleepOpportunityH;
    var e = opts.eimNoiseSdFraction;
    var eimSd = typeof e === 'number' && e >= 0 && e <= A.eimNoiseSdMax.value ? e : N.eimPhaseSdFraction.value;

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

    var measured = sc.rad ? replay(sc, dayAdherence.length) : null;
    var usualDose = measured ? median(measured.map(function (n) { return n.dose; })) : null;
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
        dose: normal(), // no longer used (the dose is measured); still drawn so the other streams stay as before
        dir: sectorWeight.map(normal), exercise: rand()
      };

      var phase = model.eimPhase(sc.person.baselinePhaseDeg, change) *
        (env === 'moon' || env === 'mars' ? 1 + A.arrivalFluidOffsetPct.value / 100 : 1) *
        (1 + eimSd * u.phase);
      var eim = ev.eimMissing ? null : {
        site: 'calf_L',
        phase50_deg: round(phase, 3),
        contact: round(A.contactMin.value + (A.contactMax.value - A.contactMin.value) * u.contact, 2),
        scans: A.scansMin.value + Math.floor(u.scans * (A.scansMax.value - A.scansMin.value + 1))
      };

      var radar = {
        sleep_h: round(clamp((ev.sleepMeanH == null ? sleepMean : ev.sleepMeanH) + N.sleepHoursSd.value * u.sleep, 'sleep_h'), 2),
        efficiency: round(clamp(A.sleepEfficiency.value + N.sleepEfficiencySd.value * u.eff, 'efficiency'), 3),
        rr_bpm: round(clamp(sc.person.rrBpm + (ev.rrAddBpm || 0) + N.rrSd.value * u.rr, 'rr_bpm'), 1),
        hr_bpm: round(clamp(sc.person.hrBpm + (ev.hrAddBpm || 0) + N.hrSd.value * u.hr, 'hr_bpm'), 1),
        movement: round(clamp(A.movement.value + N.movementSd.value * u.mov, 'movement'), 3)
      };

      var night = surf && measured ? measured[md] : null;
      var hasRad = !!night;
      var factor = hasRad ? night.dose / usualDose : 1;
      var rad = hasRad ? {
        dose_uGy: round(night.dose * shield, 1),
        dir: sectorWeight.map(function (w, i) {
          var mean = A.dirCountsPerNight.value * w / weightSum;
          return Math.max(0, Math.round(mean + Math.sqrt(mean) * u.dir[i]));
        }),
        spe: !!night.spe,
        measured: night.measured
      } : null;
      if (hasRad && night.events !== undefined) rad.events = night.events;

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
