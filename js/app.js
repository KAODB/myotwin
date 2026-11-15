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
  var evidence = M.evidence, sim = M.sim, rules = M.rules, engine = M.engine,
    phantom = M.phantom, imaging = M.imaging, charts = M.charts;
  // All animation goes through js/motion.js; without it every motion call does nothing.
  var MOTION_CALLS = ['intro', 'finishIntro', 'introRunning', 'rowOpened', 'rowClosed', 'valueTo', 'stopValue', 'pulse', 'settle', 'fadeRows', 'setPlaying'];
  var motion = M.motion || MOTION_CALLS.reduce(function (o, k) { o[k] = function () { return false; }; return o; }, {});
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
  // or evidence id `ev` from an older link is accepted and ignored. An unknown scenario opens the
  // default view. `card` is the open check row, null when none is open.
  var HASH_KEYS = ['s', 'd', 'layer', 'view', 'mode', 'card', 'ex', 'gs', 'sh', 'nz', 'mo', 'tc', 'sy', 'ev'];
  // Morning check-in: mood 1 to 5, temperature 34.0 to 42.0 °C (one decimal at most), and what
  // the person notices as the letters l (legs), r (not rested), i (ill) in that order.
  var SY_VALUES = ['l', 'r', 'i', 'lr', 'li', 'ri', 'lri'];
  function parseTemp(v) {
    if (!/^\d{2}(\.\d)?$/.test(v)) return null;
    var n = parseFloat(v);
    return n >= 34 && n <= 42 ? Math.round(n * 10) / 10 : null;
  }
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
    if ('ev' in q && !/^V\d+$/.test(q.ev)) bad = true;
    var st = {
      s: s, d: d,
      layer: check('layer', pick(q.layer, LAYERS, 'density')),
      view: check('view', pick(q.view, VIEWS, 'raw')),
      card: check('card', pick(q.card, CARD_IDS, null)),
      ex: checkNum('ex', snap(q.ex, WHATIF.ex)), gs: checkNum('gs', snap(q.gs, WHATIF.gs)),
      sh: checkNum('sh', snap(q.sh, WHATIF.sh)), nz: checkNum('nz', snap(q.nz, WHATIF.nz)),
      mo: check('mo', /^[1-5]$/.test(q.mo || '') ? q.mo : null),
      tc: 'tc' in q ? parseTemp(q.tc) : null,
      sy: check('sy', SY_VALUES.indexOf(q.sy) >= 0 ? q.sy : null) || ''
    };
    if (st.mo != null) st.mo = parseInt(st.mo, 10);
    if ('tc' in q && st.tc == null) bad = true;
    st.rejected = bad;
    return st;
  }

  function hashFor(st) {
    var parts = ['s=' + st.s, 'd=' + st.d, 'layer=' + st.layer, 'view=' + st.view];
    if (st.card) parts.push('card=' + st.card);
    Object.keys(WHATIF).forEach(function (k) {
      if (st[k] !== WHATIF[k].def && st[k] != null) parts.push(k + '=' + st[k]);
    });
    if (st.mo != null) parts.push('mo=' + st.mo);
    if (st.tc != null) parts.push('tc=' + st.tc);
    if (st.sy) parts.push('sy=' + st.sy);
    return '#' + parts.join('&');
  }

  // A check-in belongs to one morning: moving to another night or scenario clears it.
  // Returns the changes that clear it, or {} when `changes` keep the same morning.
  function checkinReset(st, changes) {
    var moved = (has(changes, 'd') && changes.d !== st.d) || (has(changes, 's') && changes.s !== st.s);
    return moved ? { mo: null, tc: null, sy: '' } : {};
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

  // The guide's rows 2 and 3, from the night's cards (in the assessment's order) and the check-in
  // result. `card` is the check that "Open a check" opens: the first on Report, else the first on
  // Watch, else muscle. "Do today" takes its action from the most urgent source: cards on Report,
  // then cards on Watch, then the check-in when it is on Watch. `target` is that source (a card id
  // or 'checkin', null when there is none), `text` its first action and `more` how many follow.
  // A press and release on the trend chart goes to a night only when the pointer stayed within
  // TAP_PX of where it went down; a drag or a text selection does not.
  var TAP_PX = 5;
  function isTap(down, up) {
    return !!down && !!up && Math.abs(up.x - down.x) <= TAP_PX && Math.abs(up.y - down.y) <= TAP_PX;
  }

  function todayStep(cards, checkin) {
    var first = function (st) { return cards.filter(function (c) { return c.status === st; })[0]; };
    var flagged = first('red') || first('amber');
    var src = flagged ? { id: flagged.id, actions: flagged.actions } :
      checkin && checkin.status === 'amber' ? { id: 'checkin', actions: checkin.actions } : null;
    if (!src || !src.actions.length) return { card: 'muscle', target: null, text: 'Nothing new. Keep the plan.', more: 0 };
    return { card: flagged ? flagged.id : 'muscle', target: src.id, text: src.actions[0], more: src.actions.length - 1 };
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
  // Thigh loss relative to calf loss, from the bed-rest study in the evidence table that reports both.
  var BED_REST = evidence.items.filter(function (it) { return has(it.values, 'thighControlPct'); })[0].values;
  var THIGH_RATIO = BED_REST.thighControlPct / BED_REST.calfControlPct;
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
    // One line at every desktop width: baseline nights read "Baseline night 3" (the plate note says they are on Earth).
    $('brief-date').textContent = ' · ' + (r.missionDay < 0 ? dayLabel(r) : ENV_NAMES[env] + ', ' + dayLabel(r).toLowerCase());
    renderHeadline(scrub(a.headline));
    // The accent colour is reserved for attention: the headline carries it only when a check is on Watch or Report.
    $('headline').classList.toggle('headline-attn', a.cards.some(function (c) { return isFlag(c.status); }));
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

  // The number of a note as a value and the formatting that gives its text, for counting from one
  // night's value to the next; `family` changes when the unit or rounding does (no count across it).
  function noteNumber(c) {
    if (c.id === 'muscle') return { v: c.status === 'grey' ? null : c.deltaPct, fmt: fmtPct, family: 'pct' };
    if (c.id === 'radiation') return { v: c.value, fmt: function (x) { return doseParts(x)[0]; }, family: c.value != null && isFinite(c.value) ? doseParts(c.value)[1] : '' };
    return { v: c.value, fmt: function (x) { return fmtValue(x, c.unit); }, family: c.unit };
  }

  // On a step to another night (ruler or arrow keys, not during Play) a note's number counts from
  // the old value to the new one, and a note whose status changed pulses its ring (after the rings are drawn).
  var nightStep = false, shownNotes = {}, pulseIds = [];
  function renderCard(c) {
    var btn = document.querySelector('.card[data-card="' + c.id + '"]');
    if (!btn) return;
    btn.className = 'card st-' + c.status + (btn.classList.contains('is-hot') ? ' is-hot' : '');
    btn.setAttribute('aria-pressed', String(state.card === c.id));
    setStatus(btn, c.status);
    var L = noteLines(c), numNode = btn.querySelector('.num'), n = noteNumber(c), was = shownNotes[c.id];
    // A change to or from "no value" (null) swaps the text at once: only two real numbers count.
    var counted = nightStep && !!was && was.family === n.family && Number.isFinite(was.v) && Number.isFinite(n.v) && n.fmt(n.v) === L.num &&
      motion.valueTo(numNode, was.v, n.v, n.fmt);
    if (!counted) { motion.stopValue(numNode); swapText(numNode, L.num); }
    if (nightStep && was && was.status !== c.status) pulseIds.push(c.id);
    shownNotes[c.id] = { v: n.v, family: n.family, status: c.status };
    btn.querySelector('.unit').textContent = L.unit;
    var sub = btn.querySelector('.card-sub');
    sub.textContent = L.sub;
    sub.hidden = !L.sub;
  }

  // ---- radiation card: where tonight's number comes from (data/*.js, replayed) --------
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function longDate(iso) {
    var p = iso.split('-');
    return Number(p[2]) + ' ' + MONTHS[Number(p[1]) - 1] + ' ' + p[0];
  }
  // One sentence under the radiation chart: who measured tonight's number, and when.
  function renderRadSource() {
    var r = rec(), m = r.rad && r.rad.measured, p = $('rad-source');
    p.hidden = !m || state.card !== 'radiation';
    if (p.hidden) return;
    p.textContent = m.dataset === 'msl-rad' ?
      'Tonight\'s dose was measured on Mars by NASA\'s Curiosity rover on sol ' + m.sol + ', ' + longDate(m.date) + '.' :
      'Tonight\'s dose was measured in lunar orbit by NASA\'s Lunar Reconnaissance Orbiter on the night of ' + longDate(m.date) + '.';
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
  // The last stipple drawn, so the landing sequence can draw it again from head to feet (`figP`, 0 to 1).
  var lastStipple = null, figP = 1;
  function drawFigure(p) {
    figP = p;
    if (lastStipple) { lastStipple[4].progress = p; charts.stipple.apply(null, lastStipple); }
  }
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
      lastStipple = null;
      canvas.hidden = true;
      empty.hidden = true;
      charts.dotLegend(bar, null);
      $('cap-label').textContent = 'No image on baseline nights.';
      plateNote('Baseline nights are recorded on Earth before departure; images start at arrival.');
      return;
    }

    // `note` is set only in the states that need a sentence under the plate.
    var shown, ph, label, cap, note = '', overlay = null, outlineOnly = false, legend;
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
        cap = note = 'Radiation was raised on every night of the last week, so there is no density image for this week.';
      } else if (left) {
        note = left + ' of the last ' + nights.length + ' nights left out: raised radiation.';
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
          cap = note = 'Radiation was raised tonight, so tonight\'s tracks are left out of the density image.';
        }
      } else if (state.layer === 'pressure') {
        shown = imaging.render('pressure', ph, { env: r.env });
        shown.min = 0;
        unit = shown.unit;
        cap = 'The sleeper, seen from above. Pressure under the sleeper on the mattress.';
      } else {
        shown = imaging.render('impedance', ph, { eimPhaseDeg: r.eim ? r.eim.phase50_deg : NaN, baselinePhaseDeg: data.base.eim.median });
        overlay = outlineOverlay(shown, ph, isCalf);
        // Fixed scale around the baseline so a falling calf reading shows as a smaller dot.
        shown.min = data.base.eim.median * 0.75;
        shown.max = data.base.eim.median * 1.05;
        unit = shown.unit;
        cap = 'The sleeper, seen from above. Impedance phase of the calves; hollow dots outline the parts that are not measured.';
      }
      label = state.layer === 'pressure' ? 'Pressure under the sleeper' :
        state.layer === 'density' ? 'Areal density from cosmic-ray scattering' : shown.label;
      legend = outlineOnly ? null : { mode: 'raw', min: shown.min, max: shown.max, unit: unit, outline: state.layer === 'impedance' };
    }

    canvas.hidden = false;
    empty.hidden = true;
    lastStipple = [canvas, shown, ph, lay, { mode: state.view === 'diff' ? 'diff' : 'raw', overlay: overlay, dpr: Math.min(2, root.devicePixelRatio || 1), progress: figP }];
    charts.stipple.apply(null, lastStipple);
    canvas.setAttribute('aria-label', scrub(label) + ', ' + dayLabel(r));
    charts.dotLegend(bar, legend);
    $('cap-label').textContent = cap;
    plateNote(note);
  }

  // The quiet sentence under the plate; the dot legend moves up above it while it shows.
  function plateNote(text) {
    var n = $('plate-note');
    n.textContent = text;
    n.hidden = !text;
    $('plate').classList.toggle('has-note', !!text);
  }

  // ---- render: hotspots on the plate and their leaders to the margin notes ---------
  var HOTSPOT_PART = { sleep: 'Head', cardio: 'Chest', muscle: 'Calves', radiation: 'Whole body' };
  var SVG_NS = 'http://www.w3.org/2000/svg';
  function renderHotspots() {
    var lay = data.lay, noImage = rec().missionDay < 0, active = document.activeElement;
    // A focused hotspot about to be hidden hands its focus to its margin note.
    if (noImage && active && active.classList && active.classList.contains('hs')) {
      document.querySelector('.card[data-card="' + active.dataset.card + '"]').focus({ preventScroll: true });
    }
    Array.prototype.forEach.call(document.querySelectorAll('.hs'), function (b) {
      var id = b.dataset.card, c = card(id), word = charts.STATUS[c.status].word, at = HOTSPOT_CM[id];
      b.className = 'hs hs-' + id + ' st-' + c.status + (b.classList.contains('is-hot') ? ' is-hot' : '');
      b.hidden = noImage;
      b.setAttribute('aria-pressed', String(!noImage && state.card === id));
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

  function scrollTo(node) { node.scrollIntoView({ block: 'start', behavior: reducedMotion ? 'auto' : 'smooth' }); }
  // Open a check's row and bring it into view (the focus stays where it was); an open row only scrolls.
  function openCard(id) {
    if (state.card !== id) update({ card: id });
    scrollTo($('row-' + id));
  }

  // ---- render: the night ruler -----------------------------------------------------
  // A scenario event's label on the ruler, three words at most, so a visitor can find the nights.
  function rulerLabel(label) {
    var m = label.match(/^Measured: solar particle (events?)/);
    if (m) return m[1] === 'events' ? 'Solar events' : 'Solar event';
    return label.replace(/^EIM liner misplaced$/, 'Liner misplaced');
  }
  function renderTimeline() {
    var recs = data.gen.records, r = rec();
    var slider = $('day');
    slider.disabled = false;
    slider.max = String(recs.length - 1);
    slider.value = String(idx());
    slider.setAttribute('aria-valuetext', dayLabel(r) + ', ' + longDate(r.night));
    charts.ruler($('ruler'), {
      days: recs.map(function (x) { return x.missionDay; }), selected: idx(),
      events: data.gen.scenario.events.filter(function (e) { return data.dayIndex[e.from] !== undefined; }).map(function (e) {
        var to = data.dayIndex[e.to] !== undefined ? e.to : recs[recs.length - 1].missionDay;
        return { from: data.dayIndex[e.from], to: data.dayIndex[to], label: rulerLabel(e.label) };
      })
    });
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
  function eventMarker(e) { return { missionDay: e.from, label: rulerLabel(e.label) }; }
  // The arrival line and the scenario's events up to the selected night: a later event is not shown before it happens.
  function startMarkers() {
    var sc = data.gen.scenario;
    return [{ missionDay: 0, label: 'Arrival' }].concat(sc.events.filter(function (e) {
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
    } else if (cardId === 'sleep') {
      o.raw = engine.series(recs, 'sleep');
      o.thresholds = [
        { value: x.amberHours, label: 'Watch line: ' + x.amberHours + ' h', status: 'amber' },
        { value: x.redHours, label: 'Report line: ' + x.redHours + ' h', status: 'red' }
      ];
      o.unit = 'h'; o.yLabel = 'Sleep';
      legend.push(['line', WINDOW + '-night mean'], ['watch', 'Watch line'], ['report', 'Report line'], ['event', 'Event'], ['selected', 'Selected night']);
    } else if (cardId === 'cardio') {
      o.raw = engine.series(recs, 'hr');
      o.baseline = band(b.hr);
      var hrLim = x.hrLimit != null ? x.hrLimit : (b.hr.median != null ? b.hr.median + T.cardioSdMultiple.value * b.hr.sd : null);
      if (hrLim != null) o.thresholds = [{ value: hrLim, label: 'Watch line: baseline + ' + T.cardioSdMultiple.value + ' SD', shortLabel: 'Watch: +' + T.cardioSdMultiple.value + ' SD', status: 'amber' }];
      o.unit = 'bpm'; o.yLabel = 'Night heart rate';
      legend.push(['line', T.cardioNights.value + '-night median'], ['band', 'Own baseline range'], ['watch', 'Watch line'], ['event', 'Event'], ['selected', 'Selected night']);
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
    }
    if (o.axisBreak != null) legend.push(['break', 'Break: the transit is not monitored']);
    return { opts: o, legend: legend };
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

  // The open check's chart: under it one quiet line with the engine's numbers for the card, then
  // the legend; for radiation who measured the dose and the two closed sub-rows.
  function renderTrend() {
    var cardId = state.card;
    if (!cardId) return;
    var t = trendSpec(cardId);
    trendGeo = charts.line($('trend-chart'), t.opts);
    trendGeo.unit = t.opts.unit;
    if (readoutX != null) showReadout(readoutX);
    $('trend-note').textContent = scrub(card(cardId).reason);
    renderLegend(t.legend);

    var p = cardId === 'muscle' ? engine.project(data.gen.records, idx()) : null;
    var proj = $('projection');
    if (p && Math.round(p.slopePctPerWeek * 10) === 0) p = null;
    proj.hidden = !p;
    proj.textContent = p ? 'Weekly trend: ' + fmtPct(p.slopePctPerWeek) + ' per week. At this rate the weekly median reaches the Report line ' +
      (p.daysToRed <= 7 ? 'within about a week' : 'in about ' + p.daysToRed + ' days') + '; the nightly check can change sooner.' : '';

    renderRadSource();
    renderFlux(cardId);

    var r = rec(), roseRow = $('rose-row');
    var showRose = cardId === 'radiation' && r.rad && r.rad.dir;
    roseRow.hidden = !showRose;
    if (showRose) {
      // One night holds about a hundred counts, too few to read a direction; sum the mission so far.
      var sum = [0, 0, 0, 0, 0, 0, 0, 0];
      data.gen.records.slice(0, idx() + 1).forEach(function (x) {
        if (x.rad && x.rad.dir) x.rad.dir.forEach(function (n, j) { sum[j] += n; });
      });
      var k = charts.rose($('rose'), sum, { highlightMax: true });
      $('rose-reading').textContent = 'Most particles arrive from the ' + charts.ROSE_DIRECTIONS[k] + ' side.';
    }
  }

  // ---- the trend chart's readout ----------------------------------------------------
  // Under the pointer: a hairline at the nearest night and one line of text above the plot
  // ("Night 31 · 7.84 deg"; the value only up to the selected night, as the chart draws it). A click
  // on the chart goes to that night, as the ruler does. `trendGeo` is the last charts.line() result.
  var trendGeo = null, readoutX = null;
  function readoutDay(px) {
    var g = trendGeo;
    if (!g || !state.card || px < g.left - 8 || px > g.right + 8) return null;
    return charts.nearestDay(px, g.days, g.x);
  }
  function readoutText(day) {
    var i = data.dayIndex[day], c = data.assessments[i].cards[CARD_IDS.indexOf(state.card)], v = c.value;
    var shown = day <= state.d && v != null && isFinite(v);
    var value = !shown ? '' : c.unit === 'uGy' ? fmtDose(v) : fmtValue(v, c.unit) + ' ' + unitLabel(c.unit);
    return dayLabel(data.gen.records[i]) + (value ? ' · ' + value : '');
  }
  function hideReadout() {
    readoutX = null;
    var old = $('trend-chart').querySelector('.readout');
    if (old) old.parentNode.removeChild(old);
    $('trend-readout').textContent = '';
  }
  function showReadout(px) {
    var day = readoutDay(px);
    hideReadout();
    if (day == null) return;
    readoutX = px;
    var x = trendGeo.x(day).toFixed(1), g = svgEl('g', { 'class': 'readout' }, $('trend-chart'));
    svgEl('line', { x1: x, x2: x, y1: trendGeo.top, y2: trendGeo.bottom, 'class': 'readout-line' }, g);
    $('trend-readout').textContent = readoutText(day);
  }

  // Solar-event scenario only: OMNI2 proton flux near Earth, with the selected night's sleep window
  // shaded. Drawn while its sub-row is open (a closed row has no width to draw into).
  function renderFlux(cardId) {
    var row = $('flux-row'), sc = data.gen.scenario, omni = M.data && M.data.omniProtons;
    var show = cardId === 'radiation' && !!(sc.rad && sc.rad.checkSpe) && !!omni;
    row.hidden = !show;
    if (!show || !row.open) return;
    var pts = omni.rows.map(function (x) { return { t: Date.parse(x[0]), value: x[1] }; });
    var from = pts[0].t, to = pts[pts.length - 1].t + 3600000;
    var m = rec().rad && rec().rad.measured, shade = null;
    if (m) { var open = Date.parse(m.date + 'T22:00:00Z'); shade = { from: open, to: open + 8 * 3600000 }; }
    charts.logSeries($('flux-chart'), {
      points: pts, from: from, to: to, shade: shade, yMin: 0.1, yMax: 10000, yLabel: 'Protons >10 MeV (pfu)',
      label: 'Hourly proton flux above 10 MeV near Earth, 4 to 16 September 2017, logarithmic scale' +
        (shade && shade.to > from && shade.from < to ? '; the sleep window of the night of ' + longDate(m.date) + ' is shaded' : '')
    });
  }

  // ---- render: guidance ------------------------------------------------------------
  // NASA's material for one check (js/rules.js NASA), for the mission type of this world: the risk
  // and its rating sentence, NASA's two sentences as quotations, the standard, and the check's
  // context sentence (rules.CONTEXT) last.
  function nasaBlock(nx, world, ctx) {
    var frag = document.createDocumentFragment();
    var c1 = el('div', 'nasa-col');
    c1.appendChild(el('p', 'nasa-risk-name', nx.risk));
    c1.appendChild(el('p', 'nasa-small', nx.ratings[world].text));
    frag.appendChild(c1);
    var c2 = el('div', 'nasa-col');
    c2.appendChild(el('q', 'nasa-quote', nx.says));
    c2.appendChild(el('q', 'nasa-quote', nx.canBeDone));
    frag.appendChild(c2);
    var c3 = el('div', 'nasa-col nasa-more');
    nx.standard.forEach(function (x) { c3.appendChild(el('p', null, x.text)); });
    if (ctx) c3.appendChild(el('p', null, ctx.note));
    frag.appendChild(c3);
    return frag;
  }

  function renderGuidance() {
    if (!state.card) return;
    var c = card(state.card);
    var meaning = scrub(c.meaning);
    $('g-meaning').textContent = meaning;
    $('g-meaning').classList.toggle('statement-long', meaning.length > 150);   // a long meaning is set smaller
    var ul = $('g-actions');
    clear(ul);
    c.actions.forEach(function (x) { ul.appendChild(el('li', null, scrub(x))); });
    $('g-decides').textContent = capital(c.decides);
    var ctx = $('g-context');
    clear(ctx);
    ctx.appendChild(nasaBlock(rules.NASA[state.card], data.gen.scenario.env, rules.CONTEXT[state.card]));
  }

  // ---- render: the rows below the first screen ---------------------------------------
  // A status mark and word, with the word also read by a screen reader.
  function statusEl(status, word, size) {
    var wrap = el('span', 'status st-' + status);
    wrap.appendChild(charts.statusIconEl(status, size || 14));
    wrap.appendChild(el('span', 'status-word', word));
    return wrap;
  }

  // Each check row's meta (status and the value of its margin note), and which row is open: the
  // open row follows state.card, and the shared detail block moves into it. `open` is set only
  // when it differs, so the toggle events this causes find nothing to change (syncOpenRow).
  var shownCard = null, rowToOpen = null;
  // The sparkline in a check row's title: that check's nightly values for the 30 nights up to the
  // selected night (the series its trend chart judges), in the accent only on Watch or Report.
  var SPARK_W = 120, SPARK_H = 28, SPARK_NIGHTS = 30;
  function renderSpark(row, id, status) {
    var k = CARD_IDS.indexOf(id), i = idx(), vals = [];
    for (var j = Math.max(0, i - SPARK_NIGHTS + 1); j <= i; j++) vals.push(data.assessments[j].cards[k].value);
    var svg = row.querySelector('.spark');
    svg.setAttribute('class', 'spark st-' + status);
    charts.spark(svg, vals, SPARK_W, SPARK_H);
  }
  // The blocks of a row that fade up when it opens, and the line that draws in.
  function rowBlocks(row) {
    return row.classList.contains('check-row') ? [$('guidance'), $('trend'), $('nasa-row')] : row.querySelector('.row-body').children;
  }
  function openRowMotion(row) {
    motion.rowOpened(row, rowBlocks(row), row.classList.contains('check-row') ? $('trend-chart').querySelector('path.series') : null);
  }
  function renderRows() {
    Array.prototype.forEach.call(document.querySelectorAll('.check-row'), function (row) {
      var id = row.dataset.card, c = card(id), L = noteLines(c), meta = row.querySelector('.row-meta');
      clear(meta);
      meta.appendChild(statusEl(c.status, charts.STATUS[c.status].word));
      meta.appendChild(el('span', 'row-value', c.status === 'grey' ? '' : L.num + ' ' + L.unit));
      renderSpark(row, id, c.status);
      var open = state.card === id;
      if (row.open !== open) {
        row.open = open;
        if (open) rowToOpen = row; else motion.rowClosed(row);
      }
      if (open) {
        var body = row.querySelector('.row-body'), detail = $('check-detail');
        if (detail.parentNode !== body) body.appendChild(detail);
      }
    });
    // The sub-rows of the shared block close when another check opens.
    if (shownCard !== state.card) {
      Array.prototype.forEach.call(document.querySelectorAll('#check-detail .sub-row'), function (d) { d.open = false; });
      shownCard = state.card;
    }
  }

  // After any check row opens or closes, the open one in the page is the truth for the state.
  function syncOpenRow() {
    var open = document.querySelector('.check-row[open]'), id = open ? open.dataset.card : null;
    if (id !== state.card) update({ card: id });
  }

  // The three-step guide on the first screen.
  function renderGuide(ci) {
    var d1 = $('guide-checkin-detail');
    clear(d1);
    var t1 = el('span', 'guide-text', ci.done ? ci.summary : 'three questions, about 30 seconds');
    t1.title = t1.textContent;
    if (ci.done && ci.status === 'amber') {
      var mk = el('span', 'status st-amber');
      mk.appendChild(charts.statusIconEl('amber', 14));
      mk.appendChild(el('span', 'visually-hidden', charts.STATUS.amber.word + ': '));
      d1.appendChild(mk);
    }
    d1.appendChild(t1);

    // One button throughout, so a focused row 3 keeps its focus; with nothing to open it reads as plain text.
    var step = todayStep(assessment().cards, ci), row = $('guide-do');
    row.dataset.target = step.target || '';
    row.classList.toggle('is-plain', !step.target);
    if (step.target) row.removeAttribute('aria-disabled'); else row.setAttribute('aria-disabled', 'true');
    var d3 = $('guide-do-detail');
    clear(d3);
    // Up to two lines, with "+N more" at the end of the text.
    var t3 = el('span', 'guide-text guide-text-2', scrub(step.text));
    t3.title = t3.textContent;
    if (step.more) t3.appendChild(el('span', 'guide-more', ' +' + step.more + ' more'));
    d3.appendChild(t3);
  }

  // ---- render: morning check-in ------------------------------------------------------
  var CI = rules.CHECKIN;
  function checkinResult() {
    var sym = {};
    CI.symptoms.forEach(function (x) { sym[x.id] = state.sy.indexOf(x.letter) >= 0; });
    return engine.checkin({ mood: state.mo, tempC: state.tc, symptoms: sym }, assessment().cards);
  }
  function fmtTemp(c) { return c.toFixed(1) + ' °C'; }
  function clearTempField() { $('ci-temp').value = ''; setTempInvalid(false); }
  function setTempInvalid(on) {
    if (on) $('ci-temp').setAttribute('aria-invalid', 'true'); else $('ci-temp').removeAttribute('aria-invalid');
    $('ci-temp-hint').hidden = !on;
  }

  var ciShown = null;                              // the check-in status last drawn ('' when not done)
  function renderCheckin(r) {
    pressed('[data-mood]', 'mood', state.mo == null ? '' : String(state.mo));
    Array.prototype.forEach.call(document.querySelectorAll('[data-sym]'), function (b) {
      b.setAttribute('aria-pressed', String(state.sy.indexOf(b.dataset.sym) >= 0));
    });
    // The field is never rewritten while the person types in it.
    var input = $('ci-temp'), fieldTc = parseTemp(input.value);
    if (document.activeElement !== input && fieldTc !== state.tc && !(fieldTc == null && state.tc == null)) {
      input.value = state.tc == null ? '' : state.tc.toFixed(1);
      setTempInvalid(false);
    }
    $('ci-baseline').textContent = 'Your own baseline is ' + fmtTemp(T.checkinBaselineTempC.value) + '.';
    $('ci-clear').disabled = !r.done;

    var meta = $('checkin-meta');
    clear(meta);
    if (r.done) meta.appendChild(statusEl(r.status, CI.statusWords[r.status]));
    else meta.textContent = CI.statusWords.grey + ' · about 30 seconds';

    $('ci-meaning').textContent = r.meaning;
    $('ci-meaning').classList.toggle('statement-long', r.meaning.length > 150);
    $('ci-next').hidden = !r.done;
    var ol = $('ci-actions');
    clear(ol);
    r.actions.forEach(function (a) { ol.appendChild(el('li', null, a)); });
    $('ci-decides').textContent = r.decides + '.';

    var tableWasHidden = $('ci-compare').hidden;
    $('ci-compare').hidden = !r.done;
    var tb = $('ci-rows');
    clear(tb);
    r.rows.forEach(function (row) {
      var tr = el('tr'), th = el('th'), c = card(row.card);
      th.scope = 'row';
      var b = el('button', 'seg ci-card', CARD_NAMES[row.card]);
      b.type = 'button';
      b.dataset.card = row.card;
      th.appendChild(b);
      tr.appendChild(th);
      var said = '–';
      if (row.said !== null) {
        var sx = CI.symptoms.filter(function (x) { return x.card === row.card; })[0];
        var parts = [];
        if (state.sy.indexOf(sx.letter) >= 0) parts.push(sx.label);
        if (row.card === 'cardio' && r.temp && r.temp.raised) parts.push(fmtTemp(r.temp.valueC));
        said = parts.length ? parts.join('; ') : 'Nothing noticed';
      }
      tr.appendChild(el('td', null, said));
      var L = noteLines(c);
      tr.appendChild(el('td', null, row.bunk === 'grey' ? charts.STATUS.grey.word : charts.STATUS[row.bunk].word + ': ' + L.num + ' ' + L.unit));
      tr.appendChild(el('td', null, CI.verdicts[row.verdict]));
      tb.appendChild(tr);
    });
    // A changed status settles its marks; the table's rows fade in one after another as it appears.
    var token = r.done ? r.status : '';
    if (ciShown != null && token !== ciShown && token) motion.settle(document.querySelectorAll('#checkin-meta .st-icon, #guide-checkin-detail .st-icon'));
    if (ciShown != null && tableWasHidden && r.done) motion.fadeRows(tb.children);
    ciShown = token;
  }

  function openCheckin() {
    var row = $('checkin');
    if (!row.open) { row.open = true; openRowMotion(row); }
    scrollTo(row);
    document.querySelector('[data-mood="1"]').focus({ preventScroll: true });
  }

  // ---- render: what-if -------------------------------------------------------------
  function renderWhatIf() {
    var ex = $('adherence');
    ex.disabled = false;
    $('whatif-reset').disabled = false;
    ex.value = String(state.ex == null ? 1 : state.ex);
    $('adherence-out').textContent = state.ex == null ? 'As planned' : Math.round(state.ex * 100) + '%';
  }

  // ---- update cycle ----------------------------------------------------------------
  var lastView = null;
  function render() {
    var changed = ensureData();
    nightStep = !!lastView && lastView.s === state.s && lastView.key === data.key && lastView.d !== state.d && !playTimer;
    pulseIds = [];
    rowToOpen = null;
    var ci = checkinResult();
    renderTopbar();
    renderBrief();
    renderImage();
    renderHotspots();
    renderTimeline();
    renderRows();
    renderGuide(ci);
    renderTrend();
    renderGuidance();
    renderCheckin(ci);
    renderWhatIf();
    lastView = { s: state.s, d: state.d, key: data.key };
    // Motion that needs the finished drawing: the opened row's trend line, the rings drawn this time.
    if (rowToOpen) openRowMotion(rowToOpen);
    pulseIds.forEach(function (id) { motion.pulse($('plate-ink').querySelector('.hs-mark[data-card="' + id + '"] .hs-ring')); });
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
    var reset = checkinReset(state, changes || {});
    Object.keys(reset).forEach(function (k) { state[k] = reset[k]; });
    if (has(reset, 'tc')) clearTempField();
    Object.keys(changes || {}).forEach(function (k) { state[k] = changes[k]; });
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
    motion.setPlaying(on);
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
        openCard(b.dataset.card);
        // The comparison table is rebuilt on render: keep the focus on the same check's new button.
        if (b.classList.contains('ci-card')) document.querySelector('#ci-rows [data-card="' + b.dataset.card + '"]').focus({ preventScroll: true });
      }
      else if (b.dataset.mood) update({ mo: state.mo === +b.dataset.mood ? null : +b.dataset.mood });
      else if (b.dataset.sym) {
        var ch = b.dataset.sym;
        update({ sy: 'lri'.split('').filter(function (x) { return (x === ch) !== (state.sy.indexOf(x) >= 0); }).join('') });
      }
      else if (b.id === 'ci-clear') {
        clearTempField();
        update({ mo: null, tc: null, sy: '' });
        document.querySelector('[data-mood="1"]').focus();       // the button is now disabled
      }
      else if (b.id === 'guide-checkin') openCheckin();
      else if (b.id === 'guide-check') openCard(todayStep(assessment().cards, checkinResult()).card);
      else if (b.id === 'guide-do') {
        if (b.dataset.target === 'checkin') openCheckin(); else if (b.dataset.target) openCard(b.dataset.target);
      }
      else if (b.id === 'play') setPlaying(!playTimer);
      else if (b.id === 'whatif-reset') update({ ex: WHATIF.ex.def, gs: WHATIF.gs.def, sh: WHATIF.sh.def, nz: WHATIF.nz.def });
    });
    Array.prototype.forEach.call(document.querySelectorAll('.check-row'), function (row) {
      // A click on the title (or Enter or Space on it) changes the state at once, so the row opens
      // with its detail already inside; the toggle event covers openings this does not see.
      row.querySelector('summary').addEventListener('click', function (e) {
        e.preventDefault();
        update({ card: row.open ? null : row.dataset.card });
      });
      row.addEventListener('toggle', syncOpenRow);
    });
    // The other rows open and close here too, so an opening row starts its motion before it is drawn.
    Array.prototype.forEach.call(document.querySelectorAll('.row:not(.check-row)'), function (row) {
      row.querySelector('summary').addEventListener('click', function (e) {
        e.preventDefault();
        row.open = !row.open;
        if (row.open) openRowMotion(row); else motion.rowClosed(row);
      });
    });
    $('flux-row').addEventListener('toggle', function () { renderFlux(state.card); });
    // The trend chart: the pointer reads a night, a click goes to it.
    var chart = $('trend-chart');
    chart.addEventListener('pointermove', function (e) { showReadout(e.clientX - chart.getBoundingClientRect().left); });
    chart.addEventListener('pointerleave', hideReadout);
    var chartDown = null;
    chart.addEventListener('pointerdown', function (e) {
      chartDown = { x: e.clientX, y: e.clientY };
      if (e.pointerType === 'mouse') e.preventDefault();        // a press here reads a night; it starts no text selection
    });
    chart.addEventListener('click', function (e) {
      // A drag (or a press that started elsewhere) is not a tap; a press on the chart starts no
      // text selection (pointerdown above).
      var down = chartDown;
      chartDown = null;
      if (!isTap(down, { x: e.clientX, y: e.clientY })) return;
      var day = readoutDay(e.clientX - chart.getBoundingClientRect().left);
      if (day == null || day === state.d) return;
      setPlaying(false);
      update({ d: day });
    });
    // The skip link moves focus without replacing the view in the address.
    document.querySelector('.skip').addEventListener('click', function (e) {
      e.preventDefault();
      var t = $('brief-title');
      scrollTo(t);
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
    // A note or a hotspot under the pointer or the focus lights its pair on the plate.
    var brief = $('brief');
    function hotFrom(e) { var t = e.target.closest && e.target.closest('[data-card]'); setHot(t ? t.dataset.card : null); }
    brief.addEventListener('pointerover', hotFrom);
    brief.addEventListener('pointerleave', function () { setHot(null); });
    brief.addEventListener('focusin', hotFrom);
    brief.addEventListener('focusout', function () { setHot(null); });
    $('adherence').addEventListener('input', function (e) { update({ ex: snap(e.target.value, WHATIF.ex) }); });
    // Temperature: the state always mirrors the field, with the address rule (parseTemp). An
    // unfinished entry ("38.", which the field reports as empty and bad) leaves the state alone
    // while typing; anything else that is not a valid temperature clears it. Leaving the field
    // shows the hint for a non-empty invalid entry.
    function tempFromField(e, finished) {
      var v = e.target.value, bad = e.target.validity.badInput;
      if (v === '' && bad && !finished) return;
      var tc = v === '' ? null : parseTemp(v);
      if (tc != null || (v === '' && !bad)) setTempInvalid(false);
      else if (finished) setTempInvalid(true);
      if (tc !== state.tc) update({ tc: tc });
    }
    $('ci-temp').addEventListener('input', function (e) { tempFromField(e, false); });
    $('ci-temp').addEventListener('change', function (e) { tempFromField(e, true); });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.target.closest('input, select, textarea, [contenteditable], #checkin')) return;
      e.preventDefault();
      setPlaying(false);
      stepDay(e.key === 'ArrowRight' ? 1 : -1);
    });
    var pending = false;
    root.addEventListener('resize', function () {
      if (pending) return;
      pending = true;
      root.requestAnimationFrame(function () { pending = false; redrawFigures(); });
    });
    root.addEventListener('hashchange', function () {
      if (location.hash.indexOf('=') < 0) {             // a plain in-page anchor, not a view
        if (isBrokenAnchor(location.hash)) showNotice();
        return;
      }
      if (location.hash === hashFor(state)) return;
      setPlaying(false);
      renderFromLink(location.hash);
    });
  }

  // Figures whose drawing depends on their size or on the web fonts.
  function redrawFigures() { renderImage(); renderHotspots(); renderTimeline(); renderTrend(); }

  // The rows fade up a few pixels as they enter the viewport (not under reduced motion).
  function revealOnScroll() {
    if (reducedMotion || !root.IntersectionObserver) return;
    var io = new root.IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    document.documentElement.classList.add('motion');
    Array.prototype.forEach.call(document.querySelectorAll('.reveal'), function (n) { io.observe(n); });
  }

  // Elements only the script uses: a sparkline in each check row's title (decorative, the meta text
  // says the value) and the trend chart's readout line (pointer only; keyboard users have the ruler).
  function buildExtras() {
    Array.prototype.forEach.call(document.querySelectorAll('.check-row > summary'), function (sum) {
      var svg = svgEl('svg', { 'class': 'spark', width: SPARK_W, height: SPARK_H, 'aria-hidden': 'true', focusable: 'false' });
      sum.insertBefore(svg, sum.querySelector('.row-meta'));
    });
    var p = el('p', 'trend-readout');
    p.id = 'trend-readout';
    p.setAttribute('aria-hidden', 'true');
    $('trend').insertBefore(p, $('trend-chart'));
  }

  // ---- start -----------------------------------------------------------------------
  buildExtras();
  revealOnScroll();
  wire();
  var initialHash = location.hash;
  renderFromLink(initialHash.indexOf('=') >= 0 ? initialHash : '');
  if (initialHash.indexOf('=') < 0 && isBrokenAnchor(initialHash)) showNotice();
  // The landing sequence leads the eye through the three steps, ending on "Check in" when it is still to do.
  motion.intro({
    headline: $('headline'), guide: document.querySelectorAll('#guide > li'), drawFigure: drawFigure,
    ink: $('plate-ink'), notes: document.querySelectorAll('#cards .card'), ruler: $('ruler'),
    sweep: checkinResult().done ? null : document.querySelector('#guide-checkin .guide-name')
  });
  // Text measured in the figures changes once the web fonts are in: draw them again.
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(redrawFigures);
})(typeof globalThis !== 'undefined' ? globalThis : this);
