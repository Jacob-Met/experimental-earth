# The same proposal under both original storms

After a successful **separate observed storm** threshold investigation, choose **Compare the plan in both source storms**. The comparison uses every unchanged rate supported by the original first calibration, any first-event held-aside bounds, and the second-event held-aside bounds.

Unlike the preceding transfer result, which reports consequences under the first storm only, this view evaluates the original existing and proposed plans under each event's own forcing and duration. Both existing and proposal physical layouts must already match across the saved source projects. A mismatched plan is refused; the app never copies a hypothetical layout into an observed source.

Inspect each quantity's proposal-minus-existing range in each storm, every rate's paired quantities and water accounts, and every cell's separate modeled peak-depth change. A listed **same-rate direction reversal** requires one unchanged rate to have a negative effect in one storm and a positive effect in the other. An aggregate range can span both signs solely because different rates disagree; that is not reported as a storm-specific reversal. The maintained arithmetic guard in summarizeEffects is a numerical convention, not a measured uncertainty.

An authored 2×2 control starts with four turf cells. The same proposal changes one cell to a garden and another to sealed paving. A 30 mm/h storm for 60 minutes and a first-event depth lower bound of 15 mm retain 10 mm/h infiltration. The same rate survives a separate 6 mm/h storm with a zero-depth upper bound. Under the first storm, proposal stored water is 5 L lower; under the second it is 5 L higher. Successful rate transfer therefore does not establish the same proposal benefit across these two storms. These are computational controls, not acquired environmental observations.

The original two-event input file already contains everything required. Saving still writes only original projects, fixed study and declarations; reopening recomputes. The child result is retired whenever the parent source/declaration result is retired. No parameter, site or proposal is adopted.

The complete work budget reserves source support plus both paired worlds for each offered rate in both events: three million combined cell-steps. Event horizons remain visible; totals are not normalized by duration. Two selected storms do not establish event frequencies, a climate distribution, physical safety, field accuracy or an implementation recommendation.

Native: node tests/storm-consequences.test.mjs. Browser qualification uses the maintained sandbox-admitted receiver and must be executed before integration claims.
