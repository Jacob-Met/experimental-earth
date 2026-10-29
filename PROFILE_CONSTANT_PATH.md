# Constant incoming-profile propagation

When every incoming profile spans exactly the complete graph interval, both profile transports now sum incoming rates in their existing order once and run the same one constant-node interval. This avoids constructing and sorting redundant breakpoints and scanning the same profiles again. Empty incoming sets use the same rain-only case. If any profile has a different start or end, the original complete breakpoint path remains active. No time tolerance, merging of partial pulses, source/model default, receiver transition, or physical equation changes.

The constant rate preserves the previous arithmetic association: sum incoming rates from zero, then add rain. All exact-output receiving compares complete model or graph returns. Work accounting intentionally changes: the detection scan is charged once; constant inputs avoid breakpoint and repeated profile-scan charges. Varying inputs pay an additional detection scan before the existing path. Some prior budget refusals can therefore become successes, and varying inputs can require more work. This is not identical-budget semantic parity or a universal speed claim. Event population and total work limits remain enforced.

## Evidence

Six courtyard model courses (5, 2 and 1 minute, finite/nonfinite receiver) retain exact full numerical outputs. Charged work decreases approximately21–28%. A deterministic held course compares160 full graph results, including changed edge ordering and finite receiver states. The pulse control still yields0.1 uptake and0.9 exit; it cannot enter the constant shortcut.

Actual mixed refinement retains exact full plan values: nine layouts2→1minute decrease combined work2,414,652→1,771,680; nineteen layouts4→2minutes decrease2,229,863→1,694,353. Nineteen layouts2→1minute still refuse3M. These are conditional numerical comparisons, not field validation or convergence evidence.

Run existing profile/finite native tests. Run `PROFILE_CONSTANT_BASELINE_ROOT=/path/to/0982ad2 node tests/constant-receive.mjs` and `PROFILE_CONSTANT_BASELINE_ROOT=/path/to/0982ad2 node tests/constant-capacity-receive.mjs` for matched consumer/parity and retained refusal. The full maintained browser harness records every served JS/CSS hash and refuses missing assets. Independent Language source review cleared the two transport changes; execution evidence is recorded separately.
