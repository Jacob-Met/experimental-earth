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
