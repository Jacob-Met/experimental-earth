# Original measured-change comparison

The main Rain Lab includes **Did the measured change differ from another place?**.
Use the fictional comparison button to inspect the JSON input format, then supply
four original bounded observations: treated/comparison places before/after.
All four measure the same declared quantity in exactly the same units. Before
and after are explicit valid UTC timestamps, shared by the two places.

The comparison computes treated after minus before, comparison after minus before,
and the difference between those changes. It retains each original source, place,
time and interval. The entered association explains why observations describe
comparable quantities; the separate parallel-change statement describes the
counterfactual assumption. Neither is verified by matching labels or timestamps.

The fictional temperature control warms at the treated place by 2–6°C and at the
comparison place by 6–10°C. Their contrast is −8–0°C. Warming alone therefore
cannot establish a harmful intervention effect. This example is authored, not
field evidence. The contrast is descriptive interval arithmetic, not causal
identification, a statistical test or a confidence interval. Four observations
cannot establish parallel trends, absence of confounding, spatial comparability,
or independent measurement errors.

The interval calculation takes the extrema over all combinations permitted by
the four original bounds. Correlated/shared sensor error is not inferred. A
64ε-scaled arithmetic guard withholds strict sign classification near zero;
it does not widen original measurement bounds or certify physical uncertainty.

**Download original investigation** captures the complete original workspace and
four readings, without derived verdicts. **Reopen original investigation** validates
and recomputes these inputs independently, leaving the current workspace intact.
The original context is displayed by name; no location or model parameter is
adopted. Workspace or draft changes retire the result. Ordinary project export
does not include the temporary investigation. Files may contain original source
or site information, use the maintained4MiB project transfer limit, and remain local.

Validation: `node --test tests/measured-change.test.mjs` exercises authored changes,
1000 independently enumerated16-corner interval controls, wrong association/unit/
time/source refusal, input immutability and source-only roundtrip recomputation.
Actual browser receiving and independent review remain required before delivery.

Qualified local receiving: five actual maintained-app browser groups passed with
sandboxed Chrome156 under unprivileged nobody: keyboard comparison, downloaded
originals, independent reopen preserving a newer active workspace, failed input
retirement, and1280/390px panel fit. The390px screenshot was visually inspected.
Independent SECOND GROUND review found no blocker; its requested floating-point
endpoint wording is included. These are authored software controls, not field
validation. Run `node tests/measured-change.browser.mjs` with PLAYWRIGHT_MODULE,
BROWSER_EXECUTABLE_PATH and BROWSER_ARTIFACT_DIR pointing to approved local tools.
