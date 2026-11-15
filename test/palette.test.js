// Checks the three-colour rule in css/style.css: every text colour meets WCAG AA on every surface
// it is used on, no colour outside the rule appears, the accent stays reserved for attention, the old
// colours are gone, and js/charts.js builds its canvas colour scales from the same palette.
// Written with an SI tool (Claude) and reviewed by the team.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const charts = require('../js/charts.js');

const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'style.css'), 'utf8');

function block(selector) {
  const i = css.indexOf(selector + ' {');
  assert.ok(i >= 0, selector + ' block exists');
  const body = css.slice(i, css.indexOf('}', i));
  const vars = {};
  for (const m of body.matchAll(/--([\w-]+):\s*([^;]+);/g)) vars[m[1]] = m[2].trim();
  return vars;
}
const DARK = block(':root');

function rgba(v) {
  let m = /^#([0-9a-f]{6})$/i.exec(v);
  if (m) return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)).concat(1);
  m = /^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/.exec(v);
  assert.ok(m, 'colour value parses: ' + v);
  return [+m[1], +m[2], +m[3], +m[4]];
}
function resolve(P, name) {
  let v = P[name];
  assert.ok(v, '--' + name + ' is defined');
  const m = /^var\(--([\w-]+)\)$/.exec(v);
  return m ? resolve(P, m[1]) : v;
}
// A colour on top of a background (translucent colours are blended first).
function over(P, name, bgName) {
  const c = rgba(resolve(P, name));
  if (c[3] === 1) return c;
  const b = rgba(resolve(P, bgName));
  return [0, 1, 2].map((i) => c[i] * c[3] + b[i] * (1 - c[3])).concat(1);
}
function lum(c) {
  const f = c.slice(0, 3).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
  return 0.2126 * f[0] + 0.7152 * f[1] + 0.0722 * f[2];
}
function ratio(a, b) { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }

const TEXT = 4.5, MARK = 3;
// Surfaces: the night ground, the card panel, the chart tone (judged on the panel it sits on), and
// the Electric Blue block, button and pressed pill.
const DARK_SURFACES = ['night', 'panel'];
// [foreground, backgrounds, minimum, what uses it]
const PAIRS = [
  ['ink', DARK_SURFACES, TEXT, 'body text, headings, values'],
  ['quiet', DARK_SURFACES, TEXT, 'secondary text, labels, In range and No data words, tick labels'],
  ['blue', DARK_SURFACES, TEXT, 'links, step labels, the eyebrows, the notice, "See the readings"'],
  ['accent', DARK_SURFACES, TEXT, 'Watch and Report words, threshold labels, the attention headline'],
  ['on-blue', ['blue'], TEXT, 'text on the Step 2 block and card, the primary button, a pressed pill, the current step number'],
  ['on-blue-quiet', ['blue'], TEXT, 'secondary text on the Step 2 block and card'],
  ['line-2', DARK_SURFACES, 1.5, 'hairlines: frame, axes, ruler ticks, pill borders (decorative structure)'],
  ['blue', DARK_SURFACES, MARK, 'focus rings, the selected night, tracks, the current step circle'],
  ['accent', DARK_SURFACES, MARK, 'Watch and Report marks, leaders and threshold lines']
];

test('every text colour meets WCAG AA on every surface it is used on', () => {
  const rows = [];
  for (const [fg, bgs, min, use] of PAIRS) {
    for (const bg of bgs) {
      const base = over(DARK, bg, 'night');
      const r = ratio(over(DARK, fg, bg), base);
      rows.push(fg + ' on ' + bg + ': ' + r.toFixed(2) + ' (min ' + min + ')');
      assert.ok(r >= min, '--' + fg + ' on --' + bg + ' is ' + r.toFixed(2) + ':1, needs ' + min + ':1 (' + use + ')');
    }
  }
  // Text on the chart tone, judged where the tone sits (on the panel).
  const tone = over({ ...DARK, base: DARK.panel }, 'tone', 'base');
  for (const fg of ['ink', 'quiet', 'accent']) {
    const r = ratio(over(DARK, fg, 'panel'), tone);
    rows.push(fg + ' on tone: ' + r.toFixed(2));
    assert.ok(r >= TEXT, fg + ' on the chart tone');
  }
  // Measured values the brief names, and why ink and white never go on blue.
  assert.ok(Math.abs(ratio(over(DARK, 'on-blue', 'blue'), over(DARK, 'blue', 'night')) - 6.25) < 0.02);
  assert.ok(Math.abs(ratio(over(DARK, 'on-blue-quiet', 'blue'), over(DARK, 'blue', 'night')) - 4.97) < 0.02);
  assert.ok(ratio(rgba(DARK.ink), rgba(DARK.blue)) < TEXT && ratio([255, 255, 255, 1], rgba(DARK.blue)) < TEXT);
  console.log('# ' + rows.join('\n# '));
});

