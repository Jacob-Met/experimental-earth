# When two archived quarters settle a peak-water question

Two declarations can constrain the same rain history more strongly than either alone. This consumer keeps both complete [single-quarter peak reports](ARCHIVED_RAIN_PEAK.md), including their unchanged terminal reports, and answers a separately declared peak criterion for their joint continuous family.

The original remains hypothetical: initially dry storage, constant uptake 6 mm/hour, no capillary drive, rain at most 20 mm/hour, and 5 mm in each half hour. There is no routing, receiving limit, outlet or physical calibration. These assumptions and the declarations are not verified observations.

## Three contrasting examples

```sh
node inspect-archived-rain-paired-peak.mjs examples/authored-rain-timing.json examples/archived-rain-timing-first-four.json examples/archived-rain-timing-third-exact.json examples/archived-rain-peak-criterion.json
node inspect-archived-rain-paired-peak.mjs examples/authored-rain-timing.json examples/archived-rain-timing-first-exact.json examples/archived-rain-timing-third-exact.json examples/archived-rain-peak-criterion.json
node inspect-archived-rain-paired-peak.mjs examples/authored-rain-timing.json examples/archived-rain-timing-first-one.json examples/archived-rain-timing-third-four-half.json examples/archived-rain-peak-criterion.json
```

All three use an explicit peak-at-most-5-mm criterion. The original terminal target stays separate.

| First-quarter total | Third-quarter total | Complete joint peak range | Joint verdict | Each single-quarter peak verdict |
|---|---|---|---|---|
| 4 mm | 2 mm | [4, 4.9] mm | Certain meet | Ambiguous |
| 2 mm | 2 mm | [4, 5.5] mm | Ambiguous | Ambiguous |
| 1 mm | 4.5 mm | [5.5, 6.55] mm | Certain miss | Ambiguous |

The last row matters as much as the first: the middle half hour necessarily contains enough rain to establish a miss, although neither separate report does. The original three schedules are illustrative and are not enumerated as the complete family.

## Inputs and API

```js
import {
  estimateArchivedRainPairedPeakWork,
  inspectArchivedRainPairedPeak,
} from './archived-rain-paired-peak.js';
const work = estimateArchivedRainPairedPeakWork(originalText, firstText, thirdText, criterionText);
const report = inspectArchivedRainPairedPeak(originalText, firstText, thirdText, criterionText);
```

The four inputs reuse the original, archived-reading and peak-criterion schemas unchanged. First and third argument roles must match their quarter fields; they are never silently reordered. IDs are retained verbatim, including duplicate labels. Ordered roles distinguish the declarations; neither distinct nor equal labels authenticate association or independence. Each declaration keeps its actual uncertainty.

The CLI reads regular non-symlink exact UTF-8 files without BOM, up to 16 KiB for the original and 4 KiB for each other input. It records raw SHA256 and byte counts in `inputs.originalDeclaration`, `firstArchivedReading`, `thirdArchivedReading` and `peakCriterion`, rereads all original bytes before stdout, writes no files, and bounds complete output to 2 MiB. Wrapper schema is `experimental-earth-archived-rain-paired-peak-cli/1`.

The estimator admits and reserves the complete composition without inspecting or constructing profiles. Inspection retains one complete fresh report for each quarter in `firstQuarterReport` and `thirdQuarterReport`, each with its own full `terminalReport`. Parent admission is repeated as part of this composition and accounted for. No scientific model or old CLI is replayed; loading module definitions is not model execution.

Report schema is `experimental-earth-archived-rain-paired-peak/1`. `declaredPeakCriterion` remains separate from both original terminal targets. `assessment` retains both quarter intervals, exact parameters, both clipped compatible bands, inclusive peak bounds, classification, and lower/upper witnesses. If either band is empty, status is `declared-readings-incompatible`, classification is `outside-support`, and bounds/witnesses are null; both complete parents and both bands remain available. Otherwise upper ≤ target means certain meet, lower > target means certain miss, and all other cases are ambiguous.

## Complete range and attaining histories

Let first-quarter rain be q and third-quarter rain r, each in [0,5]. The four quarter amounts are q, 5−q, r, 5−r. With cumulative rain C, continuous peak is the largest forward excess C(t)−C(s)−6(t−s).

The complete attained peak interval is

\[
[\max(4,11/2-q,1/2+r,2-q+r),\;11/2+3(r-q)/10].
\]

Every contiguous bin-boundary span gives a compulsory excess. The full hour gives 4; the last three quarters give 11/2−q; the first three give 1/2+r; the middle two give 2−q+r. All other boundary spans are no larger. Constant rain in each quarter attains their maximum.

For an upper bound, an edge-bin amount a needs duration at least a/20 and contributes at most 7a/10 after uptake. Any interval crossing bins includes all intermediate bins. Considering all ten contiguous spans gives the stated upper bound; none exceeds the four-bin bound. Latest cap-20 pulses in the first three bins and an earliest pulse in the fourth attain it. The interval containing all 10 mm has duration 3/4+(q−r)/20. Convex interpolation of feasible histories and continuity of peak reflection fill every intermediate peak value.

For clipped bands q∈[l1,h1] and r∈[l3,h3], the complete range is

\[
[\max(4,11/2-h1,1/2+l3,2-h1+l3),\;11/2+3(h3-l1)/10].
\]

The lower witness uses (h1,l3), the upper (l1,h3). This is joint deterministic feasibility, not statistical independence. At target 5, certain meet means l1−h3≥5/3. Certain miss means h1<1/2, or l3>9/2, or l3−h1>3. Equality is inclusive for meet and strict for miss. Inputs are interpreted as their exact represented binary64 values; mathematical decimal examples must not silently replace represented numbers with different rationals.

Witnesses retain four bins, exact rain segments, all endpoint states, both quarter totals, peak surface water, one attaining peak time, and terminal surface water. The lower has four segments/five knots; the upper at most eight/nine. Endpoint maxima certify a continuous peak because water on a constant-rate segment rises, falls, or falls to zero and stays there. Infiltration and storage are not claimed to interpolate linearly through depletion. The attaining time is one certified knot, not all ties or necessarily the first continuous attainment.

## Limits and qualification

The composition reserves 20,480 parent scalar units plus 10,240 additional units, totaling 30,720. Combined certificates contain at most 54 segments and 64 knots. Existing 8,192/16,384-bit arithmetic guards and bounded canonical encodings remain; output admits at most 1,024 encoded rationals within the 2 MiB serialized limit. Abstract work excludes parsing, serialization, strings and integer-bit costs; it is not a runtime guarantee.

This answers an archived or hypothetical question about a fixed model. It does not infer a rate cap, authenticate a record or instrument, establish chronology or availability, operate a sensor, or predict a whole site. Retained-snapshot peak extraction and its UI remain separate. A terminal conclusion is never relabeled as a peak conclusion.

Six focused tests passed: independent raw-span/dominance/epigraph bounds, exact boundary and uncertainty cases, incompatible and extreme/subnormal inputs, explicit roles with duplicate labels, complete parent retention, and four instrumented children confirming parent order and zero entries into nine loaded scientific functions. All three actual commands also passed independent Python exact-rational receiving of the joint peak bounds and every profile, plus both complete parent peak and terminal reports. Matching previously qualified parent inputs retained their complete original outputs.

The prospective source/runtime/resource guards passed; each command exited with empty stderr and no retained child group. These are headless mathematical/CLI qualifications. The examples are fictional declarations, not acquired measurements.
