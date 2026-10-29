# Experimental Earth

Turn a real place into an interactive environment for investigating changes to water, shade, heat, soil, vegetation and more. Explore a possible intervention, see what assumptions drive its predicted effects, make a useful measurement, and improve the model through contact with the actual place.

The product should help people understand and improve a courtyard, schoolyard, garden, farm boundary, neighborhood or other environment they care about. It connects spatial exploration, physical modeling, experiments and shared decisions. A beautiful simulation is a way to investigate a question, not proof that its answer is correct.

## Current state

**First runnable local workbench available.** The Rain Experiment Lab compares hypothetical rainfall, terrain and surface edits with explicit water accounting and an attributed observation notebook. This is a conceptual computation on invented starting conditions—not an environmentally validated forecast, site survey, authorized intervention or Nebius/model deployment. Read current source, issues and pull requests for subsequent progress.

## Watch the private courtyard investigation

A [source-pinned, 82.7-second silent walkthrough](docs/demos/courtyard-2026-10-27/experimental-earth-courtyard-private-demo.mp4) shows the actual local workbench comparing a copied courtyard, changing one proposed cell, inspecting matched-time rain maps, retaining an attributed reading, exporting the project, and reopening that file in a fresh browser. [Reopen the exact demonstrated project](docs/demos/courtyard-2026-10-27/experimental-earth-site.json) or [inspect the demo provenance and reproduction instructions](docs/demos/courtyard-2026-10-27/README.md). This is a **private, fictional conceptual-model demonstration** recorded against historical source `d362f62bdc0773d840b0e82be4bf409720992630`, not field validation, current-head screen proof, deployment, or a public submission.

## Connect shade to surface and stored heat

**What does a shade change do to stored heat?** now connects the saved mapped
obstructions and geographic sun path with the declared surface and lower heat
stores. Compare a dated exposure, inspect the original blocker and incident-input
assumptions, and follow temperature ranges when column height or grazing leaves
mapped beam uncertain. The isolated authored courtyard example demonstrates a
morning-shade change without replacing the working site. Original site and raw
inputs can be downloaded and independently reopened. An original NASA POWER hourly
UTC JSON can now supply each hour's direct/diffuse radiation and ambient reservoir,
with its units, timestamps and full source retained. Constant-input investigations
remain supported. See [Shade and stored heat](docs/SHADE_HEAT.md)
for use, the retained mechanisms, midpoint approximation, input sources and tests.

## Recompute a portable rain project

**Recompute an exported rain site without opening a browser.** Run the read-only native command named inspect-rain-project.mjs with an exported project JSON path to get a source-SHA-256-bound machine-readable existing/proposed/delta water budget. This recomputes the base rain model only, not optional studies or field measurements. See [the headless comparison guide](docs/HEADLESS_RAIN_COMPARISON.md).

**Compare several saved proposals on one unchanged site.** The separate read-only
`compare-rain-proposals.mjs` recomputes 2–16 original exported site projects,
refuses differing original evidence or weather and reports each proposal's
source SHA-256, conceptual water-accounting changes and explicitly limited
absorption/depth tradeoffs. The receipt additionally preserves the original two-metric frontier and distinguishes a separate footprint-aware three-metric tradeoff; modeled changed cells are not physical cost or safety. See [the multiple-proposal guide](docs/RAIN_PROPOSAL_COMPARISON.md).

## Run the Rain Experiment Lab

The workbench also includes **How does a surface warm up and cool down?**, a
source-bound comparison of two declared uniform thermal layers at a chosen cell.
Supply absorption, heat capacity, linear exchange and a consecutive exposure
schedule; inspect the temperature history and signed energy accounting, then
retain it through ordinary project export/reopen. The fictional example exposes
a heating-versus-late-cooling tradeoff. See [the heat experiment](docs/SURFACE_HEAT.md)
for the exact model, retained sources, omitted processes and browser controls.
This is a declared-model experiment, with no inferred material properties or
physical heat/comfort validation.

The adjacent **Temperature Evidence** panel compares explicit material hypotheses
with sourced temperature intervals, keeping calibration and challenge readings
separate. It preserves indistinguishable alternatives and their different energy
implications, with raw evidence retained in the full project. See
[temperature evidence](docs/SURFACE_HEAT_EVIDENCE.md) for the finite comparison,
source association and the common-scale ambiguity that temperature cannot resolve.

Optional absorbed-energy intervals can challenge that ambiguity while retaining
all original temperature evidence. Supply an explicitly absorbed quantity with
start/end times, a source and a bound; inspect every residual and reopen the
versioned raw inputs. Incident energy and net stored heat are distinct quantities.
The authored control illustrates the mechanism without claiming a measurement.

