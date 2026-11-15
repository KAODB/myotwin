// Drawing checks for js/charts.js on a tiny stand-in for the DOM (no browser): the trend chart
// draws readings, the judged line and its points only up to the selected night; event labels stay
// inside the chart beside their lines; the gravity-check dot chart centres each mark on its own row
// with the labels in a gutter left of the plot.
//
// Written with an SI tool (Claude) and reviewed by the team.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const charts = require('../js/charts.js');

// Minimal SVG element: attributes, children, text; text width is estimated by charts.js (6.5 px a character).
function node(tag) {
  return {
    tag, attrs: {}, children: [], textContent: '',
    setAttribute(k, v) { this.attrs[k] = String(v); },
    getAttribute(k) { return this.attrs[k]; },
    appendChild(c) { this.children.push(c); return c; },
    removeChild(c) { this.children.splice(this.children.indexOf(c), 1); },
    get firstChild() { return this.children[0] || null; }
  };
}
function svgOf(w, h) {
  const s = node('svg');
  s.getBoundingClientRect = () => ({ width: w, height: h });
  return s;
}
globalThis.document = { createElementNS: (ns, tag) => node(tag) };
const all = (svg, pred) => svg.children.filter(pred);
const cls = (n) => n.attrs.class || '';

function spec(upTo) {
  const days = [];
  for (let d = -14; d <= 89; d++) days.push(d);
  const series = days.map((d) => ({ missionDay: d, value: 9 - d * 0.01 }));
  return {
    series, raw: series.map((p) => ({ missionDay: p.missionDay, value: p.value + 0.05 })),
    expected: days.filter((d) => d >= 0).map((d) => ({ missionDay: d, low: 8, high: 9 })),
    exercise: days.filter((d) => d >= 0).map((d) => ({ missionDay: d, done: d % 2 === 0 })),
    thresholds: [{ value: 7.5, label: 'Report line', status: 'red' }],
    markers: [{ missionDay: 0, label: 'Arrival' }], statusAt: () => 'green',
    selectedDay: upTo, upTo
  };
}

test('upToDay keeps the nights up to and including the given day, or all of them', () => {
  const pts = [{ missionDay: -1 }, { missionDay: 0 }, { missionDay: 5 }, { missionDay: 6 }];
  assert.deepStrictEqual(charts.upToDay(pts, 5).map((p) => p.missionDay), [-1, 0, 5]);
  assert.strictEqual(charts.upToDay(pts, null).length, 4);
});

test('the trend chart draws no reading, point or exercise tick after the selected night, and keeps its frame', () => {
  const full = svgOf(800, 280), part = svgOf(800, 280);
  const X = charts.line(full, spec(null)).x;
  const X2 = charts.line(part, spec(42)).x;
  // Same x axis (whole scenario) and the plan band is still drawn in full.
  assert.strictEqual(X(89), X2(89));
  assert.strictEqual(all(part, (n) => cls(n) === 'band-expected').length, 1);
  const limit = X2(42) + 0.01;
  const dots = all(part, (n) => cls(n) === 'raw-dot');
  assert.strictEqual(dots.length, 14 + 43);
  assert.ok(dots.every((n) => Number(n.attrs.cx) <= limit));
  const marks = all(part, (n) => /\bmk\b/.test(cls(n)));
  assert.strictEqual(marks.length, 14 + 43);
  assert.ok(marks.every((n) => Number(n.attrs.cx) <= limit));
  const ticks = all(part, (n) => /^ex-/.test(cls(n)));
  assert.strictEqual(ticks.length, 43);
  const line = all(part, (n) => cls(n) === 'series')[0].attrs.d;
  assert.ok(line.match(/[ML]([\d.]+),/g).every((s) => Number(s.slice(1, -1)) <= limit));
  assert.match(part.attrs['aria-label'], /57 nights with data/);
});

test('a long event label sits beside its own line and inside the chart at every width', () => {
  for (const W of [340, 520, 800]) {
    const svg = svgOf(W, 280);
    const o = spec(30);
    o.markers = [{ missionDay: 0, label: 'Arrival' },
      { missionDay: 14, label: 'Measured: solar particle events of 4-7 Sep 2017 (LRO CRaTER)', shortLabel: 'Solar particle events, 4-7 Sep 2017', tinyLabel: 'Solar events, 4-7 Sep' }];
    const X = charts.line(svg, o).x;
    const lab = all(svg, (n) => n.tag === 'text' && /Solar|Measured/.test(n.textContent))[0];
    const x = Number(lab.attrs.x), w = lab.textContent.length * 6.5;
    assert.ok(x >= 0 && x + w <= W, W + ': inside the chart');
    assert.ok(Math.abs(x - X(14)) < 8 || Math.abs(x + w - X(14)) < 8, W + ': next to its line (' + lab.textContent + ')');
  }
});

