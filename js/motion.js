/*
 * MyoTwin motion: every animation on the page, through Anime.js (vendor/anime.umd.min.js, global
 * `anime`). js/app.js calls this small API at the right moments and never calls `anime` itself.
 *
 * Motion has one job: lead the eye through the three steps on landing and confirm what a click
 * did. Every call is a no-op (and returns false) when `anime` is missing, when the reader asks for
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
  var playing = false;
  function lib() { var a = root.anime; return a && typeof a.animate === 'function' ? a : null; }
  function on() { return !reduce && !playing && !!root.document && !!lib(); }

  // ---- running animations and their clean-up ------------------------------------------
  // Each entry: { anim, els, after, tag, node }. finalize() is idempotent: it stops the animation,
  // writes the end state (after) and removes what the animation left on its elements.
  var entries = [];
  var STYLE_PROPS = ['opacity', 'transform', 'translate', 'scale', '--sweep', '--sweep-o', 'stroke-linecap'];
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
  }
  // Start one animation on `targets` (elements, or a plain object for `obj` counts).
  function run(targets, params, opt) {
    opt = opt || {};
    var e = { els: opt.obj ? [] : list(targets), after: opt.after, tag: opt.tag || '', node: opt.node || null, done: false };
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
    var drawables = lib().svg.createDrawable(els);
    return run(drawables, Object.assign({ draw: ['0 0', '0 1'] }, params), {
      tag: tag,
      after: function () {
        els.forEach(function (el) {
          DRAW_ATTRS.forEach(function (a) { el.removeAttribute(a); });
          cleanEl(el);
        });
      }
    });
  }
  // Animate an SVG attribute (for example a ring's radius) and write its own value back at the end.
  function attr(el, name, params, tag) {
    var orig = el.getAttribute(name), p = {};
    p[name] = params.values;
    Object.keys(params).forEach(function (k) { if (k !== 'values') p[k] = params[k]; });
    return run(el, p, { tag: tag, after: function () { el.setAttribute(name, orig); } });
  }
  function spring(duration, bounce) { return lib().spring({ duration: duration, bounce: bounce }); }

  // ---- A. the landing sequence ---------------------------------------------------------
  // Parts not yet shown are hidden by tokens in <html data-wait>, read by css/style.css, so a
  // part the page draws again during the sequence (the ink layer, the ruler) stays hidden too.
  var WAIT = ['headline', 'g1', 'g2', 'g3', 'frame', 'marks', 'n1', 'n2', 'n3', 'n4', 'mark'];
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
    if (els.length) lib().utils.set(els, { opacity: 0 });
    if (token) unwait(token);
    if (!els.length) return null;
    return run(els, Object.assign({ opacity: [0, 1] }, params), { tag: tag });
  }

  /**
   * The landing sequence, once per page load, about 1.6 s with the steps overlapping slightly:
   * the headline; the three guide rows in order; the figure drawn from head to feet; the plate
   * frame and the leaders drawing in, the rings settling; the four notes one after another; the
   * ruler marker dropping to its night; one underline sweep on guide row 1 (when `sweep` is given).
   * p: { headline, guide: [li x3], drawFigure(progress), ink: svg, notes: [x4], ruler: svg, sweep: el|null }
   * Returns true when the sequence runs.
   */
  function startIntro(p) {
    if (!on() || intro) return false;
    var doc = root.document;
    setWait(WAIT);
    p.drawFigure(0);
    var fig = { v: 0 };
    var q = function (sel) { return p.ink.querySelectorAll(sel); };
    var steps = [
      [0, function () { fadeIn(p.headline, { y: [10, 0], duration: 280, ease: 'outQuad' }, 'headline', 'intro'); }],
      [110, function () { fadeIn(p.guide[0], { y: [8, 0], duration: 240, ease: 'outQuad' }, 'g1', 'intro'); }],
      [210, function () { fadeIn(p.guide[1], { y: [8, 0], duration: 240, ease: 'outQuad' }, 'g2', 'intro'); }],
      [310, function () { fadeIn(p.guide[2], { y: [8, 0], duration: 240, ease: 'outQuad' }, 'g3', 'intro'); }],
      [180, function () {
        run(fig, { v: 1, duration: 720, ease: 'inOutSine', onUpdate: function () { p.drawFigure(fig.v); } },
          { obj: true, tag: 'intro', after: function () { p.drawFigure(1); } });
      }],
      [300, function () {
        var frame = q('.frame');
        if (frame.length) lib().svg.createDrawable(frame);   // starts them at "0 0" (hidden) before the token lifts
        unwait('frame');
        draw(frame, { duration: 620, ease: 'inOutQuad' }, 'intro');
        fadeIn(q('.frame-axis, .track'), { duration: 400, ease: 'linear' }, null, 'intro');
      }],
      [820, function () {
        var leaders = q('.leaders polyline');
        if (leaders.length) lib().svg.createDrawable(leaders);
        // Each ring grows from nothing with a spring; it holds r = 0 until its turn, and its own r comes back at the end.
        Array.prototype.forEach.call(q('.rings circle'), function (c, k) {
          var r = +c.getAttribute('r');
          attr(c, 'r', { values: [0, r], delay: 80 + 50 * k, ease: spring(280, 0.35) }, 'intro');
          c.setAttribute('r', '0');
        });
        unwait('marks');
        draw(leaders, { duration: 300, ease: 'outQuad', delay: lib().stagger(60) }, 'intro');
      }],
      [900, function () { fadeIn(p.notes[0], { duration: 240, ease: 'outQuad' }, 'n1', 'intro'); }],
      [1000, function () { fadeIn(p.notes[1], { duration: 240, ease: 'outQuad' }, 'n2', 'intro'); }],
      [1100, function () { fadeIn(p.notes[2], { duration: 240, ease: 'outQuad' }, 'n3', 'intro'); }],
      [1200, function () { fadeIn(p.notes[3], { duration: 240, ease: 'outQuad' }, 'n4', 'intro'); }],
      [1100, function () {
        fadeIn(p.ruler.querySelectorAll('.ruler-mark, .ruler-mark-dot'), { y: [-12, 0], duration: 280, ease: 'outQuad' }, 'mark', 'intro');
      }],
      [1300, function () {
        if (!p.sweep) return;
        run(p.sweep, { '--sweep': [0, 1, 1], '--sweep-o': [1, 1, 0], duration: 300, ease: 'linear' }, { tag: 'intro' });
      }]
    ].sort(function (a, b) { return a[0] - b[0]; });
    intro = { steps: steps, p: p, fired: 0 };
    var t0 = root.performance.now();
    // One timer drives the steps; each step finds its elements when it starts.
    intro.timer = lib().createTimer({
      duration: 1600,
      onUpdate: function () {
        var t = root.performance.now() - t0;
        try {
          while (intro && intro.fired < steps.length && steps[intro.fired][0] <= t) steps[intro.fired++][1]();
        } catch (err) { finishIntro(); }
      },
      // At 1.6 s whatever is still moving jumps to its end, so the sequence never runs longer.
      onComplete: function () { finishIntro(); }
    });
    ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(function (type) {
      doc.addEventListener(type, finishIntro, { capture: true, passive: true });
    });
    return true;
  }

  /** Jump the landing sequence to its end state at once (any key or pointer press does this). */
  function finishIntro() {
    if (!intro) return;
    var p = intro.p, timer = intro.timer;
    intro = null;
    ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(function (type) {
      root.document.removeEventListener(type, finishIntro, { capture: true, passive: true });
    });
    try { timer.cancel(); } catch (err) { /* already done */ }
    stop(function (e) { return e.tag === 'intro'; });
    setWait([]);
    p.drawFigure(1);
  }

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
    if (!on() || intro || !node || !isFinite(from) || !isFinite(to) || from === to) return false;
    var o = { v: from };
    run(o, { v: to, duration: 200, ease: 'outQuad', onUpdate: function () { node.textContent = format(o.v); } },
      { obj: true, tag: 'value', node: node, after: function () { node.textContent = format(to); } });
    return true;
  }
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

  // Every call stays safe: an error inside the library ends all motion and the page carries on.
  function guard(fn) {
    return function () {
      try { return fn.apply(null, arguments); } catch (err) {
        try { finishIntro(); stopAll(); } catch (e2) { /* nothing more to undo */ }
        return false;
      }
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
    setPlaying: guard(setPlaying)
  };
  ns.motion = api;
  if (inNode) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
