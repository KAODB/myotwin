# MyoTwin: project page text

Text for each field of the 2026 NASA Space Apps Challenge project page.
Challenge: Create Health Monitoring Software for Astronauts on Space Missions.
Team: MyoTwin (one person). Local event: Kaohsiung.

Sources are named in the text. The lists under "NASA Data" and "Space Agency
Partner Data and Other References" give each source its id in the evidence
table, such as (V85): [docs/EVIDENCE.md](EVIDENCE.md), generated from
`js/evidence.js`.

## Project Name

MyoTwin

## High-Level Project Summary

On the Moon or Mars a crew member has to notice changes in their own body. From Mars a message can take up to 20 minutes one way, and NASA rates the risk of operating with little real-time help from Earth 5x5 for a Mars mission, the top of its scale. NASA requires crews to keep muscle strength at or above 80% of baseline. The strength tests used on the ISS need specialized equipment in a fixed place, and in 2023 NASA's evidence report said "Currently, no standard in-flight measurement of strength exists."

MyoTwin takes the tools clinics use to find muscle loss in older adults and rebuilds them for a crew member asleep on the Moon or Mars. It is a morning health brief built from the hours a crew member already spends lying still. A sensor panel in the bunk, which I assume and have not built, measures the calf muscle, sleep, heart and breathing rate, and radiation overnight. Nothing is worn and the measuring takes no crew time. In the morning the crew member answers three questions in about 30 seconds: how they feel, their temperature, and anything they notice. One screen then shows a body figure you can click, four checks in plain words, what the crew member said beside what the bunk measured, what NASA says about each risk, and what to do today.

The radiation numbers are real measurements replayed night by night: Curiosity's RAD on Mars and LRO's CRaTER at the Moon, including the solar storms of September 2017. The crew member's own readings are simulated, and the radiation card says where its number was measured.

## Link to Project Demo

Seven slides, PDF, opens in the browser: https://kaodb.github.io/myotwin/demo/slides/MyoTwin-demo.pdf

The editable PowerPoint file is in the repository: https://github.com/KAODB/myotwin/blob/main/demo/slides/MyoTwin-demo.pptx

## Link to Final Project

- Live page: https://kaodb.github.io/myotwin/
- Repository: https://github.com/KAODB/myotwin

## Detailed Project Description

### What it does

Each morning MyoTwin answers three questions for the person who slept in the bunk: what changed, what does it mean, and what do I do today.

- **Muscle.** A strip of electrodes under the calves reads the muscle every night by electrical impedance myography. The card compares the last seven nights with the person's own 14 nights before departure and with what the mission plan expected by this day.
- **Sleep.** A radar above the bunk estimates hours asleep. The card uses the 7-hour line from NASA's sleep brief.
- **Heart and breathing.** The same radar gives night-time heart rate and breathing rate, judged against the person's own range. Both raised for three nights is treated as a possible early sign of illness.
- **Radiation.** The dose over the sleep period, how it compares with a usual night, and the running total.
- **Morning check-in.** Three questions, about 30 seconds: how the crew member feels on a five-step scale, their temperature, and whether their legs feel weaker, they did not feel rested, or they feel ill. Each answer is set beside the bunk's reading for the same part of the body.

The page opens on a start screen: one sentence on what this is, a start button, and three step cards that a navigation bar repeats. Step 1, Overnight, is what the bunk measured while the crew member slept: one headline, the body image and the four checks. Step 2, Check-in, is the one part the crew member fills in, on its own block of blue so the two are not confused. Step 3, Today, is one list of what to do, from the bunk's readings and from the answers. The body figure is a way in to each check: select the head, the chest or the calves, or the whole body for radiation. Each check shows its status in words (In range, Watch, Report, No data), what it means, what to do now and who decides. Each check opens to its trend. One row inside each check gives the NASA context: the Human Research Program risk it relates to, NASA's rating of that risk for the mission selected, two sentences from NASA's own page on the risk, and the NASA standard that applies. Orange appears only where something needs attention. The page is written for the person using it; the sources, the limits and the method are in this text, the slides and the repository.

Every morning also brings a whole-body image in three layers: a density map made from the scattering of the cosmic rays that already pass through the sleeper, a pressure map, and the calf impedance. One sentence under the switches says what the layer on screen shows. The density layer is experimental.

