# Experimental Earth

Turn a real place into an interactive environment for investigating changes to water, shade, heat, soil, vegetation and more. Explore a possible intervention, see what assumptions drive its predicted effects, make a useful measurement, and improve the model through contact with the actual place.

The product should help people understand and improve a courtyard, schoolyard, garden, farm boundary, neighborhood or other environment they care about. It connects spatial exploration, physical modeling, experiments and shared decisions. A beautiful simulation is a way to investigate a question, not proof that its answer is correct.

## Current state

**First runnable local workbench available.** The Rain Experiment Lab compares hypothetical rainfall, terrain and surface edits with explicit water accounting and an attributed observation notebook. This is a conceptual computation on invented starting conditions—not an environmentally validated forecast, site survey, authorized intervention or Nebius/model deployment. Read current source, issues and pull requests for subsequent progress.

## Run the Rain Experiment Lab

Run `python3 -m http.server 8765` from the repository root and open `http://localhost:8765/` in a modern browser. It is dependency-free and local-only. Edit either 8×6 site grid with surface/height brushes, change rain assumptions, compare the matched scenarios, inspect water balance and time series, and save/reopen the full project via Export/Import JSON. Browser storage also retains the last workspace locally. Open the site through a local HTTP server, not directly as a `file:` URL, because JavaScript modules may be blocked by file-origin security policy.

Run `npm test` with Node.js 20+ for the native conservation and record-validation suite.

Optional actual-browser receiving: with a locally available Chrome/Chromium and Node.js 22+, run `npm run browser-receive` (override `CHROME_BIN` with an absolute path if necessary). On Linux, the maintained HAMON Chromium owner starts an exclusive browser profile and ephemeral CDP port; this product starts an ephemeral HTTP server and requires the maintained same-browser sandbox admission before product assertions. Use a verified installed binary such as `/opt/google/chrome/chrome`, since wrappers may alter launch flags. Concurrent courses are isolated. Each unique `.browser-run-<uuid>` directory retains the screenshot, browser logs and session receipt (or set an absolute, new `BROWSER_RUN_DIRECTORY`). Python is no longer required for the Linux course. The automated session owner currently qualifies Linux only and explicitly refuses other platforms; ordinary browser use of the product remains platform-independent. See `tests/support/README.md` for runtime controls and provenance. A successful UI test does not establish physical field validation.

**Physical boundaries:** The model is a deliberately simplified finite-volume surface transfer on constant-infiltration cells, with an open edge and no measured calibration. Its arithmetic conserves rainfall within tolerance; it does not quantify actual flood risk, stormwater compliance, soil response or intervention benefit. Real readings can be recorded with method and ± uncertainty, but do not automatically tune the model. Sampling suggestions identify the largest simulated scenario difference, not validated information gain. No external data or inference endpoints are called.

## Inspect an unknown surface property

### Follow the water at a selected cell

**Trace both scenarios**, below the site totals, explains each cell's whole-event rain, incoming and outgoing neighbor water, infiltration, boundary exit and final storage in liters. Compare the component changes between the saved plans, then follow a neighboring cell to inspect its contribution. Both travel directions remain visible; repeated crossings are not unique water-parcel provenance. Site/weather edits clear the derived result; ordinary project export/import preserves its inputs for recomputation. See [local water accounting](docs/LOCAL_WATER_ACCOUNTING.md) for the conservation relation, interactive work limit and verification boundaries.

**Probe infiltration assumption** tests the effect of replacing only one proposed cell's authored infiltration parameter with an illustrative lower or upper example bound. It ranks modeled **water not absorbed** (water left through edges plus final standing water), separately from the existing button that suggests measuring where the *two scenarios* disagree. On imported grids over 96 cells it visibly reports a 36-cell heuristic shortlist; it does not claim a globally optimal recommendation. Bounds are neither measured local soil data nor confidence intervals. Use the separate ponding-depth form only for water-depth readings, not permeability tests.

## Challenge competing infiltration rates

The **infiltration hypothesis challenge** compares 2–9 explicit constant-rate candidates for one surface in one observed scenario. Add depth readings with source and ± tolerance in the notebook, then assign each a scenario and either **Calibration** or **Held aside**. Existing unassigned readings remain notebook entries and are excluded from both scores. Choose the surface and candidate rates, then select **Compare rate hypotheses**. The comparison changes all matching cells' infiltration capacity during each candidate run; it never applies a rate to the project automatically.

