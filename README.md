# Experimental Earth

Turn a real place into an interactive environment for investigating changes to water, shade, heat, soil, vegetation and more. Explore a possible intervention, see what assumptions drive its predicted effects, make a useful measurement, and improve the model through contact with the actual place.

The product should help people understand and improve a courtyard, schoolyard, garden, farm boundary, neighborhood or other environment they care about. It connects spatial exploration, physical modeling, experiments and shared decisions. A beautiful simulation is a way to investigate a question, not proof that its answer is correct.

## Current state

**First runnable local workbench available.** The Rain Experiment Lab compares hypothetical rainfall, terrain and surface edits with explicit water accounting and an attributed observation notebook. This is a conceptual computation on invented starting conditions—not an environmentally validated forecast, site survey, authorized intervention or Nebius/model deployment. Read current source, issues and pull requests for subsequent progress.

## Run the Rain Experiment Lab

Run `python3 -m http.server 8765` from the repository root and open `http://localhost:8765/` in a modern browser. It is dependency-free and local-only. Edit either 8×6 site grid with surface/height brushes, change rain assumptions, compare the matched scenarios, inspect water balance and time series, and save/reopen the full project via Export/Import JSON. Browser storage also retains the last workspace locally. Open the site through a local HTTP server, not directly as a `file:` URL, because JavaScript modules may be blocked by file-origin security policy.

Run `npm test` with Node.js 20+ for the native conservation and record-validation suite.

Optional actual-browser receiving: with Python 3, a locally available Chrome/Chromium, and Node.js 22+, run `npm run browser-receive` (override `CHROME_BIN` if necessary). This starts its own local test server/browser and checks real editing, observation retention, reload, import and 390px layout without an external test framework. It writes a local `browser-mobile-390.png` inspection screenshot; do not mistake a successful UI test for physical field validation.

**Physical boundaries:** The model is a deliberately simplified finite-volume surface transfer on constant-infiltration cells, with an open edge and no measured calibration. Its arithmetic conserves rainfall within tolerance; it does not quantify actual flood risk, stormwater compliance, soil response or intervention benefit. Real readings can be recorded with method and ± uncertainty, but do not automatically tune the model. Sampling suggestions identify the largest simulated scenario difference, not validated information gain. No external data or inference endpoints are called.

## Inspect an unknown surface property

**Probe infiltration assumption** tests the effect of replacing only one proposed cell's authored infiltration parameter with an illustrative lower or upper example bound. It ranks modeled **water not absorbed** (water left through edges plus final standing water), separately from the existing button that suggests measuring where the *two scenarios* disagree. On imported grids over 96 cells it visibly reports a 36-cell heuristic shortlist; it does not claim a globally optimal recommendation. Bounds are neither measured local soil data nor confidence intervals. Use the separate ponding-depth form only for water-depth readings, not permeability tests.

## Start here

- [Product seed](docs/PRODUCT_SEED.md): concrete experiences, hard problems, uses, possible growth, and more.
- [Contributor guidance](CONTRIBUTING.md): work through existing ownership, verify locally, review, integrate and continue.
- [Project issues](https://github.com/Jacob-Met/experimental-earth/issues) and [pull requests](https://github.com/Jacob-Met/experimental-earth/pulls): current work and evidence.
- [HAMON shared priority board](https://github.com/Jacob-Met/hamon/issues/1354): current priorities, claims and coordination.

The seed is not an exhaustive feature list, a fixed destination or a prescribed architecture. Invent better capabilities, compare approaches and integrate useful discoveries. A verified result opens further work; it is not a reason to stop contributing.

## Competition integration without a product ceiling

The [official Nebius and NVIDIA rules](https://nebiusglobalaihackathon.devpost.com/rules) require a working application using an NVIDIA open-source model and actual Nebius Token Factory runtime inference or Nebius AI Cloud execution. Make that contribution useful to the product and demonstrate it in the running application. These documents do not establish that integration. Check current submission, licensing and track requirements before claiming eligibility; repository publication and submission remain subject to authorization.

Product work should remain useful beyond the competition. An unavailable provider route does not block independent work on geometry, modeling, experiments or interaction; keep the unresolved integration explicit.

Seeded from Jacob's approved exploratory direction on 2026-10-24.