There are three scenarios: a Moon base for 60 nights; the first 90 nights on Mars after a 180-day transit, with a three-week exercise lapse and a short illness; and a Moon base during the solar particle events of September 2017.

### How it works

One record per night goes into an assessment engine. Its rules are written as data, and every threshold carries its source or is marked as an assumption.

- Muscle turns to Watch when the seven-night median is worse than the plan by more than 4.2%, the average test-retest variability reported for this measurement. It turns to Report when it is more than 16.8% below the person's own baseline, the largest variability reported. That is a line for reporting, not a strength threshold.
- Sleep turns to Watch under 7 hours and to Report under 6, which is about what astronauts average in space. The 6-hour line is my assumption.
- Heart and breathing only reach Watch.
- Radiation turns to Watch above twice the usual night and to Report above ten times, or when a solar particle event is on record. It describes the night that has passed. Real-time warnings come from space-weather alerts and the flight rules.
- The check-in turns to Watch when the temperature is more than 1.1 °C above the person's own baseline, when it is as far below (my assumption; the brief then asks for a repeat measurement), when mood is rated 1 or 2 out of 5, or when something is noticed. It has no Report level. For each body system four outcomes are possible: the person and the bunk agree that nothing has changed, both show a change, only the person notices something, or only the bunk does. The last one is the case a nightly reading exists for.

The first nights after arrival show No data, because I do not mix nights from before departure with nights on the surface.

The simulated muscle follows a first-order model with a gravity term and an exercise term. I fitted it to two published results: 60 days of bed rest (the model gives -28.9% and -8.1% against the published -29% and -8%) and six months on the ISS (-10.5% against -13 +/- 2%, so it underestimates). The gravity term is linear by assumption, and the code sets that assumption against rats kept for 28 days at 40% weight bearing, from NASA's Open Science Data Repository: across three measures in each sex (six results) they lost between 0.25 and 1.05 of what fully unloaded rats lost, median 0.56, where the model assumes 0.60. That is a plausibility check of one assumption, not a fit. The simulator and the mission plan use the same model, so the page shows the workflow, not how well a real decline would be caught.

Every calculation, with its parameters and their sources, is written out step by step in docs/CALCULATIONS.md in the repository.

### How NASA data and resources are used

In four ways.

1. **Measured data that drive numbers.** Mars nights replay Curiosity's RAD dose rate, measured in 2012, from 94 sols of RAD data in NASA's Planetary Data System (the 90-night scenario uses sols 13 to 108). Moon nights replay the dose LRO's CRaTER measured in lunar orbit in 2017, summed over a 22:00 to 06:00 UTC sleep window and scaled to the surface by the instrument team. In the solar-event scenario, mission night 20 replays the night of 10 September 2017, after the smaller events of 4 to 7 September: 43.5 mGy at CRaTER's D5&6 detectors, about 500 times a quiet night. That pair is a lightly shielded detector on an orbiter, not a model of a habitat. Thick habitat shielding stops most solar protons, so a crew inside would receive much less. Under 23 g/cm2 of Martian air, Curiosity's RAD saw the dose rate rise only two- to threefold in the same event. NASA's DONKI records mark the nights with a solar energetic particle event, and a chart shows NASA's OMNI proton flux for those days. Surface gravity for the muscle model and the pressure map comes from NASA's planetary fact sheets.
2. **NASA's words and ratings on every check.** All five resources on the challenge page are used, in the product, the slides or this text, and so are twelve of the pages they link to. Each check quotes NASA's page on its risk and shows the Human Research Roadmap rating for the mission selected. For muscle that is 5x4, Requires Mitigation, on a Mars planetary mission and 5x3 on a long lunar-surface mission.
3. **NASA standards as the lines and the reasons.** A 2026 NASA bulletin describes the two isometric strength tests used on the ISS as "location specific requiring specialized equipment", which is the gap a passive nightly reading is meant to sit in. NASA-STD-3001 gives the 80% strength line, the recommended 8.5-hour sleep period, the requirement to record and trend vital signs in mission, the dose-rate limit for surface habitats, and the requirements to monitor radiation where the crew lives and to alert the crew when dose rates pass set thresholds. The rationale of the alert requirement adds that the alert must work even without ground contact. It also requires horizontal sleep surfaces in partial gravity, which is why a panel built into the bed is a reasonable place to measure on the Moon or Mars.
4. **NASA research that makes the measurement plausible, and NASA open data that check the model.** A NASA-funded study adds impedance myography before and after flight in astronauts, and another NASA-funded study used it every week in rats under partial weight bearing. Open data from that line of rat studies, in NASA's Open Science Data Repository, are what the muscle model's gravity term is checked against.