Only calibration root-mean-square error determines candidate order. The held-aside residuals can contradict candidates without changing that order. All candidates, including rejected and indistinguishable ones, remain visible; a dry or uncoupled observation cannot establish a unique rate. Every reading's predicted value, signed residual, source and interpolation interval are inspectable. Off-step times use linear interpolation between solver snapshots, not an exact physical solution. The chosen study and evidence roles survive project export/import and browser reload; any changed assumption clears the displayed comparison until you run it again.

Use readings from the same scenario, place and weather event. The other authored inputs are assumed correct for this limited comparison, so a mismatch can reflect bad terrain, rain assumptions or missing physics as well as an infiltration rate. User-entered ± bands are acceptance tolerances, not statistical confidence intervals. Readings used to tune candidate choices cannot also establish independent predictive accuracy. Passing these comparisons establishes bounded agreement in this conceptual model, not field calibration, a unique material property or environmental accuracy.

### Ask a separating measurement question

After comparing candidates, **Find a separating depth reading** scans the retained solver cell/time grid for the greatest predicted depth spread among calibration-compatible rates. It excludes points already recorded for that scenario, displays every candidate's predicted depth, and states the number of evaluated points and the solver interval. Held-aside reading values do not select the question. This deterministic disagreement heuristic does not establish expected information gain, physical feasibility, instrument adequacy or global optimality outside the discrete grid. A dry event or fewer than two supported alternatives yields no suggested measurement.

**Prepare held-aside reading** fills only the selected cell, time, scenario and evidence role in the notebook form and switches the brush to Inspect. It neither paints the site nor creates evidence. A reading is retained only after the user enters a measured value, uncertainty and source and submits the form. Notebook inputs accept fractional values without imposing the solver's time interval on physical observations.

### Check numerical time-step sensitivity

After comparing candidate rates, **Check finer calculation intervals** repeats the same reading predictions at the saved interval, half that interval and one quarter, bounded by the solver's one-minute minimum. Duplicate intervals are evaluated once. It shows each reading's band classification, calibration-compatible rates, tolerance-aware closest calibration candidates and candidates still compatible after held-aside readings. Expand a rate to inspect full predictions, residuals, source and interpolation brackets. The saved project, weather and readings stay unchanged; edits retire the displayed diagnostic.

This finite sensitivity check does not establish convergence, an error bound or physical validity. Unchanged decisions can coexist with changed predictions. Surface-transfer discretization and interpolation across a rainfall change can both affect results. Held-aside values never influence calibration ranking. At the one-minute minimum, without assigned readings or a matching surface, or above two million estimated cell-steps, the diagnostic gives an explicit uncomputed result. The work estimate is grid cells × candidate rates × summed time steps and bounds interactive work, not numerical accuracy.

### Import a sourced depth table

The notebook's **Preview CSV** accepts UTF-8 observation tables up to 128 KB. Required columns are `cell,minute,depth,uncertainty,unit,source`; optional `scenario` (`existing`, `proposal`, `unassigned`) and `use` (`calibration`, `challenge`, `unassigned`) make evidence assignment explicit. Missing assignments remain notebook-only. Cell labels such as `B2` refer to the current grid; time is minutes since the modeled event began. `mm`, `cm` and `in` apply to both depth and ± uncertainty in each row. Decimal values use a period; quoted commas, escaped double quotes and multiline source text are supported.

For example, this **authored format example is not a field dataset**:

```csv
cell,minute,depth,uncertainty,unit,source,scenario,use
A1,30,1.2,0.05,cm,"Example ruler note, fictional",existing,calibration
B1,60,0.5,0.02,in,Example held-aside note,existing,challenge
```

Preview shows the interpreted millimetres and roles without changing the notebook. **Add previewed readings** appends the whole validated table once. Any bad row, unknown unit, missing source, out-of-grid cell, impossible time or history-limit overflow refuses the entire import. A changed project invalidates the preview. The supplied filename, starting row and original quantities remain alongside each reading through export/import and reload; conversions are checked when reopening projects. Reimporting identical supplied file/row evidence is refused locally. Provenance and user-assigned roles do not establish physical truth or statistical independence. No file contents leave the local application.
## Challenge a hypothesis across storms

