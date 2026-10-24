# Follow rainfall from a source area

The Rain Experiment Lab can attribute the modeled fate of rain falling on one
or more chosen grid cells. This helps investigate questions such as whether a
proposed garden captures rain arriving from a neighboring paved area, or whether
a grade edit shifts that area's contribution to another part of the site.

## Use the workbench

1. Select **Inspect** and choose a cell in either existing site map.
2. In **Where does rain from this area end up?**, use that cell or add it to the
   source area. Remove individual source chips or clear the area to start again.
3. Select **Trace this rain in both sites**. Both alternatives use the same
   source cells and the same storm.
4. Compare the three final fates: infiltration, boundary outflow and surface
   water remaining at the end. Choose a fate to see its destination map, select
   a destination for exact displayed quantities, or expand the complete table.

The maps use a shared scale for the two scenarios. An outline identifies a rain
source cell; the selected destination has a gold inset. Values are liters
attributed to rain from the chosen area. They are not total water at that
destination: rain originating elsewhere can also be present. Boundary outflow
is counted at the cell where it left the modeled grid.

Changing the site, storm or source area retires the comparison. Ordinary
inspection does not. Project export/import and local workspace storage retain
`rainTraceStudy.sourceCells`; reopening requires a new calculation, rather than
restoring an old derived result. Existing projects without this optional field
continue to work. Invalid, duplicated or out-of-grid source cells are refused.

## What is being calculated

`runRain` accepts the optional argument
`{rainTrace: {sourceCells: [0, 1]}}`. Rain added to the selected cells is tagged.
The existing solver still determines every water amount, infiltration amount,
neighbor transfer and boundary transfer. The tag has no effect on any of those
calculations.

For a cell with total surface water depth `W` and tagged depth `T`, an
infiltration or outgoing water amount `q` carries tagged amount `q * T / W`
when `W > 0`. Infiltration follows rain addition. Neighbor and boundary transfers
use the post-infiltration concentration; all transfer changes are accumulated
before updating tagged storage. Incoming tags cannot travel onward again in
the same step. This matches the maintained solver's simultaneous, capped
transfer order.

The returned optional `rainTrace` record contains the tagged rain total,
infiltration and boundary losses by cell, final tagged storage by cell, total
fates and the attribution mass residual. By construction:

`tagged rain = tagged infiltration + tagged edge outflow + final tagged storage`

The optional record is absent from ordinary runs. Tests compare every ordinary
output, including all snapshots, for exact equality with tracing enabled.
Tracing all cells reproduces whole-site fate within floating-point tolerance.
Separate disjoint source areas add to their union; no source can be counted
twice in one study.

## Interpretation limits

This is a passive, completely mixed accounting method within the existing
conceptual surface-water model. It does not recover physical routes from
observations. The tag has no chemistry, settling, reaction, preferential flow
or subsurface transport, and does not describe a real contaminant or verify
travel time. Infiltration is a terminal fate in this model; an infiltrated tag
does not reappear later.

The destination maps show where the chosen final fate occurred, not every cell
crossed along the way. The result depends on the same authored elevation,
infiltration, mobility, outlet, rainfall and numerical interval assumptions as
the water simulation. Comparison of two modeled alternatives is not evidence
that a real intervention would produce the displayed effect. Independent field
observations and numerical sensitivity remain separate investigations.

## Verification

Run `npm test` for the native suite. The tracer course includes independently
calculated no-flow absorption, capped and uncapped splits, delayed second hops,
mixing before infiltration, partial and complete boundary exit, all-source
closure, disjoint-source additivity, unchanged water outputs, dry and fractional
storms, invalid source records and changed-terrain controls.

With a supported installed Chromium binary, run the maintained
`npm run browser-receive` course. It exercises source selection, paired maps,
analytically known destination quantities, invalidation, dry and identical-site
controls, ordinary project export/import, rejected-input preservation and a
390-pixel layout. The same maintained browser owner and sandbox admission are
used as the rest of the application. The course retains desktop and mobile
images in its unique browser run directory.

## Inspect temporary contributions

The source attribution panel initially displays the final calculation step.
Move the **Modeled time** control to inspect any exact retained step in both
scenarios. Displayed rain, infiltration and boundary exit accumulate from the
beginning; surface storage is the tagged amount still present at that time.
The maps and destination table update together. The control selects saved
steps without interpolating between them or claiming physical arrival time.

In the fictional courtyard, rain originating at cell27 contributes about
59.2624 liters of proposed-site surface storage at minute60, but none at
minute240. This is a reproducible modeled example of transient storage hidden
by the final map, not measured evidence.

