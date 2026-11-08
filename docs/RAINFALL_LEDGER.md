# Inspect an original rainfall interval ledger

A rejected rainfall model and an inconsistent set of rainfall totals answer different questions. The mechanism proposal tools compare a finite offered family, including constant rainfall rates. This ledger asks whether **some nonnegative rainfall history** can satisfy the original interval totals. A compatible history does not restore any rejected constant-forcing candidate or establish the consequences for soil, water depth, or a proposal.

## Run the two authored examples

From the repository root:

```sh
node inspect-rainfall-ledger.mjs examples/mechanism-challenge-conflict-original.json
node inspect-rainfall-ledger.mjs examples/rainfall-ledger-inconsistent-original.json
```

Both inputs are complete fictional originals, not acquired observations. The first is the unchanged mechanism challenge-conflict example. Its constant-family challenge conflict can coexist with a nonnegative varying history: an authored schedule of 35 mm/h during minutes 0–10, 30 during 10–30, zero during 30–35, 39 during 35–55, and zero during 55–60 gives totals 35/6, 125/12, 10, and 13 mm for its four recorded intervals. That schedule has been checked analytically; it is neither an inferred rainfall record nor a prescribed output profile. Both commands above have been executed successfully, and seven focused tests pass. Independent exact-rational checks verified the returned feasible history against every included nominal band and verified the inconsistent example’s connected cycle 5 → 0 → 10 → 5, whose weights sum to exactly −1 mm. The computed feasible profile need not equal the authored schedule; both are witnesses, not observations.

The second replaces only the gauge readings. A calibration reading fixes the total over minutes 0–10 at 0 ± 0 mm; a challenge fixes the contained interval 5–10 at 1 ± 0 mm. Nonnegative rainfall cannot satisfy both. The calibration-only question remains separately meaningful and unchanged.

## What is retained and interpreted

Supply original `experimental-earth-joint-mechanism-proposal/1` JSON, not a computed report. The output retains the full parsed original under `report.originalProposal`, including source, fronts, and goal. Only `source.project` and `source.gauge` are interpreted and validated here; preserving the remaining context does not qualify it. No mechanism importer, grid model, soil model, or proposal evaluation runs.

`report.calibration` is the unchanged maintained calibration-only history assessment, called on the original project and gauge. The separate `report.joint` includes original calibration and challenge rows in their original order. Unassigned readings remain in the original and appear in an explicit exclusion list. The analyzer does not promote roles, delete readings, fit a new model, or adjust clocks or site associations.

The CLI identifies the exact original bytes with SHA256 and byte length. It reads a regular non-symlink UTF-8 file, verifies its identity and bytes again after analysis, and writes a JSON report to stdout without writing files.

## Interpret the result

- `nonnegative-history-compatible` supplies exact cumulative-depth knots, a consecutive-segment rainfall profile, and a check of every included interval against its nominal band. This is one constructive witness; it need not be unique or physically representative. No upper rainfall-intensity bound or storm cutoff is imposed.
- `interval-totals-inconsistent` supplies a verified connected, closed negative cycle of original interval constraints and monotonicity edges. Its strictly negative exact weight proves incompatibility under this interval contract. The cited records are not claimed to be a minimum conflict or an irreducible conflict, and the certificate does not identify a faulty sensor or physical cause.

Neither outcome validates the asserted common event, clock, or site coverage. The original calibration result remains separately available; joint feasibility is not permission to reinterpret its roles.

## Exact arithmetic and bounded work

Each admitted binary64 input and depth-unit multiplier is converted to an exact rational **before** unit multiplication or band addition/subtraction. Lower depth is clipped to zero. “Exact” therefore means the nominal values actually represented by the input numbers and maintained unit constants, not ideal decimal values that someone may have intended. No epsilon or new tolerance is added. Returned rationals use reduced decimal-string numerator and positive denominator fields; rates can exceed binary64 range without conversion to approximate numbers.

Admission limits original text to 4 MiB and gauge readings to 64, with at least one assigned reading. The joint graph has at most 130 vertices and 257 edges. Complete graph, mapping, sorting, and verification work is reserved before the calibration assessment or joint solve. Parsing, general validation, and serialization are outside that abstract work count; it is not a wall-time, memory, or serialized-byte guarantee.

The declared work cap is 150,000; the current domain's conservative maximum is 118,362, so there is no independently reachable valid-input work-cap refusal under these limits. Persistent rational components are guarded at 8,192 bits and conservative operation intermediates at 16,384 bits. The current-domain proof places them below those limits; these are defensive guards, not evidence of a tested reachable numerical-cap failure. A refusal never truncates or rounds a witness to fit.

The existing calibration history, consistency, and recheck tools supply the precedent and the separately preserved calibration question. This command adds an original all-assigned-role interval assessment; it does not replace those tools or adopt a new weather-forcing schema.
