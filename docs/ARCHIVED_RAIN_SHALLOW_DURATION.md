# Time above a shallow depth in a fixed rainfall family

This separate mathematical consumer answers a previously unsupported question: how long can surface water be **strictly above H**, for fixed quarter-hour rainfall totals **4, 1, 2, 3 mm**, dry initial storage, uptake capacity 6 mm/hour, zero capillary drive and rain bounded by 20 mm/hour? These are authored assumptions, not observations or a whole-site forecast.

It admits exactly **0 < H ≤ 7/2 mm**. JSON numbers mean represented binary64 values: `1.1` is slightly greater than exact 11/10 and therefore has a small strictly positive correction; it is admitted without rounding. The value `1` is an uncomplicated admitted example. Existing zero-threshold and H ≥ 3.5 consumers are unchanged. This extension overlaps the latter at the exact endpoint 7/2.

```sh
node inspect-archived-rain-shallow-duration.mjs examples/authored-rain-timing.json examples/archived-rain-timing-first-four.json examples/archived-rain-timing-third-exact.json examples/archived-rain-peak-one.json
```

The CLI uses four original files and retains one complete fresh paired-peak parent at the **original supplied peak criterion**, including its original terminal questions. The new quantity is duration in hours; it adds no duration verdict or new acquisition claim.

## Exact range and certificates

For the compatible fixed family and 0 < H ≤ 2, the attained range is

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

For completeness in 11/10 < H ≤ 2, interpolate lower and upper rain histories on their finite common grid. Both have nonnegative raw storage and the upper cumulative rain dominates the lower, so interpolated water is affine and nondecreasing in the interpolation parameter. Except at finitely many parameters where rain rate equals6, threshold equality has zero time measure and duration varies continuously. At an equality plateau W=H>0, replace rate6 on a selected subinterval by6+ε then6−ε for equal halves, with0<ε≤6. Water returns to its original endpoint, all quarter totals remain unchanged, and precisely the selected open interval becomes above threshold. Splitting at quarter boundaries fills all jump gaps. This establishes every intermediate duration; the API supplies endpoint certificates only, not a continuous selector or arbitrary interior-duration certificate.


## Exact extension above 2 mm

For 2 < H ≤ 7/2, write (x)_+ = max(0,x). The lower duration is

\[
L(H)=\frac{10}{21}(5/2-H)_+ + \frac{4-H}{14}.
\]

The upper duration is

\[
U(H)=
\begin{cases}
4/3-5H/21,&2<H\le23/10,\\
629/420-13H/42,&23/10<H\le14/5,\\
303/140-23H/42,&14/5<H\le7/2.
\end{cases}
\]

At H = 3 the exact interval is [1/14, 73/140]; at H = 7/2 it is [1/28, 26/105]. The example `examples/archived-rain-peak-three.json` supplies H = 3. Boundaries 23/10, 14/5 and 5/2 are exact rational comparisons; JSON decimals retain their represented binary64 value without snapping.

The same eight-segment lower history remains pointwise minimal. Integrating its first-quarter rising suffix and the three later raw cones gives the displayed lower expression. The below-threshold parts can extend across quarter endpoints, so the earlier correction-sum expression must not be extrapolated above 2.

For the upper endpoint let D be the magnitude of the first-half minimum of C(t)-6t. The rate cap and exact first-quarter total imply 0 ≤ D ≤ 3/10. Conditional on D, first-quarter strict duration is bounded by
max(0,min(1/4-D/6-H/14,2/3-5H/21)).
The first term follows from earliest threshold arrival; the second follows from the absolutely continuous positive-part chain rule and rain used to reach H. This bound covers arbitrary and repeated threshold excursions, not only pulse-shaped histories.

For a time \(\tau\) attaining the minimum, nonnegative cumulative rain and the remaining rate-cap constraint give
\[
D/6\le\tau\le(1-D)/14,
\]
which proves the deficit range. Later raw storage remains positive, so this is the relevant running minimum after the first quarter. If first-quarter strict exceedance has positive duration \(T\), its first crossing \(a\) satisfies \(a\ge D/6+H/14\) and \(C(a)\ge10H/7\). The positive-part chain rule gives
\[
\int_{\{W>H\}\cap[0,1/4]}r(t)\,dt
=6T+(5/2+D-H)_+.
\]
Rain before the first crossing and rain on the strict exceedance set are disjoint, hence
\[
4\ge10H/7+6T+(5/2+D-H)_+.
\]
Combining this with the remaining time after the earliest crossing yields the displayed conditional bound. If the exceedance set is empty, its duration is already zero.

