# Rainfall and infiltration explanations

The infiltration panel includes **Could uncertain rainfall change the soil explanation?**. Choose the existing scenario, surface and soil candidates, then supply explicit constant rainfall alternatives. Compare against the original notebook calibration and held-aside readings. No parameters are adopted.

Every offered pair is retained, including those contradicted by original depth evidence or an optional sourced rainfall interval. Calibration determines ordering. Held-aside readings only challenge the retained explanations. No calibration means no supported pair; lack of held-aside readings is not independent validation. A single surviving pair is only one of the finite alternatives offered.

Optional rainfall limits must refer to the same event and support the constant-forcing interpretation. A weather setting alone is not a rain measurement. Timeline forcing is refused. All pairs reuse the maintained rainfall solver and point-reading evaluator; the complete work is capped at three million cell steps before execution. Numerical guards in the depth evaluator are computational tolerances, not sensor uncertainty. Rainfall bounds are compared inclusively without adding uncertainty.

Download retains the original project and declarations, not a trusted derived result. Reopening recalculates them without replacing the current site. Source attribution is a supplied claim, not verified provenance. Changing active inputs retires the result.

## Authored analytic qualification

On a closed, immobile flat 2×2 site, a one-hour storm at 30 mm/h with 10 mm/h infiltration and a storm at 40 mm/h with 20 mm/h infiltration both leave 20 mm at minute60. The other offered cross-pairs predict10 and30 mm. A supplied29–31 mm/h rainfall interval distinguishes the first pair. Without that interval, a held-aside depth10 mm at minute120 distinguishes the first pair without changing calibration compatibility/order. This is a calculation control, not field evidence.

Run `node --test tests/rain-soil-evidence.test.mjs`. The tests exercise ambiguity, conservation, nonmutation, gauge contradiction, challenge independence, missing/dry evidence, unsupported declarations and source-only replay. Actual browser receiving and wider suite qualification are separate integration requirements.
