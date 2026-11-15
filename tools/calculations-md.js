#!/usr/bin/env node
/*
 * Prints docs/CALCULATIONS.md: every calculation behind the numbers the page
 * shows, step by step. Parameters, thresholds and example values are read from
 * the modules in js/, the data files in data/ and the constants in js/app.js
 * when this runs; the explanations around them are written here by hand.
 * No dependencies.
 *
 *   node tools/calculations-md.js > docs/CALCULATIONS.md
 *
 * test/docs.test.js fails when docs/CALCULATIONS.md is out of date.
 *
 * Written with an SI tool (Claude) and reviewed by the team.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const js = (name) => require(path.join(root, 'js', name));
const dataFile = (name) => require(path.join(root, 'data', name));
const source = (name) => fs.readFileSync(path.join(root, 'js', name), 'utf8');

// ---- reading numbers from code text (js/app.js runs in a browser) ----
// Each pattern must match exactly once, or the generator stops and names it.
function one(text, file, re) {
  const all = text.match(new RegExp(re.source, 'g')) || [];
  if (all.length !== 1) throw new Error('calculations-md: pattern ' + re + ' matches ' + all.length + ' times in ' + file + ' (need exactly 1)');
  return text.match(re);
}
const num = (text, file, re) => Number(one(text, file, re)[1]);
function fnFrom(text, file, name) {
  const m = one(text, file, new RegExp('function ' + name + '\\([^)]*\\) \\{[^\\n]*\\}'));
  return new Function(m[0] + '\nreturn ' + name + ';')();
}
function presentation(app) {
  const re = /\/\/ BEGIN presentation helpers\n([\s\S]*?)\n\s*\/\/ END presentation helpers/;
  const m = app.match(re);
  if (!m) throw new Error('calculations-md: the markers "// BEGIN presentation helpers" and "// END presentation helpers" are missing in js/app.js');
  return new Function(m[1] + '\nreturn { stepStates, todayPlan };')();
}

// ---- formatting ----
const fx = (v, d) => Number(v).toFixed(d);
const pct1 = (v) => { const r = Math.round(v * 10) / 10; return (r > 0 ? '+' : r < 0 ? '-' : '') + Math.abs(v).toFixed(1) + '%'; };
const median = (xs) => { const s = xs.slice().sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const list = (xs) => xs.length < 2 ? xs.join('') : xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1];
const cmp = (a, b) => (a > b ? 'above' : a < b ? 'below' : 'equal to');
function code(lines) { return ['```'].concat(lines, ['```']); }
function table(head, rows) {
  const cell = (v) => String(v == null ? '' : v).replace(/\|/g, '\\|');
  return ['| ' + head.join(' | ') + ' |', '|' + head.map(() => '---').join('|') + '|'].concat(rows.map((r) => '| ' + r.map(cell).join(' | ') + ' |'));
}

function render() {
  const evidence = js('evidence.js');
  const model = js('model.js');
  const sim = js('sim.js');
  const rules = js('rules.js');
  const engine = js('engine.js');
  const phantom = js('phantom.js');
  const imaging = js('imaging.js');
  const charts = js('charts.js');
  const msl = dataFile('msl-rad.js');
  const crater = dataFile('lro-crater.js');
  const donki = dataFile('donki-sep-2017.js');
  const omni = dataFile('omni-protons.js');
  const pwb = dataFile('osdr-pwb.js');
  const APP = source('app.js'), ENG = source('engine.js'), SIM = source('sim.js'), CH = source('charts.js');
  const P = presentation(APP);

  const T = rules.THRESHOLDS, tv = (k) => T[k].value;
  const A = sim.ASSUMPTIONS, av = (k) => A[k].value;
  const N = sim.NOISE;
  const MP = model.PARAMS;
  const E = (id, key) => evidence.value(id, key);
  const IA = (name) => imaging.ASSUMPTIONS.filter((a) => a.name === name)[0].value;
  const PA = (name) => phantom.ASSUMPTIONS.filter((a) => a.name === name)[0].value;
  const S = sim.SCENARIOS;
  const word = (st) => charts.STATUS[st].word;

  // Numbers held in code text.
  const WINDOW = tv('windowNights');
  const REF_SEED = num(APP, 'js/app.js', /var REF_SEED = (\d+);/);
  const DIFF_MIN_RANGE = num(APP, 'js/app.js', /var DIFF_MIN_RANGE = (\d+);/);
  const NOISE_MULTIPLE = num(APP, 'js/app.js', /var NOISE_MULTIPLE = (\d+);/);
  const IMP_LOW = num(APP, 'js/app.js', /shown\.min = data\.base\.eim\.median \* ([\d.]+);/);
  const IMP_HIGH = num(APP, 'js/app.js', /shown\.max = data\.base\.eim\.median \* ([\d.]+);/);
  const FLUX_MIN = num(APP, 'js/app.js', /yMin: ([\d.]+), yMax/);
  const FLUX_MAX = num(APP, 'js/app.js', /yMax: ([\d.]+), yLabel/);
  const FLUX_LABEL = one(APP, 'js/app.js', /yLabel: '(Protons[^']*)'/)[1];
  const FLUX_SHADE_H = num(APP, 'js/app.js', /to: open \+ (\d+) \* 3600000/);
  const WEEK_WORDS_DAYS = num(APP, 'js/app.js', /p\.daysToRed <= (\d+) \? 'within about a week'/);
  const SLOPE_ROUND = num(APP, 'js/app.js', /Math\.round\(p\.slopePctPerWeek \* (\d+)\) === 0/);
  const fmtRatio = fnFrom(APP, 'js/app.js', 'fmtRatio');
  const RATIO_WHOLE = num(APP, 'js/app.js', /function fmtRatio\(x\) \{ return \(x >= (\d+)/);
  const DOSE_MGY = num(CH, 'js/charts.js', /uGy >= (\d+) \? \[/);
  const ACTION_CAP = num(ENG, 'js/engine.js', /return actions\.indexOf\(a\) === i; \}\)\.slice\(0, (\d+)\)/);
  const PHASE_DEC = num(SIM, 'js/sim.js', /phase50_deg: round\(phase, (\d+)\)/);
  const SLEEP_DEC = num(SIM, 'js/sim.js', /'sleep_h'\), (\d+)\),/);
  const SIM_WINDOW_H = num(SIM, 'js/sim.js', /hi = open \+ (\d+) \* H;/);
  const CONV = one(crater.processing, 'data/lro-crater.js processing', /x ([\d.e]+) \/ (\d+)/);
  const win = av('sleepWindowUtc').match(/^(\d\d):00-(\d\d):00$/);
  const WIN_H = (Number(win[2]) + 24 - Number(win[1])) % 24;
  const THIGH_RATIO = E('V4', 'thighControlPct') / E('V4', 'calfControlPct');
  const sname = { S1: 'Moon base', S2: 'Mars', S3: 'solar event' };
  const perScenario = (f) => ['S1', 'S2', 'S3'].map((s) => sname[s] + ' ' + f(s)).join(', ');

  const runs = {};
  function run(s) {
    if (!runs[s]) { const g = sim.generate(s); runs[s] = { g, recs: g.records, base: engine.baseline(g.records) }; }
    return runs[s];
  }
  function night(s, d) {
    const r = run(s), i = r.recs.findIndex((x) => x.missionDay === d);
    const a = engine.assess(r.recs, i, { expectedChangePct: r.g.plan.expectedChangePct });
    return { r, i, rec: r.recs[i], a, card: (id) => a.cards.filter((c) => c.id === id)[0], win: (n) => r.recs.slice(i - n + 1, i + 1) };
  }

  const L = [];
  const p = (...xs) => L.push(...xs);
  const blank = () => L.push('');

  p('# How every number is calculated');
  blank();
  p('Generated by `node tools/calculations-md.js > docs/CALCULATIONS.md`; do not edit by hand, `test/docs.test.js` fails when it is out of date.');
  p('Written with an SI tool (Claude) and reviewed by the team.');
  blank();
  p('This page walks through each number the MyoTwin page shows. Parameters, thresholds and example values are read from the code and data files when the page is generated; the explanations around them are written by hand. ' +
    'Ids such as (V10) are entries in [EVIDENCE.md](EVIDENCE.md). "Assumption" means a modelling choice the code declares as one.');

  // ---- 1 ----
  blank();
  p('## 1. What is measured, what is simulated, what is assumed');
  blank();
  p(...table(['Reading', 'Source in this version', 'Where it would come from in the bunk'], [
    ['Calf impedance phase at 50 kHz', 'Simulated from the muscle model', 'Impedance strip under the calves (assumed)'],
    ['Hours asleep, heart and breathing rate', 'Simulated', '60 GHz radar above the bunk (assumed)'],
    ['Radiation dose per night', 'Measured, replayed: Curiosity RAD on Mars (V60), LRO CRaTER in lunar orbit (V61)', 'Particle trackers above and below the sleeper (assumed)'],
    ['Solar particle event on a night', 'NASA DONKI records (V62)', 'Space-weather alerts and a proton monitor'],
    ['Proton flux chart', 'NASA OMNI2 hourly data (V63)', 'Space-weather data'],
    ['Particle arrival directions', 'Simulated', 'Particle trackers'],
    ['Body image', 'Simulated from a body phantom', 'Trackers, pressure mat, impedance strip'],
    ['Exercise done or missed', 'Simulated', 'Resistance-exercise log'],
    ['Morning check-in', 'Entered by the person at the screen', 'The crew member']
  ]));
  blank();
  p('Each night gives one record (fields and units in [CONTRACT.md](CONTRACT.md)); its `_truth` part holds simulated values that only the body image reads. ' +
    'The simulated nights and the mission plan come from the same model, so the page shows the workflow; it cannot show how well a real decline would be detected.');

  // ---- 2 muscle ----
  const s2 = run('S2');
  const lapseDays = S.S2.phases.filter((x) => !x.transit && x.exerciseAdherence === 0).reduce((a, x) => a + x.days, 0);
  blank();
  p('## 2. Muscle');
  blank();
  p('The simulated calf muscle change, in percent, moves each day towards a target:');
  blank();
  p(...code([
    'target = -100 * Lmax * (1 - g)^p * (1 - eff * adh)',
    'm[d+1] = m[d] + (target - m[d]) * (1 - exp(-1 / tau))     while g < 1',
    'm[d+1] = m[d] * exp(-1 / tau_r)                            while g >= 1'
  ]));
  blank();
  p('`m[d]` is the change on day d (0 at the start); `g` is gravity as a fraction of Earth\'s (Moon ' + model.GRAVITY.moon + ', Mars ' + model.GRAVITY.mars + ', transit 0) (V14); `adh` is exercise adherence, 0 to 1.');
  blank();
  const sym = { maxLossFraction: 'Lmax', timeConstantDays: 'tau', exerciseEfficacy: 'eff', recoveryTimeConstantDays: 'tau_r', gravityShape: 'p', eimPhasePctPerMusclePct: 'q' };
  p(...table(['Symbol', 'Parameter', 'Value', 'Unit', 'Status', 'Evidence'], Object.keys(MP).map((k) =>
    [sym[k] || '', k, MP[k].value, MP[k].unit, MP[k].status, (MP[k].anchors || []).join(', ')])));
  blank();
  const fit = (days, adh) => model.simulate([{ days, g: 0, exerciseAdherence: adh }])[days];
  const v5 = fit(E('V5', 'days'), 1), v5lo = E('V5', 'calfVolumePct') - E('V5', 'calfVolumeSd'), v5hi = E('V5', 'calfVolumePct') + E('V5', 'calfVolumeSd');
  p('**The fit.** Lmax, tau and eff were chosen together. At g = 0 the model gives ' + pct1(fit(E('V4', 'days'), 0)) + ' after ' + E('V4', 'days') + ' days of bed rest without exercise (published ' + E('V4', 'calfControlPct') + '%), ' +
    pct1(fit(E('V4', 'days'), 1)) + ' with exercise (published ' + E('V4', 'calfExercisePct') + '%) (V4), and ' + pct1(v5) + ' after ' + E('V5', 'days') + ' days on the ISS with exercise (published ' + E('V5', 'calfVolumePct') + ' +/- ' + E('V5', 'calfVolumeSd') + '%) (V5)' +
    (v5 > v5hi ? ', a smaller loss than published' : v5 < v5lo ? ', a larger loss than published' : '') + '. The fit treats head-down bed rest as g = 0 and the ISS crews as fully adherent. A night\'s exercise is logged as done when a uniform random draw is below the adherence.');
  blank();
  p('**What-if values.** Besides exercise adherence, the page address can set the gravity shape p, the shielding share sh (section 7) and the impedance noise sdP. Changing p changes the mission plan as well as the readings; changing adherence changes only the readings.');
  blank();
  p('**The impedance reading.**');
  blank();
  p(...code(['phase = max(0, P0 * (1 + q * m / 100)) * (1 + f / 100) * (1 + sdP * z)']));
  blank();
  p('`P0` is the person\'s phase before departure (assumption: ' + perScenario((s) => S[s].person.baselinePhaseDeg) + ' degrees; compare ' + E('V8', 'uncastedPhaseDeg') + ' degrees in V8); ' +
    '`q` = ' + MP.eimPhasePctPerMusclePct.value + '; `f` = ' + av('arrivalFluidOffsetPct') + '% on Moon and Mars nights and 0 on Earth, an offset for the changed fluid distribution whose size is assumed ' +
    '(bioimpedance is fluid-sensitive: in V28 leg bioimpedance reached no steady state within ' + E('V28', 'noSteadyStateWithinMin') + ' minutes of lying down); `sdP` = ' + N.eimPhaseSdFraction.value + ', the night-to-night spread (assumption; operator-applied impedance varies by ' +
    E('V10', 'meanVariabilityPct') + '% between sessions, V10); `z` is a standard normal draw. Stored to ' + PHASE_DEC + ' decimals. The checks compare the phase with the person\'s own baseline phase in percent; they never turn it back into muscle.');
  blank();
  p('**Baseline, window and plan.** The baseline is the median `B` and sample standard deviation `SD` of the phase over the ' + av('baselineNights') + ' nights before departure that have a usable scan (at least ' + tv('baselineMinNights') + '). ' +
    '`M7` is the median phase of the nights with a usable scan among the last ' + WINDOW + ' nights (at least ' + tv('muscleMinUsableNights') + '); windows never mix baseline and surface nights. ' +
    'The plan is the same model run with the scenario as intended (on Mars, without the ' + lapseDays + '-day exercise lapse); `expectedDrop` is the median of minus the plan\'s change over the same usable-scan nights.');
  blank();
  p(...code([
    'drop    = (B - M7) / B * 100',
    'noise7  = ' + tv('medianSeFactor') + ' * SD / sqrt(' + WINDOW + ') / B * 100',
    'watch   = max(' + tv('muscleAmberNoiseMultiple') + ' * noise7, ' + tv('muscleAmberDropPct') + ')',
    'report  = max(' + tv('muscleRedNoiseMultiple') + ' * noise7, ' + tv('muscleRedDropPct') + ')'
  ]));
  blank();
  p('`noise7` is the expected spread of a ' + WINDOW + '-night median in percent (' + tv('medianSeFactor') + ' = sqrt(pi/2), an assumption). ' + tv('muscleAmberDropPct') + '% and ' + tv('muscleRedDropPct') +
    '% are the average and largest test-retest variability of the measurement (V10); the multiples are assumptions. **Report** when `drop > report`; otherwise **Watch** when `drop - expectedDrop > watch`; otherwise **In range**.');
  blank();
  p('**Projection.** When the check is not on Report, a least-squares line is fitted to up to ' + tv('projectionWeeks') + ' complete weekly medians (at least ' + tv('projectionMinWeeks') + ', consecutive surface weeks back from tonight, in percent from baseline). ' +
    'With a negative slope the page shows it and `days = round((-report - now) / slope * ' + WINDOW + ')`, `now` being the line\'s value tonight; it says "within about a week" up to ' + WEEK_WORDS_DAYS + ' days. ' +
    'It is left out when days is 0 or less, above ' + tv('projectionMaxDays') + ', or the slope rounds to zero at ' + Math.log10(SLOPE_ROUND) + ' decimal.');
  blank();
  const m42 = night('S2', 42), mc = m42.card('muscle'), b = s2.base.eim, ex = mc.extra;
  const usable42 = m42.win(WINDOW).filter((r) => r.eim && r.eim.scans >= 1);
  const noise7 = tv('medianSeFactor') * b.sd / Math.sqrt(WINDOW) / b.median * 100;
  const gap = ex.dropPct - ex.expectedDropPct;
  const proj = engine.project(s2.recs, m42.i);
  p('**Worked example: Mars, night 42.** B = ' + fx(b.median, 3) + ' degrees, SD ' + fx(b.sd, 3) + ' (' + b.n + ' nights); noise7 = ' + fx(noise7, 2) + '%, so watch = ' + fx(ex.amberLimitPct, 1) + '% and report = ' + fx(ex.redLimitPct, 1) + '%. ' +
    'Usable nights ' + usable42[0].missionDay + ' to 42: ' + usable42.map((r) => r.eim.phase50_deg).join(', ') + '; M7 = ' + fx(mc.value, 3) + '. drop = ' + fx(ex.dropPct, 1) + '% (the page shows ' + pct1(mc.deltaPct) + '); expectedDrop = ' + fx(ex.expectedDropPct, 1) + '%. ' +
    'drop is ' + cmp(ex.dropPct, ex.redLimitPct) + ' report; drop - expectedDrop = ' + fx(gap, 1) + ' points, ' + cmp(gap, ex.amberLimitPct) + ' watch. Status: **' + word(mc.status) + '**.' +
    (proj ? ' Projection: ' + pct1(proj.slopePctPerWeek) + ' per week, ' + proj.daysToRed + ' days, "' + (proj.daysToRed <= WEEK_WORDS_DAYS ? 'within about a week' : 'in about ' + proj.daysToRed + ' days') + '".' : '') +
    ' (Simulated true value, unread by the check: ' + pct1(m42.rec._truth.muscleChangePct) + '.)');

  // ---- 3 gravity check ----
  const chk = model.checkGravityTerm(pwb, MP.gravityShape.value);
  const desc = model.describeGravityCheck(chk);
  const NAMES = { grip: 'grip force', plantarflexionTorque: 'plantarflexion torque', calfGirth: 'calf girth' };
  blank();
  p('## 3. Checking the gravity term against NASA rat data');
  blank();
  p('The gravity term is set beside rats kept for ' + chk.measures[0].day + ' days at ' + Math.round(chk.partialG * 100) + '% weight bearing, fully unloaded or at full weight bearing (NASA OSDR, V90, V91; `data/osdr-pwb.js`):');
  blank();
  p(...code([
    'change(x) = 100 * (mean on day ' + chk.measures[0].day + ' / mean on day 0 - 1)',
    'share     = (change(' + chk.partialG + ' g) - change(1 g)) / (change(0 g) - change(1 g))'
  ]));
  blank();
  p('`mean` is the group mean; the 1 g change removes growth effects. Shares: ' +
    chk.measures.map((m) => NAMES[m.measure] + ' ' + (m.sex === 'F' ? 'females' : 'males') + ' ' + fx(m.share, 2) + (m.unstable ? ' (unstable)' : '')).join(', ') + '.');
  blank();
  p('Minimum ' + fx(chk.min, 2) + ', median ' + fx(chk.median, 2) + ', maximum ' + fx(chk.max, 2) + '. The model\'s share at ' + chk.partialG + ' g is (1 - ' + chk.partialG + ')^' + chk.shape + ' = ' + fx(chk.model, 2) + '. ' + desc.sentences[2] + ' ' +
    'The rats are an analog, and strength and girth are not muscle volume. ' + desc.closing);

  // ---- 4 sleep ----
  const sl = night('S1', 36), sc = sl.card('sleep');
  const poor = S.S1.events.filter((e) => e.sleepMeanH)[0];
  const CL = N.clamps.value;
  const svals = sl.win(WINDOW).filter((r) => r.radar).map((r) => r.radar.sleep_h);
  blank();
  p('## 4. Sleep');
  blank();
  p(...code(['sleep_h = clamp(mu + ' + N.sleepHoursSd.value + ' * z, ' + CL.sleep_h[0] + ', ' + CL.sleep_h[1] + ')']));
  blank();
  p('`mu` is the scenario mean (assumption: ' + S.S1.sleepMeanH + ' h on the Moon, ' + S.S2.sleepMeanH + ' h on Mars, ' + poor.sleepMeanH + ' h on nights ' + poor.from + ' to ' + poor.to + ' of the Moon base scenario); `z` a standard normal draw. Stored to ' + SLEEP_DEC + ' decimals.');
  blank();
  p('The check takes the mean of the nights with radar data among the last ' + WINDOW + ' (at least ' + tv('sleepMinNights') + '). **Watch** below ' + tv('sleepAmberHours') + ' h, the low end of the ' + E('V79', 'adultSleepHoursLow') + ' to ' + E('V79', 'adultSleepHoursHigh') +
    ' hours an average adult needs (V79). **Report** below ' + tv('sleepRedHours') + ' h, the ISS average of ' + E('V11', 'issSleepHours') + ' h rounded down (V11); an assumption that has not been validated as a cut-off.');
  blank();
  p('**Worked example: Moon base, night ' + sl.rec.missionDay + '.** ' + svals.join(', ') + ' h; mean ' + fx(sc.value, 2) + ' h, ' + cmp(sc.value, tv('sleepRedHours')) + ' ' + tv('sleepRedHours') + ' h and ' + cmp(sc.value, tv('sleepAmberHours')) + ' ' + tv('sleepAmberHours') +
    ' h. Status: **' + word(sc.status) + '**; the card shows ' + fx(sc.value, 1) + ' h.');

  // ---- 5 heart ----
  const cd = night('S2', 62), cc = cd.card('cardio'), ill = S.S2.events.filter((e) => e.hrAddBpm)[0], xc = cc.extra;
  const cn = tv('cardioNights');
  blank();
  p('## 5. Heart and breathing');
  blank();
  p(...code([
    'hr_bpm = clamp(HR0 + dHR + ' + N.hrSd.value + ' * z, ' + CL.hr_bpm.join(', ') + ')',
    'rr_bpm = clamp(RR0 + dRR + ' + N.rrSd.value + ' * z, ' + CL.rr_bpm.join(', ') + ')',
    'limit  = baseline median + ' + tv('cardioSdMultiple') + ' * baseline SD'
  ]));
  blank();
  p('`HR0`, `RR0` are the person\'s levels (assumption: ' + perScenario((s) => S[s].person.hrBpm + ' and ' + S[s].person.rrBpm) + '); `dHR`, `dRR` are ' + ill.hrAddBpm + ' beats and ' + ill.rrAddBpm +
    ' breaths per minute on the illness nights ' + ill.from + ' to ' + ill.to + ' on Mars, otherwise 0. The baseline is the median and sample SD of the ' + av('baselineNights') + ' nights before departure. ' +
    'The check takes the median of the nights with radar data among the last ' + cn + ' (at least ' + tv('cardioMinNights') + '). **Watch** when either median is above its limit; when both rates are above their limits on each of the last ' + cn +
    ' nights, it stays on Watch with a text that names illness. The code has no Report level here: the contract treats a raised rate as a reason to check for illness.');
  blank();
  const hv = cd.win(cn).map((r) => r.radar.hr_bpm), rv = cd.win(cn).map((r) => r.radar.rr_bpm);
  p('**Worked example: Mars, night ' + cd.rec.missionDay + '.** Heart ' + hv.join(', ') + ', median ' + fx(xc.hr, 1) + ', ' + cmp(xc.hr, xc.hrLimit) + ' the limit ' + fx(xc.hrLimit, 1) + '; breathing ' + rv.join(', ') + ', median ' + fx(xc.rr, 1) + ', ' +
    cmp(xc.rr, xc.rrLimit) + ' the limit ' + fx(xc.rrLimit, 1) + '. Status: **' + word(cc.status) + '**' + (cc.status === 'amber' ? (xc.sustained ? ', sustained' : ', not sustained') : '') + '; the card shows ' + fx(cc.value, 0) + ' bpm.');

  // ---- 6 radiation ----
  const rn = night('S3', 20), rc = rn.card('radiation'), rr = rn.rec.rad, xr = rc.extra;
  const marsNights = S.S2.phases.filter((x) => !x.transit).reduce((a, x) => a + x.days, 0);
  const mslRow = msl.rows[42];
  const qD56 = median(crater.quiet.map((r) => r[1])), qD12 = median(crater.quiet.map((r) => r[2]));
  const sep = crater.event.find((r) => r[0] === rr.measured.date);
  const ev = donki.rows.filter((e) => rr.events && rr.events.some((x) => x.id === e[0]));
  const earlierN = run('S3').recs.slice(0, rn.i).filter((r) => r.missionDay >= 0 && r.rad).slice(-tv('radiationHistoryNights')).length;
  const isRed = xr.ratio > tv('radiationRedRatio'), isAmber = xr.ratio > tv('radiationAmberRatio');
  blank();
  p('## 6. Radiation');
  blank();
  p(...code([
    'Mars: dose = sol median dose rate (uGy/h) * ' + av('sleepHoursPerNight') + ' h',
    'Moon: dose = sum over the ' + WIN_H + ' hours from ' + win[1] + ':00 UTC of (rate in cGy/day * ' + CONV[1] + ' / ' + CONV[2] + ')'
  ]));
  blank();
  p('**Mars** (`data/msl-rad.js`, Curiosity RAD detector B, dose in silicon, V60): mission night k, counting from 0 at arrival, uses row k of the file, counting from 0; the file holds the median dose rate of each of ' + msl.rows.length + ' sols between ' + msl.rows[0][0] + ' and ' +
    msl.rows[msl.rows.length - 1][0] + ' (sols ' + msl.missingSols.join(', ') + ' have no data and are skipped). The ' + marsNights + ' Mars nights use sols ' + msl.rows[0][0] + ' to ' + msl.rows[marsNights - 1][0] + '; ' + av('sleepHoursPerNight') +
    ' h is the assumed sleep period. Night 42: row 42, sol ' + mslRow[0] + ' (' + mslRow[1] + '), ' + mslRow[2] + ' µGy/h x ' + av('sleepHoursPerNight') + ' = ' + fx(mslRow[2] * av('sleepHoursPerNight'), 1) + ' µGy.');
  blank();
  p('**Moon** (`data/lro-crater.js`, LRO CRaTER pair ' + av('craterPair') + ', scaled by the instrument team from lunar orbit to the surface and corrected to water, V61): the hourly rates summed over the fixed window ' + av('sleepWindowUtc') +
    ' UTC. The Moon base scenario replays ' + crater.quiet[0][0] + ' to ' + crater.quiet[crater.quiet.length - 1][0] + '; the solar-event scenario starts at ' + crater.event[0][0] +
    ', so night 20 is ' + rr.measured.date + '; the windows are this project\'s choice.');
  blank();
  p('**Rules.** The usual night is the median dose of up to ' + tv('radiationHistoryNights') + ' earlier surface nights (No data with fewer than ' + tv('radiationMinHistory') + '). **Watch** above ' + tv('radiationAmberRatio') + ' times the usual night; **Report** above ' +
    tv('radiationRedRatio') + ' times, or whenever a solar particle event is on record. The multiples are assumptions. The running total sums every surface night\'s dose up to tonight.');
  blank();
  p('**Solar particle events** (solar-event scenario only, V62): a night is marked when a DONKI record from a GOES instrument starts between ' + av('speRule') + ' h before the sleep window opens and the end of the window (' + SIM_WINDOW_H +
    ' h after it opens). DONKI records cover ' + donki.coverage[0].slice(0, 10) + ' to ' + donki.coverage[1].slice(0, 10) + ' only; nights whose look-up span leaves that range are not checked.');
  blank();
  p('**Proton flux chart** (solar-event scenario only, V63): OMNI2 hourly flux above 10 MeV near Earth, ' + omni.rows[0][0].slice(0, 10) + ' to ' + omni.rows[omni.rows.length - 1][0].slice(0, 10) + ', as given, on a log axis labelled "' + FLUX_LABEL + '" from ' + FLUX_MIN + ' to ' + FLUX_MAX +
    ', with the selected night\'s ' + FLUX_SHADE_H + '-hour sleep window shaded. **Directions** are simulated: ' + av('dirCountsPerNight') + ' counts a night, ' + Math.round(av('hotSectorExcess') * 100) +
    '% more in one assumed sector; the page sums them over the mission.');
  blank();
  p('**Shielding.** The dose is not reduced for habitat shielding. For cosmic rays on quiet nights the code gives two reasons: over the ' + crater.quiet.length + ' quiet nights the medians of the two CRaTER pairs at opposite ends of the telescope differ by ' +
    fx(Math.abs(qD56 / qD12 - 1) * 100, 1) + '% (V61), and NASA\'s guidance recommends about ' + E('V37', 'shieldingGPerCm2') + ' g/cm2 of hydrogen-rich shielding, beyond which more does not help against cosmic rays (V37). ' +
    'Solar protons behave differently: on ' + rr.measured.date + ' the Moon-facing pair read ' + fx(sep[1] / sep[2], 2) + ' times the thinly shielded pair (V61). That pair is a lightly shielded detector on an orbiter (V93), not a model of a habitat. ' +
    'Thick habitat shielding stops most solar protons, so a crew inside would receive much less. Under ' + E('V92', 'atmosphereGPerCm2') + ' g/cm2 of Martian air, Curiosity\'s RAD saw the dose rate rise only ' + E('V92', 'doseRateRiseFactorLow') + '- to ' +
    E('V92', 'doseRateRiseFactorHigh') + '-fold in the same event (V92).');
  blank();
  p('**Worked example: solar event, night 20 (' + rr.measured.date + ').** ' + rr.dose_uGy + ' µGy; usual night ' + fx(xr.usualUGy, 1) + ' µGy (median of ' + earlierN + ' earlier nights); ratio ' + fx(xr.ratio, 1) + ', ' + cmp(xr.ratio, tv('radiationRedRatio')) + ' ' + tv('radiationRedRatio') +
    '. ' + (rr.spe ? 'DONKI records ' + ev.map((e) => e[0]).join(' and ') + ' (GOES) fall inside the look-up span. ' : '') +
    'Status: **' + word(rc.status) + '**' + (rr.spe && isRed ? ' on both counts' : rr.spe ? ' because of the event' : isAmber && !isRed ? '' : '') + '. Running total ' + fx(xr.cumulativeUGy, 1) + ' µGy. ' +
    'The page shows doses from ' + DOSE_MGY + ' µGy in mGy to one decimal and ratios from ' + RATIO_WHOLE + ' as whole numbers: ' + charts.doseParts(rr.dose_uGy).join(' ') + ', ' + fmtRatio(Math.round(xr.ratio * 10) / 10) + ' the usual level, total ' + charts.doseParts(xr.cumulativeUGy).join(' ') + '. ' +
    'EVIDENCE.md gives ' + E('V61', 'sep10MultipleD56') + ' times for the same night because V61 compares with the median of the ' + E('V61', 'quietNights') + '-night quiet window (' + E('V61', 'quietMedianD56UGyPerNight') + ' µGy), while the check uses the earlier nights of this scenario.');

  // ---- 7 image ----
  const ph0 = phantom.build();
  const cone = 2 * Math.PI * (1 - Math.cos(av('coneHalfAngleDeg') * Math.PI / 180));
  const tracks1 = av('verticalIntensity') * cone * av('sleepHoursPerNight') * 3600 * av('shieldingFactor');
  const cell2 = ph0.cellCm * ph0.cellCm;
  const rel1 = IA('momentumSpreadFactor') * Math.sqrt(1 / (Math.round(tracks1) * cell2));
  const raw0 = charts.stippleDot(0, 0, 1, 'raw', 0, 1), raw1 = charts.stippleDot(1, 0, 1, 'raw', 0, 1);
  blank();
  p('## 7. The body image');
  blank();
  p('All three layers are simulated from a body phantom: a supine adult on ' + ph0.w + ' x ' + ph0.h + ' cells of ' + ph0.cellCm + ' cm (sizes assumed), giving each cell a path length through soft tissue and bone and a region. Muscle change thins calf and thigh tissue:');
  blank();
  p(...code(['soft = soft0 * (1 + fm * m / 100)']));
  blank();
  p('`fm` is the muscle share (assumption: calf ' + PA('calfMuscleFraction') + ', thigh ' + PA('thighMuscleFraction') + '); `m` is the simulated change from `_truth`; the thigh uses m x ' + fx(THIGH_RATIO, 2) + ', the thigh-to-calf loss ratio without exercise in V4. ' +
    'An image built over several nights uses the mean of m over those nights.');
  blank();
  p('**Density** (experimental):');
  blank();
  p(...code([
    'N     = I * 2 * pi * (1 - cos(theta)) * H * 3600 * sh',
    'x/X0  = soft / X0_muscle + bone / X0_bone',
    'value = x/X0 * (1 + M / sqrt(N * Acell) * z)'
  ]));
  blank();
  p('`N` is tracks per cm2; `I` = ' + av('verticalIntensity') + ' per cm2 per s per sr (assumption inside the range implied by V33); `theta` = ' + av('coneHalfAngleDeg') + ' degrees; `H` = ' + av('sleepHoursPerNight') + ' h; `sh` = ' + av('shieldingFactor') +
    ', the share of tracks crossing the shielding (what-if value). One night gives N = ' + Math.round(tracks1) + '. `x/X0` is areal density in radiation lengths, the legend\'s quantity (X0 = ' + E('V31', 'muscleCm') + ' cm muscle, ' + E('V31', 'compactBoneCm') + ' cm compact bone, V31). ' +
    '`M` = ' + IA('momentumSpreadFactor') + ' stands for the unknown particle momentum (assumption); `Acell` = ' + cell2 + ' cm2; one night\'s relative noise is ' + fx(rel1 * 100, 1) + '%. Cells outside the body get the noise of ' + IA('outsideNoiseRefCm') + ' cm of muscle around 0. ' +
    'On a quiet night N is scaled by the night\'s dose over the scenario median. A night is left out when a solar particle event is on record or its dose exceeds ' + av('trackQuietMaxRatio') + ' times the scenario median, because solar protons stop in the body or cross it far slower (V61, V62). ' +
    'The change view sums N over the usable nights among the last ' + WINDOW + ' surface nights.');
  blank();
  p('**Pressure:** `kPa = (soft * rho_soft + bone * rho_bone) * 10 * g0 * ratio / 1000`, with `rho_soft` = ' + E('V31', 'muscleDensityGPerCm3') + ' and `rho_bone` = ' + E('V31', 'compactBoneDensityGPerCm3') + ' g/cm3 (V31), 10 for g/cm2 to kg/m2, `g0` = ' + IA('standardGravity') +
    ' m/s2 and `ratio` the world\'s gravity ratio (V14); each column of tissue rests on the cell below it (assumption).');
  blank();
  p('**Impedance:** calf cells carry the night\'s phase (the median of the window\'s nights in the change view); no other region is measured, so the outline of the other regions gets hollow dots and their interior stays empty.');
  blank();
  p('**Dots.** Dot area follows the value: the radius runs from ' + fx(raw0.r, 2) + ' to ' + fx(raw1.r, 2) + ' of a cell by the square root of the scaled value. Raw scales run from 0 to the image maximum (density, pressure) and from ' + IMP_LOW + ' to ' + IMP_HIGH + ' times the baseline phase (impedance).');
  blank();
  p(...code([
    'change(cell)   = (now / reference - 1) * 100',
    'change(region) = mean of change(cell) over the region',
    'range          = max(' + DIFF_MIN_RANGE + ', ceil(largest |change(region)|))',
    'noise(region)  = M * sqrt(1 / (N * Acell * n)) * sqrt(2) * 100'
  ]));
  blank();
  p('`now` is the image of the last ' + WINDOW + ' surface nights, `reference` that of the first ' + WINDOW + ' (density: usable nights only, seed ' + REF_SEED + '); in the noise formula `N` is the summed tracks of the window and `n` the cells in the region; sqrt(2) is for the difference of two images. ' +
    'Blue dots are a loss, white a gain; in the density view a region below ' + NOISE_MULTIPLE + ' x noise gets small grey dots. Hollow outline dots mark what has nothing to show: outside the calves for impedance, the whole body for density when every night of the week is left out.');

  // ---- 8 check-in ----
  const CI = rules.CHECKIN;
  const inp = { mood: 2, tempC: 38.2, symptoms: { legs: true, ill: true } };
  const ck = engine.checkin(inp, cd.a.cards);
  const t10 = Math.round(inp.tempC * 10), b10 = Math.round(tv('checkinBaselineTempC') * 10);
  blank();
  p('## 8. The morning check-in');
  blank();
  p('The person enters mood (1 to 5), temperature (' + CI.tempMinC + ' to ' + CI.tempMaxC + ' °C) and any of ' + list(CI.symptoms.map((x) => x.label.toLowerCase())) + '.');
  blank();
  p(...code([
    'rise  = (round(T * 10) - round(B * 10)) / 10',
    'fever = round(rise * 10) > round(' + tv('checkinTempRiseC') + ' * 10)',
    'low   = round(-rise * 10) > round(' + tv('checkinTempDropC') + ' * 10)'
  ]));
  blank();
  p('`T` is the temperature entered; `B` = ' + tv('checkinBaselineTempC') + ' °C, the person\'s baseline (assumption). The rise limit is the rise that counts as fever in older adults in long-term care (V97), adapted here for a crew; the drop limit mirrors it (assumption). ' +
    'Mood ' + tv('checkinLowMoodAtMost') + ' or lower is low (assumption). Flags, in order: fever, low temperature, feeling ill (only without fever), low mood, legs, not rested. Any flag puts the check-in on **Watch**; it has no Report level. ' +
    'The meaning is the first flag\'s sentence, then "Also noted:" and the rest; actions follow the flags without repeats, at most ' + ACTION_CAP + '. ' +
    'Each body check is set beside its answer (legs, not rested, ill or fever): both clear, both show a change, only the person, only the bunk, or no bunk reading. Radiation cannot be felt.');
  blank();
  const vword = { 'agree-clear': 'agree', 'agree-flag': 'both show a change', 'self-only': 'only you', 'bunk-only': 'only the bunk', 'no-bunk': 'no bunk reading', 'cannot-feel': 'cannot be felt' };
  const illDropped = inp.symptoms.ill && ck.flags.indexOf('ill') < 0 && ck.flags.indexOf('fever') >= 0;
  p('**Worked example: Mars, night 62, mood ' + inp.mood + ', ' + inp.tempC + ' °C, legs and ill.** rise = (' + t10 + ' - ' + b10 + ') / 10 = ' + fx(ck.temp.riseC, 1) + ' °C, ' + (ck.temp.raised ? 'above the limit: fever' : ck.temp.low ? 'below the drop limit: low' : 'within the limits') + '. ' +
    'Flags: ' + ck.flags.join(', ') + (illDropped ? ' (feeling ill is not a separate flag when there is a fever)' : '') + '. Status **' + CI.statusWords[ck.status] + '**, ' + ck.flags.length + ' flags, ' + ck.actions.length + ' actions. ' +
    'Comparison: ' + ck.rows.map((x) => x.card + ' ' + vword[x.verdict]).join('; ') + '.');

  // ---- 9 words ----
  const st62 = P.stepStates(cd.a.cards, ck), plan62 = P.todayPlan(cd.a.cards, ck), st42 = P.stepStates(m42.a.cards, null);
  blank();
  p('## 9. From statuses to words');
  blank();
  p('The headline names checks on Report first ("Report to the ' + rules.WORDING.clinician + ' today: ..."), then on Watch ("N check(s) to watch: ..."); otherwise checks with No data, or all four in range. ' +
    'The three step cards count the checks on Watch or Report, the check-in flags and the actions in the Today list. The Today list has one entry for each check on Report, then on Watch, then the check-in when it is on Watch.');
  blank();
  p('Mars night 42: "' + m42.a.headline + '" Step cards "' + st42.map((x) => x.text).join('", "') + '". With the check-in of section 8 on night 62: "' + cd.a.headline + '" Step cards "' + st62.map((x) => x.text).join('", "') + '"; Today: ' +
    plan62.map((x) => x.name + ' (' + x.actions.length + ' actions)').join(', ') + '.');

  // ---- 10 ----
  const seeds = av('scenarioSeeds');
  blank();
  p('## 10. Reproducibility');
  blank();
  p('The simulator is seeded (' + perScenario((s) => seeds[s]) + ') and draws every random number every night, and the page keeps scenario, night, what-if values and check-in in its address, so the same address gives the same numbers. ' +
    'Tests recompute the evidence numbers, the gravity-check shares, the per-night doses and the fitted results from the data files: `node --test "test/*.test.js"`.');

  // ---- 11 ----
  blank();
  p('## 11. What these calculations do not cover');
  blank();
  p('See "What this version does not account for, and the next step" in the [README](../README.md#what-this-version-does-not-account-for-and-the-next-step).');
  blank();
  return L.join('\n');
}

if (require.main === module) process.stdout.write(render());

module.exports = { render };
