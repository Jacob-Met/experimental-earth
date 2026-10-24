# Check whether placement targets depend on calculation interval

After comparing an explicit set of surface placements, choose **Check finer calculation intervals**. The workbench repeats the same layouts, objective and local targets at the current step and up to two finer supported steps. It shows the best qualifying set and number of qualifying layouts at each step. Expand the layout details to inspect every original supported rate's target change and violation witness.

The original project's evidence filter is evaluated at its original calculation interval. That supported hypothesis population then stays fixed. Finer calculations neither refit readings nor rescue rejected hypotheses. A study may declare two to nine rates and retain only one; that single original survivor is still evaluated at each finer step without changing the authored study. A changed calibration set would be a different investigation, not a numerical sensitivity check of the same hypotheses.

Local-target eligibility uses the same inclusive signed bounds as the ordinary placement comparison. A changed qualification or best set is disclosed. Unchanged results establish agreement only across these tested intervals; they do not establish numerical convergence, physical accuracy or a calibrated uncertainty interval. No target, source evidence, site layout or calculation setting is adopted by this action. Editing the source, eligible set, objective, evidence subset or targets retires the result.

## Work and admission

The tested steps follow the maintained intervention-resolution convention: original, half and quarter, clipped to the supported one-minute minimum and deduplicated. Already at one minute, the action refuses without running a comparison. Before any model execution, a joint conservative budget counts all declared rates, every eligible zero/single/pair layout, all cells and every tested step. More than 3 million estimated cell-steps refuses the whole course. The user can explicitly reduce eligibility or other inputs; the workbench does not silently shortlist layouts or discard hypotheses.

The original `comparePlacements` consumer remains unchanged in meaning. Its maintained aggregation is reused through `comparePlacementsWithFixedSupport` for finer calculations. This receiver requires the original in-memory comparison produced by the maintained module. A module-private context binds its original source, query and supported rates; a copied/imported result or modified support list refuses. This ephemeral context is rebuilt by rerunning the original comparison, never by trusting serialized result metadata. It preserves the original declared population separately from fixed evidence support and labels the support mode. It does not change the soil-inference or solver modules.

## Executed controls

Using the illustrative courtyard with proposal copied from existing, eligible cells `[18,19,27,36]`, at most two garden edits, sealed rates `[0.2,1,4]` mm/h, and the unabsorbed-water objective:

| Step (min) | Layouts meeting a C2 limit of −1.8 mm | Best qualifying edits | Worst C2 change for `[18,36]` (mm) |
|---|---:|---|---:|
| 5 | 4 | `[18,36]` | −1.8894344492891264 |
| 2.5 | 2 | `[18,27]` | −1.7940404207563958 |
| 1.25 | 2 | `[18,27]` | −1.7487841812224048 |

The joint estimate is 1,596,672 cell-steps. A −1 mm C2 target retains the same qualification and best set at all three steps. A dry control preserves ties or reports no qualifying layout when reduction is impossible. These are modeled software controls, not field observations.

A separate synthetic exact depth reading at existing cell 27/minute 60 admits only the 1 mm/h hypothesis at the original five-minute step. Reapplying its zero-width calibration band at finer steps rejects every declared rate. The sensitivity consumer instead keeps the original 1 mm/h hypothesis, making the numerical question explicit rather than silently changing its population.

## Receiving

Run `node tests/placement-resolution.test.mjs` for the numerical reversal, stable and dry controls, single-survivor/frozen-support control, original rejection preservation, invalid source/query context, joint budget and minimum-step cases. Existing placement and local-target tests remain applicable.

Run `CHROME_BIN=/usr/bin/google-chrome-stable node tests/placement-resolution.browser.mjs` using an installed direct Chromium binary. The maintained helper requires actual sandbox admission before product assertions. `PLACEMENT_RESOLUTION_RECEIPT_DIR` optionally selects a fresh evidence directory. The receiver exercises full-workload refusal, explicit smaller eligibility, per-step qualification/best changes, source nonmutation, target invalidation, single-survivor support, minimum-step refusal and narrow witness inspection; it records JSON and desktop/mobile images. A supplied receiver is not itself a passed execution receipt.
