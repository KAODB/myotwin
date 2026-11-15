// The presentation helpers: the headline split for Step 1, the body image's explanation, the step
// cards' state lines and Today's list (js/app.js, the block between "BEGIN
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
const P = new Function(block + '\nreturn { splitHeadline, firstSentence, isTap, imageExplain, stepStates, todayPlan };')();
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

// The three helpers of the landing section, the body image and Today, on every night of the three
// scenarios, without and with a check-in on Watch.
function checkinFor(cards, flagged) {
  const sym = flagged ? { legs: false, tired: false, ill: true } : { legs: false, tired: false, ill: false };
  return engine.checkin({ mood: flagged ? 1 : 4, tempC: flagged ? 38.4 : 36.6, symptoms: sym }, cards);
}
const notDone = () => engine.checkin({}, []);
function everyNight(fn) {
  for (const s of Object.keys(sim.SCENARIOS)) {
    const g = sim.generate(s);
    g.records.forEach((r, i) => {
      const cards = engine.assess(g.records, i, { expectedChangePct: g.plan.expectedChangePct }).cards;
      for (const ci of [notDone(), checkinFor(cards, false), checkinFor(cards, true)]) {
        fn(cards, ci, s + ' night ' + r.missionDay + ' check-in ' + ci.status);
      }
    });
  }
}

test('imageExplain: one text for each of the six layer and view combinations, naming every mark its view draws', () => {
  const names = { density: 'Density', pressure: 'Pressure', impedance: 'Impedance' };
  // What each view draws (js/app.js renderImage, charts.stipple): raw dots scale with the value;
  // the change view draws a loss blue and a gain ink (white); density's change view greys out regions
  // below the noise; impedance outlines the parts it does not measure with hollow dots.
  const marks = {
    'density raw': [/bigger, brighter dots/i, /denser tissue/],
    'pressure raw': [/bigger dots/i, /more pressure/],
    'impedance raw': [/bigger dots/i, /hollow dots outline/],
    'density diff': [/first week/, /blue dots mean less/i, /white dots more/, /small grey dots/, /noise/],
    'pressure diff': [/first week/, /blue dots mean less/i, /white dots more/],
    'impedance diff': [/first week/, /blue dots mean less/i, /white dots more/, /hollow dots outline/]
  };
  const texts = new Set();
  for (const layer of ['density', 'pressure', 'impedance']) for (const view of ['raw', 'diff']) {
    const e = P.imageExplain(layer, view);
    assert.strictEqual(e.name, names[layer]);
    assert.match(e.text, /^is /, 'reads on from the name');
    for (const re of marks[layer + ' ' + view]) assert.match(e.text, re, layer + ' ' + view);
    if (view === 'raw') assert.doesNotMatch(e.text, /blue dots|grey dots/, layer + ' raw has no change colours');
    if (layer !== 'impedance') assert.doesNotMatch(e.text, /hollow/, layer + ' ' + view + ' draws no hollow dots');
    if (!(layer === 'density' && view === 'diff')) assert.doesNotMatch(e.text, /grey/, layer + ' ' + view + ' draws no grey dots');
    assert.ok((e.text.match(/[.;] /g) || []).length <= 2, 'short: ' + e.text);
    assert.doesNotMatch(e.text, /—|!/);
    texts.add(e.text);
  }
  assert.strictEqual(texts.size, 6);
  const app = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
  assert.match(app, /'Select a ring on the body, or one of the four readings, to open that check\.'/);
});

