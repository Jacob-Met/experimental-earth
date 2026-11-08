# Reassess a conditional plan when its first reading arrives

A forecast can say to stop after a high rainfall reading, yet a less precise actual reading can leave both proposal outcomes possible. A reading arriving late can also leave insufficient time to interpret it or obtain the second measurement. This headless consumer connects the [conditional acquisition forecast](MECHANISM_CONDITIONAL_ACQUISITION.md) to the [selected-reading receiver](MECHANISM_ACQUISITION_RECEIVE.md), preserving their original evidence and distinguishing planned policy from an actual conditional decision.

It does not operate instruments, schedule a second measurement, infer probabilities or estimate expected savings. Its decision is conditional on the finite model family, declared actual error bounds, original target and available response arrangements.

## Run the six-argument receiver

```sh
node receive-mechanism-acquisition.mjs examples/mechanism-collection-original.json examples/mechanism-collection-menu.json examples/mechanism-conditional-first-receipt.json received-first-original.json examples/mechanism-collection-choices.json examples/mechanism-conditional-sequences.json
```

Arguments are the original proposal, acquisition menu, conditional receipt, **fresh output path**, collections and sequences, in that order. The existing four-/five-argument receipt commands remain unchanged. Six-argument mode adds `inputs.conditionalSequences` to the existing CLI envelope and uses the conditional received report. The sequence file has the maintained128KiB regular UTF-8/non-symlink admission and final reread checks. All existing input checks, complete serialization and exclusive output creation remain; no existing path is overwritten.

The output is a complete reopenable original mechanism-proposal investigation with the selected first reading appended as challenge evidence. Input files are unchanged. An input or planning admission refusal emits no stdout and creates no output. A filesystem or verification failure after creation can leave a partial output; a stdout failure does not roll back the saved file. Preserve and inspect those artifacts before any retry, and do not assume an interrupted operation did not occur.

## Exact receipt binding

The outer receipt has exactly four fields:

```json
{
  "schema": "experimental-earth-mechanism-conditional-acquisition-receipt/1",
  "conditionalSequencesSha256": "122f1422a72757b957686e17d68f28f60d78eaccfb095a044a21ccb356fd962e",
  "sequenceId": "gauge-then-optional-depth",
  "firstReceipt": {}
}
```

The empty object above is only a structural placeholder; it is not an admitted receipt. `firstReceipt` must be a complete unchanged `experimental-earth-mechanism-acquisition-receipt/1` object, with the exact original/menu/collection byte hashes, event association, receipt clock and canonical challenge reading. Its choice must be `kind: "single"` and the selected sequence's exact `firstOptionId`. A collection receipt or another option is not interchangeable with the first member.

The outer SHA256 binds the exact raw UTF-8 sequence declaration, not a parsed or reformatted approximation. The supplied example computes all four hashes from the existing original, menu, collection and sequence files. It selects singleton `rain10to30` from `gauge-then-optional-depth`, declares actual receipt at minute30, and records **13mm ±4mm** over minutes10–30. Every source/association statement explicitly identifies fictional authored data. Nothing in the example verifies physical acquisition or instrument accuracy.

The complete supplied declarations are admitted before inference, including sequence order, prospective eligibility, original collection membership and response arrangements. A sequence excluded by its original timing or prospective conditions cannot be received through this interface. Archived-record receipt persistence remains outside scope. No cached report or forecast result substitutes for original inputs.

## Planned action is a diagnostic, not actual authority

`plannedPolicy` locates the actual scalar value, normalized to millimeters, in the original exact point/open-region partition. It shows what the planned uncertainty would imply. It does not silently apply that planned precision to the actual reading.

The actual result uses the unchanged selected-reading receiver's challenge comparison and actual uncertainty. Its complete `receiptReport` retains the original forecast, received proposal, every calibration-compatible row and target guard, original order, prior challenge labels, baseline/received outcomes and actual precision. The consumer neither refits calibration nor deletes challenged rows. `conditionalReceipt` retains the complete validated declaration, and `sequence` retains the original offer, timing and exclusions.

For the authored example, scalar13mm lies in the planned high gauge band, whose forecast action is `stop-miss`. But its actual ±4mm uncertainty leaves all20 calibration-compatible explanations uncontradicted: six meet and fourteen miss the200L target. The later depth separates75 of the84 remaining opposite-target pairs, leaving nine unresolved. The actual action is therefore **`continuation-unresolved`**, not `stop-miss` and not a guarantee that taking depth will settle the target.

Whole-family target status and surviving-subset outcome remain distinct. The original family can remain `conditional` even when an actual subset is unanimous. No actual survivors means `family-challenged`, never a vacuous target success. Contradiction can involve the family, uncertainty, association or other assumptions; it does not uniquely identify a physical cause.

## Readiness includes interpretation time

