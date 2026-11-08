# Explain incompatible challenge readings without deleting evidence

When every retained explanation is contradicted, an investigator needs to know which readings cannot be satisfied together under the declared model family. This consumer finds an exact smallest incompatible set of applicable challenge records, while retaining the complete original mechanism/proposal investigation. It does not decide which reading is wrong or recommend deleting one.

The workbench already contains calibration/conflict tools, including the earlier conflict-explanation work and common-clock investigations. They are precedent for inspecting incompatible constraints, not interchangeable authorities: this consumer uses the maintained **full rainfall/soil/receiver/front mechanism family's original challenge scores**, and preserves the proposal comparison. Minimum-conflict search is not claimed as a new scientific method.

## Run on a complete original investigation

```sh
node explain-mechanism-challenges.mjs examples/mechanism-challenge-conflict-original.json
```

The only input is a complete original mechanism-proposal envelope. No acquisition menu, cached report or fabricated replacement observation is required. The CLI admits a nonempty regular non-symlink UTF-8 file without a BOM, up to 4 MiB, verifies its opened identity and rereads it after analysis. The JSON stdout envelope uses schema `experimental-earth-mechanism-challenge-conflict-cli/1`, with `inputs.originalProposal` containing the exact SHA256 and byte length and `report` containing the explanation. The command writes no files. Admission or analysis refusal emits an explanation on stderr, a nonzero exit and no result stdout. Full serialization precedes stdout; external pipe delivery is not an atomic-storage guarantee.

The example is exactly 4,743 bytes, SHA256 `08cb96bf1a5df0b80ca20ea74b4d34ab6e5a192b7a77ce6bda27f661152ddd1c`. Its observations, uncertainty bounds, finite parameter offers and proposal target are fictional authored controls, not physical measurements.

## What the authored scores establish

The original flat 16 m² example retains 20 calibration-compatible explanations spanning the offered rainfall, constant infiltration, closed/draining/unlimited receivers and wetting-front alternative. Six original proposal outcomes meet the absolute 200 L target; fourteen miss it. The challenge records do not refit that family or change those labels.

Three authored gauge challenges have the following supports. A support is the set of original candidate indices whose authoritative score is within the record's declared band, including the maintained numerical tolerance.

| Challenge record | Interval and actual declaration | Supported original candidates |
|---|---|---|
| `authored-conflict-wide` | Minutes 5–25, 13 ± 4 mm | All 20: 0–19 |
| `authored-conflict-A` | Minutes 10–30, 10 ± 1 mm | 0–8 and 18: ten candidates |
| `authored-conflict-B` | Minutes 35–55, 13 ± 1 mm | 9–17 and 19: ten candidates |

No candidate supports A and B together. Each record alone has nonempty support, while the wide record excludes nobody. The exact minimum incompatible set is therefore **A/B**, of cardinality two. Omitting A from that witness leaves B's ten candidates; omitting B leaves A's ten. These omissions are diagnostic counterfactuals within the witness, not changes to the saved evidence or suggestions that either reading should be discarded.

The authored CLI returns the A/B minimum witness and ten survivors for each omission. Its complete `originalProposal` equals the separately recorded maintained importer output, including original source, fronts, goal and result. Seven tests passed, covering exact minimum selection, deterministic ties, evidence roles, pre-inference budget refusal and one-call behavior. These results establish the finite authored example and preservation of its original evidence; they do not identify a physical cause or validate field measurements.

## Read the explanation

The report schema is `experimental-earth-mechanism-challenge-conflict/1`. `originalProposal` retains the complete unchanged importer return once: original `source`, `fronts` and `goal`, plus the proposal comparison under `originalProposal.result`. That comparison preserves all calibration-compatible rows, original metrics, target classifications, numerical guards and challenge labels. The original verdict is separate from the conflict certificate: a challenged family is not evidence that the intervention succeeds or fails.

