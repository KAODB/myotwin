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
  var has = function (o, k) { return Object.prototype.hasOwnProperty.call(o, k); };

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
    sh: { min: 0.1, max: 1, step: 0.1, def: 1 },
    nz: { min: 0.01, max: 0.08, step: 0.01, def: sim.NOISE.eimPhaseSdFraction.value }
  };
  var WINDOW = T.windowNights.value;               // arrival week and accumulation window
  var REF_SEED = 7;                                // fixed seed for the arrival-week density image
  var DIFF_MIN_RANGE = 10;                         // change view: colour scale at least +/-10 %
  var NOISE_MULTIPLE = 2;                          // change view: grey out regions below 2 x expected noise
  var MASK_RGBA = [96, 104, 118, 255];             // "below noise"
  var OUTLINE_RGBA = [150, 160, 175, 255];         // "not measured"
  var THIGH_RATIO = evidence.value('V4', 'thighControlPct') / evidence.value('V4', 'calfControlPct');
  var MOMENTUM_SPREAD = imaging.ASSUMPTIONS.filter(function (a) { return a.name === 'momentumSpreadFactor'; })[0].value;
  var HOME_BANNED = /mission|arrival|habitat|flight surgeon|spaceflight/i;
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
    var s = typeof q.s === 'string' && has(sim.SCENARIOS, q.s) ? q.s : 'S2';
    var d = /^-?\d+$/.test(q.d || '') ? parseInt(q.d, 10) : defaultDay(s);
    return {
      s: s, d: d,
      layer: pick(q.layer, LAYERS, 'density'),
      view: pick(q.view, VIEWS, 'raw'),
      mode: pick(q.mode, MODES, defaultMode(s)),
      card: pick(q.card, CARD_IDS, 'muscle'),
      ex: snap(q.ex, WHATIF.ex), gs: snap(q.gs, WHATIF.gs), sh: snap(q.sh, WHATIF.sh), nz: snap(q.nz, WHATIF.nz),
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
    var key = [state.s, state.ex, state.gs, state.sh, state.nz].join('|');
    if (data.key !== key) {
      // Each scenario has its own default seed (sim.SCENARIOS[s].seed), so no seed is passed.
      var opts = { gravityShape: state.gs, shieldingFactor: state.sh };
      if (state.ex != null) opts.exerciseAdherence = state.ex;
      if (state.nz !== WHATIF.nz.def) opts.eimNoiseSdFraction = state.nz;
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
    if (isHome()) {
      if (state.card === 'radiation') state.card = 'muscle';
      if (state.layer === 'density') state.layer = 'pressure';
    }
  }

  function idx() { return data.dayIndex[state.d]; }
  function rec() { return data.gen.records[idx()]; }
  function assessment() { return data.assessments[idx()]; }
  function card(id) { return assessment().cards[CARD_IDS.indexOf(id)]; }
  function hasTrackers() { return data.gen.records.some(function (r) { return r._truth.tracksPerCm2 != null; }); }
  // Eldercare at home: no space words, no radiation, no particle trackers.
  function isHome() { return state.mode === 'eldercare' && data.gen && data.gen.scenario.env === 'earth'; }
  function visibleCards() { return isHome() ? CARD_IDS.slice(0, 3) : CARD_IDS; }

  function words() {
    var h = isHome();
    return {
      timeline: h ? 'Timeline' : 'Mission timeline',
      day: h ? 'Day' : 'Mission day',
      start: h ? 'Start' : 'Arrival',
      plan: h ? 'Care plan' : 'Plan',
      diff: h ? 'Change since the first week' : 'Change since arrival',
      baselineLegend: h ? 'Days below 0 are the 14 baseline nights.' : 'Days below 0 are the 14 pre-departure baseline nights.',
      dataSource: h ? 'Measured by a sensor panel in the bed during sleep. Nothing is worn and it takes no time.' :
        'Measured by a sensor panel in the sleep station while the crew sleep. Nothing is worn and it takes no crew time.',
      noImage: h ? 'Images start on day 0, after the 14 baseline nights.' :
        'Baseline nights are recorded on Earth before departure; images start at arrival.'
    };
  }

  // Engine and rules text is written for the mission; at home the same facts read in care words.
  function scrub(s) {
    s = String(s).replace(/\buGy\b/g, 'µGy').replace(/expects a drop of about -?0\.0% at this point/g, 'expects no change at this point');
    if (!isHome()) return s;
    return s.replace(/\bmission plan\b/gi, 'care plan').replace(/\bsince arrival\b/gi, 'since the start')
      .replace(/\bmission\b/gi, 'period');
  }

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
  function fmtRatio(x) { return (x >= 10 ? Math.round(x) : Math.round(x * 10) / 10) + 'x'; }
  function fmtDose(uGy) { return uGy >= 1000 ? (uGy / 1000).toFixed(1) + ' mGy' : Math.round(uGy) + ' µGy'; }
  function median(xs) {
    var s = xs.slice().sort(function (a, b) { return a - b; }), m = s.length >> 1;
    return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : null;
  }
  function mean(xs) { return xs.reduce(function (a, b) { return a + b; }, 0) / xs.length; }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); }
  function capital(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function dayLabel(r) { return r.missionDay < 0 ? 'Baseline night' : 'Day ' + r.missionDay; }

  // Muscle limits come from the engine (card.extra); any assessed night carries them.
  function muscleExtra() {
    var e = card('muscle').extra;
    if (e && e.amberLimitPct != null) return e;
    var last = data.assessments[data.assessments.length - 1].cards[0].extra;
    return last;
  }
  // Baseline used for chart bands: on a baseline night, only the nights so far (as the card).
  function chartBaseline() {
    return rec().missionDay < 0 ? engine.baseline(data.gen.records.slice(0, idx() + 1)) : data.base;
  }

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
    $('env-label').textContent = isHome() ? 'Setting' : 'Habitat';
    $('env-name').textContent = isHome() ? 'Home' : ENV_NAMES[env] + (rec().missionDay < 0 ? ' · baseline on Earth' : '');
    document.body.classList.toggle('mode-eldercare', state.mode === 'eldercare');
    document.body.classList.toggle('mode-astronaut', state.mode !== 'eldercare');
    pressed('[data-mode]', 'mode', state.mode);
    // Static words that change at home.
    var w = words();
    $('data-source').textContent = w.dataSource;
    $('timeline-title').textContent = w.timeline;
    $('day-label').textContent = w.day;
    $('timeline-legend').textContent = w.baselineLegend;
    $('view-diff').textContent = w.diff;
    $('sensor-trackers').hidden = isHome();
    $('hrp-line').hidden = isHome();
    $('hrp-link').href = evidenceHref('V44');
    $('knob-shape').hidden = isHome();
    $('knob-shield').hidden = isHome();
  }

  function pressed(selector, attr, value) {
    Array.prototype.forEach.call(document.querySelectorAll(selector), function (b) {
      b.setAttribute('aria-pressed', String(b.dataset[attr] === value));
    });
  }

  // ---- render: brief (headline + cards) --------------------------------------------
  // At home only three cards are shown, so the headline is rebuilt from those three
  // with the engine's own wording rules.
  function homeHeadline(cards) {
    var names = function (s) { return cards.filter(function (c) { return c.status === s; }).map(function (c) { return CARD_NAMES[c.id].toLowerCase(); }); };
    var red = names('red'), amber = names('amber'), grey = names('grey');
    if (grey.length === cards.length) return 'No check has enough data tonight.';
    var redLine = red.length ? 'Report to the ' + rules.WORDING[state.mode].clinician + ' today: ' + red.join(', ') + '.' : '';
    var amberLine = amber.length ? amber.length + (amber.length === 1 ? ' check' : ' checks') + ' to watch: ' + amber.join(', ') + '.' : '';
    if (redLine || amberLine) return (redLine + ' ' + amberLine).trim();
    if (grey.length) return 'The checks with enough data are in your normal range. Not enough data: ' + grey.join(', ') + '.';
    return 'All three checks are in your normal range.';
  }

  function renderBrief() {
    var a = assessment(), r = rec();
    $('brief-date').textContent = 'Night of ' + r.night + ' · ' + dayLabel(r);
    var shown = a.cards.filter(function (c) { return visibleCards().indexOf(c.id) >= 0; });
    $('headline').textContent = scrub(isHome() ? homeHeadline(shown) : a.headline);
    $('scenario-summary').textContent = data.gen.scenario.summary;
    $('cards').classList.toggle('cards-3', isHome());
    a.cards.forEach(renderCard);
  }

  function changeVsBaseline(c) {
    var b = c.id === 'sleep' ? data.base.sleep : c.id === 'cardio' ? data.base.hr : null;
    if (rec().missionDay < 0) b = c.id === 'sleep' ? chartBaseline().sleep : chartBaseline().hr;
    return b && b.median && c.value != null ? (c.value - b.median) / b.median * 100 : null;
  }

  function cardLines(c) {
    var grey = c.status === 'grey', x = c.extra || {};
    if (c.id === 'muscle') {
      var med = grey ? '—' : fmtValue(c.value, 'deg') + ' deg';
      var exp = c.expectedDeltaPct;
      var plan = exp != null ? ' · ' + (isHome() ? 'care plan' : 'plan') + ' expects ' + (Math.round(exp * 10) === 0 ? 'no change' : fmtPct(exp)) : '';
      return { num: grey ? '—' : fmtPct(c.deltaPct), unit: 'vs your own baseline', delta: WINDOW + '-night median ' + med + plan, extra: '' };
    }
    if (c.id === 'radiation') {
      return {
        num: fmtValue(c.value, c.unit), unit: unitLabel(c.unit),
        delta: x.ratio != null && !grey ? fmtRatio(x.ratio) + ' the usual level' : 'Usual level: not enough nights yet',
        extra: x.cumulativeUGy ? 'Sleep-period dose so far this mission: ' + fmtDose(x.cumulativeUGy) + ' (in silicon)' : ''
      };
    }
    return { num: fmtValue(c.value, c.unit), unit: unitLabel(c.unit), delta: 'Change vs baseline: ' + (grey ? '—' : fmtPct(changeVsBaseline(c))), extra: '' };
  }

  function renderCard(c) {
    var btn = document.querySelector('.card[data-card="' + c.id + '"]');
    if (!btn) return;
    btn.hidden = visibleCards().indexOf(c.id) < 0;
    btn.className = 'card st-' + c.status;
    btn.setAttribute('aria-pressed', String(state.card === c.id));
    btn.querySelector('.st-icon use').setAttribute('href', charts.statusIcon(c.status));
    btn.querySelector('.status-word').textContent = charts.STATUS[c.status].word;
    var L = cardLines(c);
    btn.querySelector('.num').textContent = L.num;
    btn.querySelector('.unit').textContent = L.unit;
    btn.querySelector('.card-delta').textContent = L.delta;
    var ex = btn.querySelector('.card-extra');
    ex.textContent = L.extra;
    ex.hidden = !L.extra;
    btn.querySelector('.card-reason').textContent = scrub(c.reason);
  }

  // ---- render: whole-body image ----------------------------------------------------
  function phantomFor(changePct) {
    return phantom.build({ calfMuscleChangePct: changePct, thighMuscleChangePct: changePct * THIGH_RATIO });
  }

  function surfaceWindow(endIndex) {
    var out = [];
    for (var i = endIndex; i >= 0 && out.length < WINDOW; i--) {
      if (data.gen.records[i].missionDay < 0) break;
      out.unshift(data.gen.records[i]);
    }
    return out;
  }
  function arrivalWeek() { return data.gen.records.filter(function (r) { return r.missionDay >= 0; }).slice(0, WINDOW); }

  // One image accumulated over several nights: muscle state averaged, tracks summed.
  function accumulated(layer, nights, seed) {
    var ph = phantomFor(mean(nights.map(function (r) { return r._truth.muscleChangePct; })));
    var img, tracks = null;
    if (layer === 'density') {
      tracks = nights.reduce(function (a, r) { return a + (r._truth.tracksPerCm2 || 0); }, 0);
      img = imaging.render('density', ph, { tracksPerCm2: tracks, seed: seed });
    } else if (layer === 'pressure') {
      img = imaging.render('pressure', ph, { env: nights[nights.length - 1].env });
    } else {
      var eims = nights.filter(function (r) { return r.eim; }).map(function (r) { return r.eim.phase50_deg; });
      img = imaging.render('impedance', ph, { eimPhaseDeg: eims.length ? median(eims) : NaN, baselinePhaseDeg: data.base.eim.median });
    }
    return { img: img, ph: ph, tracks: tracks };
  }

  function referenceImage(layer) {
    if (!data.ref[layer]) data.ref[layer] = accumulated(layer, arrivalWeek(), REF_SEED).img;
    return data.ref[layer];
  }

  function isCalf(ph, i) { var n = ph.REGIONS[ph.region[i]]; return n === 'calf_L' || n === 'calf_R'; }

  // Impedance: only the calves are measured. Other body cells: outline on the edge, empty inside.
  function impedanceOverlay(img, ph) {
    var ov = new Uint8Array(ph.w * ph.h);
    for (var y = 0; y < ph.h; y++) {
      for (var x = 0; x < ph.w; x++) {
        var i = y * ph.w + x;
        if (!ph.region[i] || isCalf(ph, i)) continue;
        img.values[i] = NaN;
        var edge = x === 0 || y === 0 || x === ph.w - 1 || y === ph.h - 1 ||
          !ph.region[i - 1] || !ph.region[i + 1] || !ph.region[i - ph.w] || !ph.region[i + ph.w];
        if (edge) ov[i] = 2;
      }
    }
    return ov;
  }

  // Density change: grey out regions whose change is below NOISE_MULTIPLE x the expected
  // noise of a region mean, momentumSpread * sqrt(2 / (tracks * cell^2 * n)) * sqrt(2).
  function noiseMask(diff, ph, tracks) {
    var n = {}, i, ov = new Uint8Array(ph.w * ph.h);
    for (i = 0; i < ph.region.length; i++) if (ph.region[i]) n[ph.region[i]] = (n[ph.region[i]] || 0) + 1;
    for (i = 0; i < ph.region.length; i++) {
      var r = ph.region[i];
      if (!r) continue;
      var noisePct = MOMENTUM_SPREAD * Math.sqrt(2 / (tracks * ph.cellCm * ph.cellCm * n[r])) * Math.SQRT2 * 100;
      if (!(Math.abs(diff.values[i]) >= NOISE_MULTIPLE * noisePct)) ov[i] = 1;
    }
    return ov;
  }

  function renderImage() {
    var r = rec(), i = idx(), w = words();
    var canvas = $('body-canvas'), empty = $('canvas-empty'), bar = $('colorbar');
    var trackers = hasTrackers() && !isHome();
    var densityBtn = document.querySelector('[data-layer="density"]');
    densityBtn.hidden = isHome();
    densityBtn.disabled = !trackers;
    densityBtn.title = trackers ? '' : 'No particle trackers at this bed';
    if (!trackers && state.layer === 'density') state.layer = 'pressure';
    pressed('[data-layer]', 'layer', state.layer);
    pressed('[data-view]', 'view', state.view);
    $('cap-exp').hidden = state.layer !== 'density' || r.missionDay < 0;
    $('img-legend').hidden = true;
    $('img-legend-mask').hidden = true;
    $('img-legend-outline').hidden = true;

    if (r.missionDay < 0) {
      canvas.hidden = true;
      empty.hidden = false;
      empty.textContent = w.noImage;
      clear(bar);
      $('cap-label').textContent = 'No image on baseline nights.';
      $('cap-extra').textContent = '';
      return;
    }

    var shown, ph, cmap, label, unit, extra = [], overlay = null;
    if (state.view === 'diff') {
      var nights = surfaceWindow(i);
      var now = accumulated(state.layer, nights, i + 1);
      ph = now.ph;
      shown = imaging.difference(now.img, referenceImage(state.layer), ph);
      if (state.layer === 'impedance') overlay = impedanceOverlay(shown, ph);
      if (state.layer === 'density') overlay = noiseMask(shown, ph, now.tracks);
      var m = DIFF_MIN_RANGE;
      for (var k = 0; k < shown.values.length; k++) { var v = shown.values[k]; if (v === v && Math.abs(v) > m) m = Math.ceil(Math.abs(v)); }
      shown.min = -m; shown.max = m;
      cmap = 'diverging'; unit = '%';
      label = w.diff + ': ' + state.layer + ', last ' + nights.length + (nights.length === 1 ? ' night' : ' nights') +
        ' accumulated, compared with the first ' + WINDOW + ' nights, averaged per body region';
      if (state.layer === 'density') {
        extra.push('Regions whose change is smaller than twice their expected noise are grey.');
        $('img-legend-mask').hidden = false;
      }
    } else {
      ph = phantomFor(r._truth.muscleChangePct);
      if (state.layer === 'density') {
        shown = imaging.render('density', ph, { tracksPerCm2: r._truth.tracksPerCm2, seed: i + 1 });
        shown.min = 0;                               // negative values are noise
        cmap = 'gray'; unit = 'radiation lengths (x/X0)';
        extra.push('Incident particles tonight: ' + Math.round(r._truth.tracksPerCm2).toLocaleString('en-US') + ' per cm² (assumed free-space intensity, ' +
          (state.sh < 1 ? 'after assumed shielding' : 'no habitat shielding') + ').');
        extra.push('Noise model: counting noise x ' + MOMENTUM_SPREAD + ' for the unknown momentum of each particle (assumption).');
      } else if (state.layer === 'pressure') {
        shown = imaging.render('pressure', ph, { env: r.env });
        shown.min = 0;
        cmap = 'heat'; unit = shown.unit;
        if (shown.massKg) extra.push('Body mass derived from the pressure map: ' + shown.massKg.toFixed(1) + ' kg.');
      } else {
        shown = imaging.render('impedance', ph, { eimPhaseDeg: r.eim ? r.eim.phase50_deg : NaN, baselinePhaseDeg: data.base.eim.median });
        overlay = impedanceOverlay(shown, ph);
        // Fixed scale around the baseline so a falling calf reading shows as a colour change.
        shown.min = data.base.eim.median * 0.75;
        shown.max = data.base.eim.median * 1.05;
        cmap = 'heat'; unit = shown.unit;
        if (!r.eim) extra.push('No usable calf scan tonight.');
      }
      label = state.layer === 'pressure' ? 'Pressure under the sleeper (simulated)' : shown.label;
    }
    if (state.layer === 'impedance') {
      extra.unshift('Only the calves are measured; the outline shows regions that are not measured.');
      $('img-legend-outline').hidden = false;
    }
    $('img-legend').hidden = $('img-legend-mask').hidden && $('img-legend-outline').hidden;

    canvas.hidden = false;
    empty.hidden = true;
    charts.image(canvas, shown, { colormap: cmap, scale: 4, nanColor: [0, 0, 0, 0], overlay: overlay, overlayColors: { 1: MASK_RGBA, 2: OUTLINE_RGBA } });
    canvas.setAttribute('aria-label', label + ', ' + dayLabel(r));
    charts.colorbar(bar, { min: shown.min, max: shown.max, unit: unit, colormap: cmap });
    $('cap-label').textContent = scrub(label) + '.';
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
  function judgedSeries(cardId) {
    var k = CARD_IDS.indexOf(cardId);
    return data.assessments.map(function (a) { return { missionDay: a.missionDay, value: a.cards[k].value }; });
  }
  function band(b) { return b && b.median != null ? { median: b.median, low: b.median - 2 * b.sd, high: b.median + 2 * b.sd } : null; }

  function startMarkers() {
    var sc = data.gen.scenario, w = words();
    var label = sc.transitDays > 0 ? 'Arrival after a ' + sc.transitDays + '-day transit (not monitored)' : w.start;
    var shortLabel = sc.transitDays > 0 ? 'Arrival (transit not monitored)' : null;
    return [{ missionDay: 0, label: label, shortLabel: shortLabel }].concat(sc.events.map(function (e) { return { missionDay: e.from, label: e.label }; }));
  }

  function trendSpec(cardId) {
    var recs = data.gen.records, b = chartBaseline(), w = words(), c = card(cardId), x = c.extra || {};
    var o = {
      statusAt: statusAtFor(cardId), selectedDay: state.d, thresholds: [], markers: startMarkers(),
      series: judgedSeries(cardId), xTitle: w.day,
      axisBreak: data.gen.scenario.transitDays > 0 ? 0 : null
    };
    var legend = [['dot', 'Nightly reading']];
    var note = '';
    if (cardId === 'muscle') {
      var me = muscleExtra(), med = b.eim.median, plan = data.gen.plan.expectedChangePct;
      var ok = med != null && me && me.amberLimitPct != null;
      o.raw = engine.series(recs, 'eim');
      o.baseline = band(b.eim);
      // Bottom of the plan band exactly as the engine judges amber.
      o.expected = !ok ? null : recs.map(function (r, i) {
        return { missionDay: r.missionDay, low: med * (1 + (plan[i] - me.amberLimitPct) / 100), high: med * (1 + plan[i] / 100) };
      }).filter(function (p) { return p.missionDay >= 0; });
      o.thresholds = !ok ? [] : [{ value: med * (1 - me.redLimitPct / 100), label: 'Report line: ' + me.redLimitPct.toFixed(1) + '% below baseline', status: 'red' }];
      o.exercise = recs.filter(function (r) { return r.missionDay >= 0; }).map(function (r) { return { missionDay: r.missionDay, done: !!r.log.exercise_done }; });
      o.unit = 'deg'; o.yLabel = 'Calf phase';
      legend.push(['line', WINDOW + '-night median'], ['band', 'Own baseline range'], ['plan', w.plan + ' (amber below this band)'],
        ['report', 'Report line'], ['event', 'Event'], ['exercise', 'Exercise done (tall) or missed (short)'], ['selected', 'Selected night']);
      note = 'Dots are the nightly calf impedance readings; the line is the ' + WINDOW + '-night median the card uses. ' +
        'The report line applies to the ' + WINDOW + '-night median. It is a measurement-variability limit (the largest test-retest variability reported for this measurement), not a strength threshold.';
    } else if (cardId === 'sleep') {
      o.raw = engine.series(recs, 'sleep');
      o.thresholds = [
        { value: x.amberHours, label: 'Watch line: ' + x.amberHours + ' h', status: 'amber' },
        { value: x.redHours, label: 'Report line: ' + x.redHours + ' h', status: 'red' }
      ];
      o.unit = 'h'; o.yLabel = 'Sleep';
      legend.push(['line', WINDOW + '-night mean'], ['watch', 'Watch line'], ['report', 'Report line'], ['event', 'Event'], ['selected', 'Selected night']);
      note = 'Dots are the hours asleep each night; the line is the ' + WINDOW + '-night mean the card uses. ' +
        'Hours asleep from radar is an assumption; the 7-hour line is the recommendation for adults aged 18 to 60.';
    } else if (cardId === 'cardio') {
      o.raw = engine.series(recs, 'hr');
      o.baseline = band(b.hr);
      var hrLim = x.hrLimit != null ? x.hrLimit : (b.hr.median != null ? b.hr.median + T.cardioSdMultiple.value * b.hr.sd : null);
      if (hrLim != null) o.thresholds = [{ value: hrLim, label: 'Watch line: baseline + ' + T.cardioSdMultiple.value + ' SD', status: 'amber' }];
      o.unit = 'bpm'; o.yLabel = 'Night heart rate';
      legend.push(['line', T.cardioNights.value + '-night median'], ['band', 'Own baseline range'], ['watch', 'Watch line'], ['event', 'Event'], ['selected', 'Selected night']);
      note = 'Dots are the nightly heart rates; the line is the ' + T.cardioNights.value + '-night median the card uses. Breathing rate is judged the same way' +
        (x.rr != null ? ': ' + x.rr.toFixed(1) + ' per minute' : '') + (x.rrLimit != null ? ', watch line ' + x.rrLimit.toFixed(1) + ' per minute.' : '.') +
        ' This card has no report tier: a raised reading is a reason to check for illness.';
    } else {
      o.raw = engine.series(recs, 'dose');
      if (x.usualUGy != null) {
        o.thresholds = [
          { value: x.usualUGy * T.radiationAmberRatio.value, label: 'Watch line: ' + T.radiationAmberRatio.value + 'x usual', status: 'amber' },
          { value: x.usualUGy * T.radiationRedRatio.value, label: 'Report line: ' + T.radiationRedRatio.value + 'x usual', status: 'red' }
        ];
      }
      o.unit = 'µGy'; o.yLabel = 'Dose per night';
      legend.push(['line', 'Dose the card judges']);
      if (x.usualUGy != null) legend.push(['watch', 'Watch line'], ['report', 'Report line']);
      legend.push(['event', 'Event'], ['selected', 'Selected night']);
      note = x.usualUGy != null ? 'Absorbed dose in silicon over each sleep period. Usual level before tonight: ' + Math.round(x.usualUGy) +
        ' µGy (median of up to ' + T.radiationHistoryNights.value + ' earlier nights). The brief is read the morning after: real-time warnings come from space-weather alerts and the flight rules.' :
        'Not enough earlier nights to set a usual level, so no lines are drawn.';
    }
    if (o.axisBreak != null) legend.push(['break', 'Break: the transit is not monitored']);
    return { opts: o, legend: legend, note: note };
  }

  function renderLegend(items) {
    var ul = $('trend-legend');
    clear(ul);
    items.forEach(function (it) {
      var li = el('li');
      var k = el('span', 'key key-' + it[0]);
      k.setAttribute('aria-hidden', 'true');
      li.appendChild(k);
      li.appendChild(document.createTextNode(it[1]));
      ul.appendChild(li);
    });
  }

  function renderTrend() {
    var cardId = state.card, t = trendSpec(cardId);
    $('trend-card').textContent = CARD_NAMES[cardId];
    charts.line($('trend-chart'), t.opts);
    renderLegend(t.legend);
    $('trend-note').textContent = scrub(t.note);

    var p = cardId === 'muscle' ? engine.project(data.gen.records, idx()) : null;
    var proj = $('projection');
    if (p && Math.round(p.slopePctPerWeek * 10) === 0) p = null;
    proj.hidden = !p;
    proj.textContent = p ? 'Weekly trend: ' + fmtPct(p.slopePctPerWeek) + ' per week. At this rate the weekly median reaches the Report line ' +
      (p.daysToRed <= 7 ? 'within about a week' : 'in about ' + p.daysToRed + ' days') + '; the nightly check can change sooner.' : '';

    var r = rec(), roseFig = $('rose-fig');
    var showRose = cardId === 'radiation' && r.rad && r.rad.dir;
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
      $('rose-reading').textContent = 'Most particles arrive from sector ' + k + '.';
      $('rose-span').textContent = ' (' + nights + (nights === 1 ? ' night' : ' nights') + ' with tracker data up to tonight)';
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
    return a;
  }

  function claimOf(id) {
    try { return evidence.get(id).claim; } catch (e) { return ''; }
  }

  function renderGuidance() {
    var c = card(state.card);
    var wd = rules.WORDING[state.mode];
    $('guidance-card').textContent = CARD_NAMES[state.card];
    var st = $('g-status');
    clear(st);
    var wrap = el('span', 'status st-' + c.status);
    wrap.appendChild(charts.statusIconEl(c.status, 16));
    wrap.appendChild(el('span', 'status-word', charts.STATUS[c.status].word));
    st.appendChild(wrap);
    st.appendChild(el('span', 'g-reason', ' ' + scrub(c.reason)));
    var meaning = scrub(c.meaning);
    if (state.card === 'sleep') meaning += ' Hours asleep from radar is an assumption; the 7-hour line is the recommendation for adults aged 18 to 60.';
    $('g-meaning').textContent = meaning;
    var ul = $('g-actions');
    clear(ul);
    c.actions.forEach(function (x) { ul.appendChild(el('li', null, scrub(x))); });
    $('g-decides').textContent = capital(c.decides);

    // NASA risk for this check; at home, the one deliberate mention of spaceflight (V47), not scrubbed.
    var ctx = $('g-context');
    clear(ctx);
    if (isHome()) {
      $('g-context-title').textContent = 'Why a spaceflight tool applies at home';
      ctx.appendChild(document.createTextNode('The Canadian Space Agency describes the changes seen in astronauts as similar to accelerated ageing and to a sedentary lifestyle. '));
      ctx.appendChild(sourceLink('V47'));
    } else {
      var cx = rules.CONTEXT[state.card];
      $('g-context-title').textContent = 'NASA risk this check relates to';
      ctx.appendChild(el('strong', null, cx.risk));
      ctx.appendChild(document.createTextNode('. ' + cx.note));
      cx.sourceIds.forEach(function (id) { ctx.appendChild(document.createTextNode(' ')); ctx.appendChild(sourceLink(id)); });
    }

    var src = $('g-sources');
    clear(src);
    if (!c.sourceIds.length) src.appendChild(el('li', 'muted', 'Interim assumption; see the assumptions list in the evidence drawer.'));
    c.sourceIds.forEach(function (id) {
      var li = el('li');
      li.appendChild(sourceLink(id));
      var claim = claimOf(id);
      // At home a claim about spaceflight would read out of place; the link still opens it.
      if (claim && !(isHome() && HOME_BANNED.test(claim))) li.appendChild(document.createTextNode(' ' + claim));
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
        var note = isHome() && x.sourceIds.indexOf('V41') >= 0 ? 'Under study. Discuss with the ' + wd.clinician + '.' :
          x.note.replace(/the flight surgeon/g, 'the ' + wd.clinician);
        li.appendChild(el('span', 'cm-note', note + ' '));
        x.sourceIds.forEach(function (id) { li.appendChild(sourceLink(id)); });
        cm.appendChild(li);
      });
    }
    $('g-disclaimer').textContent = rules.DISCLAIMER.replace(/\{(\w+)\}/g, function (_, k) { return wd[k] || k; });
  }

  // ---- render: five hazards (astronaut mode only) --------------------------------------
  var COVERAGE_MARK = { covered: '\u25CF', partly: '\u25D0', 'not covered': '\u25CB' };
  var COVERAGE_CHIP = { covered: 'chip chip-supported', partly: 'chip chip-under-study', 'not covered': 'chip' };
  function renderHazards() {
    $('hazards').hidden = isHome();
    var ul = $('hazard-list');
    clear(ul);
    rules.HAZARDS.forEach(function (h) {
      var li = el('li');
      li.appendChild(el('span', 'cm-name', h.name));
      var chip = el('span', COVERAGE_CHIP[h.coverage]);
      var mark = el('span', null, COVERAGE_MARK[h.coverage] + ' ');
      mark.setAttribute('aria-hidden', 'true');
      chip.appendChild(mark);
      chip.appendChild(document.createTextNode(h.coverage));
      li.appendChild(chip);
      li.appendChild(el('span', 'cm-note', h.text));
      ul.appendChild(li);
    });
    var src = $('hazard-source');
    clear(src);
    src.appendChild(document.createTextNode('Source: '));
    src.appendChild(sourceLink('V43'));
  }

  // ---- render: what-if -------------------------------------------------------------
  function renderWhatIf() {
    var ex = $('adherence'), gs = $('shape'), sh = $('shield'), nz = $('noise');
    [ex, gs, sh, nz, $('whatif-reset')].forEach(function (n) { n.disabled = false; });
    ex.value = String(state.ex == null ? 1 : state.ex);
    gs.value = String(state.gs);
    sh.value = String(state.sh);
    nz.value = String(state.nz);
    $('adherence-out').textContent = state.ex == null ? 'As planned' : Math.round(state.ex * 100) + '%';
    $('shape-out').textContent = state.gs === 1 ? '1 (linear)' : String(state.gs);
    $('shield-out').textContent = state.sh.toFixed(1);
    $('noise-out').textContent = Math.round(state.nz * 100) + '%' + (state.nz === WHATIF.nz.def ? ' (assumed)' : '');
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
      if (!has(groups, it.topic)) { groups[it.topic] = []; order.push(it.topic); }
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
    $('evidence-count').textContent = evidence.items.length + ' sources; every assumption is listed below';
  }

  function openEvidence(id) {
    Array.prototype.forEach.call(document.querySelectorAll('.ev-target'), function (n) { n.classList.remove('ev-target'); });
    var target = $('ev-' + id);
    if (!target) return;
    target.closest('details').open = true;
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
    renderHazards();
    renderWhatIf();
  }

  // Render a state from a link; on any error fall back to the default view with a notice.
  function renderFromLink(hash) {
    state = parseHash(hash);
    try {
      render();
      $('notice').hidden = true;
    } catch (e) {
      state = parseHash('');
      data.key = null;
      render();
      $('notice').hidden = false;
    }
    writeHash();
  }

  function update(changes) {
    Object.keys(changes || {}).forEach(function (k) { state[k] = changes[k]; });
    if (!has(changes || {}, 'ev')) state.ev = null;
    $('notice').hidden = true;
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
      else if (b.id === 'whatif-reset') update({ ex: WHATIF.ex.def, gs: WHATIF.gs.def, sh: WHATIF.sh.def, nz: WHATIF.nz.def });
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
    $('noise').addEventListener('input', function (e) { update({ nz: snap(e.target.value, WHATIF.nz) }); });
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
      renderFromLink(location.hash);
      if (state.ev) openEvidence(state.ev);
    });
  }

  // ---- start -----------------------------------------------------------------------
  buildEvidence();
  wire();
  renderFromLink(location.hash.indexOf('=') >= 0 ? location.hash : '');
  if (state.ev) openEvidence(state.ev);
})(typeof globalThis !== 'undefined' ? globalThis : this);
