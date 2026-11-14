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

1. Static site. No build step, no backend, no network requests, no third-party
   scripts, no CDN. It must work when `index.html` is opened from disk
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

Browser load order: `evidence, model, sim, rules, engine, phantom, imaging, charts, app`.

## File ownership

| File | Owner | Depends on |
|---|---|---|
| `js/evidence.js` | orchestrator | none |
| `js/model.js`, `js/sim.js`, `test/model.test.js`, `test/sim.test.js` | model-sim agent | evidence |
| `js/rules.js`, `js/engine.js`, `test/engine.test.js` | engine agent | evidence |
| `js/phantom.js`, `js/imaging.js`, `test/imaging.test.js` | imaging agent | evidence |
| `index.html`, `css/style.css`, `js/charts.js`, `js/app.js` | UI agent | all of the above |
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
    dose_uGy: 104.5,              // dose over the sleep period, replayed from a measurement x shielding factor
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
    tracksPerCm2: 2100            // usable cosmic-ray tracks that night for the density image
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

### sim (`js/sim.js`)

- `sim.SCENARIOS` : `{ S1, S2, S3, S4 }`, each `{ id, title, env, summary, baselineNights, phases, events }`, plus `rad` (which real dataset and window the radiation replays; absent for S4).
- `sim.generate(scenarioId, opts) -> { scenario, records, plan }`
  `opts = { seed = 1, exerciseAdherence?, gravityShape?, sleepOpportunityH?, shieldingFactor? }`.
  Deterministic for a given seed. `records` is a `NightRecord[]` sorted by night.
  `plan = { expectedChangePct: number[] }` has one value per record: the muscle change the
  mission plan expects that night (0 on baseline nights). The plan is the scenario flown as
  intended (planned exercise, no lapses, normal activity); it uses the same gravity shape as
  the records. Each scenario lists its `planPhases` next to its `phases`.
  Each scenario also has `person = { baselinePhaseDeg, hrBpm, rrBpm }` and its own default
  `seed`, so the four scenarios do not show the same person. `opts.seed` overrides the default.
  `opts.eimNoiseSdFraction` overrides the night-to-night EIM noise (a what-if for a noisier sensor).
  An unknown scenario id (including inherited names such as `__proto__`) throws a clear error.
- `sim.NOISE` : declared night-to-night noise levels (assumptions).

### rules (`js/rules.js`) and engine (`js/engine.js`)

- `rules.THRESHOLDS` : thresholds as data, each with `sourceIds`.
- `rules.TEXT[cardId][status]` : `{ meaning, actions: [...] }`.
- `rules.CONTEXT[cardId]` : `{ risk, note, sourceIds }`. `risk` is the NASA Human Research
  Program risk the check relates to, read from evidence V44; `note` is one sentence backed by `sourceIds`.
- `rules.HAZARDS` : five `{ name, coverage: 'covered' | 'partly' | 'not covered', text }` rows,
  in the order and with the names of evidence V43 (NASA's five hazards of human spaceflight).
- `rules.WORDING[mode]` : terms that differ between `'astronaut'` and `'eldercare'`
  (for example who decides).
- `engine.baseline(records) -> { eim: { median, sd, n }, sleep: {...}, rr: {...}, hr: {...} }`
  Uses the nights with `missionDay < 0`.
- `engine.assess(records, index, opts) -> Assessment`
  Assesses the night at `records[index]` using only `records[0..index]`.
  `opts = { mode = 'astronaut', expectedChangePct? }`. `expectedChangePct` is the plan array
  from `sim.generate` (aligned with `records`); when it is absent the plan is "no change".
- `engine.project(records, index) -> { cardId: 'muscle', daysToRed, slopePctPerWeek } | null`
  Uses only complete weekly windows of mission nights; returns null when fewer than 3 such
  windows exist, when the trend is not falling, or when the result would be under 1 day.
- `engine.series(records, key) -> [{ missionDay, value }]`
  Convenience for charts. `key` is one of `eim`, `sleep`, `rr`, `hr`, `dose`.

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

`#s=S2&d=45&layer=density&view=raw&mode=astronaut&card=muscle`

- `s` scenario id, `d` mission day, `layer` image layer (`density|pressure|impedance`),
  `view` (`raw|diff`), `mode` (`astronaut|eldercare`), `card` selected trend card.
- `mode` follows the scenario: `eldercare` exactly when `s=S4`, otherwise `astronaut`. It is
  written to the address for readability; a valid `mode` in an older link is accepted and ignored.
- Any value in the address that is unknown, rejected or changed to fit (for example a day outside
  the scenario) falls back as before and shows the notice "This link could not be opened; showing
  the default view." An unknown evidence id (`ev`) shows "That source is not in the evidence list."

Measured radiation data on the page (space scenarios only; none of it appears when `s=S4`):

- `index.html` loads `data/msl-rad.js`, `data/lro-crater.js`, `data/donki-sep-2017.js` and
  `data/omni-protons.js` before `js/sim.js` (checked by `test/page.test.js`).
- Card tags: the radiation card carries "Measured, replayed" (on nights with `rad`), the other
  three cards "Simulated". Under the cards, `#rad-source` says where tonight's dose comes from,
  built from `rad.measured` (V60 for Curiosity RAD, V61 for LRO CRaTER), and, on a night with
  `rad.events`, the first DONKI record (linked to V62 only when it is that record, otherwise its id).
- Trend panel, radiation card, solar-event scenario (S3): `#flux-fig` draws the OMNI2 hourly
  proton flux above 10 MeV, 4 to 16 September 2017, on a log10 axis (`charts.logSeries`), with the
  selected night's 22:00 to 06:00 UTC window shaded; caption links V63.
- `#measured`, just above the evidence drawer: one row per data module (`name`, what it drives,
  `source`, link to `url`, `retrieved`, `terms`) and the line "Everything else on this page is simulated."

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
4.2% and 16.8% are evidence V10; 7 h is V25; 6 h is the ISS average in V11 rounded down.

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
