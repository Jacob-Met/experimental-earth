# Time above a shallow depth in a fixed rainfall family

This separate mathematical consumer answers a previously unsupported question: how long can surface water be **strictly above H**, for fixed quarter-hour rainfall totals **4, 1, 2, 3 mm**, dry initial storage, uptake capacity 6 mm/hour, zero capillary drive and rain bounded by 20 mm/hour? These are authored assumptions, not observations or a whole-site forecast.

It admits exactly **0 < H ≤ 2 mm**. JSON numbers mean represented binary64 values: `1.1` is slightly greater than exact 11/10 and therefore has a small strictly positive correction; it is admitted without rounding. The value `1` is an uncomplicated admitted example. Existing zero-threshold and H ≥ 3.5 consumers are unchanged. Thresholds outside this consumer's stated domain are not approximated.

```sh
node inspect-archived-rain-shallow-duration.mjs examples/authored-rain-timing.json examples/archived-rain-timing-first-four.json examples/archived-rain-timing-third-exact.json examples/archived-rain-peak-one.json
```

The command uses four original files and retains one complete fresh paired-peak parent at the **original supplied peak criterion**, including its original terminal questions. The new quantity is duration in hours; it adds no duration verdict or new acquisition claim.

## Exact range and certificates

For the compatible fixed family the attained range is

\[
D_H\in[(13-H)/14-(5/21)\sum_{m\in\{11/10,13/10,19/10\}}(H-m)_+,\;1-H/14].
\]

Here (x)_+=max(0,x). At H = 1 mm this is [6/7, 13/14] hours; at H = 2 mm it is [8/21, 6/7]. The separately supplied `examples/archived-rain-peak-two.json` selects the latter question. Every intermediate value is attained. A positive-length plateau exactly at H contributes zero; isolated crossing endpoints have zero duration.

The APIs are `estimateArchivedRainShallowDurationWork(originalText, firstText, thirdText, criterionText)` and `inspectArchivedRainShallowDuration(...)` from `archived-rain-shallow-duration.js`. Parent admission validates the four inputs. For nonempty clipped reading bands the first band must be exactly {4} and the third exactly {2}; a broader compatible band refuses. If either band is empty, the original parent remains intact and the new bounds/witnesses are null. An empty family is not a zero-duration result. Threshold admission still applies to empty families.

The report schema is `experimental-earth-archived-rain-shallow-duration/1`, metric `time-strictly-above-threshold`, units `hour`. Its `assessment` retains both clipped bands and two endpoint witnesses. Each witness includes all four bins, constant-rate segments, cumulative rain/infiltration and water knots, strict-duration records, early/later half durations, terminal water, peak and one attaining peak knot. Zero-length segments are omitted; adjacent equal-rate segments can remain separate to expose threshold arrival. No earliest-peak or all-ties claim is made.

The CLI schema appends `-cli/1` to the consumer name. Raw SHA256 and byte lengths bind all four original files; exact UTF-8, regular-file and identity checks precede analysis and are repeated before stdout. Limits are 16 KiB for the original, 4 KiB for each other input and 4 MiB for the complete output. A refusal emits no report to stdout; there is no output-file write.

## Why these bounds hold

Let C(t) be cumulative rain and S(t)=C(t)−6t. Reflected water is W(t)=S(t)−min(0,min_{s≤t}S(s)). Thus W≥S. On quarters two, three and four the anchored rate-cap lower envelopes give minima S of 13/10, 11/10 and 19/10 mm respectively, at times 9/20, 13/20 and 17/20 hour. Consequently the last three quarters contribute exactly 3/4 hour for H ≤ 11/10. At H=11/10 the possible equality occurs only at one instant.

The first quarter ends at water at least 5/2 mm. A final above-threshold excursion ending there must last at least (5/2−H)/14 because water rises no faster than 14 mm/hour. Conversely, water cannot first reach H before time H/14. For H ≤ 11/10, adding the final three quarters proves both bounds. The universal upper bound remains attained through H=2 by earliest first-quarter rain followed by constant rates 4,8,12; the later minimum is 2 mm, attained only at an isolated instant.

For an explicit complete family, choose L in [0,1/14] and a=1/5−3L/10. Use first-quarter rates 20, 6, 20, 0 for respective durations H/14, L, a−H/14, 1/4−a−L. All durations are nonnegative. Rain totals 20a+6L=4 mm, water ends at 5/2 mm, and the rate-6 interval holds water exactly at H. Use constant rates 4, 8, 12 for the remaining quarters. Total strict duration is 1−H/14−L. For H ≤ 11/10, L=1/14 and L=0 give the returned endpoints. This constructs all intermediate durations without assuming continuity of the discontinuous strict-duration functional.

## Lower history above 11/10 and complete attainability

For H>11/10 the lower witness uses rain 6 until 1/14 hour and then 20 until 1/4; subsequent quarters use their latest possible cap-20 bursts. This single history is globally pointwise minimal: first-quarter water attains max(0,14t−1), and later water attains each raw cumulative-rain lower cone minus6t, with reflection offset zero. Its three later V-shaped minima are 13/10,11/10,19/10. For H≤2 their endpoint waters are at leastH, so each loses (H−m)_+(1/6+1/14) hours from full-quarter exceedance. This proves the correction sum without sampling histories.

For completeness above11/10, interpolate lower and upper rain histories on their finite common grid. Both have nonnegative raw storage and the upper cumulative rain dominates the lower, so interpolated water is affine and nondecreasing in the interpolation parameter. Except at finitely many parameters where rain rate equals6, threshold equality has zero time measure and duration varies continuously. At an equality plateau W=H>0, replace rate6 on a selected subinterval by6+ε then6−ε for equal halves, with0<ε≤6. Water returns to its original endpoint, all quarter totals remain unchanged, and precisely the selected open interval becomes above threshold. Splitting at quarter boundaries fills all jump gaps. This establishes every intermediate duration; the API supplies endpoint certificates only, not a continuous selector or arbitrary interior-duration certificate.

## Bounds and interpretation

The complete work reservation is 51,200 abstract scalar units: the unchanged paired parent reserves 30,720, additional preflight 4,096 and shallow certificate work 16,384. New witnesses have at most 14 segments, 16 knots, 14 duration records, 57 strict knot pairs and 56 quarter-overlap checks. Complete output guards count serialized occurrences, including shared parent references: at most 1,536 rational objects, 650 characters per numerator/denominator, 32,768 visited values and 4 MiB. Persistent/intermediate arithmetic guards remain 8,192/16,384 bits. Abstract work excludes general parsing, strings, traversal, serialization and integer bit costs; it is not a wall-time or memory guarantee.

## Verification

Five focused tests passed on Node 22.23.4. They cover the three rational kink neighborhoods, represented binary64 1.1, a subnormal threshold, strict equality plateaus, unsupported and empty families, and exact parent-call traces. Three actual four-original-file CLI cases (H=1, H=2 and an incompatible reading) also passed separate Python 3.12.3 Fraction receiving checks.

The qualification used a pinned 44-file inherited runtime closure plus the six new files. It establishes this focused mathematical consumer and CLI path; full-repository tests, browser behavior and application packaging were not part of the course.

```sh
node --max-old-space-size=128 --test tests/archived-rain-shallow-duration.test.mjs
```

No field validity, measurement association, probability, damage, safety, permission or alteration of existing soil/routing/clock models follows from the mathematics.
