# Proposals from original receiving-layer calibration

The receiving evidence panel can derive editable layer proposals from two calibration depths at the same original cell: one at storm end and one later retained calculation time. Confirm an initially empty receiving layer and record the basis. The unchanged source must declare zero lateral mobility and boundary outflow, rain above the fixed surface intake rate, and a dry period after rain.

For each original calibration pair, the central-depth inverse assumes the store fills strictly inside the storm and surface ponding persists through the later reading. It recovers a capacity and drainage coefficient, then runs the maintained source model and checks **every** original calibration and held-aside band. Held-aside values never generate or rank proposals. Unsupported regimes and contradictory calibration remain explicit.

All pairs are considered before running; more than 128 pairs or one million complete source cell-steps refuses the whole search. Repeated identical parameter triples share their original pair references. No derived value replaces an observation. These are central-value starting proposals, not complete parameter regions within the bands, certified numerical bounds, or physical identification.

Adding a calibration-compatible proposal is explicit. It appends an editable explanation while retaining existing rows. The explanation source records the original calibration row references and the declared initially empty basis. Existing input-only evidence download/reopen retains that explanation and all original observations; no cached success is trusted.

## Inverse

Let the storm last T hours, the later calibration be at t>T, rain rate R exceed surface intake f, and positive surface depths be H at T and L at t. Under the stated regime, full-store intake q=(H-L)/(t-T), entered water A=RT-H, and filling time u=(A-qT)/(f-q). Require 0<=q<f and 0<u<T. For q>0, k=-log(1-q/f)/u and C=q/k. For q=0, k=0 and C=A. Zero-capacity and never-filled degeneracies refuse rather than inventing unique parameters.

The pure inverse is checked against the maintained forward kernel for (C,k)=(5,1),(8,.5),(5,0),(20,.1),(1,4). The original one-calibration example refuses proposal generation; its held-aside row is not silently reclassified. See tests/receiving-proposal.test.mjs. Browser and published-source qualification must be recorded separately after actual execution.

The initially empty assumption is essential: a different capacity, drainage rate and initial store can produce the same surface history under this model. Surface readings alone do not generally identify all three. This proposal conditions on the declared initial state; it does not establish a unique physical layer.
