# Sensor assumptions

MyoTwin is software. The sensor panel it reads from is assumed and has not
been built. This file states, for each assumed sensor, what MyoTwin expects it
to output, what evidence supports the measurement principle, what we found
no published work on, and the safety notes that have a source. Ids such as (V8) are
entries in [EVIDENCE.md](EVIDENCE.md). Field names are from the NightRecord in
[CONTRACT.md](CONTRACT.md).

The panel sits in the sleep station of a lunar or Mars surface habitat. On a
surface, gravity presses the sleeper onto the bed. On the ISS, by contrast, the
sleeping bag restrains the crew member to the wall of the crew quarters, so
the body does not rest on a surface (V42). For this reason MyoTwin starts at
arrival; during a transit the panel would not measure.

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
  anterior (shin) was 6.64 deg in the casted leg versus 9.46 deg in the other
  leg (28.4% lower), and rose to 9.37 deg after the cast came off (n = 10). It
  is a comparison between legs, not before and after (V8).
- Rats in hindlimb suspension: the EIM phase-slope fell from 14.60 to 11.03 to
  10.13 deg/MHz at days 0, 7 and 14. The authors propose EIM as a biomarker
  under micro- and partial gravity (V7).
- Mice on JAXA's centrifuge aboard the ISS, in a University of Tsukuba-led
  study with JAXA: EIM was one of the functional measures by which 0.67 g was
  sufficient to maintain muscle function (V6).
- EIM phase declines with age in 100 healthy people aged 18-90, more steeply
  after 60; the authors call EIM effort-independent (V9).
- Operator-applied 50 kHz EIM in 30 people, on biceps, quadriceps and tibialis
  anterior, repeated within 250 days: test-retest ICC 0.938-0.971; variability
  4.2% on average and 16.8% at most (V10). MyoTwin uses these two numbers as
  its muscle limits: amber when the 7-night median is more than 4.2% worse than
  the mission plan, red when it is more than 16.8% below baseline (or 2 and 3
  times the expected noise, if larger). The red line is a reporting line, not a
  strength threshold. These figures were not measured on the calf, night to
  night, or with electrodes in a mattress; using them there is an assumption.
- Textile electrodes strapped to the leg matched gel electrodes for
  multi-frequency bioimpedance, and a capacitive bioimpedance mattress
  prototype exists, though it is motion-sensitive (V30).

**What we found no published work on**

- Human EIM data from space or bed rest, or EIM at the back of the calf. V8
  measured the shin (V30, V8).
- EIM with dry electrodes or electrodes built into a bed (V30). V30 does report
  a capacitive bioimpedance mattress prototype, which is motion-sensitive.
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

Breathing rate and heart rate have published evidence. Hours asleep, sleep
efficiency and movement from the radar are assumptions in this version.

**Evidence that the principle works**

- A systematic review of radar vital-sign monitoring: with a 10% tolerated
  deviation, 85% (respiration) and 87% (heart rate) of studies qualified; with
  5%, 37% and 48% (V23).
- A 60 GHz FMCW radar used during polysomnography (n = 44) agreed with the
  apnea-hypopnea index at ICC 0.776-0.812 on its own, and 0.916-0.929 only when
  the sleep status came from polysomnography. The authors state that the radar
  alone cannot distinguish the sleep status (V24).

**What we found no published work on**

- Radar vital-sign monitoring in space. The closest work found is a design
  study of UWB radar for sensing breathing in the ISS crew quarters, validated
  by simulation and ground tests (V39).
- Radar measurement of hours asleep, sleep efficiency or movement in the
  evidence table. In V24 the radar alone could not tell sleep from wake.

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

**What we found no published work on.** A pressure mat used to measure body mass in
partial gravity. The image also assumes no load transfer between cells.

**Safety notes with a source.** None in the evidence table.

## 4. Particle trackers above and below the sleeper

**Assumed output, once per night** (`rad`, or `null` when no data):

| Field | Meaning |
|---|---|
| `dose_uGy` | Absorbed dose over the sleep period, in uGy: in silicon on Mars (Curiosity RAD detector B), water-corrected by the instrument team on the Moon (LRO CRaTER) |
| `dir` | Particle counts in 8 azimuth sectors; sector 0 points toward the head. The assumed trackers accept particles within 20 degrees of vertical, so the direction map mostly describes the roof; side walls would need wider acceptance. |
| `spe` | Solar particle event flag for the night, taken from NASA's DONKI records for the replayed date (not from the detector) |

