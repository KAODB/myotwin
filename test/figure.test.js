// Checks that the hotspots on the body figure (css/style.css) sit on the body parts
// of the phantom (js/phantom.js), and that index.html has one hotspot per check.
// Written with an SI tool (Claude) and reviewed by the team.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const phantom = require('../js/phantom.js');

const read = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const extent = (name) => phantom.ASSUMPTIONS.find((a) => a.name === name + 'Extent').value;
const HEIGHT_CM = 192;

function topCm(css, cls) {
  const m = css.match(new RegExp('\\.' + cls + ' \\{[^}]*top: calc\\(100% \\* ([\\d.]+) / (\\d+)\\)'));
  assert.ok(m, cls + ' has a top position');
  assert.strictEqual(Number(m[2]), HEIGHT_CM, cls + ' is placed on the 192 cm body');
  return Number(m[1]);
}

test('the phantom is 192 cm tall, as the hotspot positions assume', () => {
  const p = phantom.build();
  assert.strictEqual(p.h * p.cellCm, HEIGHT_CM);
});

test('each hotspot sits inside its body part', () => {
  const css = read('css/style.css');
  const head = extent('head'), torso = extent('torso'), calf = extent('calf');
  assert.strictEqual(topCm(css, 'hs-sleep'), (head[0] + head[1]) / 2);
  assert.strictEqual(topCm(css, 'hs-cardio'), torso[0] + (torso[1] - torso[0]) / 4);
  assert.strictEqual(topCm(css, 'hs-muscle'), (calf[0] + calf[1]) / 2);
});

test('index.html has one hotspot button per check with an accessible name', () => {
  const html = read('index.html');
  for (const [card, part] of [['sleep', 'Head'], ['cardio', 'Chest'], ['radiation', 'Whole body'], ['muscle', 'Calves']]) {
    const re = new RegExp('<button type="button" class="hs hs-' + card + '[^"]*" data-card="' + card + '" aria-pressed="false" aria-label="' + part + ': ');
    assert.match(html, re, card + ' hotspot');
  }
});