### What this version does not account for, and the next step

1. The momentum of each cosmic-ray particle. Next: a reference block beside the sleeper, then a layer that measures momentum.
2. Movement during the night and tails from nuclear interactions. Next: sort tracks by posture with the pressure map, and run a particle-transport simulation.
3. Habitat shielding changes which particles arrive (V37), and thick body regions filter out low-momentum particles, so scattering does not scale linearly with thickness. One reference block calibrates one thickness only. Next: simulate the tracks behind the habitat and through the body.
4. Scattering measures all the material along each path. Bedding, body fluid, fat and muscle all add to it, and water and muscle differ by under 3% in radiation length (V31), so fluid loss and muscle loss look alike. Next: compare the signal summed over the whole limb, with the bedding fixed or measured, and read it beside the impedance.
5. I found no published density image of a body made this way. Next: repeat the ground test with sea-level muons and a body phantom (V35).
6. I found no published human impedance data from space, bed rest or the back of the calf (V8), and no study of bed-integrated dry electrodes (V30). Next: a bed-rest study beside strength tests and MRI.
7. I take the impedance baseline on Earth, where the calf presses on the strip about six times harder than on the Moon (2.6 times harder than on Mars, V14), and fluid shifts move the reading (V28). The size of the step on arrival is my assumption. Next: measure in the last hour before waking, re-baseline in the first surface week, and measure the arrival step in a partial-gravity analogue.
8. I found no published test of radar vital signs in space (V39). Next: a mock sleep station and an analogue.
9. Radiation. The card shows absorbed dose (in silicon on Mars, water-corrected at the Moon), not effective dose, and neutrons are not measured (V46). The Moon nights replay a lightly shielded detector on an orbiter. Behind thick habitat shielding a crew would receive much less from a solar particle event (V92). Next: run the measured proton spectrum through a validated transport model of the habitat, and add a neutron channel.
10. Detection accuracy. The simulated nights and the plan share one model. Next: test the rules on recorded bed-rest data.
11. The transit. In weightlessness the sleeper does not rest on the panel, so MyoTwin starts at arrival (V42). Next: pair it with a worn sensor for the transit.
12. Air, noise and light are not read (V43). Next: show the habitat's environmental sensors beside the brief.
13. The morning check-in. One question about mood is not a tested scale, the temperature baseline is assumed, and the 1.1 °C step comes from care homes on Earth (V97). Temperature at rest has not been measured in partial gravity (V98). Next: learn each person's baseline from their first two weeks of check-ins, and try the questions in an analogue mission.

### Where the method comes from

On Earth, clinics look for muscle loss in older adults in three steps. They find it with a tape around the calf or a five-question form, assess strength with a grip test or five rises from a chair, and confirm low muscle mass by DXA or bioimpedance (V94, V95). Phase angle from bioimpedance is lower in people with muscle loss (V96). The Canadian Space Agency describes the effects seen in astronauts as "similar to accelerated aging and health problems caused by a sedentary lifestyle". MyoTwin takes those steps to the Moon and Mars. The calf is read by impedance every night instead of once in a clinic visit, a strength test is asked for when the nightly reading falls behind the mission plan, and the flight surgeon confirms. The clinic tools read the whole body or the hand. Reading one calf by impedance in a bunk is my adaptation of them.

The check-in follows the same route. In long-term care, older adults often stay under the usual fever cut-offs, so the infectious disease guideline also counts a rise of more than 1.1 °C over the person's own baseline as fever (V97). Astronauts shift the other way: on the ISS, core temperature at rest rose by about 1 °C over the first 2.5 months (V98). In both groups a fixed cut-off misleads, so MyoTwin judges the reading against the person's own baseline. The crew of a 520-day Mars simulation rated themselves between two words, such as happy and unhappy (V99). The five-word mood question is a simpler form of that.

### Tools and languages

