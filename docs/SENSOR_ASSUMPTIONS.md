# Sensor assumptions

MyoTwin is software. The sensor panel it reads from is assumed and has not
been built. This file states, for each assumed sensor, what MyoTwin expects it
to output, what evidence supports the measurement principle, what has never
been shown, and the safety notes that have a source. Ids such as (V8) are
entries in [EVIDENCE.md](EVIDENCE.md). Field names are from the NightRecord in
[CONTRACT.md](CONTRACT.md).

The panel sits in the sleep station of a lunar or Mars surface habitat. On a
surface, gravity presses the sleeper onto the bed. On the ISS, by contrast, the
sleeping bag restrains the crew member to the crew-quarters wall (V18).

## 1. Impedance (EIM) electrode strip under the calves

**Assumed output, once per night** (`eim`, or `null` when no usable scan):

| Field | Meaning |
|---|---|
| `site` | Measured site, `calf_L` |
| `phase50_deg` | 50 kHz phase angle in degrees, median of the night's usable scans |
| `contact` | Contact quality, 0 to 1 |
| `scans` | Number of usable scans (usable means contact of 0.6 or more) |

**Evidence that the principle works**

- Human disuse: after 10-59 days in a cast, the 50 kHz phase of the tibialis
  anterior was 6.64 deg versus 9.46 deg in the other leg (-28.4%), and returned
  to 9.37 deg after remobilisation (n = 10) (V8).
- Rats in hindlimb suspension: the EIM phase-slope fell from 14.60 to 11.03 to
  10.13 deg/MHz at days 0, 7 and 14. The authors propose EIM as a biomarker
  under micro- and partial gravity (V7).
- Mice on the ISS centrifuge (JAXA): EIM was one of the functional measures
  that showed 0.67 g was needed to maintain muscle performance (V6).
- EIM phase declines with age in 100 healthy people aged 18-90, more steeply
  after 60; the authors call EIM effort-independent (V9).
- Operator-applied 50 kHz EIM: test-retest ICC 0.938-0.971; variability 4.2% on
  average and 16.8% at most (V10). MyoTwin uses these two numbers as its muscle
  thresholds.
- Textile electrodes strapped to the leg matched gel electrodes for
  multi-frequency bioimpedance, and a capacitive bioimpedance mattress
  prototype exists, though it is motion-sensitive (V30).

**What has never been shown**

- EIM in humans in space, in bed rest, or at the back of the calf. V8 measured
  the shin.
- EIM with dry electrodes or electrodes built into a bed. No such study was
  found (V30).
- The size of the link between muscle change and phase change. MyoTwin assumes
  one-to-one; V8 has no paired muscle-size measurement.
- A stable reading after lying down. Leg bioimpedance had not reached a steady
  state within 30 minutes, with a time constant of about 36 minutes for
  extracellular volume (V28; measured with bioimpedance analysis, not EIM).

**Safety notes with a source**

- Bioimpedance device instructions list electronic implants such as cardiac
  pacemakers as a contraindication. Clinical studies of clinical-grade devices
  found no interference; consumer devices interfered on the bench (V26).

## 2. 60 GHz radar above the bunk

**Assumed output, once per night** (`radar`, or `null` when the radar had no data):

| Field | Meaning |
|---|---|
| `sleep_h` | Hours asleep |
| `efficiency` | Time asleep divided by time in bed, 0 to 1 |
| `rr_bpm` | Respiratory rate, breaths per minute, night median |
| `hr_bpm` | Heart rate, beats per minute, night median |
| `movement` | Movement index, 0 to 1 |

**Evidence that the principle works**

- A systematic review of radar vital-sign monitoring: with a 10% tolerated
  deviation, 85% (respiration) and 87% (heart rate) of studies qualified; with
  5%, 37% and 48% (V23).
- A 60 GHz FMCW radar used during polysomnography (n = 44) agreed with the
  apnea-hypopnea index at ICC 0.776-0.929 (V24; values read from the full text,
  no sentence copied).

**What has never been shown**

- Radar vital-sign monitoring in space. The closest work found is a design
  study of UWB radar for the ISS crew quarters, validated by simulation and
  ground tests (V39).
- The evidence table has no entry on radar measurement of hours asleep, sleep
  efficiency or movement. V24 covers the apnea-hypopnea index only.

**Safety notes with a source**

