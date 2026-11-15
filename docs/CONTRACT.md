# MyoTwin module contract

This file is the shared interface for everyone (human or SI agent) working on
the code. If you need to change anything here, stop and ask the orchestrator;
do not change it on your own.

## What the product is

Crew sleep in a lunar or Mars surface habitat. A sensor panel in the sleep
station measures them passively all night. MyoTwin is the software: every
morning it turns the night's data into a brief (one whole-body image, four
status cards, trends against the person's own baseline, and what to do next).
The hardware is assumed, not built. All data in this repository are simulated
and the UI must say so at all times.

## Ground rules

1. Static site. No build step, no backend, no network requests, no CDN. The only
   third-party script is Anime.js 4.5.0 (MIT), vendored unchanged in `vendor/` with its
   licence and SHA-256 (`vendor/README.md`, checked by `test/page.test.js`) and used only
   through `js/motion.js`. It must work when `index.html` is opened from disk
   (`file://`) and from GitHub Pages.
2. Plain `<script>` tags, no ES modules (modules do not load from `file://`).
   Modern JavaScript syntax is fine (const, let, arrow functions, classes).
3. Every number used in logic or shown in the UI comes from `js/evidence.js`
   (by id) or is declared as an assumption in the module that owns it, with a
   `status` of `fitted` or `assumption` and a note. No magic numbers.
4. English only, everywhere (code, comments, UI text, docs, commit messages).
5. No personal data. No company names or product promotion.
6. Never delete an existing file. If you think one should go, report it.
7. Tests use the Node built-in runner only: `node --test "test/*.test.js"`. No packages.
8. Each file starts with a short comment saying what it does and that it was
   written with an SI tool (Claude) and reviewed by the team.

## Module pattern

Every file in `js/` uses this wrapper so it works in the browser and in Node:

```js
(function (root) {
  'use strict';
  var ns = (root.MyoTwin = root.MyoTwin || {});
  var inNode = typeof module === 'object' && module.exports;
  var evidence = inNode ? require('./evidence.js') : ns.evidence;
  // ... other dependencies the same way ...

  var api = { /* public functions */ };

  ns.NAME = api;                       // NAME = model, sim, rules, engine, phantom, imaging, charts
  if (inNode) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
```

Browser load order: `evidence, model, sim, rules, engine, phantom, imaging, charts, vendor/anime.umd.min.js, motion, app`.

## File ownership

| File | Owner | Depends on |
|---|---|---|
| `js/evidence.js` | orchestrator | none |
| `js/model.js`, `js/sim.js`, `test/model.test.js`, `test/sim.test.js` | model-sim agent | evidence |
| `js/rules.js`, `js/engine.js`, `test/engine.test.js` | engine agent | evidence |
| `js/phantom.js`, `js/imaging.js`, `test/imaging.test.js` | imaging agent | evidence |
| `index.html`, `css/style.css`, `js/charts.js`, `js/motion.js`, `js/app.js` | UI agent | all of the above |
| `vendor/` (third-party files, unchanged) | orchestrator | none |
| `test/fixture.js`, `test/evidence.test.js`, `docs/CONTRACT.md` | orchestrator | evidence |

Do not edit a file you do not own. If you need something from another module
that this contract does not give you, report it instead of working around it.

## Data contract

### NightRecord

One record per night. Pre-departure baseline nights have a negative `missionDay`.