Where first-quarter duration decreases with D, its marginal loss is 1/6 hour per mm. Before D reaches H-2, the second and third quarters together gain 1/6+1/14=5/21, which is larger. Once D reaches H-2, when that is feasible, all later quarters are full and further deficit only delays the first crossing. When the first-quarter contribution is constant or zero, later duration is nondecreasing in D. Thus the maximizing deficit is D = min(H-2,3/10). Start with zero rain for D/6 hour, rain at 20 for 1/5 hour, then zero to the first-quarter endpoint. For H ≤ 23/10, later constant rates 4, 8 and 12 remain strictly above H except at isolated equality endpoints, and give the upper bound with six total segments. For H > 23/10, D = 3/10 and the first quarter has two segments; each later quarter uses its earliest cap-20 burst, giving eight total segments. Initial dry segments are reflected at zero; no affine negative-water interpolation is claimed.

Complete attainability still needs a discontinuity argument. Put lower and upper rainfall on their finite common breakpoint grid. For t < d = D/6 ≤ 1/20, the lower raw storage is zero and the upper raw storage is -6t. The mixed running minimum equals the mixed raw storage, so all three reflected waters are zero there. At d the two raw storages are zero and -D. For t ≥ d, lower raw storage stays nonnegative and upper raw storage stays at least -D, with equality at d; the mixed running minimum is therefore exactly -lambda D. Reflected water is the corresponding affine interpolation for t ≥ d as well. Because the lower history is pointwise minimal, these waters are ordered. Duration can jump at positive-length threshold plateaus. On such a plateau, replacing rate 6 by 6+epsilon then 6-epsilon over equal halves of a chosen subinterval preserves quarter totals, endpoint storage and the earlier minimum, while adding exactly that interval's length to strict exceedance. Split these intervals at quarter boundaries. This fills every jump and proves the full attained interval; the implementation returns only endpoint witnesses.

## Bounds and interpretation

The complete work reservation is 51,200 abstract scalar units: the unchanged paired parent reserves 30,720, additional preflight 4,096 and shallow certificate work 16,384. New witnesses have at most 16 segments, 18 knots, 16 duration records, 72 strict knot pairs and 64 quarter-overlap checks. Including the unchanged parent the caps are 70 segments and 82 knots. Complete output guards count serialized occurrences, including shared parent references: at most 1,536 rational objects, 650 characters per numerator/denominator, 32,768 visited values and 4 MiB. Persistent/intermediate arithmetic guards remain 8,192/16,384 bits. Abstract work excludes general parsing, strings, traversal, serialization and integer bit costs; it is not a wall-time or memory guarantee.

## Focused qualification

The H ≤ 7/2 extension passed one bounded course on Node v22.23.4 and Python 3.12.3. All six maintained test groups passed: 25 compatible inspections, two incompatible families, 27 complete paired-parent comparisons, 35 explicit estimates, 37 independent exact-bound calculations and 25 independent two-witness checks. Four sequential instrumented children verified the exact parent call traces, including the new H=3 branch, and zero calls to the nine prohibited scientific entry points. Boundary controls include the first binary64 value above 2, neighbors of represented 2.3/2.5/2.8, exact 3.5 and refusal immediately above 3.5.

Three original four-file CLI calls at represented 2.3, exact 3 and exact 3.5 each passed an independent Python receiver. The H=3 interval is [1/14,73/140]; H=3.5 is [1/28,26/105]. The 2.3 case was checked at its exact represented value 2589569785738035/1125899906842624, with no snapping to 23/10. Each receiver checked all four raw input identities, every emitted new witness and the retained parent geometry and lineage.

The frozen qualification contained 50 canonical baseline and 51 candidate files, with a total reservation of 6,477,824 abstract scalar units including independent witness verification. All seven commands exited zero, stderr was empty, owned process groups were empty afterward, and source/runtime end guards passed. The original result receipt is SHA256 `3ea447814a6977258021e87258c3624ccbbb85eccd39c438c2ee8d24dad6c0d2`. Publication changes only this guide's exposition and qualification text; executable, test and fixture bytes match the qualified candidate.

This is focused mathematical-consumer and CLI qualification. Full-repository tests, browser behavior and application packaging were outside the course. No field validity, measurement association, probability, damage, safety, permission or alteration of existing soil/routing/clock models follows from the mathematics.