Run `npm run serve` (or `python3 serve.py`) from the repository root and open `http://127.0.0.1:8765/` in a modern browser. It is dependency-free and local-only. The launcher serves browser assets and the few explicitly linked example/method files, not arbitrary checkout files; it refuses foreign-host requests. Edit either 8×6 site grid with surface/height brushes, change rain assumptions, compare the matched scenarios, inspect water balance and time series, and save/reopen the full project via Export/Import JSON. Browser storage also retains the last workspace locally. If saved data cannot be reopened, the app retains its original text before opening the fictional example and offers **Download original saved data** near the top of the workspace. If the original string contains invalid Unicode, its download is a JSON recovery record with the unchanged original in its raw field. Recovery copies remain available on later visits and are removed only when you clear this browser’s site data. If storage cannot be read or the recovery copy cannot be saved, autosaving pauses so the original is not replaced; download the original when available and export your current workspace before leaving. A saved project change observed from another tab also pauses this tab’s saving until you reload. Open the site through a local HTTP server, not directly as a `file:` URL, because JavaScript modules may be blocked by file-origin security policy.

**Inspect both rain maps at one modeled time.** Choose **Water depth at the same time (mm)** in Cell visualization, then move through the retained event snapshots with the slider or Previous/Next. Both scenarios show the same instant, including a fractional final step. Time navigation preserves the site, evidence and unfinished entries; per-cell peak mode remains explicitly distinct from a simultaneous state. See [the rain-map time guide](docs/RAIN_MAP_TIME.md) for controls, an independent mixed-surface example and model limits.

The base project's **Export JSON** and **Import JSON** share a 4 MiB UTF-8 transfer ceiling, which admits a fully sourced 24×24 survey grid that exceeds the former 1 MB importer limit. Export refuses an oversized workspace without modifying it; Import refuses oversized or invalid files, and a pending file read cannot overwrite newer project edits or a reset. A retained source description is an authored claim, not independent provenance verification.

Run `npm test` with Node.js 20+ for the native conservation and record-validation suite.

Optional actual-browser receiving: with a locally available Chrome/Chromium and Node.js 22+, run `npm run browser-receive` (override `CHROME_BIN` with an absolute path if necessary). On Linux, the maintained HAMON Chromium owner starts an exclusive browser profile and ephemeral CDP port; this product starts an ephemeral HTTP server and requires the maintained same-browser sandbox admission before product assertions. Use a verified installed binary such as `/opt/google/chrome/chrome`, since wrappers may alter launch flags. Concurrent courses are isolated. Each unique `.browser-run-<uuid>` directory retains the screenshot, browser logs and session receipt (or set an absolute, new `BROWSER_RUN_DIRECTORY`). Python is no longer required for the Linux course. The automated session owner currently qualifies Linux only and explicitly refuses other platforms; ordinary browser use of the product remains platform-independent. See `tests/support/README.md` for runtime controls and provenance. A successful UI test does not establish physical field validation.

**Physical boundaries:** The model is a deliberately simplified finite-volume surface transfer on constant-infiltration cells, with an open edge and no measured calibration. Its arithmetic conserves rainfall within tolerance; it does not quantify actual flood risk, stormwater compliance, soil response or intervention benefit. Real readings can be recorded with method and ± uncertainty, but do not automatically tune the model. Sampling suggestions identify the largest simulated scenario difference, not validated information gain. No external data or inference endpoints are called.

## Find an investigation

Use **Find an investigation** above the site editor to search the existing questions
and their introductions, or browse all mounted workbenches. Open a result by mouse,
Tab, or Enter from the search field; a return link brings you back from a distant
panel. Native links reopen the same investigation without changing project data.
See [navigation and keyboard use](docs/INVESTIGATION_NAVIGATION.md).

## Follow rain from part of the site

The **Where does rain from this area end up?** panel traces rain from selected
source cells through the existing water calculation. Compare where that water
infiltrates, remains on the surface or leaves the boundary under each proposal.
Both destination maps share a scale and preserve the same source area and
storm. A modeled-time control reveals temporary contributions at exact saved
steps, with cumulative infiltration/outflow and the attributed water still
present. Large timeline requests retain a clearly labeled final-only view. The source selection survives project export/import; changed model
inputs require a fresh calculation. This is conserved model attribution under
a complete-cell-mixing assumption, not observed physical pathways. See
[Rainfall attribution](docs/RAIN_ATTRIBUTION.md) for the calculation, controls and
interpretation limits.

## Inspect an unknown surface property

### Follow the water at a selected cell

**Trace both scenarios**, below the site totals, explains each cell's whole-event rain, incoming and outgoing neighbor water, infiltration, boundary exit and final storage in liters. Compare the component changes between the saved plans, then follow a neighboring cell to inspect its contribution. Both travel directions remain visible; repeated crossings are not unique water-parcel provenance. Site/weather edits clear the derived result; ordinary project export/import preserves its inputs for recomputation. See [local water accounting](docs/LOCAL_WATER_ACCOUNTING.md) for the conservation relation, interactive work limit and verification boundaries.

**Probe infiltration assumption** tests the effect of replacing only one proposed cell's authored infiltration parameter with an illustrative lower or upper example bound. It ranks modeled **water not absorbed** (water left through edges plus final standing water), separately from the existing button that suggests measuring where the *two scenarios* disagree. On imported grids over 96 cells it visibly reports a 36-cell heuristic shortlist; it does not claim a globally optimal recommendation. Bounds are neither measured local soil data nor confidence intervals. Use the separate ponding-depth form only for water-depth readings, not permeability tests.