Plain HTML, CSS and JavaScript with no build step and no server; the typefaces already on the reader's device, so no font is loaded; Anime.js 4.5.0 (MIT) for motion, served from the repository; Node.js tests; Python scripts (standard library only) that rebuild the data files from the NASA downloads; GitHub Pages; pptxgenjs for the slides; Claude through Claude Code.

## Use of Super Intelligence (SI)

The disclosure is in [docs/SI_USE.md](SI_USE.md). In short: one SI tool, Claude by Anthropic, used through Claude Code to find and check sources, write the code and tests, build the data files, draft text and assemble the slides. The idea, the choice of what to measure and every clinical judgement are mine.

## NASA Data

Measured data that drive numbers on the page or check the model (files in `data/`, rebuilt by `tools/data/`):

- **NASA Planetary Data System, MSL-M-RAD-3-RDR-V1.0** (V60). Curiosity RAD dose rate in silicon, per-sol median from 94 sols of RAD data (sols 13 to 112, 2012). Drives every Mars night; the 90-night scenario uses sols 13 to 108. https://pds-ppi.igpp.ucla.edu/data/MSL-M-RAD-3-RDR-V1.0/
- **LRO CRaTER dose rates** (V61), instrument team at the University of New Hampshire, NASA Lunar Reconnaissance Orbiter mission. Drives every Moon night, including the September 2017 solar particle events. https://crater-web.sr.unh.edu/data/craterProducts/doserates/doserates_nospe.txt
- **NASA CCMC DONKI**, solar energetic particle records for September 2017 (V62). Marks the nights with an event on record. https://api.nasa.gov/DONKI/SEP?startDate=2017-09-01&endDate=2017-09-30&api_key=DEMO_KEY
- **NASA GSFC SPDF OMNI2**, hourly proton flux above 10 MeV (V63). The proton chart in the solar-event scenario. https://spdf.gsfc.nasa.gov/pub/data/omni/low_res_omni/omni2_2017.dat
- **NASA NSSDC Moon and Mars Fact Sheets** (V14). Surface gravity in the muscle model and the pressure map. https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html
- **NASA Open Science Data Repository, OSD-652 and OSD-616** (V90, V91). Rats at full, 40% and zero weight bearing for 28 days: grip force, plantarflexion torque and calf girth. Checks the muscle model's gravity term, in the code and its tests. https://doi.org/10.26030/z92y-7b97

Resources listed on the challenge page:

- **NASA Human Research Program, 5 Hazards of Human Spaceflight** (V43). The frame for the project: each check answers one of the five hazards. https://www.nasa.gov/hrp/hazards/
- **NASA Human Research Program, Risks of Human Spaceflight** (V44). The NASA risk named on each check. https://www.nasa.gov/hrp/risks/
- **NASA Human Research Program, Ongoing HRP Research in Space** (V45). ARCHeR and Standard Measures, cited in the NASA row of the sleep check. https://www.nasa.gov/hrp/ongoing-hrp-research/

Pages those resources link to:

- Risk pages quoted on the checks: reduced cardiorespiratory and musculoskeletal fitness (V48), inadequate sleep and irregular schedules (V49), cardiovascular adaptations (V50), radiation-induced cancers (V51). The page on behavioural conditions (V52) is the source of the journal advice in the morning check-in. https://www.nasa.gov/reference/risk-of-reduced-cardiorespiratory-and-musculoskeletal-fitness/
- Hazard pages: gravity fields (V53), distance from Earth (V54, the 20-minute delay), isolation and confinement (V55), space radiation (V56, the reason the check-in has no question about radiation: it cannot be felt). https://www.nasa.gov/hrp/hazard-distance-from-earth/
- Research pages: ARCHeR (V57), Tempus Pro (V58), Artemis II Standard Measures (V59). https://www.nasa.gov/reference/archer/

NASA ratings, standards and reports:

