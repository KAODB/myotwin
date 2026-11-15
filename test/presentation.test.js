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
const P = new Function(block + '\nreturn { splitHeadline, firstSentence, todayStep };')();
const rules = require('../js/rules.js');

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
  for (const h of ['Nothing to report tonight.', 'The brief appears here once the mission loads. It takes a moment.']) {
    assert.deepStrictEqual(P.splitHeadline(h), { whole: h });
  }
  assert.deepStrictEqual(P.splitHeadline(''), { whole: '' });
});

// Every headline the engine writes has a lead line and one emphasised line, so the first
// screen is the same height whatever the night says.
test('the all-clear and the not-enough-data headlines split like the others', () => {
  assert.deepStrictEqual(P.splitHeadline('All four checks: in range.'), { lead: 'All four checks', em: 'In range.', more: '', size: 'm' });
  assert.deepStrictEqual(P.splitHeadline('Not enough data yet: sleep, radiation.'), { lead: 'Not enough data yet', em: 'Sleep, radiation.', more: '', size: 's' });
  assert.deepStrictEqual(P.splitHeadline('Not enough data yet: all four checks.'), { lead: 'Not enough data yet', em: 'All four checks.', more: '', size: 's' });
});

test('every headline the engine writes in the three scenarios splits into non-empty parts', () => {
  for (const s of Object.keys(sim.SCENARIOS)) {
    const g = sim.generate(s);
    g.records.forEach((r, i) => {
      const h = engine.assess(g.records, i, { expectedChangePct: g.plan.expectedChangePct }).headline;
      const p = P.splitHeadline(h);
      assert.strictEqual(p.whole, undefined, s + ' night ' + r.missionDay + ' has a one-line headline: ' + h);
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

// The guide's rows 2 and 3 (todayStep), on every night of the three scenarios, without and with a
// check-in on Watch.
function checkinFor(cards, flagged) {
  const sym = flagged ? { legs: false, tired: false, ill: true } : { legs: false, tired: false, ill: false };
  return engine.checkin({ mood: flagged ? 1 : 4, tempC: flagged ? 38.4 : 36.6, symptoms: sym }, cards);
}
test('todayStep: every night of S1, S2 and S3 gives a step with text; Report beats Watch; "+N more" counts the rest', () => {
  let seen = { red: 0, amber: 0, checkin: 0, none: 0 };
  for (const s of Object.keys(sim.SCENARIOS)) {
    const g = sim.generate(s);
    g.records.forEach((r, i) => {
      const cards = engine.assess(g.records, i, { expectedChangePct: g.plan.expectedChangePct }).cards;
      for (const flagged of [false, true]) {
        const ci = checkinFor(cards, flagged), t = P.todayStep(cards, ci);
        const where = s + ' night ' + r.missionDay + (flagged ? ' with check-in' : '');
        assert.ok(typeof t.text === 'string' && t.text.length > 0, where);
        const red = cards.filter((c) => c.status === 'red'), amber = cards.filter((c) => c.status === 'amber');
        const src = red[0] || amber[0];
        if (src) {
          assert.strictEqual(t.card, src.id, where);
          assert.strictEqual(t.target, src.id, where);
          assert.strictEqual(t.text, src.actions[0], where);
          assert.strictEqual(t.more, src.actions.length - 1, where);
          seen[red.length ? 'red' : 'amber']++;
        } else if (ci.status === 'amber') {
          assert.strictEqual(t.card, 'muscle', where);
          assert.strictEqual(t.target, 'checkin', where);
          assert.strictEqual(t.text, ci.actions[0], where);
          assert.strictEqual(t.more, ci.actions.length - 1, where);
          seen.checkin++;
        } else {
          assert.deepStrictEqual(t, { card: 'muscle', target: null, text: 'Nothing new. Keep the plan.', more: 0 }, where);
          seen.none++;
        }
      }
    });
  }
  for (const k of Object.keys(seen)) assert.ok(seen[k] > 0, 'case reached: ' + k);
});

test('todayStep: Report beats Watch whatever the order, and the check-in is used only when no card is flagged', () => {
  const c = (id, status, n) => ({ id, status, actions: Array.from({ length: n }, (_, k) => id + ' action ' + (k + 1)) });
  const ciAmber = { status: 'amber', actions: ['Tell the medic today.', 'Take your temperature again this evening.'] };
  let t = P.todayStep([c('muscle', 'amber', 3), c('sleep', 'green', 1), c('cardio', 'green', 1), c('radiation', 'red', 2)], ciAmber);
  assert.deepStrictEqual(t, { card: 'radiation', target: 'radiation', text: 'radiation action 1', more: 1 });
  t = P.todayStep([c('muscle', 'green', 1), c('sleep', 'amber', 2), c('cardio', 'amber', 1), c('radiation', 'grey', 1)], ciAmber);
  assert.deepStrictEqual(t, { card: 'sleep', target: 'sleep', text: 'sleep action 1', more: 1 });
  t = P.todayStep([c('muscle', 'green', 1), c('sleep', 'green', 1), c('cardio', 'grey', 1), c('radiation', 'green', 1)], ciAmber);
  assert.deepStrictEqual(t, { card: 'muscle', target: 'checkin', text: 'Tell the medic today.', more: 1 });
  t = P.todayStep([c('muscle', 'green', 1), c('sleep', 'green', 1), c('cardio', 'green', 1), c('radiation', 'green', 1)], { status: 'green', actions: ['No change needed.'] });
  assert.strictEqual(t.target, null);
  assert.strictEqual(P.todayStep([c('muscle', 'amber', 1)], null).more, 0);
  assert.ok(rules.CHECKIN.actions.fever.length >= 1);
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