Actual decision-ready time equals **actual `receivedMinute` + `minimumDecisionMinutes`**. The response allowance applies to stopping decisions too, because it includes interpreting the reading and making the decision. Receipt by the deadline alone is insufficient.

For the example's five-minute allowance and minute60 deadline:

- Receipt at minute55 is ready at60; equality is allowed. If target labels remain mixed and depth60 separates all remaining pairs, continuation is conditionally feasible.
- Receipt at minute56 is ready at61. Even though the reading arrived before60, the action is `not-ready-by-deadline`, whether the surviving labels are mixed or unanimous.
- Continuation also requires the second support to start no earlier than decision readiness and its declared availability to be by the decision deadline.

`actualDecision.timing` exposes actual receipt, response allowance, decision readiness, deadline, second start/availability, and the separate feasibility booleans. Declared timing does not establish that staff, equipment or access will be available in reality.

## Actual action and remaining pair evidence

The action precedence is:

1. No original compatible rows: `no-compatible-explanations`.
2. No actual survivors: `family-challenged`.
3. Not decision-ready by the deadline: `not-ready-by-deadline`.
4. Nonempty unanimous surviving target labels: `stop-meet` or `stop-miss`.
5. Mixed labels with infeasible continuation: `continuation-unavailable`.
6. Mixed labels and complete feasible second separation: `take-second`.
7. Mixed labels otherwise: `continuation-unresolved`.

`secondSeparation` is present only for mixed surviving labels. Its original global pair indices retain precisely the opposite-target pairs whose two original candidates survive. It reports separated and unresolved indices without inventing new candidate identities. Geometry is computed even when timing prevents continuation, so evidence quality and practical feasibility remain separately inspectable. An empty remaining pair set is not treated as second-measurement success.

Planned bounds must not be substituted for actual first-reading bounds. The future second-reading certificate still depends on its declared planned bounds holding when acquired. Simultaneous deterministic bounds do not require statistical independence, and no independence, posterior probability, expected cost saving or field validity is claimed.

## Recorded baseline controls and qualification boundary

Seven controls were previously evaluated once through the unchanged selected receiver. They establish the incumbent evidence outcomes used to assess this new consumer:

| Authored first gauge reading | Receipt minute | Uncontradicted outcome and relevant implication |
|---|---:|---|
| 13 ±1mm | 30 | Ten missing-target rows; planned stopping is consistent with actual precision |
| 13 ±4mm | 30 | All20 rows, both labels; nine opposite pairs remain unresolved by depth |
| 10 ±1mm | 55 | Ten rows, both labels; all24 opposite pairs depth-separated; decision-ready60 |
| 10 ±1mm | 56 | Same evidence geometry; decision-ready61 misses deadline60 |
| 35/3 ±2mm | 30 | All20 rows despite scalar lying outside planned bands; nine depth-unresolved pairs |
| 100 ±1mm | 30 | No survivors; family challenged |
| 13 ±1mm | 61 | Ten missing-target rows, but receipt and decision readiness are late |

These are authored controls, not acquired observations. The frozen candidate subsequently passed40 scoped tests:32 unchanged tests and8 new tests. The actual six-argument CLI successfully saved a fresh4,140-byte original with SHA256 `ec34f3eb51f7c3676297506ee393155d2567a3ee31d6b97361f4482db3afd364`; a separate unchanged maintained-importer call reopened that written file. All five input identities matched the actual bytes. The wider-uncertainty example retained20 survivors with6 meeting and14 missing target labels,84 opposite-target pairs and9 unresolved by the second reading: planned `stop-miss` correctly became actual `continuation-unresolved`. Candidate four-input planning and five-argument receiving retained complete stdout bytes identical to their previously qualified baselines. Source, input and runtime guards passed. These are scoped finite authored controls and actual headless entrypoint results, not field validation, browser receiving or full-repository qualification. A stopping case received at56 also needs the response-delay check; no early verdict follows merely from unanimous labels.

## Bounded composition and reopening

Complete aggregate work is checked before the existing receiver is called once. That receiver performs its established forecast and appended-challenge comparison. This consumer does not invoke a full conditional planner, importer, model or export helper again. It prepares all offered sequence declarations without inference, then uses the retained original predictions for the selected planned geometry and remaining actual-pair checks.

Aggregate policy work is capped at100,000, report work at150,000 items and cell-step work at3,000,000. All offered sequence geometry is reserved even though only the selected policy is emitted. These conservative units are not hard runtime, memory or serialized-byte guarantees; oversized requests are refused completely rather than partially evaluated.

The saved original can be reopened through the maintained importer. It contains the first reading as challenge evidence with its actual precision and source; the original family and target are preserved. Any later receipt or replanning must bind the new original's exact identity and retain already consumed coordinates. This interface does not automatically acquire the second reading, create a new planning session or override the receiver's complete-selection requirements.
