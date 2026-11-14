# MyoTwin: project page text

Text for each field of the 2026 NASA Space Apps Challenge project page.
Challenge: Create Health Monitoring Software for Astronauts on Space Missions.
Team: spacesim. Local event: Kaohsiung.

Ids in brackets, such as (V1), are entries in the evidence table:
[docs/EVIDENCE.md](EVIDENCE.md), generated from `js/evidence.js`.

## Project Name

MyoTwin

## High-Level Project Summary

NASA requires crews to keep in-mission muscle strength at or above 80% of baseline (V1). In 2019 a NASA presentation stated that the ability to assess muscle strength in flight did not exist (V2). Whatever has changed since, a strength test costs crew time. MyoTwin's point is measurement that takes no crew time, every night. An assumed sensor panel in a lunar or Mars habitat's sleep station (calf impedance strip, 60 GHz radar, pressure mat, particle trackers) measures the crew while they sleep. Each morning MyoTwin shows a whole-body image, four status cards (muscle, sleep, heart and breathing, radiation), trends against the person's own baseline and the mission plan, and what to do next. The colours are screening flags; a flight surgeon decides. The hardware is not built and all data are simulated. Every number is an evidence entry (two are secondary citations) or a declared assumption.

## Link to Project Demo

DEMO_LINK_TO_ADD

## Link to Final Project

- Live page: https://kaodb.github.io/myotwin/
- Repository: https://github.com/KAODB/myotwin

## Detailed Project Description

### What it does

NASA requires in-mission muscle strength at or above 80% of baseline (V1). In 2019 a NASA presentation stated that the ability to assess muscle strength in flight did not exist (V2). Whatever has changed since, a strength test costs crew time. MyoTwin's point is measurement that takes no crew time, every night.

A University of Tsukuba-led study with JAXA, using JAXA's centrifuge on the ISS, found 0.33 g preserved mouse soleus size and 0.67 g was sufficient to maintain muscle function (V6). At one-sixth g in a separate mission, lunar gravity prevented soleus atrophy but not the fibre-type shift (V40). The Moon (0.165) and Mars (0.380) are below 0.67 g (V14); whether they keep muscle function in humans is untested.

ISS crews slept 6.09 hours a night (V11); Barger et al. 2014 report that NASA regulations mandate 8.5 hours of protected time for sleep each night (V18). MyoTwin measures then, while surface gravity holds the sleeper on the bed. An eldercare wording follows an older adult at home: impedance myography (EIM) needs no effort, and its phase falls with age (V9).

### How it works

Each night gives one record: calf EIM phase at 50 kHz; breathing and heart rate from radar (V23), with hours asleep, sleep efficiency and movement as assumed radar outputs; dose, particle directions and a solar particle event flag from the trackers.

Cards compare with the person's own 14 pre-departure nights and never mix them with surface nights, so the first nights after arrival are grey. Muscle: amber when the 7-night median phase is more than 4.2% worse than the mission plan, red when more than 16.8% below baseline (or 2 and 3 times the noise, if larger). These are the average and largest test-retest variability of operator-placed EIM in biceps, quadriceps and tibialis anterior, retested up to 250 days apart (V10); red is a reporting line, not a strength threshold, and the calf, mattress electrodes and a one-to-one phase-to-muscle link are assumptions. Sleep: amber under 7 hours, the recommendation for adults aged 18 to 60 (V25), used for the older adult as an assumption; red under 6 hours, an assumption (the ISS average rounded down, V11), not a validated cut-off. Heart and breathing: amber when either rate is above the person's own range; if both stay raised for three nights the card stays amber and says to tell the crew medical officer. Radiation: amber above twice the usual dose, red above ten times or on a solar particle event flag; red records the night, since real-time warnings come from space-weather alerts and flight rules. It shows the ratio to the usual level and the cumulative sleep-period dose. Red headlines read "Report to the flight surgeon today". Flags are interim and unvalidated; the software never prescribes (V4, V41).

Simulated muscle follows a first-order loss model with gravity and exercise terms. It matches 60-day bed rest (-28.9% and -8.1% against -29% and -8%, V4) and underestimates six months on the ISS (-10.5% against -13 +/- 2%, V5); bed rest is treated as 0 g and ISS crews as fully adherent, both assumptions. Linear gravity scaling is an adjustable assumption. Each scenario has its own person and seed: the Moon, Mars after a 180-day transit, a lunar solar particle event, and an older adult with five weeks of low activity (g = 0.6, an assumption, not a sourced equivalence) and four of normal activity, starting lower because EIM phase falls with age (V9). The default 2% sensor noise is an assumption; a what-if raises it.

