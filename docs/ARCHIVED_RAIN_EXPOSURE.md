# How much water excess can persist through the event?

A peak says how high water can rise, not how much excess remains over time. This consumer bounds the complete attainable range of

\[
E_H=\int_0^1\max(W(t)-H,0)\,dt
\]

across the compatible continuous rainfall family. Units are **mm·hour**. This is depth integrated over time, not duration above a threshold, damage, probability, drainage volume or whole-site hazard.

The existing `pondingExposure` consumer already integrates positive excess over retained snapshot interpolation in mm·minutes, with interval and duration diagnostics. The mathematical metric is not new. This addition asks a different question: its complete attainable uncertainty range over continuous histories satisfying explicitly hypothetical constraints. It does not change that snapshot API, UI or ownership.

## Three thresholds for the same declarations

```sh
node inspect-archived-rain-exposure.mjs examples/authored-rain-timing.json examples/archived-rain-timing-first-four.json examples/archived-rain-timing-third-exact.json examples/archived-rain-peak-four-half.json
node inspect-archived-rain-exposure.mjs examples/authored-rain-timing.json examples/archived-rain-timing-first-four.json examples/archived-rain-timing-third-exact.json examples/archived-rain-peak-three-half.json
node inspect-archived-rain-exposure.mjs examples/authored-rain-timing.json examples/archived-rain-timing-first-four.json examples/archived-rain-timing-third-exact.json examples/archived-rain-peak-criterion.json
```

| Threshold H | Complete exposure range, mm·hour |
|---|---|
| 4.5 mm | [0, 2/105] |
| 3.5 mm | [1/112, 97/525] |
| 5 mm | [0, 0] |

These examples declare exactly 4 mm in the first quarter and 2 mm in the third. They are fictional, not acquired observations. The fixed model starts dry, has uptake capacity 6 mm/hour and zero capillary drive, caps rain at 20 mm/hour, and assumes 5 mm in each half hour. It includes no routing, outlet or receiving limit.

The fourth input is the existing explicit peak criterion. Its `valueMm` is deliberately reused as the exposure threshold H, and the full peak report and verdict remain visible. There is **no new exposure classification or exposure-at-most criterion**. The original terminal target also remains unchanged.

## Inputs, API and result

```js
import {
  estimateArchivedRainExposureWork,
  inspectArchivedRainExposure,
} from './archived-rain-exposure.js';
const work = estimateArchivedRainExposureWork(originalText, firstText, thirdText, criterionText);
const report = inspectArchivedRainExposure(originalText, firstText, thirdText, criterionText);
```

All four input schemas and ordered first/third roles are unchanged. Duplicate ID labels remain allowed and do not establish association or independence. Values use their exact represented binary64 meaning. This consumer requires **H ≥ 3.5 mm**; that boundary is part of the proof, not a numerical convenience. There is no arbitrary upper cap on finite H.

The estimator uses the paired estimator for admission, checks H before constructing any profiles, and reserves the complete composition. Inspection obtains one complete fresh `pairedReport`; it does not replay an old CLI or a scientific model. Loading module definitions is not model execution. The complete retained report includes both single-quarter peak and terminal analyses and their original criteria.

The four-file CLI reads regular non-symlink exact UTF-8 files without BOM: original up to 16 KiB, each other input up to 4 KiB. It records raw SHA256 and byte counts, rereads all originals before stdout, writes no files, and limits the full serialized report to 4 MiB. Wrapper schema is `experimental-earth-archived-rain-exposure-cli/1`; input keys are `originalDeclaration`, `firstArchivedReading`, `thirdArchivedReading`, and `peakCriterion`.

Report schema is `experimental-earth-archived-rain-exposure/1`. Its metric is `integrated-surface-water-excess`, units `mm*hour`, with exact `thresholdMm`. Assessment retains both compatible quarter bands and inclusive `lowerMmHours`/`upperMmHours` bounds, plus two complete attaining witnesses. Empty bands mean `declared-readings-incompatible` with null bounds and witnesses—not zero exposure. The full parent remains available.

