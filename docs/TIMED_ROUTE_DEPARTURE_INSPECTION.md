# Inspect a chosen modeled departure

This additive interface lets a user check a particular departure within the committed comparison range. It preserves the existing route, retained replay, threshold interpretation and traversal calculations. Original route/replay ownership and source evidence remain unchanged.

## Observed baseline

The existing panel displays departure-window bounds rounded to two decimal places. A displayed bound can therefore lie just outside the exact qualifying interval. The read-only analytic probe was received through Renpō on accepted source `4012a3d1` at `2026-10-27T08:55:10.736921009Z`; both rounded-boundary probes reproduced this behavior.

In that fixture, A stays dry and B has depths 0, 6, 0 mm at minutes 0, 1, 2. At threshold 1 mm and a declared A-to-B step of 0.01 minute, the exact departure windows over 0–1.99 are approximately `[0, 0.156666…]` and `[1.823333…, 1.99]`. The panel's two-decimal bounds are `[0, 0.16]` and `[1.82, 1.99]`. Departures 0.16 and 1.82 both reach B at approximately 1.02 mm and fail the threshold comparison. This is a display interpretation problem; the calculation should not snap a chosen departure to a different time.

## Chosen departure and comparison range

The range comparison remains a positive-duration question. A separate chosen-minute query uses the current successfully committed range, including both its endpoints. Unsaved edits to the range controls do not redefine that committed range. The user enters the requested departure explicitly; there are no automatic boundary-selection buttons or adjustments.

This separation makes the final valid departure inspectable. For a retained replay from 0 to 20 and a five-minute route, a range of 0–15 can be compared and departure 15 inspected. Its final arrival is exactly 20. A new positive-duration range starting at 15 would not fit inside the replay, but that does not invalidate the individual point.

Existing and Proposal each show a per-cell table with four columns: cell, modeled arrival minute, modeled depth and threshold status. The outcome explicitly identifies the first exceedance when present. Displayed numbers may be rounded, while status and first-exceedance classification use the full retained values. A depth that visually rounds to the threshold can consequently still be classified above it; the accompanying explanation must make that distinction clear.

## Point results and interval results

Window bounds are labeled approximate. Checking a chosen departure answers whether every route cell is at or below the threshold at its declared arrival. It does not assert a qualifying neighborhood around that departure.

An isolated threshold-equality instant can qualify even when no positive-duration window qualifies. Conversely, a rounded displayed bound can fail an exact point query. Neither case changes the existing positive-duration interval semantics. These are conditional retained-model comparisons, not observed water conditions, inferred walking speeds or physical traversal safety assessments.

## State and receiving requirements

The point result must use the committed route timing and range together with the current source replay and threshold. A range attempt blocked by native form validation is an uncommitted draft: the previous comparison and point findings remain visible with the warning, "Timing changes were not compared. Previous results remain in view." A submitted range that fails model validation clears and refuses the comparison. A successful new comparison or route reset clears the prior point query; a failed point inspection removes its obsolete point findings. A threshold or replay refresh must recompute any retained valid point query or visibly refuse it; it must not leave an old table presented as current. An invalid point query must not silently change the comparison range.

Tables belong in bounded scrolling regions so long routes can be inspected without expanding the mobile page horizontally. Source project and replay data are read-only inputs to both queries.

## Executed candidate receiving

The [receiving record](receiving/timed-route-departure-inspection-dae856c9/receipt.json) identifies the checked candidate on base `4012a3d19e80f524ee22fcd1dcff9a706e464344`. The production panel SHA-256 is `eea6b9799d243653e07300d05e2e5b61a31ad1cc4da48d085ad73e9660228882`; the independent browser evaluator SHA-256 is `e9e3c883659bd06544f3d1ee7a1fccf1e55e667a46b674a5aa27f01e163687b4`. These are candidate qualification results, not a claim of accepted integration.

Candidate qualification spans the successful native phase of the first attempt and the corrected browser run. Command `estate-dae856c9-20261027-inspection-verify-02` completed with exit code 0 on 2026-10-27 at `09:11:43.481598918Z`. The retained results are:

- **30 focused native tests**, with no failures or skips (`inspection-native-01`, the native phase of `inspection-verify-01`; its later browser phase failed as described below).
- **13 new browser outcome groups** (`inspection-browser-02`), including actual maintained-example rows, first-exceedance ordering, trusted keyboard submission, unsubmitted drafts, the native-invalid-range warning, point refusal/recovery, route and threshold refresh, source-horizon refusal/recovery, final valid departure, both rounded-boundary failures, isolated equality and 128 rows in bounded keyboard-scrollable mobile regions.
- **11 previous browser outcome groups** (`inspection-previous-browser-02`), preserving the independent window comparisons and existing refresh behavior.
- An expected rejection of a disposable mutation that inspected the range start instead of the chosen departure. The independent arrival assertion detected `0` where `10` was required. This mutation was not delivered.

The first attempt, `estate-dae856c9-20261027-inspection-verify-01`, failed because the test driver's Enter event omitted character text, leaving results at the prior departure. The retained diagnostic `estate-dae856c9-20261027-inspection-keyboard-diagnostic-01` isolated that input-driver issue. The evaluator was corrected and rerun; production source did not change to bypass the failure. The final keyboard check includes trusted key and submit events.

The new course and prior regression course can be rerun from the repository root with:

```sh
CHROME_BIN=/usr/bin/google-chrome node tests/route-traversal-inspection.receiving.mjs
CHROME_BIN=/usr/bin/google-chrome node tests/route-traversal-oracle.receiving.mjs
```

## Independent visual receiving

Initial section-clipped screenshots showed readable numeric rows but cut desktop text at the crop boundary; the mobile reset toast and persistent finder overlapped some Proposal content. Those images did not establish complete visual coverage.

A separate visual-only course left production and the functional evaluator unchanged, waited for the reset toast to expire naturally, and captured full viewports at 1440×1000 and 390×844, each at top and bottom scroll positions. Command `estate-dae856c9-20261027-inspection-visual-01` completed with exit code 0 at `2026-10-27T09:15:41.904824659Z`; request SHA-256 is `497512e0f5156b0b60e4c5e971d21a8cce6feb0312250d4852bb21940f774935`.

Independent pixel review confirmed the desktop controls, both complete three-cell tables and the qualification text are readable. At chosen minute 10 and threshold 10 mm, Existing F3 shows 10.0033 mm and is explicitly the first exceedance; Proposal F3 shows 9.70294 mm and is at/below. Mobile columns wrap readably without page-wide horizontal overflow. The top mobile viewport necessarily contains only part of this longer section and its fixed finder can overlap lower content; the complementary bottom viewport shows all Proposal rows and the full qualification above the bottom control. No production element was hidden or restyled for the captures.

Reviewed captures: [desktop viewport](receiving/timed-route-departure-inspection-dae856c9/inspection-desktop.png) and [mobile bottom viewport](receiving/timed-route-departure-inspection-dae856c9/inspection-mobile.png). Reproduce the separate visual course from the repository root with:

```sh
node tests/route-traversal-inspection.visual.mjs "$PWD"
```

This visual script accepts the absolute repository path and supplements the frozen functional evaluator; it does not replace it.

All four browser courses—the new evaluator, regression evaluator, negative control and visual-only course—received active namespace and seccomp sandbox admission. Successful courses have completed session receipts; the negative control has the expected failed course status. Qualification remains limited to these retained-model cases and checked sources. It does not establish physical flood accuracy, safe traversal, universal device layout, or an exhaustive accessibility audit.