## Challenge competing infiltration rates

### Investigate changing soil absorption

The **What changes as the soil wets?** panel compares explicitly declared
Green–Ampt wetting-front explanations with the current fixed-rate model. Enter
conductivity and capillary-drive alternatives, inspect matched existing/proposal
water outcomes and selected-cell curves, and challenge each explanation with
the original calibration and held-aside readings. Save the complete input
investigation and reopen it for independent recomputation without replacing the
working site. This is an event-scale model comparison, not automatic soil
identification or field validation. See [the mechanism, controls and use](docs/WETTING_FRONT.md).

Optionally include a depth-reading question with an explicit cell scope, event
window and measurement uncertainty. The comparison reuses trajectories from
compatible explanations to find their largest unrecorded depth difference, displays every
predicted reading band and retains unresolved pairs. Preparing a question uses
the ordinary notebook and leaves the measured value/source empty. Saved inputs
recompute the question on reopening; held-aside values never select it.

### Compare constant-rate alternatives

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

Preview shows the interpreted millimetres and roles without changing the notebook. The complete original table must pass validation before row choices appear, including the existing 100-row source limit. No rows are selected automatically. Choose the original source lines to add, or **Choose all rows**, then choose **Add selected readings**. Only selected readings enter the notebook, in original table order. A duplicate selected reading or notebook-capacity overflow refuses the entire append without changing existing readings; correct the choices and try again. Unselected duplicates do not prevent adding new readings. A changed project or station map invalidates the preview.

The supplied filename, starting row and original quantities remain alongside each reading through export/import and reload; conversions are checked when reopening projects. **Download original CSV** keeps the complete original bytes, including unselected rows. **Save original table + map** and **Open saved table + map** preserve a separate original-source bundle with the exact supplied mapping text; reopening requires explicit preview and row selection. After append, the whole original and the map used by that preview remain available for download. Save them before changing the project. See [original observation source and row choices](docs/ORIGINAL_OBSERVATION_SOURCE.md).

Provenance and user-assigned roles do not establish physical truth or statistical independence. No file contents leave the local application.
## Challenge a hypothesis across storms

The **Do the hypotheses survive another storm?** panel transfers the finite infiltration alternatives from the current calibration study to a separately saved storm project. Give distinct event references, load a second project with readings explicitly held aside for the same observed scenario, and compare. Geometry, surfaces, grid scale, transfer/outlet assumptions and solver step must match; rainfall and event duration may differ. The second event never changes calibration ordering. A candidate must satisfy calibration, any first-event holdout, and the second event's stated bands to survive.

Expand each candidate to inspect second-event predictions, signed residuals, interpolation brackets and measurement sources. Export two-event evidence to retain both complete project snapshots, chosen candidates and references; reopening recomputes results and does not replace the active workspace. Changing workspace assumptions clears the displayed comparison. Second-event inputs are kept only in memory until exported. Event references are user declarations, not verified event identity or proof of independent measurement. Agreement does not validate the physical model or infer a unique soil property.


Cross-event receiving composed with main `3a0eef61`: **63 native tests and 25 actual-browser groups passed**, including visually inspected desktop and 390-pixel cross-event results with active sandbox admission. See the [qualified cross-event receipt](docs/receiving/cross-event-71a7-20261024/README.md) for exact source, environment, historical runs and scientific boundaries.

## Compare collected runoff

The **collected-runoff evidence** panel compares source-attributed collection volumes against explicit outlet coefficients using the existing solver's cumulative edge outflow. Record the event, complete-boundary collection arrangement, time interval, original units and evidence role. Calibration volumes order candidates; held-aside volumes challenge them without changing that order. The record stays bound to its observed site and weather, survives ordinary project export/import and reload, and never adopts an outlet setting. See [Collected-runoff evidence](docs/OUTLET_EVIDENCE.md) for interval interpolation, source binding, controls and physical limits.

## Compare joint soil and outlet explanations

The **joint evidence** panel compares 2–12 explicit infiltration/outlet pairs against collected runoff and selected same-event depth readings. Its prediction plane exposes equal-volume explanations with different ponding depths; the full table keeps each reading's native units, tolerance, role and interpolation brackets. No combined score ranks unlike quantities, and held-aside evidence never chooses a pair. Source changes retire the comparison until the association is reviewed. See [Joint soil and outlet evidence](docs/JOINT_EVIDENCE.md) for the authored ambiguity control, ordinary export/reopen workflow and scientific limits.

## Challenge joint explanations across storms

The **Will these explanations survive another storm?** panel carries the current fixed infiltration/outlet pairs to a separately retained event. It compares explicitly held-aside collections and associated depths without changing pair values, first calibration or the active workspace. Download both source snapshots and reopen to recompute. See [Joint event challenge](docs/JOINT_EVENT_CHALLENGE.md) for the independently calculated two-storm control, source/model admission, bounded work and limits of the supplied independence declaration.

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

