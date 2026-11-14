/*
 * MyoTwin evidence table.
 *
 * Every number the software shows or computes with must trace back to an entry
 * here. Entries are either checked against the source text (status "verified",
 * with the sentence that carries the number), taken from a secondary citation
 * (status "secondary"), or an explicit modelling choice (status "assumption").
 * All checks were done on 2026-11-14 during the NASA Space Apps Challenge.
 *
 * This file was written with the help of an SI tool (Claude) and reviewed by
 * the team. See docs/SI_USE.md.
 */
(function (root) {
  'use strict';
  var ns = (root.MyoTwin = root.MyoTwin || {});

  var ITEMS = [
    // ---- Resources listed on the challenge page ------------------------------
    // The five resources NASA lists under "Resources" for the challenge "Create
    // Health Monitoring Software for Astronauts on Space Missions". Quotes are in
    // page order; " ... " marks text left out between two sentences.
    {
      id: 'V43', topic: 'challenge resources', status: 'verified', level: 'agency-web-page',
      claim: 'NASA groups the stressors of spaceflight into five hazards: space radiation, isolation and confinement, distance from Earth, gravity fields, and hostile/closed environments.',
      values: { hazards: ['Space Radiation', 'Isolation and Confinement', 'Distance from Earth', 'Gravity Fields', 'Hostile/Closed Environments'] },
      quote: "Astronauts' entire bodies – muscles, bones, inner ear, and organs – must adjust to the new gravities encountered on the space station or their spacecraft, as well as on the Moon, Mars, and Earth once they return home. ... Planning and self-sufficiency will be key to successful deep space missions.",
      source: 'NASA Human Research Program, 5 Hazards of Human Spaceflight',
      url: 'https://www.nasa.gov/hrp/hazards/'
    },
    {
      id: 'V44', topic: 'challenge resources', status: 'verified', level: 'agency-web-page',
      claim: 'NASA lists, among the risks of human spaceflight, reduced cardiorespiratory and musculoskeletal fitness, inadequate sleep and irregular schedules, cardiovascular adaptations, and radiation-induced cancers. Each MyoTwin check is mapped to one of them.',
      values: {
        muscleRisk: 'Risk of Reduced Cardiorespiratory and Musculoskeletal Fitness',
        sleepRisk: 'Risk of Inadequate Sleep and Irregular Schedules',
        cardioRisk: 'Risk of Cardiovascular Adaptations',
        radiationRisk: 'Risk of Radiation-Induced Cancers'
      },
      quote: 'Weightlessness alters blood circulation and how the heart and blood vessels function, potentially increasing the risk of cardiovascular events. ... All astronauts perform exercise during their mission to counteract losses in bone density, muscle strength, and heart and blood vessel performance. ... Stressors include chronic sleep loss, constant work demands, and irregularities in their internal biological clocks. ... Crews exposed to radiation from space may be more likely to develop cancer.',
      source: 'NASA Human Research Program, Risks of Human Spaceflight',
      url: 'https://www.nasa.gov/hrp/risks/'
    },
    {
      id: 'V45', topic: 'challenge resources', status: 'verified', level: 'agency-web-page',
      claim: "NASA's ARCHeR study monitored crew well-being, activity and sleep on Artemis II, and Standard Measures collects a consistent set of physiological and psychological measurements from crew members.",
      values: {},
      quote: "A study on Artemis II monitored astronauts' well-being, activity, and sleep patterns to learn more about human health and performance in deep space. ... Collecting a consistent set of physiological and psychological measurements to better understand how spaceflight affects the bodies and minds of crew members",
      source: 'NASA Human Research Program, Ongoing HRP Research in Space (entries ARCHeR and Standard Measures)',
      url: 'https://www.nasa.gov/hrp/ongoing-hrp-research/'
    },
    {
      id: 'V46', topic: 'challenge resources', status: 'verified', level: 'agency-web-page',
      claim: 'The Canadian Space Agency is funding the continued development of CANS, a compact neutron spectrometer designed to work continuously and autonomously, as plans advance for missions to the Moon and Mars. Neutrons contribute about 30% of total radiation on the ISS.',
      values: { neutronSharePct: 30 },
      quote: 'Neutron radiation, which contributes to about 30% of total radiation on the ISS, is especially harmful because it can cause serious biological damage and require specialized protective measures. ... CANS improves upon previous radiation detection methods with the unique combined capabilities of working continuously and autonomously.',
      source: 'Canadian Space Agency, Monitoring radiation for astronaut health (2026-02-26)',
      url: 'https://www.asc-csa.gc.ca/eng/news/articles/2026/2026-02-26-monitoring-radiation-astronaut-health.asp'
    },
    {
      id: 'V47', topic: 'challenge resources', status: 'verified', level: 'agency-web-page',
      claim: 'The Canadian Space Agency describes the changes seen in astronauts as similar to accelerated ageing and to the effects of a sedentary lifestyle, and says studying them helps with issues that affect older adults on Earth.',
      values: {},
      quote: 'Studying the way our body changes in space help us understand the impacts of reduced levels of physical activity and issues that affect older adult populations on Earth. ... The effects observed in astronauts are similar to accelerated aging and health problems caused by a sedentary lifestyle.',
      source: 'Canadian Space Agency, Why do we conduct science experiments in space? (page modified 2025-10-28)',
      url: 'https://www.asc-csa.gc.ca/eng/iss/science/why-do-we-conduct-science-experiments-in-space.asp'
    },

    // ---- NASA standards and statements -------------------------------------
    {
      id: 'V1', topic: 'muscle', status: 'verified', level: 'official-document',
      claim: 'NASA requires in-mission skeletal muscle strength to stay at or above 80% of baseline.',
      values: { minStrengthFraction: 0.80 },
      quote: '[V1 4024] Countermeasures shall maintain in-mission skeletal muscle strength at or above 80% of baseline values.',
      source: 'NASA OCHMO-TB-031, Exercise Overview (2023), quoting NASA-STD-3001 Vol. 1 Rev C',
      url: 'https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-031-exercise-overview.pdf'
    },
    {
      id: 'V2', topic: 'muscle', status: 'verified', level: 'official-document',
      claim: 'In 2019 NASA stated that muscle strength could not be assessed in flight.',
      values: {},
      quote: 'The ability to assess muscle strength in-flight does not currently exist',
      source: 'Downs ME (NASA H-3PO). Approach to Astronaut Fitness Standard Recommendations for ISS and Exploration Mission Tasks. 2019. NTRS 20190025092',
      url: 'https://ntrs.nasa.gov/citations/20190025092'
    },
    {
      id: 'V3', topic: 'muscle', status: 'verified', level: 'official-document',
      claim: 'NASA post-flight reconditioning lasts 45 days; functional fitness is assessed at L-60, R+7 and R+30.',
      values: { reconditioningDays: 45, hoursPerDay: 2 },
      quote: 'Reconditioning program lasts 45 days starting R+1 ... Pre-flight baseline performed at L-60 ... Post-flight performed at R+7 and R+30',
      source: 'NASA OCHMO-TB-031, Exercise Overview (2023)',
      url: 'https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-031-exercise-overview.pdf'
    },
    {
      id: 'V21', topic: 'radiation', status: 'verified', level: 'official-document',
      claim: 'NASA career effective dose limit is 600 mSv.',
      values: { careerLimitMSv: 600 },
      quote: "[V1 4030] An individual astronaut's total career effective radiation dose due to space flight radiation exposure shall be less than 600 mSv. This limit is universal for all ages and sexes.",
      source: 'NASA OCHMO, NASA-STD-3001 Technical Brief: Radiation Protection',
      url: 'https://www.nasa.gov/wp-content/uploads/2023/03/radiation-protection-technical-brief-ochmo.pdf'
    },
    {
      id: 'V37', topic: 'radiation', status: 'verified', level: 'official-document',
      claim: 'NASA guidance: surround crew with about 20 g/cm2 of hydrogen-rich shielding.',
      values: { shieldingGPerCm2: 20 },
      quote: 'Habitat designers should strive to surround astronauts with 20 g/cm2 of hydrogen rich shielding for GCR protection ... Adding more than 20 g/cm2 is not helpful, unless you are adding meters of material.',
      source: 'Clowdsley M (NASA LaRC). Lunar radiation talk. 2021. NTRS 20210009760',
      url: 'https://ntrs.nasa.gov/citations/20210009760'
    },

    // ---- Muscle loss: human bed rest and spaceflight -------------------------
    {
      id: 'V4', topic: 'muscle', status: 'verified', level: 'abstract',
      claim: '60 days of head-down bed rest in women: calf volume -29% without countermeasure, -8% with exercise; thigh -21% without, maintained with exercise. A leucine-enriched high-protein diet did not help.',
      values: {
        days: 60, n: 24,
        calfControlPct: -29, calfExercisePct: -8, calfNutritionPct: -28,
        thighControlPct: -21, thighExercisePct: 0, thighNutritionPct: -24
      },
      quote: 'Calf (triceps surae) muscle volume was decreased ... in BR (-29 +/- 1%) and BRN (-28 +/- 1%), and this decrease was attenuated (P < 0.05) in BRE (-8 +/- 2%). ... The nutrition countermeasure was not effective in offsetting lower limb muscle volume or strength loss, and actually promoted thigh muscle volume loss.',
      source: 'Trappe TA et al. Acta Physiol 2007;191:147-159 (WISE-2005 bed rest). PMID 17655736',
      url: 'https://pubmed.ncbi.nlm.nih.gov/17655736/'
    },
    {
      id: 'V5', topic: 'muscle', status: 'verified', level: 'abstract',
      claim: 'Six months on the ISS with exercise: calf muscle volume -13 +/- 2%, peak power -32% (n = 9).',
      values: { days: 180, n: 9, calfVolumePct: -13, calfVolumeSd: 2, soleusPct: -15, gastrocnemiusPct: -10, peakPowerPct: -32 },
      quote: 'Calf muscle volume decreased (P < 0.05) 13 +/- 2% with greater (P < 0.05) atrophy of the soleus (-15 +/- 2%) compared with the gastrocnemius (-10 +/- 2%). Peak power was 32% lower (P < 0.05) after spaceflight.',
      source: 'Trappe S et al. J Appl Physiol 2009;106:1159-1168. PMID 19150852',
      url: 'https://doi.org/10.1152/japplphysiol.91578.2008'
    },
    {
      id: 'V6', topic: 'muscle', status: 'verified', level: 'abstract',
      claim: 'Mice on the JAXA centrifuge aboard the ISS (a University of Tsukuba-led study with JAXA): 0.33 g preserved soleus cross-sectional area and 0.67 g was sufficient to maintain muscle function. Only these two partial-gravity levels were tested. Grip strength and EIM were among the functional measures.',
      values: { csaPreservedAtG: 0.33, functionSufficientAtG: 0.67 },
      quote: 'In the gravity-sensitive soleus, the cross-sectional area was preserved at 0.33g ... Functional measures, including forelimb grip strength and electrical impedance myography, indicated that 0.67g was sufficient to maintain muscle performance.',
      source: 'Tsuji R et al. Sci Adv 2026;12(11):eaed2258. PMID 41824581',
      url: 'https://doi.org/10.1126/sciadv.aed2258'
    },
    {
      id: 'V13', topic: 'mission', status: 'verified', level: 'official-document',
      claim: 'Apollo 17 stayed 75 hours on the lunar surface.',
      values: { surfaceStayHours: 75 },
      quote: 'Lunar surface-stay time was 75 hours, and lunar orbit time 17 hours.',
      source: 'NASA, Apollo 17 Mission Details',
      url: 'https://www.nasa.gov/missions/apollo/apollo-17-mission-details/'
    },
    {
      id: 'V14', topic: 'mission', status: 'verified', level: 'official-document',
      claim: 'Surface gravity: Moon 1.62 m/s2 (0.165 of Earth); Mars 3.73 m/s2 (0.380 of Earth).',
      values: { moonMs2: 1.62, moonRatio: 0.165, marsMs2: 3.73, marsRatio: 0.380 },
      quote: 'Surface gravity (m/s2) 1.62 9.80 0.165 (Moon); Surface gravity (mean) (m/s2) 3.73 9.82 0.380 (Mars)',
      source: 'NASA NSSDC Moon Fact Sheet and Mars Fact Sheet',
      url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html'
    },
    {
      id: 'V40', topic: 'muscle', status: 'verified', level: 'dataset-record',
      claim: 'A separate JAXA mouse mission at one-sixth g (Hayashi et al., Commun Biol 2023; NASA OSDR dataset OSD-714): lunar gravity prevented soleus atrophy but not the fibre-type shift. The OSDR record holds RNA-seq files only, with no muscle-mass, grip or impedance files, so MyoTwin cites it and does not compute from it.',
      values: {},
      quote: 'Lunar gravity prevents skeletal muscle atrophy but not myofiber type shift in mice',
      source: 'NASA Open Science Data Repository, OSD-714 (study title); Hayashi T et al. Commun Biol 2023, doi 10.1038/s42003-023-04769-3',
      url: 'https://osdr.nasa.gov/bio/repo/data/studies/OSD-714'
    },

    // ---- Electrical impedance myography (EIM) --------------------------------
    {
      id: 'V8', topic: 'eim', status: 'verified', level: 'full-text',
      claim: 'Human disuse: after 10-59 days in a cast, 50 kHz EIM phase of the tibialis anterior (shin) was 6.64 deg in the casted leg versus 9.46 deg in the other leg (28.4% lower), and rose to 9.37 deg after the cast came off (n = 10). A comparison between legs, not before and after.',
      values: { n: 10, castedPhaseDeg: 6.64, uncastedPhaseDeg: 9.46, differencePct: -28.4, recoveredPhaseDeg: 9.37, castDaysMin: 10, castDaysMax: 59 },
      quote: 'The mean theta in the casted legs was 6.64 while the mean theta in the uncasted legs was 9.46, a mean side-to-side difference of 28.4% (p<0.01).',
      source: 'Tarulli AW et al. Arch Phys Med Rehabil 2009;90:1806-1810. PMCID PMC2829834',
      url: 'https://doi.org/10.1016/j.apmr.2009.04.007'
    },
    {
      id: 'V9', topic: 'eim', status: 'verified', level: 'abstract',
      claim: 'EIM phase declines with age in 100 healthy people aged 18-90, more steeply after 60. The authors call EIM an effort-independent test of muscle health in the elderly.',
      values: { n: 100, ageMin: 18, ageMax: 90 },
      quote: 'The principal EIM parameter, the spatially averaged phase theta(avg), shows a roughly quadratic reduction with increasing age, declining more steeply beyond 60 years.',
      source: 'Aaron R et al. Physiol Meas 2006;27:953-959. PMID 16951455',
      url: 'https://doi.org/10.1088/0967-3334/27/10/002'
    },
    {
      id: 'V10', topic: 'eim', status: 'verified', level: 'abstract',
      claim: 'Operator-applied 50 kHz EIM in 30 people, measured on biceps, quadriceps and tibialis anterior and repeated within 250 days: test-retest ICC 0.938-0.971; variability 4.2% on average, 16.8% at most. Not measured on the calf, and not night to night.',
      values: { n: 30, iccMin: 0.938, iccMax: 0.971, meanVariabilityPct: 4.2, maxVariabilityPct: 16.8 },
      quote: 'Variability between measurements was on average 4.2% for all muscle combined, with an upper limit of 16.8%.',
      source: 'Rutkove SB et al. Clin Neurophysiol 2006;117:1244-1248. PMID 16644269',
      url: 'https://doi.org/10.1016/j.clinph.2005.12.029'
    },
    {
      id: 'V7', topic: 'eim', status: 'verified', level: 'abstract',
      claim: 'Rats in a hindlimb-suspension analogue: EIM phase-slope fell from 14.60 to 11.03 to 10.13 deg/MHz at days 0, 7 and 14. The authors propose EIM as a biomarker under micro- and partial gravity.',
      values: { phaseSlopeDay0: 14.60, phaseSlopeDay7: 11.03, phaseSlopeDay14: 10.13 },
      quote: 'EIM has the potential to serve as biomarker of muscle deconditioning during exposure to both micro- and partial- gravity during future human space exploration.',
      source: 'Semple C et al. Front Physiol 2020;11:557796. PMID 33041858',
      url: 'https://doi.org/10.3389/fphys.2020.557796'
    },
    {
      id: 'V28', topic: 'eim', status: 'verified', level: 'abstract',
      claim: 'Bioimpedance of the legs keeps drifting after lying down: no steady state within 30 minutes; time constant about 36 minutes for extracellular volume. (Measured with BIA, not EIM.)',
      values: { legEcvChangePct: -10.96, ecvTimeConstantMin: 36.4, noSteadyStateWithinMin: 30 },
      quote: 'The ECV and ICV data changed significantly during all three periods, that is, a steady state could not be reached within 30 minutes.',
      source: 'Scharfetter H et al. Kidney Int 1997;51:1078; Zhu F et al. J Appl Physiol 1998;85:497. PMIDs 9083273, 9688726',
      url: 'https://pubmed.ncbi.nlm.nih.gov/9688726/'
    },
    {
      id: 'V30', topic: 'eim', status: 'verified', level: 'abstract',
      claim: 'Textile electrodes strapped to the leg matched gel electrodes for multi-frequency bioimpedance. A capacitive bioimpedance mattress prototype exists but is motion-sensitive. We found no study of dry-electrode or bed-integrated EIM, and no human EIM data from space or bed rest.',
      values: {},
      quote: 'wearable textile electrodes can be a viable substitute for gel electrodes when monitoring leg MFBIA in dynamic, uncontrolled settings.',
      source: 'Nichols CJ et al. IEEE Trans Biomed Eng 2023;70:2679 (PMID 37027282); Castro ID et al. IEEE EMBC 2019:5621 (PMID 31947128)',
      url: 'https://pubmed.ncbi.nlm.nih.gov/37027282/'
    },
    {
      id: 'V26', topic: 'eim', status: 'verified', level: 'manufacturer-document',
      claim: 'Bioimpedance device instructions list electronic implants such as pacemakers as a contraindication. Clinical studies of clinical-grade devices found no interference; consumer devices interfered on the bench.',
      values: {},
      quote: 'Bioimpedance measurements may not be performed on individuals exhibiting the following characteristics: Electronic implants, e.g. cardiac pacemakers',
      source: 'seca mBCA 525 instructions for use (2024); Chabin X et al. Clin Nutr 2019;38:806; Ha et al. Heart Rhythm 2023;20:561',
      url: 'https://www.seca.com/fileadmin/documents/manual/seca_man_mBCA_Go_525c_en.pdf'
    },

    // ---- Sleep and radar ------------------------------------------------------
    {
      id: 'V11', topic: 'sleep', status: 'verified', level: 'abstract',
      claim: 'ISS crew slept 6.09 h per night on average during missions, measured by wrist actigraphy in 21 astronauts; 12 of 16 reported using sleep-promoting drugs.',
      values: { issSleepHours: 6.09, issSleepSd: 0.67, hypnoticUsers: 12, hypnoticOf: 16 },
      quote: 'Crew members on ISS missions obtained significantly less sleep during spaceflight (6.09 h [0.67]) ... 12 (75%) of 16 ISS crew members reported using sleep-promoting drugs.',
      source: 'Barger LK et al. Lancet Neurol 2014;13:904-912. PMID 25127232',
      url: 'https://doi.org/10.1016/S1474-4422(14)70122-X'
    },
    {
      id: 'V18', topic: 'sleep', status: 'verified', level: 'full-text',
      claim: 'Barger et al. report that NASA regulations mandate 8.5 hours of protected time for sleep each night, citing the ISS Generic Groundrules, Requirements and Constraints. The NASA rule document itself was not opened.',
      values: { protectedSleepHours: 8.5 },
      quote: 'sleep deficiency is pervasive among crewmembers despite NASA regulations that mandate 8.5 hours of protected time for sleep each night',
      source: 'Barger LK et al. Lancet Neurol 2014;13:904-912, full text. PMCID PMC4188436',
      url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4188436/'
    },
    {
      id: 'V42', topic: 'sleep', status: 'verified', level: 'official-document',
      claim: 'On the ISS the sleeping bag restrains the crew member to the wall of the crew quarters, so the body does not rest on a surface.',
      values: {},
      quote: 'The sleeping bags provide a soft and warm environment and also serve to safely restrain the crew member to the wall of their CQ.',
      source: 'NASA, Improvements to On-Orbit Sleeping Accommodations, NTRS 20190027189 (2019)',
      url: 'https://ntrs.nasa.gov/citations/20190027189'
    },
    {
      id: 'V25', topic: 'sleep', status: 'verified', level: 'consensus-statement',
      claim: 'Adults aged 18 to 60 should sleep 7 or more hours per night.',
      values: { minSleepHours: 7, ageMin: 18, ageMax: 60 },
      quote: 'Adults should sleep 7 or more hours per night on a regular basis to promote optimal health.',
      source: 'Watson NF et al. Sleep 2015;38:843-844 (AASM and Sleep Research Society consensus). PMCID PMC4434546',
      url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4434546/'
    },
    {
      id: 'V23', topic: 'radar', status: 'verified', level: 'full-text',
      claim: 'Systematic review of radar vital-sign monitoring: with a 10% tolerated deviation, 85% (respiration) and 87% (heart rate) of studies qualified; with 5%, 37% and 48%.',
      values: { rrWithin5Pct: 37, hrWithin5Pct: 48, rrWithin10Pct: 85, hrWithin10Pct: 87 },
      quote: 'In 37% of the included studies on the measurement of the respiratory rate and in 48% of those on the measurement of the heart rate, the maximum deviation was 5%. For a tolerated deviation of 10%, the corresponding percentages were 85% and 87%',
      source: 'Liebetruth M et al. Sensors 2024;24:1003. PMCID PMC10857015',
      url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC10857015/'
    },
    {
      id: 'V24', topic: 'radar', status: 'verified', level: 'full-text',
      claim: 'A 60 GHz FMCW radar used during polysomnography (n = 44) agreed with the apnea-hypopnea index at ICC 0.776-0.812 on its own, and 0.916-0.929 only when the sleep status came from polysomnography. The authors state that the radar alone cannot distinguish the sleep status.',
      values: { n: 44, iccRadarAloneMin: 0.776, iccRadarAloneMax: 0.812, iccWithPsgSleepMin: 0.916, iccWithPsgSleepMax: 0.929 },
      quote: null,
      source: 'Choi JW et al. Sensors 2022;22:7177. PMCID PMC9570824 (values checked in the full text twice; no sentence copied)',
      url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC9570824/'
    },
    {
      id: 'V27', topic: 'radar', status: 'verified', level: 'guideline',
      claim: '60 GHz exposure: the ICNIRP 2020 general-public limit is 20 W/m2 local absorbed power density; penetration into skin is about 0.49 mm; a typical radar chip transmits at 12 dBm.',
      values: { limitWPerM2: 20, skinPenetrationMm: 0.49, txPowerDbm: 12 },
      quote: 'Local Sab is to be averaged over a square 4-cm2 surface area of the body.',
      source: 'ICNIRP. Health Phys 2020;118:483 (Tables 2 and 10); Texas Instruments IWR6843 datasheet SWRS219',
      url: 'https://www.icnirp.org/cms/upload/publications/ICNIRPrfgdl2020.pdf'
    },
    {
      id: 'V39', topic: 'radar', status: 'verified', level: 'full-text',
      claim: 'We found no test of radar vital-sign monitoring in space. The closest work is a design study of UWB radar for sensing breathing in the ISS crew quarters, validated by simulation and ground tests.',
      values: {},
      quote: 'Both the EM and signal processing approaches have been validated through laboratory experiments in order to assess the reliability of the simulation tools',
      source: 'Baldi M et al. Sensors 2015;15(1):565-591. PMCID PMC4327036',
      url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4327036/'
    },

    // ---- Radiation environment ------------------------------------------------
    {
      id: 'V12', topic: 'radiation', status: 'verified', level: 'full-text',
      claim: 'Lunar surface (Chang\'E-4 LND): absorbed dose rate 13.2 +/- 1 uGy/h in silicon; dose equivalent 1369 uSv/day.',
      values: { doseRateUGyPerH: 13.2, doseRateSd: 1, neutralUGyPerH: 3.1, doseEquivalentUSvPerDay: 1369, chargedDoseEquivalentUSvPerH: 57.1 },
      quote: 'We measured an average total absorbed dose rate in silicon of 13.2 +/- 1 uGy/hour and a neutral particle dose rate of 3.1 +/- 0.5 uGy/hour. ... LND measured an average dose equivalent of 1369 uSv/day on the surface of the Moon.',
      source: 'Zhang S et al. Sci Adv 2020;6:eaaz1334. PMCID PMC7518862',
      url: 'https://doi.org/10.1126/sciadv.aaz1334'
    },
    {
      id: 'V15', topic: 'radiation', status: 'verified', level: 'press-release',
      claim: 'Mars surface (MSL/RAD): average GCR dose equivalent rate 0.67 mSv/day, August 2012 to June 2013.',
      values: { doseEquivalentMSvPerDay: 0.67 },
      quote: 'The RAD surface radiation data show an average GCR dose equivalent rate of 0.67 millisieverts per day from August 2012 to June 2013 on the Martian surface',
      source: 'Southwest Research Institute press release quoting D. Hassler (2013), on Hassler et al., Science 2014',
      url: 'https://www.swri.org/press-release/swri-scientists-publish-first-radiation-measurements-surface-mars'
    },
    {
      id: 'V16', topic: 'radiation', status: 'verified', level: 'dataset-record',
      claim: 'Mars surface, the first of 45 MSL/RAD observations on sol 90: 8.60 uGy/h in detector B (silicon) and 8.38 uGy/h in detector E (tissue-equivalent plastic). The mean of detector B over that sol was 8.89 uGy/h. The detector descriptions were not checked against the instrument documentation.',
      values: { doseRateSiUGyPerH: 8.60, doseRateTissueUGyPerH: 8.38, sol: 90 },
      quote: null,
      source: 'NASA Planetary Data System, MSL-M-RAD-3-RDR-V1.0, sol 90 (2012-311), observation 00, fields DOSIMETRY_TOTAL_DOSE_B and _E',
      url: 'https://pds-ppi.igpp.ucla.edu/data/MSL-M-RAD-3-RDR-V1.0/'
    },
    {
      id: 'V17', topic: 'radiation', status: 'verified', level: 'full-text',
      claim: 'Timepix-based Radiation Environment Monitors have flown on the ISS since 16 October 2012; the direction of each particle track can be reconstructed. The Timepix-based HERA flew on Artemis I.',
      values: { remDeployed: '2012-10-16', remUnitsInitial: 5 },
      quote: 'On 16 October 2012, five active radiation detectors (referred to by NASA as Radiation Environment Monitors, or REMs) employing the Timepix version of the technology ... were deployed on-board the International Space Station',
      source: 'Pinsky L et al. J Radiat Res 2014 (PMC3941488); Kroupa M et al., NTRS 20140005861; George S, NTRS 20230008985',
      url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC3941488/'
    },
    {
      id: 'V19', topic: 'radiation', status: 'verified', level: 'official-document',
      claim: 'Polyethylene shielding was added to the ISS crew quarters, where crew sleep.',
      values: {},
      quote: 'strategic placement of polyethylene augmentation (also TRL9) in crew quarters has helped in reducing exposures',
      source: 'Wilson JW et al., NTRS 20040139603; ISS Radiation Shielding Model Development, NTRS 20040121166',
      url: 'https://ntrs.nasa.gov/citations/20040139603'
    },
    {
      id: 'V22', topic: 'radiation', status: 'verified', level: 'dataset-record',
      claim: 'September 2017 solar particle event: the east-facing GOES-15 >10 MeV proton channel peaked at 1071.8 pfu on 2017-09-11 01:00 UTC; the west-facing channel peaked at 1333.2 pfu at 11:40 UTC (5-minute data). Not used in the code.',
      values: { peakPfuEast: 1071.8, peakTimeEast: '2017-09-11T01:00Z', peakPfuWest: 1333.2 },
      quote: null,
      source: 'NOAA NCEI, GOES-15 EPEAD corrected proton flux, 5-minute averages, September 2017',
      url: 'https://www.ncei.noaa.gov/data/goes-space-environment-monitor/access/avg/2017/09/goes15/csv/g15_epead_cpflux_5m_20170901_20170930.csv'
    },

    // ---- Cosmic-ray scattering image -----------------------------------------
    {
      id: 'V31', topic: 'imaging', status: 'verified', level: 'reference-table',
      claim: 'Radiation lengths: water 36.08 cm, skeletal muscle 35.14 cm, adipose tissue 45.36 cm, compact bone 16.48 cm, cortical bone 14.82 cm. Densities: muscle 1.040 g/cm3, compact bone 1.850 g/cm3.',
      values: { waterCm: 36.08, muscleCm: 35.14, adiposeCm: 45.36, compactBoneCm: 16.48, corticalBoneCm: 14.82, muscleDensityGPerCm3: 1.040, compactBoneDensityGPerCm3: 1.850 },
      quote: null,
      source: 'Particle Data Group, Atomic and Nuclear Properties of Materials (2024)',
      url: 'https://pdg.lbl.gov/2024/AtomicNuclearProperties/'
    },
    {
      id: 'V32', topic: 'imaging', status: 'verified', level: 'reference-table',
      claim: 'Highland formula for the RMS multiple-scattering angle: theta0 = (13.6 MeV / (beta c p)) z sqrt(x/X0) [1 + 0.038 ln(x z^2 / (X0 beta^2))], accurate to 11% or better.',
      values: { constantMeV: 13.6, logCoefficient: 0.038, accuracyPct: 11 },
      quote: 'is accurate to 11% or better for 10^-3 < x/X0 < 100',
      source: 'Particle Data Group, Passage of Particles Through Matter (the accuracy sentence is in the 2014 edition; the formula is unchanged in 2024)',
      url: 'https://pdg.lbl.gov/2014/reviews/rpp2014-rev-passage-particles-matter.pdf'
    },
    {
      id: 'V33', topic: 'imaging', status: 'secondary', level: 'secondary-citation',
      claim: 'Free-space galactic-cosmic-ray proton flux varies from 1.5 to 5.0 particles/cm2/s (4 pi) over the solar cycle.',
      values: { fluxMinPerCm2S: 1.5, fluxMaxPerCm2S: 5.0 },
      quote: 'integral 4pi-steradian flux of galactic cosmic ray ("GCR") protons varies from 1.5 to 5.0 particles/cm2/s over the course of the 11-year solar cycle (McKinney et al. 2006)',
      source: 'arXiv:1609.09442 (2016), citing McKinney et al. 2006; the original was not opened',
      url: 'https://arxiv.org/abs/1609.09442'
    },
    {
      id: 'V34', topic: 'imaging', status: 'verified', level: 'reference-table',
      claim: 'Sea-level cosmic-ray muons: about 70 per m2 per second per steradian vertically; about 1 per cm2 per minute through a horizontal detector.',
      values: { verticalPerM2SSr: 70, horizontalPerCm2Min: 1 },
      quote: 'The integral intensity of vertical muons above 1 GeV/c at sea level is ~ 70 m^-2 s^-1 sr^-1 ... I ~ 1 cm^-2 min^-1 for horizontal detectors.',
      source: 'Particle Data Group, Cosmic Rays review (2022)',
      url: 'https://pdg.lbl.gov/2022/reviews/rpp2022-rev-cosmic-rays.pdf'
    },
    {
      id: 'V35', topic: 'imaging', status: 'verified', level: 'preprint',
      claim: 'Sea-level cosmic-ray muons have been used to image an anthropomorphic phantom: a 24-hour exposure with signal to background of about 1:1.',
      values: { exposureHours: 24 },
      quote: 'A 24-hour exposure was sufficient ... the signal to background was ~1:1.',
      source: 'Morris CL et al. arXiv:2106.01542; J Appl Phys 2025, doi 10.1063/5.0253548',
      url: 'https://arxiv.org/abs/2106.01542'
    },
    {
      id: 'V36', topic: 'imaging', status: 'verified', level: 'full-text',
      claim: 'Large silicon-strip trackers already fly in space: Fermi LAT has 16 towers of 18 x/y planes with 228 um strip pitch.',
      values: { stripPitchUm: 228 },
      quote: '384 56-um wide aluminum readout strips spaced at 228 um pitch',
      source: 'Atwood WB et al. Astrophys J 2009;697:1071. arXiv:0902.1089',
      url: 'https://arxiv.org/abs/0902.1089'
    },
    {
      id: 'V38', topic: 'imaging', status: 'verified', level: 'preprint',
      claim: 'A 2026 study with an accelerator muon beam and a thorax phantom argues that the natural muon flux on Earth is too low for medical imaging.',
      values: {},
      quote: 'The natural cosmic-ray muon flux is far too low for practical medical imaging',
      source: 'Banerjee et al. arXiv:2610.16647 (2026)',
      url: 'https://arxiv.org/abs/2610.16647'
    },

    // ---- Countermeasures under study -----------------------------------------
    {
      id: 'V41', topic: 'countermeasure', status: 'secondary', level: 'secondary-citation',
      claim: 'Neuromuscular electrical stimulation and blood-flow-restricted exercise have been proposed for spaceflight, but we found no published in-flight results.',
      values: {},
      quote: null,
      source: 'Axiom Space, Muscle Stimulation research page (ESA study, ongoing); Hackney KJ et al. Extrem Physiol Med 2012 (PMC3710201). Read as search summaries only',
      url: 'https://www.axiomspace.com/research/muscle-stimulation'
    }
  ];

  var byId = {};
  ITEMS.forEach(function (it) { byId[it.id] = it; });

  var api = {
    items: ITEMS,
    /** Return one evidence entry; throws when the id is unknown. */
    get: function (id) {
      if (!byId[id]) throw new Error('Unknown evidence id: ' + id);
      return byId[id];
    },
    /** Return one named number from an entry; throws when either is missing. */
    value: function (id, key) {
      var it = api.get(id);
      if (!(key in it.values)) throw new Error('Evidence ' + id + ' has no value "' + key + '"');
      return it.values[key];
    }
  };

  ns.evidence = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
