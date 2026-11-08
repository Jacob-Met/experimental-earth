# Exact total time with standing water

This headless consumer bounds the total time with **strictly positive surface water** in the fixed fictional rainfall family. It returns the complete attainable duration interval and two full endpoint histories. It preserves the complete paired peak report, including both original terminal-water questions. Zero threshold is a separate explicit criterion; it does not change the original terminal target.

The assumptions are dry initial conditions, conductivity 6 mm/hour, zero capillary drive, rain rate between 0 and 20 mm/hour, one hour total, and exactly 5 mm in each half hour. The original illustrative schedules are not exhaustive. Archived first- and third-quarter declarations constrain rainfall totals with symmetric uncertainty, clipped to [0,5] mm. These are mathematical declarations, not verified measurements, sensor accuracy, temporal availability, site association or inferred soil/rate-cap parameters.

## Actual command and inputs

From the repository root:

```sh
node inspect-archived-rain-ponded-duration.mjs examples/authored-rain-timing.json examples/archived-rain-timing-first-four.json examples/archived-rain-timing-third-exact.json examples/archived-rain-peak-zero.json
```

Replace the first-quarter file with `examples/archived-rain-timing-first-one.json` or `examples/archived-rain-timing-first-exact.json` for q=1 or q=2. The third-quarter example fixes r=2. The expected exact bounds are:

| First-quarter total | Ponded duration, hours |
|---|---|
| 4 mm | [13/14, 1] |
| 1 mm | [19/28, 11/12] |
| 2 mm | [16/21, 1] |

These exact controls were independently verified in the three actual CLI runs recorded below. The four files retain the existing paired-peak schemas. Original declaration intake is at most 16 KiB, each other input at most 4 KiB. The CLI requires regular non-symlink UTF-8 files without a BOM, retains SHA256 and byte identities, and rechecks originals before publishing complete JSON. Duplicate reading labels are allowed; explicit first/third argument roles determine interpretation. The criterion must have represented numeric value zero, including numeric -0 under existing admission semantics. A nonzero peak criterion is refused before the paired inspector, even though the inherited peak API itself supports other values.

The synchronous APIs are `estimateArchivedRainPondedDurationWork(originalText, firstText, thirdText, criterionText)` and `inspectArchivedRainPondedDuration(...)`. The estimator performs admission and returns the complete reservation without constructing histories. The inspector calls one paired estimator before one fresh paired inspector. Existing exposure and positive-threshold duration APIs are not called or changed.

## Report and histories

The report metric is `time-strictly-ponded`, units `hour`, threshold zero. `pairedReport` retains the complete fresh inherited report. `assessment.compatibleQuarterBands` retains both clipped bands, including an inverted band when incompatible. An incompatible family has null duration bounds and witnesses; it is not assigned zero duration.

For a compatible family, `durationBounds` has exact rational `lowerHours`, `upperHours` and both inclusive flags. Each endpoint witness retains bins, rain segments, reflected water/infiltration knots, peak and terminal values, one attaining peak knot and original half-hour totals. Every rain segment has a `durationRecords` entry with its integer index, start/end water, strict duration and one of `dry`, `wet`, or `drains-to-dry`. Only a strictly interior depletion has a non-null `drainHour`. A segment ending at zero is wet for its full length except the measure-zero endpoint. Rain at 6 mm/hour with zero water remains dry; the same rain with positive water remains wet.

Water and infiltration need not interpolate linearly between rainfall-segment endpoints: a pool can drain before the end of a zero-rain segment. For example, the upper q=1 history rains at 20 from time 0 to 1/20 hour, then zero to 1/4; its water drains at 1/6, leaving a genuinely dry tail. The receiver checks this reflection directly rather than drawing a line between endpoint water values.

## Sharp bounds

Let q be the first-quarter total and p1,p2 the ponded durations in the first two quarters. Write w=W(1/4). Infiltration cannot exceed 3/2 mm during the first quarter, so w >= max(0,q-3/2). Since positive water grows at most 14 mm/hour, p1 >= w/14.

If the second quarter has a zero-water time, take its last zero and let ell be the time remaining afterward. Clearing w requires at least w/6 ponded time before that zero. Rain before it is at most 6(1/4-ell)-w, and afterward at most 20ell. Since the second-quarter total is 5-q, this gives p2 >= w/6+(7/2-q+w)/14. If there is no zero, p2=1/4. Minimizing the combined bound at w=max(0,q-3/2) gives

- q <= 3/2: L(q)=1/2+(7/2-q)/14;
- 3/2 <= q <= 15/7: L(q)=1/2+1/7+(q-3/2)(1/14+1/6);
- q >= 15/7: L(q)=3/4+(q-3/2)/14.

For the upper bound, q >= 6p1 and p2 <= 1/4, giving U(q)=3/4+min(1/4,q/6). The later half always contributes exactly 1/2: cumulative rain C(t) >= max(5,20t-10), hence C(t)-6t >= 1/2 there, and reflection only adds nonnegative water.

