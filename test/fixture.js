/*
 * Small deterministic NightRecord fixture for developing and testing modules
 * before the simulator exists. No randomness: values follow simple formulas so
 * that tests can state exact expectations.
 *
 * Written with an SI tool (Claude) and reviewed by the team.
 */
'use strict';

function isoDay(offset) {
  const d = new Date(Date.UTC(2031, 0, 1 + offset));
  return d.toISOString().slice(0, 10);
}

/**
 * Build `baseline` pre-departure nights followed by `mission` surface nights.
 * `shape(day)` may override any field for mission day `day` (>= 0).
 */
function build({ baseline = 14, mission = 30, env = 'moon', shape = () => ({}) } = {}) {
  const records = [];
  for (let i = 0; i < baseline + mission; i++) {
    const missionDay = i - baseline;
    // Small alternating wiggle so that the baseline has a non-zero spread.
    const wiggle = i % 2 === 0 ? 1 : -1;
    const rec = {
      night: isoDay(i),
      missionDay,
      env: missionDay < 0 ? 'earth' : env,
      eim: { site: 'calf_L', phase50_deg: 9.0 + 0.05 * wiggle, contact: 0.85, scans: 4 },
      radar: { sleep_h: 7.4 + 0.1 * wiggle, efficiency: 0.9, rr_bpm: 14 + 0.3 * wiggle, hr_bpm: 55 + 1 * wiggle, movement: 0.2 },
      rad: { dose_uGy: 100 + 2 * wiggle, dir: [12, 13, 12, 13, 12, 13, 12, 13], spe: false },
      log: { exercise_done: true, note: '' },
      _truth: { muscleChangePct: 0, tracksPerCm2: 2000 }
    };
    if (missionDay >= 0) {
      const o = shape(missionDay) || {};
      for (const k of Object.keys(o)) {
        rec[k] = o[k] === null ? null : Object.assign({}, rec[k], o[k]);
      }
    }
    records.push(rec);
  }
  return records;
}

module.exports = { build, isoDay };