test('the dot chart centres each mark on its own row, labels in a gutter left of every line', () => {
  const rows = [
    { value: 0.66, label: 'Grip, females', shape: 'circle' }, { value: 0.93, label: 'Grip, males', shape: 'circle' },
    { value: 0.46, label: 'Plantarflexion torque, females', shape: 'square' }, { value: 0.25, label: 'Plantarflexion torque, males', shape: 'square' },
    { value: 1.05, label: 'Calf girth, females', shape: 'triangle' }, { value: 0.44, label: 'Calf girth, males', shape: 'triangle' }];
  for (const W of [311, 1200]) {
    for (const ref of [0.06, 0.6, 0.97]) {
      const svg = svgOf(W, 300);
      const out = charts.dotScale(svg, { rows, max: 1.2, ticks: [0, 0.6, 1.2], ref: { value: ref, label: 'Model, shape 4: ' + ref }, title: 't' });
      const marks = all(svg, (n) => /\bdot\b/.test(cls(n)) && !/dot-(ref|track|label)/.test(cls(n)));
      assert.strictEqual(marks.length, 6);
      marks.forEach((n, i) => {
        const cy = n.tag === 'circle' ? Number(n.attrs.cy) : n.tag === 'rect' ? Number(n.attrs.y) + Number(n.attrs.height) / 2 :
          (() => { const ys = n.attrs.d.match(/,(-?[\d.]+)/g).map((s) => Number(s.slice(1))); return (Math.min(...ys) + Math.max(...ys)) / 2; })();
        assert.ok(Math.abs(cy - out.rowY[i]) < 1, W + ' row ' + i + ' centred');
      });
      // Every label ends before the plot starts; every grid, track and reference line starts at or after it.
      const labels = all(svg, (n) => /dot-label/.test(cls(n)));
      assert.ok(labels.every((n) => Number(n.attrs.x) + n.textContent.length * 6.5 < out.gutter), W + ' labels in the gutter');
      assert.ok(all(svg, (n) => n.tag === 'line').every((n) => Math.min(Number(n.attrs.x1), Number(n.attrs.x2)) >= out.gutter - 0.01), W + ' lines right of the gutter');
      // The model label stays above the plot, within its width.
      const rl = all(svg, (n) => cls(n) === 'dot-ref-label')[0];
      assert.ok(Number(rl.attrs.x) >= out.gutter && Number(rl.attrs.x) + rl.textContent.length * 6.5 <= W, W + ' ref label inside');
    }
  }
});

// The night ruler marks each scenario event with a bracket above the ticks and a tiny label at its
// start, above the ruler (the tick numbers sit below it); a label that would collide is left out.
test('ruler: events get a bracket and a label above the ticks; colliding labels are left out', () => {
  const days = []; for (let d = -14; d <= 44; d++) days.push(d);
  const ev = [{ from: 28, to: 31, label: 'Solar events' }, { from: 34, to: 38, label: 'Solar event' }];
  const wide = svgOf(1000, 46);
  charts.ruler(wide, { days, selected: 20, events: ev });
  assert.strictEqual(all(wide, (n) => cls(n) === 'ruler-event').length, 2);
  const labels = all(wide, (n) => cls(n) === 'ruler-event-label');
  assert.deepStrictEqual(labels.map((t) => t.textContent), ['Solar events', 'Solar event']);
  const ticks = all(wide, (n) => cls(n) === 'ruler-label');
  for (const t of labels) for (const k of ticks) assert.ok(Number(t.attrs.y) + 4 < Number(k.attrs.y) - 12, 'label above the tick numbers');
  const narrow = svgOf(300, 46);
  charts.ruler(narrow, { days, selected: 20, events: ev });
  assert.strictEqual(all(narrow, (n) => cls(n) === 'ruler-event').length, 2);
  assert.deepStrictEqual(all(narrow, (n) => cls(n) === 'ruler-event-label').map((t) => t.textContent), ['Solar events']);
});

