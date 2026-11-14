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
  assert.equal(files.length, 4);
  for (const f of files) {
    const i = scripts.indexOf('data/' + f);
    assert.ok(i >= 0, 'data/' + f + ' is not loaded');
    assert.ok(i < sim, 'data/' + f + ' is loaded after js/sim.js');
  }
});
