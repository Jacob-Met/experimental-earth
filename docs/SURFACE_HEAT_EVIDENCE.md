# Temperature evidence for declared heat responses

The Temperature Evidence panel extends the [uniform-layer heat experiment](SURFACE_HEAT.md) with a finite, explicitly supplied hypothesis comparison. It reuses that model's exact propagation and validation, the maintained CSV reader and decimal admission, whole-project portability, canonical evidence identity and the calibration/challenge separation used by the infiltration study. It does not add a fitted parameter estimator or a second thermal solver.

Save an exposure first. Select the observed existing or proposed layer, state how the readings belong to the selected place and exposure, and supply two to twelve sourced material declarations. The properties remain hypotheses even when they agree with readings. Up to100 readings give elapsed minute, temperature in degrees Celsius, a supplied interval half-width, declared calibration/challenge use and a source. Times must be distinct: one row cannot be counted in both groups. These intervals are supplied bounds, not statistical confidence intervals. The application cannot verify acquisition, instrument accuracy, an independently held-aside design or retrospective selection.

Every hypothesis is propagated over the unchanged exposure. All segment endpoints are checked even when no reading covers them, so an unsupported trajectory cannot hide between observations. A calibration-compatible candidate must lie inside every calibration interval, with only a128-machine-epsilon arithmetic guard scaled to the temperature magnitude. Challenge readings can reject calibration-compatible candidates; they cannot change their parameters, trajectories, order or calibration result, and cannot rescue a calibration-rejected candidate. With no calibration readings, no candidate is reported as supported. With no challenge readings, that absence remains explicit. One remaining candidate refers only to this finite supplied set.

## What temperature leaves unresolved

Dividing the maintained equation by areal capacity gives

`dT/dt = (absorptivity / capacity) incident - (exchange / capacity) (T - reservoir)`.

For the same initial temperature, a common positive scale change to absorptivity, capacity and exchange leaves these response coefficients unchanged. Temperature can therefore fail to identify the absolute material properties or energy quantities. Physical bounds may restrict the permitted scales; a finite list does not enumerate every permitted alternative.

The authored example compares A=(0.4,40000,10), B=(0.8,80000,20) and a changed-capacity C=(0.4,80000,10), in the existing model's units. A and B have identical calculated temperature responses under the retained forcing but B has twice the absorbed, exchanged and stored energy. Readings are deliberately generated from A and labeled as authored controls, not acquired measurements or independently held-aside observations. Suitable heating/cooling intervals reject C while preserving A/B ambiguity. A flat unforced exposure need not separate C; the result follows the actual retained forcing.

The consumer shows all declared candidates, exact predictions at readings, individual sources, response ratios and final signed energy implications. Curves are sampled for display; the reading comparisons use exact segment propagation. Positive exchange leaves the layer and negative exchange adds reservoir heat, as in the parent experiment. The model still omits nonlinear radiation, evaporation, internal gradients and spatial heat transport. Agreement does not validate those omissions or imply comfort, material identity or physical calibration.

## Custody and lifecycle

The saved evidence includes the complete original heat declaration and selected place context, all candidate inputs, readings and association source. Any change to that heat declaration or the selected place refuses reuse. The panel requires preserving the old project and clearing its evidence before associating another exposure or observed layer. Changing an unrelated selected cell does not change the retained location.

Whole-project export retains these raw inputs; reopening validates and recomputes rather than trusting saved conclusions. Malformed CSV or an unsupported candidate trajectory cannot replace an accepted project. A changed draft retires derived output and cancels pending comparisons or file reads. Source strings render as text. The existing whole-project4MiB export/import limit remains authoritative.

## Receiving

`node tests/surface-heat-evidence.test.mjs` checks common-scale ambiguity with an independent closed-form temperature value, changed challenge without refit, missing evidence, original-context refusal, unsupported unobserved trajectory, strict admission, full-project portability and quoted/invalid CSV. `CHROME_BIN=/opt/google/chrome/chrome node tests/surface-heat-evidence.browser.mjs` exercises the actual served controls, native CSV input, completed project download/fresh native-file reopen, stale operations, literal sources and desktop/390px keyboard receiving through the maintained sandbox-admitted browser owner. An authored fixture demonstrates implementation behavior, not physical performance.
