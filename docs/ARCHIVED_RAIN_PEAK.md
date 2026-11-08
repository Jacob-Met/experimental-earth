# When a terminal-water conclusion hides a larger peak

A surface can meet its end-of-event water target after having held more water earlier. This consumer asks a **separately declared peak-water question** under the same fictional model used by [Archived rain timing](ARCHIVED_RAIN_TIMING.md). It retains the complete terminal analysis instead of replacing its metric or verdict.

The assumed surface starts dry, has constant uptake capacity 6 mm/hour and no capillary drive, routing, outlet or receiving limit. Rain is nonnegative, at most 20 mm/hour, with 5 mm in each half-hour. Those totals and parameters are hypothetical constraints, not verified field observations. The original three schedules are illustrative; the analysis covers the continuous family satisfying the constraints and declared quarter-reading band.

## Run three contrasting questions

```sh
node inspect-archived-rain-peak.mjs examples/authored-rain-timing.json examples/archived-rain-timing-first-exact.json examples/archived-rain-peak-criterion.json
node inspect-archived-rain-peak.mjs examples/authored-rain-timing.json examples/archived-rain-timing-third-exact.json examples/archived-rain-peak-criterion.json
node inspect-archived-rain-peak.mjs examples/authored-rain-timing.json examples/archived-rain-timing-third-heavy.json examples/archived-rain-peak-criterion.json
```

The new criterion asks whether peak surface water is **at most 5 mm**, inclusively. The unchanged original asks whether terminal water is at most 5 mm. Equal numerical thresholds do not make these the same question.

| Authored exact quarter reading | Complete peak range | Peak verdict | Retained terminal range and verdict |
|---|---|---|---|
| First quarter: 2 mm | [4, 6.4] mm | Ambiguous | [4, 4.9] mm; certain meet |
| Third quarter: 2 mm | [4, 6.1] mm | Ambiguous | [4, 5.5] mm; ambiguous |
| Third quarter: 5 mm | [5.5, 7] mm | Certain miss | [4, 5.5] mm; ambiguous |

Every displayed endpoint is attained by an admitted rain profile. The first reading settles the terminal target but not the peak target. The heavy third-quarter reading establishes a peak miss even though it leaves the terminal range unchanged. Thus an interval that was uninformative for one objective can matter for another.

## Keep the criterion explicit

The third input has exactly these keys:

```json
{
  "schema": "experimental-earth-archived-rain-peak-criterion/1",
  "id": "authored-peak-at-most-five",
  "metric": "peak-surface-water-mm",
  "operator": "at-most",
  "valueMm": 5,
  "source": "Fictional authored peak-water question, separate from the original terminal target."
}
```

The value is a finite nonnegative binary64 number in millimetres, interpreted exactly as represented. There is no 10,000 mm ceiling or epsilon. Identity and source must be nonblank, well-formed strings of at most 600 code units. The original and reading use their existing schemas unchanged. A quarter reading still describes the first 0–15 or third 30–45 minutes, not verified record availability or a physical event association.

The CLI accepts three regular non-symlink exact UTF-8 files without a BOM: original up to 16 KiB, reading and criterion up to 4 KiB each. It verifies file identities and full bytes before and after calculation, serializes the complete result within 1 MiB before stdout, and writes no files. Its schema is `experimental-earth-archived-rain-peak-cli/1`, with SHA256 and byte counts in `inputs.originalDeclaration`, `inputs.archivedReading` and `inputs.peakCriterion`.

## API and retained terminal result

```js
import {
  estimateArchivedRainPeakWork,
  inspectArchivedRainPeak,
} from './archived-rain-peak.js';

const work = estimateArchivedRainPeakWork(originalText, readingText, criterionText);
const report = inspectArchivedRainPeak(originalText, readingText, criterionText);
```

The estimator admits and reserves work without constructing profiles. The inspector obtains one complete fresh terminal report and retains it in `terminalReport`, including the unchanged original declaration and target. `declaredPeakCriterion` remains separate. No floating-point soil model, graph solver or old CLI is executed; loading transitive module definitions is not scientific model execution.

The result schema is `experimental-earth-archived-rain-peak/1`. Its assessment contains the quarter interval, exact parameters, compatible quarter band, `peakBounds`, classification and two witnesses. Empty bands give `declared-reading-incompatible`, `outside-support`, an inverted retained band and null bounds/witnesses; the full terminal incompatibility remains visible. Compatible bounds are inclusive. Upper ≤ peak target means certain meet, lower > target means certain miss, otherwise ambiguous.

