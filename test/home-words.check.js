// Scripted browser check: in the home scenario (S4, the Eldercare presentation) no
// spaceflight word may be visible, except in the one deliberate row ("Why a spaceflight
// tool applies at home"), the evidence drawer (source titles and claims), the
// scenario list and the Astronaut / Eldercare switch. Fails with exit code 1 and lists every hit.
//
// Not part of `node --test` (it needs a browser). Run against a local static server:
//   PLAYWRIGHT=/path/to/node_modules/playwright node test/home-words.check.js http://127.0.0.1:PORT/
//
// Written with an SI tool (Claude) and reviewed by the team.
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');

const BASE = process.argv[2];
const BANNED = /sleep station|bunk|mission|habitat|countermeasure|flight surgeon|crew|\bmoon\b|\bmars\b|transit|astronaut|in space/gi;
const EXEMPT = ['#g-context-title', '#g-context', '#evidence', '#scenario', '.segmented[aria-label="Display mode"]'];
const VIEWS = [];
for (const card of ['muscle', 'sleep', 'cardio']) {
  for (const layer of ['pressure', 'impedance']) {
    for (const view of ['raw', 'diff']) VIEWS.push({ card, layer, view });
  }
}

async function visibleText(page) {
  return page.evaluate((exempt) => {
    const skip = exempt.map((s) => document.querySelector(s)).filter(Boolean);
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const out = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const p = n.parentElement;
      if (!p || skip.some((s) => s.contains(p))) continue;
      if (p.closest('script, style, noscript, title') || !p.checkVisibility()) continue;
      if (n.textContent.trim()) out.push(n.textContent.trim());
    }
    return out.join(' | ');
  }, EXEMPT);
}

(async () => {
  if (!BASE) { console.error('Usage: node test/home-words.check.js <base url>'); process.exit(2); }
  const browser = await chromium.launch({ headless: true });
  const hits = [];
  for (const width of [375, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    for (const v of VIEWS) {
      await page.goto(`${BASE}#s=S4&d=40&card=${v.card}&layer=${v.layer}&view=${v.view}`);
      await page.waitForFunction(() => document.body.classList.contains('mode-eldercare'));
      const found = (await visibleText(page)).match(BANNED);
      if (found) hits.push(`${width}px ${JSON.stringify(v)}: ${[...new Set(found)].join(', ')}`);
    }
    await page.close();
  }
  await browser.close();
  if (hits.length) { console.error('Spaceflight words visible in the home scenario:\n' + hits.join('\n')); process.exit(1); }
  console.log('OK: no spaceflight words visible in the home scenario (' + VIEWS.length * 2 + ' views checked).');
})();
