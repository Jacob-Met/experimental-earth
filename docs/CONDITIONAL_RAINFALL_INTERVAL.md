# Ask what a hypothetical rainfall total would imply

Separate interval ranges do not imply that every combination is possible. If the first ten minutes contain exactly 10 mm, an early total of 6–7 mm leaves only 3–4 mm for the second five minutes. This command asks that conditional question without adding a hypothetical reading to the original evidence.

## Authored examples

The complete fictional original fixes minutes 0–10 at 10 ± 0 mm. The early condition separately supposes 6.5 ± 0.5 mm over minutes 0–5. From the repository root:

```sh
node bound-rainfall-interval.mjs examples/conditional-rainfall-original.json examples/rainfall-interval-late-query.json examples/rainfall-condition-early.json
```

The expected conditional range is **3–4 mm**, with histories attaining both endpoints. This condition is a declared possibility, not an acquired observation or a probability update.

A deliberately conflicting hypothesis supposes 11 mm over the whole interval whose original calibration total is 10 mm:

```sh
node bound-rainfall-interval.mjs examples/conditional-rainfall-original.json examples/rainfall-interval-late-query.json examples/rainfall-condition-conflict.json
```

That should be `condition-inconsistent`: the hypothesis conflicts with compatible original calibration. It does not make the original calibration itself contradictory.

Conditioning on the early total still leaves the later tail unconstrained:

```sh
node bound-rainfall-interval.mjs examples/conditional-rainfall-original.json examples/rainfall-interval-tail-query.json examples/rainfall-condition-early.json
```

The expected tail range is **0 to unbounded**. Its certificate must preserve original calibration and the hypothetical total while adding one query millimetre in a feasible direction. No intensity ceiling or storm cutoff is imposed.

The three actual conditional commands returned the ranges and contradiction above, with certificates independently checked using exact rational arithmetic. The scoped suite passed 21 tests, including all 14 unchanged ledger and interval tests. Four existing CLI cases retained their complete qualified output bytes. The source and input identities held unchanged through both bounded qualification courses.

The existing two-file mode asks the original calibration-only question without a condition:

```sh
node bound-rainfall-interval.mjs examples/conditional-rainfall-original.json examples/rainfall-interval-late-query.json
```

See [Rainfall interval bounds](RAINFALL_INTERVAL.md).

## A separate declaration, with no evidence role

The condition uses this nested schema:

```json
{
  "schema": "experimental-earth-rainfall-condition/1",
  "eventRef": "authored full-family arithmetic event",
  "reading": {
    "id": "fictional-early-hypothesis",
    "startMinute": 0,
    "endMinute": 5,
    "depth": 6.5,
    "uncertainty": 0.5,
    "unit": "mm",
    "source": "Authored fictional hypothetical total; not an acquired rainfall observation"
  }
}
```

Only these keys are accepted; there is no `use` field. The condition stays outside the original gauge, with provenance `rainfall-condition:<id>`. Original calibration readings constrain the calculation; challenge and unassigned readings remain retained but excluded. No roles are promoted or readings deleted.

The event reference must exactly match the original gauge declaration. Event reference, ID, and source must be nonblank strings of at most 600 characters and are preserved without trimming. The positive interval must lie within the original horizon. Depth and uncertainty must be finite and nonnegative, use a maintained depth unit, and each normalize within the maintained 10,000 mm admission limit. Matching declarations do not independently verify the event, site, or clock.

## API and output

```js
import {
  estimateConditionalRainfallIntervalWork,
  conditionRainfallInterval,
} from './rainfall-interval.js';

const work = estimateConditionalRainfallIntervalWork(originalText, queryText, conditionText);
const report = conditionRainfallInterval(originalText, queryText, conditionText);
```

The estimator admits the declarations and reserves work without invoking a solver. The consumer calls the maintained calibration assessment once on the untouched original project and gauge. No grid, physical model, or mechanism importer runs.

Three-file CLI output uses `experimental-earth-conditional-rainfall-interval-cli/1`, with SHA256 and byte identities for `originalProposal`, `intervalQuery`, and `condition`. Its report uses `experimental-earth-conditional-rainfall-interval/1`. Two-file mode retains its existing schemas and does not add condition fields.

The full parsed original, query, and condition are retained. Only project, gauge, query, and condition are interpreted; remaining proposal context is preserved without qualification. The unchanged calibration assessment remains separately available. `scope.conditionRole` is `counterfactual`.

The assessment distinguishes:

- **`original-calibration-inconsistent`:** original calibration already contradicts itself. `conditionApplied` is false, bounds are null, and the verified negative cycle contains only original constraints.
- **`condition-inconsistent`:** original calibration is compatible, but the hypothesis is not. Bounds are null and a verified negative cycle contains an explicitly tagged condition edge. This is not a sensor diagnosis.
- **`conditionally-bounded-interval`:** both endpoints are attained. Each bound has a source-constraint path, a feasible history, original interval checks, and a separate `conditionCheck`.
- **`conditionally-upper-unbounded`:** the lower is attained; the upper supplies a feasible base and a unit direction. The direction has zero increments on every original calibration interval and on the condition, and a query increment of one.

Condition edges carry `conditionRef`; they do not masquerade as original record indices. Original interval checks remain original-only. Cycle `conditionRefs` distinguish hypothetical provenance from original record references. Certificates are not claimed to identify minimum conflicts or physical causes.

A source path proves an inequality; an attaining history proves the endpoint can occur within the mathematical constraints. Exact segment rates are checked against their own durations, and interval totals use cumulative endpoint differences. These histories are not inferred, unique, or asserted to be actual rainfall. Conditional compatibility does not restore rejected finite-family candidates or establish soil, depth, or intervention consequences.

## Exact arithmetic and bounded scope

Arithmetic preserves represented binary64 inputs and maintained unit factors as exact rationals before band operations; lower rainfall is clipped to zero. It adds no epsilon and does not recover ideal decimal intent. Returned rational objects have reduced decimal-string numerators and positive denominators; unboundedness is a status, not `Infinity`.

Original text is limited to 4 MiB, query and condition text to 4 KiB each. The original gauge permits up to 64 readings; the separate condition is not a 65th gauge reading. The augmented graph has at most 134 vertices and 263 edges. The CLI checks regular non-symlink UTF-8 inputs and verifies their identities and bytes after analysis, without writing files.

Complete abstract work is reserved before computation, including contradiction cases. The maximum **206,597** remains below the **250,000** cap, so a valid standalone total-cap refusal is not reachable under current limits. Work counts exclude parsing, general validation, serialization, and bit costs; they are not CPU, heap, or wall-time guarantees. Rational guards are **8,192 persistent bits** and **16,384 intermediate bits**. The current-domain proof fits inside those limits; no witness is rounded or truncated to fit.
