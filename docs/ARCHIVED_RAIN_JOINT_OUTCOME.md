# Can one rain history produce both outcomes?

Separate peak and terminal ranges do not imply that every pair of values can occur together. This consumer reports their complete **same-history region** and checks one required hypothetical outcome query. It retains the complete [paired-quarter report](ARCHIVED_RAIN_PAIRED_PEAK.md), including both single-quarter peak and terminal reports, without changing their targets or verdicts.

The fixed fictional assumptions are unchanged: initially dry storage, constant uptake 6 mm/hour, zero capillary drive, rain at most 20 mm/hour, and 5 mm in each half hour. There is no routing, receiving limit or field calibration. First and third declarations retain their actual uncertainties and ordered roles; repeated ID labels are allowed and do not authenticate anything.

## Three questions with the same declarations

```sh
node inspect-archived-rain-joint-outcome.mjs examples/authored-rain-timing.json examples/archived-rain-timing-first-four.json examples/archived-rain-timing-third-exact.json examples/archived-rain-peak-criterion.json examples/archived-rain-joint-feasible.json
node inspect-archived-rain-joint-outcome.mjs examples/authored-rain-timing.json examples/archived-rain-timing-first-four.json examples/archived-rain-timing-third-exact.json examples/archived-rain-peak-criterion.json examples/archived-rain-joint-excess.json
node inspect-archived-rain-joint-outcome.mjs examples/authored-rain-timing.json examples/archived-rain-timing-first-four.json examples/archived-rain-timing-third-exact.json examples/archived-rain-peak-criterion.json examples/archived-rain-joint-below-terminal.json
```

For these exact 4 mm first-quarter and 2 mm third-quarter declarations, terminal water T lies in [4,4.3] mm and peak P lies in [4,4.9] mm. A common history additionally requires **0 ≤ P−T ≤ 0.6 mm**.

| Hypothetical terminal | Hypothetical peak | Result |
|---|---|---|
| 4.25 mm | 4.75 mm | Feasible; one history attains both |
| 4 mm | 4.75 mm | Infeasible: excess 0.75 exceeds 0.6, although both values belong to their marginal ranges |
| 4.25 mm | 4.125 mm | Infeasible: peak-minus-terminal is −0.125 |

The negative derived excess is retained as evidence of infeasibility; it is not clamped or rejected as a negative input. All query input values are nonnegative. The retained parent's peak-at-most-5 verdict remains certain meet in all three reports: asking for an impossible hypothetical outcome does not change the underlying family or criterion.

## Required fifth input

```json
{
  "schema": "experimental-earth-archived-rain-joint-outcome-query/1",
  "id": "fictional-joint-feasible",
  "terminalMm": 4.25,
  "peakMm": 4.75,
  "source": "Fictional hypothetical joint outcome, not observed water or an authenticated event."
}
```

These are exactly the allowed keys. Values are finite nonnegative binary64 numbers interpreted exactly, with no arbitrary value ceiling or epsilon. ID/source are nonblank well-formed strings of at most 600 code units. The query is at most 4 KiB. **T denotes an outcome, not the original terminal criterion threshold.** This fifth input is required; existing four-input planning behavior is not overloaded.

```js
import {
  estimateArchivedRainJointOutcomeWork,
  inspectArchivedRainJointOutcome,
} from './archived-rain-joint-outcome.js';
const work = estimateArchivedRainJointOutcomeWork(originalText, firstText, thirdText, criterionText, queryText);
const report = inspectArchivedRainJointOutcome(originalText, firstText, thirdText, criterionText, queryText);
```

Query admission precedes parent calls. The estimator reserves the full composition without building profiles. Inspection obtains one complete fresh paired report and retains it unchanged in `pairedReport`; the query remains separate in `declaredJointOutcomeQuery`. No model or old CLI is replayed. Repeated estimator/admission work is included in the composition.

The five-file CLI requires regular non-symlink exact UTF-8 files without BOM, up to 16 KiB original and 4 KiB each other input. Its `experimental-earth-archived-rain-joint-outcome-cli/1` wrapper records exact byte counts/SHA256 for `originalDeclaration`, `firstArchivedReading`, `thirdArchivedReading`, `peakCriterion`, and `jointOutcomeQuery`. It rereads all bytes before one stdout write, creates no files and bounds output to 4 MiB.

