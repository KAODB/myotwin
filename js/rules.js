/*
 * MyoTwin status rules as data: thresholds (with sources), card text,
 * wording, countermeasures and the NASA risk and hazard context for each
 * check. No logic lives here; js/engine.js applies these.
 *
 * Written with an SI tool (Claude) and reviewed by the team.
 */
(function (root) {
  'use strict';
  var ns = (root.MyoTwin = root.MyoTwin || {});
  var inNode = typeof module === 'object' && module.exports;
  var evidence = inNode ? require('./evidence.js') : ns.evidence;

  function fromEvidence(id, key, unit, note) {
    return { value: evidence.value(id, key), unit: unit, status: evidence.get(id).status, sourceIds: [id], note: note };
  }
  function assumption(value, unit, note, sourceIds) {
    return { value: value, unit: unit, status: 'assumption', sourceIds: sourceIds || [], note: note };
  }

  var THRESHOLDS = {
    // Windows and statistics
    windowNights: assumption(7, 'nights', 'Length of the rolling window for muscle and sleep, and of one "week" in the projection.'),
    baselineMinNights: assumption(3, 'nights', 'Fewest baseline values needed to compute a median and SD.'),
    medianSeFactor: assumption(1.2533, 'ratio', 'sqrt(pi/2): standard error of a median relative to a mean for normally distributed nights.'),
    // Muscle
    muscleAmberDropPct: fromEvidence('V10', 'meanVariabilityPct', '%', 'EIM test-retest variability, average.'),
    muscleRedDropPct: fromEvidence('V10', 'maxVariabilityPct', '%', 'EIM test-retest variability, upper limit.'),
    muscleAmberNoiseMultiple: assumption(2, 'x noise7', 'Amber needs a drop beyond 2 times the expected spread of a 7-night median.'),
    muscleRedNoiseMultiple: assumption(3, 'x noise7', 'Red needs a drop beyond 3 times the expected spread of a 7-night median.'),
    muscleMinUsableNights: assumption(3, 'nights', 'Fewest nights with a usable scan in the last 7 before the card is judged.'),
    // Sleep
    sleepAmberHours: fromEvidence('V79', 'adultSleepHoursLow', 'h', 'Low end of the 7 to 9 hours a NASA technical brief says an average adult needs (V79).'),
    sleepRedHours: assumption(Math.floor(evidence.value('V11', 'issSleepHours')), 'h', 'ISS average sleep (V11) rounded down; not a validated cut-off.', ['V11']),
    sleepMinNights: assumption(4, 'nights', 'Fewest radar nights in the last 7 before the card is judged.'),
    // Cardio
    cardioNights: assumption(3, 'nights', 'Nights compared for heart and breathing rate.'),
    cardioSdMultiple: assumption(2, 'SD', 'Band above the baseline median that counts as raised.'),
    cardioMinNights: assumption(2, 'nights', 'Fewest radar nights in the last 3 before the card is judged.'),
    // Radiation
    radiationHistoryNights: assumption(30, 'nights', 'Earlier mission nights used for the usual dose.'),
    radiationMinHistory: assumption(7, 'nights', 'Fewest earlier mission nights with dose data before the card is judged.'),
    radiationAmberRatio: assumption(2, 'x usual', 'Tonight above twice the usual dose.'),
    radiationRedRatio: assumption(10, 'x usual', 'Tonight above ten times the usual dose.'),
    // Projection
    projectionWeeks: assumption(4, 'weeks', 'Most weekly medians used for the trend line.'),
    projectionMinWeeks: assumption(3, 'weeks', 'Fewest weekly medians needed for a trend line.'),
    projectionMaxDays: assumption(365, 'days', 'Projections further out than this are not shown.'),
    // Morning check-in
    checkinTempRiseC: fromEvidence('V97', 'riseOverBaselineC', '°C', 'A rise of more than this over the person\'s own baseline counts as fever in the guideline for older adults in long-term care (V97). Using it for a crew is this project\'s adaptation.'),
    checkinTempDropC: assumption(1.1, '°C', 'A reading more than this below the person\'s own baseline is flagged for a repeat measurement. Mirrored from the rise; no source sets it.'),
    checkinBaselineTempC: assumption(36.6, '°C', 'The usual morning temperature of the crew member shown. A flight system would take the median of the person\'s own earlier check-ins.'),
    checkinLowMoodAtMost: assumption(2, 'of 5', 'Mood ratings of 1 or 2 out of 5 count as low.')
  };

  var WORDING = { clinician: 'flight surgeon', medic: 'crew medical officer', exerciseLog: 'resistance-exercise log', strengthCheck: 'a strength test against the 80% of baseline standard' };

  var TEXT = {
    muscle: {
      green: { meaning: 'Calf muscle signal is in line with your baseline and the mission plan.', actions: ['Keep the current exercise plan.'] },
      amber: { meaning: 'The calf muscle signal is lower than the mission plan expects. A strength test confirms it.', actions: ['Review the last two weeks of the {exerciseLog}.', 'Schedule an active strength check.', 'Tell the {clinician} at the next contact.'] },
      red: { meaning: 'The calf muscle signal is more than ' + THRESHOLDS.muscleRedDropPct.value + '% below your own baseline.', actions: ['Notify the {clinician}.', 'Confirm with {strengthCheck}.', 'Do not increase training loads on your own until this is confirmed.'] },
      grey: { meaning: 'Not enough usable scans this week.', actions: ['Check that bare calves rest on the electrode strip.', 'Check the position of the sleep liner.'] }
    },
    sleep: {
      green: { meaning: 'Sleep over the last week meets the 7-hour recommendation.', actions: ['No change needed.'] },
      amber: { meaning: 'Average sleep over the last week is below 7 hours.', actions: ['Check the sleep window, lighting and noise.', 'Log any sleep medication.'] },
      red: { meaning: 'Average sleep over the last week is below 6 hours.', actions: ['Notify the {clinician}.', "Review tomorrow's high-risk tasks with the team."] },
      grey: { meaning: 'Not enough radar data this week.', actions: ['Check the radar unit.'] }
    },
    cardio: {
      green: { meaning: 'Night-time heart rate and breathing rate are within your own normal range.', actions: ['No change needed.'] },
      amber: { meaning: 'Night-time heart rate or breathing rate is above your own normal range.', actions: ['Take your temperature and note any symptoms in the morning check-in.', "Watch tonight's reading."] },
      amberSustained: { meaning: 'Night-time heart rate and breathing rate have both been above your own normal range for three nights. This can be an early sign of illness.', actions: ['Take your temperature and note any symptoms in the morning check-in.', 'Tell the {medic} today.'] },
      grey: { meaning: 'Not enough radar data.', actions: ['Check the radar unit.'] }
    },
    radiation: {
      green: { meaning: "Last night's dose was in the usual range.", actions: ['No change needed.'] },
      amber: { meaning: "Last night's dose was more than twice the usual level.", actions: ['Check the space weather bulletin.', 'Mention it at the next contact with the {clinician}.'] },
      red: { meaning: "Last night's dose was more than ten times the usual level, or a solar particle event was recorded. This is a record of the night; live warnings come from space-weather alerts and the flight rules.", actions: ['Report the logged dose to the {clinician}.', 'Use the direction map to see which side more particles came from.'] },
      grey: { meaning: 'Not enough dose history to judge, or no particle detector at this bed.', actions: ['No action.'] }
    }
  };

  var COUNTERMEASURES = [
    { name: 'Resistance and aerobic exercise', evidence: 'supported', sourceIds: ['V4'], note: 'In 60 days of bed rest the exercise group kept thigh muscle volume and strength.' },
    { name: 'Leucine-enriched high-protein diet', evidence: 'not supported', sourceIds: ['V4'], note: 'In the same study it did not help, and thigh loss was greater.' },
    { name: 'Electrical muscle stimulation; blood-flow-restricted exercise', evidence: 'under study', sourceIds: ['V41'], note: 'Proposed for spaceflight; no published in-flight results found. Discuss with the flight surgeon.' }
  ];

  // The NASA Human Research Program risk each check relates to (V44), with one line of context.
  var CONTEXT = {
    muscle: { risk: evidence.value('V44', 'muscleRisk'), note: "NASA's hazard list says muscles and bones must adjust to each new gravity level.", sourceIds: ['V44', 'V43'] },
    sleep: { risk: evidence.value('V44', 'sleepRisk'), note: "NASA's ARCHeR study monitored sleep and activity on Artemis II.", sourceIds: ['V44', 'V45'] },
    cardio: { risk: evidence.value('V44', 'cardioRisk'), note: 'NASA says weightlessness alters how the heart and blood vessels function.', sourceIds: ['V44'] },
    radiation: {
      risk: evidence.value('V44', 'radiationRisk'),
      note: 'Neutrons are about ' + evidence.value('V46', 'neutronSharePct') + "% of total radiation on the ISS. The Canadian Space Agency's CANS spectrometer is designed to measure them continuously.",
      sourceIds: ['V44', 'V46']
    }
  };

  // Mission type of each world, as named in NASA's Human Research Roadmap rating tables (V70 to V75).
  var MISSIONS = {
    moon: { prefix: 'lunarSurfaceLong', label: 'a long lunar-surface mission' },
    mars: { prefix: 'marsPlanetary', label: 'a Mars planetary mission' }
  };
  var SCALE_5 = 'Likelihood x consequence, each from 1 to 5.';

  // In-mission (operations) rating; for radiation the long-term health rating, since its operations rating is 1x1.
  function ratings(card, roadmapId) {
    var out = {};
    Object.keys(MISSIONS).forEach(function (w) {
      var p = MISSIONS[w].prefix, v = function (k) { return evidence.value(roadmapId, p + k); };
      out[w] = card === 'radiation' ?
        { code: v('Health'), disposition: v('HealthDisposition'),
          text: 'Long-term health rating ' + v('Health') + ', ' + v('HealthDisposition') + ', for ' + MISSIONS[w].label +
            '; the in-mission rating is ' + v('Ops') + ', ' + v('OpsDisposition') + ". Rated under NASA's previous 3x4 matrix." } :
        { code: v('Ops'), disposition: v('OpsDisposition'),
          text: 'In-mission rating ' + v('Ops') + ', ' + v('OpsDisposition') + ', for ' + MISSIONS[w].label + '.' };
    });
    return out;
  }

  // NASA's own material for each check: risk, rating by mission type, two sentences from the
  // risk page (verbatim), the standard that applies and the open research gap.
  function nasa(card, roadmapId, riskPageId, standard) {
    return {
      risk: evidence.value('V44', card + 'Risk'), riskSourceIds: ['V44'],
      roadmapId: roadmapId, ratings: ratings(card, roadmapId),
      scale: card === 'radiation' ? 'Likelihood x consequence.' : SCALE_5,
      lastPublished: evidence.value(roadmapId, 'lastPublished'),
      riskPageId: riskPageId, says: evidence.value(riskPageId, 'says'), canBeDone: evidence.value(riskPageId, 'canBeDone'),
      standard: standard,
      gap: { id: evidence.value(roadmapId, 'gapId'), text: evidence.value(roadmapId, 'gapText') }
    };
  }
  var NASA = {
    muscle: nasa('muscle', 'V70', 'V48', [
      { text: 'NASA-STD-3001 requires countermeasures to keep in-mission muscle strength at or above ' + Math.round(evidence.value('V81', 'minStrengthFraction') * 100) + '% of baseline.', sourceIds: ['V81'] },
      { text: 'NASA’s 2023 evidence report says “Currently, no standard in-flight measurement of strength exists.” The requirement is tested about ' + evidence.value('V85', 'testDaysAfterLandingAbout') + ' days after landing.', sourceIds: ['V85'] },
      { text: 'A 2026 NASA bulletin says ISS crew strength is measured across the mission with two isometric exercise tests that are “location specific requiring specialized equipment”.', sourceIds: ['V82'] }
    ]),
    sleep: nasa('sleep', 'V71', 'V49', [
      { text: 'The rationale of a NASA-STD-3001 requirement recommends an ' + evidence.value('V78', 'recommendedSleepPeriodHours') + '-hour sleep period, which is the time set aside for sleep each day, not the hours spent asleep.', sourceIds: ['V78'] },
      { text: 'A NASA brief says an average adult needs ' + evidence.value('V79', 'adultSleepHoursLow') + ' to ' + evidence.value('V79', 'adultSleepHoursHigh') + ' hours of sleep, and that astronauts sleep about ' + evidence.value('V79', 'inSpaceSleepHoursAbout') + ' hours on average in space.', sourceIds: ['V79'] }
    ]),
    cardio: nasa('cardio', 'V72', 'V50', [
      { text: 'NASA-STD-3001 asks for “Assessing, recording, monitoring, and trending vital signs” in mission.', sourceIds: ['V77'] }
    ]),
    radiation: nasa('radiation', 'V73', 'V51', [
      { text: 'For habitats on planetary surfaces, NASA-STD-3001 limits the effective dose from galactic cosmic rays to less than ' + evidence.value('V83', 'surfaceLimitMSvPerDay') + ' mSv per day. This card shows absorbed dose, which is a different quantity.', sourceIds: ['V83'] },
      { text: 'NASA-STD-3001 requires the radiation monitoring system to alert the crew and operations teams when exposure rates exceed predefined thresholds; the rationale adds that the crew must be alerted even if ground communication is disrupted.', sourceIds: ['V84'] }
    ])
  };

  // Where MyoTwin sits in NASA's five hazards of human spaceflight (V43), in NASA's order.
  // `fact` is one NASA statement from the hazard page; `worldFact` depends on the mission type;
  // `quote` is a verbatim NASA sentence shown as a quotation.
  var HAZARD_NAMES = evidence.value('V43', 'hazards');
  function worldRatings() {
    var out = {};
    Object.keys(MISSIONS).forEach(function (w) {
      var p = MISSIONS[w].prefix;
      out[w] = { text: 'NASA rates the risk of operating with little real-time help from Earth ' + evidence.value('V75', p + 'Ops') + ' and medical conditions in mission ' +
        evidence.value('V74', p + 'Ops') + ' for ' + MISSIONS[w].label + ' (likelihood x consequence, each from 1 to 5).', sourceIds: ['V75', 'V74'] };
    });
    return out;
  }
  var HAZARDS = [
    { name: HAZARD_NAMES[0], coverage: 'partly', text: 'Nightly dose and arrival direction at the bunk, from charged particles. Neutrons are not measured in this version.',
      fact: { text: "NASA: astronauts cannot see or feel space radiation, and NASA continuously monitors space radiation and astronauts' exposure.", sourceIds: ['V56'] } },
    { name: HAZARD_NAMES[1], coverage: 'partly', text: 'Sleep is tracked every night, and the morning check-in asks about mood. Team factors are not tracked.',
      fact: { text: 'NASA is developing ways to monitor behavioural health; its scientists use journaling as one tool to assess mental and emotional states.', sourceIds: ['V55'] },
      // Verbatim from NASA's page on behavioural conditions (V52).
      quote: { text: evidence.value('V52', 'says'), sourceIds: ['V52'] } },
    { name: HAZARD_NAMES[2], coverage: 'partly', text: 'The brief is made for a crew that cannot wait for a ground team: it says what the reading means, what to do today and who decides.',
      fact: { text: 'NASA: on a Mars mission the communication delay is up to ' + evidence.value('V54', 'commDelayMinutesOneWay') + ' minutes one way.', sourceIds: ['V54'] },
      worldFact: worldRatings() },
    { name: HAZARD_NAMES[3], coverage: 'partly', text: 'Calf muscle is compared with the mission plan every morning. Bone and balance are not tracked.',
      fact: { text: 'NASA: in spaceflight, weight-bearing bones lose on average ' + evidence.value('V53', 'boneLossPctPerMonthLow') + '% to ' + evidence.value('V53', 'boneLossPctPerMonthHigh') + '% of mineral density a month.', sourceIds: ['V53'] } },
    { name: HAZARD_NAMES[4], coverage: 'not covered', text: "Air, noise, light and microbes are not read. Next step: show the habitat's environmental sensors beside the brief." }
  ];

  // The morning check-in: what the crew member answers and every sentence js/engine.js checkin()
  // writes from it. {medic}, {rise}, {base}, {limit}, {word} and {t} are filled by the engine.
  var CHECKIN = {
    moods: ['Very low', 'Low', 'Even', 'Good', 'Very good'],
    symptoms: [
      { id: 'legs', letter: 'l', label: 'Legs weaker or sore', card: 'muscle' },
      { id: 'tired', letter: 'r', label: 'Not rested', card: 'sleep' },
      { id: 'ill', letter: 'i', label: 'Feeling ill', card: 'cardio' }
    ],
    tempMinC: 34,
    tempMaxC: 42,
    statusWords: { grey: 'Not done yet', green: 'In range', amber: 'Watch' },
    meaning: {
      notDone: 'Three questions before breakfast: how you feel, your temperature, and anything you notice.',
      none: 'Nothing in your check-in needs action today.',
      fever: 'Your temperature is {rise} °C above your own baseline of {base} °C. That counts as a fever.',
      low: 'Your temperature is {drop} °C below your own baseline of {base} °C.',
      ill: 'You feel ill this morning.',
      illTempInRange: ' Your temperature is within {limit} °C of your own baseline.',
      mood: 'You rated your mood {word} this morning.',
      legs: 'Your legs feel weaker or sore this morning.',
      tired: 'You did not feel rested this morning.',
      alsoNoted: ' Also noted: '
    },
    shortNames: { low: 'low temperature', ill: 'feeling ill', mood: 'low mood', legs: 'legs weaker or sore', tired: 'not rested' },
    actions: {
      fever: ['Tell the {medic} today.', 'Take your temperature again this evening.'],
      low: ['Take your temperature again.', 'Tell the {medic} if it is still low.'],
      illNoTemp: 'Take your temperature and enter it here.',
      illWithTemp: 'Tell the {medic} if you still feel ill this evening.',
      mood: ['Write a few lines in your journal. NASA encourages a regular journal as self-care.', 'Tell the {medic} if your mood is still low tomorrow.'],
      legsFlag: 'Do the muscle check\'s actions today.',
      tiredFlag: 'Do the sleep check\'s actions today.',
      again: 'Check in again tomorrow.',
      none: 'No change needed.'
    },
    decides: 'You and the {medic}',
    verdicts: {
      'agree-clear': 'Agree.',
      'bunk-only': 'The bunk sees a change you do not feel. Follow this check.',
      'self-only': 'You notice it and the bunk does not show it. Your answer still counts.',
      'agree-flag': 'Both agree. Do this check\'s actions today.',
      'no-bunk': 'No bunk reading to compare with.',
      'cannot-feel': 'Radiation cannot be felt. Only the bunk can tell you.'
    },
    summary: { mood: 'mood {word}', temp: '{t} °C', raised: ' ({rise} °C above your baseline)', low: ' ({drop} °C below your baseline)', none: 'nothing else' }
  };

  var api = { THRESHOLDS: THRESHOLDS, WORDING: WORDING, TEXT: TEXT, COUNTERMEASURES: COUNTERMEASURES, CONTEXT: CONTEXT, NASA: NASA, MISSIONS: MISSIONS, HAZARDS: HAZARDS, CHECKIN: CHECKIN };

  ns.rules = api;
  if (inNode) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
