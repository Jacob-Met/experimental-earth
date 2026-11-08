# How long can water stay strictly above a threshold?

This consumer bounds the complete attainable range of time spent with surface water **strictly greater than H**, over the compatible continuous rainfall family. The metric is duration in hours:

\[
D_H=\operatorname{measure}\{t\in[0,1]:W(t)>H\}.
\]

It differs from depth-time exposure: a deeper excursion need not last longer. Equality over a positive-length plateau contributes zero duration. Including or excluding isolated crossing endpoints does not change the measure.

## Run the three fictional comparisons

```sh
node inspect-archived-rain-duration.mjs examples/authored-rain-timing.json examples/archived-rain-timing-first-four.json examples/archived-rain-timing-third-exact.json examples/archived-rain-peak-four-half.json
node inspect-archived-rain-duration.mjs examples/authored-rain-timing.json examples/archived-rain-timing-first-four.json examples/archived-rain-timing-third-exact.json examples/archived-rain-peak-three-half.json
node inspect-archived-rain-duration.mjs examples/authored-rain-timing.json examples/archived-rain-timing-first-four.json examples/archived-rain-timing-third-exact.json examples/archived-rain-peak-criterion.json
```

| H | Complete duration range, hours |
|---|---|
| 4.5 mm | [0, 2/21] |
| 3.5 mm | [1/28, 26/105] |
| 5 mm | [0, 0] |

These declared readings specify exactly 4 mm in the first quarter and 2 mm in the third. They are fictional, not acquired observations. Assumptions remain dry initial storage, uptake capacity 6 mm/hour, zero capillary drive, rain capped at 20 mm/hour, and 5 mm in each half hour. No routing or whole-site prediction is added.

The fourth file remains the explicit peak criterion. Its value is reused as H; its existing peak verdict and original terminal target are preserved. This consumer adds **no duration classification**. It requires H ≥ 3.5 mm, with no arbitrary upper cap on a finite threshold.

## API and certificates

```js
import {
  estimateArchivedRainDurationWork,
  inspectArchivedRainDuration,
} from './archived-rain-duration.js';
const work = estimateArchivedRainDurationWork(originalText, firstText, thirdText, criterionText);
const report = inspectArchivedRainDuration(originalText, firstText, thirdText, criterionText);
```

Inputs are the same four exact UTF-8 declarations accepted by the exposure consumer. First and third roles are ordered; duplicate ID labels do not establish association or independence. Numeric values mean their represented binary64 values, subsequently handled as exact rationals.

The estimator calls the exposure estimator for admission, without inspecting a history. The inspector retains one complete fresh `exposureReport`, including its paired peak and terminal reports. New duration arithmetic comes from admitted raw numbers, not decoded parent certificate values. No old CLI or scientific model is replayed.

The report schema is `experimental-earth-archived-rain-duration/1`, metric `time-strictly-above-threshold`, units `hour`. Assessment contains `compatibleQuarterBands`, `durationBounds` with inclusive `lowerHours` and `upperHours`, and two full attaining witnesses. Incompatible readings retain the full parent but have null bounds and witnesses; they are not a zero-duration result.

Each new witness preserves four rain bins, ordered segments, reflected water/infiltration knots, quarter and half totals, peak, one attaining peak time and terminal water. It adds `earlyHalfDurationHours`, `durationHours` and ordered `laterDuration` records. A record names its original segment index, times, signed endpoint excesses, case, optional exact crossing time and duration. Both nonpositive endpoint excesses take the `below` case first. Otherwise two nonnegative endpoints give the entire segment duration. Opposite strict signs give a strict interior crossing; endpoint equality does not invent one.

The CLI wrapper schema is `experimental-earth-archived-rain-duration-cli/1`. Its identity keys are `originalDeclaration`, `firstArchivedReading`, `thirdArchivedReading`, and `peakCriterion`. It accepts regular non-symlink files without BOM, up to 16 KiB for the original and 4 KiB for each other file, records raw SHA256 and byte counts, and rereads inputs before emitting stdout. It writes no output file itself.

## Why the endpoints are exact

Before the half hour, every rain subinterval contains at most 5 mm at rate at most 20, so water cannot exceed 3.5 mm. The early half contributes zero strict duration for every admitted H.