// Labels inside the trend chart: placeLabels and the labels the chart draws with it.
test('placeLabels: first option that fits and clears; earlier labels win; no room means left out', () => {
  const bounds = { x0: 0, y0: 0, x1: 200, y1: 100 };
  const box = (x, y, w, h) => ({ x0: x, y0: y - h + 3, x1: x + w, y1: y + 3 });
  // The first option meets an obstacle, the second is outside the bounds, the third is taken.
  let out = charts.placeLabels([{ id: 'a', w: 40, h: 12, options: [{ x: 10, y: 20 }, { x: 180, y: 20 }, { x: 10, y: 60 }] }],
    [{ x0: 0, y0: 0, x1: 60, y1: 30 }], bounds);
  assert.deepStrictEqual(out.map((p) => [p.id, p.x, p.y]), [['a', 10, 60]]);
  assert.deepStrictEqual(out[0].box, box(10, 60, 40, 12));
  // Two labels after the same spot: the first (more important) takes it, the second its next option.
  out = charts.placeLabels([
    { id: 'you', w: 30, h: 12, options: [{ x: 50, y: 50 }] },
    { id: 'band', w: 60, h: 12, options: [{ x: 40, y: 52 }, { x: 40, y: 80 }] }], [], bounds);
  assert.deepStrictEqual(out.map((p) => [p.id, p.y]), [['you', 50], ['band', 80]]);
  // No option clears: the label is left out, never overlapped.
  out = charts.placeLabels([{ id: 'x', w: 30, h: 12, options: [{ x: 50, y: 50 }] }], [{ x0: 40, y0: 30, x1: 120, y1: 70 }], bounds);
  assert.deepStrictEqual(out, []);
  // Boxes that only touch within the gap count as meeting.
  out = charts.placeLabels([{ id: 'x', w: 30, h: 12, options: [{ x: 50, y: 50 }] }], [{ x0: 81, y0: 30, x1: 120, y1: 70 }], bounds, 2);
  assert.deepStrictEqual(out, []);
});

function boxOfText(n) {
  const w = n.textContent.length * 6.5, x = Number(n.attrs.x), y = Number(n.attrs.y), a = n.attrs['text-anchor'];
  const x0 = a === 'end' ? x - w : a === 'middle' ? x - w / 2 : x;
  return { x0, x1: x0 + w, y0: y - 9, y1: y + 3 };
}
const meet = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

test('the trend chart labels the person\'s line and the bands, clear of each other, the threshold and event labels and the data', () => {
  for (const W of [340, 520, 800, 1100]) {
    for (const upTo of [-3, 10, 42, 89]) {
      const svg = svgOf(W, 300), o = spec(upTo);
      Object.assign(o, { youLabel: 'You', expectedLabel: 'Expected: mission plan', baselineLabel: 'Your baseline',
        baseline: { median: 9.1, low: 8.9, high: 9.3 }, title: 'Your calf muscle signal each night, against what the mission plan expects.' });
      const geo = charts.line(svg, o);
      const mine = all(svg, (n) => /chart-label/.test(cls(n)));
      const others = all(svg, (n) => /threshold-label|event-label/.test(cls(n)));
      const where = W + ' px, night ' + upTo;
      const boxes = mine.map(boxOfText);
      boxes.forEach((b, i) => {
        assert.ok(b.x0 >= geo.left && b.x1 <= geo.right && b.y0 >= geo.top - 1 && b.y1 <= geo.bottom + 1, where + ': ' + mine[i].textContent + ' inside the plot');
        others.forEach((n) => assert.ok(!meet(b, boxOfText(n)), where + ': ' + mine[i].textContent + ' clears ' + n.textContent));
        boxes.forEach((c, j) => { if (j !== i) assert.ok(!meet(b, c), where + ': labels apart'); });
        all(svg, (n) => n.tag === 'circle' && /raw-dot|mk/.test(cls(n))).forEach((n) => {
          const cx = Number(n.attrs.cx), cy = Number(n.attrs.cy);
          assert.ok(!(cx > b.x0 && cx < b.x1 && cy > b.y0 && cy < b.y1), where + ': ' + mine[i].textContent + ' clears the data');
        });
        const sel = geo.x(upTo);
        assert.ok(!(sel > b.x0 && sel < b.x1), where + ': clears the selected night');
      });
      // On the wide chart the three labels all find room; "You" sits by the latest drawn point.
      if (W >= 800) {
        assert.deepStrictEqual(mine.map((n) => n.textContent).sort(), ['Expected: mission plan', 'You', 'Your baseline'], where);
        const you = boxOfText(mine.find((n) => n.textContent === 'You'));
        const px = geo.x(upTo), py = geo.y(9 - upTo * 0.01);
        assert.ok(Math.hypot((you.x0 + you.x1) / 2 - px, (you.y0 + you.y1) / 2 - py) < 45, where + ': You near its point');
      }
      assert.match(svg.attrs['aria-label'], /^Your calf muscle signal each night, against what the mission plan expects\. \d+ nights with data\.$/);
    }
  }
});