The water-attribution section also explains **which rainfall origins supplied a chosen destination**. Select destination cells and final storage, cumulative infiltration or boundary outflow to compare paired origin maps using the same maintained water transfers. See [rainfall attribution](docs/RAIN_ATTRIBUTION.md) for assumptions and receiving controls.


### Compare depth and collected-volume measurement options

The decision-question panel can compare local depth with an explicitly available whole-boundary collection. Set the prospective depth tolerance, opt into collection availability, and specify its duration and tolerance in liters. The model computes each opposing-pair gap divided by twice that measurement's tolerance. The largest band margin is a declared-precision comparison, not a probability, cost estimate or information-gain optimum. A margin above one indicates disjoint opposing prediction bands under these assumptions; model error remains outside the comparison.

Candidates come from the saved depth-calibration study, with the outlet coefficient fixed. Collected values never fit or select the question. Their retained intervals exclude overlapping collection suggestions. A mismatched retained collection event/scenario blocks that option. Starts lie on retained solver snapshots; nonaligned ends disclose cumulative-volume interpolation. No reversal or distinguishing signal creates no invented option. Computation is bounded to three million cell-steps across at most five solver passes per original candidate.

**Prepare collection reading** uses the maintained collected-runoff form. It fills only interval, liters/tolerance and held-aside role, clears stale value/source drafts, and leaves coverage unasserted for a new record. A valid existing record keeps its event and collection identity. Actual volume/source and explicit coverage are required before submission retains evidence. Depth preparation reuses the existing notebook callback. Changed settings or project inputs invalidate derived options. These controls do not authorize a collection or establish physical observability.

## Import a supplied elevation grid

The terrain section also receives **original ESRI ASCII elevation rasters**: select a source window, preview its original samples and apply them to either or both site grids without per-cell CSV transcription. Original units, coordinates, file identity and the local vertical reference survive project export/reopen; unspecified measurement uncertainty stays unspecified. See [raster intake and its actual USGS source control](docs/TERRAIN_RASTER.md).

The surveyed elevation panel accepts a complete CSV for the current grid with columns `cell,elevation,uncertainty,unit,source`. Units are `m`, `cm`, or `mm`; elevation and supplied ± uncertainty share the row unit. Supply a common named local datum and grid cell spacing. Spacing must equal the current model cell width. Elevations must lie between −10 and 10 metres relative to that datum; absolute geographic heights need an explicit local reference before import. No datum or geographic registration is inferred.

Preview is read-only. Apply replaces only the selected scenario's elevations and provenance while retaining its surfaces, the other scenario and observations. Check whether retained observations still describe that geometry. All grid cells must appear exactly once; malformed, incomplete, duplicate or out-of-grid rows refuse the entire import. A changed project or changed preview settings invalidates the preview. File, physical source line, original unit quantities, datum and spacing survive portable JSON and reload. Inspect a cell to see its supplied source. Raising or lowering a cell discards its obsolete survey origin; surface-only edits retain the elevation origin.

The solver uses central elevations and does not propagate supplied uncertainty. Retaining provenance does not verify a survey, cell registration, environmental forecast or intervention. This table path uses the existing bounded CSV reader (128 KB maximum); grids remain limited to 24×24 cells. Run `node tests/terrain-browser.receiving.mjs` with the same browser prerequisites as the existing receiver for the dedicated import course.

## Follow ponding through time

The **Ponding through time** panel replays both scenarios at the same selected minute. Select a cell in either replay map to inspect its total time strictly above a chosen depth and each separate wet interval. Proposal minus existing reports the duration change for that cell, using the same modeled event. Ordinary site/weather edits and project imports refresh the diagnostic. Replay minute, selected replay cell and threshold are temporary inspection controls; saved project assumptions remain unchanged.

Crossings and intermediate depths use linear interpolation between retained solver snapshots. Dry gaps or peaks between snapshots can be missed; a smaller time step may change the reported duration. Threshold duration is a modeled diagnostic, not a field observation or a flood/access-safety rating.

The ponding detail also reports **accumulated depth above threshold** in mm·min: the area under the positive depth-minus-threshold curve, using the same linear interpolation. It distinguishes a deep brief episode from a shallow long one without assigning a damage or safety score. If the first or last retained snapshot is still above threshold, the panel explicitly states that earlier onset or later clearance is unknown outside the modeled horizon.

## Inspect ponding across an authored connected route

Below **Ponding through time**, declare a sequence of different, edge-adjacent grid cells such as D3 E3 F3 and select **Inspect declared route**. The review reuses the replay minute and depth threshold. It identifies the deepest listed cell at that minute and computes the continuous modeled intervals when **all** listed cells are simultaneously at or below the selected threshold. Existing and proposed sites are evaluated under the same weather; their displayed duration difference is arithmetic, not a safety conclusion. The same source snapshot interpolation used by the individual-cell workbench is preserved. The route is a session-only question; project export retains the underlying site, not the unsourced route declaration.

**Limit:** This does not show a moving person's passage along a path, independently measured depths, physical accessibility, flood safety or environmental calibration. Different arrival times, omitted cells, intra-step peaks and changing ground conditions can invalidate practical assumptions. Use sourced measurements and appropriate expertise for real-site decisions.

