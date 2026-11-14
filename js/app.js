/*
 * MyoTwin page controller: reads the view state from the URL hash, generates
 * the simulated mission (js/sim.js), assesses every night once (js/engine.js)
 * and renders each panel of index.html. One render function per panel.
 * Browser only; does nothing when loaded in Node. All data are simulated.
 *
 * Written with an SI tool (Claude) and reviewed by the team.
 */
(function (root) {
  'use strict';
  if (typeof document === 'undefined' || !root.document) return;

  var M = root.MyoTwin || {};
  var NEEDED = ['evidence', 'model', 'sim', 'rules', 'engine', 'phantom', 'imaging', 'charts'];
  var missing = NEEDED.filter(function (k) { return !M[k]; });
  var $ = function (id) { return document.getElementById(id); };
  if (missing.length) {
    $('headline').textContent = 'Could not load: ' + missing.join(', ') + '. Open index.html from the full project folder.';
    return;
  }
  var evidence = M.evidence, model = M.model, sim = M.sim, rules = M.rules, engine = M.engine,
    phantom = M.phantom, imaging = M.imaging, charts = M.charts;
  var T = rules.THRESHOLDS;

  // ---- constants -----------------------------------------------------------------
  var CARD_IDS = ['muscle', 'sleep', 'cardio', 'radiation'];
  var CARD_NAMES = { muscle: 'Muscle', sleep: 'Sleep', cardio: 'Heart and breathing', radiation: 'Radiation' };
  var LAYERS = ['density', 'pressure', 'impedance'];
  var VIEWS = ['raw', 'diff'];
  var MODES = ['astronaut', 'eldercare'];
  var ENV_NAMES = { moon: 'Moon', mars: 'Mars', earth: 'Earth' };
  var WHATIF = {
    ex: { min: 0, max: 1, step: 0.05, def: null },   // null = the scenario's own plan
    gs: { min: 1, max: 4, step: 0.5, def: 1 },
    sh: { min: 0.1, max: 1, step: 0.1, def: 1 }
  };
  var ARRIVAL_NIGHTS = T.windowNights.value;      // the arrival week = first 7 surface nights
  var REF_SEED = 7;                               // fixed seed for the arrival-week density image
  var DIFF_MIN_RANGE = 10;                        // change view: colour scale at least +/-10 %
  var THIGH_RATIO = evidence.value('V4', 'thighControlPct') / evidence.value('V4', 'calfControlPct');
  var reducedMotion = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- state -----------------------------------------------------------------------
  var state = {};
  var data = { key: null, gen: null, dayIndex: {}, base: null, ref: {}, assessKey: null, assessments: [] };
  var playTimer = null;

  function defaultDay(s) { return s === 'S2' ? 42 : null; }          // null = last night
  function defaultMode(s) { return s === 'S4' ? 'eldercare' : 'astronaut'; }

  function snap(v, o) {
    var n = parseFloat(v);
    if (!isFinite(n) || n < o.min - 1e-9 || n > o.max + 1e-9) return o.def;
    return Math.round((Math.round((n - o.min) / o.step) * o.step + o.min) * 100) / 100;
  }
  function pick(v, list, def) { return list.indexOf(v) >= 0 ? v : def; }

  function parseHash(hash) {
    var q = {};
    hash.replace(/^#/, '').split('&').forEach(function (kv) {
      var i = kv.indexOf('=');
      if (i > 0) { try { q[kv.slice(0, i)] = decodeURIComponent(kv.slice(i + 1)); } catch (e) { /* ignore bad escapes */ } }
    });
    var s = sim.SCENARIOS[q.s] ? q.s : 'S2';
    var d = /^-?\d+$/.test(q.d || '') ? parseInt(q.d, 10) : defaultDay(s);
    return {
      s: s, d: d,
      layer: pick(q.layer, LAYERS, 'density'),
      view: pick(q.view, VIEWS, 'raw'),
      mode: pick(q.mode, MODES, defaultMode(s)),
      card: pick(q.card, CARD_IDS, 'muscle'),
      ex: snap(q.ex, WHATIF.ex), gs: snap(q.gs, WHATIF.gs), sh: snap(q.sh, WHATIF.sh),
      ev: /^V\d+$/.test(q.ev || '') ? q.ev : null
    };
  }

  function hashFor(st) {
    var parts = ['s=' + st.s, 'd=' + st.d, 'layer=' + st.layer, 'view=' + st.view, 'mode=' + st.mode, 'card=' + st.card];
    Object.keys(WHATIF).forEach(function (k) { if (st[k] !== WHATIF[k].def && st[k] != null) parts.push(k + '=' + st[k]); });
    if (st.ev) parts.push('ev=' + st.ev);
    return '#' + parts.join('&');
  }

  function writeHash() {
    var h = hashFor(state);
    if (location.hash === h) return;
    try { history.replaceState(null, '', h); } catch (e) { /* history API unavailable: keep the old hash */ }
  }

  // ---- data ------------------------------------------------------------------------
  function ensureData() {
    var key = [state.s, state.ex, state.gs, state.sh].join('|');
    if (data.key !== key) {
      var opts = { seed: 1, gravityShape: state.gs, shieldingFactor: state.sh };
      if (state.ex != null) opts.exerciseAdherence = state.ex;
      data.gen = sim.generate(state.s, opts);
      data.key = key;
      data.dayIndex = {};
      data.gen.records.forEach(function (r, i) { data.dayIndex[r.missionDay] = i; });
      data.base = engine.baseline(data.gen.records);
      data.ref = {};
      data.assessKey = null;
    }
    if (data.assessKey !== key + '|' + state.mode) {
      var recs = data.gen.records, plan = data.gen.plan.expectedChangePct;
      data.assessments = recs.map(function (r, i) {
        return engine.assess(recs, i, { mode: state.mode, expectedChangePct: plan });
      });
      data.assessKey = key + '|' + state.mode;
    }
    var recs2 = data.gen.records;
    if (state.d == null || data.dayIndex[state.d] === undefined) {
      var def = defaultDay(state.s);
      state.d = def != null && data.dayIndex[def] !== undefined ? def : recs2[recs2.length - 1].missionDay;
    }
  }

  function idx() { return data.dayIndex[state.d]; }
  function rec() { return data.gen.records[idx()]; }
  function assessment() { return data.assessments[idx()]; }
  function hasTrackers() { return data.gen.records.some(function (r) { return r._truth.tracksPerCm2 != null; }); }

  // ---- formatting ------------------------------------------------------------------
  var DECIMALS = { deg: 2, h: 1, bpm: 0, uGy: 0 };
  function unitLabel(u) { return u === 'uGy' ? 'µGy' : u; }
  function fmtValue(v, unit) {
    if (v == null || !isFinite(v)) return '—';
    return v.toLocaleString('en-US', { minimumFractionDigits: DECIMALS[unit] || 0, maximumFractionDigits: DECIMALS[unit] || 0 });
  }
  function fmtPct(p) {
    if (p == null || !isFinite(p)) return '—';
    var r = Math.round(p * 10) / 10;
    var sign = r > 0 ? '+' : r < 0 ? '−' : '';
    return sign + Math.abs(r).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
  }
  function niceText(s) { return String(s).replace(/\buGy\b/g, 'µGy').replace(/\bcardio\b/g, 'heart and breathing'); }
  function median(xs) {
    var s = xs.slice().sort(function (a, b) { return a - b; }), m = s.length >> 1;
    return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : null;
  }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); }
  function capital(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  // Muscle limits in percent, exactly as the engine computes them.
  function noise7() {
    var b = data.base.eim;
    return T.medianSeFactor.value * b.sd / Math.sqrt(T.windowNights.value) / b.median * 100;
  }
  function amberLimitPct() { return Math.max(T.muscleAmberNoiseMultiple.value * noise7(), T.muscleAmberDropPct.value); }
  function redLimitPct() { return Math.max(T.muscleRedNoiseMultiple.value * noise7(), T.muscleRedDropPct.value); }

  // ---- render: top bar -------------------------------------------------------------
  function renderTopbar() {
    var sel = $('scenario');
    if (!sel.options.length || sel.options[0].value === '') {
      clear(sel);
      Object.keys(sim.SCENARIOS).forEach(function (k) {
        var o = el('option', null, sim.SCENARIOS[k].title);
        o.value = k;
        sel.appendChild(o);
      });
      sel.disabled = false;
    }
    sel.value = state.s;
    var env = data.gen.scenario.env;
    $('env-name').textContent = ENV_NAMES[env] + (rec().missionDay < 0 ? ' · baseline on Earth' : '');
    document.body.classList.toggle('mode-eldercare', state.mode === 'eldercare');
    document.body.classList.toggle('mode-astronaut', state.mode !== 'eldercare');
    pressed('[data-mode]', 'mode', state.mode);
  }

  function pressed(selector, attr, value) {
    Array.prototype.forEach.call(document.querySelectorAll(selector), function (b) {
      b.setAttribute('aria-pressed', String(b.dataset[attr] === value));
    });
  }

  // ---- render: brief (headline + cards) --------------------------------------------
  function renderBrief() {
    var a = assessment(), r = rec();
    $('brief-date').textContent = 'Night of ' + r.night + ' · ' + dayLabel(r);
    $('headline').textContent = niceText(a.headline);
    $('scenario-summary').textContent = data.gen.scenario.summary;
    a.cards.forEach(renderCard);
  }

  function dayLabel(r) { return r.missionDay < 0 ? 'Baseline night' : 'Day ' + r.missionDay; }

  function deltaText(c) {
    if (c.status === 'grey') return c.id === 'radiation' ? 'Change vs recent nights: —' : 'Change vs baseline: —';
    if (c.id === 'radiation') return 'Change vs recent nights: ' + fmtPct(c.deltaPct);
    var d = c.deltaPct;
    if (d == null) {
      var b = c.id === 'sleep' ? data.base.sleep : c.id === 'cardio' ? data.base.hr : null;
      d = b && b.median ? (c.value - b.median) / b.median * 100 : null;
    }
    var t = 'Change vs baseline: ' + fmtPct(d);
    if (c.id === 'muscle' && c.expectedDeltaPct != null) t += ' · plan expects ' + fmtPct(c.expectedDeltaPct);
    return t;
  }

  function renderCard(c) {
    var btn = document.querySelector('.card[data-card="' + c.id + '"]');
    if (!btn) return;
    btn.className = 'card st-' + c.status;
    btn.setAttribute('aria-pressed', String(state.card === c.id));
    btn.querySelector('.st-icon use').setAttribute('href', charts.statusIcon(c.status));
    btn.querySelector('.status-word').textContent = charts.STATUS[c.status].word;
    btn.querySelector('.num').textContent = fmtValue(c.value, c.unit);
    btn.querySelector('.unit').textContent = unitLabel(c.unit);
    btn.querySelector('.card-delta').textContent = deltaText(c);
    btn.querySelector('.card-reason').textContent = niceText(c.reason);
  }

  // ---- render: whole-body image ----------------------------------------------------
  function phantomFor(changePct) {
    return phantom.build({ calfMuscleChangePct: changePct, thighMuscleChangePct: changePct * THIGH_RATIO });
  }

  function renderLayer(layer, ph, r, i) {
    if (layer === 'density') return imaging.render('density', ph, { tracksPerCm2: r._truth.tracksPerCm2, seed: i + 1 });
    if (layer === 'pressure') return imaging.render('pressure', ph, { env: r.env });
    return imaging.render('impedance', ph, { eimPhaseDeg: r.eim ? r.eim.phase50_deg : NaN, baselinePhaseDeg: data.base.eim.median });
  }

  function arrivalRecords() {
    return data.gen.records.filter(function (r) { return r.missionDay >= 0; }).slice(0, ARRIVAL_NIGHTS);
  }

  function referenceImage(layer) {
    if (data.ref[layer]) return data.ref[layer];
    var week = arrivalRecords();
    var mean = function (xs) { return xs.reduce(function (a, b) { return a + b; }, 0) / xs.length; };
    var ph = phantomFor(mean(week.map(function (r) { return r._truth.muscleChangePct; })));
    var img;
    if (layer === 'density') {
      img = imaging.render('density', ph, { tracksPerCm2: ARRIVAL_NIGHTS * mean(week.map(function (r) { return r._truth.tracksPerCm2; })), seed: REF_SEED });
    } else if (layer === 'pressure') {
      img = imaging.render('pressure', ph, { env: week[0].env });
    } else {
      var eims = week.filter(function (r) { return r.eim; }).map(function (r) { return r.eim.phase50_deg; });
      img = imaging.render('impedance', ph, { eimPhaseDeg: eims.length ? median(eims) : NaN, baselinePhaseDeg: data.base.eim.median });
    }
    data.ref[layer] = img;
    return img;
  }

  function renderImage() {
    var r = rec(), i = idx();
    var canvas = $('body-canvas'), empty = $('canvas-empty'), bar = $('colorbar');
    var trackers = hasTrackers();
    var densityBtn = document.querySelector('[data-layer="density"]');
    densityBtn.disabled = !trackers;
    densityBtn.title = trackers ? '' : 'No particle trackers at this bed';
    if (!trackers && state.layer === 'density') state.layer = 'pressure';
    pressed('[data-layer]', 'layer', state.layer);
    pressed('[data-view]', 'view', state.view);
    $('cap-exp').hidden = state.layer !== 'density' || r.missionDay < 0;

    if (r.missionDay < 0) {
      canvas.hidden = true;
      empty.hidden = false;
      empty.textContent = 'Baseline nights are recorded on Earth before departure; images start at arrival.';
      clear(bar);
      $('cap-label').textContent = 'No image on baseline nights.';
      $('cap-extra').textContent = trackers ? '' : 'No particle trackers at this bed.';
      return;
    }

    var ph = phantomFor(r._truth.muscleChangePct);
    var img = renderLayer(state.layer, ph, r, i);
    var shown = img, cmap = state.layer === 'density' ? 'gray' : 'heat', label = img.label;
    if (state.view === 'diff') {
      shown = imaging.difference(img, referenceImage(state.layer), ph);
      var m = DIFF_MIN_RANGE;
      for (var k = 0; k < shown.values.length; k++) { var v = shown.values[k]; if (v === v && Math.abs(v) > m) m = Math.ceil(Math.abs(v)); }
      shown.min = -m; shown.max = m;
      cmap = 'diverging';
      label = 'Change since the arrival week: ' + state.layer + ' (averaged per body region)';
    } else if (state.layer === 'impedance') {
      // Fixed scale around the baseline so a falling calf reading shows as a colour change.
      shown.min = data.base.eim.median * 0.75;
      shown.max = data.base.eim.median * 1.05;
    } else if (state.layer === 'pressure') {
      shown.min = 0;
    }

    canvas.hidden = false;
    empty.hidden = true;
    charts.image(canvas, shown, { colormap: cmap, scale: 4, nanColor: [0, 0, 0, 0] });
    canvas.setAttribute('aria-label', label + ', ' + dayLabel(r));
    charts.colorbar(bar, { min: shown.min, max: shown.max, unit: state.view === 'diff' ? '%' : img.unit, colormap: cmap });

    $('cap-label').textContent = label + '.';
    var extra = [];
    if (state.layer === 'density') extra.push('Tracks tonight: ' + Math.round(r._truth.tracksPerCm2).toLocaleString('en-US') + ' per cm².');
    if (state.layer === 'pressure' && img.massKg) extra.push('Body mass derived from the pressure map: ' + img.massKg.toFixed(1) + ' kg.');
    if (state.layer === 'impedance' && !r.eim) extra.push('No usable calf scan tonight.');
    if (!trackers) extra.push('No particle trackers at this bed.');
    $('cap-extra').textContent = extra.join(' ');
  }

  // ---- render: timeline ------------------------------------------------------------
  function renderTimeline() {
    var recs = data.gen.records, r = rec();
    var slider = $('day');
    slider.disabled = false;
    slider.max = String(recs.length - 1);
    slider.value = String(idx());
    slider.setAttribute('aria-valuetext', dayLabel(r) + ', ' + r.night);
    $('day-out').textContent = dayLabel(r) + (r.missionDay < 0 ? ' (' + r.missionDay + ')' : '');
    $('date-out').textContent = r.night;
    var play = $('play');
    play.disabled = false;
    play.setAttribute('aria-pressed', String(!!playTimer));
    play.querySelector('.btn-text').textContent = playTimer ? 'Pause' : 'Play';
  }

  // ---- render: trend ---------------------------------------------------------------
  function statusAtFor(cardId) {
    var k = CARD_IDS.indexOf(cardId);
    return function (day) {
      var i = data.dayIndex[day];
      return i === undefined ? 'grey' : data.assessments[i].cards[k].status;
    };
  }

  function band(b) { return b && b.median != null ? { median: b.median, low: b.median - 2 * b.sd, high: b.median + 2 * b.sd } : null; }

  function usualDose() {
    var earlier = data.gen.records.slice(0, idx()).filter(function (r) { return r.missionDay >= 0 && r.rad; })
      .map(function (r) { return r.rad.dose_uGy; }).slice(-T.radiationHistoryNights.value);
    if (!earlier.length) {
      earlier = data.gen.records.filter(function (r) { return r.rad; }).map(function (r) { return r.rad.dose_uGy; }).slice(0, ARRIVAL_NIGHTS);
    }
    return median(earlier);
  }

  function trendOptions(card) {
    var recs = data.gen.records, b = data.base, r = rec();
    var o = { statusAt: statusAtFor(card), selectedDay: state.d, thresholds: [], markers: [] };
    var note = '';
    if (card === 'muscle') {
      var med = b.eim.median, plan = data.gen.plan.expectedChangePct, amber = amberLimitPct();
      o.series = engine.series(recs, 'eim');
      o.baseline = band(b.eim);
      o.expected = recs.map(function (x, i) {
        var high = med * (1 + plan[i] / 100);
        return { missionDay: x.missionDay, low: high * (1 - amber / 100), high: high };
      }).filter(function (p, i) { return recs[i].missionDay >= 0; });
      o.thresholds = [{ value: med * (1 - redLimitPct() / 100), label: 'Act now: ' + redLimitPct().toFixed(1) + '% below baseline', status: 'red' }];
      o.markers = [{ missionDay: 0, label: 'Arrival' }].concat(data.gen.scenario.events.map(function (e) { return { missionDay: e.from, label: e.label }; }));
      o.exercise = recs.filter(function (x) { return x.missionDay >= 0; }).map(function (x) { return { missionDay: x.missionDay, done: !!x.log.exercise_done }; });
      o.unit = 'deg'; o.yLabel = 'Calf phase';
      note = 'Nightly calf impedance phase. The grey band is what the mission plan expects; readings below it are worse than the plan by more than ' +
        amber.toFixed(1) + '%. Ticks along the bottom: exercise done (tall) or missed (short).';
    } else if (card === 'sleep') {
      o.series = engine.series(recs, 'sleep');
      o.thresholds = [
        { value: T.sleepAmberHours.value, label: T.sleepAmberHours.value + ' h recommended', status: 'amber' },
        { value: T.sleepRedHours.value, label: 'Under ' + T.sleepRedHours.value + ' h', status: 'red' }
      ];
      o.unit = 'h'; o.yLabel = 'Sleep';
      note = 'Hours asleep each night, from the radar. The card uses the mean of the last ' + T.windowNights.value + ' nights.';
    } else if (card === 'cardio') {
      o.series = engine.series(recs, 'hr');
      o.baseline = band(b.hr);
      if (b.hr.median != null) {
        o.thresholds = [{ value: b.hr.median + T.cardioSdMultiple.value * b.hr.sd, label: 'Raised: baseline + ' + T.cardioSdMultiple.value + ' SD', status: 'amber' }];
      }
      o.unit = 'bpm'; o.yLabel = 'Night heart rate';
      var rrLim = b.rr.median != null ? b.rr.median + T.cardioSdMultiple.value * b.rr.sd : null;
      note = 'Night heart rate from the radar. Breathing rate is judged the same way' +
        (r.radar ? ': tonight ' + r.radar.rr_bpm.toFixed(1) + ' per minute' : '') +
        (rrLim != null ? ', raised above ' + rrLim.toFixed(1) + ' per minute.' : '.');
    } else {
      o.series = engine.series(recs, 'dose');
      var usual = usualDose();
      if (usual) {
        o.thresholds = [
          { value: usual * T.radiationAmberRatio.value, label: T.radiationAmberRatio.value + '× usual', status: 'amber' },
          { value: usual * T.radiationRedRatio.value, label: T.radiationRedRatio.value + '× usual', status: 'red' }
        ];
      }
      o.markers = data.gen.scenario.events.filter(function (e) { return e.spe || e.doseFactor; }).map(function (e) { return { missionDay: e.from, label: e.label }; });
      o.unit = 'µGy'; o.yLabel = 'Dose per night';
      note = usual ? 'Absorbed dose in silicon over each sleep period. Usual level: ' + Math.round(usual) + ' µGy (median of up to ' +
        T.radiationHistoryNights.value + ' earlier nights).' : 'No particle detector at this bed.';
    }
    return { opts: o, note: note };
  }

  function renderTrend() {
    var card = state.card, t = trendOptions(card);
    $('trend-card').textContent = CARD_NAMES[card];
    charts.line($('trend-chart'), t.opts);
    $('trend-note').textContent = t.note;

    var p = card === 'muscle' ? engine.project(data.gen.records, idx()) : null;
    var proj = $('projection');
    proj.hidden = !p;
    proj.textContent = p ? 'At this rate the muscle card turns red in about ' + p.daysToRed + ' days (trend ' + fmtPct(p.slopePctPerWeek) + ' per week).' : '';

    var r = rec(), roseFig = $('rose-fig');
    var showRose = card === 'radiation' && r.rad && r.rad.dir;
    roseFig.hidden = !showRose;
    if (showRose) {
      // One night holds about a hundred counts, too few to read a direction; sum the mission so far.
      var sum = [0, 0, 0, 0, 0, 0, 0, 0], nights = 0;
      data.gen.records.slice(0, idx() + 1).forEach(function (x) {
        if (!x.rad || !x.rad.dir) return;
        nights++;
        x.rad.dir.forEach(function (n, j) { sum[j] += n; });
      });
      var k = charts.rose($('rose'), sum, { highlightMax: true });
      $('rose-reading').textContent = 'Most particles arrive from sector ' + k + ': that side is less shielded.';
      $('rose-span').textContent = 'Summed over the ' + nights + (nights === 1 ? ' night' : ' nights') + ' with tracker data up to tonight.';
    }
  }

  // ---- render: guidance ------------------------------------------------------------
  function evidenceHref(id) {
    var st = {}; Object.keys(state).forEach(function (k) { st[k] = state[k]; });
    st.ev = id;
    return hashFor(st);
  }

  function sourceLink(id) {
    var a = el('a', null, id);
    a.href = evidenceHref(id);
    try { a.title = evidence.get(id).claim; } catch (e) { /* unknown id: plain link */ }
    return a;
  }

  function renderGuidance() {
    var c = assessment().cards[CARD_IDS.indexOf(state.card)];
    var words = rules.WORDING[state.mode];
    $('guidance-card').textContent = CARD_NAMES[state.card];
    var st = $('g-status');
    clear(st);
    var wrap = el('span', 'status st-' + c.status);
    wrap.appendChild(charts.statusIconEl(c.status, 16));
    wrap.appendChild(el('span', 'status-word', charts.STATUS[c.status].word));
    st.appendChild(wrap);
    st.appendChild(el('span', 'g-reason', ' ' + niceText(c.reason)));
    $('g-meaning').textContent = c.meaning;
    var ul = $('g-actions');
    clear(ul);
    c.actions.forEach(function (x) { ul.appendChild(el('li', null, x)); });
    $('g-decides').textContent = capital(c.decides);

    var src = $('g-sources');
    clear(src);
    if (!c.sourceIds.length) src.appendChild(el('li', 'muted', 'Interim assumption; see the assumptions list in the evidence drawer.'));
    c.sourceIds.forEach(function (id) {
      var li = el('li');
      li.appendChild(sourceLink(id));
      try { li.appendChild(document.createTextNode(' ' + evidence.get(id).claim)); } catch (e) { /* unknown id */ }
      src.appendChild(li);
    });

    var showCm = state.card === 'muscle';
    $('g-cm-title').hidden = !showCm;
    $('g-cm-dd').hidden = !showCm;
    var cm = $('g-cm');
    clear(cm);
    if (showCm) {
      rules.COUNTERMEASURES.forEach(function (x) {
        var li = el('li');
        li.appendChild(el('span', 'cm-name', x.name));
        li.appendChild(el('span', 'chip chip-' + x.evidence.replace(/\s+/g, '-'), x.evidence));
        li.appendChild(el('span', 'cm-note', x.note.replace(/the flight surgeon/g, 'the ' + words.clinician) + ' '));
        x.sourceIds.forEach(function (id) { li.appendChild(sourceLink(id)); });
        cm.appendChild(li);
      });
    }
    $('g-disclaimer').textContent = rules.DISCLAIMER.replace(/\{(\w+)\}/g, function (_, k) { return words[k] || k; });
  }

  // ---- render: what-if -------------------------------------------------------------
  function renderWhatIf() {
    var ex = $('adherence'), gs = $('shape'), sh = $('shield');
    [ex, gs, sh, $('whatif-reset')].forEach(function (n) { n.disabled = false; });
    ex.value = String(state.ex == null ? 1 : state.ex);
    gs.value = String(state.gs);
    sh.value = String(state.sh);
    $('adherence-out').textContent = state.ex == null ? 'Scenario' : Math.round(state.ex * 100) + '%';
    $('shape-out').textContent = state.gs === 1 ? '1 (linear)' : String(state.gs);
    $('shield-out').textContent = state.sh.toFixed(1);
  }

  // ---- render: evidence drawer (built once) ----------------------------------------
  function fmtAssumptionValue(v) {
    if (Array.isArray(v)) return v.join(' to ');
    if (v && typeof v === 'object') {
      return Object.keys(v).map(function (k) { return k + ' ' + fmtAssumptionValue(v[k]); }).join('; ');
    }
    return String(v);
  }

  function buildEvidence() {
    var box = $('evidence-list');
    clear(box);
    var groups = {}, order = [];
    evidence.items.forEach(function (it) {
      if (!groups[it.topic]) { groups[it.topic] = []; order.push(it.topic); }
      groups[it.topic].push(it);
    });
    order.forEach(function (topic) {
      box.appendChild(el('h3', 'ev-group', capital(topic)));
      var ol = el('ol', 'evidence-list');
      groups[topic].forEach(function (it) {
        var li = el('li');
        li.id = 'ev-' + it.id;
        li.tabIndex = -1;
        li.appendChild(el('span', 'ev-id', it.id));
        var body = el('div');
        body.appendChild(el('span', 'ev-claim', it.claim));
        if (it.quote) body.appendChild(el('q', 'ev-quote', it.quote));
        var a = el('a', 'ev-source', it.source);
        a.href = it.url;
        a.rel = 'noopener noreferrer';
        body.appendChild(a);
        li.appendChild(body);
        li.appendChild(el('span', 'ev-status ev-' + it.status, it.status));
        ol.appendChild(li);
      });
      box.appendChild(ol);
    });

    var rows = [];
    function add(owner, name, x) { rows.push({ owner: owner, name: name, value: x.value, unit: x.unit, note: x.note }); }
    Object.keys(model.PARAMS).forEach(function (k) { if (model.PARAMS[k].status === 'assumption') add('Muscle model', k, model.PARAMS[k]); });
    Object.keys(sim.ASSUMPTIONS).forEach(function (k) { add('Simulator', k, sim.ASSUMPTIONS[k]); });
    Object.keys(sim.NOISE).forEach(function (k) { add('Simulator noise', k, sim.NOISE[k]); });
    phantom.ASSUMPTIONS.forEach(function (x) { add('Body phantom', x.name, x); });
    imaging.ASSUMPTIONS.forEach(function (x) { add('Imaging', x.name, x); });
    Object.keys(T).forEach(function (k) { if (T[k].status === 'assumption') add('Status rules', k, T[k]); });

    box.appendChild(el('h3', 'ev-group', 'Assumptions'));
    box.appendChild(el('p', 'muted', 'Modelling choices that no source fixes. Each can be changed in the module that owns it.'));
    var ol2 = el('ol', 'evidence-list assumption-list');
    rows.forEach(function (x) {
      var li = el('li');
      li.appendChild(el('span', 'ev-id', x.owner));
      var body = el('div');
      var head = el('span', 'ev-claim');
      head.appendChild(el('code', null, x.name));
      head.appendChild(document.createTextNode(' = ' + fmtAssumptionValue(x.value) + (x.unit ? ' ' + x.unit : '')));
      body.appendChild(head);
      if (x.note) body.appendChild(el('span', 'ev-source', x.note));
      li.appendChild(body);
      li.appendChild(el('span', 'ev-status ev-assumption', 'assumption'));
      ol2.appendChild(li);
    });
    box.appendChild(ol2);
    $('evidence-count').textContent = evidence.items.length + ' sources and ' + rows.length + ' declared assumptions';
  }

  function openEvidence(id) {
    var target = $('ev-' + id);
    if (!target) return;
    target.closest('details').open = true;
    Array.prototype.forEach.call(document.querySelectorAll('.ev-target'), function (n) { n.classList.remove('ev-target'); });
    target.classList.add('ev-target');
    target.scrollIntoView({ block: 'center', behavior: reducedMotion ? 'auto' : 'smooth' });
    target.focus({ preventScroll: true });
  }

  // ---- update cycle ----------------------------------------------------------------
  function render() {
    ensureData();
    renderTopbar();
    renderBrief();
    renderImage();
    renderTimeline();
    renderTrend();
    renderGuidance();
    renderWhatIf();
  }

  function update(changes) {
    Object.keys(changes || {}).forEach(function (k) { state[k] = changes[k]; });
    if (!('ev' in (changes || {}))) state.ev = null;
    render();
    writeHash();
  }

  // ---- playback --------------------------------------------------------------------
  function stepDay(delta) {
    var recs = data.gen.records, i = idx() + delta;
    if (i < 0 || i >= recs.length) return false;
    update({ d: recs[i].missionDay });
    return true;
  }

  function setPlaying(on) {
    if (playTimer) { clearInterval(playTimer); playTimer = null; }
    $('headline').setAttribute('aria-live', on ? 'off' : 'polite');
    if (on) {
      if (idx() === data.gen.records.length - 1) update({ d: data.gen.records[0].missionDay });
      playTimer = setInterval(function () { if (!stepDay(1)) setPlaying(false); }, reducedMotion ? 1000 : 125);
    }
    renderTimeline();
  }

  // ---- events ----------------------------------------------------------------------
  function wire() {
    $('scenario').addEventListener('change', function (e) {
      setPlaying(false);
      update({ s: e.target.value, d: defaultDay(e.target.value), mode: defaultMode(e.target.value) });
    });
    document.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b || b.disabled) return;
      if (b.dataset.mode) update({ mode: b.dataset.mode });
      else if (b.dataset.layer) update({ layer: b.dataset.layer });
      else if (b.dataset.view) update({ view: b.dataset.view });
      else if (b.dataset.card) update({ card: b.dataset.card });
      else if (b.id === 'play') setPlaying(!playTimer);
      else if (b.id === 'whatif-reset') update({ ex: WHATIF.ex.def, gs: WHATIF.gs.def, sh: WHATIF.sh.def });
    });
    $('cap-exp').addEventListener('click', function (e) {
      e.preventDefault();
      var lim = $('limits');
      lim.scrollIntoView({ block: 'start', behavior: reducedMotion ? 'auto' : 'smooth' });
      lim.focus({ preventScroll: true });
    });
    $('day').addEventListener('input', function (e) {
      var r = data.gen.records[parseInt(e.target.value, 10)];
      if (r) update({ d: r.missionDay });
    });
    $('adherence').addEventListener('input', function (e) { update({ ex: snap(e.target.value, WHATIF.ex) }); });
    $('shape').addEventListener('input', function (e) { update({ gs: snap(e.target.value, WHATIF.gs) }); });
    $('shield').addEventListener('input', function (e) { update({ sh: snap(e.target.value, WHATIF.sh) }); });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.target.closest('input, select, textarea, [contenteditable]')) return;
      e.preventDefault();
      setPlaying(false);
      stepDay(e.key === 'ArrowRight' ? 1 : -1);
    });
    var pending = false;
    root.addEventListener('resize', function () {
      if (pending) return;
      pending = true;
      root.requestAnimationFrame(function () { pending = false; renderTrend(); });
    });
    root.addEventListener('hashchange', function () {
      if (location.hash.indexOf('=') < 0) return;      // a plain in-page anchor, not a view
      if (location.hash === hashFor(state)) return;
      setPlaying(false);
      state = parseHash(location.hash);
      render();
      if (state.ev) openEvidence(state.ev);
    });
  }

  // ---- start -----------------------------------------------------------------------
  state = parseHash(location.hash.indexOf('=') >= 0 ? location.hash : '');
  buildEvidence();
  wire();
  render();
  writeHash();
  if (state.ev) openEvidence(state.ev);
})(typeof globalThis !== 'undefined' ? globalThis : this);
