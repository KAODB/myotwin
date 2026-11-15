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
