# Compare two numerical methods against unchanged original readings

Issue #155. This is a **read-only experimental evidence challenge**. It does
not choose the correct model, retune sources, alter the Rain Lab UI, or replace
the production solver. It tests how **one exact collection of original readings**
is interpreted under the maintained frozen-head donor-capped flow and an
independently recomputed conservative two-substep method.

Run from the repository root with Node 20+:

    node evaluation/reading-methods.mjs evaluation/fixtures/method-readings.json > source-reading-methods.json
    node evaluation/reading-methods.mjs path/to/your-saved-export.json > project-reading-methods.json
    node --test tests/reading-methods.test.mjs

An ordinary site JSON export must include a valid retained infiltrationStudy
with 2–9 explicitly chosen surface-rate hypotheses and at least one
observations reading marked scenario equal to the study target, use=calibration.
Explicitly marked challenge readings in the **same original target** are used
solely for held-aside checks, never for ranking. Unassigned/other-scenario
observations remain included in the raw-source receipt but cannot alter the
compared model ranking. Changed source input requires a new computation. The
exact full input file SHA-256 and Git revision accompany the output. Invalid and
larger than 4 MiB sources are refused, as are more than 1.5 million estimated
cell-step studies.

For every rate in the **same original study**, both methods run on exactly the
same original target terrain, constant rainfall, duration and outer solver step.
Both use the existing interpolation and tolerance/band matching, retaining
original reading indices, methods, declared uncertainties and complete source
strings. The JSON output includes the two methods' **separately evaluated**
calibration ranks, compatible and surviving rates, every residual and original
reading, and method-dependent band changes. Calculations do not write project
files or observations.

## Authored model-only demonstration

The fixture evaluation/fixtures/method-readings.json retains the 2x2
changed-step terrain with one synthetic calibration depth deliberately generated
from the maintained method at rate 24 mm/h, **not an independent field reading**.
For its original target cell 2 at model minute 20, the same synthetic 14.889793
mm reading with +/-0.1 mm supports the maintained method's 14.889793 mm
prediction but **does not** support the alternative's 16.201186 mm prediction.
At cell 3 minute 15 the separately designated synthetic held-aside 1.210655 mm
reading +/-0.12 mm agrees with the maintained method and disagrees with the
alternative's 0.643745 mm prediction. Both retain the exact same source
hypotheses, rainfall and original reading identities. The altered grade in
the proposal is *not* used to recalibrate original existing-site readings.

The rank list for this fixture remains 24, 9, 1 under **both** methods, but
the first method admits 24 mm/h as the sole surviving hypothesis while the
second rejects all rates on calibration. This is expected from deliberately
method-generated readings; it **does not** establish which method better
predicts real rain or which is a justified soil model. The ability to reveal
that distinction before treating a numerical advantage as empirical evidence
is the point.

Original multi-source measurements, external model validation, unmodeled
physics, wetting-front dynamics, rain-origin tracing and full browser UI
adoption remain separate scopes. The CLI gives an actual native receiving
surface, not a claim that the browser's selected-study panel uses the
experimental alternative.
