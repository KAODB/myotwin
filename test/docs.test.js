// Checks that the documents stay tied to the code: docs/EVIDENCE.md must match
// what tools/evidence-md.js generates now, and every evidence id named in the
// project documents must exist in js/evidence.js.
//
// Written with an SI tool (Claude) and reviewed by the team.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const evidence = require('../js/evidence.js');
const { render } = require('../tools/evidence-md.js');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

test('docs/EVIDENCE.md is up to date (run: node tools/evidence-md.js > docs/EVIDENCE.md)', () => {
  assert.equal(read('docs/EVIDENCE.md'), render());
});

test('every evidence id named in the project documents exists', () => {
  const known = new Set(evidence.items.map((it) => it.id));
  for (const file of ['docs/SUBMISSION.md', 'docs/SI_USE.md', 'docs/SENSOR_ASSUMPTIONS.md']) {
    const ids = read(file).match(/\bV\d+\b/g) || [];
    assert.ok(ids.length > 0, file + ' names no evidence ids');
    for (const id of ids) assert.ok(known.has(id), file + ' names unknown evidence id ' + id);
  }
});
