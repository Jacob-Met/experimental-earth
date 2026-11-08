# Bound rainfall in one requested interval

An interval gauge total does not say when rain fell within that interval. Before treating a measurement gap as a known input, ask how little or how much rain could have fallen there while respecting the original calibration readings.

This command returns exact lower and upper totals for one declared interval under **nonnegative rainfall histories constrained by calibration readings only**. Challenge readings stay held aside. It does not fit a physical rainfall profile, restore rejected constant-rate candidates, or calculate soil, depth, or intervention outcomes.

## Try the authored questions

From the repository root:

```sh
node bound-rainfall-interval.mjs examples/mechanism-challenge-conflict-original.json examples/rainfall-interval-early-query.json
node bound-rainfall-interval.mjs examples/mechanism-challenge-conflict-original.json examples/rainfall-interval-tail-query.json
```

These reuse the unchanged fictional mechanism challenge-conflict original. Its calibration reading covers minutes 0–10; the two new query files declare questions, not observations.

For minutes **0–5**, the expected lower total is **0 mm** and the expected upper is **7693649363424597/1125899906842624 mm**. That upper is the exact represented early calibration upper bound. All allowed rain can be placed before or after minute 5, so distinct histories can attain the two extremes. It is not an estimate that rain actually followed either profile.

For minutes **55–60**, the expected lower is **0 mm** and the upper is **unbounded**. No calibration interval limits that tail. The report must demonstrate this with a feasible base history and a direction that adds exactly 1 mm to the query while adding zero to every calibration total. Any nonnegative rational multiple of that direction preserves the constraints. No rainfall-intensity ceiling or constant-storm cutoff is assumed.

Both authored commands and 14 scoped tests passed. Independent exact-rational checks verified their source-constraint certificates, attaining histories, and unboundedness direction. The existing ledger commands also retained their complete qualified output bytes after the shared-core extraction.

## Declare and preserve the question

A query is a UTF-8 JSON object with exactly these fields:

```json
{
  "schema": "experimental-earth-rainfall-interval-query/1",
  "eventRef": "authored full-family arithmetic event",
  "startMinute": 0,
  "endMinute": 5,
  "source": "Authored fictional early interval question; not a rainfall measurement"
}
```

`eventRef` must exactly match the original gauge declaration. The start must be nonnegative, the end strictly later, and both must lie within the original event duration. Event reference and source must be nonempty trimmed strings of at most 600 characters. A matching reference does not independently establish that measurements share the claimed event, clock, or site.

Pass original mechanism-proposal JSON, not a cached result envelope. The complete parsed original and query are preserved in the report. Only `source.project`, `source.gauge`, and the query are interpreted; the retained request, fronts, goal, and other proposal context are not evaluated or otherwise qualified. Challenge and unassigned readings remain present and are explicitly listed as excluded constraints with their original roles.

## Read bounds and certificates

The CLI returns `experimental-earth-rainfall-interval-cli/1` with exact input SHA256/byte identities and a `report`. The report schema is `experimental-earth-rainfall-interval/1`; it contains `originalProposal`, `query`, `scope`, `work`, the unchanged calibration-only assessment, and the requested interval `assessment`.

- **`bounded-interval`:** both bounds have status `attained`, an exact `totalMm`, a connected path of source constraints, and an attaining history with interval checks. The path certifies the bound; the history shows it can be reached. Lower and upper can use different histories.
- **`upper-unbounded`:** the lower remains attained. The upper has status `unbounded`, a verified base history, and a nonnegative unit direction. Its calibration increments are zero and its query increment is one. This is a constructive absence of a finite upper bound, not an enormous numeric sentinel or a forecast.
- **`interval-totals-inconsistent`:** calibration constraints themselves are inconsistent. Bounds are `null`, and a connected negative-cycle certificate explains the contradiction. No range is reported from contradictory premises; the certificate is not claimed to identify a minimum conflict or a faulty sensor.

Histories contain cumulative-depth knots and consecutive segments. Exact segment rates are mathematical witnesses, not inferred, unique, or physically validated forcing. Every interval check uses cumulative endpoint differences; a segment rate is checked against its own duration. Held-aside readings do not narrow these bounds, even when they would reject a displayed witness.

For programmatic use:

```js
import { estimateRainfallIntervalWork, boundRainfallInterval } from './rainfall-interval.js';

const work = estimateRainfallIntervalWork(originalText, queryText);
const report = boundRainfallInterval(originalText, queryText);
```

The estimate admits and reserves work without running a history solver. The consumer reserves before computation and calls the maintained calibration assessment once on the untouched original project and gauge. Neither API invokes a physical model or mechanism importer.

## Exactness and limits

Depths, uncertainties, minute values, and maintained unit factors are interpreted as their represented binary64 values. Unit multiplication and band arithmetic then use exact rationals, with lower rainfall clipped to zero. This preserves nominal represented bands; it does not recover intended ideal decimals or add an epsilon. Rationals are reduced objects with decimal-string `numerator` and positive `denominator`. Times retain their original numeric minute values; unboundedness has an explicit status, never `Infinity`.

Original text is limited to 4 MiB, query text to 4 KiB, and the original gauge to 64 readings. Inputs must be finite, nonempty UTF-8 JSON without a BOM and must satisfy the maintained project/gauge admission rules. The query graph has at most 132 vertices and 259 edges. The CLI reads regular non-symlink files, checks their identities and bytes after analysis, and writes its result to stdout without modifying inputs.

Complete abstract work is reserved for the calibration assessment, feasibility, two shortest-path searches, mapping, sorting, and certificates. The current maximum is **202,574**, below the **250,000** cap; there is no independently reachable valid-input total-cap refusal under these limits. Work counts are not CPU time or heap guarantees and exclude parsing, general validation, serialization, and arithmetic bit costs.

Persistent rational components are guarded at **8,192 bits**, with conservative intermediates guarded at **16,384 bits**. The current-domain proof fits inside those bounds. Defensive numerical refusal does not round or truncate a certificate; it should not be presented as an experimentally reached boundary when valid inputs cannot reach it.

See [the rainfall ledger](RAINFALL_LEDGER.md) for the different question of whether calibration and challenge interval totals can coexist. That joint assessment and this calibration-only projection preserve their separate purposes and original roles.
