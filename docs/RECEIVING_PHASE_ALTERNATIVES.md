# Keep filled and never-filled receivers as explicit alternatives

The receiving-account investigation can now add a finite family of filled and never-filled receiver models to the original-band search. This closes a specific gap: a receiver may admit the original retained-water bands without ever reaching capacity, while a start that assumes filling finds no compatible model. It also makes an important physical ambiguity visible: once capacity is above every modeled inventory, larger capacities can produce the same course.

The maintained physical kernel, analytic inverse, original-band incumbent, original observations and held challenge remain in place. This is an optional search expansion. It does not identify a soil capacity, cover every possible parameter combination, or establish field accuracy.

## Use it in the workbench

In **Infer receivers without supplying their initial water**, choose **Try a receiver that never fills**. **Search the original calibration bands** finds no compatible receiver on this authored example. **Include filled and never-filled alternatives** finds 12 calibration-compatible parameter sets, six of which also satisfy the two informative held receiver readings. Distinct arbitrary capacities remain visible for otherwise identical courses. The interface explains why those capacities are not estimates.

The accepted investigation can be explicitly copied to the paired-layout comparison. That child receives the original site, footprint, account and phase option, then recomputes the complete supported family under the person's explicit transfer assumption. All 12 supported models enter the comparison; six satisfy the held challenge. Saving either investigation includes only original sources and the declared option. Opening it on a fresh page recomputes the models. Subsequent parent edits do not retarget an already accepted child.

These are authored examples. A successful calibration fit is distinct from held support, a physical measurement, parameter identification, installation, or intervention adoption.

## Finite computational mechanism

The unchanged original-band incumbent is retained in full. The extra phase family is generated from original calibration inputs before the incumbent runs, so its output cannot steer the new starts. Held values do not generate parameters, rank prospective observations, or select a model.

For a filled receiver, five fixed pairs of computational points are taken from the first and last original retained calibration bands: the four corner pairs and their center. The existing maintained post-dry inverse receives each pair. Those values are computational targets only; they are never inserted as observations, and every original band remains binding.

For a never-filled receiver, let rainfall intensity be R, infiltration rate F, storm duration T hours, and original initial inventory S0. The conditional unrestricted intake is J = min(R,F), storm-end surface depth is H = (R − J)T, and the surface becomes dry at U = T + H/F. After U, multiplying inventory by exp(kt) gives

`S(t) exp(kt) = S0 + (J/k) expm1(kT) + (F/k) exp(kT) expm1(k(U − T))`.

The original storm-depth band must admit H, and the retained calibration readings must occur after the conditional dry time. Their first/last bands define a positive computational rate interval. Nine fixed rate starts are sampled. At each start, all original retained bands are intersected for S0, within the maintained 0–10,000 mm initial-water domain. Inverted or nonfinite intersections are refused. Three points in each surviving initial-water interval produce two explicit capacity witnesses: one slightly above the largest modeled storage at start, storm end or dry time, and one larger capacity. Capacity slack is a computational choice, not a measured uncertainty or certified bound.

Every extra candidate is then forwarded through the unchanged model on the complete original map. All original surface readings and retained/drainage account readings are evaluated. A contradiction outside the selected surface, a failed final course, or a corrupted full-map result cannot be reported as support.

The family has at most 30 filled and 54 never-filled proposals, plus the original three-start band incumbent. Complete work is reserved before any producer or forward model runs, including all possible full-grid verification and bounded inverse work. The one-million cell-equivalent-step limit remains. Paired consequences reserve six maintained comparison runs for every possible admitted model before inference starts; no partial family is returned to fit the budget.

## Runtime discrepancy and correction

The first method sampled the two rate endpoints exactly. With identical original inputs, Node accepted an upper-rate transformed initial-water interval `[12.504196819882154, 12.504196819882182]` mm. Chromium computed `[12.504196819882281, 12.504196819882239]` mm and correctly refused it. The result changed from 12 calibration-compatible/six held-supported alternatives to six/zero. The first source, native results, independently authored input result and failed browser receipts were preserved before correction.

The corrected finite grid moves only the two endpoint starts inside a nonzero-width rate interval by `min(width/4, 64 × Number.EPSILON × maximum absolute rate)`. The other seven points are unchanged. Nominal fractions, sampled fractions and insets are recorded. A zero-width interval stays exact. This is a numerical sampling convention, not extra measurement uncertainty, directed-rounding proof, or continuous coverage. Inverted S0 intersections still refuse; no original band is widened or invalid interval clipped.

The same-original runtime probe now gives 12/six in both Node and Chromium. The browser-authored source has slightly different floating-point example values from the separately generated Node example. Persistence is therefore checked by exact comparison with the original source generated in that browser, followed by exact fresh-page replay; it is not checked against a newly generated example from a different numerical runtime. The earlier incorrect test-oracle failure is retained separately.

## What the evidence establishes

A separate contributor authored and froze 16 new tuples before inspecting or executing this fitter. Root froze the first numerical method and held rule before receiving tuple values. All 16 truth courses satisfy the independent original-band eligibility rule. The comparison retains every candidate, unsupported course and budget refusal.

| Input and method | Original-band calibration support | Expanded calibration support | Original-band held support | Expanded held support |
| --- | ---: | ---: | ---: | ---: |
| First run on 16 newly released authored courses, v1 | 11/16 | 14/16 | 1/16 | 1/16 |
| Same 16 now consumed courses, corrected endpoint grid | 11/16 | 16/16 | 1/16 | 1/16 |
| Earlier 15 consumed development courses, corrected grid | 8/15 | 15/15 | 1/15 | 2/15 |

The corrected 16-course replay is development/regression evidence, not an independent qualification of changed numerical bytes. It takes approximately 1.00 second in the recorded Node run, with a maximum complete reservation of 532,430 cell-equivalent steps. Timings are local observations, not a latency guarantee.

The result is broader calibration-witness coverage with substantial predictive ambiguity. Fifteen of the 16 new courses still have no generated candidate that satisfies both informative held account readings. A larger finite family and one supported member do not constitute a selected predictor. The experiments give no basis for changing the physical kernel or reporting inferred capacity as a measured material property.

Exact first and corrected freezes, original tuple and oracle files, complete comparisons and native receipts are under `experiments/`. Browser failures, runtime diagnostics and qualified receiving are under `docs/receipts/phase-family-v1/` and `docs/receipts/phase-family-v2/`.

## Qualification and remaining gap

The corrected native suite passes nine substantive groups plus a receipt assertion. It checks an independent piecewise exponential oracle, broad/narrow/exact rate intervals, unchanged original sources, arbitrary capacity ambiguity, held independence, contradictory and overflow refusals, complete pre-producer reservation, final-map authority, source-only replay, paired comparison and the consumed development courses. The preceding band, retained-start and consequence suites pass 26 tests.

The actual maintained application passes 16 browser groups in unprivileged Chromium with its full namespace/seccomp sandbox. These include keyboard operation, desktop/390-pixel layouts, original-only downloads, fresh reopen, all supported paired models, forged-result rejection, preflight budget refusal, queued-work retirement and delayed-file exclusion. Browser errors and failed application resources are zero. Current main's five disjoint solar/heat runtime changes were received at exact native Git blob identities and exercised in the same page. This is a qualified composed runtime snapshot, not a whole-repository CI claim.

The unresolved capability is now clearer: early broad inventory bands alone do not sufficiently constrain initial stored water and later cumulative drainage. The next useful advance must use informative original measurements or a stronger justified inverse mechanism, while preserving unsupported alternatives and the unchanged held challenge.