Each witness records all four rain bins, complete ordered rain segments, endpoint water/infiltration states, peak and terminal values, one attaining peak time, and exact exposure. `earlyHalfExposureMmHours` is zero by proof. `laterIntegration` has one record per later segment, at most four, with original segment index, exact endpoints, signed threshold excesses, integration case, optional crossing time and area. A strict crossing has a time; endpoint equality does not invent a crossing. If both endpoint excesses are zero, the `below` case takes precedence.

## Why both bounds are attained

Before the half hour, any rain subinterval contains at most 5 mm at rate at most 20. Its net water gain cannot exceed 3.5 mm. Therefore early exposure is zero for H ≥ 3.5, including equality.

After the half hour, cumulative rain minus uptake stays positive, so the running minimum established earlier cannot decrease. Write its negative as d; then later water is C(t)−6t+d. For first-quarter band [l1,h1], the least d is max(0,1.5−h1), attained by constant rain in the first two quarters; the greatest is 1.5−0.3l1, attained by latest cap-20 pulses in both quarters.

For third-quarter band [l3,h3], latest pulses at r=l3 give the pointwise lowest later cumulative rain; earliest pulses at r=h3 give the highest. These later histories join the first halves at the same cumulative rain 5 mm without resetting storage. Thus the complete lower history is constant/constant/latest/latest, while the upper is latest/latest/earliest/earliest. The upper is generally different from the history attaining the paired peak bound.

Positive-part integration preserves the pointwise ordering. Interpolating feasible rain rates preserves every constraint; reflection and positive-part integration vary continuously. Consequently every scalar exposure between the attained endpoints is possible. This does not claim exposure is linear or monotone along interpolation.

Later water is affine within each retained rain segment because its running minimum is fixed. With duration L and endpoint threshold excesses a,b, the area is zero when both are nonpositive, L(a+b)/2 when both are nonnegative, Lb²/[2(b−a)] for a strict rise across zero, and La²/[2(a−b)] for a strict fall. The last two denominators are positive. This affinity does not extend to early storage or infiltration across depletion.

For H=3.5 in the example, the lower history contributes a final triangle 1/112. The upper contributes 1/210 around its first later bump, then 7/100+11/100 around the last bump, totaling 97/525. At minute 48 (4/5 hour), that last rise equals the threshold and exceeds it immediately afterwards.

## Numerical and interpretation limits

The new certificates have at most 14 rain segments/16 knots in total; with the retained parent, at most 68/80. The reservation is 51,200 abstract scalar units, including 30,720 for the parent and explicit repeated admission. Parsing, strings, serialization and rational bit costs are separate; this is not a runtime guarantee.

The new exact area encodings allow 700 characters per integer, because squaring threshold excess can require more digits than the earlier profile states. Existing parent limits and 8,192/16,384-bit arithmetic guards remain unchanged. Crossing times and areas are exact rationals; no rounded-time model replay is claimed. A finite huge threshold gives zero exposure, not permission to square huge negative excess unnecessarily.

These results do not validate a rain record, instrument, chronology, soil, rate cap or physical intervention. They concern the stated continuous mathematical family, not a finite enumeration of the original illustrative schedules. H below 3.5 requires a different proof because the early half may contribute.

Six focused test groups passed: independent envelope extrema, endpoint and empty families, strict and tangent crossings, represented numeric extremes, full parent preservation, and exact nested-call instrumentation. Four sequential instrumented children confirmed the expected 16/5/16/5 parent-entry traces and zero entries into nine loaded scientific functions.

All three actual commands passed independent exact-rational receiving. A generic raw-anchor envelope oracle verified the complete exposure bounds, both full attaining histories, every integration record, reflection, quarter totals and all strict knot pairs. The entire paired parent report was independently received in each case; the H=5 parent also matched its previously qualified complete report. Source, runtime and request guards passed, with empty stderr and no retained process groups. These are headless mathematical and CLI qualifications; no field or acquired-data validation is claimed.