`records` lists applicable target-scenario depth challenges in original index order, followed by gauge challenges in original index order. Each retains its raw reading, ordinal, kind, original index, canonical reference and `supportedCandidateIds`. Canonical references are `depth:<original index>` and `rain-gauge:<original id>`. Candidate identities are original row indices, not infiltration rates; several original alternatives can share the same rate or prediction without being merged.

Other-scenario depth challenges remain in `originalProposal` and are listed explicitly in `scope.excludedDepthChallenges` with a reason. They are not silently relabeled or treated as evidence about the target scenario.

`jointSurvivorIds` is the intersection of all applicable supports and is cross-checked against the original scorer's `candidate.surviving` flags. A witness contains its cardinality, record ordinals/references and an omission entry for each member. Every omission lists the remaining witness references and the original candidates that survive their intersection.

Statuses distinguish:

- `no-calibration-family`: no compatible original family exists; no challenge witness is manufactured.
- `no-challenges`: no applicable challenge records; the original family remains visible.
- `compatible-survivors`: at least one original candidate satisfies all applicable challenges.
- `challenge-conflict`: the nonempty calibration family has no joint challenge survivor, with a minimum witness.

The first three statuses have `witness: null`.

## Minimum, irreducible and physical cause are different

The bounded search examines every nonempty subset of applicable challenge records. It selects an empty-support subset of minimum cardinality. Equal-size witnesses use lexicographic original record order, so ordinals `[0,3]` precede `[1,2]`. This tie convention is transparent ordering, not a ranking of credibility.

Nonempty omission supports separately demonstrate **irreducibility**: removing any one witness member removes that witness's conflict. Irreducibility alone does not prove minimum size; a larger irreducible conflict can coexist with a smaller one. Here minimum size follows from complete bounded subset search, not merely the omission checks.

Neither property identifies physical cause. A conflict could concern a reading, its units or clock/site association, declared uncertainty, the offered family, transfer assumptions or the physical model. The report does not diagnose a sensor, assign probabilities, choose a record to delete, promote challenges to calibration, refit alternatives or establish intervention safety. Overlapping intervals do not by themselves prove duplicate records or independent errors.

## Complete bounded work before inference

The original mechanism-proposal importer runs exactly once after admission. Search uses its authoritative boolean challenge scores; it introduces no tolerance and makes no model calls during subset enumeration. Missing, duplicate or unexpected score mappings are refused rather than interpreted as support.

The reservation uses the **entire offered family**, not the potentially smaller family left after calibration. Let H be offered hypotheses, C applicable target-depth plus gauge challenges, O all original depth plus gauge records, and S = 2^C − 1.

| Category | Reservation and limit |
|---|---|
| Offered family | H ≤ 512 |
| Applicable challenges | C ≤ 12, checked before exponentiation |
| Model work | 3 × H × width × height × ceil(duration/step) ≤ 3,000,000 cell steps |
| Candidate visits | H × (S + 5C + 2) |
| Subset bookkeeping | 8S + C² + C |
| Complete search | Candidate visits + subset bookkeeping ≤ 1,000,000 work units |
| Report work | H × (O + 4) + 2HC + C² + C + 32 ≤ 150,000 items |

Under the current input caps O ≤ 164, H ≤ 512 and C ≤ 12, the report reservation can reach at most 98,492 items. Consequently the 150,000-item report cap cannot independently refuse a currently admitted input; it remains an explicit aggregate guard, not a reachable boundary test to manufacture.

All counts and products must be finite safe integers. Model, search and report reservations are checked before inference, even when the eventual result would be an easy singleton conflict or empty calibration family. The pure support-search helper also validates its complete search budget before allocation. A refusal is for the whole request: no truncated family, processed prefix or partial minimum is reported.

These are specified abstract work categories, not total CPU time, peak heap or serialized-byte guarantees. Original input strings have the independent 4 MiB limit. The consumer changes no existing inference/search producer, calibration algorithm, physical model, acquisition interface or workbench UI.
