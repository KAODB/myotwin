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

    // ---- NASA pages linked from the challenge resources ----------------------
    // The hazard, risk and research pages that the three NASA resources link to.
    // Quotes are in page order; " ... " marks text left out between sentences.
    {
      id: 'V48', topic: 'linked from the challenge resources', status: 'verified', level: 'agency-web-page',
      claim: "On the ISS, average losses of strength and aerobic fitness are 10-12% of pre-mission levels, and between 12% and 38% of crew members lose more than 20%. Crews exercise 1.5 hours a day; spacecraft bound for the Moon and Mars will likely have less room for exercise equipment.",
      values: { avgLossPctLow: 10, avgLossPctHigh: 12, crewOver20PctLow: 12, crewOver20PctHigh: 38, lossLinePct: 20, exerciseHoursPerDay: 1.5, says: "Depending on how it’s measured, between 12-38% of space station crew members lose more than 20% of their pre-mission fitness.", canBeDone: "Six to seven days a week, astronauts on the International Space Station perform resistance training and aerobic exercises for 1.5 hours per day to maintain their fitness and protect against muscle and bone loss." },
      quote: "Six to seven days a week, astronauts on the International Space Station perform resistance training and aerobic exercises for 1.5 hours per day to maintain their fitness and protect against muscle and bone loss. ... Crew members also undergo periodic fitness self-evaluations to help researchers monitor their health and fitness and to optimize the astronauts’ training regimen. ... Spacecraft set to carry astronauts to the Moon and Mars, however, will likely have less space for exercise equipment. ... However, data from International Space Station missions indicates that average losses to strength and aerobic fitness are 10-12% of pre-mission levels. ... Depending on how it’s measured, between 12-38% of space station crew members lose more than 20% of their pre-mission fitness.",
      source: "NASA, Risk of Reduced Cardiorespiratory and Musculoskeletal Fitness (linked from Risks of Human Spaceflight)",
      url: 'https://www.nasa.gov/reference/risk-of-reduced-cardiorespiratory-and-musculoskeletal-fitness/'
    },
    {
      id: 'V49', topic: 'linked from the challenge resources', status: 'verified', level: 'agency-web-page',
      claim: "NASA names work overload, irregular light-dark cycles and sleep-pattern disruptions as stressors of spaceflight. On the ISS, LED lighting simulates Earth's light-dark cycle, and crews are given designated time for relaxation and self-care.",
      values: { says: "Astronauts are exposed to numerous stressors during spaceflight, such as work overload, irregular light-dark cycles, and sleep-pattern disruptions.", canBeDone: "To help minimize some of the stresses of spaceflight on the International Space Station, light-emitting diodes, or LEDs, simulate Earth’s light-dark cycle to help astronauts sleep better." },
      quote: "Astronauts are exposed to numerous stressors during spaceflight, such as work overload, irregular light-dark cycles, and sleep-pattern disruptions. ... To help minimize some of the stresses of spaceflight on the International Space Station, light-emitting diodes, or LEDs, simulate Earth’s light-dark cycle to help astronauts sleep better. ... Astronauts are also given designated times for relaxation and self-care as part of their routine to help prevent burnout.",
      source: "NASA, Risk from Inadequate Sleep and Irregular Schedules (linked from Risks of Human Spaceflight)",
      url: 'https://www.nasa.gov/reference/risk-from-inadequate-sleep-and-irregular-schedules/'
    },
    {
      id: 'V50', topic: 'linked from the challenge resources', status: 'verified', level: 'agency-web-page',
      claim: "NASA lists blood clots, heart arrhythmias, cardiovascular disease, and low blood pressure with fainting at landing as possible results of low gravity. Regular exercise and a healthy diet help crews maintain cardiovascular fitness.",
      values: { says: "Low-gravity conditions and other spaceflight stressors can alter the heart and blood vessels, potentially leading to blood clots, heart arrythmias, cardiovascular disease, and low blood pressure which elevates the chances of fainting at landing.", canBeDone: "Regular exercise and healthy diets help crews maintain cardiovascular fitness." },
      quote: "Low-gravity conditions and other spaceflight stressors can alter the heart and blood vessels, potentially leading to blood clots, heart arrythmias, cardiovascular disease, and low blood pressure which elevates the chances of fainting at landing. ... Regular exercise and healthy diets help crews maintain cardiovascular fitness. ... For future Mars missions, astronauts will also receive enhanced training to respond to cardiovascular emergencies.",
      source: "NASA, Risk of Cardiovascular Adaptations (linked from Risks of Human Spaceflight)",
      url: 'https://www.nasa.gov/reference/risk-of-cardiovascular-adaptations/'
    },
    {
      id: 'V51', topic: 'linked from the challenge resources', status: 'verified', level: 'agency-web-page',
      claim: "Instruments that measure radiation exposure are in place on the ISS, and NASA is working toward a personal cancer risk assessment for each astronaut based on radiation dose and genetic factors. Missions to the Moon and Mars leave the protection of Earth's magnetosphere.",
      values: { says: "While missions to the space station are entirely within the magnetosphere, missions to the Moon and Mars will extend beyond this protective bubble.", canBeDone: "NASA scientists are working to develop strategies to identify and prevent health complications from space radiation exposure, including best practices for health surveillance as well as medicines to counter the effects of radiation exposures during spaceflight." },
      quote: "NASA scientists are working to develop strategies to identify and prevent health complications from space radiation exposure, including best practices for health surveillance as well as medicines to counter the effects of radiation exposures during spaceflight. In addition, various instruments that measure radiation exposure are in place aboard the International Space Station. Scientists are also conducting tissue research on Earth aimed at developing personalized cancer risk assessments for each astronaut, based on radiation dose and genetic factors. ... While missions to the space station are entirely within the magnetosphere, missions to the Moon and Mars will extend beyond this protective bubble.",
      source: "NASA, Risk of Radiation-Induced Cancers (linked from Risks of Human Spaceflight)",
      url: 'https://www.nasa.gov/reference/risk-of-radiation-induced-cancers/'
    },
    {
      id: 'V52', topic: 'linked from the challenge resources', status: 'verified', level: 'agency-web-page',
      claim: "Isolation and confinement can affect a crew member's sleep, morale and decision making. NASA encourages self-care, including keeping a regular journal.",
      values: { says: "The prolonged isolation and confinement that astronauts face in space can increase risks of behavioral issues and psychiatric disorders, such as anxiety and depression.", canBeDone: "To improve mental health, NASA encourages astronauts to explore self-care options including keeping a regular journal." },
      quote: "The prolonged isolation and confinement that astronauts face in space can increase risks of behavioral issues and psychiatric disorders, such as anxiety and depression. These factors may impact a crew member’s sleep, morale, and decision making ... To improve mental health, NASA encourages astronauts to explore self-care options including keeping a regular journal.",
      source: "NASA, Risk of Behavioral Conditions and Psychiatric Disorders (linked from Risks of Human Spaceflight)",
      url: 'https://www.nasa.gov/reference/risk-of-behavioral-conditions-and-psychiatric-disorders/'
    },
    {
      id: 'V53', topic: 'linked from the challenge resources', status: 'verified', level: 'agency-web-page',
      claim: "On Mars crews will live in about one-third of Earth's gravity and may need time to adjust after landing. In spaceflight, weight-bearing bones lose on average 1% to 1.5% of mineral density per month.",
      values: { boneLossPctPerMonthLow: 1, boneLossPctPerMonthHigh: 1.5 },
      quote: "Astronauts may also need time to adjust to new gravity fields after landing on the Moon or Mars before they conduct mission-critical tasks. ... While living and working on Mars, crews will be in approximately one-third of Earth’s gravity. ... Without the continuous load of Earth’s gravity, weight-bearing bones lose on average 1% to 1.5% of mineral density per month during spaceflight.",
      source: "NASA Human Research Program, Hazard: Gravity Fields (linked from 5 Hazards of Human Spaceflight)",
      url: 'https://www.nasa.gov/hrp/hazard-gravity-fields/'
    },
    {
      id: 'V54', topic: 'linked from the challenge resources', status: 'verified', level: 'agency-web-page',
      claim: "On a Mars mission, with a communication delay of up to 20 minutes one way, astronauts must handle situations, including medical emergencies, with minimal support from Earth.",
      values: { commDelayMinutesOneWay: 20 },
      quote: "Given this distance, planning and self-sufficiency will be essential to successful missions to Mars. ... Facing a communication delay of up to 20 minutes one way, the possibility of equipment failures or medical emergencies, and a critical need to ration food and supplies, astronauts must be capable of confronting an array of situations with minimal support from teams on Earth.",
      source: "NASA Human Research Program, Hazard: Distance From Earth (linked from 5 Hazards of Human Spaceflight)",
      url: 'https://www.nasa.gov/hrp/hazard-distance-from-earth/'
    },
    {
      id: 'V55', topic: 'linked from the challenge resources', status: 'verified', level: 'agency-web-page',
      claim: "Sleep loss, circadian desynchronization and work overload compound isolation and confinement. NASA is developing methods to monitor behavioural health and detect early risk factors, and treats journaling as a tool for assessing mental and emotional states.",
      values: {},
      quote: "Sleep loss, circadian desynchronization, and work overload compound this issue and may lead to decreased performance, adverse health outcomes, and compromised mission objectives. ... To address this hazard, experts are developing methods for monitoring behavioral health and adapting/refining various tools and technologies for use in the spaceflight environment to detect and treat early risk factors. ... Journaling will always play an important role in any journey. It’s an invaluable tool behavioral scientists use to assess the mental and emotional states associated with life in long-term isolation and confinement.",
      source: "NASA Human Research Program, Hazard: Isolation and Confinement (linked from 5 Hazards of Human Spaceflight)",
      url: 'https://www.nasa.gov/hrp/hazard-isolation-and-confinement/'
    },
    {
      id: 'V56', topic: 'linked from the challenge resources', status: 'verified', level: 'agency-web-page',
      claim: "Galactic cosmic rays and solar particle events cannot be seen or felt. NASA continuously monitors space radiation and astronauts' radiation exposure.",
      values: {},
      quote: "High-energy galactic cosmic rays, which are remnants from supernovas, and solar storms like solar particle events and coronal mass ejections can harm the body and spacecraft. ... When astronauts travel in space, they can’t see or even feel radiation. ... NASA follows specific procedures to continuously monitor space radiation and astronauts' radiation exposure.",
      source: "NASA Human Research Program, Hazard: Space Radiation (linked from 5 Hazards of Human Spaceflight)",
      url: 'https://www.nasa.gov/hrp/hazard-space-radiation/'
    },
    {
      id: 'V57', topic: 'linked from the challenge resources', status: 'verified', level: 'agency-web-page',
      claim: "ARCHeR (Artemis Research for Crew Health & Readiness) collects actigraphy during the mission, and behavioural performance surveys before and after it, to measure well-being, activity and sleep.",
      values: {},
      quote: "Data will be collected using actigraphy and behavioral performance surveys before and after the mission. Actigraphy data will also be collected during the mission.",
      source: "NASA, ARCHeR (linked from Ongoing HRP Research in Space)",
      url: 'https://www.nasa.gov/reference/archer/'
    },
    {
      id: 'V58', topic: 'linked from the challenge resources', status: 'verified', level: 'agency-web-page',
      claim: "NASA is testing a commercial telemedicine device because, as communication delays grow on missions to Mars, crews may benefit from medical devices that are lightweight, compact, energy efficient and versatile.",
      values: {},
      quote: "As missions extend to Mars and beyond, communication delays will become more significant. Crews may benefit from medical devices that are lightweight, compact, energy efficient, and versatile.",
      source: "NASA, Tempus Pro (linked from Ongoing HRP Research in Space)",
      url: 'https://www.nasa.gov/reference/tempus-pro/'
    },
    {
      id: 'V59', topic: 'linked from the challenge resources', status: 'verified', level: 'agency-web-page',
      claim: "Spaceflight Standard Measures has collected a standardized set of measurements from more than 30 astronauts since 2018, and a new branch extends it to Artemis II.",
      values: { astronautsMoreThan: 30, startYear: 2018 },
      quote: "It will similarly collect a standardized set of measurements spanning multiple physiological systems to provide a comprehensive snapshot of how spaceflight affects the human body. ... The Spaceflight Standard Measures experiment, which began in 2018, has collected a comprehensive suite of data from more than 30 astronauts completing missions in low Earth orbit aboard the space station.",
      source: "NASA, Artemis II Standard Measures (linked from Ongoing HRP Research in Space)",
      url: 'https://www.nasa.gov/reference/artemis-ii-standard-measures/'
    },

    // ---- NASA risk ratings, requirements and research records -----------------
    // Human Research Roadmap rating tables (read on 2026-11-14), NASA-STD-3001
    // requirements, OCHMO technical briefs, evidence reports and Task Book records.
    {
      id: 'V70', topic: 'nasa ratings and requirements', status: 'verified', level: 'official-database',
      claim: "NASA's Human Research Roadmap rates the risk \"Muscle and aerobic fitness\" 5x3 for operations on a long lunar-surface mission (Requires Mitigation) and 5x4 on a Mars planetary mission (Requires Mitigation). Likelihood by consequence; read from the rating table.",
      values: { card: "muscle", risk: "Risk of Mission Performance Decrements and Adverse Health Outcomes Resulting from Reduced Cardiorespiratory and Musculoskeletal Fitness", lunarSurfaceLongOps: "5x3", lunarSurfaceLongOpsDisposition: "Requires Mitigation", lunarSurfaceLongHealth: "5x2", lunarSurfaceLongHealthDisposition: "Requires Characterization", marsPlanetaryOps: "5x4", marsPlanetaryOpsDisposition: "Requires Mitigation", marsPlanetaryHealth: "5x3", marsPlanetaryHealthDisposition: "Requires Mitigation", lastPublished: "05/13/25", gapId: "MA-201", gapText: "Determine the required exercise countermeasure or countermeasures (i.e., modality or modalities, prescription, monitoring) to protect mission-specific task performance and crew health outcomes.", gap2Id: "MA-101", gap2Text: "Characterize the effects of the spaceflight environment, including reduced gravity (i.e., weightlessness, partial gravity), countermeasures, and individual variability, on physiological and functional measures of muscular and cardio-respiratory fitness and performance." },
      quote: "The HSRB's LxC and risk dispositions for the two standalone risks are identical and are represented above for reference (approved by HSRB in 4/2024). ... Determine the required exercise countermeasure or countermeasures (i.e., modality or modalities, prescription, monitoring) to protect mission-specific task performance and crew health outcomes. ... Characterize the effects of the spaceflight environment, including reduced gravity (i.e., weightlessness, partial gravity), countermeasures, and individual variability, on physiological and functional measures of muscular and cardio-respiratory fitness and performance.",
      source: "NASA Human Research Roadmap, Risk of Mission Performance Decrements and Adverse Health Outcomes Resulting from Reduced Cardiorespiratory and Musculoskeletal Fitness (risk page 180)",
      url: 'https://humanresearchroadmap.nasa.gov/Risks/?i=180'
    },
    {
      id: 'V71', topic: 'nasa ratings and requirements', status: 'verified', level: 'official-database',
      claim: "NASA's Human Research Roadmap rates the risk \"Sleep loss, circadian desynchronization and work overload\" 5x2 for operations on a long lunar-surface mission (Requires Characterization) and 5x2 on a Mars planetary mission (Requires Mitigation). Likelihood by consequence; read from the rating table.",
      values: { card: "sleep", risk: "Risk of Performance Decrements and Adverse Health Outcomes Resulting from Sleep Loss, Circadian Desynchronization, and Work Overload", lunarSurfaceLongOps: "5x2", lunarSurfaceLongOpsDisposition: "Requires Characterization", lunarSurfaceLongHealth: "3x1", lunarSurfaceLongHealthDisposition: "Accepted with Monitoring", marsPlanetaryOps: "5x2", marsPlanetaryOpsDisposition: "Requires Mitigation", marsPlanetaryHealth: "4x2", marsPlanetaryHealthDisposition: "Requires Mitigation", lastPublished: "05/13/25", gapId: "Sleep-102", gapText: "We need to identify and develop an integrated, individualized suite of scheduling tools that predict the effects of sleep-wake cycles and light on performance, with validated countermeasures and on-board systems to monitor, prevent and/or treat chronic partial sleep loss, work overload, and/or circadian shifting in spaceflight." },
      quote: "The information above was last approved by the Human System Risk Board in 3/2022. ... We need to identify and develop an integrated, individualized suite of scheduling tools that predict the effects of sleep-wake cycles and light on performance, with validated countermeasures and on-board systems to monitor, prevent and/or treat chronic partial sleep loss, work overload, and/or circadian shifting in spaceflight.",
      source: "NASA Human Research Roadmap, Risk of Performance Decrements and Adverse Health Outcomes Resulting from Sleep Loss, Circadian Desynchronization, and Work Overload (risk page 100)",
      url: 'https://humanresearchroadmap.nasa.gov/Risks/?i=100'
    },
    {
      id: 'V72', topic: 'nasa ratings and requirements', status: 'verified', level: 'official-database',
      claim: "NASA's Human Research Roadmap rates the risk \"Cardiovascular adaptations\" 4x3 for operations on a long lunar-surface mission (Requires Characterization) and 4x4 on a Mars planetary mission (Requires Mitigation/Standard Refinement). Likelihood by consequence; read from the rating table.",
      values: { card: "cardio", risk: "Risk of Cardiovascular Adaptations Contributing to Adverse Mission Performance and Health Outcomes", lunarSurfaceLongOps: "4x3", lunarSurfaceLongOpsDisposition: "Requires Characterization", lunarSurfaceLongHealth: "1x2", lunarSurfaceLongHealthDisposition: "Accepted with Monitoring", marsPlanetaryOps: "4x4", marsPlanetaryOpsDisposition: "Requires Mitigation/Standard Refinement", marsPlanetaryHealth: "2x4", marsPlanetaryHealthDisposition: "Requires Mitigation/Standard Refinement", lastPublished: "05/13/25", gapId: "CV-203", gapText: "Evaluate candidate countermeasures in astronauts, including monitoring strategies, that prevent or mitigate spaceflight- and/or radiation-induced cardiovascular structural and functional adaptations in a spaceflight environment that contribute to an increased risk of a cardiovascular event and/or disease." },
      quote: "The information above was last approved by the Human System Risk Board in 5/2024. ... Evaluate candidate countermeasures in astronauts, including monitoring strategies, that prevent or mitigate spaceflight- and/or radiation-induced cardiovascular structural and functional adaptations in a spaceflight environment that contribute to an increased risk of a cardiovascular event and/or disease.",
      source: "NASA Human Research Roadmap, Risk of Cardiovascular Adaptations Contributing to Adverse Mission Performance and Health Outcomes (risk page 179)",
      url: 'https://humanresearchroadmap.nasa.gov/Risks/?i=179'
    },
    {
      id: 'V73', topic: 'nasa ratings and requirements', status: 'verified', level: 'official-database',
      claim: "NASA's Human Research Roadmap rates the long-term health risk \"Radiation carcinogenesis\" 3x2 for a long lunar-surface mission (Requires Characterization) and 3x3 for a Mars planetary mission (Requires Mitigation); the in-mission operations rating is 1x1 (Accepted). Likelihood by consequence under the previous 3x4 matrix; read from the rating table.",
      values: { card: "radiation", risk: "Risk of Radiation Carcinogenesis", lunarSurfaceLongOps: "1x1", lunarSurfaceLongOpsDisposition: "Accepted", lunarSurfaceLongHealth: "3x2", lunarSurfaceLongHealthDisposition: "Requires Characterization", marsPlanetaryOps: "1x1", marsPlanetaryOpsDisposition: "Accepted", marsPlanetaryHealth: "3x3", marsPlanetaryHealthDisposition: "Requires Mitigation", lastPublished: "08/17/26", gapId: "Cancer-402", gapText: "Identify and/or develop monitoring tools to support spaceflight research, long-term health surveillance, and countermeasure implementation." },
      quote: "The information above was last approved by the Human System Risk Board (HSRB) under the previous 3x4 LxC matrix. ... Identify and/or develop monitoring tools to support spaceflight research, long-term health surveillance, and countermeasure implementation.",
      source: "NASA Human Research Roadmap, Risk of Radiation Carcinogenesis (risk page 96)",
      url: 'https://humanresearchroadmap.nasa.gov/Risks/?i=96'
    },
    {
      id: 'V74', topic: 'nasa ratings and requirements', status: 'verified', level: 'official-database',
      claim: "NASA's Human Research Roadmap rates the risk \"Medical conditions that occur in mission\" 5x4 for operations on a long lunar-surface mission (Requires Mitigation) and 5x4 on a Mars planetary mission (Requires Mitigation). Likelihood by consequence; read from the rating table.",
      values: { card: "medical", risk: "Risk of Adverse Health Outcomes and Decrements in Performance Due to Medical Conditions that occur in Mission, as well as Long Term Health Outcomes Due to Mission Exposures", lunarSurfaceLongOps: "5x4", lunarSurfaceLongOpsDisposition: "Requires Mitigation", lunarSurfaceLongHealth: "4x4", lunarSurfaceLongHealthDisposition: "Requires Characterization", marsPlanetaryOps: "5x4", marsPlanetaryOpsDisposition: "Requires Mitigation", marsPlanetaryHealth: "5x4", marsPlanetaryHealthDisposition: "Requires Characterization", lastPublished: "05/13/25", gapId: "Medical-701", gapText: "We need to increase inflight medical capabilities and identify new capabilities that (a) maximize benefit and/or (b) reduce “costs” on human system/mission/vehicle resources." },
      quote: "The information above was last approved by the Human System Risk Board in 5/2021. ... We need to increase inflight medical capabilities and identify new capabilities that (a) maximize benefit and/or (b) reduce “costs” on human system/mission/vehicle resources.",
      source: "NASA Human Research Roadmap, Risk of Adverse Health Outcomes and Decrements in Performance Due to Medical Conditions that occur in Mission, as well as Long Term Health Outcomes Due to Mission Exposures (risk page 95)",
      url: 'https://humanresearchroadmap.nasa.gov/Risks/?i=95'
    },
    {
      id: 'V75', topic: 'nasa ratings and requirements', status: 'verified', level: 'official-database',
      claim: "NASA's Human Research Roadmap rates the risk \"Earth-independent human-systems operations\" 5x3 for operations on a long lunar-surface mission (Requires Mitigation) and 5x5 on a Mars planetary mission (Requires Mitigation). Likelihood by consequence; read from the rating table.",
      values: { card: "autonomy", risk: "Risk of Adverse Mission Outcomes Due to Earth Independent Human-Systems Operations", lunarSurfaceLongOps: "5x3", lunarSurfaceLongOpsDisposition: "Requires Mitigation", lunarSurfaceLongHealth: "Not Applicable", lunarSurfaceLongHealthDisposition: "Not Applicable", marsPlanetaryOps: "5x5", marsPlanetaryOpsDisposition: "Requires Mitigation", marsPlanetaryHealth: "Not Applicable", marsPlanetaryHealthDisposition: "Not Applicable", lastPublished: "05/13/25", gapId: "EIHSO-301", gapText: "We need to determine the on-board, intelligent systems that will support crew health and performance, and we need to establish the thresholds that will define how these systems should be implemented (including in-mission and at landing).", gap2Id: "EIHSO-701", gap2Text: "We need to determine how human-automation-robotic systems can be optimized for effective enhancement and monitoring of crew capabilities, health, and performance, during increasingly earth-independent, future exploration missions (including in-mission and at landing)." },
      quote: "The information above was last approved by the Human System Risk Board in 2/2023. ... We need to determine the on-board, intelligent systems that will support crew health and performance, and we need to establish the thresholds that will define how these systems should be implemented (including in-mission and at landing). ... We need to determine how human-automation-robotic systems can be optimized for effective enhancement and monitoring of crew capabilities, health, and performance, during increasingly earth-independent, future exploration missions (including in-mission and at landing).",
      source: "NASA Human Research Roadmap, Risk of Adverse Mission Outcomes Due to Earth Independent Human-Systems Operations (risk page 175)",
      url: 'https://humanresearchroadmap.nasa.gov/Risks/?i=175'
    },
    {
      id: 'V76', topic: 'nasa ratings and requirements', status: 'verified', level: 'official-document',
      claim: "NASA-STD-3001 requires every programme to provide in-mission capabilities to monitor physiological and psychosocial well-being, including periodic monitoring of general health status.",
      values: {},
      quote: "All programs shall provide training, in-mission capabilities, and resources to monitor physiological and psychosocial well-being and enable delivery of in-mission preventive health care ... Periodic monitoring of general health status.",
      source: "NASA-STD-3001 Volume 1, Revision C, requirement [V1 3003] In-Mission Preventive Health Care",
      url: 'https://www.nasa.gov/wp-content/uploads/2023/11/nasa-std-3001-vol-1-rev-c-with-signature.pdf'
    },
    {
      id: 'V77', topic: 'nasa ratings and requirements', status: 'verified', level: 'official-document',
      claim: "NASA-STD-3001 lists, among the in-mission medical capabilities to provide, assessing, recording, monitoring and trending vital signs and other physiological and behavioural health signs, and a means of autonomous medical care.",
      values: {},
      quote: "Assessing, recording, monitoring, and trending vital signs and additional physiological and behavioral health signs. ... Means of providing autonomous medical care and advanced life support.",
      source: "NASA-STD-3001 Volume 1, Revision C, requirement [V1 3004] In-Mission Medical Care",
      url: 'https://www.nasa.gov/wp-content/uploads/2023/11/nasa-std-3001-vol-1-rev-c-with-signature.pdf'
    },
    {
      id: 'V78', topic: 'nasa ratings and requirements', status: 'verified', level: 'official-document',
      claim: "The rationale of NASA-STD-3001 [V1 6001] recommends an 8.5-hour sleep period. It is a recommendation in a rationale, not a required sleep duration.",
      values: { recommendedSleepPeriodHours: 8.5 },
      quote: "Recommended 8.5 hr. sleep period (need to also include pre sleep of 2 hrs./post sleep of 1.5 hrs.)",
      source: "NASA-STD-3001 Volume 1, Revision C, rationale of [V1 6001] Circadian Shifting Operations and Fatigue Management",
      url: 'https://www.nasa.gov/wp-content/uploads/2023/11/nasa-std-3001-vol-1-rev-c-with-signature.pdf'
    },
    {
      id: 'V79', topic: 'nasa ratings and requirements', status: 'verified', level: 'official-document',
      claim: "A NASA technical brief states that an average adult needs 7 to 9 hours of sleep and that astronauts sleep about six hours on average in space.",
      values: { adultSleepHoursLow: 7, adultSleepHoursHigh: 9, inSpaceSleepHoursAbout: 6 },
      quote: "According to the National Sleep Foundation and American Academy of Sleep Medicine, an average adult needs 7-9 hours of sleep for optimal daytime functioning. ... These studies have shown that astronauts sleep an average of about six hours while in space, irrespective of the spaceflight mission examined or methodology used to quantify sleep.",
      source: "NASA OCHMO-TB-041, Sleep Accommodations (2023)",
      url: 'https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-041-sleep-accommodations.pdf'
    },
    {
      id: 'V80', topic: 'nasa ratings and requirements', status: 'verified', level: 'official-document',
      claim: "NASA-STD-3001 requires horizontal sleep surfaces in partial gravity, naming lunar (1/6) and Mars (1/3) gravity.",
      values: {},
      quote: "The system shall provide for horizontal sleep surface areas for partial-g and 1-g environments. ... Partial-g, i.e., lunar (1/6) and Mars (1/3) gravity, defines the orientation of the volume.",
      source: "NASA-STD-3001 Volume 2, Revision F, requirement [V2 7073] Partial-g Sleeping",
      url: 'https://www.nasa.gov/wp-content/uploads/2025/05/nasa-std-3001-vol-2.pdf'
    },
    {
      id: 'V81', topic: 'nasa ratings and requirements', status: 'verified', level: 'official-document',
      claim: "NASA-STD-3001 [V1 4024] sets the 80% in-mission strength line because losses of up to 20% did not impair mission objectives and could be reconditioned after flight.",
      values: { minStrengthFraction: 0.8 },
      quote: "Countermeasures shall maintain in-mission skeletal muscle strength at or above 80% of baseline values. ... The 80% minimum was determined using historical (including ISS) study data showing decrements up to 20% do not impair mission objectives and can be reconditioned to pre-flight muscular strength during post-flight reconditioning",
      source: "NASA-STD-3001 Volume 1, Revision C, requirement [V1 4024] In-Mission Skeletal Muscle Strength, with its rationale",
      url: 'https://www.nasa.gov/wp-content/uploads/2023/11/nasa-std-3001-vol-1-rev-c-with-signature.pdf'
    },
    {
      id: 'V82', topic: 'nasa ratings and requirements', status: 'verified', level: 'official-document',
      claim: "A 2026 NASA bulletin says ISS crew strength is measured with an isometric mid-thigh pull and an isometric bench press, exercises that are location specific and need specialized equipment.",
      values: {},
      quote: "For ISS crewmembers, isometric mid-thigh pull (IMTP) and isometric bench press (IBP) are the lower and upper body exercise protocols used to measure crewmember strength across their mission, but these exercises are location specific requiring specialized equipment.",
      source: "NASA OCHMO Technical Bulletin, NASA-STD-3001 Guidance for Strength and Human Performance for Extraterrestrial EVA Standard (2026)",
      url: 'https://www.nasa.gov/wp-content/uploads/2026/07/guidance-for-strength-and-human-performance-on-extraterrestrial-surface-eva-07222026.pdf'
    },
    {
      id: 'V83', topic: 'nasa ratings and requirements', status: 'verified', level: 'official-document',
      claim: "For habitats used longer than 60 days, NASA-STD-3001 limits the effective dose rate from galactic cosmic rays to less than 0.9 mSv per day on planetary surfaces and 1.3 mSv per day in free space.",
      values: { surfaceLimitMSvPerDay: 0.9, freeSpaceLimitMSvPerDay: 1.3 },
      quote: "rate of 1.3 mSv/day for systems in free space and to less than 0.9 mSv/day for systems on planetary surfaces.",
      source: "NASA-STD-3001 Volume 1, Revision C, requirement [V1 4033] Crew Radiation Limits from Galactic Cosmic Radiation",
      url: 'https://www.nasa.gov/wp-content/uploads/2023/11/nasa-std-3001-vol-1-rev-c-with-signature.pdf'
    },
    {
      id: 'V84', topic: 'nasa ratings and requirements', status: 'verified', level: 'official-document',
      claim: "NASA-STD-3001 requires the program to monitor the radiation exposure from galactic cosmic rays, solar energetic particles, trapped radiation and neutrons in habitable volumes, and requires the monitoring system to alert the crew and operations teams when exposure rates exceed predefined thresholds. The rationale, not the requirement text, adds that monitoring gives the radiation type, LET, intensity and angles of incidence, and that the crew must be alerted even if ground communication is disrupted.",
      values: {},
      quote: "The program shall monitor the radiation exposure produced by galactic cosmic rays, solar energetic particles, trapped radiation, and neutrons in habitable volumes ... Appropriate dose monitoring provides data on the radiation type, linear energy transfer (LET), intensity, and angles of incidence. ... Timepix-based instruments have been used by past programs to characterize the ionizing radiation inside crewed vehicles and to measure the dose and dose rates. ... The radiation monitoring system shall alert the crew and operations teams when radiation exposure rates exceed predefined thresholds. ... The crew must be alerted even if ground communication is disrupted or is unviable.",
      source: "NASA-STD-3001 Volume 2, Revision F, requirements [V2 6161] Intravehicular Area Monitoring and [V2 6164] Alerting",
      url: 'https://www.nasa.gov/wp-content/uploads/2025/05/nasa-std-3001-vol-2.pdf'
    },
    {
      id: 'V85', topic: 'muscle', status: 'verified', level: 'official-document',
      claim: "NASA's evidence report on muscle and aerobic capacity states that no standard in-flight measurement of strength exists and that the strength requirement is tested about a week after landing. With ISS countermeasures, knee strength falls about 15% on average. About 31% of ISS crew come back with knee strength more than 20% below preflight.",
      values: { avgKneeStrengthLossPct: 15, crewLosingOver20Pct: 31, testDaysAfterLandingAbout: 7 },
      quote: "It is also important to keep in mind that the medical requirements testing is conducted approximately 1 week after landing ... Isokinetic knee strength is reduced on average about 15% from pre to postflight with ISS countermeasures provided to crew ... About 31% of crew lose greater than 20% knee muscle strength ... Currently, no standard in-flight measurement of strength exists.",
      source: "NASA Human Research Program Evidence Report, Risk of Impaired Performance due to Reduced Muscle Mass, Strength and Endurance and Risk of Reduced Physical Performance Capabilities due to Reduced Aerobic Capacity (approved for public release 22 January 2023)",
      url: 'https://humanresearchroadmap.nasa.gov/evidence/reports/Evidence%20report%20aerobic%20and%20muscle_FINAL%204-3-2024.pdf'
    },
    {
      id: 'V86', topic: 'sleep', status: 'verified', level: 'official-document',
      claim: "NASA's evidence report on sleep states that astronauts sleep about six hours on average in space, and that about three-quarters of Shuttle and ISS astronauts reported using sleep medication.",
      values: { inSpaceSleepHoursAbout: 6 },
      quote: "These studies show that astronauts sleep an average of about six hours while in space, irrespective of the spaceflight mission examined or methodology used to quantify sleep. ... about three-quarters of both Shuttle and ISS astronauts reported using sleep medications during their missions",
      source: "NASA Human Research Program Evidence Report, Risk of Performance Decrements and Adverse Health Outcomes Resulting from Sleep Loss, Circadian Desynchronization, and Work Overload (2016)",
      url: 'https://humanresearchroadmap.nasa.gov/evidence/reports/Sleep.pdf'
    },
    {
      id: 'V87', topic: 'eim', status: 'verified', level: 'official-database',
      claim: "A NASA-funded study adds impedance myography before and after flight in astronauts (2019 to 2034), alongside the standard muscle measures.",
      values: {},
      quote: "In addition, we will perform in vivo, non-invasive electrical impedance myography pre- and post-flight to supplement function assessments of muscle being conducted as part of the standard measures in the integrated One-Year Mission Project.",
      source: "NASA Task Book, Time Course of Spaceflight-Induced Adaptations in Bone Morphology, Bone Strength and Muscle Quality (principal investigator M. Bouxsein)",
      url: 'https://taskbook.nasaprs.com/tbp/index.cfm?action=public_query_taskbook_content&TASKID=07387AE7B0ED65293EFA45E8203BB732'
    },
    {
      id: 'V88', topic: 'eim', status: 'verified', level: 'official-database',
      claim: "A NASA-funded study of partial weight bearing in rats (2019 to 2022) assessed muscle weekly with limb girth, electrical impedance myography, nerve conduction and grip force.",
      values: {},
      quote: "Muscle health and function were assessed weekly using limb girth, intra-muscular electrical impedance myography (EIM), nerve conduction studies, and grip force.",
      source: "NASA Task Book, Approaching Gravity As a Continuum: Musculoskeletal Effects of Fractional Reloading (principal investigator S. Rutkove)",
      url: 'https://taskbook.nasaprs.com/tbp/index.cfm?action=public_query_taskbook_content&TASKID=38338644ADB4036AF95D603F056A97FA'
    },
    {
      id: 'V89', topic: 'muscle', status: 'verified', level: 'agency-web-page',
      claim: "ESA's MARES dynamometer on the ISS weighs 200 kg and is described by ESA as too complex for everyday exercise.",
      values: { massKg: 200 },
      quote: "The machine is too complex for everyday exercise ... Mass: 200 kg",
      source: "European Space Agency, Muscle Atrophy Research and Exercise System (MARES)",
      url: 'https://www.esa.int/Science_Exploration/Human_and_Robotic_Exploration/Columbus/Muscle_Atrophy_Research_and_Exercise_System'
    },

    // ---- NASA OSDR: rat partial weight bearing (checks the model's gravity term) ----
    // Percent changes are of the group means, day 0 to day 28, intact (sham-operated) rats;
    // a share is (0.4 g change - 1 g change) / (0 g change - 1 g change). test/gravity-check.test.js
    // recomputes every number from data/osdr-pwb.js.
    {
      id: 'V90', topic: 'muscle', status: 'verified', level: 'dataset-record',
      claim: 'Rats (Fischer 344, intact), 28 days of partial weight bearing in a harness, an analog of partial gravity, not human data: maximum rear-paw grip force changed from day 0 to day 28 by +0.1% at full weight bearing (1 g), -34.3% at 40% weight bearing (0.4 g, Mars analog) and -52.0% with the hindlimbs unloaded (0 g) in females, and by +34.0%, -50.2% and -56.5% in males (group means, 10 rats per group). After subtracting the 1 g change, the 0.4 g groups lost 0.66 (females) and 0.93 (males) of the 0 g loss.',
      values: { gripF1gPct: 0.1, gripF04gPct: -34.3, gripF0gPct: -52, gripFShare: 0.66, gripM1gPct: 34, gripM04gPct: -50.2, gripM0gPct: -56.5, gripMShare: 0.93, nMin: 10, nMax: 10 },
      quote: null,
      source: 'NASA Open Science Data Repository, OSD-652 (LSDS-76), file LSDS-76_Force Transducer_Grip_Strength_Transformed.csv, column max_grip_Newtons (the second of two with that name); dataset DOI 10.26030/z92y-7b97; paper Rosa-Caldwell ME et al., J Appl Physiol 2023, doi:10.1152/japplphysiol.00023.2023; group means in data/osdr-pwb.js',
      url: 'https://doi.org/10.26030/z92y-7b97'
    },
    {
      id: 'V91', topic: 'muscle', status: 'verified', level: 'dataset-record',
      claim: 'Same rats (intact), 28 days of partial weight bearing in a harness, an analog of partial gravity, not human data: maximum nerve-stimulated plantarflexion torque changed from day 0 to day 28 by -1.8% at 1 g, -9.5% at 0.4 g and -18.7% at 0 g in females, and by +13.0%, +8.8% and -4.2% in males; calf girth changed by +2.1%, -5.6% and -5.2% in females and by +1.9%, -2.5% and -7.9% in males (group means, 10 rats per group). After subtracting the 1 g change, the 0.4 g groups lost 0.46 (females) and 0.25 (males) of the 0 g torque loss and 1.05 (females) and 0.44 (males) of the 0 g girth loss.',
      values: {
        plantarflexionTorqueF1gPct: -1.8, plantarflexionTorqueF04gPct: -9.5, plantarflexionTorqueF0gPct: -18.7, plantarflexionTorqueFShare: 0.46,
        plantarflexionTorqueM1gPct: 13, plantarflexionTorqueM04gPct: 8.8, plantarflexionTorqueM0gPct: -4.2, plantarflexionTorqueMShare: 0.25,
        calfGirthF1gPct: 2.1, calfGirthF04gPct: -5.6, calfGirthF0gPct: -5.2, calfGirthFShare: 1.05,
        calfGirthM1gPct: 1.9, calfGirthM04gPct: -2.5, calfGirthM0gPct: -7.9, calfGirthMShare: 0.44, nMin: 10, nMax: 10
      },
      quote: null,
      source: 'NASA Open Science Data Repository, OSD-616 (LSDS-61), file LSDS-61_Force Plate_Force_Plate_Transformed_Reusable_Files.csv, columns Girth_FootPlate_Data_Max_Plantar_flexion_Newtons_times_millimeters and Girth_FootPlate_Data_Girth; dataset DOI 10.26030/e0yx-ta10; paper Rosa-Caldwell ME et al., J Appl Physiol 2023, doi:10.1152/japplphysiol.00023.2023; group means in data/osdr-pwb.js',
      url: 'https://doi.org/10.26030/e0yx-ta10'
    },

    // ---- Sarcopenia on Earth: the clinical tools MyoTwin is modelled on ----------
    // Consensus statements for finding muscle loss (sarcopenia) in older adults, and
    // one systematic review of bioimpedance phase angle. Earth clinical practice,
    // not spaceflight data.
    {
      id: 'V94', topic: 'muscle', status: 'verified', level: 'full-text',
      claim: 'The European consensus on sarcopenia (EWGSOP2, 2019) sets a Find-Assess-Confirm-Severity pathway: the SARC-F questionnaire to find cases, grip strength or the chair stand test for low strength, DXA or BIA to confirm low muscle quantity, and gait speed, SPPB, TUG or the 400-m walk for severity. Calf circumference (cut-off <31 cm) may serve as a proxy only where no other muscle mass method is available. The main text names DXA and BIA for usual clinical care; its key-points box names DXA for clinical practice and lists BIA among research methods.',
      values: {
        lowGripMenBelowKg: 27, lowGripWomenBelowKg: 16,
        lowChairStandFiveRisesAboveSec: 15,
        lowAsmMenBelowKg: 20, lowAsmWomenBelowKg: 15,
        lowAsmPerHeight2MenBelowKgM2: 7.0, lowAsmPerHeight2WomenBelowKgM2: 5.5,
        severeGaitSpeedAtMostMs: 0.8, lowSppbAtMostPoints: 8, lowTugAtLeastSec: 20, lowWalk400mAtLeastMin: 6,
        calfCircumferenceProxyBelowCm: 31
      },
      quote: 'Specifically, we recommend a pathway of Find-Assess-Confirm-Severity (F-A-C-S; Figure 1) for use across clinical practices and in research studies. ... In clinical practice, EWGSOP2 advises use of the SARC-F questionnaire to find individuals with probable sarcopenia. We advise use of grip strength and chair stand measures to identify low muscle strength. To generate evidence that confirms muscle of low quantity or quality, we recommend evaluation of muscle by DXA and BIA methods in usual clinical care, and by DXA, MRI or CT in research and in specialty care for individuals at high risk of adverse outcomes. We advise measures of physical performance (SPPB, TUG and 400-m walk tests) to assess severity of sarcopenia. ... Calf circumference has been shown to predict performance and survival in older people (cut-off point <31 cm) [79]. As such, calf circumference measures may be used as a diagnostic proxy for older adults in settings where no other muscle mass diagnostic methods are available. ... Confirm: To confirm sarcopenia by detection of low muscle quantity and quality, DXA is advised in clinical practice, and DXA, BIA, CT or MRI in research studies. Determine Severity: Severity can be evaluated by performance measures; gait speed, SPPB, TUG and 400-m walk tests can be used.',
      source: 'Cruz-Jentoft AJ et al. Sarcopenia: revised European consensus on definition and diagnosis. Age Ageing 2019;48:16-31 (PMC6322506; correction doi:10.1093/ageing/afz046 sets the women ASM/height2 cut-off to <5.5 kg/m2, as in the PMC text). Cut-off values from Table 3. Read in the full text from PubMed Central',
      url: 'https://doi.org/10.1093/ageing/afy169'
    },
    {
      id: 'V95', topic: 'muscle', status: 'verified', level: 'abstract',
      claim: 'The Asian consensus on sarcopenia (AWGS 2019) starts case finding with calf circumference (<34 cm in men, <33 cm in women), SARC-F (4 or more) or SARC-CalF (11 or more); low strength is handgrip <28 kg (men) or <18 kg (women); low physical performance is a 6-m walk <1.0 m/s, SPPB 9 or less, or a 5-time chair stand of 12 s or more; muscle mass is measured by DXA or bioimpedance.',
      values: {
        calfCircumferenceMenBelowCm: 34, calfCircumferenceWomenBelowCm: 33,
        sarcFAtLeast: 4, sarcCalFAtLeast: 11,
        lowGripMenBelowKg: 28, lowGripWomenBelowKg: 18,
        lowGaitSpeed6mBelowMs: 1.0, lowSppbAtMostPoints: 9, lowChairStandFiveTimesAtLeastSec: 12,
        lowMuscleDxaMenBelowKgM2: 7.0, lowMuscleDxaWomenBelowKgM2: 5.4,
        lowMuscleBiaMenBelowKgM2: 7.0, lowMuscleBiaWomenBelowKgM2: 5.7
      },
      quote: 'AWGS 2019 retains the previous definition of sarcopenia but revises the diagnostic algorithm, protocols, and some criteria: low muscle strength is defined as handgrip strength <28 kg for men and <18 kg for women; criteria for low physical performance are 6-m walk <1.0 m/s, Short Physical Performance Battery score ≤9, or 5-time chair stand test ≥12 seconds. AWGS 2019 retains the original cutoffs for height-adjusted muscle mass: dual-energy X-ray absorptiometry, <7.0 kg/m2 in men and <5.4 kg/m2 in women; and bioimpedance, <7.0 kg/m2 in men and <5.7 kg/m2 in women. In addition, the AWGS 2019 update proposes separate algorithms for community vs hospital settings, which both begin by screening either calf circumference (<34 cm in men, <33 cm in women), SARC-F (≥4), or SARC-CalF (≥11), to facilitate earlier identification of people at risk for sarcopenia.',
      source: 'Chen LK et al. Asian Working Group for Sarcopenia: 2019 Consensus Update on Sarcopenia Diagnosis and Treatment. J Am Med Dir Assoc 2020;21:300-307.e2 (PMID 32033882). Abstract read in PubMed and Europe PMC',
      url: 'https://doi.org/10.1016/j.jamda.2019.12.012'
    },
    {
      id: 'V96', topic: 'muscle', status: 'verified', level: 'abstract',
      claim: 'A systematic review of 13 studies (7668 people) found bioimpedance phase angle lower in people with sarcopenia (seven of eight studies), with cut-offs from 4.05 to 5.05 degrees derived for identifying sarcopenia.',
      values: { studies: 13, participants: 7668, studiesLowerPhaseAngle: 7, studiesComparingPhaseAngle: 8, cutoffLowDeg: 4.05, cutoffHighDeg: 5.05 },
      quote: 'Thirteen studies (7668 subjects) met the inclusion criteria. The overall risk of bias was low. Sarcopenia was associated with a significant lower PhA in seven studies out of eight, while five studies out of six reported a high prevalence of sarcopenia was in patients with low PhA. Different cut-off point values from 4.05 to 5.05° have been derived for the identification of sarcopenia. ... Data from the selected papers demonstrate that PhA is decreased in sarcopenic subjects and the prevalence of sarcopenia is higher in subjects with low PhA.',
      source: 'Di Vincenzo O et al. Bioelectrical impedance analysis (BIA) -derived phase angle in sarcopenia: A systematic review. Clin Nutr 2021;40:3052-3061 (PMID 33183880). Abstract read in PubMed',
      url: 'https://doi.org/10.1016/j.clnu.2020.10.048'
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
    // V60-V63: the real-data files in data/ that the simulator replays. Every
    // number below is recomputed from those files in test/data.test.js.
    {
      id: 'V60', topic: 'radiation', status: 'verified', level: 'dataset-record',
      claim: 'Mars surface (Curiosity RAD, detector B, dose in silicon), sols 13-112 (2012-08-18 to 2012-11-28), 94 sols with data: the per-sol median dose rate ranges from 8.623 to 9.313 uGy/h, mean 8.97 uGy/h. Sols 29-33 and 64 have no file.',
      values: { sols: 94, firstSol: 13, lastSol: 112, firstDate: '2012-08-18', lastDate: '2012-11-28', meanOfSolMediansUGyPerH: 8.97, minSolMedianUGyPerH: 8.623, maxSolMedianUGyPerH: 9.313, missingSols: [29, 30, 31, 32, 33, 64] },
      quote: null,
      source: 'NASA Planetary Data System, MSL-M-RAD-3-RDR-V1.0, field DOSIMETRY_TOTAL_DOSE_B, all observations of sols 13-112; per-sol medians in data/msl-rad.js',
      url: 'https://pds-ppi.igpp.ucla.edu/data/MSL-M-RAD-3-RDR-V1.0/'
    },
    {
      id: 'V61', topic: 'radiation', status: 'verified', level: 'dataset-record',
      claim: 'Moon (LRO CRaTER, scaled by the instrument team from lunar orbit to the lunar surface, water-corrected): over the sleep window 22:00-06:00 UTC, the quiet median of 60 nights (21 Apr to 19 Jun 2017) is 89.6 uGy behind detector pair D5&6 and 91.3 uGy behind D1&2. The night starting 10 Sep 2017 gave 43538.8 uGy behind D5&6 (486 times quiet) and 166218.8 uGy behind D1&2 (1821 times).',
      values: { quietNights: 60, quietMedianD56UGyPerNight: 89.6, quietMedianD12UGyPerNight: 91.3, sep10D56UGyPerNight: 43538.8, sep10D12UGyPerNight: 166218.8, sep10MultipleD56: 486, sep10MultipleD12: 1821 },
      quote: 'All dose rate units: cGy / day. All dose rates have a silicon to water correction applied and are altitude corrected to the lunar surface.',
      source: 'LRO CRaTER instrument team (University of New Hampshire, NASA LRO mission), doserates_nospe.txt and doserates_standard_2017262_31days_allevents.txt, columns D1&2 and D5&6; nightly sums in data/lro-crater.js',
      url: 'https://crater-web.sr.unh.edu/data/craterProducts/doserates/doserates_nospe.txt'
    },
    {
      id: 'V62', topic: 'radiation', status: 'verified', level: 'dataset-record',
      claim: 'NASA CCMC DONKI records solar energetic particle event 2017-09-10T16:45:00-SEP-001 (GOES13 above 10 MeV), starting 2017-09-10 16:45 UTC, linked to flare 2017-09-10T15:35:00-FLR-001 and coronal mass ejection 2017-09-10T16:09:00-CME-001.',
      values: { id: '2017-09-10T16:45:00-SEP-001', start: '2017-09-10T16:45Z', instruments: ['GOES13: SEM/EPS >10 MeV'], flareId: '2017-09-10T15:35:00-FLR-001', cmeId: '2017-09-10T16:09:00-CME-001' },
      quote: null,
      source: 'NASA CCMC DONKI, SEP records for September 2017 via api.nasa.gov; data/donki-sep-2017.js',
      url: 'https://api.nasa.gov/DONKI/SEP?startDate=2017-09-01&endDate=2017-09-30'
    },
    {
      id: 'V63', topic: 'radiation', status: 'verified', level: 'dataset-record',
      claim: 'OMNI2 hourly integral proton flux above 10 MeV (from GOES) peaked at 1208.39 protons per cm2 s sr in the hour starting 2017-09-11 11:00 UTC (4-16 Sep 2017).',
      values: { peakGt10MeVPfu: 1208.39, peakHour: '2017-09-11T11:00Z' },
      quote: null,
      source: 'NASA GSFC SPDF OMNI2 hourly data, omni2_2017.dat, word 46; data/omni-protons.js',
      url: 'https://spdf.gsfc.nasa.gov/pub/data/omni/low_res_omni/omni2_2017.dat'
    },
    {
      id: 'V92', topic: 'radiation', status: 'verified', level: 'abstract',
      claim: 'On the surface of Mars, under about 23 g/cm2 of CO2 atmosphere, Curiosity RAD saw dose rates rise above the galactic-cosmic-ray background by factors of 2 to 3 during the solar particle event of 10-12 September 2017.',
      values: { atmosphereGPerCm2: 23, doseRateRiseFactorLow: 2, doseRateRiseFactorHigh: 3 },
      quote: 'Despite 23 g/cm2 of CO2 shielding provided by the atmosphere above RAD, dose rates rose above background galactic cosmic ray levels by factors of 2 to 3 over the course of several hours and leveled off at sustained peak rates for about 12 hr before declining over the following 36 hr.',
      source: 'Zeitlin C et al. Analysis of the Radiation Hazard Observed by RAD on the Surface of Mars During the September 2017 Solar Particle Event. Geophys Res Lett 2018;45:5845-5851. Abstract read in the Crossref record',
      url: 'https://doi.org/10.1029/2018GL077760'
    },
    {
      id: 'V93', topic: 'radiation', status: 'verified', level: 'full-text',
      claim: 'LRO CRaTER: two pieces of tissue-equivalent plastic, about 54 mm and 27 mm long, sit between its three detector pairs, and aluminium end caps about 0.81 mm thick close both ends. D1&2 sits behind the zenith cap, facing deep space; D5&6 sits behind the nadir cap, facing the Moon.',
      values: { tepZenithMm: 53.992, tepNadirMm: 26.972, endCapZenithUm: 812.8, endCapNadirUm: 810.3 },
      quote: 'TEP on-axis linear dimensions: 53.992 mm (zenith section) and 26.972 (nadir section) ... Aluminum end cap thickness: 812.8 µm (zenith cap) and 810.3 µm (nadir cap)',
      source: 'Spence HE et al. CRaTER: The Cosmic Ray Telescope for the Effects of Radiation Experiment on the Lunar Reconnaissance Orbiter Mission. Space Sci Rev 2010;150:243-284, Tables 2 to 4. Read in the open copy at the MDSOAR repository (hdl.handle.net/11603/43632)',
      url: 'https://doi.org/10.1007/s11214-009-9584-8'
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