test('todayPlan: Report, then Watch, then a check-in on Watch; every action of each source, on every night', () => {
  const seen = { red: 0, amber: 0, checkin: 0, empty: 0 };
  everyNight((cards, ci, where) => {
    const plan = P.todayPlan(cards, ci);
    const red = cards.filter((c) => c.status === 'red'), amber = cards.filter((c) => c.status === 'amber');
    const want = red.concat(amber).map((c) => ({ kind: 'card', card: c.id, status: c.status, from: 'from the bunk', actions: c.actions, decides: c.decides }));
    if (ci.done && ci.status === 'amber') want.push({ kind: 'checkin', card: null, status: 'amber', from: 'from you', actions: ci.actions, decides: ci.decides });
    assert.deepStrictEqual(plan.map(({ name, ...x }) => x), want, where);
    plan.forEach((x) => assert.ok(x.name && x.actions.length > 0, where));
    if (red.length) seen.red++;
    if (amber.length) seen.amber++;
    if (ci.status === 'amber') seen.checkin++;
    if (!plan.length) seen.empty++;
  });
  for (const k of Object.keys(seen)) assert.ok(seen[k] > 0, 'case reached: ' + k);
  const c = (id, status, n) => ({ id, status, decides: 'flight surgeon', actions: Array.from({ length: n }, (_, k) => id + ' action ' + (k + 1)) });
  const plan = P.todayPlan([c('muscle', 'amber', 3), c('sleep', 'green', 1), c('cardio', 'amber', 1), c('radiation', 'red', 2)],
    { done: true, status: 'amber', actions: ['Tell the medic today.'], decides: 'You and the medic' });
  assert.deepStrictEqual(plan.map((x) => x.card || x.kind), ['radiation', 'muscle', 'cardio', 'checkin']);
  assert.deepStrictEqual(plan.map((x) => x.name), ['Radiation', 'Muscle', 'Heart and breathing', 'Your check-in']);
  assert.deepStrictEqual(P.todayPlan([c('muscle', 'green', 1)], { done: true, status: 'green', actions: ['No change needed.'] }), []);
});

test('stepStates: the three state lines match the cards and the check-in on every night', () => {
  const seen = new Set();
  everyNight((cards, ci, where) => {
    const [s1, s2, s3] = P.stepStates(cards, ci);
    const flagged = cards.filter((c) => c.status === 'red' || c.status === 'amber');
    if (flagged.length) {
      assert.strictEqual(s1.text, flagged.length === 1 ? '1 check needs attention' : flagged.length + ' checks need attention', where);
      assert.strictEqual(s1.status, flagged.some((c) => c.status === 'red') ? 'red' : 'amber', where);
    } else if (cards.some((c) => c.status === 'grey')) {
      assert.deepStrictEqual([s1.status, s1.text], ['grey', 'Not enough data yet'], where);
    } else {
      assert.deepStrictEqual([s1.status, s1.text], ['green', 'All four checks in range'], where);
    }
    assert.strictEqual(s1.go, 'See the readings →');
    if (!ci.done) assert.deepStrictEqual(s2, { status: 'grey', text: 'Not done yet · 30 seconds', go: 'Answer now →' }, where);
    else {
      const n = ci.flags.length;
      assert.strictEqual(s2.text, n ? 'Done · ' + n + (n === 1 ? ' thing' : ' things') + ' flagged' : 'Done · nothing flagged', where);
      assert.strictEqual(s2.go, 'See your answers →');
    }
    const plan = P.todayPlan(cards, ci), n3 = plan.reduce((a, x) => a + x.actions.length, 0);
    assert.strictEqual(s3.text, n3 === 0 ? 'Nothing new today' : n3 === 1 ? '1 thing to do' : n3 + ' things to do', where);
    assert.strictEqual(s3.go, 'See the list →');
    seen.add(s1.status).add('s3:' + (n3 ? 'some' : 'none'));
  });
  for (const k of ['green', 'amber', 'red', 'grey', 's3:some', 's3:none']) assert.ok(seen.has(k), 'case reached: ' + k);
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

// The trend chart goes to a night only on a press and release that did not move (within 5 px).
test('isTap: a press and release within 5 px is a tap; a drag is not', () => {
  assert.strictEqual(P.isTap({ x: 100, y: 50 }, { x: 100, y: 50 }), true);
  assert.strictEqual(P.isTap({ x: 100, y: 50 }, { x: 105, y: 45 }), true);
  assert.strictEqual(P.isTap({ x: 100, y: 50 }, { x: 106, y: 50 }), false);
  assert.strictEqual(P.isTap({ x: 100, y: 50 }, { x: 100, y: 56 }), false);
  assert.strictEqual(P.isTap({ x: 300, y: 50 }, { x: 700, y: 50 }), false);
  assert.strictEqual(P.isTap(null, { x: 100, y: 50 }), false);
});
