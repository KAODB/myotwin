# MyoTwin: project page text

Text for each field of the 2026 NASA Space Apps Challenge project page.
Challenge: Create Health Monitoring Software for Astronauts on Space Missions.
Team: spacesim. Local event: Kaohsiung.

Ids in brackets, such as (V1), are entries in the evidence table:
[docs/EVIDENCE.md](EVIDENCE.md), generated from `js/evidence.js`.

## Project Name

MyoTwin

## High-Level Project Summary

NASA requires crews to keep in-mission muscle strength at or above 80% of baseline (V1). In 2019 NASA stated that muscle strength could not be assessed in flight (V2). MyoTwin is software for measuring crew passively while they sleep in a lunar or Mars surface habitat. An assumed sensor panel in the sleep station (an impedance strip under the calves, a 60 GHz radar, a pressure mat and particle trackers) produces one record per night. Each morning MyoTwin shows one whole-body image, four status cards (muscle, sleep, heart and breathing, radiation), the trend against the person's own baseline and the mission plan, and what to do next. The status colours are screening flags; a flight surgeon decides. The hardware is not built and all data are simulated. Every number in the software traces to a source recorded in the repository.

## Link to Project Demo

DEMO_LINK_TO_ADD

## Link to Final Project

- Live page: https://kaodb.github.io/myotwin/
- Repository: https://github.com/KAODB/myotwin

## Detailed Project Description

Ids such as (V1) are entries in docs/EVIDENCE.md.

### What it does

NASA requires in-mission muscle strength to stay at or above 80% of baseline (V1), but in 2019 NASA stated that muscle strength could not be assessed in flight (V2).

Human time in partial gravity is short: Apollo 17 stayed 75 hours on the lunar surface (V13). In a JAXA study, mice on the ISS centrifuge kept soleus size at 0.33 g but needed 0.67 g to keep muscle function (V6). The Moon has 0.165 of Earth's gravity and Mars 0.380 (V14), both below what the mice needed.

ISS crews slept 6.09 hours a night on average (V11), although NASA protects 8.5 hours for sleep (V18). MyoTwin measures then, which takes no crew time or scheduling. On a surface, gravity holds the sleeper on the bed, within reach of sensors every night.

Each morning MyoTwin shows one whole-body image, four status cards (muscle, sleep, heart and breathing, radiation), the trend against the person's own baseline and the mission plan, and what to do next. It runs offline in a browser, and all data are labelled as simulated. An eldercare wording of the same engine follows an older adult at home: impedance myography (EIM) needs no effort from the person, and its phase falls with age (V9).

### How it works

The assumed panel gives one record per night: calf EIM phase at 50 kHz with contact quality; hours asleep, sleep efficiency, breathing rate, heart rate and movement from the radar; absorbed dose in silicon, particle directions and a solar particle event flag from the trackers.

Each card compares the night with the person's own 14 pre-departure nights. Muscle turns amber when the 7-night median phase falls more than 4.2% further than the mission plan expects, and red when it is more than 16.8% below baseline (or 2 and 3 times the person's expected noise, if larger). These are the average and upper-limit test-retest variability of EIM (V10). Sleep is amber under 7 hours (V25) and red under 6, the ISS average rounded down (V11). Heart and breathing rate turn amber above the baseline median plus 2 SD. Radiation turns amber above twice the usual dose, red above ten times or on a solar particle event flag. All flags are interim and unvalidated. The software never prescribes: exercise is listed as supported, a leucine-enriched high-protein diet as not supported, electrical stimulation and blood-flow restriction as under study (V4, V41).

Simulated muscle follows a first-order approach to a loss plateau with gravity and exercise terms. Fitted values: a 38% plateau at 0 g without exercise, a 42-day time constant, 72% of loss prevented by full exercise. It gives -28.9% and -8.1% for two 60-day bed-rest groups (published -29% and -8%, V4) and -10.5% for six months on the ISS (published -13 +/- 2%, V5). Loss scales linearly with missing gravity, an assumption the user can change, because V6 suggests it may not be linear. Four scenarios cover the Moon, Mars after a 180-day transit, a lunar solar particle event, and an older adult after hospital discharge.