- 60 GHz exposure: the ICNIRP 2020 general-public limit is 20 W/m2 local
  absorbed power density; penetration into skin is about 0.49 mm; a typical
  radar chip transmits at 12 dBm (V27).

## 3. Pressure mat under the sleeper

**Assumed output.** The NightRecord has no pressure field in this version.
The pressure image is computed from the body phantom: each column of tissue
rests on the mat cell directly below it, at local gravity (`imaging.render`
with layer `pressure`). The tissue densities are from V31 and the gravity
ratios from V14. Summing the force and dividing by local gravity gives body
mass.

**Evidence that the principle works.** The evidence table has no entry on
pressure mats.

**What has never been shown.** A pressure mat used to measure body mass in
partial gravity. The image also assumes no load transfer between cells.

**Safety notes with a source.** None in the evidence table.

## 4. Particle trackers above and below the sleeper

**Assumed output, once per night** (`rad`, or `null` when no data):

| Field | Meaning |
|---|---|
| `dose_uGy` | Absorbed dose in silicon over the sleep period, in uGy |
| `dir` | Particle counts in 8 azimuth sectors; sector 0 points toward the head |
| `spe` | Solar particle event flag from the detector |

The density image also needs the number of usable tracks per cm2 in the night.
In this version the simulator supplies it (`_truth.tracksPerCm2`, which the
assessment engine never reads). With the assumed vertical intensity of 0.2 per
cm2 per s per sr, a 20 deg acceptance cone and 8 hours, it is 2,183 tracks per
cm2.

**Evidence that the principle works**

- Timepix-based Radiation Environment Monitors have flown on the ISS since 16
  October 2012, and the direction of each particle track can be
  reconstructed. The Timepix-based HERA flew on Artemis I (V17).
- Large silicon-strip trackers already fly in space: Fermi LAT has 16 towers
  of 18 x/y planes with 228 um strip pitch (V36).
- Multiple-scattering angle follows the Highland formula, accurate to 11% or
  better (V32), and depends on the radiation length of the material: water
  36.08 cm, skeletal muscle 35.14 cm, adipose tissue 45.36 cm, compact bone
  16.48 cm (V31).
- Free-space galactic-cosmic-ray proton flux varies from 1.5 to 5.0 particles
  per cm2 per s (4 pi) over the solar cycle (V33, secondary citation). At sea
  level, cosmic-ray muons give about 1 per cm2 per minute through a horizontal
  detector (V34).
- Sea-level cosmic-ray muons have imaged an anthropomorphic phantom in a
  24-hour exposure with signal to background of about 1:1 (V35).
- Surface dose rates used by the simulator: 13.2 uGy/h in silicon on the Moon,
  from the LND instrument on the Chang'E-4 lander (V12), and 8.60 uGy/h in
  silicon on Mars, from one MSL/RAD observation on sol 90 (V16).

**What has never been shown**

- A density image of a person made from cosmic rays in space.
- A 2026 study with an accelerator muon beam and a thorax phantom argues that
  the natural muon flux on Earth is too low for medical imaging (V38).
- Tracking with the momentum of each particle unknown, the sleeper moving, and
  habitat shielding in the path. NASA guidance is to surround crew with about
  20 g/cm2 of hydrogen-rich shielding (V37), and polyethylene was added to the
  ISS crew quarters where crew sleep (V19).

**Safety notes with a source.** None in the evidence table. The trackers are
assumed to be passive detectors; they add no radiation source.

## What this version does not account for, and the next step

1. **The momentum of each particle is unknown.** Next step: a reference block
   of known thickness beside the sleeper, then a momentum-measuring layer.
2. **Movement during the night, and tails from nuclear interactions.** Next
   step: sort tracks by posture with the pressure image, start with large
   regions, and run a particle-transport simulation.
3. **Habitat shielding** changes which particles reach the trackers (V37).
   Next step: simulate usable tracks behind different shielding.
4. **The density image has never been measured this way.** Next step: repeat
   the published ground test with sea-level muons and a body phantom (V35).
5. **No human EIM data in space, in bed rest or at the back of the calf** (V8
   measured the shin), and bed-integrated dry electrodes are untested (V30).
   Next step: run the panel beside strength tests and MRI in a bed-rest study.
6. **Fluid shifts move the impedance reading** (V28). Next step: measure in the
   last hour before waking.
7. **Radar vital signs are untested in space** (V39).
8. **The radiation card shows absorbed dose in silicon, not effective dose.**
