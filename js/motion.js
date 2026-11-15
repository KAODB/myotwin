/*
 * MyoTwin motion: every animation on the page, through Anime.js (vendor/anime.umd.min.js, global
 * `anime`). js/app.js calls this small API at the right moments and never calls `anime` itself.
 *
 * Motion has one job: lead the eye from what this is to the three steps on landing, and confirm
 * what a click did. Every call is a no-op (and returns false) when `anime` is missing, when the reader asks for
 * reduced motion, or while the mission plays; the page then works exactly as without this file.
 * When an animation ends or is cut short, the inline styles and attributes it set are removed, so
 * the stylesheet is in charge again. Any key or pointer press during the landing sequence jumps
 * to its end state at once. Nothing here writes HTML: only opacity, transforms, CSS variables and
 * SVG attributes.
 * Loads in Node without a DOM (test/motion.test.js).
 *
 * Written with an SI tool (Claude) and reviewed by the team.
 */
(function (root) {
  'use strict';
  var ns = (root.MyoTwin = root.MyoTwin || {});
  var inNode = typeof module === 'object' && module.exports;

  var reduce = !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var playing = false, dead = false;                   // dead: the library failed once; motion stays off
  function lib() { var a = root.anime; return a && typeof a.animate === 'function' ? a : null; }
  function on() { return !dead && !reduce && !playing && !!root.document && !!lib(); }

  // ---- running animations and their clean-up ------------------------------------------
  // Each entry: { anim, els, after, tag, node }. finalize() is idempotent: it stops the animation,
  // writes the end state (after) and removes what the animation left on its elements.
  var entries = [];
  // Every element a motion function is about to change, registered BEFORE it is touched, with the
  // function that puts it back (an SVG attribute such as a ring's radius). An entry's end removes
  // its elements; after a failure fail() puts back whatever is still listed.
  var touched = new Map();
  function touch(els, restore) {
    list(els).forEach(function (el) { if (!touched.has(el) || restore) touched.set(el, restore || null); });
  }
  function untouch(els) { list(els).forEach(function (el) { touched.delete(el); }); }
  var STYLE_PROPS = ['opacity', 'transform', 'translate', 'scale', 'stroke-linecap'];
  var DRAW_ATTRS = ['pathLength', 'stroke-dasharray', 'stroke-dashoffset', 'draw'];

  function list(x) {
    if (!x) return [];
    if (x.nodeType || x === root) return [x];
    return Array.prototype.filter.call(x, Boolean);
  }
  function cleanEl(el) {
    if (!el || !el.style) return;
    STYLE_PROPS.forEach(function (p) { el.style.removeProperty(p); });
    if (el.getAttribute('style') === '') el.removeAttribute('style');
  }
  function finalize(e) {
    if (e.done) return;
    e.done = true;
    var i = entries.indexOf(e);
    if (i >= 0) entries.splice(i, 1);
    try { e.anim.cancel(); } catch (err) { /* already stopped */ }
    try { lib().utils.cleanInlineStyles(e.anim); } catch (err) { /* nothing to clean */ }
    try { if (e.after) e.after(); } catch (err) { /* the end state is the stylesheet's */ }
    e.els.forEach(cleanEl);
    untouch(e.els);
    if (e.raw) untouch(e.raw);
  }
  // Start one animation on `targets` (elements, or a plain object for `obj` counts).
  function run(targets, params, opt) {
    opt = opt || {};
    var e = { els: opt.obj ? [] : list(targets), raw: opt.raw || null, after: opt.after, tag: opt.tag || '', node: opt.node || null, done: false };
    touch(e.els);
    params.onComplete = function () { finalize(e); };
    e.anim = lib().animate(targets, params);
    entries.push(e);
    return e;
  }
  function stop(pred) { entries.filter(pred).forEach(finalize); }
  function stopAll() { entries.slice().forEach(finalize); }

  // An SVG line drawn in from its start (Anime.js drawable); the drawable's attributes are removed at the end.
  function draw(els, params, tag) {
    els = list(els);
    if (!els.length) return null;
    touch(els, undrawEl);
    var drawables = lib().svg.createDrawable(els);
    return run(drawables, Object.assign({ draw: ['0 0', '0 1'] }, params), {
      tag: tag, raw: els,
      after: function () {
        els.forEach(function (el) {
          DRAW_ATTRS.forEach(function (a) { el.removeAttribute(a); });
          cleanEl(el);
        });
      }
    });
  }
  function undrawEl(el) { DRAW_ATTRS.forEach(function (a) { el.removeAttribute(a); }); cleanEl(el); }
  // Animate an SVG attribute (for example a ring's radius) and write its own value back at the end.
  function attr(el, name, params, tag) {
    var orig = el.getAttribute(name), p = {};
    touch(el, function () { el.setAttribute(name, orig); });
    p[name] = params.values;
    Object.keys(params).forEach(function (k) { if (k !== 'values') p[k] = params[k]; });
    return run(el, p, { tag: tag, raw: [el], after: function () { el.setAttribute(name, orig); } });
  }
  function spring(duration, bounce) { return lib().spring({ duration: duration, bounce: bounce }); }

  // ---- A. the landing sequence ---------------------------------------------------------
  // Parts not yet shown are hidden by tokens in <html data-wait>, read by css/style.css.
  var WAIT = ['h1', 'h2', 'h3', 'h4', 'h5', 's1', 's2', 's3'];
  var intro = null;                                     // { timer, steps, p } while it runs

  function setWait(tokens) {
    var h = root.document.documentElement;
    if (tokens.length) h.setAttribute('data-wait', tokens.join(' ')); else h.removeAttribute('data-wait');
  }
  function unwait(token) {
    var h = root.document.documentElement, t = (h.getAttribute('data-wait') || '').split(' ');
    setWait(t.filter(function (x) { return x && x !== token; }));
  }
  // Show a hidden part from opacity 0: set it inline first, so lifting its token never shows a frame at full.
  function fadeIn(els, params, token, tag) {
    els = list(els);
    touch(els);
    if (els.length) lib().utils.set(els, { opacity: 0 });
    if (token) unwait(token);
    if (!els.length) return null;
    return run(els, Object.assign({ opacity: [0, 1] }, params), { tag: tag });
  }

  /**
   * The landing sequence, once per page load, at most 1.2 s: the five parts of the landing section
   * (label, title, lead, buttons, the live line) rise in one after another, then the three step
   * cards one after another.
   * p: { hero: [x5], steps: [li x3] }
   * Returns true when the sequence runs.
   */
  function startIntro(p) {
    if (!on() || intro) return false;
    var doc = root.document;
    intro = { p: p, fired: 0 };                          // set first, so a failure below still ends it
    setWait(WAIT);
    var hero = list(p.hero), cards = list(p.steps), steps = [];
    hero.forEach(function (el, k) {
      steps.push([k * 90, function () { fadeIn(el, { y: [12, 0], duration: 320, ease: 'outQuad' }, 'h' + (k + 1), 'intro'); }]);
    });
    cards.forEach(function (el, k) {
      steps.push([480 + k * 140, function () { fadeIn(el, { y: [14, 0], duration: 340, ease: 'outQuad' }, 's' + (k + 1), 'intro'); }]);
    });
    intro.steps = steps;
    var t0 = root.performance.now();
    // One timer drives the steps; each step finds its elements when it starts.
    intro.timer = lib().createTimer({
      duration: 1200,
      onUpdate: function () {
        var t = root.performance.now() - t0;
        try {
          while (intro && intro.fired < steps.length && steps[intro.fired][0] <= t) steps[intro.fired++][1]();
        } catch (err) { fail(); }
      },
      // At 1.2 s whatever is still moving jumps to its end, so the sequence never runs longer.
      onComplete: endIntro
    });
    ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(function (type) {
      doc.addEventListener(type, endIntro, { capture: true, passive: true });
    });
    return true;
  }

  /** Jump the landing sequence to its end state at once (any key or pointer press does this). */
  function finishIntro() {
    if (!intro) return;
    var timer = intro.timer;
    intro = null;
    ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(function (type) {
      root.document.removeEventListener(type, endIntro, { capture: true, passive: true });
    });
    try { if (timer) timer.cancel(); } catch (err) { /* already done */ }
    try { stop(function (e) { return e.tag === 'intro'; }); } finally { setWait([]); }
  }
  // The input listener: ending the sequence must never throw into the page's own handlers.
  function endIntro() { try { finishIntro(); } catch (err) { fail(); } }

  // ---- B. a row opens ------------------------------------------------------------------
  /**
   * The direct blocks of an opened row fade up a few px one after another; `path` (a trend line)
   * draws in. Closing is instant: rowClosed() and any later rowOpened() cut a running opening short.
   */
  function rowOpened(row, blocks, path) {
    stop(function (e) { return e.tag === 'row'; });
    if (!on() || intro) return false;
    blocks = list(blocks).filter(function (b) { return !b.hidden; });
    if (blocks.length) {
      touch(blocks);
      lib().utils.set(blocks, { opacity: 0, y: 6 });
      run(blocks, { opacity: [0, 1], y: [6, 0], duration: 260, ease: 'outQuad', delay: lib().stagger(60) }, { tag: 'row', node: row });
    }
    if (path) draw(path, { duration: 300, ease: 'inOutQuad', delay: 60 }, 'row');
    return true;
  }
  function rowClosed() { stop(function (e) { return e.tag === 'row'; }); }

  // ---- C. values and pulses ------------------------------------------------------------
  /**
   * Count a number in `node` from `from` to `to` (about 200 ms), each frame written with
   * `format`; the last text is format(to). Returns false (and changes nothing) when it does not run.
   */
  function valueTo(node, from, to, format) {
    stopValue(node);
    if (!on() || intro || !node || !countable(from, to)) return false;
    var o = { v: from };
    run(o, { v: to, duration: 200, ease: 'outQuad', onUpdate: function () { node.textContent = format(o.v); } },
      { obj: true, tag: 'value', node: node, after: function () { node.textContent = format(to); } });
    return true;
  }
  /** True when a count can run: two different real numbers (null, '–' or NaN at either end swaps at once). */
  function countable(from, to) { return Number.isFinite(from) && Number.isFinite(to) && from !== to; }
  /** End a running count in `node` at its last value. */
  function stopValue(node) { stop(function (e) { return e.tag === 'value' && e.node === node; }); }

  /** One pulse on an SVG ring: its radius swells and returns. */
  function pulse(ring) {
    if (!on() || intro || !ring || !ring.getAttribute) return false;
    var r = +ring.getAttribute('r');
    if (!(r > 0)) return false;
    attr(ring, 'r', { values: [r, r * 1.7, r], duration: 300, ease: 'outQuad' }, 'pulse');
    return true;
  }

  // ---- D. a status mark settles ---------------------------------------------------------
  /** A status mark that has just changed settles into place with a spring. */
  function settle(els) {
    els = list(els);
    if (!on() || intro || !els.length) return false;
    run(els, { scale: [0.4, 1], duration: 300, ease: spring(260, 0.45) }, { tag: 'settle' });
    return true;
  }
  /** Table rows (or any blocks) fade in one after another. */
  function fadeRows(els) {
    els = list(els);
    if (!on() || intro || !els.length) return false;
    touch(els);
    lib().utils.set(els, { opacity: 0 });
    run(els, { opacity: [0, 1], duration: 220, ease: 'outQuad', delay: lib().stagger(50) }, { tag: 'rows' });
    return true;
  }

  // ---- play ----------------------------------------------------------------------------
  /** While the mission plays nothing animates: starting play ends everything at once. */
  function setPlaying(isOn) {
    playing = !!isOn;
    if (playing) { finishIntro(); stopAll(); }
  }

  /** True while the landing sequence runs. */
  function introRunning() { return !!intro; }

  // Any error inside the library: motion stays off for the rest of the page's life, and the page
  // is put back exactly as it is without motion (every touched element cleaned, nothing waiting). Each undo step runs on its own, so one failure cannot stop the rest.
  function fail() {
    dead = true;
    var safe = function (f) { try { f(); } catch (err) { /* keep undoing */ } };
    safe(finishIntro);
    intro = null;
    entries.slice().forEach(function (e) { safe(function () { finalize(e); }); });
    entries = [];
    touched.forEach(function (restore, el) { safe(function () { if (restore) restore(el); cleanEl(el); }); });
    touched.clear();
    safe(function () { if (root.document) setWait([]); });
  }
  // Every call stays safe: an error ends all motion (fail) and the page carries on.
  function guard(fn) {
    return function () {
      try { return fn.apply(null, arguments); } catch (err) { fail(); return false; }
    };
  }

  var api = {
    intro: guard(startIntro),
    finishIntro: guard(finishIntro),
    introRunning: introRunning,
    rowOpened: guard(rowOpened),
    rowClosed: guard(rowClosed),
    valueTo: guard(valueTo),
    stopValue: guard(stopValue),
    pulse: guard(pulse),
    settle: guard(settle),
    fadeRows: guard(fadeRows),
    setPlaying: guard(setPlaying),
    countable: countable
  };
  ns.motion = api;
  if (inNode) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