Programmatic callers can request a timeline with
`compareRainTrace(project, {timeline: true})`. Direct solver callers use
`rainTrace: {sourceCells, captureSteps: true}`. Tagged snapshots use the
maintained replay shape `{minute, depthsMm, storedLiters, absorbedLiters,
exitLiters}`, plus cumulative tagged rain and per-cell cumulative fate arrays.
Here `depthsMm` is attributed volume divided by cell area, not total local water
depth. Consumers must preserve that attribution label. Existing whole-water
replay and threshold/exposure modules retain their own scope.

Retention is capped at 250,000 cell-steps per scenario, including the initial
snapshot. A direct request exceeding that cap is rejected before simulation.
The paired consumer reports `timeline.status = 'not-retained'` and supplies
ordinary final attribution instead; the interface hides the timeline and
explains that the requested grid/time detail is too large. Within the cap,
`timeline.status = 'retained'` provides independently owned arrays at every
step, including a fractional final step. Project files still retain source
inputs only, never these derived histories.

## Explain a destination's rainfall origins

Open **Which areas supplied water here?** inside the water-attribution section.
Choose one or more inspected destination cells and a fate: surface storage,
cumulative infiltration, or cumulative boundary outflow. The initial query uses
the modeled end. The paired maps show how
many liters of rain from each source cell reached that destination and fate.
Both alternatives use the same cells, fate and forcing; a common color scale
makes their contributions comparable. Selection inputs survive export/reopen;
computed results are invalidated by changed site, weather, targets, fate or time.

This answers a conditional attribution question. It is not a prediction of what
would happen if a source were removed: that intervention can change bulk flow.
Boundary destinations are the actual edge cells where the modeled water leaves.
Rainfall and water present at the start are accounted for separately. Current
dry-start defaults remain unchanged; the recorder accepts the solver's actual
starting inventory without introducing an initial-state schema.

### Reverse recurrence

The optional recorder observes the maintained solver's actual absorption and
accepted, simultaneously capped transfers. It records an absorption fraction
per cell, a signed fraction per existing neighbor pair, and an exit fraction
per cell at each step. No hydraulic calculation is repeated.

Let w be the selected fate weight after a step. For each accepted internal
fraction f from cell i to j, the weight before transport at i gains
f * (w[j] - w[i]). For a boundary exit fraction e, it gains
e * (selectedExit[i] - w[i]). All changes use the same unmodified after-step
weights. With absorption fraction a, the preceding weight is
(1-a) * transportedWeight + a * selectedInfiltration. Rain added at the start
of that step contributes rainDepth * cellArea * precedingWeight to its origin.
Reverse iteration begins with the selected-cell mask for final storage, or
zero for cumulative sinks. Applying the final reverse weights to the starting
inventory accounts for that separate water. Numerical roundoff of convex
weights is limited to [0,1].

The result reports per-source rainfall contributions, their total, starting
water contribution, the selected bulk-water fate and its closure residual.
Recording is limited to 250,000 cell-steps per scenario, including the initial
step allowance. Larger requests are explicitly refused; no partial map is
presented. Its storage scales with cells plus existing neighbor pairs per step,
not the square of the cell count.

Analytic capped splitting and delayed second-hop controls, source-by-source
forward comparisons, destination-union additivity, every-origin fate closure,
starting-water separation and unchanged ordinary/forward/budget outputs qualify
the recurrence. Native and actual-browser receiving also cover persistence,
invalidation, dry controls and bounded-work refusal.

### Inspect origins at a modeled time

After explaining the destination, use **Inspect modeled time** to select an
actual solver boundary. Both maps, the source table and totals update together.
Storage means water present at that time; infiltration and boundary exit are
cumulative only through that time. The retained initial inventory stays separate
from rainfall, including at minute zero. **Use modeled end** restores the default.

For the fictional existing courtyard, destination F4 contains 173.385749 liters
of rain at minute 60 and 113.316764 liters at minute 240. End-only attribution
therefore answers a different question. This is an authored model example,
not an observed catchment or a physical arrival-time measurement.

An optional `rainOriginStudy.minute` preserves the requested time in project
files. The same field is accepted inside the direct `runRain` option
`rainOrigins: {targetCells, fate, minute}`. The paired result includes the actual
`minute` and `availableMinutes`; derived arrays are not saved. A direct timed
origin result adds its actual `minute`, while an omitted time preserves the
previous final-origin result shape. Queries match actual boundaries within
1e-9 minute of numerical clock roundoff; between-step values are refused rather
than interpolated. An invalidated saved time does not prevent ordinary site
loading or comparison. The origin query explains its refusal and can reset to
the current modeled end.

