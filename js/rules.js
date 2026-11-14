/*
 * MyoTwin status rules as data: thresholds (with sources), card text,
 * wording per mode, countermeasures, the disclaimer and the NASA risk and
 * hazard context for each check. No logic lives here;
 * js/engine.js applies these. Interim screening flags, not diagnoses.
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
    sleepAmberHours: fromEvidence('V25', 'minSleepHours', 'h', 'Recommendation of 7 h or more for adults aged 18 to 60 (V25). Applied to the older adult in scenario S4 as an assumption.'),
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
    projectionMaxDays: assumption(365, 'days', 'Projections further out than this are not shown.')
  };

  var WORDING = {
    astronaut: { clinician: 'flight surgeon', medic: 'crew medical officer', exerciseLog: 'resistance-exercise log', strengthCheck: 'a strength test against the 80% of baseline standard' },
    eldercare: { clinician: 'physician', medic: 'nurse on duty', exerciseLog: 'activity and exercise log', strengthCheck: 'a standard strength test' }
  };

  var TEXT = {
    muscle: {
      green: { meaning: 'Calf muscle signal is in line with your baseline and the mission plan.', actions: ['Keep the current exercise plan.'] },
      amber: { meaning: 'The calf muscle signal is lower than the mission plan expects. This is a screening flag, not a strength measurement.', actions: ['Review the last two weeks of the {exerciseLog}.', 'Schedule an active strength check.', 'Tell the {clinician} at the next contact.'] },
      red: { meaning: 'The calf muscle signal is more than ' + THRESHOLDS.muscleRedDropPct.value + '% below your own baseline, the largest test-retest variability reported for this measurement. It is a reporting line, not a strength threshold.', actions: ['Notify the {clinician}.', 'Confirm with {strengthCheck}.', 'Do not increase training loads on your own until this is confirmed.'] },
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
      amber: { meaning: 'Night-time heart rate or breathing rate is above your own normal range.', actions: ['Take your temperature and note any symptoms.', "Watch tonight's reading."] },
      amberSustained: { meaning: 'Night-time heart rate and breathing rate have both been above your own normal range for three nights. This can be an early sign of illness.', actions: ['Take your temperature and note any symptoms.', 'Tell the {medic} today.'] },
      grey: { meaning: 'Not enough radar data.', actions: ['Check the radar unit.'] }
    },
    radiation: {
      green: { meaning: "Last night's dose in the sleep station was in the usual range.", actions: ['No change needed.'] },
      amber: { meaning: "Last night's dose was more than twice the usual level.", actions: ['Check the space weather bulletin.', 'Mention it at the next contact with the {clinician}.'] },
      red: { meaning: "Last night's dose in the sleep station was more than ten times the usual level, or the detector flagged a solar particle event. This is a record of what happened overnight: real-time warnings come from space-weather alerts and the flight rules.", actions: ['Report the logged dose to the {clinician}.', 'Use the direction map to review which side of the sleep station is less shielded.'] },
      grey: { meaning: 'Not enough dose history to judge, or no particle detector at this bed.', actions: ['No action.'] }
    }
  };

  var COUNTERMEASURES = [
    { name: 'Resistance and aerobic exercise', evidence: 'supported', sourceIds: ['V4'], note: 'In 60 days of bed rest the exercise group kept thigh muscle volume and strength.' },
    { name: 'Leucine-enriched high-protein diet', evidence: 'not supported', sourceIds: ['V4'], note: 'In the same study it did not help, and thigh loss was greater.' },
    { name: 'Electrical muscle stimulation; blood-flow-restricted exercise', evidence: 'under study', sourceIds: ['V41'], note: 'Proposed for spaceflight; no published in-flight results found. Discuss with the flight surgeon.' }
  ];

  var DISCLAIMER = 'Screening flag from simulated data. Not a diagnosis. The {clinician} decides.';

  // The NASA Human Research Program risk each check relates to (V44), with one line of context.
  var CONTEXT = {
    muscle: { risk: evidence.value('V44', 'muscleRisk'), note: "NASA's hazard list says muscles and bones must adjust to each new gravity level.", sourceIds: ['V44', 'V43'] },
    sleep: { risk: evidence.value('V44', 'sleepRisk'), note: "NASA's ARCHeR study monitored sleep and activity on Artemis II.", sourceIds: ['V44', 'V45'] },
    cardio: { risk: evidence.value('V44', 'cardioRisk'), note: 'NASA says weightlessness alters how the heart and blood vessels function.', sourceIds: ['V44'] },
    radiation: {
      risk: evidence.value('V44', 'radiationRisk'),
      note: 'This version does not measure neutrons, about ' + evidence.value('V46', 'neutronSharePct') + "% of total radiation on the ISS. The Canadian Space Agency's CANS spectrometer is designed to measure them continuously.",
      sourceIds: ['V44', 'V46']
    }
  };

  // Where MyoTwin sits in NASA's five hazards of human spaceflight (V43), in NASA's order.
  var HAZARD_NAMES = evidence.value('V43', 'hazards');
  var HAZARDS = [
    { name: HAZARD_NAMES[0], coverage: 'partly', text: 'Nightly dose and arrival direction at the bunk, from charged particles. Neutrons are not measured in this version.' },
    { name: HAZARD_NAMES[1], coverage: 'partly', text: 'Sleep is tracked every night. Mood and team factors are not.' },
    { name: HAZARD_NAMES[2], coverage: 'partly', text: 'The brief is made for a crew that cannot wait for a ground team: it says what the reading means, what to do today and who decides. It does not diagnose or treat.' },
    { name: HAZARD_NAMES[3], coverage: 'partly', text: 'Calf muscle is compared with the mission plan every morning. Bone and balance are not tracked.' },
    { name: HAZARD_NAMES[4], coverage: 'not covered', text: "Air, noise, light and microbes are not read. Next step: show the habitat's environmental sensors beside the brief." }
  ];

  var api = { THRESHOLDS: THRESHOLDS, WORDING: WORDING, TEXT: TEXT, COUNTERMEASURES: COUNTERMEASURES, DISCLAIMER: DISCLAIMER, CONTEXT: CONTEXT, HAZARDS: HAZARDS };

  ns.rules = api;
  if (inNode) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
