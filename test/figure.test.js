// Checks that the hotspots on the plate sit on the body parts of the phantom (js/phantom.js):
// js/app.js places them from the phantom's own extents (hotspotCm, in the presentation helpers
// block) and js/charts.js maps body centimetres to plate pixels (plateLayout). index.html has one
// hotspot per check.
// Written with an SI tool (Claude) and reviewed by the team.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const phantom = require('../js/phantom.js');
const charts = require('../js/charts.js');

const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const extent = (name) => phantom.ASSUMPTIONS.find((a) => a.name === name + 'Extent').value;
const app = read('js/app.js');
const block = app.match(/\/\/ BEGIN presentation helpers\n([\s\S]*?)\n\s*\/\/ END presentation helpers/)[1];
const P = new Function(block + '\nreturn { hotspotCm, regionCentreXCm };')();
const HEIGHT_CM = 192;

test('the phantom is 192 cm tall, as the hotspot positions assume', () => {
  const p = phantom.build();
  assert.strictEqual(p.h * p.cellCm, HEIGHT_CM);
});

test('each hotspot is placed at the centre of its body part', () => {
  const ph = phantom.build(), at = P.hotspotCm(phantom.ASSUMPTIONS, ph);
  const head = extent('head'), torso = extent('torso'), calf = extent('calf'), pelvis = extent('pelvis');
  assert.deepStrictEqual(at.sleep, [0, (head[0] + head[1]) / 2]);
  assert.deepStrictEqual(at.cardio, [0, torso[0] + (torso[1] - torso[0]) / 4]);
  assert.deepStrictEqual(at.radiation, [0, (pelvis[0] + pelvis[1]) / 2]);
  assert.strictEqual(at.muscle[1], (calf[0] + calf[1]) / 2);
  assert.ok(at.muscle[0] > 4 && at.muscle[0] < 10, 'left calf centre ' + at.muscle[0] + ' cm (patient left, image right)');
});

test('on the plate, each hotspot lands on a cell of its own body region', () => {
  const ph = phantom.build(), at = P.hotspotCm(phantom.ASSUMPTIONS, ph);
  const want = { sleep: ['head'], cardio: ['torso'], radiation: ['pelvis'], muscle: ['calf_L'] };
  for (const [W, H] of [[600, 744], [420, 501], [343, 343]]) {
    const lay = charts.plateLayout(ph, W, H, 0.78);
    for (const id of Object.keys(want)) {
      const x = lay.px(at[id][0]), y = lay.py(at[id][1]);
      const col = Math.floor((x - lay.ox) / lay.cell) + lay.box.x0, row = Math.floor((y - lay.oy) / lay.cell) + lay.box.y0;
      assert.ok(want[id].includes(ph.REGIONS[ph.region[row * ph.w + col]]), id + ' at ' + W + 'x' + H + ' falls on ' + ph.REGIONS[ph.region[row * ph.w + col]]);
    }
  }
});

test('index.html has one hotspot button per check with an accessible name', () => {
  const html = read('index.html');
  for (const [card, part] of [['sleep', 'Head'], ['cardio', 'Chest'], ['radiation', 'Whole body'], ['muscle', 'Calves']]) {
    const re = new RegExp('<button type="button" class="hs hs-' + card + '[^"]*" data-card="' + card + '" aria-pressed="false" aria-label="' + part + ': ');
    assert.match(html, re, card + ' hotspot');
  }
});
