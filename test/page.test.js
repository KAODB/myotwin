// Checks on index.html that need no browser: every real-data module in data/ is
// loaded by a script tag before js/sim.js, which reads them at load time.
//
// Written with an SI tool (Claude) and reviewed by the team.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);

test('index.html loads every data/*.js before js/sim.js', () => {
  const sim = scripts.indexOf('js/sim.js');
  assert.ok(sim >= 0, 'js/sim.js is not loaded');
  const files = fs.readdirSync(path.join(root, 'data')).filter((f) => f.endsWith('.js'));
  assert.equal(files.length, 5);
  for (const f of files) {
    const i = scripts.indexOf('data/' + f);
    assert.ok(i >= 0, 'data/' + f + ' is not loaded');
    assert.ok(i < sim, 'data/' + f + ' is loaded after js/sim.js');
  }
});

test('index.html loads data/osdr-pwb.js before js/model.js, which writes the gravity check into its note', () => {
  const i = scripts.indexOf('data/osdr-pwb.js');
  assert.ok(i >= 0 && i < scripts.indexOf('js/model.js'));
});

// The what-if address values: the shape and shielding keys keep working for old links (WHATIF in
// js/app.js and its snap()), though only the exercise slider is on the page.
test('the shape and shielding address values still load; only the exercise slider is on the page', () => {
  const app = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
  const gs = new Function('return ' + app.match(/gs: (\{[^}]+\})/)[1])();
  const sh = new Function('return ' + app.match(/sh: (\{[^}]+\})/)[1])();
  assert.deepStrictEqual(gs, { min: 0.25, max: 4, step: 0.25, def: 1 });
  assert.deepStrictEqual(sh, { min: 0.6, max: 1, step: 0.1, def: 1 });
  const snap = new Function('return ' + app.match(/function snap\(v, o\) \{[\s\S]*?\n  \}/)[0])();
  for (const v of ['0.25', '0.5', '1', '2.5', '4']) assert.equal(snap(v, gs), parseFloat(v), v);
  assert.equal(snap('0.1', gs), 1);       // outside the range: the default (the page then shows its notice)
  assert.equal(snap('nope', gs), 1);
  assert.equal(snap('0.6', sh), 0.6);
  assert.equal(snap('0.3', sh), 1);
  for (const id of ['shape', 'shield', 'noise']) assert.doesNotMatch(html, new RegExp('id="' + id + '"'), id);
  assert.match(html, /<input type="range" id="adherence" min="0" max="1" step="0\.05" value="1" disabled>/);
  assert.match(html, /<span class="knob-label">Sessions done<\/span>/);
  assert.match(html, /<button type="button" id="whatif-reset" class="text-btn" disabled>Back to the plan<\/button>/);
});

// The limits stay in the docs and are not on the page.
test('docs/SUBMISSION.md keeps its 13 numbered limits; the page has none', () => {
  const sub = fs.readFileSync(path.join(root, 'docs/SUBMISSION.md'), 'utf8');
  const sec = sub.split('### What this version does not account for, and the next step')[1].split('\n### ')[0];
  assert.strictEqual((sec.match(/^\d+\. /gm) || []).length, 13);
  assert.doesNotMatch(html, /limits-list|Not accounted for|Next step:/);
});