## Compare internal walls and openings

Select a cell and use **Walls and openings** below the paired site maps to close an internal connection or restore an opening in either scenario. Add a source or hypothetical assumption; dark map lines show closed edges. Water can reroute through remaining gaps, and all maintained rain comparisons and attribution consumers use the same connectivity. Declarations survive ordinary export/import, reload and copying the existing site into the proposal.

Closed edges stay impermeable for the full calculation; wall height, overtopping, leakage and structural strength are outside this model. Exterior outlets retain their existing assumptions. Cross-storm comparisons require the same wall/opening geometry. See [Internal walls and openings](docs/INTERNAL_BARRIERS.md) for the representation and independently calculated controls.

## Declared finite internal crests

The wall/opening inspector also accepts a sourced absolute crest elevation in the site ground datum. Blue edges can carry modeled overflow above their declared crest. A donor-layer limiter shares upper storage with every competing outlet, while old open/closed projects retain their exact calculations. See [the model, time-step dependence and source limits](docs/INTERNAL_BARRIERS.md). This is a conceptual mechanism, not calibrated hydraulic or structural evidence.

## Separate the parts of a proposal

**Which parts of the proposal work together?** lets you select some physically edited cells as component A; remaining edited cells form B. The workbench runs the existing site, A only, B only and the complete proposal under identical weather and default authored surface capacities. Each cell carries all of its changes together, including canonical east/south closed edges and finite crest declarations. An edge belongs to its west/north cell even when it is inspected from the opposite side. Source-label-only edits are excluded.

The table shows all four modeled quantities and signed differences from existing. Interaction is `full − A − B + existing`: the portion of the full effect not explained by adding the separate effects. A negative interaction means a smaller modeled quantity than that additive sum; whether that is useful depends on the quantity and location. For maxima, nonzero interaction can arise solely from a change in which cell or time supplies the maximum; it does not by itself establish water exchange between components. Expand the result to inspect final depth and interaction at every cell, including cells outside the edited area.

This is a four-case model experiment, not a causal estimate from observations, an optimized plan or an inference-calibrated recommendation. It does not use a selected infiltration hypothesis set or automatically adopt a change. Existing plans, observations and provenance remain unchanged. Select at least one edited cell and leave another in B; calculations exceeding one million estimated cell-steps are refused. Results and the temporary partition clear on reopening, and changed project inputs clear results. Reopened saved plans can be partitioned and recomputed.

Run `node tests/proposal-components.test.mjs` for analytic independent-cell, coupled-flow, canonical-edge, conservation, complement-symmetry, immutability and refusal controls. Run `CHROME_BIN=/opt/google/chrome/chrome node tests/proposal-components.receiving.mjs` for the dedicated actual-browser course using the maintained sandbox admission. Neither test course establishes environmental accuracy.

### Do component effects depend on the infiltration hypothesis?

The component experiment can explicitly propagate the current infiltration study instead of using default capacities. Choose all current rates, calibration-compatible rates, or rates compatible with calibration and held-aside observations. These filters use the numeric-depth notebook through the maintained infiltration study; separate threshold and collected-runoff evidence records are not silently associated. The unchanged observed source is evaluated once before any component worlds are constructed. Evidence from a full observed proposal is not reused as though it had been observed in a partial proposal.

Every retained rate is applied to its matching surface in all four worlds, with other capacities fixed. The panel shows finite interaction ranges and sign changes, every retained rate's component effects, and a rate selector for inspecting its full four-case table and local depths. Different metric endpoints can come from different rates and cannot be combined as one water budget. Selecting a displayed rate does not adopt it. Calibration selection ignores held-aside values; the surviving subset can be narrowed by those values without refitting. Missing or contradictory evidence yields an explicit uncomputed result, not a replacement closest fit. A surface absent from the observed source cannot receive evidence-filtered support; an all-declared comparison remains possible when that surface is present in a proposed alternative.

For the authored courtyard split D3/D4/D5 versus E3/E4/E5, the edge-outflow interaction is approximately −7.898 L at a sealed-surface capacity of 1 mm/h and +17.126 L at 9 mm/h. This is an implemented model sensitivity, not a probability, confidence interval or physical identification. Even stable interaction does not validate the field model. Maxima can interact because their maximizing cell or time changes, without direct water exchange.

The one-million-cell-step combined limit conservatively includes a source-evidence simulation and four component simulations per original candidate, before any filtering. `tests/component-hypotheses.test.mjs` exercises this reversal, fixed-source evidence selection, held-aside independence, proposal-side evidence, absent-surface admission and work refusal. `tests/component-hypotheses.receiving.mjs` is the dedicated browser course; its execution is required before qualification.

### Separate surface changes from elevation changes at the same place

Choose **Surface versus elevation edits** in the component panel to compare all proposed surface changes as A and all proposed elevation changes as B. Both can affect the same cell: a planted depression can now be examined as surface conversion alone, lowering alone, and both together. The same four-case arithmetic, local depth inspection, default capacities and original-source infiltration hypothesis filters apply. The existing cell-group mode still keeps every change within each selected cell together.

