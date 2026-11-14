// Checks the colour scheme in css/style.css: every colour pair the page uses meets WCAG AA
// in both presentations (space: :root, home: body.mode-eldercare), the accent colour stays
// reserved for Watch, Report and the attention headline, the old status colours are gone,
// and js/charts.js builds its canvas colour scales from the same palette.
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
const HOME = Object.assign({}, DARK, block('body.mode-eldercare'));

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
const SURFACES = ['bg', 'surface', 'surface-2'];
// [foreground, backgrounds, minimum, what uses it]
const PAIRS = [
  ['text', SURFACES.concat('glow'), TEXT, 'body text, headline'],
  ['muted', SURFACES.concat('glow'), TEXT, 'secondary text, neutral tags and chips'],
  ['accent-text', SURFACES.concat('glow'), TEXT, 'links, eyebrow, "In range" word, blue tags and chips, notice'],
  ['attention-text', SURFACES.concat('glow'), TEXT, '"Report" word, threshold labels, attention headline'],
  ['watch-text', SURFACES, TEXT, '"Watch" word'],
  ['grey', SURFACES, TEXT, '"No data" word'],
  ['accent', SURFACES, MARK, 'working colour: focus rings, selected outline, slider, chart marks, In range mark'],
  ['attention', SURFACES, MARK, 'Watch and Report marks, card bars, threshold lines'],
  ['accent-ink', ['accent'], TEXT, 'text on a selected toggle or the skip link'],
  ['icon-ink', ['accent', 'attention'], MARK, 'ink inside the solid In range and Report icons'],
  ['attention', ['attention-soft'], MARK, 'outline and ink of the Watch icon on its light tint']
];

for (const [mode, P] of [['space (dark)', DARK], ['home (light)', HOME]]) {
  test('contrast pairs meet WCAG AA: ' + mode, () => {
    const rows = [];
    for (const [fg, bgs, min, use] of PAIRS) {
      for (const bg of bgs) {
        // Translucent backgrounds (glow, light tints) are judged where they sit: on the panel or page.
        const base = over(P, bg, bg === 'glow' ? 'bg' : 'surface');
        const r = ratio(over(P, fg, 'surface'), base);
        rows.push(fg + ' on ' + bg + ': ' + r.toFixed(2) + ' (min ' + min + ')');
        assert.ok(r >= min, mode + ': --' + fg + ' on --' + bg + ' is ' + r.toFixed(2) + ':1, needs ' + min + ':1 (' + use + ')');
      }
    }
    console.log('# ' + mode + '\n# ' + rows.join('\n# '));
  });
}

test('the scheme uses the exact values of the two sets', () => {
  assert.deepStrictEqual([DARK.bg, DARK.accent, DARK.attention].map((s) => s.toUpperCase()), ['#02070A', '#0297DE', '#FC734D']);
  assert.deepStrictEqual([HOME.bg, HOME.accent, HOME.attention].map((s) => s.toUpperCase()), ['#FCFFFF', '#0593C6', '#D83995']);
});

test('the accent is reserved for Watch, Report and the attention headline', () => {
  const allowed = /st-amber|st-red|key-watch|key-report|headline-attn/;
  // Rules (outside the palette blocks) that use an accent variable.
  const rules = css.replace(/\/\*[\s\S]*?\*\//g, '').split('}').map((r) => r.split('{'));
  for (const [sel, body] of rules) {
    if (!body || !/var\(--(attention|watch-text)/.test(body)) continue;
    assert.match(sel.trim(), allowed, 'accent used outside a Watch/Report rule: ' + sel.trim());
  }
  // The accent value itself appears only in the palette, never as a literal elsewhere.
  const outside = css.replace(/:root \{[^}]*\}|body\.mode-eldercare \{[^}]*\}|\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(outside, /#FC734D|#D83995|252,\s*115,\s*77|216,\s*57,\s*149/i);
});

test('the old status and badge colours are gone', () => {
  assert.doesNotMatch(css, /--(green|amber|red)\b/);
  assert.doesNotMatch(css, /#5ec8e5|#5bd38f|#f3c14f|#ff7d6e|#0a1120|#126b33|#8a5800|#b42318/i);
});

test('every palette variable is used', () => {
  for (const name of Object.keys(DARK)) {
    if (/^(radius|gap|font|fs|bar-h|fig-h|hs-room|map-)/.test(name)) continue;
    assert.ok(css.includes('var(--' + name + ')'), '--' + name + ' is used');
  }
});

test('canvas colour scales come from the palette', () => {
  for (const [mode, P] of [['space', DARK], ['home', HOME]]) {
    const heat = charts.parseStops(P['map-heat']), div = charts.parseStops(P['map-diverging']);
    assert.ok(heat && div, mode + ': --map-heat and --map-diverging parse');
    const hex = (c) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
    // heat: black - working blue - white, rising in lightness.
    assert.strictEqual(hex(heat[2]), P.accent.toUpperCase(), mode + ': heat passes through the working blue');
    for (let i = 1; i < heat.length; i++) assert.ok(lum(heat[i]) > lum(heat[i - 1]), mode + ': heat rises in lightness');
    // diverging: working blue at the negative side, accent at the positive side, light neutral centre.
    assert.strictEqual(hex(div[1]), P.accent.toUpperCase());
    assert.strictEqual(hex(div[3]), P.attention.toUpperCase());
    assert.ok(lum(div[2]) > lum(div[1]) && lum(div[2]) > lum(div[3]), mode + ': diverging centre is the lightest');
  }
  // The Node fallback equals the space presentation.
  assert.deepStrictEqual(charts.colormap('heat', 0.5), charts.parseStops(DARK['map-heat'])[2]);
  assert.deepStrictEqual(charts.colormap('diverging', 1), charts.parseStops(DARK['map-diverging'])[4]);
});
