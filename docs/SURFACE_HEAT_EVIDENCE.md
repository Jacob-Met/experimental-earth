# Temperature and absorbed-energy evidence for declared heat responses

The Temperature Evidence panel extends the [uniform-layer heat experiment](SURFACE_HEAT.md) with a finite, explicitly supplied hypothesis comparison. It reuses that model's exact propagation and validation, the maintained CSV reader and decimal admission, whole-project portability, canonical evidence identity and the calibration/challenge separation used by the infiltration study. It does not add a fitted parameter estimator or a second thermal solver.

Save an exposure first. Select the observed existing or proposed layer, state how the readings belong to the selected place and exposure, and supply two to twelve sourced material declarations. The properties remain hypotheses even when they agree with readings. Up to100 readings give elapsed minute, temperature in degrees Celsius, a supplied interval half-width, declared calibration/challenge use and a source. Times must be distinct: one row cannot be counted in both groups. These intervals are supplied bounds, not statistical confidence intervals. The application cannot verify acquisition, instrument accuracy, an independently held-aside design or retrospective selection.

Every hypothesis is propagated over the unchanged exposure. All segment endpoints are checked even when no reading covers them, so an unsupported trajectory cannot hide between observations. A calibration-compatible candidate must lie inside every calibration interval, with only a128-machine-epsilon arithmetic guard scaled to the temperature magnitude. Challenge readings can reject calibration-compatible candidates; they cannot change their parameters, trajectories, order or calibration result, and cannot rescue a calibration-rejected candidate. With no calibration readings, no candidate is reported as supported. With no challenge readings, that absence remains explicit. One remaining candidate refers only to this finite supplied set.

## What temperature leaves unresolved

Dividing the maintained equation by areal capacity gives

`dT/dt = (absorptivity / capacity) incident - (exchange / capacity) (T - reservoir)`.

For the same initial temperature, a common positive scale change to absorptivity, capacity and exchange leaves these response coefficients unchanged. Temperature can therefore fail to identify the absolute material properties or energy quantities. Physical bounds may restrict the permitted scales; a finite list does not enumerate every permitted alternative.

The authored example compares A=(0.4,40000,10), B=(0.8,80000,20) and a changed-capacity C=(0.4,80000,10), in the existing model's units. A and B have identical calculated temperature responses under the retained forcing but B has twice the absorbed, exchanged and stored energy. Readings are deliberately generated from A and labeled as authored controls, not acquired measurements or independently held-aside observations. Suitable heating/cooling intervals reject C while preserving A/B ambiguity. A flat unforced exposure need not separate C; the result follows the actual retained forcing.

The consumer shows all declared candidates, exact predictions at readings, individual sources, response ratios and final signed energy implications. Curves are sampled for display; the reading comparisons use exact segment propagation. Positive exchange leaves the layer and negative exchange adds reservoir heat, as in the parent experiment. The model still omits nonlinear radiation, evaporation, internal gradients and spatial heat transport. Agreement does not validate those omissions or imply comfort, material identity or physical calibration.

## Test the energy ambiguity

Open **Optional absorbed-energy readings** to retain an additional quantity.
Supply the energy absorbed from the declared incident source per square metre
between two explicit elapsed times. The source should explain its measurement
or derivation, area and time association. Incident energy alone does not
identify absorption. Net stored heat also differs from absorbed input because
the maintained layer exchanges heat with its reservoir. Preparation and import
refuse an explicitly conflicting quantity instead of relabeling it.

The CSV columns are
`from_minute,to_minute,absorbed_j_m2,half_width_j_m2,use,source`.
Up to 100 distinct ordered intervals may lie within the saved exposure; amounts
and supplied half-widths are nonnegative and at most 200000000 J/m². Leave the
table empty for temperature-only evidence. Intervals may overlap, but counts
describe constraints, not independent statistical observations. Uncertainty in
acquisition time, shared sensor errors and source independence are not inferred.

For each candidate, the existing heat module integrates absorption × incident
power × seconds over each overlapping exposure segment. It sums the local
overlaps directly rather than subtracting two large cumulative totals. A short
late interval therefore retains its small energy. The comparison includes a
conservative arithmetic allowance based on energy magnitude and the scale of
schedule-boundary accumulation: peak absorbed flux × 60 × total duration × the
square of the segment count, multiplied by 128 machine epsilons. The candidate
details show the allowance separately. It is neither a measured uncertainty
nor a certified interval-arithmetic enclosure. This handles the executed
ten-times-0.1-minute dark-boundary control without rejecting a zero-energy
reading because a floating-point boundary moved slightly earlier.

Temperature and energy constraints share the same declared calibration and
challenge rules. Every calibration constraint must fit; a challenge can reject
a surviving candidate but cannot refit it or rescue an earlier rejection.
Energy-only readings can constrain absorption while leaving capacity and
exchange unresolved. A dark interval supplies no absorption distinction.
Every original reading, source, residual, prediction and unit remains visible.

In the authored 60-minute 600 W/m² control, A absorbs 864000 J/m² and B absorbs
1728000 J/m² despite identical temperatures. An absorbed-energy interval of
864000 ±20000 J/m² rejects B while preserving A. An interval centered at
1296000 with half-width 432000 includes both. **Load authored energy control**
generates an explicitly synthetic demonstration from A; it is not an acquired
reading or an independent physical validation.

## Custody and lifecycle

The saved evidence includes the complete original heat declaration and selected place context, all candidate inputs, readings and association source. Any change to that heat declaration or the selected place refuses reuse. The panel requires preserving the old project and clearing its evidence before associating another exposure or observed layer. Changing an unrelated selected cell does not change the retained location.

Whole-project export retains these raw inputs; reopening validates and recomputes rather than trusting saved conclusions. Malformed CSV or an unsupported candidate trajectory cannot replace an accepted project. A changed draft retires derived output and cancels pending comparisons or file reads. Source strings render as text. The existing whole-project4MiB export/import limit remains authoritative.

Temperature-only evidence retains schema `experimental-earth-surface-heat-evidence/1`.
Combined evidence uses version 2 and explicitly declares `energyQuantity` as
`absorbed-input`. Version 2 requires its energy array; version 1 rejects energy
fields. Existing temperature-only files remain readable, and the old version-1
reader refuses the new version rather than dropping the energy constraints.
Clearing the optional energy table and explicitly saving returns to a
temperature-only declaration.

## Receiving

`node tests/surface-heat-evidence.test.mjs` checks common-scale ambiguity with an independent closed-form temperature value, changed challenge without refit, missing evidence, original-context refusal, unsupported unobserved trajectory, strict admission, full-project portability and quoted/invalid CSV. `CHROME_BIN=/opt/google/chrome/chrome node tests/surface-heat-evidence.browser.mjs` exercises the actual served controls, native CSV input, completed project download/fresh native-file reopen, stale operations, literal sources and desktop/390px keyboard receiving through the maintained sandbox-admitted browser owner. An authored fixture demonstrates implementation behavior, not physical performance.

`node --test tests/surface-heat-energy.test.mjs` adds independent piecewise
energy controls, tiny late windows, the schedule-rounding counterexample,
precision and dark-window ambiguity, energy-only evidence, combined role
separation, version admission and literal CSV sources.
`CHROME_BIN=/opt/google/chrome/chrome node tests/surface-heat-energy.browser.mjs`
receives actual absorbed-energy CSV intake, changed precision, real full-project
download and fresh reopening, quantity/context refusal, delayed-file cancellation
and keyboard access to the energy details at desktop and 390 px.
