# Surface placements under a finite receiving layer

The placement investigation can now compare a declared layer that fills and drains. Select the optional receiving layer, enter its surface, storage depth, initial water, drainage coefficient and source or hypothetical basis, then compare the same complete set of eligible surface edits. This reuses the maintained conservative draining receiver; it does not fit new soil parameters or change the default unlimited-receiver result.

The declaration is held fixed across the original site, current proposal and every hypothetical layout. Its surface determines the affected cells in each map. The result exposes initial, retained, drained and surface-accepted liters separately for each rate and map, including the receiver balance error. Creating more cells of the selected surface also creates more declared receiving area; this is an explicit model assumption, not proof that the site has that soil capacity.

## Evidence and decision boundary

The finite receiver currently uses **all declared infiltration rates**. Calibration or challenge bands evaluated using unlimited receiving space cannot filter this different model. Both the public comparison and placement query refuse that combination instead of falling back to unlimited behavior. Storage/drainage inference remains the separate maintained work in issue 260.

Rankings describe additional model changes from the current proposal, under the same receiver assumption and complete declared rate family. Original observations are never refitted to hypothetical geometry. The unchanged proposal is always included and may be best. This bounded search does not establish physical benefit, an optimum outside the chosen cells, a confidence interval or a measured soil property.

Local peak-depth targets, wet-duration goals, declared cost tradeoffs and finer-interval comparisons retain the same receiver declaration. Work admission still covers every offered layout and rate; it never silently truncates the search. The existing-site batch cache keys include the receiver, and returned summaries cannot mutate its private runs.

## Save, reopen and apply

**Download original placement inputs** retains the project, complete query and optional cost declaration using `experimental-earth-placement-investigation/1`. It contains no candidate results, winner, retained-water totals or evidence verdicts. Reopening validates the original inputs and requires recomputation. Unsupported saved conclusions, invalid declarations and oversized files refuse; no saved winner is trusted.

The current panel represents one common peak-target basis/limit and one common cost basis. An investigation with heterogeneous per-cell target or cost bases refuses before replacing the project, rather than silently flattening those declarations. The pure API preserves its supported more general query.

Newer source edits, choices or file intakes supersede a pending file read. A delayed older read cannot replace a newer source or retire its result. Only the current intake clears its file control.

**Apply these hypothetical surface edits** changes only the selected proposal surfaces. The receiver belongs to the comparison inputs and is not automatically asserted as a measured site property. Existing-site readings remain with their original geometry; the existing proposal-evidence adoption fence remains in force.

## Observed advance

On the maintained authored courtyard with twelve eligible sealed cells, three declared sealed-surface rates and all 79 zero/single/pair layouts:

| Receiving assumption | Best layout | Interpretation |
| --- | --- | --- |
| Existing unlimited model | cells 27,36 | Preserved default |
| Garden receiver, 5 mm storage, empty initially, drainage 1/hour | cells 35,36 | A different pair minimizes the worst additional unabsorbed water |
| Same 5 mm store, no drainage | unchanged proposal | The old unlimited winner increases worst unabsorbed water by more than 87 L |

For the draining 5 mm receiver, cells 35,36 have worst additional unabsorbed water about -61.3731 L; cells 27,36 have about -60.0437 L. Every candidate/rate is compared directly with independent calls to the existing `runRain` solver, including retained/drained volumes and mass balance. These are authored software and model controls, not field validation.

## Executed receiving

- Complete current native suite on base `8b04cd6ac395732a1901ce87237b40e430fc0f98` plus the implementation: **965 passed, zero failures/skips**, Node 24.22.1, about 22.86 seconds. Five new groups cover the full solver oracle, cache identity/mutation, refusals, target/duration/cost/interval composition and input-only replay. Independent review reran those five groups successfully.
- The final async-intake guard followed that full native invocation. Its actual browser negative controls cover the changed behavior: the final course passes eleven groups, while the isolated pre-guard handler fails at delayed older-file overwrite after five earlier groups pass. The negative receipt is retained and is not counted as a passing result.
- Composition with `ea4f00a363851b086afce5edfac52cfcc69d6826` preserves the newly merged draining-evidence investigation and other owner work. Twelve focused native groups (receiving evidence plus placement) pass, and the final eleven-group browser course repeats on these exact composed files. Its source hashes are the committed final browser receipt.
- The existing browser receiving course passes all twelve groups on the composed model/UI; the new course passes eleven groups on the final guarded UI. Both use native Chrome 156.0.8078.47 with active namespace/seccomp sandbox and zero page exceptions. They exercise actual download and file reopening, keyboard input, 390px layout, correct ranking reversals, invalid declarations, source custody, duration/cost/finer intervals and explicit adoption.
- Independent review found the intake race and verified its correction; no remaining blocker was identified in cache, model, replay or evidence semantics. Narrow rendered controls and outcomes were visually inspected.

Reproduce the native group with `node --test --test-isolation=none tests/placement-draining.test.mjs`. Full native receiving uses `node --test --test-isolation=none tests/*.test.mjs`. Browser entry points are `tests/placement-draining.browser.mjs` and `tests/placement.browser.mjs`, using the maintained browser owner and sandbox helper:

```sh
CHROME_BIN=/opt/google/chrome/chrome \
PLACEMENT_DRAINING_RECEIPT_DIR=/path/to/receipt \
node tests/placement-draining.browser.mjs
```

Exact served-source hashes, assertions and browser sandbox details are in `receipts/placement-draining-263/`. Absent CI is not a passed check. Subsequent source composition or deployment must retain the same distinctions between implemented model, executed receiving, merged source and physical evidence.