```js
{
  night: '2031-03-14',            // ISO date at the habitat
  missionDay: 45,                 // surface day; baseline nights are -14 .. -1
  env: 'moon' | 'mars' | 'earth',
  eim: {                          // null when no usable scan that night
    site: 'calf_L',
    phase50_deg: 8.9,             // 50 kHz phase, median of that night's scans
    contact: 0.82,                // contact quality 0..1
    scans: 4                      // number of usable scans (usable = contact >= 0.6)
  },
  radar: {                        // null when the radar had no data
    sleep_h: 6.4,                 // hours asleep
    efficiency: 0.86,             // asleep / time in bed, 0..1
    rr_bpm: 14.2,                 // respiratory rate, breaths per minute (night median)
    hr_bpm: 54.0,                 // heart rate, beats per minute (night median)
    movement: 0.21                // movement index 0..1
  },
  rad: {                          // null when no data
    dose_uGy: 104.5,              // dose over the sleep period, replayed from a measurement (the shielding factor does not apply)
                                  // (Mars: Curiosity RAD, silicon; Moon: LRO CRaTER, water-corrected)
    dir: [n0, n1, ..., n7],       // particle counts in 8 azimuth sectors, sector 0 = toward the head (simulated)
    spe: false,                   // solar particle event flag (S3: from DONKI records of GOES instruments, see sim.ASSUMPTIONS.speRule)
    measured: {                   // provenance of dose_uGy
      dataset: 'msl-rad',         // 'msl-rad' (data/msl-rad.js) or 'lro-crater' (data/lro-crater.js)
      sol: 61, date: '2012-10-07' // msl-rad: sol and its UTC date; lro-crater: { date, pair: 'D5&6' }, date = night start (UTC)
    },
    events: [{ id, start }]       // S3 only: GOES DONKI SEP records matching the night, by start time; null when DONKI was not checked for that night
  },
  log: { exercise_done: true, note: '' },   // countermeasure log for the day before
  _truth: {                       // simulator only; the engine must never read this
    muscleChangePct: -3.1,        // true calf muscle change vs baseline, percent (negative = loss)
    tracksPerCm2: 2100,           // cosmic-ray tracks that night (x shielding factor); null when rad is null
    tracksUsable: true            // false on solar-event or raised-dose nights (sim.ASSUMPTIONS.trackQuietMaxRatio):
                                  // tracksPerCm2 then stays at the usual level and the density image leaves the night out;
                                  // null when rad is null
  }
}
```

### Assessment

```js
{
  night: '2031-03-14',
  missionDay: 45,
  cards: [
    {
      id: 'muscle' | 'sleep' | 'cardio' | 'radiation',
      status: 'green' | 'amber' | 'red' | 'grey',
      value: 8.9,                 // headline number shown on the card (null when grey)
      unit: 'deg',
      deltaPct: -4.8,             // change versus the person's own baseline, percent (null if not applicable)
      reason: 'short sentence',   // why this status, in plain words
      meaning: 'short sentence',  // what it means
      actions: ['...', '...'],    // what to do now
      decides: 'flight surgeon',  // who decides
      sourceIds: ['V10', 'V1'],   // evidence ids behind the rule
      expectedDeltaPct: -9.1,     // muscle only: what the plan expects (null otherwise)
      extra: { }                  // numbers the UI needs, per card (see "Card extras")
    }
    // exactly four cards, always in the order muscle, sleep, cardio, radiation
  ],
  overall: 'green' | 'amber' | 'red' | 'grey',   // worst non-grey status; grey only if all four are grey
  headline: 'one sentence for the top of the brief'
}
```

### Card extras

- muscle: `{ dropPct, expectedDropPct, amberLimitPct, redLimitPct }` (all in percent of the baseline median).
- sleep: `{ amberHours, redHours, nights }`.
- cardio: `{ hr, rr, hrLimit, rrLimit, sustained }`. `sustained` is true when both were above their limits on each of the last 3 nights.
- radiation: `{ ratio, usualUGy, cumulativeUGy }`. `cumulativeUGy` is the sum of the sleep-period doses of all mission nights up to tonight.

On a grey card `extra` holds whatever is known and null for the rest.

## Function signatures

### model (`js/model.js`)

- `model.PARAMS` : object of named parameters, each `{ value, unit, status: 'fitted' | 'assumption', anchors: ['V4', ...], note }`.
- `model.GRAVITY` : `{ microgravity: 0, moon, mars, earth: 1 }` taken from evidence V14.
- `model.step(prevChangePct, { g, exerciseAdherence, gravityShape }) -> number`
  One day of the first-order model. `prevChangePct` and the result are muscle
  change in percent versus baseline (negative = loss).
  Target = `-100 * maxLossFraction * unloading(g) * (1 - exerciseEfficacy * exerciseAdherence)`,
  with `unloading(g) = (1 - g) ^ gravityShape` (default shape 1). At `g >= 1` the
  value recovers toward 0 with the recovery time constant.
- `model.simulate(phases, opts) -> number[]`
  `phases = [{ days, g, exerciseAdherence }]`; returns one value per day,
  starting with day 0 = 0.
- `model.eimPhase(baselinePhaseDeg, muscleChangePct) -> number`
  Maps muscle change to expected EIM phase with the declared assumption.
