# Separate internal edges from ground edits

In **Which parts of the proposal work together?**, choose **Internal edges versus surface and elevation edits**. Component A applies proposed internal walls, openings and finite absolute crests to the existing ground. Component B applies proposed surfaces and elevations while retaining existing internal edges. The full case remains the exact proposal. Both components can affect the same cell.

This answers whether a proposed garden or depression has the same modeled consequence when the proposed edge change is absent. The ordinary cell partition cannot isolate these factors when the same canonical cell owns both. Edge labels identify the west/north owner cell, not an entire barrier footprint. Heights and supplied terrain records stay together. Crest elevations remain absolute in the declared datum; changing adjacent ground can change whether the crest obstructs water.

Choose default surface capacities or the existing finite infiltration hypothesis modes. Original numeric-depth evidence is evaluated on its unchanged source before constructing any mixed world. No observations are inferred for the combinations. All existing evidence refusals and whole-experiment work limits apply.

For a reproducible authored control, start from the example, copy existing to proposal, change D4 to garden, lower D4 by 5 cm, and close its east edge. The final-storage changes are approximately −0.015584 L for edges alone, −249.994241 L for ground alone, and −253.381565 L for both. The interaction is −3.371740 L. The maximum-cell-depth effects are approximately +0.000836, +25.792289 and +19.749990 mm respectively, giving −6.043135 mm interaction. These quantities have different maximizing locations/times and do not imply physical causal identification or safety.

The project and source declarations remain unchanged. Ordinary project export/reopen preserves the two plans; select the partition and recompute after reopening. Source-label-only edge differences do not create a physical factor. Both a physical internal-edge change and a ground/surface change are required.

Run `node --test tests/edges-ground.test.mjs tests/surface-elevation.test.mjs tests/proposal-components.test.mjs` for independent world assembly, opening removal, finite crests, unchanged sources, missing-factor refusals and hypothesis propagation. Browser receiving is separately required before integration qualification.

## Executed receiving, 25 October 2026

Candidate based on upstream `6fe0bb439ba48906f72e4b0e00adc8d9e6f4fd5b`: all 909 maintained native tests passed, including the 5 new direct groups. Both the new edge/ground and existing surface/elevation actual browser courses passed 11 groups each in Chrome 156.0.8078.47. Namespace, PID/network namespaces and seccomp protections were observed before navigation. Desktop and 390 px screenshots were inspected; the existing metric table scrolls within the panel.

Commands: `npm test`; `CHROME_BIN=/opt/google/chrome/chrome node tests/edges-ground.receiving.mjs`; `CHROME_BIN=/opt/google/chrome/chrome node tests/surface-elevation.receiving.mjs`.

An initial tarball-only native run passed 908 tests and failed the unrelated original-file CLI test because `git rev-parse HEAD` had no repository metadata. Creating an explicitly labelled local receiving-snapshot commit in that private checkout resolved the environment requirement; all 909 then passed. The local receiving commit is not represented as the upstream commit. No failing product condition was counted as a pass. Independent WORLDLAW review found no blocking issue and reran the focused tests. Exact published/current-main receiving is recorded in the native PR.