Surface-only cases retain existing elevations and their terrain records; elevation-only cases retain proposed elevations and their terrain records. Derived combinations identify their mixed origin and never overwrite either saved source plan or reinterpret a measurement as an observation of the mixture. Internal walls and finite crests must have the same physical settings in both plans. A changed edge is a third factor, so this two-factor mode explicitly refuses it; use cell groups to compare such proposals. Both surface and elevation edits are required, and this rain-model experiment does not evaluate solar declarations.

For example, in the authored courtyard, copy existing to proposal, turn D4 into a rain garden, and lower it twice (5 cm). At default capacities, the separate final-storage effects are approximately −320.915 L for surface conversion and +75.469 L for lowering; the full change is −249.994 L, including −4.548 L of interaction. These are model outputs for an authored example, not measurements or a recommendation. Use the local depth table to inspect where water remains; a site storage change alone does not describe local ponding.

Run `node tests/surface-elevation.test.mjs` for direct four-world, co-located/disjoint edit, terrain-source, fixed-crest, conservation, source-evidence and refusal controls. Run `CHROME_BIN=/opt/google/chrome/chrome node tests/surface-elevation.receiving.mjs` for the actual editor-to-comparison-to-reopen browser course, including continued keyboard rate inspection and desktop/mobile result captures.


## Compare a dated sun path

The **How does direct-sun obstruction change through the day?** panel connects the saved columns to explicit geographic coordinates, a sourced true-north grid bearing and UTC sampling times. Inspect changing paired ground-centre results and their original witnesses without replacing the saved single-direction study. Calculations stay local; below-horizon and low-elevation samples remain explicit, and discrete counts do not imply hours of shade. See [dated sun paths](docs/SUN_PATH.md) for use, source pins, privacy, sampling limits and verification.

After comparing, **Save investigation with location and site** retains the original project and dated declarations in a separate input-only JSON file. Reopen that file to recompute and inspect its original grid alongside whichever project is active. No saved verdict is trusted and the active project is unchanged. The file includes geographic location and site sources; ordinary project export still omits the temporary dated-path draft.

### Heat retained below the surface

The saved surface heat experiment can now add a sourced lower heat store for each existing/proposed place. Compare the two temperature traces, inspect delayed interior peaks after heating stops, and follow absorbed input, ambient exchange, internal transfer and stored energy separately. The original exposure and place remain bound to the declaration; whole-project reopening recomputes the result. This is a two-store model with an insulated bottom, not a resolved depth profile or inferred material calibration. See [the equations, workflow, controls and limits](docs/HEAT_COLUMN.md).

### Heat exchange with a deeper reservoir

The **Does a deeper reservoir change heat recovery?** panel compares the saved insulated two-store course with explicitly declared bottom conductance and reservoir temperature. Inspect both surface and lower temperatures, delayed maxima and the signed cumulative heat exchange. Download and reopen the original investigation independently of the active site. This is a declared constant boundary, not a measured depth profile or inferred soil calibration. See [the lower-boundary workflow, equations and receiving controls](docs/BOTTOM_HEAT.md).

### Surface evidence for hidden heat stores

Compare sourced surface-temperature bands against explicit lower-capacity/conductance alternatives while keeping the original column, initial temperatures and exposure fixed. Structured cards preserve calibration and challenge roles; linked surface/lower curves and a remaining-peak spread show what those readings distinguish and what stays unresolved. One survivor refers only to the offered finite set, not unique physical parameters. Whole-project reopening recomputes the investigation. See [the workflow, five-explanation control and numerical limits](docs/HEAT_COLUMN_EVIDENCE.md).

Readings can also declare an **interval mean**, with explicit start and end. The model integrates across every forcing change inside that window, and the plot shows its full support. [The interval-mean workflow](docs/HEAT_COLUMN_AVERAGES.md) includes a portable NOAA Tucson hourly example that preserves the acquired source values and rejects the unchanged illustrative alternatives without fitting.

### Choose another surface-temperature reading

The **When could a surface reading distinguish hidden stores?** panel compares
prospective instantaneous or interval-mean readings across calibration-compatible
two-store alternatives. Mean questions retain an explicit sensor averaging duration
and complete time support. Declare a time window, a bounded sampling grid and a measurement
half-width; inspect the proposed time, every predicted band and every unresolved
pair. Challenge values never select the question, and no observed value or source
is fabricated. See [the prospective heat-reading question](docs/HEAT_COLUMN_QUESTION.md)
for its finite-grid selection, original-source custody and limits.

## Challenge a supplied ground-height uncertainty

The surveyed-ground sensitivity panel compares low, central and high values for one supplied existing-site elevation while preserving the authored proposal height change under an explicit shared-error assumption. Inspect paired water quantities and local depth changes; a sign reversal exposes dependence on the selected ground uncertainty. Explicitly request 5, 9 or 17 equally spaced samples to investigate interior reversals that the initial three can miss. No offered sample count bounds the continuous interval. Original survey records and saved plans stay unchanged. See [the experiment, source rules and authored reversal](docs/TERRAIN_SENSITIVITY.md).

