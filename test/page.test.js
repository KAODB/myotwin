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

// The what-if shape slider: index.html and the WHATIF table in js/app.js agree, and the
// address parser's snap() (read from js/app.js) keeps 0.25 and an old value such as 2.5.
test('shape slider runs 0.25 to 4 in steps of 0.25; old and new address values load unchanged', () => {
  const input = html.match(/<input type="range" id="shape"[^>]*>/)[0];
  const attr = (k) => parseFloat(input.match(new RegExp(k + '="([^"]+)"'))[1]);
  assert.deepStrictEqual([attr('min'), attr('max'), attr('step'), attr('value')], [0.25, 4, 0.25, 1]);
  const app = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
  const gs = new Function('return ' + app.match(/gs: (\{[^}]+\})/)[1])();
  assert.deepStrictEqual(gs, { min: 0.25, max: 4, step: 0.25, def: 1 });
  const snap = new Function('return ' + app.match(/function snap\(v, o\) \{[\s\S]*?\n  \}/)[0])();
  for (const v of ['0.25', '0.5', '1', '2.5', '4']) assert.equal(snap(v, gs), parseFloat(v), v);
  assert.equal(snap('0.1', gs), 1);       // outside the range: the default (the page then shows its notice)
  assert.equal(snap('4.5', gs), 1);
  assert.equal(snap('nope', gs), 1);
});

// The shielding what-if acts on the tracks only and runs 0.6 to 1.
test('shielding slider runs 0.6 to 1 in steps of 0.1 and matches WHATIF.sh; the dose note is gone', () => {
  const input = html.match(/<input type="range" id="shield"[^>]*>/)[0];
  const attr = (k) => parseFloat(input.match(new RegExp(k + '="([^"]+)"'))[1]);
  assert.deepStrictEqual([attr('min'), attr('max'), attr('step'), attr('value')], [0.6, 1, 0.1, 1]);
  assert.match(html, /this setting does not change the dose/);
  const app = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
  const sh = new Function('return ' + app.match(/sh: (\{[^}]+\})/)[1])();
  assert.deepStrictEqual(sh, { min: 0.6, max: 1, step: 0.1, def: 1 });
  const snap = new Function('return ' + app.match(/function snap\(v, o\) \{[\s\S]*?\n  \}/)[0])();
  assert.equal(snap('0.6', sh), 0.6);
  assert.equal(snap('0.3', sh), 1);      // an old link below 0.6: the default and the notice
  assert.doesNotMatch(app, /shieldNote|CRATER_SHIELD|behind about 8 cm/);
});