The **Do the hypotheses survive another storm?** panel transfers the finite infiltration alternatives from the current calibration study to a separately saved storm project. Give distinct event references, load a second project with readings explicitly held aside for the same observed scenario, and compare. Geometry, surfaces, grid scale, transfer/outlet assumptions and solver step must match; rainfall and event duration may differ. The second event never changes calibration ordering. A candidate must satisfy calibration, any first-event holdout, and the second event's stated bands to survive.

Expand each candidate to inspect second-event predictions, signed residuals, interpolation brackets and measurement sources. Export two-event evidence to retain both complete project snapshots, chosen candidates and references; reopening recomputes results and does not replace the active workspace. Changing workspace assumptions clears the displayed comparison. Second-event inputs are kept only in memory until exported. Event references are user declarations, not verified event identity or proof of independent measurement. Agreement does not validate the physical model or infer a unique soil property.


Cross-event receiving composed with main `3a0eef61`: **63 native tests and 25 actual-browser groups passed**, including visually inspected desktop and 390-pixel cross-event results with active sandbox admission. See the [qualified cross-event receipt](docs/receiving/cross-event-71a7-20261024/README.md) for exact source, environment, historical runs and scientific boundaries.

## Compare collected runoff

The **collected-runoff evidence** panel compares source-attributed collection volumes against explicit outlet coefficients using the existing solver's cumulative edge outflow. Record the event, complete-boundary collection arrangement, time interval, original units and evidence role. Calibration volumes order candidates; held-aside volumes challenge them without changing that order. The record stays bound to its observed site and weather, survives ordinary project export/import and reload, and never adopts an outlet setting. See [Collected-runoff evidence](docs/OUTLET_EVIDENCE.md) for interval interpolation, source binding, controls and physical limits.

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

### Proposal effects across infiltration hypotheses

The **Does the proposal still help?** panel carries the saved investigation rates into paired existing/proposed simulations. One hypothetical surface capacity is applied consistently to both scenarios under the same weather. All other surface capacities stay at their defaults; this transfer assumption may fail when an intervention changes soil condition. Inspect each pair, signed metric ranges, sign reversals and every cell that deepens under at least one candidate. Peak-depth differences compare separate scenario maxima, which need not occur simultaneously.

Choose all candidates, calibration-compatible candidates or candidates compatible with both calibration and held-aside readings. Filtered results require the corresponding assigned evidence; a contradicted set is empty, never replaced by its closest fit. The evidence scenario is shown explicitly. These are finite alternatives, not confidence intervals, physical bounds or an overall recommendation. Nothing adopts a rate or changes the project. Edits invalidate results. Work is bounded to 3 million candidate cell-steps, counting the evidence pass conservatively. `tests/intervention.test.mjs` covers analytic reversal, identical plans, evidence exclusion, proposal-target filtering, dry/absent cases and budget refusal; `tests/intervention.receiving.mjs` exports the real browser course.

### Ask a decision-focused depth question

Within the proposal comparison, select an outcome and a prospective measurement tolerance, then **Find a decision-focused reading**. Only calibration-compatible hypotheses enter this question, regardless of the comparison filter above; held-aside values never tune it. The question requires candidate pairs predicting opposite proposal effects and maximizes their smallest predicted depth separation across unrecorded solver cell/time points. This can choose a different time than the existing largest-overall-spread question. Equal-effect candidates remain visible but are outside the opposite-pair score.

The report compares the minimum separation with twice the supplied ± tolerance. Touching or overlapping bands cannot separate every opposing pair at that tolerance; disjoint predicted bands are a model-conditioned property, not a guarantee about a field reading or model error. No reversal, no compatible calibration or no available separating point produces an explicit explanation instead of a recommendation. **Prepare this reading** fills only cell, time, observed scenario, held-aside role and tolerance in the existing notebook form; it clears any prior depth/source draft so that it cannot be attached to this new location or time. The person must still supply actual depth and source. All site/evidence edits clear derived questions. No physical intervention or measurement is authorized by this suggestion.
