// js/motion.js when Anime.js fails: a fake `anime` whose animate() throws from its Nth call (N = 1
// to 8) against a minimal fake DOM. After the failure the page must look exactly as without motion
// (no inline opacity or transform, no drawing attributes, no data-wait, rings at their own radius,
// the figure drawn in full), nothing is thrown to the caller and motion stays off.
// Also the count guard: a change to or from "no value" never counts.
//
// Written with an SI tool (Claude) and reviewed by the team.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

function makeEl(tag, attrs) {
  const a = Object.assign({}, attrs || {});
  const props = new Map();
  const el = {
    tag, hidden: false, textContent: '', children: [],
    style: {
      setProperty(k, v) { props.set(k, String(v)); },
      removeProperty(k) { props.delete(k); }
    },
    getAttribute(k) { return k === 'style' ? (props.size ? [...props].map(([k2, v]) => k2 + ': ' + v).join('; ') : (a.style != null ? '' : null)) : (k in a ? a[k] : null); },
    setAttribute(k, v) { if (k === 'style') { a.style = ''; return; } a[k] = String(v); },
    removeAttribute(k) { if (k === 'style') { delete a.style; props.clear(); return; } delete a[k]; },
    hasAttribute(k) { return k in a; },
    querySelectorAll() { return []; },
    attrs: a, props, nodeType: 1
  };
  return el;
}
// Inline-style writes as Anime.js makes them (the attribute appears with the first property).
function setStyle(el, k, v) { el.attrs.style = ''; el.style.setProperty(k, v); }

function setup(N) {
  let calls = 0, after = 0, failed = false;
  const html = makeEl('html');
  html.addEventListener = () => {}; html.removeEventListener = () => {};
  const doc = { documentElement: html, addEventListener() {}, removeEventListener() {} };
  let now = 0, timer = null;
  const styleAll = (targets, props) => {
    const list = Array.isArray(targets) || (targets && typeof targets.length === 'number' && !targets.nodeType) ? [...targets] : [targets];
    list.forEach((t) => { if (t && t.nodeType) Object.keys(props).forEach((k) => setStyle(t, k === 'y' ? 'transform' : k === 'scale' ? 'transform' : k, '0')); });
  };
  const anime = {
    animate(targets, params) {
      if (failed) after++;
      if (++calls >= N) { failed = true; throw new Error('library failure ' + calls); }
      const props = {};
      Object.keys(params).forEach((k) => { if (k === 'opacity' || k === 'y' || k === 'scale' || k.startsWith('--')) props[k] = 1; });
      styleAll(targets, props);
      if (params.r) [].concat(targets).forEach((t) => t.setAttribute('r', '4.5'));
      return { cancel() {} };
    },
    utils: { set(targets, props) { styleAll(targets, props); }, cleanInlineStyles() {} },
    svg: { createDrawable(els) { return [...els].map((e) => { e.setAttribute('pathLength', '1000'); e.setAttribute('stroke-dasharray', '0 1010'); return e; }); } },
    stagger: () => () => 0,
    spring: () => ({}),
    createTimer(p) { timer = p; return { cancel() { timer = null; } }; }
  };
  globalThis.document = doc;
  globalThis.anime = anime;
  globalThis.performance = { now: () => now };
  const file = path.join(__dirname, '..', 'js', 'motion.js');
  delete require.cache[require.resolve(file)];
  const motion = require(file);
  // The parts of the page motion touches.
  const els = {
    headline: makeEl('p'), guide: [makeEl('li'), makeEl('li'), makeEl('li')], notes: [makeEl('b'), makeEl('b'), makeEl('b'), makeEl('b')],
    frame: [makeEl('rect'), makeEl('circle')], tracks: [makeEl('line')], leaders: [makeEl('polyline'), makeEl('polyline')],
    rings: [makeEl('circle', { r: '9' }), makeEl('circle', { r: '6.5' })], marks: [makeEl('line'), makeEl('circle')], sweep: makeEl('span'),
    blocks: [makeEl('div'), makeEl('div'), makeEl('div')], series: makeEl('path'), num: makeEl('span'), ring: makeEl('circle', { r: '9' }),
    icons: [makeEl('svg')], rows: [makeEl('tr'), makeEl('tr')]
  };
  const ink = makeEl('svg');
  ink.querySelectorAll = (sel) => sel === '.frame' ? els.frame : sel === '.frame-axis, .track' ? els.tracks :
    sel === '.leaders polyline' ? els.leaders : sel === '.rings circle' ? els.rings : [];
  const ruler = makeEl('svg');
  ruler.querySelectorAll = () => els.marks;
  const figure = [];
  const parts = { headline: els.headline, guide: els.guide, drawFigure: (p) => figure.push(p), ink, notes: els.notes, ruler, sweep: els.sweep };
  const tick = (to) => { while (timer && now < to) { now += 10; timer.onUpdate(); } if (timer && now >= 1600) timer.onComplete(); };
  return { motion, els, parts, tick, figure, html, info: () => ({ calls, after, failed }) };
}