Image layers: density from cosmic-ray scattering, which depends on tissue radiation length (V31, V32), so the hazard is the light source with no added dose; pressure, which gives body mass; calf impedance.

### What makes it sound

Every number is either an evidence entry, most with the sentence that carries it (two are secondary citations), or a declared assumption. The simulated nights and the mission plan come from the same model, so the demonstration shows the workflow, not how well a real decline would be detected.

### What this version does not account for, and the next step

1. Particle momentum. Next: a reference block, then a momentum layer.
2. Night-time movement, nuclear-interaction tails. Next: sort tracks by posture; transport simulation.
3. Habitat shielding, about 20 g/cm2 (V37). Next: simulate tracks behind it.
4. The density image is unmeasured; a 2026 study doubts natural muons suffice (V38). Next: repeat the muon phantom test (V35).
5. We found no published human EIM data from space, bed rest or the back of the calf (V8 measured the shin), nor bed-integrated dry-electrode EIM (V30). Next: a bed-rest study with strength tests and MRI.
6. Fluid shifts move the reading (V28). Next: measure in the last hour before waking.
7. We found no published test of radar vital signs in space (V39). Next: a mock sleep station.
8. The radiation card shows absorbed dose in silicon, not effective dose. Next: a validated transport model.
9. Detection accuracy: the simulated nights and the plan share one model. Next: test the rules on recorded bed-rest data.
10. The transit: in weightlessness the sleeper does not rest on the panel, so MyoTwin starts at arrival. Next: pair it with a worn sensor for the transit.

### Tools and languages

Plain HTML, CSS and JavaScript, running offline; Node.js tests; GitHub Pages; Claude through Claude Code.

## Use of Super Intelligence (SI)

We used one SI tool: Claude, by Anthropic, through Claude Code. It helped find and check literature, write the code and tests, generate the simulated data, draft the text, and assemble the demo. The concept, the direction and every clinical judgement are the team lead's. Every number in the software is either an entry in js/evidence.js, most with the sentence that carries it (two are secondary citations), or a declared assumption. No SI-generated images of people are used; the images are outputs of the software and are labelled as simulated. The form of the muscle model comes from a private simulator the team wrote on 11-13 November 2026, before the hackathon; it was refitted to published data and rewritten here. Everything else was written during the hackathon. Details: docs/SI_USE.md.

## NASA Data

- **NASA-STD-3001 muscle strength standard**, as quoted in NASA OCHMO-TB-031, Exercise Overview (2023) (V1). The 80% of baseline standard frames the problem, and the red muscle card asks for a strength test against it. Cited; not used in calculations. https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-031-exercise-overview.pdf
- **Downs ME (NASA H-3PO), Approach to Astronaut Fitness Standard Recommendations, 2019, NTRS 20190025092** (V2). Source for the 2019 statement that the ability to assess muscle strength in flight did not exist. Cited only. https://ntrs.nasa.gov/citations/20190025092
- **NASA, Apollo 17 Mission Details** (V13). Source for the 75-hour lunar surface stay. Cited only. https://www.nasa.gov/missions/apollo/apollo-17-mission-details/
- **NASA NSSDC Moon and Mars Fact Sheets** (V14). The code computes with the gravity ratios 0.165 and 0.380, in the muscle model and in the pressure image. https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html
- **NASA Planetary Data System, MSL-M-RAD-3-RDR-V1.0, sol 90** (V16). The code computes the simulated nightly Mars dose from 8.60 uGy/h in silicon, the first of 45 observations on sol 90. https://pds-ppi.igpp.ucla.edu/data/MSL-M-RAD-3-RDR-V1.0/
- **Clowdsley M (NASA LaRC), lunar radiation talk, 2021, NTRS 20210009760** (V37). Source for the 20 g/cm2 shielding guidance in the list of what this version does not account for. Cited only. https://ntrs.nasa.gov/citations/20210009760
- **NASA Open Science Data Repository, OSD-714** (V40), with Hayashi T et al., Commun Biol 2023. A separate JAXA mouse mission at one-sixth g: lunar gravity prevented soleus atrophy but not the fibre-type shift. The record holds RNA-seq files only, with no muscle-mass, grip or impedance files, so MyoTwin cites it and does not compute from it. https://osdr.nasa.gov/bio/repo/data/studies/OSD-714

