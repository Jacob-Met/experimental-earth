# Compare a localized infiltration explanation

**Could one place absorb rain differently?** compares a finite set of declared uniform-material rates with the same rates at one selected cell. The selected material comes from that cell in the original observed scenario. Each uniform alternative replaces every cell of that material; each localized alternative changes only the selected cell. All other cells retain the maintained material defaults, which are displayed explicitly.

This extends the existing single-cell sensitivity override into an evidence comparison. It reuses `runRain`, `infiltrationOverride`, `surfaceInfiltrationOverride` and `evaluateReadings` unchanged. These comparisons retain the default unlimited below-surface receiving sink; a separate closed-receiving-store investigation is not applied implicitly. There is no new hydraulic solver, automatic cell search, fitted rate, project adoption or inference that the selected cell has a measured material property.

## Use original evidence

Choose the observed scenario, a cell label, two to nine distinct rates from 0 to 2000 mm/h, and a reason for comparing that spatial explanation. Original calibration readings alone determine RMSE ordering and calibration compatibility. Original held-aside readings challenge the same fixed candidates without choosing their location, rate or rank. Notebook-only and other-scenario readings are ignored and counted.

Every candidate remains visible, including rejected, identical and otherwise indistinguishable alternatives. Expand a candidate to inspect every original source, reading, uncertainty, prediction, signed residual and solver interpolation bracket. The shared evaluator uses its existing `1e-9 * max(1, observed, predicted)` millimetre numerical guard in addition to each declared tolerance. These are declared acceptance bands, not probabilities or statistical confidence intervals.

No calibration, missing challenge, full calibration rejection and held-aside rejection have distinct statuses. A single survivor means one of the offered finite alternatives remains within the supplied bands. It does not establish a unique rate, cell, soil mechanism or cause. User-assigned evidence roles do not verify independent acquisition. Contradictory source readings, geometry, rainfall, clock, starting water, background capacities or omitted processes can also explain model disagreement.

## Separate spatial pattern from total uptake

Uniform and localized alternatives can differ in nominal total capacity as well as spatial arrangement. The panel therefore displays cell area and each candidate's whole-site nominal capacity in litres per hour, separately from actual simulated absorbed volume. Actual uptake can be limited by the available water and is not the nominal capacity multiplied by event duration.

An authored analytic control uses four equal 1 m² sealed cells, no lateral movement or boundary exit, and a ten-minute 61 mm/h storm. A local capacity of 31 mm/h at A1, with the other cells retaining 1 mm/h, gives 5 mm at A1 and 10 mm elsewhere at ten minutes. Uniform capacities cannot reproduce both spatial values in this control.

The explicitly offered uniform 8.5 mm/h alternative and the localized 31 mm/h alternative both have 34 L/h nominal site capacity. Both absorb approximately 5.666666666666665 L and retain 34.99999999999999 L. The original spatial depth readings distinguish them even though total storage and uptake are identical. This shows what the spatial evidence adds beyond an aggregate inventory under these authored assumptions; it is not a measured demonstration of heterogeneous soil.

Wrong declared cells reject calibration in this control. Dry readings leave the candidates unresolved. Readings away from an uncoupled selected cell cannot identify its capacity. A changed held-aside reading can reject the otherwise compatible localized alternative without changing its calibration result.

## Preserve the original investigation

Download retains only the versioned original project, query and material-default map. Reopening independently reruns the maintained solver and evaluator in an isolated comparison; it does not replace the working project. Imported derived results are refused. If installed material defaults differ from the recorded values, replay refuses instead of silently changing the background assumption. The receipt does not pin an executable solver version; compare under a qualified matching software version when reproducing numerical results.

Files have the maintained 4 MiB ceiling. The complete family is preflighted against three million model cell-steps: two scopes × offered rates × grid cells × modeled steps. Exceeding that bound refuses the investigation before any partial family is reported. The bound limits interactive work, not numerical error.

Source, query and declaration edits retire results. A delayed file cannot replace a newer declaration or changed working project. No candidate is applied to the source project.

## Verification

Run `node --test tests/localized-infiltration.test.mjs` for the analytic spatial/equal-capacity controls, unfamiliar off-step held-back inputs, wrong-cell and dry controls, calibration/holdout separation, admission/work limits and original-input replay. Run `CHROME_BIN=/absolute/path/to/chrome node tests/localized-infiltration.browser.mjs` for the maintained sandbox-admitted browser consumer, original-file handoff, delayed-read control, keyboard and narrow-screen receiving.

These tests use authored analytic and software controls. They do not establish field accuracy, actual soil heterogeneity, physical intervention permission or calibrated uncertainty.
