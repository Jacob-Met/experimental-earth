# Understand every possible early rainfall readout

Before obtaining an early interval total, ask which results could settle a question about later rainfall. This tool classifies the entire nonnegative continuous readout domain against an inclusive late-total threshold. It preserves the original calibration and takes a declared error bound; it does not acquire a measurement or estimate outcome probabilities.

## Three authored examples

From the repository root:

```sh
node inspect-rainfall-readout.mjs examples/conditional-rainfall-original.json examples/rainfall-readout-query.json
node inspect-rainfall-readout.mjs examples/conditional-rainfall-original.json examples/rainfall-readout-exact-query.json
node inspect-rainfall-readout.mjs examples/rainfall-joint-region-unbounded-original.json examples/rainfall-readout-query.json
```

The first reuses the fictional calibration total of 10 mm over minutes 0–10. It asks whether rainfall over minutes 5–10 is **at most 4 mm**, given a possible early readout z over minutes 0–5 with declared absolute uncertainty **0.5 mm**. The expected classifications are:

| Readout z in mm | Meaning |
|---|---|
| 0 ≤ z < 5.5 | Certain miss: every compatible late total exceeds 4 mm |
| 5.5 ≤ z < 6.5 | Ambiguous: both target classes remain possible |
| 6.5 ≤ z ≤ 10.5 | Certain meet: every compatible late total is at most 4 mm |
| z > 10.5 | Outside support: no original-calibration-compatible history fits the readout band |

Equality matters: a late total of exactly 4 mm meets the target. Outside support is not a vacuous success.

The second declares zero uncertainty. Its expected miss range is [0,6), meet range [6,10], and outside-support range (10,infinity), with no ambiguity. The third reuses the challenge-only original with no calibration constraint: every nonnegative readout is compatible and ambiguous for this target. Its fictional challenge remains excluded.

All three authored commands and seven focused tests passed. Independent exact-rational checks verified the complete endpoint partitions and classifications, and the full nested joint-region results matched their qualified originals. None of the examples represents acquired observations or verified instrument precision.

## Declare the planning question

Start with the same event reference, adjacent intervals, and source declaration used by the joint-region query. The readout query has exactly eight fields:

```json
{
  "schema": "experimental-earth-rainfall-readout-query/1",
  "eventRef": "authored full-family arithmetic event",
  "startMinute": 0,
  "splitMinute": 5,
  "endMinute": 10,
  "source": "Authored fictional adjacent-interval question; not measured rainfall",
  "uncertaintyMm": 0.5,
  "thresholdMm": 4
}
```

For a possible readout z, the early total x must lie in the closed band `max(0,z-u) <= x <= z+u`, where u is `uncertaintyMm`. The late target is `y <= thresholdMm`. Parameters u and the threshold must be finite, nonnegative binary64 values in normalized millimetres. There is no 10,000 mm cap on either; even the largest finite binary64 value is admitted subject to the complete input contract.

The conceptual readout domain is **all nonnegative real values**, not a binary64 grid or a finite measurement menu. Parameter representation and outcome domain are different. A declared error bound does not independently establish instrument performance, event association, or timing.

Original calibration readings alone constrain the underlying joint region. Challenge and unassigned readings remain excluded with their original roles and provenance. The consumer does not append observations, promote evidence, operate instruments, or infer soil, depth, intervention, or finite-family consequences.

## Read the partition

The report retains the complete fresh joint-region report under `jointRegion`, including the original, constraints, histories, calibration assessment, and limitations. The original appears once in that nested envelope. This is a fresh analysis, not acceptance of a caller-supplied cached report.

`assessment.cutpoints` contains exact rational boundaries. `assessment.atoms` explicitly separates each boundary point, every intervening open interval, and the final open unbounded tail. Point atoms have equal endpoints and both inclusive flags true; open atoms have both false. A null upper endpoint denotes the unbounded tail. Adjacent atoms with the same classification are intentionally not merged, so all exact boundaries remain visible.

Classifications are `certain-meet`, `certain-miss`, `ambiguous`, and `outside-support`. They cover the entire nonnegative readout domain without gaps or overlaps. Summary flags report which classes occur and whether every compatible readout resolves the target. Original calibration inconsistency instead yields empty cutpoints and atoms with a null summary; it is not a successful partition.

For a convex feasible rainfall region containing both target classes, **every positive error bound leaves some ambiguous readout**. Opposite-class histories can approach a threshold history, making their early totals arbitrarily close and their error bands overlap. This does not say every outcome is ambiguous. It does not apply to disconnected finite candidates, restricted readout grids, or zero error. It provides no probability or expected cost saving.

## API, exactness, and limits

```js
import { estimateRainfallReadoutWork, inspectRainfallReadout } from './rainfall-readout.js';

const work = estimateRainfallReadoutWork(originalText, outcomeQueryText);
const report = inspectRainfallReadout(originalText, outcomeQueryText);
```

The estimator reserves work without a joint consumer or solver call. The inspector invokes the joint-region consumer once, then classifies outcomes symbolically; it does not rerun a solver or conditional consumer per atom. The derived joint query preserves the original source string.

CLI output uses `experimental-earth-rainfall-readout-cli/1`, with input SHA256 and byte lengths under `originalProposal` and `readoutQuery`. Its report schema is `experimental-earth-rainfall-readout/1`. The CLI accepts two regular non-symlink exact UTF-8 files, verifies identities and bytes after analysis, and writes the complete result to stdout without modifying files.

Original text is limited to 4 MiB and query text to 4 KiB. The maintained original/project/gauge and interval admission rules still apply. Arithmetic preserves represented binary64 parameters and nominal calibration bands as exact rationals, without epsilon, midpoint sampling, floating overflow, or a numeric infinity sentinel. Rational endpoints use reduced decimal-string numerators and positive denominators.

At most five distinct cutpoints produce at most ten atoms. The complete reservation is joint-region work plus 4,096: 2,048 for additional scientific preflight and 2,048 for symbolic classification. Its maximum is **304,349**, below the **350,000** cap; no independently reachable valid-input total-cap refusal is claimed. Parsing, general validation, finite-object traversal, serialization, and bit-operation costs are excluded. These counts are not CPU, heap, wall-time, or input-processing guarantees.

Persistent rational components are guarded at 8,192 bits and intermediates at 16,384 bits. The proof includes the largest finite uncertainty and threshold, while preserving the inherited geometry bounds. No partition is rounded or truncated to fit a limit.

See [Joint rainfall regions](RAINFALL_JOINT_REGION.md) for the underlying possible pairs and [Conditional rainfall intervals](CONDITIONAL_RAINFALL_INTERVAL.md) for a separately declared single hypothesis. That conditional-file admission has different amount limits and is not a complete oracle for this continuous readout domain.
