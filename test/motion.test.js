// js/motion.js without Anime.js and without a DOM: it loads, and every call does nothing and
// returns false without throwing, so the page works as before when the library is missing.
// Also the drawing helpers motion and the rows rely on: the stipple's `progress`, the sparkline
// mapping and the trend chart's nearest night.
//
// Written with an SI tool (Claude) and reviewed by the team.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

test('motion loads without anime or a DOM; every call returns false without throwing', () => {
  assert.strictEqual(typeof globalThis.anime, 'undefined');
  const motion = require('../js/motion.js');
  const calls = ['intro', 'finishIntro', 'introRunning', 'rowOpened', 'rowClosed', 'valueTo', 'stopValue', 'pulse', 'settle', 'fadeRows', 'setPlaying'];
  assert.deepStrictEqual(Object.keys(motion).sort(), calls.concat('countable').sort());
  const fakeNode = { textContent: '7.5', getAttribute: () => '9', setAttribute() {}, style: { removeProperty() {} } };
  assert.strictEqual(motion.intro({ headline: fakeNode, guide: [], drawFigure() { throw new Error('must not draw'); }, ink: null, notes: [], ruler: null, sweep: null }), false);
  assert.strictEqual(motion.rowOpened(fakeNode, [fakeNode], fakeNode), false);
  assert.strictEqual(motion.valueTo(fakeNode, 1, 2, String), false);
  assert.strictEqual(fakeNode.textContent, '7.5');
  assert.strictEqual(motion.pulse(fakeNode), false);
  assert.strictEqual(motion.settle([fakeNode]), false);
  assert.strictEqual(motion.fadeRows([fakeNode]), false);
  assert.strictEqual(motion.introRunning(), false);
  for (const k of ['finishIntro', 'rowClosed', 'stopValue', 'setPlaying']) assert.doesNotThrow(() => motion[k](fakeNode), k);
});

test('the page calls Anime.js only through js/motion.js, and motion writes no HTML', () => {
  const app = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
  const motion = fs.readFileSync(path.join(__dirname, '..', 'js', 'motion.js'), 'utf8');
  assert.doesNotMatch(app, /\banime\./);
  assert.doesNotMatch(motion, /innerHTML|outerHTML|insertAdjacentHTML|splitText|scrambleText|createSpring|onScroll/);
});

// A canvas stand-in that records what is drawn.
function canvasLog() {
  const log = [];
  const ctx = {
    setTransform() {}, clearRect() {}, beginPath() {}, fill() { log.push('fill ' + this.fillStyle); }, stroke() { log.push('stroke ' + this.strokeStyle); },
    arc(x, y, r) { log.push('arc ' + x.toFixed(3) + ',' + y.toFixed(3) + ',' + r.toFixed(3)); }
  };
  return { log, canvas: { width: 0, height: 0, getContext: () => ctx } };
}

test('stipple progress: 1 draws exactly what no progress draws, 0 draws nothing, in between the head first', () => {
  const charts = require('../js/charts.js');
  const phantom = require('../js/phantom.js');
  const imaging = require('../js/imaging.js');
  const ph = phantom.build();
  const img = imaging.render('pressure', ph, { env: 'moon' });
  img.min = 0;
  const lay = charts.plateLayout(ph, 600, 700, 0.78);
  const draw = (progress) => {
    const c = canvasLog(), opts = { mode: 'raw' };
    if (progress !== undefined) opts.progress = progress;
    return { n: charts.stipple(c.canvas, img, ph, lay, opts), log: c.log };
  };
  const full = draw(undefined), one = draw(1), zero = draw(0), half = draw(0.5);
  assert.ok(full.n > 500);
  assert.strictEqual(one.n, full.n);
  assert.deepStrictEqual(one.log, full.log);
  assert.strictEqual(zero.n, 0);
  assert.deepStrictEqual(zero.log, []);
  assert.ok(half.n > 0 && half.n < full.n);
  // At 0.5 only the upper body is drawn: every dot sits above the lowest dot of the whole figure by a wide margin.
  const ys = (log) => log.filter((s) => s.startsWith('arc')).map((s) => Number(s.split(',')[1]));
  assert.ok(Math.max(...ys(half.log)) < Math.max(...ys(full.log)) * 0.75);
});

test('sparkline points: evenly across the width, lowest value at the bottom, gaps kept, flat in the middle', () => {
  const { sparkPoints } = require('../js/charts.js');
  assert.deepStrictEqual(sparkPoints([1, null, 3], 120, 28, 3), [[3, 25], null, [117, 3]]);
  assert.deepStrictEqual(sparkPoints([2, 1, 1.5], 120, 28, 3), [[3, 3], [60, 25], [117, 14]]);
  assert.deepStrictEqual(sparkPoints([5, 5], 120, 28, 3), [[3, 14], [117, 14]]);
  assert.deepStrictEqual(sparkPoints([4], 120, 28, 3), [[60, 14]]);
  assert.deepStrictEqual(sparkPoints([null, NaN], 120, 28, 3), [null, null]);
});

test('trend readout: the night nearest to the pointer', () => {
  const { nearestDay } = require('../js/charts.js');
  const X = (d) => 100 + d * 10;
  const days = [-3, -2, -1, 0, 1, 2, 3];
  assert.strictEqual(nearestDay(100, days, X), 0);
  assert.strictEqual(nearestDay(114, days, X), 1);
  assert.strictEqual(nearestDay(116, days, X), 2);
  assert.strictEqual(nearestDay(-50, days, X), -3);
  assert.strictEqual(nearestDay(900, days, X), 3);
  assert.strictEqual(nearestDay(100, [], X), null);
});
