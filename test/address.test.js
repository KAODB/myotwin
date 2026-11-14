// The page's view-state helpers in js/app.js (the block between "BEGIN view-state helpers" and
// "END view-state helpers"), run in Node: address parsing, the address written back, and the
// per-scenario memory used when the scenario changes.
//
// Written with an SI tool (Claude) and reviewed by the team.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const sim = require('../js/sim.js');

const app = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
const block = app.match(/\/\/ BEGIN view-state helpers\n([\s\S]*?)\n\s*\/\/ END view-state helpers/)[1];
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const H = new Function('sim', 'has', block + '\nreturn { parseHash, hashFor, scenarioChanges, WHATIF };')(sim, has);

test('a plain link opens without the notice and is written back unchanged', () => {
  const st = H.parseHash('#s=S3&d=20&layer=density&view=raw&mode=astronaut&card=radiation');
  assert.strictEqual(st.rejected, false);
  assert.strictEqual(H.hashFor(st), '#s=S3&d=20&layer=density&view=raw&mode=astronaut&card=radiation');
});

test('an old link with a mode that no longer matches the scenario opens without the notice', () => {
  const st = H.parseHash('#s=S4&d=34&mode=astronaut&card=muscle');
  assert.strictEqual(st.rejected, false);
  assert.strictEqual(st.mode, 'eldercare');
  assert.strictEqual(st.layer, 'pressure');
  assert.strictEqual(H.parseHash('#s=S2&mode=eldercare').rejected, false);
  assert.strictEqual(H.parseHash('#s=S2&mode=pilot').rejected, true);   // not a mode at all
});

test('a repeated key shows the notice', () => {
  assert.strictEqual(H.parseHash('#s=S2&d=10&d=20').rejected, true);
  assert.strictEqual(H.parseHash('#s=S2&s=S2').rejected, true);
  assert.strictEqual(H.parseHash('#s=S2&d=10').rejected, false);
});

test('really invalid values still show the notice', () => {
  for (const h of ['#s=S9', '#s=S2&d=ten', '#s=S2&layer=xray', '#s=S2&gs=9', '#s=S2&foo=1', '#s=S2&card']) {
    assert.strictEqual(H.parseHash(h).rejected, true, h);
  }
});

test('in the home scenario ex, gs and sh are ignored and left out of the address', () => {
  const st = H.parseHash('#s=S4&d=34&ex=0.5&gs=4&sh=0.6&nz=0.05');
  assert.strictEqual(st.rejected, false);
  assert.deepStrictEqual([st.ex, st.gs, st.sh], [H.WHATIF.ex.def, H.WHATIF.gs.def, H.WHATIF.sh.def]);
  assert.strictEqual(st.nz, 0.05);                       // sensor noise applies at home too
  assert.strictEqual(H.hashFor(st), '#s=S4&d=34&layer=pressure&view=raw&mode=eldercare&card=muscle&nz=0.05');
  // A state carried over from a space scenario does not write them either.
  assert.doesNotMatch(H.hashFor(Object.assign({}, st, { gs: 2, ex: 0.4, sh: 0.8 })), /gs=|ex=|sh=/);
  // In a space scenario they stay.
  assert.match(H.hashFor(H.parseHash('#s=S2&gs=2')), /&gs=2$/);
});

test('each scenario remembers its own night, layer and view within the page session', () => {
  const mem = {};
  let st = H.parseHash('#s=S2&d=30');
  // Mars day 30 -> Eldercare: the home scenario opens on its defaults (last night, pressure).
  let ch = H.scenarioChanges(mem, st, 'S4');
  assert.deepStrictEqual(ch, { s: 'S4', d: null, layer: 'pressure', view: 'raw' });
  st = Object.assign({}, st, ch, { d: 50, view: 'diff' });
  // -> back to Mars: day 30 and the density layer again, not day 42 or the home layer.
  ch = H.scenarioChanges(mem, st, 'S2');
  assert.deepStrictEqual(ch, { s: 'S2', d: 30, layer: 'density', view: 'raw' });
  st = Object.assign({}, st, ch);
  // A space scenario never visited opens on its defaults, not on the home scenario's pressure layer.
  assert.deepStrictEqual(H.scenarioChanges(mem, st, 'S1'), { s: 'S1', d: null, layer: 'density', view: 'raw' });
  // The home scenario comes back as it was left.
  assert.deepStrictEqual(H.scenarioChanges(mem, st, 'S4'), { s: 'S4', d: 50, layer: 'pressure', view: 'diff' });
});