Each witness retains exact bins, rain segments, endpoint states, peak surface water, **one** `attainingPeakHour`, and terminal surface water. This time is a certified attaining endpoint, not a list of all ties or a claim about the first continuous attainment. Lower witnesses have three constant-rate bins; upper witnesses use latest rain in the first two bins and earliest rain in the third. All interval totals, the reading band, cap, reflection and mass balance are checked.

Peak values concern continuous time in this explicit model. On a constant-rain segment, surface water increases, decreases, or decreases to zero and stays there, so its maximum is at an endpoint. That does not make infiltration and storage linear between every pair of reported knots. Rational profile event times need not be binary64 numbers; no rounded-time replay is claimed.

## Why these are complete ranges

Let C(t) be cumulative rain over one hour. For the initially dry constant-capacity model,

\[
P=\max_{0\le s\le t\le1}\{C(t)-C(s)-6(t-s)\}.
\]

Write q for an exact quarter total. First-quarter bins have amounts q, 5 − q and 5 mm over durations 1/4, 1/4 and 1/2 hour. Third-quarter bins have amounts 5, q and 5 − q over durations 1/2, 1/4 and 1/4 hour. The complete peak ranges are

\[
\begin{aligned}
\text{first: }&[\max(4,11/2-q),\;7-3q/10],\\
\text{third: }&[\max(4,1/2+q),\;11/2+3q/10].
\end{aligned}
\]

The full-hour interval supplies the lower bound 4. The interval from minute 15 to 60 supplies the additional first-quarter bound 11/2 − q; the interval from minute 0 to 45 supplies the third-quarter bound 1/2 + q. Constant rain within each bin attains their maximum.

For the upper bounds, classify every interval by which contiguous bins it spans. An amount a requires duration at least a/20, hence contributes at most 7a/10 after uptake. An interval spanning all three bins also includes the entire middle quarter. If its edge-bin contributions are a and c, its duration is at least a/20 + 1/4 + c/20. Substituting each case's middle amount gives the stated upper bound; intervals spanning one or two bins have no larger bound. Latest/latest/earliest pulses attain equality. Convex interpolation of feasible cumulative histories and continuity of peak reflection fill every intermediate peak value.

For a compatible reading band [lo, hi], first-quarter lower and upper bounds use hi and lo respectively. Third-quarter lower and upper bounds use lo and hi. Thus:

\[
\begin{aligned}
\text{first band: }&[\max(4,11/2-\mathrm{hi}),\;7-3\mathrm{lo}/10],\\
\text{third band: }&[\max(4,1/2+\mathrm{lo}),\;11/2+3\mathrm{hi}/10].
\end{aligned}
\]

For a separately declared peak target of 5 mm, no compatible band guarantees meet: every upper bound is at least 5.5 mm. A first-quarter band guarantees miss only when hi < 1/2; a third-quarter band guarantees miss only when lo > 9/2. Equality allows a peak exactly 5 and is not certain miss.

## Interpretation and qualification

This continuous-family analysis differs from extracting maxima and ties from retained simulation snapshots. It neither changes the existing peak-time UI nor claims those retained samples establish a continuous maximum. It also does not validate rainfall, soil, instrument precision, independence, event association or physical consequences. Both half-hour totals concern the whole event, so this is retrospective or hypothetical reanalysis, not permission to acquire a past reading.

The complete parent reservation is 4,096 abstract scalar units; added admission and peak work reserve 6,144, for 10,240 total. Peak certificates have at most nine segments and eleven knots; combined with the parent, at most 21 segments and 25 knots. Arithmetic uses existing 8,192/16,384-bit guards, with bounded exact encoding. Work counters exclude parsing, serialization, string and rational bit costs and are not runtime guarantees.

Six focused tests passed: independent affine-span extrema, complete parent retention, strict classification boundaries, uncertain bands, exact extreme/subnormal arithmetic, invalid-input admission, and instrumented parent call order with zero entries into nine loaded scientific functions. The three commands above also passed independent exact-rational receiving, including every returned bin/profile, conservation and continuous peak, plus complete terminal-report verification. The first two terminal reports equal their previously qualified outputs.

The test course and each CLI ran under prospective time, CPU, memory-monitoring and output bounds with unchanged source/runtime guards and no retained process group. These are headless mathematical/CLI results; no browser or field qualification is claimed. All examples remain fictional mathematical declarations, not acquired observations.