function leftovers(env) {
  const bad = [];
  const all = [];
  Object.entries(env.els).forEach(([k, v]) => [].concat(v).forEach((e, i) => all.push([k + i, e])));
  for (const [name, e] of all) {
    if (e.props.size) bad.push(name + ' style ' + e.getAttribute('style'));
    if (e.hasAttribute('style')) bad.push(name + ' has a style attribute');
    for (const a of ['pathLength', 'stroke-dasharray', 'stroke-dashoffset', 'draw']) if (e.hasAttribute(a)) bad.push(name + ' ' + a);
  }
  if (env.els.rings[0].getAttribute('r') !== '9' || env.els.rings[1].getAttribute('r') !== '6.5' || env.els.ring.getAttribute('r') !== '9') bad.push('ring radius not restored');
  if (env.html.hasAttribute('data-wait')) bad.push('data-wait ' + env.html.getAttribute('data-wait'));
  return bad;
}

for (let N = 1; N <= 8; N++) {
  test('library throws from animate call ' + N + ' during the landing sequence: page as without motion, motion off', () => {
    const env = setup(N), m = env.motion;
    assert.doesNotThrow(() => { m.intro(env.parts); env.tick(1700); });
    assert.ok(env.info().failed, 'the library failed');
    assert.deepStrictEqual(leftovers(env), []);
    assert.strictEqual(env.figure[env.figure.length - 1], 1, 'figure drawn in full');
    assert.strictEqual(m.introRunning(), false);
    // Motion stays off: nothing reaches the library again and every call returns false.
    assert.strictEqual(m.rowOpened(null, env.els.blocks, env.els.series), false);
    assert.strictEqual(m.valueTo(env.els.num, 1, 2, String), false);
    assert.strictEqual(m.pulse(env.els.ring), false);
    assert.strictEqual(m.fadeRows(env.els.rows), false);
    assert.strictEqual(env.info().after, 0);
    assert.deepStrictEqual(leftovers(env), []);
  });

  test('library throws from animate call ' + N + ' after the landing: rows, counts, pulses, marks', () => {
    const env = setup(N), m = env.motion, e = env.els;
    assert.doesNotThrow(() => {
      m.rowOpened(null, e.blocks, e.series);
      m.valueTo(e.num, 1, 2, (x) => x.toFixed(1));
      m.pulse(e.ring);
      m.settle(e.icons);
      m.fadeRows(e.rows);
      m.rowOpened(null, e.blocks, e.series);
      m.settle(e.icons);
      m.fadeRows(e.rows);
    });
    assert.ok(env.info().failed, 'the library failed');
    assert.deepStrictEqual(leftovers(env), []);
    assert.strictEqual(env.info().after, 0, 'no call reaches the library after the failure');
  });
}

test('a count runs only between two real numbers; to or from "no value" swaps at once', () => {
  const { countable } = setup(99).motion;
  assert.strictEqual(countable(1, 2), true);
  assert.strictEqual(countable(-16.5, -16.9), true);
  for (const [a, b] of [[null, 56], [56, null], [undefined, 3], [NaN, 3], [3, Infinity], ['7', 8], [5, 5], [null, null]]) {
    assert.strictEqual(countable(a, b), false, a + ' -> ' + b);
  }
});
