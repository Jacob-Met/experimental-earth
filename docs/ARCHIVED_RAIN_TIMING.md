# What an archived quarter-hour reading could resolve

Two half-hour rainfall totals can leave a standing-water decision unresolved because they do not specify when rain arrived within each half-hour. Under the fixed fictional model in [Authored rain timing](AUTHORED_RAIN_TIMING.md), an additional first-quarter total can resolve that decision, while an equally precise third-quarter total need not help at all.

This consumer reanalyses a declared archived reading mathematically. It keeps the complete original authored declaration and does not replay the floating-point soil model. Its result describes all nonnegative rain histories satisfying the assumed totals and rate cap, not just the original three illustrative schedules.

## Run the examples

From the repository root:

```sh
node inspect-archived-rain-timing.mjs examples/authored-rain-timing.json examples/archived-rain-timing-first-exact.json
node inspect-archived-rain-timing.mjs examples/authored-rain-timing.json examples/archived-rain-timing-first-uncertain.json
node inspect-archived-rain-timing.mjs examples/authored-rain-timing.json examples/archived-rain-timing-third-exact.json
```

The unchanged original specifies an initially dry isolated surface, uptake capacity 6 mm/hour, zero capillary drive and rain rate at most 20 mm/hour. Each original illustrative schedule supplies 5 mm in each half-hour. Those common totals become **hypothetical constraints**, not newly verified observations. The terminal target is surface water at most 5 mm after one hour.

| Authored reading | Compatible quarter total | Complete terminal range | Target conclusion |
|---|---|---|---|
| First quarter, 2 ± 0 mm | {2} mm | [4, 4.9] mm | Certain meet |
| First quarter, 2 ± 0.5 mm | [1.5, 2.5] mm | [4, 5.05] mm | Ambiguous |
| Third quarter, 2 ± 0 mm | {2} mm | [4, 5.5] mm | Ambiguous |

All endpoints in these ranges are attained. The first reading can resolve the target only under a sufficiently informative declared uncertainty. The third-quarter reading leaves the full original range: a later interval is not automatically more useful for this decision. These are authored expectations, not evidence that a physical instrument has the stated precision.

## Inputs and retained context

The original must retain the fixed `experimental-earth-authored-rain-timing/1` declaration. This consumer does not turn it into a general project or forcing schema. The second file has exactly six keys, for example:

```json
{
  "schema": "experimental-earth-archived-rain-timing-reading/1",
  "id": "authored-first-quarter-exact",
  "quarter": "first",
  "valueMm": 2,
  "uncertaintyMm": 0,
  "source": "Fictional authored archived-reading declaration; not an acquired record."
}
```

`quarter` is `first` (0–15 minutes) or `third` (30–45 minutes). Value and uncertainty must be finite nonnegative binary64 numbers in normalized millimetres. The consumer uses their exact represented values; it does not round a threshold or add an epsilon. There is no 10,000 mm ceiling. Identity and source are nonblank strings of at most 600 code units.

The original has no physical site or event identity. Matching this small schema does not verify that a real record belongs to a particular storm. The full-hour totals also make the analysis retrospective or explicitly hypothetical: a new sensor cannot measure a past quarter-hour. No availability time, deadline, readiness or physical action follows from this result.

The two-file CLI admits regular non-symlink exact UTF-8 files without a BOM, bounded at 16 KiB for the original and 4 KiB for the reading. It verifies full file identity and bytes before and after inspection, serializes the complete bounded result before stdout, and writes no input or observation file. Its wrapper schema is `experimental-earth-archived-rain-timing-cli/1`; `inputs.originalDeclaration` and `inputs.archivedReading` retain SHA256 and byte length.

## API and exact certificates

```js
import {
  estimateArchivedRainTimingWork,
  inspectArchivedRainTiming,
} from './archived-rain-timing.js';

const work = estimateArchivedRainTimingWork(originalText, readingText);
const report = inspectArchivedRainTiming(originalText, readingText);
```

The estimator admits the inputs and reserves work without constructing profiles. The inspector returns schema `experimental-earth-archived-rain-timing/1`, preserving `originalDeclaration`, `declaredReading`, scope, work, assessment and interpretation. No model or rainfall graph consumer is called. Reusing the existing rational core loads its transitive module definitions; that is distinct from executing their scientific functions.

