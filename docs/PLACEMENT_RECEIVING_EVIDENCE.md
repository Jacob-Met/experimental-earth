# Placement under original receiving explanations

The maintained placement panel can now open the original inputs from the
receiving-evidence investigation and compare every eligible layout across the
receiving explanations retained by those inputs. This addresses #297 after the
single declared layer in #263. The receiving-evidence model and its original
calibration/held-aside reading rules remain owned by `draining-layer-evidence.js`.

## Use the existing consumer

1. In the receiving-evidence investigation, download its original inputs.
2. In **Where could a small surface change help?**, open that file under
   **Receiving explanations from original readings**. This opens its original
   project and declared receiving family; no cells are silently selected.
3. Choose eligible cells, replacement surface and objective. Keep every declared
   explanation, use calibration-compatible explanations, or retain only those
   also compatible with the original held-aside readings.
4. Compare all zero-, one- and two-cell layouts in the eligible set. Inspect
   every offered explanation, its original support and each retained receiver's
   source-to-candidate consequences. Rejected explanations are still visible.
5. Optionally declare local peak-depth targets, within-window duration goals and
   additive cost tradeoffs, or check finer calculation intervals. These use the
   same retained original explanations. Applying a qualified layout changes
   only the explicit hypothetical surface edits.

The original-source-only placement download uses
`experimental-earth-placement-investigation/2`. Opening it recomputes evidence
support and layouts. Older readers refuse the new model contract; the new reader
also refuses a receiving family relabeled as version 1. Existing rate-family
inputs continue to use version 1. Neither form saves a winner or support verdict.

**Return to infiltration-rate comparison** explicitly leaves receiving-family
mode. A later source edit also retires the loaded comparison. File intake uses
the same generation and request ownership across both input controls, so a late
read cannot replace a newer source, investigation or explicit mode change.

## The distinction this makes

An authored maintained courtyard has an existing garden at cell 27 and four
declared receivers: a 5 mm closed store, a 5 mm store draining at 1/hour, a 10 mm
store draining at 0.5/hour, and a 20 mm closed store. All start empty. The modeled
rain is 36 mm/hour for 60 minutes, followed through 240 minutes at 5-minute
steps. These are software controls, not field readings or calibrated materials.

The original 30-minute depth band admits both 5 mm explanations. The original
60-minute held-aside band retains only the draining one. Among all 67 layouts
on the 11 eligible cells, both subsets prefer cells 35 and 36. Their consequences
are very different:

| Original support used | Retained receiving IDs | Worst additional unabsorbed water |
| --- | --- | ---: |
| Calibration-compatible | h0, h1 | −3.149528 L |
| Also within held-aside bands | h1 | −151.709764 L |

Manually choosing the favorable receiver would hide this supported consequence
range. The product now carries that ambiguity into the placement comparison.
The result is conditional on the declared finite family, evidence bands,
geometry, model defaults and event; it establishes neither physical benefit nor
an optimum outside the enumerated set.

## Model and evidence custody

`receivingStudy` is an explicit alternative to the infiltration-rate `study` or
one fixed `drainingLayer`. A joint declaration is refused. Receiving evidence
was evaluated with the maintained default infiltration rates (sealed 1, turf 9,
garden 24 mm/hour); inventing a second infiltration rate to fit an existing
validator would silently change that model. This route uses the default rates
and the maintained `hypothesisLayer` and `runRain` functions directly.

The native receiving comparator evaluates support once on unchanged original
geometry. No hypothetical layout refits or reclassifies the readings. Original
calibration, held-aside results, counts and rejected rows remain available.
Missing calibration, missing held-aside readings, a surface absent from the
original evidence scenario or completely rejected support refuses filtered
comparison. An explicit all-declared comparison can still test an uncalibrated
family, with that state visible; there is no nearest-fit fallback.

Finer-interval comparisons keep IDs and a private copy of the original evidence
in an invocation-bound WeakMap. An imported, cloned, changed-source or altered-ID
baseline cannot manufacture that support. In the authored control, refitting at
1.25 minutes would reject the narrow original survivor, while the fixed-support
course correctly keeps h1 and reports numerical sensitivity rather than a new
calibration. Returned summaries and witness metadata do not expose cached runs.

The conservative full-work admission counts every declared receiver and every
layout before filtering, plus optional full-grid exposure passes. It covers the
original two-map evidence evaluation, each baseline and every candidate. The
existing three-million combined-work limit remains; no layouts or explanations
are silently shortlisted. Original proposal-assigned readings still block
adopting a changed geometry. Receiving assumptions are not installed as measured
site properties when surface edits are adopted.

## Verification

The exact current-source receiving course uses base
`384ea4f75be0bdc96035f5e6e330f6cf22918a1b` plus the delivered placement changes.
Incoming component receiving, station, thermal and observed-storage consumers
are preserved. The solver itself is unchanged by this contribution.

Meaningful native controls compare all four receivers across all 67 layouts
against direct maintained solver calls, including water balance, per-cell peaks
and receiver totals. They challenge calibration/held-aside independence,
missing/rejected support, default-rate identity, complete work admission,
private result custody, strict replay and the common target/duration/cost paths.
Ten incumbent comparisons over five objectives and both edit-count limits have
byte-identical full JSON output. The actual previous version-1 reader refuses
the new original-input contract.

The actual-browser course opens native receiving inputs, uses keyboard cell
selection, compares all supported subsets, downloads and reopens a real file,
challenges forged/downversioned input and total rejection, carries witnesses
through duration/cost/finer intervals, adopts surfaces without moving evidence,
and tests delayed reads across the two intake controls and an explicit mode
change. Desktop and 390 px screenshots were inspected. The browser must pass
the maintained namespace/seccomp admission and must report no JavaScript
exceptions. Executed receipts and source hashes accompany this document.

```sh
node --test --test-isolation=none tests/placement-receiving.test.mjs
CHROME_BIN=/absolute/path/to/native/chrome \
  node tests/placement-receiving.browser.mjs
```

The initial Enter CDP event sequence did not activate the selection button and
the course correctly failed before producing a successful comparison. The final
course uses actual Space key down/up and checks the focused control and selected
cell count before running. That initial harness failure is not a capability gain.
