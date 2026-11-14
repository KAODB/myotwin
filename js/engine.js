/*
 * MyoTwin assessment engine: pure functions that turn NightRecords into the
 * morning brief (four status cards against the person's own baseline), a
 * muscle trend projection and chart series. Applies js/rules.js exactly as the
 * Status rules table in docs/CONTRACT.md. No DOM; never reads record._truth.
 *
 * Written with an SI tool (Claude) and reviewed by the team.
 */
(function (root) {
  'use strict';
  var ns = (root.MyoTwin = root.MyoTwin || {});
  var inNode = typeof module === 'object' && module.exports;
  var rules = inNode ? require('./rules.js') : ns.rules;
  var T = rules.THRESHOLDS;
  var t = function (k) { return T[k].value; };

  var ORDER = ['green', 'amber', 'red'];

  // ---- helpers ---------------------------------------------------------------
  function median(xs) {
    var s = xs.slice().sort(function (a, b) { return a - b; });
    var m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }
  function mean(xs) { return xs.reduce(function (a, b) { return a + b; }, 0) / xs.length; }
  function sampleSd(xs) {
    var m = mean(xs);
    return Math.sqrt(xs.reduce(function (a, x) { return a + (x - m) * (x - m); }, 0) / (xs.length - 1));
  }
  function stats(xs) {
    if (xs.length < t('baselineMinNights')) return { median: null, sd: null, n: xs.length };
    return { median: median(xs), sd: sampleSd(xs), n: xs.length };
  }
  function eimOf(r) { return r.eim && r.eim.scans >= 1 ? r.eim.phase50_deg : null; }
  function radarOf(key) { return function (r) { return r.radar ? r.radar[key] : null; }; }
  var GETTERS = {
    eim: eimOf,
    sleep: radarOf('sleep_h'),
    rr: radarOf('rr_bpm'),
    hr: radarOf('hr_bpm'),
    dose: function (r) { return r.rad ? r.rad.dose_uGy : null; }
  };
  function values(recs, key) {
    return recs.map(GETTERS[key]).filter(function (v) { return v !== null && v !== undefined; });
  }
  function surface(r) { return r.missionDay >= 0; }
  // Indices of the `n`-night window that ends `back` windows before index. Windows never
  // mix phases: only nights in the same phase (baseline or surface) as records[index].
  function windowIdx(records, index, n, back) {
    var out = [];
    for (var i = Math.max(0, index - (back + 1) * n + 1); i <= index - back * n; i++) {
      if (surface(records[i]) === surface(records[index])) out.push(i);
    }
    return out;
  }
  function windowAt(records, index, n, back) {
    return windowIdx(records, index, n, back).map(function (i) { return records[i]; });
  }
  // Grey reason for too few nights; says "since arrival" when the window was cut by arrival.
  function tooFew(k, total, n, need, what, index, records) {
    var cut = total < n && surface(records[index]);
    if (cut) return 'Only ' + k + ' nights' + (k === total ? '' : ' with ' + what) + ' since arrival (need ' + need + ').';
    return 'Only ' + k + ' nights with ' + what + ' in the last ' + n + ' (need ' + need + ').';
  }
  function f(x, d) { return x.toFixed(d); }
  var NAMES = { muscle: 'muscle', sleep: 'sleep', cardio: 'heart and breathing', radiation: 'radiation' };
  function fill(s, words) { return s.replace(/\{(\w+)\}/g, function (_, k) { return words[k]; }); }

  function makeCard(id, status, words, o) {
    var txt = rules.TEXT[id][o.textKey || status];
    return {
      id: id, status: status,
      value: status === 'grey' ? null : o.value,
      unit: o.unit,
      deltaPct: status === 'grey' || o.deltaPct === undefined ? null : o.deltaPct,
      reason: o.reason,
      meaning: fill(txt.meaning, words),
      actions: txt.actions.map(function (a) { return fill(a, words); }),
      decides: words.clinician,
      sourceIds: T[o.threshold].sourceIds.slice(),
      expectedDeltaPct: o.expectedDeltaPct === undefined ? null : o.expectedDeltaPct,
      extra: o.extra
    };
  }

  // ---- baseline --------------------------------------------------------------
  function baseline(records) {
    var pre = records.filter(function (r) { return r.missionDay < 0; });
    return { eim: stats(values(pre, 'eim')), sleep: stats(values(pre, 'sleep')), rr: stats(values(pre, 'rr')), hr: stats(values(pre, 'hr')) };
  }

  // ---- muscle ----------------------------------------------------------------
  // Median of a complete weekly window (n nights of the same phase), or null.
  function weeklyMedian(records, index, back) {
    var w = windowAt(records, index, t('windowNights'), back);
    var v = values(w, 'eim');
    return w.length === t('windowNights') && v.length >= t('muscleMinUsableNights') ? median(v) : null;
  }
  function noise7(b) {
    return t('medianSeFactor') * b.eim.sd / Math.sqrt(t('windowNights')) / b.eim.median * 100;
  }
  function redDropPct(b) {
    return Math.max(t('muscleRedNoiseMultiple') * noise7(b), t('muscleRedDropPct'));
  }

  // `plan` is the optional expectedChangePct array; only indices in the window are read.
  function muscleCard(records, index, b, words, plan) {
    var n = t('windowNights'), need = t('muscleMinUsableNights');
    var win = windowIdx(records, index, n, 0);
    var idx = win.filter(function (i) { return eimOf(records[i]) !== null; });
    var unit = 'deg';
    var hasBase = b.eim.median !== null;
    var extra = { dropPct: null, expectedDropPct: null, amberLimitPct: null, redLimitPct: null };
    if (hasBase) {
      extra.amberLimitPct = Math.max(t('muscleAmberNoiseMultiple') * noise7(b), t('muscleAmberDropPct'));
      extra.redLimitPct = redDropPct(b);
    }
    if (!hasBase) {
      return makeCard('muscle', 'grey', words, { unit: unit, threshold: 'baselineMinNights', extra: extra, reason: 'No baseline yet: fewer than ' + t('baselineMinNights') + ' baseline nights with a usable scan.' });
    }
    if (idx.length < need) {
      return makeCard('muscle', 'grey', words, { unit: unit, threshold: 'muscleMinUsableNights', extra: extra, reason: tooFew(idx.length, win.length, n, need, 'a usable scan', index, records) });
    }

    var value = median(idx.map(function (j) { return eimOf(records[j]); }));
    var deltaPct = (value - b.eim.median) / b.eim.median * 100;
    var drop = -deltaPct;
    // A missing plan value counts as "no change expected" (the stricter reading).
    var expectedDrop = plan ? median(idx.map(function (j) { return -plan[j] || 0; })) : 0;
    var amberLimit = extra.amberLimitPct;
    extra.dropPct = drop;
    extra.expectedDropPct = plan ? expectedDrop : null;

    var reason = t('windowNights') + '-night median ' + f(value, 2) + ' deg, ' + f(Math.abs(deltaPct), 1) + '% ' +
      (deltaPct < 0 ? 'below' : 'above') + ' your baseline of ' + f(b.eim.median, 2) + ' deg.';
    if (plan) reason += ' The mission plan expects a drop of about ' + f(expectedDrop, 1) + '% at this point.';
    var status = 'green', threshold = 'muscleAmberDropPct';
    if (drop > extra.redLimitPct) {
      status = 'red';
      threshold = 'muscleRedDropPct';
    } else if (drop - expectedDrop > amberLimit) {
      status = 'amber';
      if (plan) reason += ' That is ' + f(drop - expectedDrop, 1) + ' percentage points worse than the plan.';
    }
    return makeCard('muscle', status, words, { value: value, unit: unit, deltaPct: deltaPct, threshold: threshold, reason: reason, extra: extra, expectedDeltaPct: plan ? 0 - expectedDrop : null });
  }

  // ---- sleep -----------------------------------------------------------------
  function sleepCard(records, index, words) {
    var n = t('windowNights');
    var win = windowAt(records, index, n, 0);
    var v = values(win, 'sleep');
    var extra = { amberHours: t('sleepAmberHours'), redHours: t('sleepRedHours'), nights: v.length };
    if (v.length < t('sleepMinNights')) {
      return makeCard('sleep', 'grey', words, { unit: 'h', threshold: 'sleepMinNights', extra: extra, reason: tooFew(v.length, win.length, n, t('sleepMinNights'), 'radar data', index, records) });
    }
    var m = mean(v);
    var status = m < t('sleepRedHours') ? 'red' : m < t('sleepAmberHours') ? 'amber' : 'green';
    return makeCard('sleep', status, words, {
      value: m, unit: 'h', threshold: status === 'red' ? 'sleepRedHours' : 'sleepAmberHours', extra: extra,
      reason: 'Mean sleep ' + f(m, 2) + ' h over ' + v.length + ' nights with radar data in the last ' + n + '.'
    });
  }

  // ---- cardio ----------------------------------------------------------------
  function cardioCard(records, index, b, words) {
    var n = t('cardioNights');
    var win = windowAt(records, index, n, 0);
    var nights = win.filter(function (r) { return r.radar; });
    var hasBase = b.rr.median !== null && b.hr.median !== null;
    var rrLim = hasBase ? b.rr.median + t('cardioSdMultiple') * b.rr.sd : null;
    var hrLim = hasBase ? b.hr.median + t('cardioSdMultiple') * b.hr.sd : null;
    var extra = { hr: null, rr: null, hrLimit: hrLim, rrLimit: rrLim, sustained: false };
    if (!hasBase) {
      return makeCard('cardio', 'grey', words, { unit: 'bpm', threshold: 'baselineMinNights', extra: extra, reason: 'No baseline yet: fewer than ' + t('baselineMinNights') + ' baseline nights of radar data.' });
    }
    if (nights.length < t('cardioMinNights')) {
      return makeCard('cardio', 'grey', words, { unit: 'bpm', threshold: 'cardioMinNights', extra: extra, reason: tooFew(nights.length, win.length, n, t('cardioMinNights'), 'radar data', index, records) });
    }
    var rr = extra.rr = median(values(nights, 'rr'));
    var hr = extra.hr = median(values(nights, 'hr'));
    // No red tier: both raised on each of the last n nights stays amber with the sustained text.
    extra.sustained = nights.length === n && nights.every(function (r) { return r.radar.rr_bpm > rrLim && r.radar.hr_bpm > hrLim; });
    var status = extra.sustained || rr > rrLim || hr > hrLim ? 'amber' : 'green';
    return makeCard('cardio', status, words, {
      value: hr, unit: 'bpm', threshold: 'cardioSdMultiple', extra: extra, textKey: extra.sustained ? 'amberSustained' : null,
      reason: n + '-night median heart rate ' + f(hr, 1) + ' bpm (limit ' + f(hrLim, 1) + '), breathing rate ' + f(rr, 1) +
        ' per minute (limit ' + f(rrLim, 1) + '), over ' + nights.length + ' nights with radar data.'
    });
  }

  // ---- radiation -------------------------------------------------------------
  function radiationCard(records, index, words) {
    var tonight = records[index].rad;
    var mission = records.slice(0, index + 1).filter(surface);
    var cumulative = values(mission, 'dose').reduce(function (a, x) { return a + x; }, 0);
    var earlier = values(mission.filter(function (r) { return r !== records[index]; }), 'dose').slice(-t('radiationHistoryNights'));
    var usual = earlier.length ? median(earlier) : null;
    var extra = { ratio: null, usualUGy: usual, cumulativeUGy: cumulative };
    if (!tonight) {
      return makeCard('radiation', 'grey', words, { unit: 'uGy', threshold: 'radiationMinHistory', extra: extra, reason: 'No dose data tonight.' });
    }
    var dose = tonight.dose_uGy;
    var ratio = extra.ratio = usual ? dose / usual : null;
    var line = 'Tonight ' + f(dose, 1) + ' \u00b5Gy' + (ratio === null ? '.' : ', ' + Math.round(ratio * 10) / 10 + 'x the usual level (median of ' + earlier.length + ' earlier nights, ' + f(usual, 1) + ' \u00b5Gy).');
    var total = ' Total sleep-period dose this mission: ' + f(cumulative, 0) + ' \u00b5Gy.';
    var o = { value: dose, unit: 'uGy', deltaPct: ratio === null ? null : (ratio - 1) * 100, extra: extra };
    // A night with a solar particle event on record is red even without dose history (conservative).
    if (tonight.spe) {
      o.threshold = 'radiationRedRatio';
      o.reason = 'A solar particle event is on record for this night. ' + line + total;
      return makeCard('radiation', 'red', words, o);
    }
    if (earlier.length < t('radiationMinHistory')) {
      return makeCard('radiation', 'grey', words, { unit: 'uGy', threshold: 'radiationMinHistory', extra: extra, reason: 'Only ' + earlier.length + ' earlier mission nights with dose data (need ' + t('radiationMinHistory') + ').' });
    }
    var status = ratio > t('radiationRedRatio') ? 'red' : ratio > t('radiationAmberRatio') ? 'amber' : 'green';
    o.threshold = status === 'red' ? 'radiationRedRatio' : 'radiationAmberRatio';
    o.reason = line + (status === 'red' ? total : '');
    return makeCard('radiation', status, words, o);
  }

  // ---- assessment ------------------------------------------------------------
  function headline(cards, words) {
    var names = function (s) { return cards.filter(function (c) { return c.status === s; }).map(function (c) { return NAMES[c.id]; }); };
    var red = names('red'), amber = names('amber'), grey = names('grey');
    if (grey.length === cards.length) return 'No check has enough data tonight.';
    var redLine = red.length ? 'Report to the ' + words.clinician + ' today: ' + red.join(', ') + '.' : '';
    var amberLine = amber.length ? amber.length + (amber.length === 1 ? ' check' : ' checks') + ' to watch: ' + amber.join(', ') + '.' : '';
    if (redLine || amberLine) return (redLine + ' ' + amberLine).trim();
    if (grey.length) return 'The checks with enough data are in your normal range. Not enough data: ' + grey.join(', ') + '.';
    return 'All four checks are in your normal range.';
  }

  function assess(records, index, opts) {
    var words = rules.WORDING;
    var recs = records.slice(0, index + 1);
    var rec = recs[index];
    if (!rec) throw new Error('No record at index ' + index);
    var b = baseline(recs);
    var cards = [
      muscleCard(recs, index, b, words, opts && opts.expectedChangePct),
      sleepCard(recs, index, words),
      cardioCard(recs, index, b, words),
      radiationCard(recs, index, words)
    ];
    var rank = cards.map(function (c) { return ORDER.indexOf(c.status); });
    var worst = Math.max.apply(null, rank);
    return { night: rec.night, missionDay: rec.missionDay, cards: cards, overall: worst < 0 ? 'grey' : ORDER[worst], headline: headline(cards, words) };
  }

  // ---- projection ------------------------------------------------------------
  function project(records, index) {
    var recs = records.slice(0, index + 1);
    var b = baseline(recs);
    if (b.eim.median === null || !recs[index] || !surface(recs[index])) return null;
    if (muscleCard(recs, index, b, rules.WORDING).status === 'red') return null;
    var pts = [];
    for (var k = 0; k < t('projectionWeeks'); k++) {
      var w = weeklyMedian(recs, index, k);
      if (w === null) break;   // only complete surface weeks, consecutive back from tonight
      pts.push({ x: -k, y: (w - b.eim.median) / b.eim.median * 100 });
    }
    if (pts.length < t('projectionMinWeeks')) return null;
    var mx = mean(pts.map(function (p) { return p.x; }));
    var my = mean(pts.map(function (p) { return p.y; }));
    var sxy = 0, sxx = 0;
    pts.forEach(function (p) { sxy += (p.x - mx) * (p.y - my); sxx += (p.x - mx) * (p.x - mx); });
    var slope = sxy / sxx;                 // percent per week
    if (!(slope < 0)) return null;
    var now = my - slope * mx;             // fitted value at tonight (x = 0)
    var days = Math.round((-redDropPct(b) - now) / slope * t('windowNights'));
    if (days <= 0 || days > t('projectionMaxDays')) return null;   // never "about 0 days"
    return { cardId: 'muscle', daysToRed: days, slopePctPerWeek: Math.round(slope * 100) / 100 };
  }

  // ---- series ----------------------------------------------------------------
  function series(records, key) {
    var get = GETTERS[key];
    if (!get) throw new Error('Unknown series key: ' + key);
    return records.map(function (r) {
      var v = get(r);
      return { missionDay: r.missionDay, value: v === undefined ? null : v };
    });
  }

  var api = { baseline: baseline, assess: assess, project: project, series: series };

  ns.engine = api;
  if (inNode) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