The assumed trackers are silicon-strip planes of the kind already flying in
Fermi LAT (V36). Timepix detectors (V17, the ISS monitors) are the reference
only for measuring dose and energy deposit: their chips are small, and covering
a whole bed with them is not practical.

The density image also needs the number of usable tracks per cm2 in the night.
In this version the simulator supplies it (`_truth.tracksPerCm2`, which the
assessment engine never reads): 2,183 incident GCR protons per cm2 in an 8-hour
night within a 20-degree cone (assumed free-space intensity of 0.2 per cm2 per
s per sr). The same value is used for the Moon and Mars. On Mars about 20 g/cm2
of air removes roughly a quarter of the usable tracks (our estimate); this
version does not apply it.

- **Habitat shielding what-if** (0.6 to 1): the share of cosmic-ray tracks that
  still cross the sleeper. It acts on the tracks only and does not change the
  dose, because galactic-cosmic-ray dose changes little behind shielding. On
  quiet nights CRaTER's D5&6 pair, which cosmic rays from deep space reach
  through both plastic pieces (V93), reads within 2% of D1&2 behind the thin
  zenith cap: about 89.6 against 91.3 uGy (V61).
- **Nights with raised radiation** add no usable tracks. A night counts as
  quiet when no solar particle event is on record and its dose is at most 1.15
  times the scenario median. Solar protons mostly stop inside the body or cross
  it with far lower momentum than cosmic rays. In the solar-event scenario this
  leaves out nights 14 to 18 and 20 to 26.
- **Unknown momentum:** the trackers measure angles, not momentum, so each
  track is a noisier estimate of the material it crossed. The density image
  multiplies the counting noise by 5 for this, and uses both projections of
  each track.

**Evidence that the principle works**

- Large silicon-strip trackers already fly in space: Fermi LAT has 16 towers
  of 18 x/y planes with 228 um strip pitch (V36).
- Timepix-based Radiation Environment Monitors, the reference for measuring
  dose and energy deposit, have flown on the ISS since 16 October 2012, and the
  direction of each particle track can be reconstructed. The Timepix-based
  HERA flew on Artemis I (V17).
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
- Surface doses used by the simulator are replayed measurements: LRO CRaTER
  nights from 2017 on the Moon (V61) and Curiosity RAD sols from 2012 on Mars
  (V60).

**What we found no published work on**

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
3. **Habitat shielding** changes which particles reach the trackers (V37),
   and thick body regions filter out low-momentum particles, so scattering
   does not scale linearly with thickness. Next step: simulate usable tracks
   behind the habitat and through the body.
4. **We found no published density image of a body made this way.** A 2026
   study argues the natural muon flux on Earth is too low for medical imaging
   (V38). Next step: repeat the published ground test with sea-level muons and
   a body phantom (V35).
5. **We found no published human EIM data from space, bed rest or the back of
   the calf** (V8 measured the shin), and no study of bed-integrated
   dry-electrode EIM (V30). Next step: run the panel beside strength tests and
   MRI in a bed-rest study.
6. **Fluid shifts move the impedance reading** (V28). Next step: measure in the
   last hour before waking.
7. **We found no published test of radar vital signs in space** (V39). Next
   step: test in a mock sleep station and an analogue.
8. **The radiation card shows absorbed dose (silicon on Mars, water on the Moon), not effective dose.**
   The Moon nights replay a lightly shielded detector on an orbiter; behind
   thick habitat shielding a crew would receive much less from a solar
   particle event (V92). Next step: add the conversion with a validated
   transport model of the habitat.
9. **Detection accuracy:** the simulated nights and the plan share one model.
   Next step: test the rules on recorded bed-rest data.
10. **The transit:** in weightlessness the sleeper does not rest on the panel,
    so MyoTwin starts at arrival. Next step: pair it with a worn sensor for the
    transit.
11. **Materials flammability** rules for a low-pressure, oxygen-rich habitat
    atmosphere apply to the electronics and the current in the mattress. Next
    step: add the flammability tests to the hardware requirements.
12. **Lunar dust** on the dry electrodes and the mattress surface. Next step:
    replaceable electrode covers.