- `model.gravityTerm(g, shape) -> number` : `(1 - g) ^ shape`, the unloading factor `step` uses.
- `model.shareOfUnloadedLoss(changePartial, changeUnloaded, changeControl) -> number | null`
  `(changePartial - changeControl) / (changeUnloaded - changeControl)`; null when the denominator is 0.
- `model.checkGravityTerm(data, shape) -> { partialG, shape, model, measures, min, median, max }`
  `data` = `data/osdr-pwb.js` (rat partial weight bearing, NASA OSDR OSD-652 and OSD-616, evidence V90-V91).
  `measures`: six `{ measure, sex, day: 28, pct1g, pct04g, pct0g, share, unstable }` (grip,
  plantarflexion torque, calf girth; F and M); `model = gravityTerm(partialG, shape)`.
  `unstable` uses the declared `model.GRAVITY_CHECK.unstablePoints`. `model.js` also loads the data
  (Node: require; browser: `MyoTwin.data.osdrPwb`, so `index.html` loads `data/osdr-pwb.js` before it) to
  write the result into the `gravityShape` note.
- `model.describeGravityCheck(check) -> { marks, sentences: [3], caveats, closing }`
  The page text for that check, composed only from a `checkGravityTerm` result.

### sim (`js/sim.js`)

- `sim.SCENARIOS` : `{ S1, S2, S3 }`, each `{ id, title, env, summary, baselineNights, phases, events, rad }`; `rad` names the real dataset and window the radiation replays.
- `sim.generate(scenarioId, opts) -> { scenario, records, plan }`
  `opts = { seed = 1, exerciseAdherence?, gravityShape?, sleepOpportunityH?, shieldingFactor? }`.
  `shieldingFactor` scales `_truth.tracksPerCm2` only, never `rad.dose_uGy`.
  Deterministic for a given seed. `records` is a `NightRecord[]` sorted by night.
  `plan = { expectedChangePct: number[] }` has one value per record: the muscle change the
  mission plan expects that night (0 on baseline nights). The plan is the scenario flown as
  intended (planned exercise, no lapses, normal activity); it uses the same gravity shape as
  the records. Each scenario lists its `planPhases` next to its `phases`.
  Each scenario also has `person = { baselinePhaseDeg, hrBpm, rrBpm }` and its own default
  `seed`, so the three scenarios do not show the same person. `opts.seed` overrides the default.
  `opts.eimNoiseSdFraction` overrides the night-to-night EIM noise (a what-if for a noisier sensor).
  An unknown scenario id (including inherited names such as `__proto__`) throws a clear error.
- `sim.NOISE` : declared night-to-night noise levels (assumptions).

### rules (`js/rules.js`) and engine (`js/engine.js`)

- `rules.THRESHOLDS` : thresholds as data, each with `sourceIds`.
- `rules.TEXT[cardId][status]` : `{ meaning, actions: [...] }`.
- `rules.CONTEXT[cardId]` : `{ risk, note, sourceIds }`. `risk` is the NASA Human Research
  Program risk the check relates to, read from evidence V44; `note` is one sentence backed by `sourceIds`.
  The page shows `note` as the last paragraph of the check's "NASA on this risk" sub-row, as plain text.
