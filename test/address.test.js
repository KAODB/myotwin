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
const H = new Function('sim', 'has', block + '\nreturn { parseHash, hashFor, scenarioChanges, checkinReset, WHATIF };')(sim, has);

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
  assert.strictEqual(H.hashFor(st), '#s=S2&d=42&layer=density&view=raw');
});

test('a repeated key shows the notice', () => {
  assert.strictEqual(H.parseHash('#s=S2&d=10&d=20').rejected, true);
  assert.strictEqual(H.parseHash('#s=S2&s=S2').rejected, true);
  assert.strictEqual(H.parseHash('#s=S2&d=10').rejected, false);
});

test('really invalid values still show the notice', () => {
  for (const h of ['#s=S9', '#s=S2&d=ten', '#s=S2&layer=xray', '#s=S2&gs=9', '#s=S2&foo=1', '#s=S2&card', '#s=S2&card=heart', '#s=S2&ev=85']) {
    assert.strictEqual(H.parseHash(h).rejected, true, h);
  }
});

test('what-if values are kept in the address only when they differ from the default', () => {
  const st = H.parseHash('#s=S1&d=30&ex=0.5&gs=4&sh=0.6&nz=0.05');
  assert.strictEqual(st.rejected, false);
  assert.strictEqual(H.hashFor(st), '#s=S1&d=30&layer=density&view=raw&ex=0.5&gs=4&sh=0.6&nz=0.05');
  assert.strictEqual(H.hashFor(H.parseHash('#s=S2&gs=1')), '#s=S2&d=42&layer=density&view=raw');
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

test('check-in keys: valid values load and are written after the what-if values', () => {
  const st = H.parseHash('#s=S2&d=62&card=cardio&gs=2&mo=2&tc=37.9&sy=li');
  assert.strictEqual(st.rejected, false);
  assert.deepStrictEqual([st.mo, st.tc, st.sy], [2, 37.9, 'li']);
  assert.strictEqual(H.hashFor(st), '#s=S2&d=62&layer=density&view=raw&card=cardio&gs=2&mo=2&tc=37.9&sy=li');
  for (const sy of ['l', 'r', 'i', 'lr', 'li', 'ri', 'lri']) assert.strictEqual(H.parseHash('#s=S2&sy=' + sy).sy, sy, sy);
  for (const tc of ['34', '34.0', '36.6', '42', '42.0']) assert.strictEqual(H.parseHash('#s=S2&tc=' + tc).rejected, false, tc);
  assert.strictEqual(H.hashFor(H.parseHash('#s=S2&tc=37')), '#s=S2&d=42&layer=density&view=raw&tc=37');
});

test('check-in keys are absent by default and not written', () => {
  const st = H.parseHash('#s=S2&d=42');
  assert.deepStrictEqual([st.mo, st.tc, st.sy], [null, null, '']);
  assert.strictEqual(H.hashFor(st), '#s=S2&d=42&layer=density&view=raw');
  const def = H.parseHash('');
  assert.deepStrictEqual([def.mo, def.tc, def.sy], [null, null, '']);
});

test('invalid, altered or repeated check-in values show the notice', () => {
  for (const h of ['mo=0', 'mo=6', 'mo=2.0', 'mo=', 'tc=33.9', 'tc=42.1', 'tc=37.25', 'tc=abc', 'tc=', 'tc=037', 'tc=-37',
    'sy=x', 'sy=il', 'sy=ll', 'sy=', 'sy=L', 'mo=2&mo=3', 'tc=37&tc=37', 'sy=l&sy=l']) {
    const st = H.parseHash('#s=S2&d=42&' + h);
    assert.strictEqual(st.rejected, true, h);
  }
});

test('a link with a night and check-in keys keeps them', () => {
  const st = H.parseHash('#s=S2&d=62&card=cardio&mo=2&tc=38.2&sy=lri');
  assert.strictEqual(st.rejected, false);
  assert.deepStrictEqual([st.d, st.mo, st.tc, st.sy], [62, 2, 38.2, 'lri']);
});

test('a check-in belongs to one morning: night or scenario changes clear it, others keep it', () => {
  const st = H.parseHash('#s=S2&d=62&mo=2&tc=38.2&sy=li');
  const CLEAR = { mo: null, tc: null, sy: '' };
  assert.deepStrictEqual(H.checkinReset(st, { d: 63 }), CLEAR);
  assert.deepStrictEqual(H.checkinReset(st, { s: 'S1', d: null, layer: 'density', view: 'raw' }), CLEAR);
  assert.deepStrictEqual(H.checkinReset(st, { gs: 2 }), {});
  assert.deepStrictEqual(H.checkinReset(st, { ex: 0.5, sh: 0.6, nz: 0.05 }), {});
  assert.deepStrictEqual(H.checkinReset(st, { d: 62 }), {});
  assert.deepStrictEqual(H.checkinReset(st, { s: 'S2' }), {});
  assert.deepStrictEqual(H.checkinReset(st, { card: 'sleep', layer: 'pressure' }), {});
});

test('no row is open by default: the default address carries no card', () => {
  const def = H.parseHash('');
  assert.strictEqual(def.card, null);
  assert.strictEqual(H.hashFor(def), '#s=S2&d=42&layer=density&view=raw');
  assert.strictEqual(H.hashFor(H.parseHash('#s=S1&d=30')), '#s=S1&d=30&layer=density&view=raw');
});

test('a link with card=sleep opens that row and round-trips', () => {
  const st = H.parseHash('#s=S2&d=42&layer=density&view=raw&card=sleep');
  assert.strictEqual(st.rejected, false);
  assert.strictEqual(st.card, 'sleep');
  assert.strictEqual(H.hashFor(st), '#s=S2&d=42&layer=density&view=raw&card=sleep');
  assert.strictEqual(H.hashFor(Object.assign({}, st, { card: null })), '#s=S2&d=42&layer=density&view=raw');
});

test('an evidence id from an older link is accepted, ignored and not written back', () => {
  const st = H.parseHash('#s=S2&d=62&card=cardio&ev=V85');
  assert.strictEqual(st.rejected, false);
  assert.ok(!('ev' in st));
  assert.strictEqual(H.hashFor(st), '#s=S2&d=62&layer=density&view=raw&card=cardio');
  assert.strictEqual(H.parseHash('#s=S2&ev=V85&ev=V86').rejected, true);   // repeated
});