Later water has the form C(t)−6t+d, with the earlier running minimum fixed. For compatible first-quarter band [l1,h1] and third-quarter band [l3,h3], the same endpoint histories as exposure provide pointwise bounds. The lower history uses q=h1 and r=l3, constant rain in the first two quarters and latest cap-20 pulses in the last two. The upper uses q=l1 and r=h3, latest pulses first and earliest pulses later. Both join at cumulative rain 5 mm without resetting water.

Pointwise water ordering implies inclusion of the strict exceedance sets. These feasible histories therefore attain the minimum and maximum duration. Later endpoint-history slopes are −6 or +14. For a segment of length L with signed excesses a,b, duration is zero if both are nonpositive, L if both are nonnegative and at least one is positive, Lb/(b−a) for a strict rise, and La/(a−b) for a strict fall. All divisions in crossing cases have positive denominators.

## Completeness needs more than continuity

Duration is not continuous under uniform convergence of water histories. A history can sit exactly at H on an interval; arbitrarily small positive triangular bumps then make almost that whole interval count. The corresponding exposure integral can converge to zero while strict duration does not. Consequently the exposure continuity proof alone does not establish every intermediate duration.

For this particular family, completeness follows by a separate construction. Interpolate the two finite endpoint rain profiles on their common breakpoint grid, split at every quarter boundary. In the later half their rates are 0 or 20. Interpolated water slopes can vanish only at interpolation parameters 3/10 or 7/10. Away from those parameters the threshold equality set is finite, and duration is continuous by bounded dominated convergence. The earlier minimum is a continuous piecewise-affine function of the interpolation parameter.

At an exceptional parameter, let D0 be strict duration and let L0 be the total length of later threshold plateaus. Both one-sided duration limits lie in [D0,D0+L0]. Each plateau has rain rate 6 and positive water. Split it at quarter boundaries. On any chosen subinterval, replace rate 6 by 6+ε on its first half and 6−ε on its second, with 0<ε≤6. The triangular cumulative-rain increment is positive inside and zero at both ends. Rates stay within the cap; every quarter total, half total and earlier minimum is preserved. Outside the subinterval the history is unchanged.

Choosing subinterval lengths totaling any value between 0 and L0 fills that entire duration interval. These attained intervals connect the ordinary continuous images on either side of each exceptional parameter. Thus the full attainable duration set is exactly the closed interval between the two returned extrema, despite the discontinuity of the original functional.

This is an existence proof. The API does not accept an arbitrary interior duration or promise a bounded certificate for it. The proof also does not preserve additional imposed exact peak or terminal outcomes; those are not constraints of this family.

## Scope and finite limits

Existing sampled `pondingExposure` computes minutes above a threshold from retained interpolation. Separate fixed water-depth point/band research uses externally declared absolute depth-change limits. This consumer neither replaces those methods nor promotes their artifacts: it answers a different rainfall-constrained reflected-storage question. Duration itself is not a new metric.

New endpoint certificates contain at most 14 segments, 16 knots and eight later duration records. With the complete exposure parent, totals are at most 82 segments and 96 knots. The reservation is 71,680 abstract scalar units: 51,200 parent, 4,096 repeated admission and 16,384 duration work. It is not a runtime guarantee; parsing, rational bit costs, strings and serialization have separate bounds.

The complete output is capped at 4 MiB, 2,048 encoded rationals and 32,768 visited values. New integer strings allow 700 characters; inherited parent limits remain unchanged. Duration times lie on a 420D grid for D=2^1074; parent squared-area denominators remain larger. Arithmetic retains 8,192/16,384-bit guards. A huge threshold is handled by the zero-duration branch, not needless squaring.

No rain record, instrument precision, chronology, rate cap, soil, field intervention or damage conclusion is validated. H below 3.5 requires another proof. Six focused test groups passed, covering generic envelope bounds, endpoint and empty families, strict crossings and endpoint equality, represented numeric extremes, full parent preservation and exact nested-call instrumentation. Four sequential instrumented children confirmed the expected 23/6/23/6 parent-entry traces, 17 loaded markers and zero entries into nine scientific functions. Five private oracle checks separately covered equality-plateau and endpoint semantics; they do not claim that an endpoint witness contains a plateau.

All three actual commands passed independent exact-rational receiving. A generic raw-anchor envelope oracle verified both duration bounds, full attaining histories, reflection, quarter totals, all strict knot pairs and every duration record. Each complete exposure parent matched its corresponding previously qualified report, and the full inherited receiving chain passed. Source, runtime and request guards passed, stderr was empty and every child process group was absent on completion. This is mathematical and headless CLI qualification under the stated fictional assumptions.