- **NASA Human Research Roadmap**, rating by mission type and open gaps for six risks: muscle and aerobic fitness (V70), sleep (V71), cardiovascular (V72), radiation carcinogenesis (V73), medical conditions in mission (V74), Earth-independent operations (V75). The four check ratings are shown inside each check for the mission selected. The rating for Earth-independent operations is cited in the summary above, and the one for medical conditions in mission is kept in the rules data. https://humanresearchroadmap.nasa.gov/Risks/?i=180
- **NASA-STD-3001, Volumes 1 and 2**: health monitoring in mission (V76, V77), the recommended sleep period (V78), horizontal sleep surfaces in partial gravity (V80), the 80% strength line and its rationale (V81, also V1), the dose-rate limit for surface habitats (V83), radiation monitoring and alerting (V84), the career dose limit (V21). https://www.nasa.gov/wp-content/uploads/2023/11/nasa-std-3001-vol-1-rev-c-with-signature.pdf
- **NASA OCHMO technical briefs**: sleep accommodations (V79, the 7-hour line), the 2026 bulletin on strength measurement (V82), exercise overview (V3). https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-041-sleep-accommodations.pdf
- **NASA evidence reports**: muscle and aerobic capacity (V85), sleep (V86). https://humanresearchroadmap.nasa.gov/evidence/reports/Sleep.pdf
- **NASA Task Book**: funded impedance myography studies in astronauts (V87) and in rats under partial weight bearing (V88). https://taskbook.nasaprs.com/tbp/index.cfm?action=public_query_taskbook_content&TASKID=07387AE7B0ED65293EFA45E8203BB732
- **NASA Technical Reports Server**: the 2019 presentation on fitness standards (V2), sleeping accommodations on the ISS (V42), shielding of the ISS crew quarters (V19), lunar shielding guidance (V37). https://ntrs.nasa.gov/citations/20190025092
- **NASA Open Science Data Repository, OSD-714** (V40), with Hayashi T et al., Commun Biol 2023. Mice at one-sixth g; cited, not computed from. https://osdr.nasa.gov/bio/repo/data/studies/OSD-714
- **NASA, Apollo 17 Mission Details** (V13). Cited. https://www.nasa.gov/missions/apollo/apollo-17-mission-details/

## Space Agency Partner Data and Other References

Space agency partners:

- **Canadian Space Agency, Monitoring radiation for astronaut health, 2026** (V46), a resource listed on the challenge page. Neutrons are about 30% of total radiation on the ISS; the CANS spectrometer is being developed to measure them. MyoTwin does not measure neutrons; the radiation check states their share, and the limits above list the gap. https://www.asc-csa.gc.ca/eng/news/articles/2026/2026-02-26-monitoring-radiation-astronaut-health.asp
- **Canadian Space Agency, Why do we conduct science experiments in space?** (V47), a resource listed on the challenge page. The reason tools built for older adults are the starting point. https://www.asc-csa.gc.ca/eng/iss/science/why-do-we-conduct-science-experiments-in-space.asp
- **European Space Agency, MARES** (V89). The 200 kg dynamometer on the ISS, which ESA describes as too complex for everyday exercise. https://www.esa.int/Science_Exploration/Human_and_Robotic_Exploration/Columbus/Muscle_Atrophy_Research_and_Exercise_System
- **University of Tsukuba-led study with JAXA, using JAXA's centrifuge on the ISS.** Tsuji R et al., Sci Adv 2026 (V6). In mice, 0.33 g preserved soleus size and 0.67 g was sufficient to maintain muscle function. Cited as the reason the gravity term is an adjustable assumption. https://doi.org/10.1126/sciadv.aed2258
- **ESA muscle stimulation study (ongoing)** and Hackney KJ et al. 2012 (V41), read as search summaries only. Background on countermeasures under study, kept in the rules data. https://www.axiomspace.com/research/muscle-stimulation

Other references. "Computes" means the code uses the number; "cites" means the text refers to it.