- `rules.HAZARDS` : five `{ name, coverage: 'covered' | 'partly' | 'not covered', text }` rows,
  in the order and with the names of evidence V43 (NASA's five hazards of human spaceflight).
  The first four rows also carry `fact: { text, sourceIds }`, one statement from NASA's hazard page;
  "Distance from Earth" adds `worldFact: { moon, mars }` (NASA's ratings for that mission type, V74 and V75).
  "Isolation and Confinement" adds `quote: { text, sourceIds }`, V52's verbatim `says` sentence.
  Kept for the docs and tests; the page no longer shows the hazards.
- `rules.MISSIONS` : `{ moon, mars }`, each `{ prefix, label }`: the Human Research Roadmap mission type used
  for that world (`lunarSurfaceLong`, a long lunar-surface mission; `marsPlanetary`, a Mars planetary mission).
- `rules.NASA[cardId]` : NASA's material for each check, built from evidence values:
  `{ risk, riskSourceIds, roadmapId, ratings: { moon, mars } (each { code, disposition, text }), scale, lastPublished,
  riskPageId, says, canBeDone, standard: [{ text, sourceIds }], gap: { id, text } }`. Ratings are the in-mission
  (operations) rating, except radiation, which shows the long-term health rating (its operations rating is 1x1).
  `says` and `canBeDone` are verbatim sentences from the NASA risk page (V48 to V51).
- `rules.WORDING` : the crew terms filled into the card text (for example who decides).
- `engine.baseline(records) -> { eim: { median, sd, n }, sleep: {...}, rr: {...}, hr: {...} }`
  Uses the nights with `missionDay < 0`.
- `engine.assess(records, index, opts) -> Assessment`
  Assesses the night at `records[index]` using only `records[0..index]`.
  `opts = { expectedChangePct? }`. `expectedChangePct` is the plan array
  from `sim.generate` (aligned with `records`); when it is absent the plan is "no change".
- `engine.project(records, index) -> { cardId: 'muscle', daysToRed, slopePctPerWeek } | null`
  Uses only complete weekly windows of mission nights; returns null when fewer than 3 such
  windows exist, when the trend is not falling, or when the result would be under 1 day.
- `engine.series(records, key) -> [{ missionDay, value }]`
  Convenience for charts. `key` is one of `eim`, `sleep`, `rr`, `hr`, `dose`.
- `rules.CHECKIN` : the morning check-in as data: `moods` (five words, 1 to 5), `symptoms`
  (`[{ id, letter, label, card }]` for legs `l`, not rested `r`, ill `i`), `tempMinC` 34 and `tempMaxC` 42,
  and every sentence `engine.checkin` writes (meanings, actions, verdicts, summary parts, status words).
  Thresholds: `checkinTempRiseC` (1.1 °C, V97), `checkinTempDropC` (1.1 °C, assumption),
  `checkinBaselineTempC` (36.6 °C, assumption),
  `checkinLowMoodAtMost` (2, assumption).
- `engine.checkin(input, cards) -> { done, status, flags, temp, meaning, actions, decides, rows, summary }`
  `input = { mood: 1..5 | null, tempC: number | null, symptoms: { legs, tired, ill } }`; `cards` is
  `assess(...).cards` for the same night. `status` is `grey` (nothing answered), `amber` (any flag) or
  `green`; there is no red tier for self-report. `flags` in priority order: `fever` (more than
  `checkinTempRiseC` over the baseline, compared in whole tenths), `low` (more than
  `checkinTempDropC` below it), `ill` (not with a fever), `mood`
  (at most `checkinLowMoodAtMost`), `legs`, `tired`. `temp = { valueC, baselineC, riseC, raised, low } | null`.
  A mood that is not an integer 1 to 5, or a temperature that is not a finite number, counts as not given.
  `actions` are de-duplicated, at most 5. `rows` (empty when not done) are muscle, sleep, cardio,
  radiation: `{ card, said, bunk, verdict }`, verdict one of `agree-clear`, `bunk-only`, `self-only`,
  `agree-flag`, `no-bunk`, `cannot-feel` (radiation always). `summary` is one line for the first screen.

### phantom (`js/phantom.js`) and imaging (`js/imaging.js`)

- `phantom.build({ calfMuscleChangePct = 0, thighMuscleChangePct = 0 }) ->
  { w, h, cellCm: 2, soft: Float32Array, bone: Float32Array, region: Uint8Array, REGIONS }`
  A simplified supine body on a 2 cm grid. `soft` and `bone` are path lengths in cm
  through each cell; `region` holds an index into `REGIONS`
  (`['none','head','torso','arm_L','arm_R','pelvis','thigh_L','thigh_R','calf_L','calf_R','foot_L','foot_R']`).
- `imaging.tracksPerCm2({ verticalIntensity, coneHalfAngleDeg = 20, hours = 8, shieldingFactor = 1 }) -> number`
- `imaging.render(layer, phantomNow, opts) -> { w, h, values: Float32Array, unit, min, max, label }`
  `layer` is `'density' | 'pressure' | 'impedance'`.
  `opts = { tracksPerCm2, seed, env, momentumSpreadFactor, eimPhaseDeg, baselinePhaseDeg }`.
- `imaging.difference(imageNow, imageBaseline, phantomNow) -> { w, h, values, unit: '%', min, max, label }`
  Percent change per cell, averaged within each body region to tame noise.
- `imaging.regionStats(image, phantomNow) -> { regionName: { mean, n } }`

### charts (`js/charts.js`) and app (`js/app.js`)

Owned by the UI agent; internal structure is free. Requirements are in the
agent brief. The page state lives in the URL hash so that any view can be
shared and captured:

`#s=S2&d=45&layer=density&view=raw&card=muscle`

- `s` scenario id, `d` mission day, `layer` image layer (`density|pressure|impedance`),
  `view` (`raw|diff`), `card` the open check row (`muscle|sleep|cardio|radiation`), written only
  while a check row is open; absent on a plain landing. Opening a row (its title, its margin note,
  its hotspot on the body figure, or the guide) sets it; closing the row removes it. A link with a
  valid `card` opens that row on load; an invalid one shows the notice.
- What-if values in the address: `ex` 0 to 1 (step 0.05; the one what-if slider on the page, "Sessions done"), `gs` 0.25 to 4 (step 0.25, default 1;
  older links with 1 to 4 in steps of 0.5 still load), `sh` 0.6 to 1 (step 0.1; the share of
  cosmic-ray tracks behind habitat shielding, the dose is unchanged; an older link below 0.6 is out
  of range and shows the notice), `nz` 0.01 to 0.08. `gs`, `sh` and `nz` have no slider on the page
  any more; they keep working for older links, and "Back to the plan" resets all four.
- The density image (raw and change views) uses only nights with `_truth.tracksUsable !== false`.
  A left-out night shows the body outline only, with a sentence saying why; the change view
  accumulates only the usable nights of its window and of the first week, and its label says
  how many nights were left out. These sentences, and the one for baseline nights (no image), are the
  only text under the plate (`#plate-note`); in every other state the figure has no visible caption
  (its accessible name is the visually hidden `#cap-label`).
- `mode` is no longer written. A `mode` of `astronaut` or `eldercare` in an older link is accepted
  and ignored, without the notice (for example `#s=S3&d=20&mode=eldercare&card=radiation`); any
  other `mode` value shows the notice. `ev` (an evidence id such as `V85`, from older links that
  opened the evidence list) is accepted and ignored the same way and is no longer written; a value
  that is not an evidence id shows the notice.
- An unknown scenario (for example `s=S4`, the removed home scenario) shows the notice and opens
  the default view (`#s=S2&d=42&layer=density&view=raw`), ignoring the rest of the address.
- Any value in the address that is unknown, repeated (for example `d=10&d=20`), rejected or changed
  to fit (for example a day outside the scenario) falls back as before and shows the notice "This
  link could not be opened; showing the default view." The parser, `hashFor` and the per-scenario memory sit between
  the markers `BEGIN view-state helpers` and `END view-state helpers` in `js/app.js` and are tested
  in Node by `test/address.test.js`.
- Morning check-in in the address, all optional and absent by default, written after the what-if
  values: `mo` mood 1 to 5; `tc` temperature 34.0 to 42.0 °C with at most one decimal
  (`/^\d{2}(\.\d)?$/`; the temperature field uses the same rule, and its state mirrors the field); `sy` the letters of what the person notices in the fixed order `l` (legs),
  `r` (not rested), `i` (ill), without repeats (`l, r, i, lr, li, ri, lri`). For example
  `#s=S2&d=62&layer=density&view=raw&card=cardio&mo=2&tc=37.9&sy=li`. An invalid, repeated or altered
  value shows the notice. A check-in belongs to one morning: when `update()` moves to another night
  (`d`) or scenario (`s`), `checkinReset` (view-state helpers) clears `mo`, `tc` and `sy`; what-if
  changes keep them, and a link that carries `d` with check-in keys opens with them intact.
- Within a page session each scenario remembers its own night, layer and view (memory only):
  switching to another scenario and back returns to them. The address stays the source of truth on
  load and for sharing.
- The page is for the person using it: no evidence ids, links to the evidence table, references,
  method notes or statements of uncertainty appear on it (they live in the slides and in `docs/`).
  `test/page.test.js` checks that no element `#origin`, `#gcheck`, `#hazards`, `#limits`,
  `#measured` or `#evidence` and no `data-ev` link is on the page, and that no evidence id appears in
  the page or in the strings of `js/app.js`.
- Top bar: the brand, the tagline and the scenario select; no section links.
- First screen (Plate I): the brief label, the headline (split by `splitHeadline`, tested by
  `test/presentation.test.js`) and a three-step guide (`ol#guide`): "Check in" (`#guide-checkin`:
  opens the check-in row and focuses its first answer; its one-line detail is the check-in `summary`
  once done, with the Watch mark when it is on Watch), "Open a check" (`#guide-check`: opens the most
  urgent check row) and "Do today" (`#guide-do`: the first action of the most urgent source and
  "+N more", on up to two lines; one button throughout, which opens that source's row, or reads
  "Nothing new. Keep the plan." with `aria-disabled` when there is nothing to open). The
  choice for rows 2 and 3 is `todayStep(cards, checkin) -> { card, target, text, more }` in the
  presentation helpers block of `js/app.js`: `card` is the first check on Report, else the first on
  Watch, else muscle; the action comes from cards on Report, then on Watch, then the check-in when it
  is on Watch (`target` is that card id or `'checkin'`, null when there is none). The details of rows
  1 and 2 are one line, cut with an ellipsis, with the whole text in `title`. The brief label stays
  on one line at every desktop width (baseline nights read "Baseline night N").
  The plate: the sleeper drawn as a stipple (`charts.stipple`, one dot per phantom cell, radius and
  brightness from the value; in the change view a loss is blue, a gain ink, cells below the noise the
  smallest quiet dots; a left-out density night is hollow dots along the outline) inside a hairline
  square and circle with dotted cosmic-ray tracks (`charts.plateFrame`). One line of figure controls
  sits at the top of the plate, above the body (layer: Density, Pressure, Impedance; view: Tonight,
  Change since arrival); under 600 px it stands above the plate. Four hotspot rings sit on the body
  parts (`hotspotCm`, tested by `test/figure.test.js`) and are tied by hairline leaders to the four
  checks, set as margin notes (`#cards .card`). The night ruler (`charts.ruler`) is fixed to the
  bottom and is the slider: a real `<input type="range" id="day">` for keyboard and screen readers,
  and pressing or dragging anywhere on the ruler moves the night (`charts.rulerIndex`). At 1920 x 937,
  1536 x 730, 1440 x 900, 1440 x 657, 1366 x 657, 1280 x 680, 1280 x 641, 1280 x 617, 1280 x 600 and
  1120 x 650 the left column and all four notes sit above the ruler and the controls line clears the
  body and the hotspots. Under 1100 px the layout stacks; under 600 px the notes are one column.
- Below the first screen, seven rows as native `<details class="row">`, all closed on a plain
  landing, each a title, a meta text and a "+" that becomes "−": "Morning check-in" (`#checkin`;
  meta "Not done yet · about 30 seconds" or the status), the four checks (`details.check-row` with
  `data-card`, `name="check"` so one is open at a time; meta: status and the margin note's value),
  "How the bunk measures" (`#how`) and "What if I miss exercise sessions?" (`#whatif`). One shared
  detail block (`#check-detail`) moves into the open check row: the meaning (the status is in the row
  title), numbered actions,
  who decides, the muscle projection; the trend chart with the engine's `reason` under it and the
  legend; for radiation `#rad-source` (one sentence: who measured tonight's dose and when) and two
  closed sub-rows, "The solar storm, hour by hour" (solar-event scenario) and "Where the particles came
  from"; and in every check a closed sub-row "NASA on this risk" (risk, rating sentence for the
  mission type, NASA's two sentences as quotations, the standard, then the `rules.CONTEXT` note). The open row follows `state.card`
  (`open` is set only when it differs). A click on a check row's title updates the state at once (so
  the detail is inside the row in the same task); `toggle` events cover any other opening. The "+"
  and "−" are `aria-hidden` spans, so a title's accessible name has no sign.
- Trend charts (`charts.line` with `upTo`) draw the readings, the judged line, its points and the
  exercise ticks only up to the selected night; the axes span the whole scenario and the plan band
  and thresholds stay. Event markers are drawn for events that started by the selected night; a
  marker may carry `shortLabel` and `tinyLabel`, and its label sits beside its own line inside the
  chart, in the first row of the label strip where it clears the labels already placed. The page
  passes the ruler's short event labels ("Exercise lapse", "Solar events", ...) and "Arrival".

Colour scheme and type (`css/style.css`, palette at the top; `test/palette.test.js` checks it):

- Two quiet colours and one loud one: night `#02070A` (ground), ink `#EAF2F7` (text and marks),
  quiet `#8FA3B1` (secondary text), hairlines rule `#1B2C37` and rule-strong `#2E4859`; blue
  `#0297DE` is the working colour (selection, the selected night, links, focus, cosmic-ray tracks,
  a loss in the change view); every text pair meets WCAG AA.
- The accent `#FC734D` (`--accent`) is reserved for Watch and Report (marks, words, leaders,
  chart points and threshold lines) and the emphasised word of the headline when a shown check is
  on Watch or Report (`.headline-attn`). Watch is an outlined triangle, Report a solid octagon,
  In range a small ring.
- Type: Cormorant Garamond (display) and EB Garamond (text), SIL OFL 1.1, served from `fonts/`
  with their licence texts (`font-src 'self'` in the Content Security Policy). No sans-serif.
- No cards, filled panels, shadows, gradients or rounded containers: structure is hairline rules
  and space. Motion (tracks drifting, the halo of a flagged hotspot, value cross-fades, sections
  fading up, and the Anime.js motion below) is off under `prefers-reduced-motion`.

Motion (`js/motion.js`, Anime.js; `js/app.js` calls only this API and never `anime`):

- One job: lead the eye through the three steps on landing and confirm what a click did. Every
  call returns false and does nothing when `anime` is missing, under `prefers-reduced-motion`, or
  while "Play the mission" runs (`setPlaying(true)` also ends everything at once). When an
  animation ends or is cut short, the inline styles and drawing attributes it set are removed.
  Nothing writes HTML (no text splitting); springs use `anime.spring`. Every element is registered
  before a motion function touches it; if the library throws at any call, motion stays off for
  the rest of the page's life and every touched element is put back (no inline opacity or
  transform, no drawing attributes, no `data-wait`, rings at their own radius, the figure in full),
  without throwing to the page (`test/motion-failure.test.js`).
- `intro(parts)`, once per page load, at most 1.6 s: the headline, the three guide rows in order,
  the stipple from head to feet (`charts.stipple` option `progress`, 0 to 1; at 1 the drawing is
  the same as without it), the plate frame and leaders drawing in, the rings settling with a
  spring, the four notes fading in (opacity only, so the leaders are measured from still notes),
  the ruler marker dropping to its night, and one underline sweep under "Check in" when the
  check-in is not done. Parts not yet shown are listed in `<html data-wait>` (read by the
  stylesheet). Any key, pointer press, wheel or touch jumps it to the end state at once
  (`finishIntro()`), before the press reaches its target.
- `rowOpened(row, blocks, path)`: the opened row's blocks fade up a few px one after another and a
  check row's trend line draws in. Closing is instant (`rowClosed()`); opening another row cuts the
  first opening short. Called where a row opens (the state update for check rows, the title click
  and the guide for the others).
- `valueTo(node, from, to, format)`: on a step to another night (ruler or arrow keys) a note's
  number counts from the old value to the new one in about 200 ms, written with the note's own
  formatting, ending on the exact text; a change to or from "no value" swaps the text at once
  (`countable`: only two different finite numbers count); `pulse(ring)`: a note whose status changed pulses its ring.
- `settle(marks)`: a changed check-in status mark settles with a spring; `fadeRows(rows)`: the
  comparison table's rows fade in one after another as it appears.
- Check rows carry a sparkline in their title (between the title and the meta text; 120 x 28 px,
  `aria-hidden`): that check's judged values for the 30 nights up to the selected night,
  `charts.sparkPoints` (tested), last point marked, ink, the accent only on Watch or Report; hidden
  under 700 px. The trend chart reads the night under the pointer (`charts.nearestDay`, tested): a
  hairline at that night and one line above the plot ("Night 31 · 7.84 deg"; the value only up to
  the selected night); a press and release that stays within 5 px (`isTap`, presentation helpers)
  goes to that night, as the ruler does; a drag does not, and a press on the chart starts no text selection.
- `--map-heat` and `--map-diverging` remain for `charts.image` (used by `demo/gallery.html`).

Measured radiation data on the page:

- `index.html` loads `data/msl-rad.js`, `data/lro-crater.js`, `data/donki-sep-2017.js`,
  `data/omni-protons.js` and `data/osdr-pwb.js` before `js/sim.js`, and `data/osdr-pwb.js` before
  `js/model.js` (checked by `test/page.test.js`).
- The radiation note says "measured by NASA" in its qualifier (on nights with a measured dose). In the
  open radiation row, `#rad-source` says in one sentence who measured tonight's dose and when, built
  from `rad.measured` (Curiosity RAD on Mars, or LRO in lunar orbit).
- Radiation row, solar-event scenario (S3): the sub-row "The solar storm, hour by hour" draws the OMNI2
  hourly proton flux above 10 MeV, 4 to 16 September 2017, on a log10 axis (`charts.logSeries`), with
  the selected night's 22:00 to 06:00 UTC window shaded; it is drawn when the sub-row opens.
- Trend panel, radiation card: when the plotted doses span more than a factor of 50 (largest over
  smallest positive value, `charts.useLogScale`), `charts.line` draws the vertical axis on a log10
  scale (`logY`, decade ticks shared with `charts.logSeries`) with tick labels in the card's units
  (`charts.doseTick`: µGy below 1,000, mGy from 1,000 up); the chart's accessible
  label says the scale is logarithmic. Narrower ranges keep the linear axis.
- The rat partial-weight-bearing check of the gravity term (`model.checkGravityTerm`,
  `model.describeGravityCheck`) and the list of measured data modules are no longer drawn on the page;
  they stay in `docs/` and the tests.

## Status rules (interim, unvalidated; a flight surgeon decides)

All comparisons are against the person's own baseline (the 14 pre-departure nights).

| Card | Indicator | Amber | Red | Grey |
|---|---|---|---|---|
| muscle | 7-night median of `eim.phase50_deg` | worse than the mission plan by more than max(2 x noise7, 4.2%) | below baseline by more than max(3 x noise7, 16.8%) | fewer than 3 nights with a usable scan in the last 7 |
| sleep | mean `radar.sleep_h` over the last 7 nights | 6 to under 7 h | under 6 h | fewer than 4 nights of data in the last 7 |
| cardio | `radar.rr_bpm` and `radar.hr_bpm`, 3-night medians | one of them above baseline median + 2 SD | never (two tiers only) | fewer than 2 nights of data in the last 3 |
| radiation | tonight's `rad.dose_uGy` versus the median of up to 30 earlier nights | above 2x | above 10x, or `rad.spe` is true | fewer than 7 earlier nights |

`noise7` is the expected spread of a 7-night median, as a percentage of the
baseline median: `1.2533 * sdNightly / sqrt(7) / median * 100`.

Muscle, in detail: `drop` is how far the 7-night median is below the baseline median, in
percent. `expectedDrop` is the median of `-expectedChangePct` over the same nights (0 when no
plan is given). Amber when `drop - expectedDrop` exceeds the amber limit; red when `drop`
itself exceeds the red limit. A slow decline that follows the plan stays green; a decline
faster than the plan turns amber; a large decline is red whatever the plan says. An earlier
draft also turned red after three falling weeks; that rule fired during normal adaptation
and was removed on 2026-11-14.
4.2% and 16.8% are evidence V10; 7 h is the low end of the 7 to 9 hours in a NASA technical brief (V79); 6 h is the ISS average in V11 rounded down.

Green is anything that is neither amber, red nor grey.

Windows never mix phases. For a surface night (missionDay >= 0) every window contains only
surface nights; for a baseline night only baseline nights. So the first surface nights are grey
("only n nights since arrival") until enough nights exist: this matters most after a long
transit, when the last baseline night is months old.

Revisions after the review on 2026-11-14:
- cardio has no red tier. A heart rate and breathing rate above the person's own range for three
  nights is a reason to check for illness, not an alarm. When it is sustained the card stays
  amber and uses the `amberSustained` text ("tell the crew medical officer").
- radiation red is a record, not a warning: the brief is read the morning after. The text says
  that real-time warnings come from space-weather alerts and flight rules, and the card reports
  the logged dose, the ratio to the usual level and the cumulative sleep-period dose.
- The headline never says "Urgent". Red reads "Report to the {clinician} today: ...";
  amber reads "N check(s) to watch: ...".
- Status words shown by the UI: In range, Watch, Report, No data.
