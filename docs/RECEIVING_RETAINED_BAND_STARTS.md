# Search original retained-water bands when their centers cannot supply a start

The receiving-account inverse can now seek numerical receivers from valid late retained-water uncertainty bands even when their central readings increase. A decreasing physical course may lie inside both bands. Rejecting the center ratio therefore does not establish that no receiver fits the original measurements.

The change adds a conditional starting method to the existing original-band search. It preserves the analytic producer, existing drainage-curve starts, maintained rain and receiving kernel, QR solver, three-start limit, and final full-site checks. It is used only when the earlier methods supply no start. No supplied measurement is replaced, smoothed or given a wider uncertainty.

## Actual consumer

In **Infer receivers without supplying their initial water**, choose **Try uncertain late retained water**. The analytic calculation produces no admitted proposal from the increasing centers. **Search the original calibration bands** finds one receiver that passes every original calibration band. The later original retained-water and cumulative-drainage measurements both reject that receiver. The interface says **challenged** and retains the failed predictions.

The nested paired-layout comparison can receive these same original inputs. It computes the consequences of the calibration-compatible model, displays the declared transfer assumption, and leaves the held-supported range empty. It does not select a winner or turn a fit into a physical intervention. Saving and reopening contains only the original site, selection and account; a fresh page recomputes the same result.

## Mechanism and limits

For two positive, dry-recession inventories at times separated by Δt hours, retained water under this conditional model obeys `V2 = V1 exp(-k Δt)`. Each pair of original calibration bands provides lower and upper computational bounds on a possible positive rate. Same-time rows are intersected for this starting calculation; every original row remains independently binding in final verification. All ordered distinct-time pairs are considered within the already reserved central-trial limit. Disjoint same-time bands, incompatible increasing bands and all-zero nonidentifying bands cannot supply a fallback success.

The first implementation used the rate midpoint with the existing capacity/initial-water/rate coordinates. It spent all 633 permitted reduced trials on the development counterexample without finding a witness. That failure and the exact first method are preserved in `experiments/retained-seed-first-failure.json` and `experiments/retained-seed-first-method.js`. The precise storm-depth band made this parameterization poorly conditioned.

The qualified method instead searches initial stored fraction, log drainage rate, and a coordinate inside the original storm-depth band. For each trial it solves capacity with the unchanged maintained kernel using two bracket endpoints and 56 bisections. The storm-depth search is restricted to a strict physical interior, and the positive rate interval is restricted to a bracket supported by the declared maximum capacity. These are computational restrictions; neither is a certified feasible region, a physical exclusion, an exhaustive uncertainty range, or an inferred additional measurement. A zero-width coordinate contributes a zero derivative column.

Original surface and receiver bands remain the sole support authority. The reduced four-cell course is admitted only for the existing uniform isolated-receiver contract. Each final candidate is forwarded on the original complete map before either calibration or held support is reported. All fitted parameters are frozen before held values are read. Failed searches remain unresolved, including when a known admissible model exists.

The complete reservation adds at most `633 × 58 = 36,714` kernel calls before any producer or forward model runs. It retains the one-million cell-equivalent-step limit and reserves the possible failed drainage-start endpoints. The development example uses 556 reduced trials, 32,248 projected kernel calls and three original-grid checks, within a 409,566-step reservation. A negative control uses a 306-cell original map that the old reservation admits but the expanded reservation refuses: zero incumbent, kernel or forward calls occur before refusal.

## Independently authored controls

A separate contributor fixed 18 parameter tuples and an increasing-center perturbation rule before inspecting or running the new fitter. That contributor then used only the unchanged forward kernel to classify eligibility and record the original-value oracle. Fifteen tuples satisfy the predeclared positive-storm, ordered-time, dry-surface and positive-decreasing-inventory conditions. The other three remain explicitly excluded for those conditions. All original truth values lie inside their recorded bands.

The numerical method and informative held rule were frozen before the root contributor read these tuples. The exact freeze, original tuples, independent oracle and complete comparison are retained in `experiments/retained-method-independent-freeze.json`, `experiments/independent-retained-tuples.json`, `experiments/independent-retained-validation.json` and `experiments/independent-retained-comparison.json`. The held receiver values are retained and cumulative drainage at the predeclared later time, each at ±0.02 L. Neither enters fitting, starting points, eligibility or method selection.

| Fixed original input set | Previous method | New starting parameterization |
| --- | ---: | ---: |
| Eligible authored courses | 15 | 15 |
| At least one calibration-compatible witness | 0 | 8 |
| At least one witness also passing informative held readings | 0 | 1 |
| Search unresolved despite an admissible known model | 15 | 7 |

Every result remains in the receipt. Seven of the eight courses with a calibration witness still fail the held challenge. This establishes increased calibration-witness coverage for the specific missing-start case, with limited predictive coverage. It does not identify the generating capacity, initial water or drainage, establish field accuracy, or certify continuous uncertainty. The independent inputs are authored controls from a separate contributor, not externally blinded physical measurements.

The first complete 15-course evaluation took approximately 1.28 seconds for the new method in the available Node runtime, ranging from approximately 30 to 177 milliseconds per course. The largest reserved work was 347,454 cell-equivalent steps. These local measurements are reproducible cost evidence, not a hardware-independent latency guarantee. The previous 70 eligible mixed-surface regression courses retained their 70 calibration and 62 held-support outcomes; the separate consumed 184-course development set retained 181 calibration and 165 held-support outcomes.

## Qualification

`tests/receiving-retained-starts.test.mjs` has eight substantive groups plus its receipt assertion: the actual counterexample and informative failure, held independence, contradictory and nonidentifying sources, pre-producer work refusal, corrupted full-map verification, strict source-only replay, paired consequences, and reproduction of all 15 independent outcomes. Nine tests pass. The prior band-search and consequence regressions also pass all 17 tests.

The actual maintained browser harness adds the new example, fresh-page source replay and paired consequence journey to the prior band-search receiving checks. It runs in unprivileged Chromium with the full sandbox, exercises the keyboard and narrow-screen controls, and rejects stale, forged, contradictory and over-budget results. Exact receipts and source hashes are under `docs/receipts/retained-band-starts/`. Current-main runtime composition and scoped independent review are recorded there; this is a tested runtime snapshot, not a whole-repository CI claim.

The remaining capability gap is concrete: a finite local fit still misses some admissible receivers, and broad early inventory bands often leave initial water and later drainage weakly determined. These results support work on the missing numerical coverage and useful original measurements. They do not support changing the physical kernel merely because a fitted alternative fails later readings.