`assessment` identifies the quarter in minutes, exact parameters and the compatible quarter band. The declared band is intersected with [0, 5] mm. An empty intersection gives `declared-reading-incompatible` and `outside-support`, retaining the inverted band with `empty: true`; bounds and witnesses are null. A compatible result supplies inclusive exact `terminalBounds` and a classification. A finite upper bound ≤ 5 means certain meet; a lower bound > 5 means certain miss; otherwise the result is ambiguous.

Each endpoint has an attaining witness containing three bins, at most six positive-duration constant-rate segments and the initial plus endpoint knots. The witness retains quarter total, original half-hour totals, rates, depths, cumulative rain, cumulative infiltration and surface water. Segments cover the whole hour without gaps or overlaps, preserve bin boundaries and respect the declared cap. Zero-duration pieces are omitted.

The knots give exact **endpoint states**. Cumulative rain is linear on a constant-rate segment, but infiltration and surface storage need not be linear if the surface empties inside it. Do not interpolate these state knots as a full continuous state trajectory. The profiles use exact rational event times, which may not be binary64 numbers; they are mathematical certificates, not rounded-time replays of `advanceWettingFront`.

## Why the range is complete

Write q for the quarter total. For a first-quarter reading the bins have lengths 1/4, 1/4 and 1/2 hour and rainfall amounts q, 5 − q and 5 mm. For a third-quarter reading the lengths are 1/2, 1/4 and 1/4 hour, with amounts 5, q and 5 − q mm.

Within each bin, placing rain as early as the 20 mm/hour cap allows maximizes intermediate cumulative rainfall; placing it as late as possible minimizes it. With terminal cumulative rain fixed at 10 mm, reflected surface storage is

\[
W(1)=\max_{0\le t\le1}\{10-C(t)-6(1-t)\}.
\]

It decreases when intermediate C increases. Earliest and latest profiles therefore attain the extrema. For a first-quarter compatible band [lo, hi], the exact range is

\[
\left[\max(4,11/2-\mathrm{hi}),\quad11/2-3\mathrm{lo}/10\right].
\]

The lower witness uses earliest rain with q = hi; the upper uses latest rain with q = lo. For the third quarter, every compatible band leaves [4, 11/2]; q = lo supplies both witnesses. Convex interpolation of feasible cumulative histories preserves every band and cap, and terminal reflection is continuous, so all intermediate terminal values occur. This completeness argument concerns the continuous family, not enumeration of the three original schedules.

An exact first-quarter q below 1/2 is certain miss; q from 1/2 up to but excluding 5/3 is ambiguous; q ≥ 5/3 is certain meet. The rational boundary 5/3 is not exactly representable in binary64. Encoded readings are compared as exact represented numbers to that boundary, not to a rounded substitute.

## Scope, bounds and qualification

The assumed model omits routing, outlets, capillary uptake, finite receiving capacity and physical site validation. Neither rate cap nor conductivity is inferred from the reading. There is no probability, independence, instrument-authenticity or finite-family selection claim, and no change to original evidence roles, event lifecycle or timeline support.

Two profiles require at most twelve segments in total. A 4,096-unit abstract scalar reservation bounds the fixed arithmetic/check structure; it excludes parsing, serialization, string processing and rational bit costs and is not a CPU or memory guarantee. Persistent and intermediate arithmetic guards are 8,192 and 16,384 bits. Raw incompatible bounds may be much larger than clipped profile values, so output allows up to 650 characters per rational integer and at most 1 MiB for the complete CLI JSON.

Independent checks passed for the complete ranges, exact threshold boundaries, extreme binary64 inputs, original preservation and scientific-entry isolation. Five scientific checks passed in the initial course. That course exposed a syntax defect in the generated instrumentation loader; after correcting its newline escaping, the remaining instrumentation check passed separately with all nine watched definitions loaded and zero scientific entries. The original failure remains part of the qualification record.

All three actual two-file CLI examples passed a separate exact Fraction receiver deriving extrema from four-anchor cumulative envelopes and checking every emitted profile, input identity and source/runtime end guard. These bounded runs used Node v24.22.1. They qualify the authored mathematical declarations and certificates; they do not establish acquired observations or physical validity.
