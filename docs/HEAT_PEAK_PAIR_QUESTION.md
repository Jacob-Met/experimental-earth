# Joint two-reading questions for a complete inferred peak family

Native outcome: #371. This extends the maintained inferred-family target-peak planner, separately from #176's manually offered hypothesis coverage planner. The original one-reading methods and underlying search, model, support policy, arithmetic guard, and physical qualifications are unchanged.

## Consumer

In the existing hidden-store peak question, choose **Two readings, planned jointly**. The result compares the best single reading, its best admissible second reading (greedy), and the jointly selected pair. Same-channel closed supports must be disjoint, including interval means. Different channels can overlap only through the already explicit lower-channel availability and association declaration. This is a fixed, nonadaptive acquisition plan; it neither acquires data nor infers historical availability.

Original-only downloads use `inferred-heat-peak-pair-minimax/1`. Reopening recomputes the complete inference and pair search and selects the two-reading budget. Existing single-reading files retain their original semantics and select one reading. Computed output and unexpected outer keys are refused. Form edits retire old results. Every admitted pair remains available in pages of 100 rows; pagination does not prune the search.

## Objective and proof

For each original compatible model, retain its target peak and guarded permitted observation band at every admitted channel/time. Two models can coexist after a pair of readings if and only if their closed bands intersect at both readings. This is a rectangle intersection condition, without an error-independence or probability claim. Any remaining finite-family peak spread has two extreme models, so the largest peak difference among pairs satisfying both intersections equals the worst possible remaining spread. A point in both interval intersections witnesses the same extreme pair at both readings.

The implementation sorts every model pair by peak difference and stores a bitset of ambiguous pairs for each query. The first set bit in the intersection of two query bitsets gives the objective. All numerical models and all admissible query pairs participate. Ties retain the original query order (surface before lower, then earlier time). The worst pair's model IDs, target peaks, and both common observation bands are retained. Repeated identical observations do not shrink an assumed half-width.

## Bounded work

The unchanged analytic-course preflight runs before inference. Once the complete compatible family and query rows are known, pair preflight reserves `N*(N-1)/2 * Q` band-overlap checks plus at most `Q*(Q-1)/2 * ceil((N*(N-1)/2)/32)` word intersections. It refuses above 50,000,000 units or 30,000 query-pair slots before allocating pair tables/bitsets. The model count remains bounded by the maintained 800-model ceiling; query count by 482. Sorting, allocation and rendering are not included in these counters. The full course work has already occurred if this second preflight refuses; there is no partial pair result or model pruning. Reduce the declared query grid to reduce pair work.

## Executed native evidence

Six direct Node native groups pass, zero skipped (Node 24.22.1). An authored two-pulse control retains 250 distinct compatible models from the combined search, 36 eligible surface queries and all 630 pairs. Best single at 200 minutes leaves 5.268014762822993 °C; the greedy 200/210 pair leaves 4.146118546538496 °C; the joint 190/220 pair leaves 3.598376054069604 °C. Every pair equals a literal full-model-pair oracle, and selected/greedy results equal an independent two-dimensional endpoint sweep using the maintained single-band primitive.

A 30-minute interval-mean control retains 372 models and all 435 disjoint pairs; every pair also equals the literal oracle. Its joint remaining spread is 14.511686243735234 °C versus 19.16644652128393 °C greedy and 26.68798505604381 °C single. Broad ±100 °C bands preserve a no-additional-benefit result. Tests also cover exact closed touches, one-model/infeasible outcomes, 517 complete models, full-work refusal, malformed families, original-only replay, legacy-method refusal of new recipes, randomized bitset word boundaries, and model-order invariance.

These authored controls demonstrate conditional finite-family planning, not physical information gain, a continuous-domain enclosure, calibrated probabilities, or reliable model adequacy. No initial state or observation band was fitted to these planning outcomes. Empty families, unavailable supports, and no extra benefit remain explicit.

A seven-group actual-browser receiving course is supplied for root's sandboxed environment: legacy source, budget selection, full-pair pagination, actual download/reload, desktop/narrow rendering, changed precision/no benefit, and injected-result refusal with unchanged working source. Browser execution is pending; source checks are not browser evidence.
