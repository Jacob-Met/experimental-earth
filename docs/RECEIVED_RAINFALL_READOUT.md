# Compare planned and declared rainfall precision

A rainfall readout plan answers what each possible early reading would establish about a later rainfall total, assuming a declared error bound. A subsequently supplied reading may declare a different uncertainty. This consumer evaluates that declaration and keeps the plan's verdict at the **same reading value** visible beside it.

It performs mathematical conditioning, not measurement validation. An event reference, interval and source statement do not establish that a reading was acquired, that its uncertainty is accurate, or that its timing or physical interpretation is correct.

## Run the authored examples

From the repository root:

```sh
node inspect-received-rainfall-readout.mjs examples/conditional-rainfall-original.json examples/rainfall-readout-query.json examples/rainfall-readout-matched-reading.json
node inspect-received-rainfall-readout.mjs examples/conditional-rainfall-original.json examples/rainfall-readout-query.json examples/rainfall-readout-wider-reading.json
node inspect-received-rainfall-readout.mjs examples/conditional-rainfall-original.json examples/rainfall-readout-query.json examples/rainfall-readout-narrower-reading.json
```

The unchanged original constrains the whole 0–10 minute rainfall total to 10 mm. The unchanged plan concerns an early 0–5 minute reading and asks whether the late 5–10 minute total is at most 4 mm, inclusively. Its planned uncertainty is ±0.5 mm. All three new reading files are fictional authored controls, not acquired observations.

| Declared value and uncertainty | Late range under planned precision | Late range under declared precision | Planned → declared verdict |
|---|---|---|---|
| 6.5 ± 0.5 mm | [3, 4] mm | [3, 4] mm | Certain meet → certain meet |
| 6.5 ± 1.5 mm | [3, 4] mm | [2, 5] mm | Certain meet → ambiguous |
| 6.25 ± 0.25 mm | [3.25, 4.25] mm | [3.5, 4] mm | Ambiguous → certain meet |

The value differs between examples, but within each comparison the value is identical and only the uncertainty assumption changes. In the narrower example the comparison is at 6.25 mm, not at the other examples' 6.5 mm. The planned ranges in this table explain the example; the report retains the complete plan and its matching atom rather than adding a separate planned-range field.

## Declare one reading

The reading JSON has exactly these eight keys:

```json
{
  "schema": "experimental-earth-rainfall-readout-reading/1",
  "id": "authored-matched-early-reading",
  "eventRef": "authored full-family arithmetic event",
  "startMinute": 0,
  "endMinute": 5,
  "valueMm": 6.5,
  "uncertaintyMm": 0.5,
  "source": "Authored fictional declaration; not an acquired observation."
}
```

`eventRef` must equal the plan's event reference. The reading's start and end must equal the plan's `startMinute` and `splitMinute`, respectively. Value and uncertainty are explicit finite nonnegative binary64 numbers in normalized millimetres; uncertainty is never silently copied from the plan. There is no 10,000 mm ceiling. Nonblank `id`, `eventRef` and `source` strings are limited to 600 code units. Identity is a declaration, not an original gauge role or proof of provenance.

The CLI accepts exactly three regular, non-symlink, exact UTF-8 files without a BOM: original up to 4 MiB, plan and reading up to 4 KiB each. It verifies file identities and bytes before and after inspection, serializes the complete result before stdout, and writes no original or new observation file.

## API and result

```js
import {
  estimateReceivedRainfallReadoutWork,
  inspectReceivedRainfallReadout,
} from './rainfall-readout-receive.js';

const work = estimateReceivedRainfallReadoutWork(originalText, planText, readingText);
const report = inspectReceivedRainfallReadout(originalText, planText, readingText);
```

The estimator computes a work reservation without invoking a scientific consumer. The inspector obtains one fresh full readout report and retains it under `planningReport`. No caller-supplied cached report is accepted. The unchanged original appears inside `planningReport.jointRegion`; no calibration or challenge role is promoted, appended or removed.

The report schema is `experimental-earth-rainfall-readout-receive/1`. The CLI wraps it in `experimental-earth-rainfall-readout-receive-cli/1`, with SHA256 and byte length for `inputs.originalProposal`, `inputs.readoutPlan` and `inputs.declaredReading`.

`assessment.parameters` retains exact value, planned uncertainty, actual uncertainty and threshold. `plannedAtom` contains the index and complete matching point or open atom from the fresh plan. `uncertaintyComparison` is `less`, `equal` or `greater`, comparing declared uncertainty with planned uncertainty. `classificationChanged` compares their verdicts. Equal errors require equal classifications and set `sameErrorClassificationVerified` to true; otherwise that check is null.

There are three distinct statuses:

- `declared-readout-compatible`: `actual` contains its exact early intersection, late bounds and endpoint witnesses. Classification is `certain-meet`, `certain-miss` or `ambiguous`.
- `declared-readout-incompatible`: `actual.classification` is `outside-support`; the inverted early intersection is retained with `empty: true`. Late bounds and witnesses are null, while the planned diagnostic remains available.
- `original-calibration-inconsistent`: the full parent's contradiction remains visible. `plannedAtom`, `actual` and classification comparisons are null. This is not a successful or vacuous threshold conclusion.

Finite bounds are inclusive. An unbounded late upper endpoint is null and has `upperInclusive: false`. Finite endpoint witnesses give `xMm` and `yMm`, checked against the declared band and the six original joint inequalities. An unbounded result instead includes a lower witness and direction `(0, 1)` with homogeneous-region and band-preservation checks. These are two-dimensional membership and extendability certificates based on the existing projection theorem, not newly computed full rainfall histories.

## Exact meaning and limits

The declared band is `[max(0, z − u), z + u]`. Within the original joint region, the consumer finds the exact late-total range. A finite upper bound at or below the threshold is certain meet; a lower bound strictly above it is certain miss; otherwise both outcomes remain possible. Equality therefore belongs to meet. Actual and planned errors remain separate even when their classifications happen to agree.

Arithmetic uses exact rational representations of admitted binary64 numbers, with persistent and intermediate guards of 8,192 and 16,384 bits. This does not turn declared precision into verified instrument precision. There is no probability, posterior, independence claim, physical intervention conclusion, finite-family inference, acquisition instruction, deadline or stop action.

The combined abstract work reservation adds 2,048 preflight and 4,096 symbolic units to the parent: 6,144 additional units, with a current maximum of 310,493 below the 350,000 cap. The standalone total cap cannot be reached by otherwise valid current inputs. These counters exclude parsing, general validation, cloning, serialization and rational bit costs; they are not CPU, memory or wall-time guarantees.

All three authored CLI examples and seven focused tests passed. Independent exact-rational checks verified the same-value precision comparisons, late bounds and endpoint witnesses using raw calibration constraints and boundary intersections. Each complete fresh planning report matched its qualified original. These controls remain fictional declarations, not acquired observations or verified instrument precision.