The image has three layers. Density comes from cosmic-ray scattering: trackers record each particle's angle, and scattering depends on the radiation length of the tissue crossed (V31, V32). The hazard becomes the light source, with no added dose. The simulation assumes 2,183 usable tracks per cm2 per 8-hour night. Pressure is tissue weight at local gravity and gives body mass. Impedance shows the calf phase. Nightly dose uses 13.2 uGy/h in silicon on the Moon, measured on the Chang'E-4 lander (V12), and 8.60 uGy/h on Mars from one MSL/RAD observation (V16).

### What makes it sound

Every number in the code is an evidence entry with its source sentence, or a declared assumption. A test fails if the evidence list is out of date. Each person is compared with their own baseline. The model's misfit to the ISS data is stated. The engine never reads the simulator's ground truth.

### What this version does not account for, and the next step

1. The momentum of each particle is unknown. Next: a reference block of known thickness beside the sleeper, then a momentum-measuring layer.
2. Movement at night, and tails from nuclear interactions. Next: sort tracks by posture with the pressure image, start with large regions, run a particle-transport simulation.
3. Habitat shielding, about 20 g/cm2 in NASA guidance (V37), changes which particles reach the trackers. Next: simulate usable tracks behind different shielding.
4. The density image has never been measured this way. Sea-level muons imaged a phantom in 24 hours (V35); a 2026 study argues natural muon flux on Earth is too low for medical imaging (V38). Next: repeat the ground test with a body phantom.
5. No human EIM data exist from space, bed rest or the back of the calf (V8 measured the shin), and bed-integrated dry electrodes are untested (V30). Next: run the panel beside strength tests and MRI in a bed-rest study.
6. Fluid shifts after lying down move the impedance reading (V28). Next: measure in the last hour before waking.
7. Radar vital signs are untested in space (V39).
8. The radiation card shows absorbed dose in silicon, not effective dose.

### Tools and languages

HTML, CSS and plain JavaScript; no libraries, build step or network requests. Node.js built-in test runner. GitHub Pages. Claude (by Anthropic) through Claude Code.

## Use of Super Intelligence (SI)

We used one SI tool: Claude, by Anthropic, through Claude Code. It helped find and check literature, write the code and tests, generate the simulated data, draft the text, and assemble the demo. The concept, the direction and every clinical judgement are the team lead's. Every number in the software was checked against its source and recorded in js/evidence.js with the sentence that carries it, or declared as an assumption. No SI-generated images of people are used; the images are outputs of the software and are labelled as simulated. The form of the muscle model comes from a private simulator the team wrote on 11-13 November 2026, before the hackathon; it was refitted to published data and rewritten here. Everything else was written during the hackathon. Details: docs/SI_USE.md.

## NASA Data

- **NASA-STD-3001 muscle strength standard**, as quoted in NASA OCHMO-TB-031, Exercise Overview (2023) (V1). The 80% of baseline standard frames the problem, and the red muscle card asks for a strength test against it. Cited; not used in calculations. https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-031-exercise-overview.pdf
- **Downs ME (NASA H-3PO), Approach to Astronaut Fitness Standard Recommendations, 2019, NTRS 20190025092** (V2). Source for the statement that muscle strength could not be assessed in flight. Cited only. https://ntrs.nasa.gov/citations/20190025092
- **NASA, Apollo 17 Mission Details** (V13). Source for the 75-hour lunar surface stay. Cited only. https://www.nasa.gov/missions/apollo/apollo-17-mission-details/
- **NASA NSSDC Moon and Mars Fact Sheets** (V14). The code computes with the gravity ratios 0.165 and 0.380, in the muscle model and in the pressure image. https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html
- **NASA Planetary Data System, MSL-M-RAD-3-RDR-V1.0, sol 90** (V16). The code computes the simulated nightly Mars dose from 8.60 uGy/h in silicon. https://pds-ppi.igpp.ucla.edu/data/MSL-M-RAD-3-RDR-V1.0/
- **NASA, Improvements to On-Orbit Sleeping Accommodations, NTRS 20190027189** (V18). Source for the 8.5 hours protected for sleep. Cited only. https://ntrs.nasa.gov/citations/20190027189
- **Clowdsley M (NASA LaRC), lunar radiation talk, 2021, NTRS 20210009760** (V37). Source for the 20 g/cm2 shielding guidance in the list of what this version does not account for. Cited only. https://ntrs.nasa.gov/citations/20210009760
- **NASA Open Science Data Repository, OSD-714** (V40). RNA-seq data from the JAXA lunar-gravity mouse mission. It has no muscle-mass, grip or impedance files, so MyoTwin cites it and does not compute from it. https://osdr.nasa.gov/bio/repo/data/studies/OSD-714