The reverse pass uses only accepted operations through the selected snapshot.
Its target storage comes from that actual bulk-water snapshot, and its sink
total is the cumulative selected sink at the same boundary. Later forcing and
later operations cannot enter the earlier attribution. The full-event retained
cell-step limit remains unchanged; selecting an early time does not bypass it.
Each committed time-control change recomputes the bounded paired query.

Receiving compares every source against independently carried forward tags at
multiple exact times and fates, checks prefix conservation and future-forcing
independence, and retains analytical initial-water and fractional-end controls.
The browser course covers real keyboard movement, desktop/narrow maps, saved
query reopening, fate changes, stale-time recovery and between-step refusal.

### Carry unresolved soil hypotheses into the origin explanation

Open **Compare unresolved soil assumptions** inside the destination-origins
panel. The comparison uses the saved infiltration investigation: one observed
site, one surface and 2–9 declared capacity values. It offers the same meaningful
subsets as the maintained evidence API: all supplied rates without filtering,
rates compatible with calibration bands, or rates compatible with calibration
and held-aside bands. No rate is adopted and the ordinary default-capacity
explanation remains available through its existing button.

`compareRainOriginHypotheses(project, {study, subset})` calls the maintained
`compareInfiltration` for admission when requested. Missing calibration or
held-aside evidence, no compatible candidate, and absence of the studied surface
from the evidence site remain explicit refusals. In particular, a new proposed
material cannot acquire evidence support from an existing site where it is
absent. Exploring its supplied rates without filtering is still possible. The
consumer never substitutes the closest contradicted model or treats an error
ranking as a probability distribution.

Every retained rate is passed through `compareRainOrigins` using the solver's
existing `surfaceInfiltrationOverride`. That rate applies to every cell of its
surface in both sites. Other surfaces retain their default capacities. There is
no new hydraulic model or independently reconstructed transfer history. The
destination, fate, exact modeled minute and forcing stay identical across the
comparison. Each candidate retains its actual paired origin arrays, rainfall,
starting inventory, total selected fate and conservation residual.

The result provides per-origin and total minimum/maximum values. **Paired change
ranges subtract proposal minus existing within each identical rate.** They do
not subtract independently chosen extrema from different hypotheses. For an
authored courtyard control, a depth band of 42±3 mm at F4/minute60 admits these
three turf capacities, while held-aside evidence is still absent:

| Turf capacity (mm/h) | G4 rain reaching existing F4 (L) | G4 rain reaching proposed F4 (L) | Paired change (L) |
| --- | ---: | ---: | ---: |
| 3 | 33.910575 | 32.201379 | −1.709197 |
| 9 | 30.191520 | 28.676301 | −1.515219 |
| 22 | 21.957726 | 20.997042 | −0.960684 |

Every actual paired hypothesis reduces that source contribution. Mixing the
proposal maximum from one rate with the existing minimum from another would
invent an increase exceeding 10 L. The implementation retains the actual paired
range instead. These are authored model controls, not field observations.

Switching the hypothesis selector updates the existing paired maps and totals.
The color scale spans both sites and every included hypothesis, so changing the
selection does not silently change the meaning of a color. Selecting an origin
shows its marginal ranges, paired change range and per-hypothesis table. Each
displayed map is one actual conserved result. A collection of marginal minima
or maxima need not describe any one hypothesis and must not be assembled into
a new flow map or summed into an alternative inventory.

The optional `rainOriginStudy.hypothesisSubset` stores only the requested subset.
The project already stores the rate hypotheses, evidence, destination and time;
derived candidates and ranges are not saved. Reopening requires recomputation.
Model, rate or evidence edits invalidate a displayed hypothesis comparison.
Inspected origin and selected rate are view state; time and modeled-end changes
retain them while recomputing. Fate changes require a fresh comparison.

Before evidence fitting, the consumer checks both the existing 250,000
cell-step limit per origin run and a conservative 2,000,000 cell-step aggregate
limit. The latter includes two paired runs per declared rate and, when evidence
filtering is requested, one evidence run per declared rate. Filtering may reduce
actual work but cannot relax admission. An early or minute-zero query still
uses the full-event budget. Refusal produces no partial envelope.

Native controls cover independent forward tags under each rate, actual internal
walls, all fates and fractional times; hand-computed closed-site storage and
absorption; the paired-extrema counterexample; missing/contradictory evidence;
absent materials; input order; future independence; persistence and unchanged
ordinary output. The browser receiver exercises the integrated selector,
keyboard inspection, common color scale, time/fate controls, reload, default
mode, evidence invalidation, refusals and desktop/narrow layout.

The range spans only the finite supplied hypotheses at the saved numerical
resolution. It is not a confidence interval, a bound on real water origins,
proof of soil transfer between sites, or a source-removal counterfactual.
