# Reuse original finite rate support in complete mixed comparisons

The mixed planner first selects evidence-compatible rates on the unchanged source. Previously every hypothetical layout ran every declared rate and then discarded unsupported results. The new explicit `batch.fixedRates(project, options, rates)` evaluates only a nonempty, dense, unique subset of declared rates; it requires `subset: 'all'` so it cannot filter evidence on hypothetical layouts. The planner passes its private original support. The same maintained comparator constructs metrics, peaks, exposure and receiver summaries. The existing source cache remains private and invalidates on source changes.

No hydraulic equation, evidence selection, public study schema, ranking, adoption or conservative work admission changes. Missing/null/duplicate/sparse/undeclared rates refuse. The method does not certify that an arbitrary caller's declared subset is evidentially supported; the mixed caller owns that custody.

Qualification: two new native groups cover singleton/full selection equality, admission negatives, source invalidation, mutable output isolation, finite receiver and duration exposure. Twelve mixed native groups remain passing. A separate full-report baseline receiver checks complete nine-layout calibration/duration/challenge results. The actual full application browser course passed all nine receiving checks; the subsequent explicit null/undefined admission guard was separately exercised natively.

An authored courtyard with 19 complete layouts, nine declared rates and one originally supported rate produced identical complete reports in six alternating same-process pairs. Baseline times were 165.96,51.57,61.45,54.77,60.81,55.73 ms; candidate18.27,12.43,12.50,12.72,12.14,12.04 ms. These are local timing observations, including warmup and shared-host effects, not a universal latency guarantee. The conservative work report stays1,181,952.

Run portable regressions with `node tests/fixed-support.test.mjs` and `node tests/mixed-placement.test.mjs`. Browser command remains in MIXED_RECEIVING_COMMANDS.md.