## Space Agency Partner Data and Other References

Space agency partner work:

- **University of Tsukuba-led study with JAXA, using JAXA's centrifuge on the ISS.** Tsuji R et al., Sci Adv 2026 (V6). In mice, 0.33 g preserved soleus size and 0.67 g was sufficient to maintain muscle function, with grip strength and EIM among the measures. Cited as the reason the gravity term is an adjustable assumption; not used in calculations. https://doi.org/10.1126/sciadv.aed2258
- **ESA muscle stimulation study (ongoing)** and Hackney KJ et al. 2012 (V41), read only as search summaries (secondary). Neuromuscular electrical stimulation and blood-flow-restricted exercise are proposed for spaceflight, with no published in-flight results found. Cited in the countermeasure list as under study. https://www.axiomspace.com/research/muscle-stimulation

Other references. "Computes" means the code uses the number; "cites" means the text refers to it.

- Trappe TA et al., Acta Physiol 2007 (V4). 60-day bed rest; muscle model fitted to it; countermeasure list cites it. https://pubmed.ncbi.nlm.nih.gov/17655736/
- Trappe S et al., J Appl Physiol 2009 (V5). Six months on the ISS; muscle model fitted to it. https://doi.org/10.1152/japplphysiol.91578.2008
- Tarulli AW et al., Arch Phys Med Rehabil 2009 (V8). EIM after casting; anchors the assumed baseline phase and phase slope. https://doi.org/10.1016/j.apmr.2009.04.007
- Aaron R et al., Physiol Meas 2006 (V9). EIM phase falls with age; cites. https://doi.org/10.1088/0967-3334/27/10/002
- Rutkove SB et al., Clin Neurophysiol 2006 (V10). EIM test-retest variability; computes (muscle thresholds). https://doi.org/10.1016/j.clinph.2005.12.029
- Barger LK et al., Lancet Neurol 2014 (V11). ISS sleep 6.09 h; computes (the red sleep line, an assumption). https://doi.org/10.1016/S1474-4422(14)70122-X
- Barger LK et al., Lancet Neurol 2014, full text (V18). NASA regulations mandate 8.5 hours of protected time for sleep each night; cites. https://pmc.ncbi.nlm.nih.gov/articles/PMC4188436/
- Zhang S et al., Sci Adv 2020 (V12). Lunar surface dose, 13.2 uGy/h in silicon, from the LND instrument on the Chang'E-4 lander; computes (simulated lunar dose). This is not NASA or partner data. https://doi.org/10.1126/sciadv.aaz1334
- Watson NF et al., Sleep 2015 (V25). Adults aged 18 to 60 should sleep 7 or more hours; computes (amber sleep threshold; used for the older adult as an assumption). https://pmc.ncbi.nlm.nih.gov/articles/PMC4434546/
- Liebetruth M et al., Sensors 2024 (V23). Systematic review of radar breathing and heart rate monitoring; cites. https://pmc.ncbi.nlm.nih.gov/articles/PMC10857015/
- Scharfetter H et al. 1997; Zhu F et al. 1998 (V28). Leg bioimpedance drifts after lying down; anchors the assumed fluid offset; cites. https://pubmed.ncbi.nlm.nih.gov/9688726/
- Nichols CJ et al. 2023; Castro ID et al. 2019 (V30). Textile and bed-integrated bioimpedance; cites. https://pubmed.ncbi.nlm.nih.gov/37027282/
- Particle Data Group, Atomic and Nuclear Properties of Materials (V31). Radiation lengths and densities; computes (density and pressure images). https://pdg.lbl.gov/2024/AtomicNuclearProperties/
- Particle Data Group, Passage of Particles Through Matter (V32). Multiple-scattering formula; cites. https://pdg.lbl.gov/2014/reviews/rpp2014-rev-passage-particles-matter.pdf
- arXiv:1609.09442, citing McKinney et al. 2006 (V33). Galactic cosmic-ray proton flux range; anchors the assumed track rate. https://arxiv.org/abs/1609.09442
- Morris CL et al., arXiv:2106.01542 (V35). Muon image of a phantom at sea level; cites. https://arxiv.org/abs/2106.01542
- Banerjee et al., arXiv:2610.16647 (V38). Natural muon flux on Earth too low for medical imaging; cites. https://arxiv.org/abs/2610.16647
- Baldi M et al., Sensors 2015 (V39). Radar design study for the ISS crew quarters; cites. https://pmc.ncbi.nlm.nih.gov/articles/PMC4327036/