## Water retained for roots after a modeled storm

The **How long does water remain available to roots?** panel carries each source cell’s modeled infiltration into an attributed rooted-soil store and follows the same declared dry-period transpiration demand in both places. Inspect retained recharge, excess drainage, supplied and unmet demand, and the original-source water account through time. Save and reopen the complete input-only investigation without replacing the active site. This is an explicitly simplified plant-water model, with no inferred soil or crop properties and no field or irrigation qualification. See [the root-zone model, workflow and controls](docs/ROOT_ZONE.md).

## Retained rain and conditional evaporative cooling

**Can retained rain sustain a cooler surface?** now connects modeled rain
infiltration, attributed rooted-water stores and the saved two-store heat
exposure. Declare plant transpiration demand and the fraction of latent energy
taken from the effective thermal surface, then inspect water use and cooling
together. The analytic response follows water stress without averaging its
changing heat loss over a chosen step. Save and reopen the complete original
investigation separately from the active site. An isolated fictional courtyard
demonstrates the mechanism. See [evaporative cooling](docs/EVAPORATIVE_COOLING.md)
for the workflow, equations, sources, verification and physical limits.

## Discover a different same-time ponding connection

**Can a different connection avoid deeper ponding?** compares two endpoints
within an explicitly offered cell footprint at every original modeled time.
It finds the minimum achievable maximum depth, then shows a shortest witness
among equal-depth connections. The full existing/proposal course and raw-input
save/reopen support an independent investigation without adopting a changed site.
This is depth-only grid connectivity; walls, slopes, movement, physical access
and safety are not assessed. See [Ponding connections](docs/PONDING_CONNECTIVITY.md)
for the algorithm, authored detour example, source custody and limits.


### Test the cooling association with original surface readings

After comparing a retained-rain cooling source, explicitly retain it for a surface-reading investigation. Original instantaneous or complete interval-mean bands constrain one constant surface latent fraction while water, demand, materials and heat exposure remain fixed. Calibration and held-aside intersections stay separate; no fraction is selected or adopted. Inspect exact-time temperature ranges and save/reopen the original source. See [Cooling readings](docs/COOLING_READINGS.md) for the model, authored separating/nonseparating controls and qualification.

## Connect original notebook bands without filling unmeasured cells

**What do the notebook bands establish?** uses original sourced depth readings
at one exact scenario and minute to inspect a declared endpoint/footprint question.
It distinguishes a band-supported path, a separating boundary of above-threshold
bands, unresolved unmeasured cells, conflicting repeats and numerical contact.
Every original source and role remains inspectable; no simulated depth fills the
gaps. Download and reopen the original inputs independently without replacing the
working site. See [Observed-band connectivity](docs/OBSERVED_CONNECTIVITY.md) for
the conditional logic, source assumptions and physical-access limits.

### Original standing-water inventory

The evidence map can also bound simultaneous standing-water volume from original depth bands under an explicit cell-representativeness assumption. Missing cells leave the whole-site upper bound unknown; contradictory bands refuse aggregation. See [Observed storage](docs/OBSERVED_STORAGE.md).

### Challenge one-sided bounds with another storm

After comparing original one-sided depth evidence and proposal consequences, open **Do these rates transfer to another observed storm?** in the same source panel. Load a separately declared event with held-aside bounds to challenge the unchanged offered rates and inspect how the original proposal's consequences narrow or remain unresolved. Save/reopen retains both original projects and the exact study; current source remains unchanged. [Original-source transfer, receiving and limits](docs/THRESHOLD_EVENT_TRANSFER.md).

## When a shallow receiving layer fills

**What changes when the ground has no more room?** compares the same original site and storm with an explicitly finite, closed receiving layer. Water that cannot enter stays in the maintained surface-flow calculation, where it can pond, move to another cell or leave the boundary. Inspect the paired consequences and original-cell water accounts, then save/reopen the original inputs without adopting a changed site. The fictional shallow-bed example shows why a fast infiltration rate alone does not establish enough receiving space. See [Closed receiving capacity](docs/INFILTRATION_STORAGE.md) for the model, its no-drainage boundary, source declarations and verification.


### The same proposal under both original storms

After reopening or completing a two-event threshold investigation, choose **Compare the plan in both source storms**. Both original files must declare the same existing and proposed physical plans. Every surviving soil rate is carried unchanged through both storms, and each event keeps its original forcing and modeled horizon. The view reports per-event effects and same-rate direction reversals separately from uncertainty across rates. The existing source-only investigation replays the calculation. See [the storm consequence guide](docs/STORM_CONSEQUENCES.md).

## When drainage frees receiving space

**Can drainage keep receiving space available?** adds a declared draining layer
to the same original surface-water calculation. Compare unlimited receiving,
the same layer kept closed, and continuous drainage while water enters. Inspect
surface ponding, initial below-ground water, retained storage and drainage
separately; save and reopen the original investigation without replacing the
working site. The local layer handles filling and emptying transitions while
the existing horizontal routing retains its numerical limits. See
[Draining receiving layers](docs/DRAINING_LAYER.md) for equations, source custody,
the fictional 124 L versus 46.25 L standing-water control and qualification limits.