## Read the region and query separately

The report schema is `experimental-earth-archived-rain-joint-outcome/1`. Assessment retains both compatible quarter bands. A compatible region uses coordinates terminal water and peak-minus-terminal, inclusive bounds, a geometry label (`point`, `segment` or `parallelogram`), and at most four vertices. Corners are ordered lower/lower, upper/lower, upper/upper, lower/upper with exact stable duplicate removal. Every vertex has one complete common-history witness.

The query reports exact terminal, peak and signed excess values. Its status is feasible or infeasible; every violated constraint is listed in fixed order: terminal below lower, terminal above upper, excess below lower, excess above upper. Equality is feasible. A feasible query includes one common-history witness. An incompatible declaration band instead gives a null region and query status `outside-support`, with no witness and no fabricated constraint violations. Both full parent reports remain visible. An empty violation list in that state does not mean feasibility.

## Why the joint region is complete

Let first-quarter total be q and third-quarter total r. Write S(t)=C(t)−6t for cumulative rain minus uptake, and let the running minimum of S, including zero, be −d after the half hour. Cap-aware lower envelopes show S stays positive thereafter, so terminal water is T=4+d. Before the half hour water is at most 3.5 mm, below every terminal value. The peak therefore occurs later, with excess δ=P−T determined by the second-half maximum of S.

For fixed q,r the complete region is

\[
\max(4,11/2-q)\le T\le11/2-3q/10,
\qquad \max(0,r-7/2)\le\delta\le3r/10.
\]

For actual clipped declaration bands [l1,h1], [l3,h3], replace these with

\[
\max(4,11/2-h1)\le T\le11/2-3l1/10,
\qquad \max(0,l3-7/2)\le\delta\le3h3/10.
\]

This rectangular attainability in (T,δ) is deterministic, not statistical independence. It maps to a parallelogram or degenerate segment/point in (T,P).

For any point in the rectangle, choose q=max(l1,11/2−T), r=max(l3,10δ/3), d=T−4. A cap-20 first-quarter pulse starts at d/6 and lasts q/20. The middle quarters use constant rates 4(5−q) and 4r. A cap-20 last-quarter pulse starts at 3/4+r/20−δ/6 and lasts (5−r)/20. Rain is zero elsewhere. The bounds ensure both pulses fit and selected q,r belong to their bands. This profile has running minimum −d, terminal T and peak T+δ. Zero-length pulses and endpoint ties are allowed.

Every certificate retains exact bins, rain segments, all endpoint states, both quarter totals, terminal and peak values, and one attaining peak time. It checks rate cap, integrals, mass balance, monotone infiltration and reflection. At most eight segments/nine knots describe each history. Constant-rate water has no interior maximum larger than its endpoints, but water/infiltration need not interpolate linearly through depletion. The attaining knot is not a claim about all ties or earliest continuous attainment. Rational certificate times need not be binary64-replayable.

## Scope and qualification

The full reservation is 67,584 abstract scalar units, including 30,720 parent units and repeated admission. Up to five new histories plus the parent give at most 94 segments/109 knots. Existing 8,192/16,384-bit guards, canonical integer encodings and a 2,048-rational output bound remain explicit. Scalar work excludes parsing, strings, serialization and integer-bit cost and is not a runtime guarantee.

The query is fictional and hypothetical, not acquired water data, instrument validation, chronology, availability, rate-cap inference or a whole-site prediction. Existing snapshot/UI and physical-model scopes remain unchanged. Six focused test groups passed, covering common-history feasibility, closed facets and adjacent represented values, mixed violations, point/segment degeneracies, uncertainty and incompatible bands, finite extremes/subnormals, admission and complete parent retention. Four instrumented children confirmed the exact nested parent-call sequences and zero entries into nine loaded scientific functions.

All three actual commands passed independent exact-rational receiving. The receiver derives the rectangle from raw half-anchor envelopes and verifies every common-history profile through integration, reflection and all strict knot pairs. The complete paired parent report matches its previously qualified output in all three cases. Source, runtime and request guards passed; each command exited with empty stderr and no retained process group. These are headless mathematical and CLI qualifications under the stated fictional assumptions.
