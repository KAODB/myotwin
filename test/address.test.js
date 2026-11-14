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
  const st = H.parseHash('#s=S3&d=20&layer=density&view=raw&card=radiation');
  assert.strictEqual(st.rejected, false);
  assert.strictEqual(H.hashFor(st), '#s=S3&d=20&layer=density&view=raw&card=radiation');
});

test('an old link with a mode opens without the notice; the mode is ignored and not written back', () => {
  for (const m of ['astronaut', 'eldercare']) {
    const st = H.parseHash('#s=S3&d=20&layer=density&view=raw&mode=' + m + '&card=radiation');
    assert.strictEqual(st.rejected, false, m);
    assert.ok(!('mode' in st), m);
    assert.strictEqual(H.hashFor(st), '#s=S3&d=20&layer=density&view=raw&card=radiation', m);
  }
  assert.strictEqual(H.parseHash('#s=S2&mode=pilot').rejected, true);   // not a mode at all
});

test('a link to the removed home scenario S4 shows the notice and the default view', () => {
  const st = H.parseHash('#s=S4&d=34&mode=eldercare&card=sleep');
  assert.strictEqual(st.rejected, true);
  const def = H.parseHash('');
  delete st.rejected; delete def.rejected;
  assert.deepStrictEqual(st, def);
  assert.strictEqual(H.hashFor(st), '#s=S2&d=42&layer=density&view=raw&card=muscle');
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

test('what-if values are kept in the address only when they differ from the default', () => {
  const st = H.parseHash('#s=S1&d=30&ex=0.5&gs=4&sh=0.6&nz=0.05');
  assert.strictEqual(st.rejected, false);
  assert.strictEqual(H.hashFor(st), '#s=S1&d=30&layer=density&view=raw&card=muscle&ex=0.5&gs=4&sh=0.6&nz=0.05');
  assert.strictEqual(H.hashFor(H.parseHash('#s=S2&gs=1')), '#s=S2&d=42&layer=density&view=raw&card=muscle');
});

test('each scenario remembers its own night, layer and view within the page session', () => {
  const mem = {};
  let st = H.parseHash('#s=S2&d=30');
  // Mars day 30 -> the solar-event Moon base: it opens on its defaults (last night, density).
  let ch = H.scenarioChanges(mem, st, 'S3');
  assert.deepStrictEqual(ch, { s: 'S3', d: null, layer: 'density', view: 'raw' });
  st = Object.assign({}, st, ch, { d: 20, layer: 'pressure', view: 'diff' });
  // -> back to Mars: day 30 and the density layer again, not day 42 or the S3 layer.
  ch = H.scenarioChanges(mem, st, 'S2');
  assert.deepStrictEqual(ch, { s: 'S2', d: 30, layer: 'density', view: 'raw' });
  st = Object.assign({}, st, ch);
  // A scenario never visited opens on its defaults.
  assert.deepStrictEqual(H.scenarioChanges(mem, st, 'S1'), { s: 'S1', d: null, layer: 'density', view: 'raw' });
  // S3 comes back as it was left.
  assert.deepStrictEqual(H.scenarioChanges(mem, st, 'S3'), { s: 'S3', d: 20, layer: 'pressure', view: 'diff' });
});
