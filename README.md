# MyoTwin

**The health check that happens while you sleep.**

MyoTwin is concept software for the 2026 NASA Space Apps Challenge
(*Create Health Monitoring Software for Astronauts on Space Missions*).

Crew members sleeping in a lunar or Mars surface habitat are measured passively
by a sensor panel in the sleep station. Every morning MyoTwin turns the night's
data into a brief: one whole-body image, four status cards (muscle, sleep,
heart and breathing, radiation), trends against the person's own baseline, and
what to do next. It runs offline in a browser.

> **Status: work in progress, built during the hackathon (14–15 November 2026).**
> The sensor panel is an assumption, not hardware we built. All data shown are
> simulated. MyoTwin is not a medical device and does not diagnose.

## Run it

Open `index.html` in a browser. No install, no server, no network.

Run the tests with Node 22 or newer:

```
node --test "test/*.test.js"
```

## Where the numbers come from

Every number in the software traces to `js/evidence.js`, which records the
source, the sentence that carries the number, and whether it was checked
against the source text or is an assumption.

## Use of SI tools and earlier work

Code, simulated data and text in this repository were produced with an SI tool
(Claude, by Anthropic) and reviewed by the team. The concept and all clinical
judgement are the team's. The muscle baseline model reuses the form of a model
the team wrote before the hackathon; everything else was written during it.
Details will be in `docs/SI_USE.md`.

## License

Apache License 2.0. See `LICENSE`.