## Space Agency Partner Data and Other References

Space agency partner work:

- **JAXA ISS centrifuge mouse study.** Tsuji R et al., Sci Adv 2026 (V6). 0.33 g preserved soleus size; 0.67 g was needed for function, with grip strength and EIM among the measures. Cited as the reason the gravity term is an adjustable assumption; not used in calculations. https://doi.org/10.1126/sciadv.aed2258
- **ESA muscle stimulation study (ongoing)** and Hackney KJ et al. 2012 (V41), read only as search summaries (secondary). Neuromuscular electrical stimulation and blood-flow-restricted exercise are proposed for spaceflight, with no published in-flight results found. Cited in the countermeasure list as under study. https://www.axiomspace.com/research/muscle-stimulation

Other references. "Computes" means the code uses the number; "cites" means the text refers to it.

- Trappe TA et al., Acta Physiol 2007 (V4). 60-day bed rest; muscle model fitted to it; countermeasure list cites it. https://pubmed.ncbi.nlm.nih.gov/17655736/
- Trappe S et al., J Appl Physiol 2009 (V5). Six months on the ISS; muscle model fitted to it. https://doi.org/10.1152/japplphysiol.91578.2008
- Tarulli AW et al., Arch Phys Med Rehabil 2009 (V8). EIM after casting; anchors the assumed baseline phase and phase slope. https://doi.org/10.1016/j.apmr.2009.04.007
- Aaron R et al., Physiol Meas 2006 (V9). EIM phase falls with age; cites. https://doi.org/10.1088/0967-3334/27/10/002
- Rutkove SB et al., Clin Neurophysiol 2006 (V10). EIM test-retest variability; computes (muscle thresholds). https://doi.org/10.1016/j.clinph.2005.12.029
- Barger LK et al., Lancet Neurol 2014 (V11). ISS sleep 6.09 h; computes (red sleep threshold). https://doi.org/10.1016/S1474-4422(14)70122-X
- Zhang S et al., Sci Adv 2020 (V12). Lunar surface dose from the LND instrument on the Chang'E-4 lander; computes (simulated lunar dose). This is not NASA or partner data. https://doi.org/10.1126/sciadv.aaz1334
- Watson NF et al., Sleep 2015 (V25). Adults should sleep 7 or more hours; computes (amber sleep threshold). https://pmc.ncbi.nlm.nih.gov/articles/PMC4434546/
- Scharfetter H et al. 1997; Zhu F et al. 1998 (V28). Leg bioimpedance drifts after lying down; anchors the assumed fluid offset; cites. https://pubmed.ncbi.nlm.nih.gov/9688726/
- Nichols CJ et al. 2023; Castro ID et al. 2019 (V30). Textile and bed-integrated bioimpedance; cites. https://pubmed.ncbi.nlm.nih.gov/37027282/
- Particle Data Group, Atomic and Nuclear Properties of Materials (V31). Radiation lengths and densities; computes (density and pressure images). https://pdg.lbl.gov/2024/AtomicNuclearProperties/
- Particle Data Group, Passage of Particles Through Matter (V32). Multiple-scattering formula; cites. https://pdg.lbl.gov/2024/reviews/rpp2024-rev-passage-particles-matter.pdf
- arXiv:1609.09442, citing McKinney et al. 2006 (V33). Galactic cosmic-ray proton flux range; anchors the assumed track rate. https://arxiv.org/abs/1609.09442
- Morris CL et al., arXiv:2106.01542 (V35). Muon image of a phantom at sea level; cites. https://arxiv.org/abs/2106.01542
- Banerjee et al., arXiv:2610.16647 (V38). Natural muon flux on Earth too low for medical imaging; cites. https://arxiv.org/abs/2610.16647
- Baldi M et al., Sensors 2014 (V39). Radar design study for the ISS crew quarters; cites. https://pmc.ncbi.nlm.nih.gov/articles/PMC4327036/
