# Original-time sky evidence

The original-course inquiry asks what three final existing-surface readings imply about the proposal's paired temperature differences earlier in the same declared course. Open `sky-course-evidence.html` through the documented `python3 serve.py --port 0` launcher, or follow the entry from the three-reading inquiry.

The authored courtyard control illustrates the useful distinction. At comparison point B2 and the explicitly declared change after interval 8, the surface range at 08:00 UTC is approximately **−2.101912 to −2.083703 °C**. At the original 12:00 final reading time it is **+1.637040 to +1.640683 °C**. The original final ranges exactly match the accepted three-reading inquiry in the same runtime. The readings, geometry, forcing, material declarations and initial states have not been changed to produce the earlier result. These are authored model controls, not field observations or validated physical effects.

## Scope of the calculation

One four-bin early sky profile and one four-bin late profile are shared by all three receivers, both designs and every original interval. The user supplies one internal original interval boundary. The same three original final bands constrain this entire profile family.

The inquiry retains the original initial state and each original interval end. It does not add a sample, interpolate, move a boundary, search for a continuous-time peak or infer an observed change time. Original UTC and elapsed source minutes remain separate from the thermal evaluator's accumulated interval minutes. Partial last intervals retain their exact supplied endpoint. The adapter looks up the maintained evaluator's actual accumulated endpoints, rather than selecting a nearby time.

For receiver `r`, time `t`, design/geometry endpoint and pair of early/late bins `(i,j)`, the represented additive coefficient is computed exactly from the three original binary64 values:

```text
A[r,t,i,j] = C[r,t,i,0] + C[r,t,0,j] - C[r,t,0,0]
```

All sixteen complete original pair courses at all three receivers execute before any observation compatibility screen. Every original interval end is checked against this additive representation. A discrepancy above the declared `1e-9 °C` consistency screen refuses the entire inquiry. This numerical screen is not an every-profile error certificate or a physical error bound.

The existing exact three-band simplex intersection supplies the feasible family at the final time. Each earlier paired consequence is then a linear objective over that same family. Its extrema use exact rational arithmetic over the represented coefficients. Existing design upper/lower endpoints remain in the paired subtraction: the lower consequence uses proposal lower minus existing upper, and the upper consequence uses proposal upper minus existing lower.

## Pointwise bounds and whole profiles

Every original time has a separate surface and lower-store range. Different extrema can be attained at different profiles; the collection of bound values is not asserted to be one attainable course. This qualification does not imply that every example has conflicting minimizing profiles. In the authored control, independent review found a supplied profile that attains all seventeen surface minima.

Every displayed extreme retains its actual candidate identity. The consumer selects witnesses by identity, including noncontiguous IDs. One exact pair of normalized marginal profiles is recovered for each retained witness and checked for exact additive marginal-product equivalence at every retained time. The same profiles are then replayed numerically through all original intervals for all three receivers, both designs and both endpoints. Original replay values, discrepancies and final-band statuses remain separate; an outside-band numerical endpoint is never relabeled as inside because the additive witness is feasible.

Green plot whiskers show each pointwise range. Orange markers show the selected profile's paired endpoint values at the same original times. No line between times is drawn. Narrow ranges can be smaller than the markers, so selected-time values, full tables and exact fractions remain available. Time inspection and witness selection do not recompute the inquiry.

## Input custody and lifecycle

Users can open three original reading-input files or reuse the original readings and shared-condition statement from a saved three-reading boundary inquiry. Reusing that inquiry does not choose the new course boundary. Each original reading keeps its own history, receiver, band and declarations. Any of the three points can become the comparison point through an explicit selection.

The new saved format is `experimental-earth/three-receiver-original-boundary-course-inputs/1`. It contains only `kind`, the exact model declaration, the three original `readings`, and the explicit `query`. Reopen recomputes the complete result. Saved reports, changed model fields, extra query fields, sparse direct-API input arrays and mismatched original sources refuse. The combined original input allowance is 5 MB.

The consumer owns one computation worker at a time. New inputs retire old workers and pending file reads. Detached controls from an older accepted result cannot change a later result. Failed incoming files preserve the prior accepted inquiry; editing the current query invalidates its prior result. Export stays disabled while input or computation is pending. No working-project storage is changed.

## Complete work admission

For `I` original intervals and `K = I + 1` retained times, the query admits the complete work before execution:

| Work | Bound |
| --- | --- |
| Original intervals / retained times | 24 / 25 |
| Complete basis thermal courses | 192 |
| Distinct extremal profile witnesses | `4K`, at most 100 |
| Witness thermal courses | `48K`, at most 1,200 |
| Total thermal courses | `192 + 48K`, at most 1,392 |
| Total course intervals | 33,408 |
| Three-band candidate capacity | 22,016 |
| Additional static candidate reservation | 192 |
| Range-scan mixture terms | 17,612,800 |
| Receiver/time witness rows | 7,500 |

The mixture-term counter describes the bounded range scan, not every rational operation in the solver. Geometry work is shared across the three original receivers under the maintained 16-million-check limit. All three bases still complete when the final family is incompatible. Such a result retains the original times with no invented ranges or witnesses.

## Qualification and numerical runtime distinction

The receiving record is `docs/receiving/shade-heat-original-course-52d429.json`.

Qualification includes eight new core native groups; three source/display native groups; the maintained 34 groups for the two-reading, boundary and three-reading public paths; four unfamiliar original courses with 176 endpoint states checked against the unchanged thermal evaluator; 68 independent exact primal/dual certificates for the authored Node course; and another 68 for Chromium's changed-comparison-point course.

Chromium and Node produced a maximum `3.552713678800501e-15 °C` difference in that changed-point course. Their same 78-vertex family selected five versus six distinct extreme witnesses. The original source records and order were exactly equal. Both outputs are exact for their own represented coefficients; the independent Chromium certificates establish its extrema directly from its own raw original pair values. The browser test binds every displayed value and witness exactly to the actual worker report, while keeping the separate cross-runtime numerical comparison explicit. It does not assert bit-identical thermal coefficients across numerical runtimes.

The actual browser course exercises the maintained launcher and active Linux sandbox, source-only download and fresh reopen, all 68 extrema controls, keyboard inspection, comparison-point changes, prior-inquiry intake, malformed sources, delayed files, a held older worker result, incompatible outcomes and 390px layout. Three earlier counter-mismatch diagnostic runs are retained as failures, not counted as completed browser qualifications.

Run the maintained native controls with a runtime supporting the repository's Node test options:

```sh
node --test --test-isolation=none tests/shade-heat-course-evidence.test.mjs tests/shade-heat-course-inputs.test.mjs
node --test --test-isolation=none tests/shade-heat-epoch-evidence.test.mjs tests/shade-heat-boundary-evidence.test.mjs tests/shade-heat-profile-three-bands.test.mjs tests/shade-heat-third-receiver.test.mjs
CHROME_BIN=/path/to/chrome node tests/shade-heat-course-evidence.browser.mjs
```

The standalone surface extends the accepted three-reading experience. It does not replace the working project, alter the existing two-reading formats, claim deployment, or broaden any held publication action.
