# Compare a temperature reading over its actual time interval

The hidden-store evidence panel accepts both instantaneous surface readings and interval-mean surface readings. An hourly mean constrains the average model temperature over that hour. Its end timestamp does not turn it into an instantaneous endpoint measurement.

The original finite-alternative comparison, initial states, exposure, source binding and calibration/challenge roles are preserved. No lower capacity, conductance or initial temperature is fitted by selecting an averaging operator.

## Declare the observation operator

An existing reading without `aggregation` remains instantaneous, with the same raw keys and meaning:

```json
{"minute":60,"temperatureC":44.53099896635513,"halfWidthC":0.05,"use":"calibration","source":"Authored endpoint control"}
```

A mean reading declares both ends of its support. `minute` is the end and `fromMinute` is the start, measured from the saved exposure's starting instant:

```json
{"aggregation":"interval-mean","fromMinute":0,"minute":60,"temperatureC":37.47920767285588,"halfWidthC":0.01,"use":"calibration","source":"Independent authored first-hour mean control"}
```

The window must be finite, nonempty and wholly inside the original exposure. The contract distinguishes readings by operator and support: an endpoint reading, a 0–60 minute mean and a 30–60 minute mean can coexist. Duplicate operators with identical support are refused. An instantaneous reading cannot retain an interval start, and unknown operators are refused. Switching the UI back to instant removes both interval keys from its saved raw declaration.

The supplied band is applied to the predicted interval mean. A horizontal mean band spans its complete support in the plot; it does **not** require every instantaneous point on the curve to lie inside that band. Source details retain the operator, interval, role, predicted mean, residual and separate arithmetic guard. A mean is never plotted as an observed endpoint dot.

## Calculation and numerical limits

For a requested interval [a,b], the surface observation is

```text
mean T₁ = integral from a to b of T₁(t) dt / (b − a).
```

Each forcing segment uses the maintained two-store analytic propagator. In its capacity-scaled decay modes, `phi(x)=(1−exp(−x))/x` advances temperature and `psi(x)=(1−phi(x))/x` evaluates the time-mean change directly. Small arguments use the existing convergent series and divided-power differences. The zero-exchange limit is `psi(0)=1/2`; zero internal conductance reduces to the maintained one-store response with a constant lower temperature.

For an interval that crosses forcing changes, evaluation advances from each segment's original state to the overlap start, calculates that overlap's analytic mean, then combines those means using positive duration weights. Weight normalization retains a constant temperature despite binary64 boundary summation. The implementation does not subtract large cumulative temperature integrals to recover a short window, divide by ambient exchange, or substitute the endpoint temperature.

`advanceHeatColumn` exposes `surfaceMeanC`, `subsurfaceMeanC` and their degree-second integrals in addition to its existing state and energy outputs. `evaluateHeatColumnTarget(study, target, requestedMinutes, requestedWindows)` accepts windows shaped as `{fromMinute, minute}` and returns an `averages` array. Point requests plus twice the number of windows may not exceed 2,000. Evidence retains its existing maximum of 100 readings.

The complete declared course, including both stores' stationary points and all forcing intervals, is admitted before requested averages are used. A valid short observation cannot hide an unsupported later state. The same engineering floating-point allowance is reported separately from the user's band; it is not a certified enclosure, uncertainty estimate or probability. Role labels and overlapping supports do not establish independent acquisition.

## Independent controls

The authored pulse uses C₁=20,000 and C₂=80,000 J/(m² K), h=10 and g=20 W/(m² K), absorptivity 0.8, both initial temperatures 20 °C, and a 700 W/m² heating hour followed by darkness. Independent SciPy augmented-matrix integration gives:

| Window, minutes | Surface mean, °C | Endpoint surface, °C |
| --- | ---: | ---: |
| 0–60 | 37.47920767285588 | 44.53099896635471 |
| 60–120 | 30.949145738082176 | 27.439654304991905 |
| 30–90 | 37.93648145350857 | 29.195793897366322 |
| 59.9–60.1 | 44.489123000097166 | 44.378178153656144 |

Additional reference cases cover zero ambient exchange, zero internal conductance and a linear ramp with both zero. The seven reference means agree with the maintained calculation within 1.24×10⁻¹² °C in the executed comparison. This is observed numerical agreement, not a formal error bound. The committed `tests/heat-column-average-oracle.py` reproduces the independent fixture when NumPy and SciPy are installed; these packages are not application runtime dependencies.

Native controls also cover very short, subnormal and late windows, full-course refusal, operator identity, calibration/challenge preservation and raw project replay. The browser course checks legacy instantaneous behavior, mean support rendering, rejection of endpoint substitution, a forcing-boundary crossing, transactional invalid intervals, downloaded-file reopening and source invalidation.

## An acquired hourly source in the actual project format

[The NOAA Tucson example](../examples/noaa-tucson-hourly/README.md) includes nine unchanged hourly rows, their byte-identity receipt and a portable `project.json`. Open that project through **Import project**, then compare its saved hidden-store alternatives.

NOAA's [hourly product specification](https://www.ncei.noaa.gov/pub/data/uscrn/products/hourly02/README.txt) defines the preceding-hour support of each UTC row and distinguishes whole-hour air temperature from the final five-minute air average. The example retains the original hourly surface values, correction types and quality flags. It explicitly supplies both point initial states at the exposure start; the first hourly mean is not used as its own interval-start state. Hourly air and solar means become a declared piecewise constant forcing approximation.

All three unchanged illustrative alternatives fail the supplied calibration bands. The first 60,000 J/(m² K) alternative predicts a first-hour surface mean near 20.28448 °C against the observed 4.5 °C. This result is retained without fitting. The model cell is illustrative, the infrared-to-model-surface association is explicit, and the supplied ±0.5 °C comparison band is not a NOAA instrument uncertainty claim. Source details and the example README describe these assumptions and the first-three calibration / remaining-six challenge labels.

## Integration evidence

The initial composition on `f3fb59967d8f8d8dab2a585e5b140be4a3eaf58e` passed 501 native tests with no failures or skips, nine new browser groups and the original eight instantaneous-evidence groups. The publication composition on `072ee3ae7ce703a2290eab6817db754783a686d4` passed 541 native tests, the same nine mean-reading groups and eight instantaneous-evidence groups, with no failures, skips or page exceptions. During an API quota pause, the latter base was reconstructed from the cached initial archive and all 32 previously retrieved incoming file patches; every changed Git blob matched its recorded target before the feature was overlaid. This is candidate receiving, not a fresh merged checkout. [The receiving receipt](receipts/heat-column-average-20261024/verification.json) retains both executions, exact source and image hashes, independent controls and the prepublication reopen correction. A fresh import of an identical saved project now restores its accepted controls after an unsaved draft, while ordinary refreshes within the same project preserve the draft. Normal merge and fresh merged consumer receiving are recorded in the native PR.

The NOAA receiver opens the committed project through the real file input, checks all nine mean windows and three rejected alternatives, downloads the project and reopens those exact raw declarations. Further current-main composition and fresh exact merged receiving are recorded separately in the native PR; historical candidate execution does not stand in for those checks.
