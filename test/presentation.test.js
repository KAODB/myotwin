// The atlas presentation: the headline split for Plate I (js/app.js, the block between "BEGIN
// presentation helpers" and "END presentation helpers", run in Node), the stipple dot sizing and
// plate layout, and the night ruler's mapping between pixels and nights (js/charts.js).
//
// Written with an SI tool (Claude) and reviewed by the team.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const charts = require('../js/charts.js');
const phantom = require('../js/phantom.js');
const sim = require('../js/sim.js');
const engine = require('../js/engine.js');

const app = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
const block = app.match(/\/\/ BEGIN presentation helpers\n([\s\S]*?)\n\s*\/\/ END presentation helpers/)[1];
const P = new Function(block + '\nreturn { splitHeadline, firstSentence };')();

test('a headline with a colon splits into a lead line and an emphasised, capitalised line', () => {
  assert.deepStrictEqual(P.splitHeadline('1 check to watch: muscle.'), { lead: 'One check to watch', em: 'Muscle.', more: '', size: 'l' });
  assert.deepStrictEqual(P.splitHeadline('2 checks to watch: muscle, heart and breathing.'),
    { lead: 'Two checks to watch', em: 'Muscle, heart and breathing.', more: '', size: 's' });
  const r = P.splitHeadline('Report to the flight surgeon today: radiation.');
  assert.strictEqual(r.lead, 'Report to the flight surgeon today');
  assert.strictEqual(r.em, 'Radiation.');
  assert.strictEqual(r.size, 'm');
});

test('a second sentence follows as `more`, with its leading digit as a word', () => {
  const r = P.splitHeadline('Report to the flight surgeon today: radiation. 1 check to watch: muscle.');
  assert.deepStrictEqual(r, { lead: 'Report to the flight surgeon today', em: 'Radiation.', more: 'One check to watch: muscle.', size: 'm' });
});

test('a headline without a colon in its first sentence is one line', () => {
  for (const h of ['All four checks are in your normal range.', 'No check has enough data tonight.',
    'The checks with enough data are in your normal range. Not enough data: sleep, radiation.']) {
    assert.deepStrictEqual(P.splitHeadline(h), { whole: h });
  }
  assert.deepStrictEqual(P.splitHeadline(''), { whole: '' });
});

test('every headline the engine writes in the three scenarios splits into non-empty parts', () => {
  for (const s of Object.keys(sim.SCENARIOS)) {
    const g = sim.generate(s);
    g.records.forEach((r, i) => {
      const h = engine.assess(g.records, i, { expectedChangePct: g.plan.expectedChangePct }).headline;
      const p = P.splitHeadline(h);
      if (p.whole != null) { assert.strictEqual(p.whole, h); return; }
      assert.ok(p.lead && p.em, s + ' ' + h);
      assert.match(p.em, /^[A-Z]/);
      assert.doesNotMatch(p.lead + p.more, /^\d|\. \d/, 'digits become words: ' + h);
    });
  }
});

test('firstSentence stops at the first full stop followed by a space', () => {
  assert.strictEqual(P.firstSentence('Sixty nights. Radiation replays LRO.'), 'Sixty nights.');
  assert.strictEqual(P.firstSentence('One only.'), 'One only.');
  assert.strictEqual(P.firstSentence('Sols 13-108 (2012). Rest.'), 'Sols 13-108 (2012).');
});

test('stipple dots: area follows the value; a loss is blue, a gain ink; overlays are quiet or hollow', () => {
  const cell = 10;
  const lo = charts.stippleDot(0, 0, 1, 'raw', 0, cell), hi = charts.stippleDot(1, 0, 1, 'raw', 0, cell);
  assert.ok(Math.abs(lo.r - 1.6) < 1e-9 && Math.abs(hi.r - 5) < 1e-9);
  assert.ok(Math.abs(lo.alpha - 0.22) < 1e-9 && Math.abs(hi.alpha - 0.94) < 1e-9);
  // Radius by the square root: a quarter of the value range gives half of the extra radius.
  assert.ok(Math.abs(charts.stippleDot(0.25, 0, 1, 'raw', 0, cell).r - (1.6 + 3.4 * 0.5)) < 1e-9);
  // Values outside the scale are clamped.
  assert.strictEqual(charts.stippleDot(5, 0, 1, 'raw', 0, cell).r, hi.r);
  assert.strictEqual(charts.stippleDot(-5, 0, 1, 'raw', 0, cell).r, lo.r);
  const loss = charts.stippleDot(-8, -10, 10, 'diff', 0, cell), gain = charts.stippleDot(8, -10, 10, 'diff', 0, cell);
  assert.strictEqual(loss.tone, 'blue');
  assert.strictEqual(gain.tone, 'ink');
  assert.strictEqual(loss.r, gain.r);
  assert.strictEqual(charts.stippleDot(-3, -10, 10, 'diff', 1, cell).tone, 'quiet');
  assert.ok(charts.stippleDot(-3, -10, 10, 'diff', 1, cell).r < lo.r);
  assert.strictEqual(charts.stippleDot(NaN, 0, 1, 'raw', 2, cell).tone, 'hollow');
  assert.strictEqual(charts.stippleDot(NaN, 0, 1, 'raw', 0, cell), null);
});

test('the plate layout centres the body at 78% of the plate height', () => {
  const ph = phantom.build(), lay = charts.plateLayout(ph, 600, 700, 0.78);
  assert.ok(Math.abs(lay.figH - 546) < 1e-9);
  assert.ok(Math.abs(lay.ox + lay.figW / 2 - 300) < 1e-9);
  assert.ok(Math.abs(lay.oy + lay.figH / 2 - 350) < 1e-9);
  // Body centimetres and cell centres agree: the centre of cell (col, row) is at its centimetre centre.
  const col = 20, row = 50;
  assert.ok(Math.abs(lay.px((col + 0.5) * ph.cellCm - ph.w * ph.cellCm / 2) - lay.cx(col)) < 1e-9);
  assert.ok(Math.abs(lay.py((row + 0.5) * ph.cellCm) - lay.cy(row)) < 1e-9);
});

test('ruler: pixels and nights map both ways, and the ends clamp', () => {
  const W = 1000, n = 104;
  for (let i = 0; i < n; i++) assert.strictEqual(charts.rulerIndex(charts.rulerX(i, W, n), W, n), i);
  assert.strictEqual(charts.rulerIndex(-50, W, n), 0);
  assert.strictEqual(charts.rulerIndex(W + 50, W, n), n - 1);
  // Halfway between two ticks rounds to the nearer one.
  const mid = (charts.rulerX(41, W, n) + charts.rulerX(42, W, n)) / 2;
  assert.strictEqual(charts.rulerIndex(mid - 0.5, W, n), 41);
  assert.strictEqual(charts.rulerIndex(mid + 0.5, W, n), 42);
  assert.strictEqual(charts.rulerIndex(10, W, 1), 0);
});

test('ruler: labels are spaced at least 34 px apart', () => {
  assert.strictEqual(charts.rulerStep(1000, 104), 10);
  assert.strictEqual(charts.rulerStep(340, 104), 20);
  for (const W of [200, 340, 600, 1000]) {
    const step = charts.rulerStep(W, 104);
    assert.ok(step * (W - 12) / 103 >= 34 || step === 100, W + ' px: step ' + step);
  }
});