// The page carries no warnings or disclaimers, and no home presentation: neither in index.html nor in
// any string js/app.js or js/rules.js can put on the page.
test('no disclaimer words and no home presentation on the page', () => {
  const banned = /Not a medical device|Simulated data|Simulated image|Experimental|interim|unvalidated/i;
  const strings = (src) => (src.match(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"/g) || []);
  const bodyText = html.slice(html.indexOf('<body')).replace(/<!--[\s\S]*?-->/g, '');
  assert.doesNotMatch(bodyText, banned);
  for (const f of ['js/app.js', 'js/rules.js']) {
    const src = fs.readFileSync(path.join(root, f), 'utf8');
    for (const str of strings(src)) assert.doesNotMatch(str, banned, f + ': ' + str);
    assert.doesNotMatch(src, /mode-eldercare|isHome|HOME_|S4/, f);
  }
  assert.doesNotMatch(html, /data-mode|space-only|home-only|mode-eldercare|class="badges"|id="g-disclaimer"/);
});

// The page is for the person using it: no evidence, references or method sections, no evidence ids.
const bodyHtml = html.slice(html.indexOf('<body'));
const strings = (src) => (src.match(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"/g) || []);
test('no evidence, reference or limitation sections and no evidence ids on the page', () => {
  for (const id of ['origin', 'gcheck', 'hazards', 'limits', 'measured', 'evidence']) {
    assert.doesNotMatch(bodyHtml, new RegExp('id="' + id + '"'), id);
  }
  assert.doesNotMatch(bodyHtml, /data-ev/);
  assert.doesNotMatch(bodyHtml.replace(/<!--[\s\S]*?-->/g, ''), /\bV\d{1,3}\b/);
  const app = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
  for (const str of strings(app)) assert.doesNotMatch(str, /\bV\d{1,3}\b/, 'js/app.js: ' + str);
});

test('the first screen has the three-step guide', () => {
  const guide = html.match(/<ol id="guide" class="guide"[^>]*>([\s\S]*?)<\/ol>/);
  assert.ok(guide, 'ol#guide');
  assert.strictEqual((guide[1].match(/<li\b/g) || []).length, 3);
  assert.match(guide[1], /<button type="button" id="guide-checkin" class="guide-row"><span class="guide-name">Check in<\/span>/);
  assert.match(guide[1], /<button type="button" id="guide-check" class="guide-row"><span class="guide-name">Open a check<\/span>/);
  assert.match(guide[1], /id="guide-do" class="guide-row"><span class="guide-name">Do today<\/span>/);
  assert.ok(html.indexOf('id="headline"') < html.indexOf('id="guide"'));
  for (const id of ['scenario-summary', 'checkin-line', 'image-caption', 'brief-note', 'ci-open', 'ci-method']) {
    assert.doesNotMatch(html, new RegExp('id="' + id + '"'), id);
  }
  assert.doesNotMatch(html, /class="nav-link"|data-goto/);
});

test('below the first screen: seven rows in order, all closed in the markup', () => {
  const rows = [...html.matchAll(/<details class="row( check-row)?" id="([\w-]+)"([^>]*)>\s*<summary><h2 class="row-title">([^<]+)<\/h2>/g)];
  assert.deepStrictEqual(rows.map((m) => m[2]), ['checkin', 'row-muscle', 'row-sleep', 'row-cardio', 'row-radiation', 'how', 'whatif']);
  assert.deepStrictEqual(rows.map((m) => m[4]), ['Morning check-in', 'Muscle', 'Sleep', 'Heart and breathing', 'Radiation',
    'How the bunk measures', 'What if I miss exercise sessions?']);
  for (const m of rows) assert.doesNotMatch(m[3], /\bopen\b/, m[2]);
  for (const m of rows.slice(1, 5)) assert.match(m[3], /data-card="\w+" name="check"/, m[2]);
  assert.doesNotMatch(html, /<details[^>]*\bopen\b/);
  assert.ok(html.indexOf('id="timeline"') < html.indexOf('id="checkin"'));
});

// The morning check-in row: the controls the page script drives.
test('the morning check-in row and its controls exist', () => {
  const rules = require('../js/rules.js');
  const sec = html.match(/<details class="row" id="checkin">([\s\S]*?)\n    <\/details>/);
  assert.ok(sec, 'details#checkin');
  for (const id of ['checkin-meta', 'ci-temp', 'ci-temp-hint', 'ci-baseline', 'ci-clear', 'ci-meaning', 'ci-actions', 'ci-decides', 'ci-rows', 'ci-compare']) {
    assert.match(sec[1], new RegExp('id="' + id + '"'), id);
  }
  assert.match(sec[1], /<input type="number" id="ci-temp" min="34" max="42" step="0.1" inputmode="decimal" autocomplete="off"/);
  rules.CHECKIN.moods.forEach((w, i) => assert.match(sec[1], new RegExp('data-mood="' + (i + 1) + '" aria-pressed="false">' + w + '<'), w));
  rules.CHECKIN.symptoms.forEach((x) => assert.match(sec[1], new RegExp('data-sym="' + x.letter + '" aria-pressed="false">' + x.label + '<'), x.label));
  assert.strictEqual(rules.CHECKIN.tempMinC, 34);
  assert.strictEqual(rules.CHECKIN.tempMaxC, 42);
  assert.match(sec[1], /class="ci-result" aria-live="polite"/);
});
