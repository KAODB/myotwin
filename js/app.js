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

  // ---- view state: address and per-scenario memory -------------------------------
  // Pure helpers; they read only `sim` and `has`. test/address.test.js runs this block in Node
  // (from this marker to the matching "end" marker below), so keep it free of the DOM.
  // BEGIN view-state helpers
  var CARD_IDS = ['muscle', 'sleep', 'cardio', 'radiation'];
  var LAYERS = ['density', 'pressure', 'impedance'];
  var VIEWS = ['raw', 'diff'];
  var OLD_MODES = ['astronaut', 'eldercare'];         // a `mode` value from older links, accepted and ignored
  var WHATIF = {
    ex: { min: 0, max: 1, step: 0.05, def: null },   // null = the scenario's own plan
    gs: { min: 0.25, max: 4, step: 0.25, def: 1 },
    sh: { min: 0.6, max: 1, step: 0.1, def: 1 },
    nz: { min: 0.01, max: 0.08, step: 0.01, def: sim.NOISE.eimPhaseSdFraction.value }
  };

  function defaultDay(s) { return s === 'S2' ? 42 : null; }          // null = last night

  function snap(v, o) {
    var n = parseFloat(v);
    if (!isFinite(n) || n < o.min - 1e-9 || n > o.max + 1e-9) return o.def;
    return Math.round((Math.round((n - o.min) / o.step) * o.step + o.min) * 100) / 100;
  }
  function pick(v, list, def) { return list.indexOf(v) >= 0 ? v : def; }

  // Parse a view from the address. Any value that is unknown, repeated, rejected or changed sets
  // `rejected`, so the page can say that the link could not be opened as written. A valid `mode`
  // from an older link is accepted and ignored. An unknown scenario opens the default view.
  var HASH_KEYS = ['s', 'd', 'layer', 'view', 'mode', 'card', 'ex', 'gs', 'sh', 'nz', 'ev'];
  function parseHash(hash) {
    var q = Object.create(null), bad = false;
    hash.replace(/^#/, '').split('&').forEach(function (kv) {
      if (!kv) return;
      var i = kv.indexOf('='), k = kv.slice(0, i);
      if (i <= 0 || HASH_KEYS.indexOf(k) < 0 || k in q) { bad = true; return; }
      try { q[k] = decodeURIComponent(kv.slice(i + 1)); } catch (e) { bad = true; }
    });
    function check(k, v) { if (k in q && v !== q[k]) bad = true; return v; }
    function checkNum(k, v) { if (k in q && !(v != null && Math.abs(v - parseFloat(q[k])) < 1e-6)) bad = true; return v; }
    if ('s' in q && !has(sim.SCENARIOS, q.s)) { var def = parseHash(''); def.rejected = true; return def; }
    var s = has(sim.SCENARIOS, q.s) ? q.s : 'S2';
    var d = /^-?\d+$/.test(q.d || '') ? parseInt(q.d, 10) : defaultDay(s);
    if ('d' in q && String(d) !== q.d) bad = true;
    if ('mode' in q && OLD_MODES.indexOf(q.mode) < 0) bad = true;
    var st = {
      s: s, d: d,
      layer: check('layer', pick(q.layer, LAYERS, 'density')),
      view: check('view', pick(q.view, VIEWS, 'raw')),
      card: check('card', pick(q.card, CARD_IDS, 'muscle')),
      ex: checkNum('ex', snap(q.ex, WHATIF.ex)), gs: checkNum('gs', snap(q.gs, WHATIF.gs)),
      sh: checkNum('sh', snap(q.sh, WHATIF.sh)), nz: checkNum('nz', snap(q.nz, WHATIF.nz)),
      ev: check('ev', /^V\d+$/.test(q.ev || '') ? q.ev : null)
    };
    st.rejected = bad;
    return st;
  }

  function hashFor(st) {
    var parts = ['s=' + st.s, 'd=' + st.d, 'layer=' + st.layer, 'view=' + st.view, 'card=' + st.card];
    Object.keys(WHATIF).forEach(function (k) {
      if (st[k] !== WHATIF[k].def && st[k] != null) parts.push(k + '=' + st[k]);
    });
    if (st.ev) parts.push('ev=' + st.ev);
    return '#' + parts.join('&');
  }

  // Each scenario keeps its own night, layer and view for the page session (memory only; the
  // address stays the source of truth on load and for sharing). Records the current scenario's
  // values in `memory` and returns the changes that open scenario `s`.
  function scenarioChanges(memory, st, s) {
    memory[st.s] = { d: st.d, layer: st.layer, view: st.view };
    var m = has(memory, s) ? memory[s] : { d: defaultDay(s), layer: 'density', view: 'raw' };
    return { s: s, d: m.d, layer: m.layer, view: m.view };
  }
  // END view-state helpers

  // ---- presentation helpers --------------------------------------------------------
  // Pure helpers with no DOM; test/presentation.test.js runs this block in Node (from this marker
  // to the matching "end" marker below).
  // BEGIN presentation helpers
  var NUMBER_WORDS = ['No', 'One', 'Two', 'Three', 'Four'];
  function numberWord(s) { return s.replace(/^(\d)\b/, function (d) { return NUMBER_WORDS[+d] || d; }); }

  // The engine's headline set for the plate. When its first sentence has a colon, the part before
  // the colon is the lead line and the part after it the emphasised line (capitalised); any later
  // sentence follows as `more`. A leading digit becomes a word ("1 check" -> "One check").
  // Otherwise the headline is one line: { whole }. `size` sorts the emphasised line by length so
  // the page can set a long one smaller: 'l' up to 7 characters ("Muscle."), 'm' up to 12 ("Radiation."), else 's'.
  function splitHeadline(text) {
    var s = String(text == null ? '' : text).trim();
    var cut = s.search(/\.\s/);
    var first = cut >= 0 ? s.slice(0, cut + 1) : s, rest = cut >= 0 ? s.slice(cut + 2).trim() : '';
    var c = first.indexOf(':');
    if (c <= 0) return { whole: s };
    var em = first.slice(c + 1).trim();
    em = em.charAt(0).toUpperCase() + em.slice(1);
    return { lead: numberWord(first.slice(0, c).trim()), em: em, more: numberWord(rest), size: em.length <= 7 ? 'l' : em.length <= 12 ? 'm' : 's' };
  }

  // Centre of a phantom region in body centimetres across (patient's left positive), or 0.
  function regionCentreXCm(ph, name) {
    var k = ph.REGIONS.indexOf(name), sx = 0, n = 0;
    for (var i = 0; i < ph.region.length; i++) if (ph.region[i] === k) { sx += i % ph.w; n++; }
    return n ? (sx / n + 0.5) * ph.cellCm - ph.w * ph.cellCm / 2 : 0;
  }

  // Where each check's hotspot sits on the body, [x cm from the midline, y cm from the top of the
  // head], from the phantom's own extents (`A` is phantom.ASSUMPTIONS): sleep at the centre of the
  // head, heart and breathing on the first quarter of the torso, radiation (a whole-body check) at
  // the centre of the pelvis, muscle at the centre of the left calf.
  function hotspotCm(A, ph) {
    var ext = function (n) { return A.filter(function (a) { return a.name === n + 'Extent'; })[0].value; };
    var head = ext('head'), torso = ext('torso'), pelvis = ext('pelvis'), calf = ext('calf');
    return {
      sleep: [0, (head[0] + head[1]) / 2],
      cardio: [0, torso[0] + (torso[1] - torso[0]) / 4],
      radiation: [0, (pelvis[0] + pelvis[1]) / 2],
      muscle: [regionCentreXCm(ph, 'calf_L'), (calf[0] + calf[1]) / 2]
    };
  }

  // The first sentence of a text (up to the first full stop followed by a space).
  function firstSentence(s) {
    var t = String(s || ''), i = t.search(/\.\s/);
    return i >= 0 ? t.slice(0, i + 1) : t;
  }
  // END presentation helpers

  // ---- constants -----------------------------------------------------------------
  var CARD_NAMES = { muscle: 'Muscle', sleep: 'Sleep', cardio: 'Heart and breathing', radiation: 'Radiation' };
  var ENV_NAMES = { moon: 'Moon', mars: 'Mars' };
  var PLATE_FILL = 0.78;                           // share of the plate height the body takes
  // Cosmic-ray tracks across the plate: [x at the top, x at the bottom], as fractions of its width.
  var TRACKS = [[0.20, 0.40], [0.55, 0.44], [0.70, 0.86], [0.92, 0.63], [0.07, 0.26]];
  var WINDOW = T.windowNights.value;               // arrival week and accumulation window
  var REF_SEED = 7;                                // fixed seed for the arrival-week density image
  var DIFF_MIN_RANGE = 10;                         // change view: colour scale at least +/-10 %
  var NOISE_MULTIPLE = 2;                          // change view: grey out regions below 2 x expected noise
  var THIGH_RATIO = evidence.value('V4', 'thighControlPct') / evidence.value('V4', 'calfControlPct');
  var MOMENTUM_SPREAD = imaging.ASSUMPTIONS.filter(function (a) { return a.name === 'momentumSpreadFactor'; })[0].value;
  var reducedMotion = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- state -----------------------------------------------------------------------
  var state = {};
  var data = { key: null, gen: null, dayIndex: {}, base: null, ref: {}, assessments: [] };
  var playTimer = null;
  var scenarioMemory = {};                         // per-scenario night, layer and view (scenarioChanges)

  function writeHash() {
    var h = hashFor(state);
    if (location.hash === h) return;
    try { history.replaceState(null, '', h); } catch (e) { /* history API unavailable: keep the old hash */ }
  }

  // ---- data ------------------------------------------------------------------------
  // Returns true when a value in the state had to be changed to fit the scenario.
  function ensureData() {
    var changed = false;
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
      var recs = data.gen.records, plan = data.gen.plan.expectedChangePct;
      data.assessments = recs.map(function (r, i) {
        return engine.assess(recs, i, { expectedChangePct: plan });
      });
    }
    var recs2 = data.gen.records;
    if (state.d == null || data.dayIndex[state.d] === undefined) {
      if (state.d != null) changed = true;
      var def = defaultDay(state.s);
      state.d = def != null && data.dayIndex[def] !== undefined ? def : recs2[recs2.length - 1].missionDay;
    }
    return changed;
  }

  function idx() { return data.dayIndex[state.d]; }
  function rec() { return data.gen.records[idx()]; }
  function assessment() { return data.assessments[idx()]; }
  function card(id) { return assessment().cards[CARD_IDS.indexOf(id)]; }

  // Engine and rules text with doses and ratios in the cards' own units and rounding.
  function scrub(s) {
    return String(s).replace(/(\d+(?:\.\d+)?) (?:uGy|µGy)/g, function (_, n) { return fmtDose(parseFloat(n)); })
      .replace(/(\d+(?:\.\d+)?)x the usual/g, function (_, n) { return fmtRatio(parseFloat(n)) + ' the usual'; })
      .replace(/expects a drop of about -?0\.0% at this point/g, 'expects no change at this point');
  }

  // ---- formatting ------------------------------------------------------------------
  var DECIMALS = { deg: 2, h: 1, bpm: 0, uGy: 0 };
  function unitLabel(u) { return u === 'uGy' ? 'µGy' : u; }
  function fmtValue(v, unit) {
    if (v == null || !isFinite(v)) return '\u2013';
    return v.toLocaleString('en-US', { minimumFractionDigits: DECIMALS[unit] || 0, maximumFractionDigits: DECIMALS[unit] || 0 });
  }
  function fmtPct(p) {
    if (p == null || !isFinite(p)) return '\u2013';
    var r = Math.round(p * 10) / 10;
    var sign = r > 0 ? '+' : r < 0 ? '−' : '';
    return sign + Math.abs(r).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
  }
  // One unit and one rounding per number, in the cards and in the engine's reason text alike.
  function fmtRatio(x) { return (x >= 100 ? Math.round(x) : x.toFixed(1)) + 'x'; }
  var doseParts = charts.doseParts;
  function fmtDose(uGy) { return doseParts(uGy).join(' '); }
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
  // "Night 42", or "Baseline night 3" for the third of the pre-departure nights.
  function dayLabel(r) {
    return r.missionDay < 0 ? 'Baseline night ' + (r.missionDay + data.gen.scenario.baselineNights + 1) : 'Night ' + r.missionDay;
  }
  // The 7-hour line is the low end of the range in a NASA technical brief (V79).
  function sleepLineNote() {
    return 'Hours asleep from radar is an assumption; the ' + T.sleepAmberHours.value + '-hour line is the low end of the ' +
      evidence.value('V79', 'adultSleepHoursLow') + ' to ' + evidence.value('V79', 'adultSleepHoursHigh') + ' hours ' +
      'a NASA brief says an average adult needs.';
  }

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
    // Evidence links written in index.html (data-ev) carry the current view, as every other one.
    Array.prototype.forEach.call(document.querySelectorAll('a[data-ev]'), function (a) { a.href = evidenceHref(a.dataset.ev); });
  }

  function pressed(selector, attr, value) {
    Array.prototype.forEach.call(document.querySelectorAll(selector), function (b) {
      b.setAttribute('aria-pressed', String(b.dataset[attr] === value));
    });
  }

  function isFlag(s) { return s === 'amber' || s === 'red'; }

  // ---- render: brief (headline + margin notes) -------------------------------------
  function renderBrief() {
    var a = assessment(), r = rec(), env = data.gen.scenario.env;
    $('brief-date').textContent = ' · ' + (r.missionDay < 0 ? 'Earth, ' + dayLabel(r).toLowerCase() : ENV_NAMES[env] + ', ' + dayLabel(r).toLowerCase());
    renderHeadline(scrub(a.headline));
    // The accent colour is reserved for attention: the headline carries it only when a check is on Watch or Report.
    $('headline').classList.toggle('headline-attn', a.cards.some(function (c) { return isFlag(c.status); }));
    var summary = data.gen.scenario.summary;
    $('scenario-summary').textContent = firstSentence(summary);
    $('scenario-more').textContent = summary.slice(firstSentence(summary).length).trim();
    a.cards.forEach(renderCard);
  }

  // The headline as a lead line and an emphasised line (or one line); the whole sentence stays the
  // text a screen reader announces.
  function renderHeadline(text) {
    var h = $('headline'), p = splitHeadline(text);
    if (h.dataset.text === text) return;
    h.dataset.text = text;
    clear(h);
    h.className = 'headline ' + (p.whole ? 'headline-one' + (p.whole.length > 48 ? ' headline-long' : '') : 'headline-split em-' + p.size);
    if (p.whole) { h.textContent = p.whole; return; }
    h.appendChild(el('span', 'lead', p.lead));
    h.appendChild(el('em', null, p.em));
    if (p.more) h.appendChild(el('span', 'more', p.more));
  }

  function changeVsBaseline(c) {
    var b = c.id === 'sleep' ? data.base.sleep : c.id === 'cardio' ? data.base.hr : null;
    if (rec().missionDay < 0) b = c.id === 'sleep' ? chartBaseline().sleep : chartBaseline().hr;
    return b && b.median && c.value != null ? (c.value - b.median) / b.median * 100 : null;
  }

  // The words of one margin note: the value, its unit and qualifier, and for a check on Watch or
  // Report one more line of plain explanation.
  function noteLines(c) {
    var grey = c.status === 'grey', flag = isFlag(c.status), x = c.extra || {};
    var sub = flag ? firstSentence(scrub(c.meaning)) : '';
    if (c.id === 'muscle') {
      var exp = c.expectedDeltaPct;
      if (flag && exp != null) sub = 'The mission plan expected ' + (Math.round(exp * 10) === 0 ? 'no change' : fmtPct(exp)) + ' by now.';
      return { num: grey ? '–' : fmtPct(c.deltaPct), unit: 'vs your own baseline', sub: sub };
    }
    if (c.id === 'radiation') {
      var dose = c.value != null && isFinite(c.value) ? doseParts(c.value) : ['–', 'µGy'];
      var measured = !!(rec().rad && rec().rad.measured);
      if (flag && x.ratio != null) sub = 'Tonight was ' + fmtRatio(Math.round(x.ratio * 10) / 10) + ' the usual level.';
      return { num: dose[0], unit: dose[1] + (measured ? ', measured by NASA' : ''), sub: sub };
    }
    return { num: fmtValue(c.value, c.unit), unit: c.id === 'sleep' ? 'h asleep' : unitLabel(c.unit), sub: sub };
  }

  // Restart the short cross-fade on a value that changed (not while the mission plays).
  function swapText(node, text) {
    if (node.textContent === text) return;
    node.textContent = text;
    if (reducedMotion || playTimer) return;
    node.classList.remove('swap');
    void node.offsetWidth;
    node.classList.add('swap');
  }

  function setStatus(node, status) {
    node.querySelector('.st-icon use').setAttribute('href', charts.statusIcon(status));
    node.querySelector('.status-word').textContent = charts.STATUS[status].word;
  }

  function renderCard(c) {
    var btn = document.querySelector('.card[data-card="' + c.id + '"]');
    if (!btn) return;
    btn.className = 'card st-' + c.status + (btn.classList.contains('is-hot') ? ' is-hot' : '');
    btn.setAttribute('aria-pressed', String(state.card === c.id));
    setStatus(btn, c.status);
    var L = noteLines(c);
    swapText(btn.querySelector('.num'), L.num);
    btn.querySelector('.unit').textContent = L.unit;
    var sub = btn.querySelector('.card-sub');
    sub.textContent = L.sub;
    sub.hidden = !L.sub;
    var tab = document.querySelector('.tab[data-card="' + c.id + '"]');
    tab.className = 'tab st-' + c.status;
    tab.setAttribute('aria-pressed', String(state.card === c.id));
    setStatus(tab, c.status);
    if (c.id === 'radiation') renderRadSource();
  }

  // ---- radiation card: where tonight's number comes from (data/*.js, replayed) --------
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function longDate(iso) {
    var p = iso.split('-');
    return Number(p[2]) + ' ' + MONTHS[Number(p[1]) - 1] + ' ' + p[0];
  }
  function measuredDataset() { return data.gen.scenario.rad ? data.gen.scenario.rad.dataset : null; }
  function doseMedium() { return measuredDataset() === 'msl-rad' ? 'in silicon' : 'water-corrected'; }

  function renderRadSource() {
    var r = rec(), m = r.rad && r.rad.measured, box = $('rad-source');
    var show = !!m && state.card === 'radiation';     // under the radiation figures in Plate II
    box.hidden = !show;
    if (!show) return;
    var p = $('rad-measured');
    clear(p);
    p.appendChild(el('strong', null, 'Radiation tonight: '));
    var txt, ev;
    if (m.dataset === 'msl-rad') {
      txt = 'Measured by Curiosity\'s RAD on sol ' + m.sol + ' (' + longDate(m.date) + ') and replayed for this night. ' +
        'It is dose in silicon on the open surface of Mars, not inside a habitat; using a 2012 sol for this night is an assumption.';
      ev = 'V60';
    } else {
      txt = 'Measured in lunar orbit by LRO CRaTER (detector pair ' + m.pair + ') on the night of ' + longDate(m.date) +
        ', scaled to the surface by the instrument team, and replayed for this night. It is a detector on an orbiter, ' +
        'not a habitat: behind thick habitat shielding a crew would receive much less from a solar particle event. ' +
        'Using a 2017 night for this night is an assumption.';
      ev = 'V61';
    }
    p.appendChild(document.createTextNode(txt + ' '));
    p.appendChild(sourceLink(ev));

    // Name the record of the evidence table (V62, protons above 10 MeV) when it is among tonight's records.
    var evs = r.rad.events || [], v62 = evidence.value('V62', 'id');
    var d = $('rad-donki'), first = evs.filter(function (e) { return e.id === v62; })[0] || evs[0];
    d.hidden = !first;
    clear(d);
    if (!first) return;
    var t = first.start.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})Z$/);
    d.appendChild(document.createTextNode('NASA\'s DONKI space-weather database lists a solar energetic particle event starting ' +
      longDate(t[1]) + ', ' + t[2] + ' UTC'));
    if (first.id === v62) {
      d.appendChild(document.createTextNode('. '));
      d.appendChild(sourceLink('V62'));
    } else {
      d.appendChild(document.createTextNode(' (record ' + first.id + ').'));
    }
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

  // Density images use only nights whose tracks are usable (no solar protons on record).
  function usable(nights) { return nights.filter(function (r) { return r._truth.tracksUsable !== false; }); }

  function referenceImage(layer) {
    if (!data.ref[layer]) data.ref[layer] = accumulated(layer, layer === 'density' ? usable(arrivalWeek()) : arrivalWeek(), REF_SEED);
    return data.ref[layer];
  }

  function isCalf(ph, i) { var n = ph.REGIONS[ph.region[i]]; return n === 'calf_L' || n === 'calf_R'; }

  // Body cells for which keep(ph, i) is false: outline on the edge, empty inside.
  // Impedance keeps the calves (the only cells measured); a density image without usable tracks keeps none.
  function outlineOverlay(img, ph, keep) {
    var ov = new Uint8Array(ph.w * ph.h);
    for (var y = 0; y < ph.h; y++) {
      for (var x = 0; x < ph.w; x++) {
        var i = y * ph.w + x;
        if (!ph.region[i] || keep(ph, i)) continue;
        img.values[i] = NaN;
        var edge = x === 0 || y === 0 || x === ph.w - 1 || y === ph.h - 1 ||
          !ph.region[i - 1] || !ph.region[i + 1] || !ph.region[i - ph.w] || !ph.region[i + ph.w];
        if (edge) ov[i] = 2;
      }
    }
    return ov;
  }

  // Density change: grey out regions whose change is below NOISE_MULTIPLE x the expected
  // noise of a region mean, momentumSpread * sqrt(1 / (tracks * cell^2 * n)) (both projections of
  // each track used), times sqrt(2) for the difference of two images.
  function noiseMask(diff, ph, tracks) {
    var n = {}, i, ov = new Uint8Array(ph.w * ph.h);
    for (i = 0; i < ph.region.length; i++) if (ph.region[i]) n[ph.region[i]] = (n[ph.region[i]] || 0) + 1;
    for (i = 0; i < ph.region.length; i++) {
      var r = ph.region[i];
      if (!r) continue;
      var noisePct = MOMENTUM_SPREAD * Math.sqrt(1 / (tracks * ph.cellCm * ph.cellCm * n[r])) * Math.SQRT2 * 100;
      if (!(Math.abs(diff.values[i]) >= NOISE_MULTIPLE * noisePct)) ov[i] = 1;
    }
    return ov;
  }

  var LAYER_WORDS = { density: 'density', pressure: 'pressure', impedance: 'impedance' };
  var HOTSPOT_CM = null;                           // hotspotCm(), set on the first drawing

  // The plate's drawing box in CSS px (the canvas and the ink layer fill it).
  function plateBox() {
    var a = $('plate-art');
    return { W: Math.max(1, a.clientWidth), H: Math.max(1, a.clientHeight) };
  }

  function renderImage() {
    var r = rec(), i = idx();
    var canvas = $('body-canvas'), empty = $('canvas-empty'), bar = $('colorbar');
    pressed('[data-layer]', 'layer', state.layer);
    pressed('[data-view]', 'view', state.view);

    var box = plateBox(), ph0 = phantomFor(0);
    var lay = charts.plateLayout(ph0, box.W, box.H, PLATE_FILL);
    if (!HOTSPOT_CM) HOTSPOT_CM = hotspotCm(phantom.ASSUMPTIONS, ph0);
    data.lay = lay;
    charts.plateFrame($('plate-ink'), lay, TRACKS);

    var noImage = r.missionDay < 0;
    $('plate-art').classList.toggle('no-image', noImage);
    if (noImage) {
      canvas.hidden = true;
      empty.hidden = false;
      empty.textContent = 'Baseline nights are recorded on Earth before departure; images start at arrival.';
      charts.dotLegend(bar, null);
      $('cap-label').textContent = 'No image on baseline nights.';
      $('cap-extra').textContent = '';
      return;
    }

    var shown, ph, label, cap, extra = [], overlay = null, outlineOnly = false, legend;
    var none = function () { return false; };
    if (state.view === 'diff') {
      var nights = surfaceWindow(i);
      var kept = state.layer === 'density' ? usable(nights) : nights;
      var ref = referenceImage(state.layer);
      outlineOnly = state.layer === 'density' && !(kept.length && ref.tracks > 0);
      var now = accumulated(state.layer, kept.length ? kept : nights, i + 1);
      ph = now.ph;
      shown = imaging.difference(now.img, ref.img, ph);
      if (state.layer === 'impedance') overlay = outlineOverlay(shown, ph, isCalf);
      if (state.layer === 'density') overlay = outlineOnly ? outlineOverlay(shown, ph, none) : noiseMask(shown, ph, now.tracks);
      var m = DIFF_MIN_RANGE;
      for (var k = 0; k < shown.values.length; k++) { var v = shown.values[k]; if (v === v && Math.abs(v) > m) m = Math.ceil(Math.abs(v)); }
      shown.min = -m; shown.max = m;
      var left = nights.length - kept.length;
      label = 'Change since arrival: ' + state.layer + ', ' + (left ? kept.length + ' of the last ' : 'last ') + nights.length +
        (nights.length === 1 ? ' night' : ' nights') + ' accumulated' + (left ? ' (' + left + ' left out: raised radiation)' : '') +
        ', compared with the first ' + WINDOW + ' nights, averaged per body region';
      cap = 'Change in ' + LAYER_WORDS[state.layer] + ' since arrival, the last week against the first. Blue dots are loss, ink dots gain' +
        (state.layer === 'density' && !outlineOnly ? '; the smallest dots are below the noise.' : '.');
      if (outlineOnly) {
        cap = 'Radiation was raised on every night of the last week, so there is no density image for this week. ' +
          'Solar protons mostly stop inside the body or cross it with far lower momentum than cosmic rays.';
      } else if (state.layer === 'density') {
        extra.push('Regions whose change is smaller than twice their expected noise are drawn as the smallest dots.');
      }
      legend = outlineOnly ? null : { mode: 'diff', min: shown.min, max: shown.max, noise: state.layer === 'density' };
    } else {
      ph = phantomFor(r._truth.muscleChangePct);
      var unit;
      if (state.layer === 'density') {
        shown = imaging.render('density', ph, { tracksPerCm2: r._truth.tracksPerCm2, seed: i + 1 });
        shown.min = 0;                               // negative values are noise
        unit = 'x/X0';
        cap = 'The sleeper, seen from above. Density from the cosmic rays that crossed the bunk overnight.';
        if (r._truth.tracksUsable === false) {
          outlineOnly = true;
          overlay = outlineOverlay(shown, ph, none);
          cap = 'Radiation was raised tonight. Solar protons mostly stop inside the body or cross it with far lower momentum ' +
            'than cosmic rays, so tonight\'s tracks are left out of the density image.';
        } else {
          extra.push('Incident particles tonight: ' + Math.round(r._truth.tracksPerCm2).toLocaleString('en-US') + ' per cm² (assumed free-space intensity, ' +
            (state.sh < 1 ? 'after assumed shielding' : 'no habitat shielding') + ').');
          extra.push('Noise model: counting noise x ' + MOMENTUM_SPREAD + ' for the unknown momentum of each particle (assumption).');
          extra.push('Dot size: areal density in radiation lengths (x/X0).');
        }
      } else if (state.layer === 'pressure') {
        shown = imaging.render('pressure', ph, { env: r.env });
        shown.min = 0;
        unit = shown.unit;
        cap = 'The sleeper, seen from above. Pressure under the sleeper on the mattress.';
        if (shown.massKg) extra.push('Body mass derived from the pressure map: ' + shown.massKg.toFixed(1) + ' kg.');
      } else {
        shown = imaging.render('impedance', ph, { eimPhaseDeg: r.eim ? r.eim.phase50_deg : NaN, baselinePhaseDeg: data.base.eim.median });
        overlay = outlineOverlay(shown, ph, isCalf);
        // Fixed scale around the baseline so a falling calf reading shows as a smaller dot.
        shown.min = data.base.eim.median * 0.75;
        shown.max = data.base.eim.median * 1.05;
        unit = shown.unit;
        cap = 'The sleeper, seen from above. Impedance phase of the calves; hollow dots outline the parts that are not measured.';
        if (!r.eim) extra.push('No usable calf scan tonight.');
      }
      label = state.layer === 'pressure' ? 'Pressure under the sleeper' :
        state.layer === 'density' ? 'Areal density from cosmic-ray scattering' : shown.label;
      legend = outlineOnly ? null : { mode: 'raw', min: shown.min, max: shown.max, unit: unit, outline: state.layer === 'impedance' };
    }
    if (state.layer === 'impedance') extra.unshift('Only the calves are measured.');

    canvas.hidden = false;
    empty.hidden = true;
    charts.stipple(canvas, shown, ph, lay, { mode: state.view === 'diff' ? 'diff' : 'raw', overlay: overlay, dpr: Math.min(2, root.devicePixelRatio || 1) });
    canvas.setAttribute('aria-label', scrub(label) + ', ' + dayLabel(r));
    charts.dotLegend(bar, legend);
    $('cap-label').textContent = cap;
    $('cap-extra').textContent = 'Fig. 1: ' + scrub(label) + '. ' + extra.join(' ');
  }

  // ---- render: hotspots on the plate and their leaders to the margin notes ---------
  var HOTSPOT_PART = { sleep: 'Head', cardio: 'Chest', muscle: 'Calves', radiation: 'Whole body' };
  var SVG_NS = 'http://www.w3.org/2000/svg';
  function renderHotspots() {
    var lay = data.lay, noImage = rec().missionDay < 0;
    Array.prototype.forEach.call(document.querySelectorAll('.hs'), function (b) {
      var id = b.dataset.card, c = card(id), word = charts.STATUS[c.status].word, at = HOTSPOT_CM[id];
      b.className = 'hs hs-' + id + ' st-' + c.status + (b.classList.contains('is-hot') ? ' is-hot' : '');
      b.hidden = noImage;
      b.setAttribute('aria-pressed', String(state.card === id));
      b.setAttribute('aria-label', HOTSPOT_PART[id] + ': ' + CARD_NAMES[id].toLowerCase() + ' check, ' + word);
      b.style.setProperty('--x', lay.px(at[0]).toFixed(1) + 'px');
      b.style.setProperty('--y', lay.py(at[1]).toFixed(1) + 'px');
    });
    drawLeaders();
  }

  function svgEl(tag, attrs, parent) {
    var n = document.createElementNS(SVG_NS, tag);
    Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (parent) parent.appendChild(n);
    return n;
  }

  // The marks of the checks on the plate, drawn into its ink layer (which does not clip): a ring on
  // each body part (dashed for the whole-body radiation check); a check on Watch or Report gets the
  // accent, a centre dot and a slow halo; the selected check an outer blue ring. On wide layouts,
  // where the notes stand to the right of the plate, a hairline leader runs from each ring to the
  // top rule of its note.
  function drawLeaders() {
    var svg = $('plate-ink');
    Array.prototype.forEach.call(svg.querySelectorAll('.leaders, .rings'), function (n) { svg.removeChild(n); });
    if (rec().missionDay < 0) return;
    var art = $('plate-art').getBoundingClientRect(), lay = data.lay;
    var leaders = svgEl('g', { 'class': 'leaders' }, svg), rings = svgEl('g', { 'class': 'rings' }, svg);
    CARD_IDS.forEach(function (id) {
      var st = card(id).status, flag = isFlag(st), at = HOTSPOT_CM[id], hx = lay.px(at[0]), hy = lay.py(at[1]);
      var hot = document.querySelector('.hs[data-card="' + id + '"]').classList.contains('is-hot') ? ' is-hot' : '';
      var note = document.querySelector('.card[data-card="' + id + '"]').getBoundingClientRect();
      if (note.left >= art.right - 1) {
        var endX = note.left - art.left, ty = note.top - art.top, knee = endX - Math.min(108, (endX - hx) * 0.3);
        var pl = svgEl('polyline', {
          points: [hx, hy, knee, ty, endX, ty].map(function (v) { return v.toFixed(1); }).join(' '),
          'class': 'leader st-' + st + (state.card === id ? ' is-selected' : '') + hot
        }, leaders);
        pl.dataset.card = id;
      }
      var g = svgEl('g', { 'class': 'hs-mark st-' + st + hot }, rings);
      g.dataset.card = id;
      if (flag) svgEl('circle', { cx: hx, cy: hy, r: 17, 'class': 'hs-halo' }, g);
      if (state.card === id) svgEl('circle', { cx: hx, cy: hy, r: flag ? 13.5 : 11, 'class': 'hs-sel' }, g);
      svgEl('circle', { cx: hx, cy: hy, r: flag ? 9 : 6.5, 'class': 'hs-ring' + (id === 'radiation' ? ' hs-ring-whole' : '') }, g);
      if (flag) svgEl('circle', { cx: hx, cy: hy, r: 3, 'class': 'hs-dot' }, g);
    });
  }

  // Hover or focus on a note or a hotspot lights the pair (and its leader).
  function setHot(id) {
    Array.prototype.forEach.call($('brief').querySelectorAll('[data-card]'), function (n) {
      n.classList.toggle('is-hot', !!id && n.dataset.card === id);
    });
  }

  // Selecting a check on the plate also brings its detail into view (the focus stays where it was).
  function revealGuidance() {
    var g = $('checks'), top = g.getBoundingClientRect().top;
    if (top < 0 || top > root.innerHeight * 0.5) g.scrollIntoView({ block: 'start', behavior: reducedMotion ? 'auto' : 'smooth' });
  }

  // ---- render: the night ruler -----------------------------------------------------
  function renderTimeline() {
    var recs = data.gen.records, r = rec();
    var slider = $('day');
    slider.disabled = false;
    slider.max = String(recs.length - 1);
    slider.value = String(idx());
    slider.setAttribute('aria-valuetext', dayLabel(r) + ', ' + longDate(r.night));
    charts.ruler($('ruler'), { days: recs.map(function (x) { return x.missionDay; }), selected: idx() });
    $('day-out').textContent = dayLabel(r);
    $('date-out').textContent = longDate(r.night);
    var play = $('play');
    play.disabled = false;
    play.setAttribute('aria-pressed', String(!!playTimer));
    play.querySelector('.btn-text').textContent = playTimer ? 'Pause the mission' : 'Play the mission';
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

  // Shorter wordings of a measured solar-event label, for narrow charts (charts.line picks the longest that fits).
  function eventMarker(e) {
    var mk = { missionDay: e.from, label: e.label };
    var m = e.label.match(/^Measured: solar particle (events?) of (\S+ \w+) (\d{4})/);
    if (m) {
      mk.shortLabel = 'Solar particle ' + m[1] + ', ' + m[2] + ' ' + m[3];
      mk.tinyLabel = (m[1] === 'events' ? 'Solar events, ' : 'Solar event, ') + m[2];
    }
    return mk;
  }
  // The arrival line and the scenario's events up to the selected night: a later event is not shown before it happens.
  function startMarkers() {
    var sc = data.gen.scenario;
    var label = sc.transitDays > 0 ? 'Arrival after a ' + sc.transitDays + '-day transit (not monitored)' : 'Arrival';
    var shortLabel = sc.transitDays > 0 ? 'Arrival (transit not monitored)' : null;
    return [{ missionDay: 0, label: label, shortLabel: shortLabel }].concat(sc.events.filter(function (e) {
      return e.from <= state.d;
    }).map(eventMarker));
  }

  function trendSpec(cardId) {
    var recs = data.gen.records, b = chartBaseline(), c = card(cardId), x = c.extra || {};
    var o = {
      statusAt: statusAtFor(cardId), selectedDay: state.d, upTo: state.d, thresholds: [], markers: startMarkers(),
      series: judgedSeries(cardId), xTitle: 'Mission day',
      axisBreak: data.gen.scenario.transitDays > 0 ? 0 : null
    };
    var legend = [['dot', 'Nightly reading']];
    var note = '', noteMore = null;
    if (cardId === 'muscle') {
      var me = muscleExtra(), med = b.eim.median, plan = data.gen.plan.expectedChangePct;
      var ok = med != null && me && me.amberLimitPct != null;
      o.raw = engine.series(recs, 'eim');
      o.baseline = band(b.eim);
      // Bottom of the plan band exactly as the engine judges amber.
      o.expected = !ok ? null : recs.map(function (r, i) {
        return { missionDay: r.missionDay, low: med * (1 + (plan[i] - me.amberLimitPct) / 100), high: med * (1 + plan[i] / 100) };
      }).filter(function (p) { return p.missionDay >= 0; });
      o.thresholds = !ok ? [] : [{ value: med * (1 - me.redLimitPct / 100), label: 'Report line: ' + me.redLimitPct.toFixed(1) + '% below baseline', shortLabel: 'Report: −' + me.redLimitPct.toFixed(1) + '%', status: 'red' }];
      o.exercise = recs.filter(function (r) { return r.missionDay >= 0; }).map(function (r) { return { missionDay: r.missionDay, done: !!r.log.exercise_done }; });
      o.unit = 'deg'; o.yLabel = 'Calf phase';
      legend.push(['line', WINDOW + '-night median'], ['band', 'Own baseline range'], ['plan', 'Plan (Watch below this band)'],
        ['report', 'Report line'], ['event', 'Event'], ['exercise', 'Exercise done (tall) or missed (short)'], ['selected', 'Selected night']);
      note = 'Dots are the nightly calf impedance readings; the line is the ' + WINDOW + '-night median the card uses. ' +
        'The report line applies to the ' + WINDOW + '-night median. The report line is the largest test-retest variability reported for this measurement.';
    } else if (cardId === 'sleep') {
      o.raw = engine.series(recs, 'sleep');
      o.thresholds = [
        { value: x.amberHours, label: 'Watch line: ' + x.amberHours + ' h', status: 'amber' },
        { value: x.redHours, label: 'Report line: ' + x.redHours + ' h', status: 'red' }
      ];
      o.unit = 'h'; o.yLabel = 'Sleep';
      legend.push(['line', WINDOW + '-night mean'], ['watch', 'Watch line'], ['report', 'Report line'], ['event', 'Event'], ['selected', 'Selected night']);
      note = 'Dots are the hours asleep each night; the line is the ' + WINDOW + '-night mean the card uses. ' +
        sleepLineNote();
    } else if (cardId === 'cardio') {
      o.raw = engine.series(recs, 'hr');
      o.baseline = band(b.hr);
      var hrLim = x.hrLimit != null ? x.hrLimit : (b.hr.median != null ? b.hr.median + T.cardioSdMultiple.value * b.hr.sd : null);
      if (hrLim != null) o.thresholds = [{ value: hrLim, label: 'Watch line: baseline + ' + T.cardioSdMultiple.value + ' SD', shortLabel: 'Watch: +' + T.cardioSdMultiple.value + ' SD', status: 'amber' }];
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
      // Doses spanning more than 50x (a solar event) go on a log axis; ticks then carry the card's units.
      var logY = charts.useLogScale(o.series.concat(o.raw).map(function (p) { return p.value; }));
      if (logY) {
        o.logY = true; o.yFormat = charts.doseTick; o.unit = '';
        // On a narrow plot the full labels would run into the event nights; short ones stay over the quiet nights.
        o.thresholds.forEach(function (t, k) { t.shortLabel = (k ? 'Report: ' + T.radiationRedRatio.value : 'Watch: ' + T.radiationAmberRatio.value) + 'x'; });
      }
      legend.push(['line', 'Dose the card judges']);
      if (x.usualUGy != null) legend.push(['watch', 'Watch line'], ['report', 'Report line']);
      legend.push(['event', 'Event'], ['selected', 'Selected night']);
      note = (logY ? 'Logarithmic scale: each grid line is 10 times the one below. ' : '') +
        (x.usualUGy != null ? 'Measured dose over each sleep period (' + doseMedium() + '), replayed night by night. Usual level before tonight: ' + fmtDose(x.usualUGy) +
        ' (median of up to ' + T.radiationHistoryNights.value + ' earlier nights). The brief is read the morning after: real-time warnings come from space-weather alerts and the flight rules.' :
        'Not enough earlier nights to set a usual level, so no lines are drawn.');
      // Solar-event scenario: why a night can be on Report below the line, and what Curiosity saw under Martian air (V92).
      if (data.gen.scenario.rad && data.gen.scenario.rad.checkSpe) {
        if (x.usualUGy != null) note += ' A night with a solar particle event on record is on Report even when its dose is below the line.';
        noteMore = { text: 'Under 23 g/cm² of Martian air, Curiosity\'s RAD saw the dose rate rise only two- to threefold in the same event.', ids: ['V92'] };
      }
    }
    if (o.axisBreak != null) legend.push(['break', 'Break: the transit is not monitored']);
    return { opts: o, legend: legend, note: note, noteMore: noteMore };
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
    var tn = $('trend-note');
    tn.textContent = scrub(t.note);
    if (t.noteMore) withLinks(tn, ' ' + t.noteMore.text, t.noteMore.ids);

    var p = cardId === 'muscle' ? engine.project(data.gen.records, idx()) : null;
    var proj = $('projection');
    if (p && Math.round(p.slopePctPerWeek * 10) === 0) p = null;
    proj.hidden = !p;
    proj.textContent = p ? 'Weekly trend: ' + fmtPct(p.slopePctPerWeek) + ' per week. At this rate the weekly median reaches the Report line ' +
      (p.daysToRed <= 7 ? 'within about a week' : 'in about ' + p.daysToRed + ' days') + '; the nightly check can change sooner.' : '';

    renderFlux(cardId);

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
      $('rose-reading').textContent = 'Most particles arrive from the ' + charts.ROSE_DIRECTIONS[k] + ' side.';
      $('rose-span').textContent = '(' + nights + (nights === 1 ? ' night' : ' nights') + ' with tracker data up to tonight).';
    }
  }

  // Solar-event scenario only: OMNI2 proton flux near Earth, with the selected night's sleep window shaded.
  function renderFlux(cardId) {
    var fig = $('flux-fig'), sc = data.gen.scenario, omni = M.data && M.data.omniProtons;
    var show = cardId === 'radiation' && !!(sc.rad && sc.rad.checkSpe) && !!omni;
    fig.hidden = !show;
    if (!show) return;
    var pts = omni.rows.map(function (x) { return { t: Date.parse(x[0]), value: x[1] }; });
    var from = pts[0].t, to = pts[pts.length - 1].t + 3600000;
    var m = rec().rad && rec().rad.measured, shade = null;
    if (m) { var open = Date.parse(m.date + 'T22:00:00Z'); shade = { from: open, to: open + 8 * 3600000 }; }
    charts.logSeries($('flux-chart'), {
      points: pts, from: from, to: to, shade: shade, yMin: 0.1, yMax: 10000, yLabel: 'Protons >10 MeV (pfu)',
      label: 'Hourly proton flux above 10 MeV near Earth, 4 to 16 September 2017, logarithmic scale' +
        (shade && shade.to > from && shade.from < to ? '; the sleep window of the night of ' + longDate(m.date) + ' is shaded' : '')
    });
    $('flux-ev').href = evidenceHref('V63');
  }

  // ---- render: guidance ------------------------------------------------------------
  function evidenceHref(id) {
    var st = {}; Object.keys(state).forEach(function (k) { st[k] = state[k]; });
    st.ev = id;
    return hashFor(st);
  }

  function sourceLink(id) {
    var a = el('a', 'ev-link', id);
    a.href = evidenceHref(id);
    return a;
  }

  function claimOf(id) {
    try { return evidence.get(id).claim; } catch (e) { return ''; }
  }

  // Text followed by its evidence links.
  function withLinks(parent, text, ids) {
    if (text) parent.appendChild(document.createTextNode(text));
    ids.forEach(function (id) { parent.appendChild(document.createTextNode(' ')); parent.appendChild(sourceLink(id)); });
    return parent;
  }

  // NASA's material for one check (js/rules.js NASA), for the mission type of this world, set like a
  // museum label in three columns: the risk and its rating | NASA's two sentences | more context,
  // the standard and the open research gap. `ctx` is the check's line from rules.CONTEXT (V43, V45, V46).
  function nasaBlock(nx, world, ctx) {
    var frag = document.createDocumentFragment();
    var rt = nx.ratings[world];

    var c1 = el('div', 'nasa-col nasa-risk');
    c1.appendChild(withLinks(el('p', 'nasa-risk-name'), nx.risk, nx.riskSourceIds));
    c1.appendChild(el('p', 'label', "NASA's rating for this mission"));
    var code = el('p', 'nasa-rating');
    code.appendChild(el('span', 'nasa-code', rt.code.replace('x', '×')));
    code.appendChild(el('span', 'nasa-disposition', rt.disposition));
    c1.appendChild(code);
    c1.appendChild(withLinks(el('p', 'nasa-small'), rt.text + ' ' + nx.scale + ' Rating page last published ' + nx.lastPublished + '.', [nx.roadmapId]));
    frag.appendChild(c1);

    var c2 = el('div', 'nasa-col nasa-says');
    c2.appendChild(el('p', 'label', 'What NASA says'));
    c2.appendChild(el('q', 'nasa-quote', nx.says));
    c2.appendChild(el('q', 'nasa-quote', nx.canBeDone));
    c2.appendChild(withLinks(el('p', 'nasa-small'), 'NASA risk page.', [nx.riskPageId]));
    frag.appendChild(c2);

    var c3 = el('div', 'nasa-col nasa-more');
    if (ctx) {
      c3.appendChild(el('p', 'label', 'More context'));
      c3.appendChild(withLinks(el('p'), ctx.note, ctx.sourceIds));
    }
    c3.appendChild(el('p', 'label', 'NASA standard'));
    nx.standard.forEach(function (s) { c3.appendChild(withLinks(el('p'), s.text, s.sourceIds)); });
    c3.appendChild(el('p', 'label', 'Open NASA research gap'));
    c3.appendChild(withLinks(el('p'), nx.gap.id + ': ' + nx.gap.text, [nx.roadmapId]));
    frag.appendChild(c3);
    return frag;
  }

  function renderGuidance() {
    var c = card(state.card);
    $('guidance-card').textContent = CARD_NAMES[state.card];
    var st = $('g-status');
    clear(st);
    var wrap = el('span', 'status st-' + c.status);
    wrap.appendChild(charts.statusIconEl(c.status, 16));
    wrap.appendChild(el('span', 'status-word', charts.STATUS[c.status].word));
    st.appendChild(wrap);
    st.appendChild(el('span', 'g-reason', ' ' + scrub(c.reason)));
    var meaning = scrub(c.meaning);
    if (state.card === 'sleep') meaning += ' ' + sleepLineNote();
    $('g-meaning').textContent = meaning;
    var ul = $('g-actions');
    clear(ul);
    c.actions.forEach(function (x) { ul.appendChild(el('li', null, scrub(x))); });
    $('g-decides').textContent = capital(c.decides);

    // NASA risk for this check.
    var ctx = $('g-context');
    clear(ctx);
    ctx.appendChild(nasaBlock(rules.NASA[state.card], data.gen.scenario.env, rules.CONTEXT[state.card]));

    var src = $('g-sources');
    clear(src);
    if (!c.sourceIds.length) src.appendChild(el('li', 'quiet', 'A modelling assumption; see the assumptions list in the evidence drawer.'));
    c.sourceIds.forEach(function (id) {
      var li = el('li');
      li.appendChild(sourceLink(id));
      var claim = claimOf(id);
      if (claim) li.appendChild(document.createTextNode(' ' + claim));
      src.appendChild(li);
    });

    var showCm = state.card === 'muscle';
    $('g-cm-dd').hidden = !showCm;
    var cm = $('g-cm');
    clear(cm);
    if (showCm) {
      rules.COUNTERMEASURES.forEach(function (x) {
        var li = el('li');
        li.appendChild(el('span', 'cm-name', x.name));
        li.appendChild(el('span', 'mark-sc mark-' + x.evidence.replace(/\s+/g, '-'), x.evidence));
        li.appendChild(withLinks(el('span', 'cm-note'), x.note, x.sourceIds));
        cm.appendChild(li);
      });
    }
  }

  // ---- render: five hazards ------------------------------------------------------------
  function renderHazards() {
    var ul = $('hazard-list');
    clear(ul);
    rules.HAZARDS.forEach(function (h) {
      var li = el('li');
      li.appendChild(el('span', 'cm-name', h.name));
      li.appendChild(el('span', 'mark-sc mark-' + h.coverage.replace(/\s+/g, '-'), h.coverage));
      li.appendChild(el('span', 'cm-note', h.text));
      if (h.fact) {
        var f = withLinks(el('span', 'cm-note hz-fact'), h.fact.text, h.fact.sourceIds);
        var wf = h.worldFact && h.worldFact[data.gen.scenario.env];
        if (wf) withLinks(f, ' ' + wf.text, wf.sourceIds);
        li.appendChild(f);
      }
      if (h.quote) {
        var qt = el('span', 'cm-note hz-fact');
        qt.appendChild(el('q', 'nasa-quote', h.quote.text));
        li.appendChild(withLinks(qt, '', h.quote.sourceIds));
      }
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

  // ---- render: gravity check -------------------------------------------------------
  // The rat partial-weight-bearing data (NASA OSDR, V90-V91) against the model's share at 0.4 g
  // for the current what-if shape. All text comes from model.describeGravityCheck.
  var GCHECK_SHAPES = { grip: 'circle', plantarflexionTorque: 'square', calfGirth: 'triangle' };
  function renderGravityCheck() {
    var box = $('gcheck'), pwb = M.data && M.data.osdrPwb;
    box.hidden = !pwb;
    if (box.hidden) return;
    var c = model.checkGravityTerm(pwb, state.gs), t = model.describeGravityCheck(c);
    charts.dotScale($('gcheck-chart'), {
      rows: t.marks.filter(function (m) { return m.share != null; }).map(function (m) {
        return { value: m.share, label: m.label, shape: GCHECK_SHAPES[m.measure] };
      }),
      max: 1.2, ticks: [0, 0.2, 0.4, 0.6, 0.8, 1, 1.2],
      ref: { value: c.model, label: 'Model, shape ' + c.shape + ': ' + c.model.toFixed(2) },
      title: 'Share of the fully unloaded loss that remained at 40% weight bearing',
      label: 'Share of the fully unloaded loss that remained at 40% weight bearing, six rat measures, with the model at ' + c.model.toFixed(2)
    });
    var tx = $('gcheck-text');
    clear(tx);
    tx.appendChild(el('p', null, t.sentences.join(' ')));
    var ul = $('gcheck-caveats');
    clear(ul);
    t.caveats.forEach(function (x) { ul.appendChild(el('li', null, x)); });
    var close = $('gcheck-close');
    clear(close);
    withLinks(close, 'Sources:', ['V90', 'V91']);
    close.appendChild(document.createTextNode('. ' + t.closing));
  }

  // ---- render: evidence drawer (built once) ----------------------------------------
  function fmtAssumptionValue(v) {
    if (Array.isArray(v)) return v.join(' to ');
    if (v && typeof v === 'object') {
      return Object.keys(v).map(function (k) { return k + ' ' + fmtAssumptionValue(v[k]); }).join('; ');
    }
    return String(v);
  }

  // Topic heading in the drawer: sentence case with the acronyms in capitals ("NASA ratings and requirements").
  function topicTitle(topic) { return capital(topic).replace(/\b(nasa|eim)\b/gi, function (w) { return w.toUpperCase(); }); }

  function buildEvidence() {
    var box = $('evidence-list');
    clear(box);
    var groups = {}, order = [];
    evidence.items.forEach(function (it) {
      if (!has(groups, it.topic)) { groups[it.topic] = []; order.push(it.topic); }
      groups[it.topic].push(it);
    });
    order.forEach(function (topic) {
      box.appendChild(el('h3', 'ev-group', topicTitle(topic)));
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
        a.target = '_blank';                       // a source opens in a new tab; the page stays
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
    box.appendChild(el('p', 'quiet', 'Modelling choices that no source fixes. Each can be changed in the module that owns it.'));
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
    if (!target) {
      showNotice('That source is not in the evidence list.');
      state.ev = null;
      writeHash();
      return;
    }
    target.closest('details').open = true;
    target.classList.add('ev-target');
    target.scrollIntoView({ block: 'center', behavior: reducedMotion ? 'auto' : 'smooth' });
    target.focus({ preventScroll: true });
  }

  // ---- update cycle ----------------------------------------------------------------
  function render() {
    var changed = ensureData();
    renderTopbar();
    renderBrief();
    renderImage();
    renderHotspots();
    renderTimeline();
    renderTrend();
    renderGuidance();
    renderHazards();
    renderWhatIf();
    renderGravityCheck();
    return changed;
  }

  // Render a state from a link; on any error fall back to the default view with a notice.
  // The notice also shows when a value in the address was rejected or changed to fit.
  function renderFromLink(hash) {
    state = parseHash(hash);
    var rejected = state.rejected;
    delete state.rejected;
    try {
      if (render()) rejected = true;
    } catch (e) {
      state = parseHash('');
      delete state.rejected;
      data.key = null;
      render();
      rejected = true;
    }
    if (rejected) showNotice(); else $('notice').hidden = true;
    writeHash();
  }

  var NOTICE_TEXT = $('notice').textContent;
  function showNotice(text) {
    $('notice').textContent = text || NOTICE_TEXT;
    $('notice').hidden = false;
  }
  // An address without "=" is an in-page anchor; one that names no element on the page is a broken link.
  function isBrokenAnchor(hash) {
    var id = hash.replace(/^#/, '');
    if (!id) return false;
    try { id = decodeURIComponent(id); } catch (e) { return true; }
    return !document.getElementById(id);
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
      update(scenarioChanges(scenarioMemory, state, e.target.value));
    });
    document.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b || b.disabled) return;
      if (b.dataset.layer) update({ layer: b.dataset.layer });
      else if (b.dataset.view) update({ view: b.dataset.view });
      else if (b.dataset.card) {
        update({ card: b.dataset.card });
        if (b.classList.contains('hs') || b.classList.contains('card')) revealGuidance();
      }
      else if (b.id === 'play') setPlaying(!playTimer);
      else if (b.id === 'whatif-reset') update({ ex: WHATIF.ex.def, gs: WHATIF.gs.def, sh: WHATIF.sh.def, nz: WHATIF.nz.def });
    });
    // The skip link moves focus without replacing the view in the address.
    document.querySelector('.skip').addEventListener('click', function (e) {
      e.preventDefault();
      var t = $('brief-title');
      t.scrollIntoView({ block: 'start', behavior: reducedMotion ? 'auto' : 'smooth' });
      t.focus({ preventScroll: true });
    });
    $('day').addEventListener('input', function (e) {
      var r = data.gen.records[parseInt(e.target.value, 10)];
      if (r) update({ d: r.missionDay });
    });
    // The whole ruler is the slider: pressing or dragging anywhere on it moves the night.
    var wrap = $('ruler-wrap'), dragging = false;
    function nightAt(e) {
      var rect = wrap.getBoundingClientRect(), recs = data.gen.records;
      var r = recs[charts.rulerIndex(e.clientX - rect.left, rect.width, recs.length)];
      if (r && r.missionDay !== state.d) update({ d: r.missionDay });
    }
    wrap.addEventListener('pointerdown', function (e) {
      if (e.button !== 0 || $('day').disabled) return;
      dragging = true;
      setPlaying(false);
      try { wrap.setPointerCapture(e.pointerId); } catch (err) { /* capture is optional */ }
      nightAt(e);
      e.preventDefault();
    });
    wrap.addEventListener('pointermove', function (e) { if (dragging) nightAt(e); });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (t) { wrap.addEventListener(t, function () { dragging = false; }); });
    // Section links in the top bar scroll without replacing the view in the address.
    Array.prototype.forEach.call(document.querySelectorAll('[data-goto]'), function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        $(a.dataset.goto).scrollIntoView({ block: 'start', behavior: reducedMotion ? 'auto' : 'smooth' });
      });
    });
    // A note or a hotspot under the pointer or the focus lights its pair on the plate.
    var brief = $('brief');
    function hotFrom(e) { var t = e.target.closest && e.target.closest('[data-card]'); setHot(t ? t.dataset.card : null); }
    brief.addEventListener('pointerover', hotFrom);
    brief.addEventListener('pointerleave', function () { setHot(null); });
    brief.addEventListener('focusin', hotFrom);
    brief.addEventListener('focusout', function () { setHot(null); });
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
      root.requestAnimationFrame(function () { pending = false; renderImage(); renderHotspots(); renderTimeline(); renderTrend(); renderGravityCheck(); });
    });
    root.addEventListener('hashchange', function () {
      if (location.hash.indexOf('=') < 0) {             // a plain in-page anchor, not a view
        if (isBrokenAnchor(location.hash)) showNotice();
        return;
      }
      if (location.hash === hashFor(state)) return;
      setPlaying(false);
      renderFromLink(location.hash);
      if (state.ev) openEvidence(state.ev);
    });
  }

  // Measured data used on this page, from the metadata each data module exports. The DONKI API
  // address (data/README.md) needs a key, so the page links NASA CCMC's DONKI page a person can read.
  var READABLE_SOURCE = { donkiSep2017: 'https://ccmc.gsfc.nasa.gov/tools/DONKI/' };
  function buildMeasured() {
    var ul = $('measured-list'), D = M.data || {};
    clear(ul);
    [['mslRad', 'nightly dose on Mars'], ['lroCrater', 'nightly dose on the Moon'],
      ['donkiSep2017', 'solar-particle-event records'], ['omniProtons', 'proton flux chart'],
      ['osdrPwb', 'check of the muscle model\'s gravity term']].forEach(function (x) {
      var d = D[x[0]];
      if (!d) return;
      var li = el('li');
      li.appendChild(el('strong', null, d.name));
      li.appendChild(document.createTextNode(': ' + x[1] + '. '));
      li.appendChild(el('span', null, d.source + ' '));
      var url = has(READABLE_SOURCE, x[0]) ? READABLE_SOURCE[x[0]] : d.url;
      var a = el('a', null, 'Source: ' + new URL(url).hostname);
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      li.appendChild(a);
      li.appendChild(document.createTextNode('. Retrieved ' + d.retrieved + '. '));
      li.appendChild(el('span', 'quiet', d.terms));
      ul.appendChild(li);
    });
  }

  // Sections fade up a few pixels as they enter the viewport (not under reduced motion).
  function revealOnScroll() {
    if (reducedMotion || !root.IntersectionObserver) return;
    var io = new root.IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    document.documentElement.classList.add('motion');
    Array.prototype.forEach.call(document.querySelectorAll('.reveal'), function (n) { io.observe(n); });
  }

  // ---- start -----------------------------------------------------------------------
  revealOnScroll();
  buildEvidence();
  buildMeasured();
  wire();
  var initialHash = location.hash;
  renderFromLink(initialHash.indexOf('=') >= 0 ? initialHash : '');
  if (initialHash.indexOf('=') < 0 && isBrokenAnchor(initialHash)) showNotice();
  if (state.ev) openEvidence(state.ev);
  // Text measured in the figures changes once the web fonts are in: draw them again.
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { renderImage(); renderHotspots(); renderTimeline(); renderTrend(); renderGravityCheck(); });
})(typeof globalThis !== 'undefined' ? globalThis : this);