### Challenge receiving explanations with original readings

Within the draining-layer investigation, offer distinct storage/initial-water/drainage combinations and compare them with original notebook point readings. Calibration admits hypotheses; held-aside readings can contradict them without refitting or hiding rejected alternatives. Inspect paired consequences over the explicitly supported finite set, then save/reopen the complete original investigation. [Receiving-evidence workflow and limits](docs/DRAINING_EVIDENCE.md) includes an authored case where identical early depths separate later.

**Can water below ground distinguish these explanations?** adds original whole-footprint receiver inventories and cumulative-drainage readings to the same unchanged forward model. Keep calibration and held-aside roles, inspect explicit measurement offers without invented observed values, and save/reopen a separate original account. The authored example has indistinguishable surface courses but distinct below-ground inventories; [receiving-water accounts](docs/RECEIVING_ACCOUNTS.md) explains the physical quantities, source association, question selection and verified limits.

**Infer receivers without supplying their initial water** uses the copied original account to propose capacity, initial water and drainage together. It supports wet-surface readings, two late retained-water readings, or three late cumulative-drainage readings with unequal time spacing. Both late capacity branches remain visible; every proposal must pass all original calibration bands before held-aside readings challenge it. Inspect a separating offered measurement and save/reopen only the original inputs. The [inverse workflow and qualification](docs/RECEIVING_ACCOUNT_INFERENCE.md) explain its explicit phase assumptions, finite coverage, complete work limits and unresolved cases.


### Compare surface and lower-store measurement questions

After saving heat-column evidence, **Would a lower-store reading distinguish more explanations?** compares both modeled channels over the same declared time grid. Declare separate prospective precision and an explicit lower-sensor association, inspect every offered question, and download/reopen the original inputs. The existing five-model pulse control separates 9 of 10 pairs with its best surface question and 10 of 10 with a lower-store question at identical ±1 °C bands. This is conditional model discrimination, not a measured depth or a sensor-installation recommendation. See [channel questions](docs/HEAT_CHANNEL_QUESTION.md).

### Receiving-layer search with original measurement uncertainty

The receiving-account inverse now offers **Search the original calibration bands**. It retains the analytic proposals, fits only original calibration readings, and validates each numerical receiver on the complete original site before held readings challenge it. The authored uncertainty example demonstrates an analytic-center failure followed by supported numerical witnesses; saved inputs reopen and recompute the chosen method. See [mechanism, receiving evidence and limits](docs/RECEIVING_ACCOUNT_BAND_SEARCH.md).

**What do these receiver explanations mean for the proposal?** carries every generated calibration-compatible receiver through the maintained existing/proposal comparison. Declare the shared material and initial-water basis, inspect the complete finite consequence range and separate held-aside failures, then save/reopen only original inputs. [Paired consequences](docs/RECEIVING_ACCOUNT_CONSEQUENCES.md) includes the complete combined-work reservation, source custody and receiving evidence. The separate [measured C1 drainage diagnostic](docs/RECEIVER_TAIL_MEASURED_C1.md) preserves a useful model ambiguity and adverse alternatives without turning unobserved surface water into a soil-property claim.

**Try uncertain late retained water** exercises a missing-start case: increasing measured centers can still contain a decreasing course within their original bands. The bounded search now seeks such witnesses through a conditional retained-band start and the unchanged kernel. The authored example finds a calibration witness that later original receiver readings reject; the paired comparison preserves that distinction. [Retained-band starts and independent outcomes](docs/RECEIVING_RETAINED_BAND_STARTS.md) records eight calibration-supported cases out of fifteen independent authored inputs, only one also supported by the held readings, and every unresolved or contradicted result.

**Include filled and never-filled alternatives** optionally adds finite phase witnesses while preserving that search. The never-filled example exposes why different arbitrary capacities can pass the same original readings without identifying capacity, and carries every supported alternative into the paired comparison. [Phase alternatives, runtime correction and limits](docs/RECEIVING_PHASE_ALTERNATIVES.md) separates the first independently authored 16-course result from the corrected consumed replay: calibration coverage expands, while informative held support remains one case out of 16.

An original cumulative-drainage calibration reading now constrains the never-filled candidates during that optional search. Enter the reading in the existing account form and explicitly copy the updated originals; saved investigations keep the original rows and recompute on reopening. [Drainage conditioning and independent comparison](docs/RECEIVING_DRAIN_CONDITIONING.md) records five supported cases out of seven eligible new authored inputs, compared with one before the change, while preserving both unresolved cases, arbitrary capacity ambiguity and the limits of finite model witnesses.

Original drainage now also constrains a bounded family of receivers that filled during rain. The same phase-alternative action and paired-layout consumer retain every supported model and original role. A separately frozen independent comparison improves calibration-and-later-reading coverage from six of seven eligible cases to seven of seven; all twelve original cases and the five predeclared exclusions remain recorded. See [filled-course mechanism, receiving and limitations](docs/RECEIVING_FILLED_DRAIN_CONDITIONING.md).
