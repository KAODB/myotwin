# Use of SI tools in MyoTwin

The NASA Space Apps Challenge calls AI tools "SI" and asks every team to
disclose how they used them. This file is that disclosure.

## Which tool

One tool: Claude, a model made by Anthropic, used through Claude Code (a
command-line coding assistant). No other SI tool was used. No image, video or
voice generator was used.

## What it was used for

- **Literature.** Finding papers, standards and datasets, and checking that
  each number we use appears in the source. For each verified entry in
  `js/evidence.js` the sentence that carries the number was copied from the
  source. Where a value was read from a table or dataset and no sentence was
  copied, the entry has no quote (for example V16, V22, V24, V31).
  A second, separate check of the sources was run during the hackathon, and
  its corrections were applied to `js/evidence.js` and to these documents.
- **Code and tests.** Writing the JavaScript modules, the page, the
  stylesheet, the automated tests and the tool that generates
  `docs/EVIDENCE.md`.
- **Simulated and measured data.** Writing the seeded simulator in `js/sim.js`
  that produces the crew member's readings, and the scripts in `tools/data/`
  that turn the NASA downloads into the small files in `data/` (the radiation
  dose of each night is a replayed measurement, V60 and V61). There are no real
  measurements of any person in this repository.
- **Text.** Drafting the README, these documents and the project page text.
- **Demo.** Building the seven-slide deck in `demo/slides/` from screenshots of
  the running page.

## What people did

The concept, the direction of the project and every clinical judgement are the
team member's (this is a one-person team). This includes the choice of the problem, the sensor panel, what
counts as a screening flag, the decision that the software never prescribes
treatment, the wording of the countermeasure list, and which limits are
stated.

## How the outputs were checked

- Every number in the code either reads an entry of `js/evidence.js` by id or
  is declared as an assumption with a status and a note in the module that
  owns it. `docs/EVIDENCE.md` lists both and is regenerated from the code; a
  test fails if it is out of date.
- Each evidence entry has a status: verified (checked against the source
  text), secondary (taken from another citation without opening the original,
  V33 and V41) or assumption.
- Fitted model parameters are compared with their published anchors in the
  code comments and in the tests: the model gives -28.9% and -8.1% for the two
  bed-rest groups (published -29% and -8%, V4) and -10.5% for six months on
  the ISS (published -13 +/- 2%, V5). The misfit to V5 is stated. The fit
  treats 6-degree head-down bed rest as g = 0 and the ISS crews as full
  exercise adherence; both are assumptions.
- The simulated nights and the mission plan come from the same model, so the
  demonstration shows the workflow, not how well a real decline would be
  detected.
- The status rules are checked by automated tests against the rules table in
  `docs/CONTRACT.md`. The engine is not allowed to read the simulator's ground
  truth.
- Claims in the documents are limited to what the evidence table supports.
  A test checks that every evidence id named in the documents exists.

## Images

No SI-generated images of people are used. The body images are outputs of
the software, computed from a simplified phantom, and are labelled as
simulated.

## Earlier work

The form of the muscle model (a first-order approach to a loss plateau, with a
gravity term and an exercise term) comes from a private simulator the team
member wrote on 11-13 November 2026, before the hackathon. For MyoTwin it was
refitted to published anchors (V4, V5) and rewritten. Everything else in this
repository was written during the hackathon, 14-15 November 2026.
