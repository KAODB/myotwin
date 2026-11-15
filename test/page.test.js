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

test('the scripts load in the same order as before', () => {
  assert.deepStrictEqual(scripts, ['js/evidence.js', 'data/osdr-pwb.js', 'js/model.js', 'data/msl-rad.js', 'data/lro-crater.js', 'data/donki-sep-2017.js',
    'data/omni-protons.js', 'js/sim.js', 'js/rules.js', 'js/engine.js', 'js/phantom.js', 'js/imaging.js', 'js/charts.js', 'vendor/anime.umd.min.js', 'js/motion.js', 'js/app.js']);
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

test('one h1, the landing title; the navigation has its five links in order', () => {
  const h1 = [...bodyHtml.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/g)];
  assert.strictEqual(h1.length, 1);
  assert.match(h1[0][0], /id="hero-title"/);
  assert.match(h1[0][1], /The health check that happens <span class="hl">while you sleep\.<\/span>/);
  const nav = bodyHtml.match(/<nav class="nav-links" aria-label="Steps">([\s\S]*?)<\/nav>/);
  assert.ok(nav, 'nav[aria-label=Steps]');
  const links = [...nav[1].matchAll(/<a href="#([\w-]+)"[^>]*>([\s\S]*?)<\/a>/g)];
  assert.deepStrictEqual(links.map((m) => m[1]), ['top', 'overnight', 'checkin-zone', 'today', 'how-zone']);
  assert.deepStrictEqual(links.map((m) => m[2].replace(/<[^>]+>/g, '')), ['Start', '1Overnight', '2Check-in', '3Today', 'How it works']);
  assert.match(bodyHtml, /<header class="nav">[\s\S]*<select id="scenario"/);
});

test('the landing section has its two buttons, the live line and three step cards', () => {
  const hero = bodyHtml.match(/<section class="hero zone" id="top"[^>]*>([\s\S]*?)<\/section>/);
  assert.ok(hero, 'section.hero#top');
  assert.match(hero[1], /<a class="btn btn-primary" href="#overnight">Start this morning's brief/);
  assert.match(hero[1], /<a class="btn btn-ghost" href="#how-zone">How it works<\/a>/);
  assert.match(hero[1], /id="hero-place"/);
  const steps = [...hero[1].matchAll(/<li><a class="step( step-self)?" href="#([\w-]+)">\s*<span class="step-label">([^<]+)<\/span>\s*<span class="step-name">([^<]+)<\/span>/g)];
  assert.deepStrictEqual(steps.map((m) => m[2]), ['overnight', 'checkin-zone', 'today']);
  assert.deepStrictEqual(steps.map((m) => m[4]), ['Overnight', 'Check-in', 'Today']);
  assert.deepStrictEqual(steps.map((m) => m[3]), ['Step 1 · Measured for you', 'Step 2 · You fill this in', 'Step 3 · What to do']);
  assert.strictEqual(steps[1][1], ' step-self');
  assert.strictEqual((hero[1].match(/class="step-now"/g) || []).length, 3);
});

test('four zones in order, each with a focusable heading; the ruler sits after the three steps', () => {
  const zones = [...bodyHtml.matchAll(/<section class="sec zone[^"]*" id="([\w-]+)" aria-labelledby="([\w-]+)"/g)];
  assert.deepStrictEqual(zones.map((m) => m[1]), ['overnight', 'checkin-zone', 'today', 'how-zone']);
  const heads = { overnight: 'Morning brief', 'checkin-zone': 'Morning check-in.', today: 'Today.', 'how-zone': 'A sensor panel in the bunk. Nothing is worn.' };
  for (const [zone, label] of zones.map((m) => [m[1], m[2]])) {
    const h = bodyHtml.match(new RegExp('<h2 id="' + label + '"[^>]*tabindex="-1">([^<]*)|<h2 class="[^"]*" id="' + label + '" tabindex="-1">([^<]*)'));
    assert.ok(h, zone + ' heading');
    assert.strictEqual((h[1] || h[2]).trim(), heads[zone], zone);
  }
  assert.match(bodyHtml, /class="zone-blue"|class="sec zone zone-blue" id="checkin-zone"/);
  const i = (s) => bodyHtml.indexOf(s);
  assert.ok(i('id="today"') < i('id="timeline"') && i('id="timeline"') < i('id="how-zone"'));
  assert.match(bodyHtml, /<div class="step-zones">/);
});

test('the body image card: label, three layer toggles, the explanation, two view toggles', () => {
  const card = bodyHtml.match(/<div class="pcard" id="brief">([\s\S]*?)<div class="plate-one">/);
  assert.ok(card, '#brief card');
  assert.match(card[1], /<h3 class="mini-label">Body image<\/h3>/);
  assert.deepStrictEqual([...card[1].matchAll(/data-layer="(\w+)"/g)].map((m) => m[1]), ['density', 'pressure', 'impedance']);
  assert.deepStrictEqual([...card[1].matchAll(/data-view="(\w+)"/g)].map((m) => m[1]), ['raw', 'diff']);
  assert.match(card[1], /<p class="explain" id="image-explain" aria-live="polite"><\/p>/);
  assert.doesNotMatch(card[1], /<\/button>, <button/);
});

test('the four check rows sit in their card, closed in the markup', () => {
  const rows = [...html.matchAll(/<details class="row check-row" id="([\w-]+)" data-card="\w+" name="check">\s*<summary><h3 class="row-title">([^<]+)<\/h3>/g)];
  assert.deepStrictEqual(rows.map((m) => m[1]), ['row-muscle', 'row-sleep', 'row-cardio', 'row-radiation']);
  assert.deepStrictEqual(rows.map((m) => m[2]), ['Muscle', 'Sleep', 'Heart and breathing', 'Radiation']);
  assert.doesNotMatch(html, /<details[^>]*\bopen\b/);
});

test('no three-row guide, no fonts loaded, no italics; the sensors and the check-in are not inside a <details>', () => {
  assert.doesNotMatch(html, /id="guide|class="guide/);
  assert.doesNotMatch(html, /rel="preload"|\.woff2/);
  const css = fs.readFileSync(path.join(root, 'css/style.css'), 'utf8');
  assert.doesNotMatch(css, /@font-face|font-style:\s*italic|Garamond/);
  assert.doesNotMatch(bodyHtml, /<i\b|<em\b/);
  const opens = [...bodyHtml.matchAll(/<details\b|<\/details>/g)];
  const inside = (id) => {
    const at = bodyHtml.indexOf('id="' + id + '"');
    let depth = 0;
    for (const m of opens) { if (m.index > at) break; depth += m[0] === '<details' ? 1 : -1; }
    return depth > 0;
  };
  for (const id of ['checkin', 'ci-temp', 'whatif', 'adherence']) assert.ok(!inside(id), id + ' is not inside a <details>');
  for (const t of ['Impedance strip under the calves', 'Radar above the bunk', 'Particle trackers above and below', 'What if I miss exercise sessions?']) {
    const at = bodyHtml.indexOf(t);
    assert.ok(at > 0, t);
    let depth = 0;
    for (const m of opens) { if (m.index > at) break; depth += m[0] === '<details' ? 1 : -1; }
    assert.strictEqual(depth, 0, t + ' is visible, not inside a <details>');
  }
  assert.ok(html.indexOf('id="how-zone"') < html.indexOf('Impedance strip under the calves'));
});

// The morning check-in card: the controls the page script drives.
test('the morning check-in card and its controls exist', () => {
  const rules = require('../js/rules.js');
  const sec = html.match(/<div class="pcard checkin" id="checkin">([\s\S]*?)<p class="next-step">/);
  assert.ok(sec, 'div#checkin');
  for (const id of ['checkin-meta', 'ci-temp', 'ci-temp-hint', 'ci-baseline', 'ci-clear', 'ci-meaning', 'ci-actions', 'ci-decides', 'ci-rows', 'ci-compare']) {
    assert.match(sec[1], new RegExp('id="' + id + '"'), id);
  }
  assert.match(sec[1], /<input type="number" id="ci-temp" min="34" max="42" step="0.1" inputmode="decimal" autocomplete="off"/);
  rules.CHECKIN.moods.forEach((w, i) => assert.match(sec[1], new RegExp('data-mood="' + (i + 1) + '" aria-pressed="false">' + w + '<'), w));
  rules.CHECKIN.symptoms.forEach((x) => assert.match(sec[1], new RegExp('data-sym="' + x.letter + '" aria-pressed="false">' + x.label + '<'), x.label));
  assert.doesNotMatch(sec[1], /<\/button>, <button|<\/button>\.<\/p>/);
  assert.strictEqual(rules.CHECKIN.tempMinC, 34);
  assert.strictEqual(rules.CHECKIN.tempMaxC, 42);
  assert.match(sec[1], /class="ci-result" aria-live="polite"/);
  assert.match(html, /<div class="today-grid" id="today-list"><\/div>/);
});

test('the markup has no inline style or script and no innerHTML in the page script', () => {
  assert.doesNotMatch(bodyHtml, /\sstyle="|<script>(?!<)/);
  assert.doesNotMatch(fs.readFileSync(path.join(root, 'js/app.js'), 'utf8'), /innerHTML|outerHTML|insertAdjacentHTML/);
});

// Anime.js is vendored unchanged and loaded before the page script, through js/motion.js only.
test('index.html loads vendor/anime.umd.min.js and js/motion.js before js/app.js; the vendor file is the recorded one', () => {
  const app = scripts.indexOf('js/app.js'), vendor = scripts.indexOf('vendor/anime.umd.min.js'), motion = scripts.indexOf('js/motion.js');
  assert.ok(vendor >= 0 && motion >= 0, 'both scripts are loaded');
  assert.ok(vendor < motion && motion < app, 'vendor, then motion, then app');
  const sha = require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(root, 'vendor/anime.umd.min.js'))).digest('hex');
  const readme = fs.readFileSync(path.join(root, 'vendor/README.md'), 'utf8');
  assert.match(readme, new RegExp('SHA-256 of `anime.umd.min.js`: `' + sha + '`'));
  assert.ok(fs.existsSync(path.join(root, 'vendor/anime-LICENSE.md')));
  assert.doesNotMatch(fs.readFileSync(path.join(root, 'js/app.js'), 'utf8'), /\banime\./);
  assert.doesNotMatch(fs.readFileSync(path.join(root, 'js/motion.js'), 'utf8'), /innerHTML|splitText|scrambleText|createSpring/);
});

// The trend charts say which marks are the person's and which are expected (js/app.js trendSpec).
test('trend charts: a plain title per check, "your" for the person\'s data and "expected" for the plan', () => {
  const app = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
  for (const t of ["'Your calf muscle signal each night, against what the mission plan expects.'",
    "'Your hours asleep each night, against the ' + x.amberHours + '-hour line.'",
    "'Your night-time heart rate, against your own normal range.'",
    "'The dose over each sleep period, against a usual night.'"]) assert.ok(app.includes("o.title = " + t), t);
  for (const t of ["'Your nightly reading'", "'Your ' + WINDOW + '-night median'", "'Your baseline range (before departure)'",
    "'Expected by the mission plan (Watch below this band)'", "'Your ' + WINDOW + '-night mean'", "'Your normal range (before departure)'",
    "'A usual night'", "o.youLabel = 'You'", "o.expectedLabel = 'Expected: mission plan'", "o.baselineLabel = 'Your baseline'",
    "o.baselineLabel = 'Your normal range'", "label: 'Usual night'", "o.yTitle = 'Calf muscle signal (phase, deg)'"]) assert.ok(app.includes(t), t);
  assert.doesNotMatch(app, /'Own baseline range'|'Plan \(Watch below this band\)'|\['dot', 'Nightly reading'\]/);
  assert.match(app, /\$\('trend-title'\)\.textContent = t\.opts\.title;/);
  assert.doesNotMatch(fs.readFileSync(path.join(root, 'js/charts.js'), 'utf8'), /'Own baseline'/);
});

// The brief is read in the morning: the night the readings come from is "last night".
test('wording: "last night" for the night just slept, plain table and what-if words, the rose names a side of the picture', () => {
  const app = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
  const rules = require('../js/rules.js');
  assert.match(html, /data-view="raw" aria-pressed="true">Last night<\/button>/);
  assert.match(html, /The bunk ran four checks while you slept\. Nothing for you to do\./);
  assert.match(html, /The nights are recalculated\./);
  assert.match(html, /<th scope="col">Taken together<\/th>/);
  for (const s of ["'Last night was '", "'Last night\\'s dose replays what NASA\\'s Curiosity rover measured on Mars on sol '",
    "'Last night\\'s dose replays what NASA\\'s Lunar Reconnaissance Orbiter measured in lunar orbit on the night of '",
    "'Radiation was raised last night, so last night\\'s tracks are left out of the density image.'", 'Blue dots are loss, white dots gain',
    "'the right side of the picture'"]) assert.ok(app.includes(s), s);
  assert.doesNotMatch(app, /ink dots gain|' side\.'|Tonight/);
  assert.strictEqual(rules.CHECKIN.verdicts['agree-clear'], 'You and the bunk agree: nothing has changed.');
  assert.match(rules.CHECKIN.verdicts['agree-flag'], /^You and the bunk both notice a change\./);
  assert.match(rules.THRESHOLDS.radiationAmberRatio.note, /^Last night /);
  const bodyText = html.slice(html.indexOf('<body')).replace(/<!--[\s\S]*?-->/g, '');
  assert.doesNotMatch(bodyText, /Tonight|tonight/);
});