For a nonempty first band [l1,h1], the lower endpoint chooses q=clamp(3/2,l1,h1); the upper chooses q=h1. Both choose r=l3 in the third band. The third band affects feasibility and the witness history, but not these duration bounds. At q=0 the interval is [3/4,3/4]; at q=3/2 it is [9/14,1]; at q=5 it is [1,1]. The rational breakpoint 15/7 is not exactly representable as binary64; actual public numeric admission always uses represented values, not ideal decimal intent.

### Attaining rain histories

For the minimum with q<=3/2, use constant 4q in the first quarter, then 6 followed by 20 ending at 1/2. The final cap pulse lasts (7/2-q)/14. For intermediate q, use 6 then 20 ending at 1/4, with cap length (q-3/2)/14; next use zero until 1/4+(q-3/2)/6, then 6 until 5/14, then 20 until 1/2. For q>15/7 keep that first quarter and use constant 4(5-q) in the second; stored water remains positive throughout it.

For the maximum, use the earliest first-quarter 20 mm/hour pulse of length q/20, followed by zero, then constant 4(5-q) in the second quarter. Both witnesses use constant 4r and 4(5-r) in the last two quarters. Zero-length pieces are omitted and quarter boundaries preserved. All choices stay within the rate cap and reproduce the declared totals exactly.

### Why every intermediate duration is attainable

The duration functional is not generally continuous: a positive-length zero-water plateau counts zero and can become wet under arbitrarily small changes. Therefore continuity alone is not a completeness proof.

Interpolate the two endpoint rain histories on their finite common grid, including all quarter boundaries. All constraints remain feasible. Reflected endpoint water is a maximum of finitely many affine parameter functions. Between finitely many slope-zero and endpoint/minimum-order breakpoints, each segment's ponded duration is zero, full length or a bounded ratio of affine functions, hence continuous with one-sided limits.

A dry plateau with rain strictly below 6 contributes no nonzero jump: nearby small incoming water drains in vanishing time. Only zero-water, rate-6 plateaus can cause a jump. Split them at quarter boundaries. On a chosen interval of length x, replace 6 by 6+epsilon on its first half and 6-epsilon on its second, with 0<epsilon<=6. Cumulative rain receives a nonnegative triangular bump, zero at both ends. Reflection becomes positive for exactly x time while remaining unchanged outside. Each quarter total and cap are preserved. These constructions fill between the exceptional base duration and both one-sided limits. The finite connected union contains both sharp bounds, proving the whole closed interval is attainable.

This is an existence result, not an API for arbitrary interior-duration witnesses or a bound on their certificate size. It imposes no additional exact peak or terminal-water constraint.

## Qualification and limits

The original six test groups passed with zero failures, skips or cancellations. They cover exact controls and represented branch neighbors, uncertain and empty bands, reflected dry-down and plateau semantics, binary64 extremes, complete paired-report preservation, and instrumented admission/composition. All four isolated composition children observed the expected parent-entry sequence and zero entries into the nine scientific model functions.

Three original real-file CLI commands also passed independent exact receiving, including every new duration record, both full rain histories, raw input identities, and the complete paired → peak → terminal report chain:

| Case | Complete output bytes | SHA256 of complete stdout |
|---|---:|---|
| q=4 | 142956 | `ddcf31aa5c146648f955adcdfb55c4c5093585630d582929a788af5b2facf3fa` |
| q=1 | 143043 | `ba377b442d2830ab0b3d80bb9182bff3e5737507c641dd0a282d3ae34bb40aca` |
| q=2 | 146154 | `f99e115f0f682518630d796a291f7884ed863ff3bddac09a4b5a5704363c6ae8` |

Every original run ended with empty stderr, unchanged source/runtime/request guards and no retained child process group. This is local source-bound qualification of this headless consumer; it does not claim a GitHub CI, browser, field or whole-site result. The source, input and oracle were fixed before execution. Only this guide's qualification text was updated afterward.

The reservation is 51,200 abstract scalar units: 30,720 complete paired parent, 4,096 additional admission and 16,384 new work. New endpoints have at most 12 rain segments, 14 knots and 12 duration records. The full report has at most 66 segments and 78 knots, capped at 1,536 encoded rational occurrences, 650 characters per integer token, 32,768 traversal values and 4 MiB. Arithmetic retains 8,192/16,384-bit guards. These are not CPU, memory or wall-time guarantees; parsing, strings, serialization and rational bit costs are separate.

The independent receiving design enumerates raw two-dimensional affine constraints rather than invoking the producer's piecewise lower formula. Full profiles, raw identities and the complete pinned paired/peak/terminal chain are independently received. Existing sampled `minutesAbove`, finite duration/intensity planning, generic water-depth trace/rate-bound research, UI and physical kernels are unchanged. This is no damage, safety, probability, acquisition or whole-site conclusion.