const RULES = css.replace(/\/\*[\s\S]*?\*\//g, '').split('}').map((r) => r.split('{')).filter((r) => r[1]);

test('a block, button or pill of Electric Blue always sets night text on it', () => {
  for (const [sel, body] of RULES) {
    if (!/(^|[\s;])background:\s*var\(--blue\)/.test(body)) continue;
    if (/dot|brand-mark|thumb/.test(sel)) continue;              // marks with no text
    assert.match(body, /(^|[\s;])color:\s*var\(--on-blue\)/, sel.trim() + ' puts text on blue without --on-blue');
  }
});

test('the scheme uses the exact values of the three colours and the tokens of the rule', () => {
  assert.deepStrictEqual(['night', 'ink', 'quiet', 'blue', 'accent', 'panel', 'on-blue'].map((k) => DARK[k].toUpperCase()),
    ['#02070A', '#EAF2F7', '#8FA3B1', '#0297DE', '#FC734D', '#0B1013', '#02070A']);
  assert.strictEqual(DARK['on-blue-quiet'], 'rgba(2, 7, 10, 0.8)');
  assert.strictEqual(DARK.maxw, '1200px');
  assert.match(DARK['font-sans'], /^system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif$/);
  assert.match(DARK['font-mono'], /^ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace$/);
});

test('no colour outside the rule: every colour in the stylesheet is one of the three, ink, quiet or panel, or black, white or ink at an opacity', () => {
  const allowedHex = ['#02070A', '#EAF2F7', '#8FA3B1', '#0297DE', '#FC734D', '#0B1013', '#000', '#FFF'];
  const allowedRgb = ['2,7,10', '234,242,247', '0,0,0', '255,255,255', '2,151,222', '252,115,77'];
  const noMaps = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--map-[\w-]+:[^;]+;/g, '');
  for (const m of noMaps.matchAll(/#[0-9a-f]{3,8}\b/gi)) assert.ok(allowedHex.includes(m[0].toUpperCase()), 'colour outside the rule: ' + m[0]);
  for (const m of noMaps.matchAll(/rgba?\(([^)]+)\)/g)) {
    const parts = m[1].split(',').map((x) => x.trim());
    assert.ok(allowedRgb.includes(parts.slice(0, 3).join(',')), 'colour outside the rule: ' + m[0]);
  }
  assert.doesNotMatch(noMaps, /\b(hsl|oklch|lab|lch|color-mix)\(/);
  assert.doesNotMatch(noMaps, /--(zone-self|panel-self|zone-ref|panel-2|line-self|rule|rule-strong)\b/);
});

test('the accent is reserved for Watch, Report, the attention headline and the attention light', () => {
  const allowed = /st-amber|st-red|key-watch|key-report|headline-attn/;
  for (const [sel, body] of RULES) {
    if (!/var\(--accent\)/.test(body)) continue;
    assert.match(sel.trim(), allowed, 'accent used outside a Watch/Report rule: ' + sel.trim());
  }
  // The accent's value appears only in the palette and in the small light shown on attention nights.
  for (const [sel, body] of RULES) {
    if (sel.trim() === ':root' || !/#FC734D|252,\s*115,\s*77/i.test(body)) continue;
    assert.strictEqual(sel.trim(), '.hero.hero-attn::after', 'accent value used in ' + sel.trim());
  }
});

test('the old status and badge colours are gone', () => {
  assert.doesNotMatch(css, /--(green|amber|red|attention|surface|muted)\b/);
  assert.doesNotMatch(css, /#5ec8e5|#5bd38f|#f3c14f|#ff7d6e|#0a1120|#126b33|#8a5800|#b42318|#1B2C37|#2E4859|#08141B|#06283C/i);
});

test('every palette variable is used', () => {
  for (const name of Object.keys(DARK)) {
    if (/^(gutter|nav-h|bar-h|plate-w|plate-h|map-)/.test(name)) continue;
    assert.ok(css.includes('var(--' + name + ')'), '--' + name + ' is used');
  }
});

test('canvas colour scales come from the palette', () => {
  for (const [mode, P] of [['space', DARK]]) {
    const heat = charts.parseStops(P['map-heat']), div = charts.parseStops(P['map-diverging']);
    assert.ok(heat && div, mode + ': --map-heat and --map-diverging parse');
    const hex = (c) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
    // heat: black - working blue - white, rising in lightness.
    assert.strictEqual(hex(heat[2]), P.blue.toUpperCase(), mode + ': heat passes through the working blue');
    for (let i = 1; i < heat.length; i++) assert.ok(lum(heat[i]) > lum(heat[i - 1]), mode + ': heat rises in lightness');
    // diverging: working blue at the negative side, accent at the positive side, light neutral centre.
    assert.strictEqual(hex(div[1]), P.blue.toUpperCase());
    assert.strictEqual(hex(div[3]), P.accent.toUpperCase());
    assert.ok(lum(div[2]) > lum(div[1]) && lum(div[2]) > lum(div[3]), mode + ': diverging centre is the lightest');
  }
  // The Node fallback equals the space presentation.
  assert.deepStrictEqual(charts.colormap('heat', 0.5), charts.parseStops(DARK['map-heat'])[2]);
  assert.deepStrictEqual(charts.colormap('diverging', 1), charts.parseStops(DARK['map-diverging'])[4]);
});

// The product look: no shadows; gradients only for the lights and the grid behind the landing
// section and at the foot of "How it works"; system type, no web fonts, no italics.
test('no shadows; gradients only for the lights and the landing grid; system type without web fonts or italics', () => {
  const rules = css.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(rules, /box-shadow|text-shadow|drop-shadow/);
  const withGradient = RULES.filter(([, body]) => /gradient\(/.test(body)).map(([sel]) => sel.trim());
  assert.deepStrictEqual(withGradient, ['.hero::before', '.hero.hero-attn::after', '.hero-grid', '.zone-how::before']);
  assert.doesNotMatch(rules, /@font-face|Garamond|font-style:\s*italic/);
  assert.match(rules, /body \{[^}]*font-family: var\(--font-sans\)/);
  assert.deepStrictEqual(charts.hexRgb(DARK.ink), [234, 242, 247]);
  assert.deepStrictEqual(charts.hexRgb(DARK.blue), [2, 151, 222]);
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.doesNotMatch(html, /rel="preload"|fonts\//);
});