- Trappe TA et al., Acta Physiol 2007 (V4). 60-day bed rest; the muscle model is fitted to it. https://pubmed.ncbi.nlm.nih.gov/17655736/
- Trappe S et al., J Appl Physiol 2009 (V5). Six months on the ISS; the muscle model is fitted to it. https://doi.org/10.1152/japplphysiol.91578.2008
- Tarulli AW et al., Arch Phys Med Rehabil 2009 (V8). Impedance myography after casting; anchors the assumed baseline phase. https://doi.org/10.1016/j.apmr.2009.04.007
- Aaron R et al., Physiol Meas 2006 (V9). Impedance phase falls with age; cites. https://doi.org/10.1088/0967-3334/27/10/002
- Rutkove SB et al., Clin Neurophysiol 2006 (V10). Test-retest variability; computes (muscle thresholds). https://doi.org/10.1016/j.clinph.2005.12.029
- Barger LK et al., Lancet Neurol 2014 (V11, V18). ISS sleep of 6.09 hours; computes (the 6-hour line, an assumption). https://doi.org/10.1016/S1474-4422(14)70122-X
- Watson NF et al., Sleep 2015 (V25). Sleep recommendation for adults aged 18 to 60; cites. https://pmc.ncbi.nlm.nih.gov/articles/PMC4434546/
- Liebetruth M et al., Sensors 2024 (V23); Choi JW et al., Sensors 2022 (V24). Radar monitoring of breathing, heart rate and sleep; cites. https://pmc.ncbi.nlm.nih.gov/articles/PMC10857015/
- Scharfetter H et al. 1997; Zhu F et al. 1998 (V28). Leg bioimpedance drifts after lying down; cites. https://pubmed.ncbi.nlm.nih.gov/9688726/
- Nichols CJ et al. 2023; Castro ID et al. 2019 (V30). Textile and bed-integrated bioimpedance; cites. https://pubmed.ncbi.nlm.nih.gov/37027282/
- Particle Data Group, Atomic and Nuclear Properties of Materials (V31) and Passage of Particles Through Matter (V32). Radiation lengths and the scattering formula; computes (density image). https://pdg.lbl.gov/2024/AtomicNuclearProperties/
- arXiv:1609.09442 (V33). Galactic cosmic-ray proton flux range; anchors the assumed track rate. https://arxiv.org/abs/1609.09442
- Morris CL et al., arXiv:2106.01542 (V35); Banerjee et al., arXiv:2610.16647 (V38). Muon imaging of a phantom and its limits; cites. https://arxiv.org/abs/2106.01542
- Baldi M et al., Sensors 2015 (V39). Radar design study for the ISS crew quarters; cites. https://pmc.ncbi.nlm.nih.gov/articles/PMC4327036/
- Pinsky L et al. 2014 and related NASA reports (V17). Timepix radiation monitors on the ISS; cites. https://pmc.ncbi.nlm.nih.gov/articles/PMC3941488/
- Zeitlin C et al., Geophys Res Lett 2018 (V92). Curiosity's RAD on Mars during the September 2017 event; cites. https://doi.org/10.1029/2018GL077760
- Spence HE et al., Space Sci Rev 2010 (V93). Layout of the CRaTER detectors; cites. https://doi.org/10.1007/s11214-009-9584-8
- Cruz-Jentoft AJ et al., Age Ageing 2019 (V94). The revised European consensus on sarcopenia: find, assess, confirm, severity; cites. https://doi.org/10.1093/ageing/afy169
- Chen LK et al., J Am Med Dir Assoc 2020 (V95). The Asian Working Group for Sarcopenia 2019 consensus: calf circumference, a five-question form, grip strength and the chair stand; cites. https://doi.org/10.1016/j.jamda.2019.12.012
- Di Vincenzo O et al., Clin Nutr 2021 (V96). Systematic review: bioimpedance phase angle is lower in sarcopenia; cites. https://doi.org/10.1016/j.clnu.2020.10.048
- High KP et al., Clin Infect Dis 2009 (V97). Guideline of the Infectious Diseases Society of America on fever in older adults in long-term care, including a rise of more than 1.1 °C over the person's own baseline; computes (the temperature rule of the check-in). https://doi.org/10.1086/595683
- Stahn AC et al., Sci Rep 2017 (V98). Core body temperature at rest rose by about 1 °C in 11 astronauts on the ISS; cites. https://doi.org/10.1038/s41598-017-15560-w
- Basner M et al., PLoS ONE 2014 (V99). Self-rating scales and the differences between crew members in a 520-day Mars simulation; cites. https://doi.org/10.1371/journal.pone.0093298

Code and tools from others:

- Anime.js 4.5.0 by Julian Garnier, MIT licence. The motion library, served unchanged from the repository (`vendor/`). https://animejs.com
- pptxgenjs, MIT licence. Builds the slide file. https://github.com/gitbrent/PptxGenJS
- LibreOffice turns the slide file into the PDF. Headless Chrome takes the screenshots and runs the page checks. Node.js runs the tests. Python (standard library only) rebuilds the data files. GitHub Pages hosts the page.
- Claude through Claude Code, the one SI tool used; see the SI field.
