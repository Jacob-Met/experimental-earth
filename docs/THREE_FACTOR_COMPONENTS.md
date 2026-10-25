# Surface, elevation and edge interactions

In **Which parts of the proposal work together?**, choose **Surface, elevation and internal edges separately**. The proposal must change all three physical factors, which may share a cell. Select **Compare eight combinations** to inspect:

- S: proposed surface materials.
- G: proposed ground elevations with their original terrain records.
- E: proposed internal walls, openings and finite absolute crests.

Every combination uses the same original storm. The existing and full worlds reproduce the original plans' modeled physical settings; the six intermediate worlds are explicit hypothetical combinations. Source-label-only changes do not create factors. Crest elevations remain absolute in the original datum, so a ground change can alter whether a fixed crest obstructs water. The calculation does not alter either source plan or infer observations for mixed worlds.

## Read the contrasts

The first table retains all eight world values for each maintained site metric. The second reports the three single-factor changes, three pair interactions and the three-way term. Their sum equals the full proposal change. For a quantity Y:

`S = Y(S) − Y(existing)`

`S×G = Y(SG) − Y(S) − Y(G) + Y(existing)`

`S×G×E = Y(SGE) − Y(SG) − Y(SE) − Y(GE) + Y(S) + Y(G) + Y(E) − Y(existing)`

The third table makes the last term concrete: compare each pair interaction with the third factor absent and present. Their difference is the three-way term. For example, a planting/lowering interaction can change when an internal wall is also included.

These are model contrasts. A negative term means a lower modeled quantity relative to the specified sum, whose desirability depends on the quantity. Maximum depth and peak standing water can change maximizing location or time across worlds. Their interactions do not independently establish physical water exchange, causal identification, or safety.

## Keep source hypotheses fixed

The existing hypothesis selector supports all saved rates, calibration-compatible rates and rates compatible with calibration plus held-aside observations. Numeric-depth evidence is evaluated once on its unchanged original scenario. Each retained rate is then used in all eight worlds. The dropdown exposes every retained rate's complete tables; an expandable summary retains every rate's three-way term. No selected rate is adopted. Finite alternatives are not statistical confidence intervals.

The complete work preflight conservatively budgets nine simulations per offered rate (one original evidence pass and eight worlds), including rates later rejected. Missing or incompatible evidence produces an explicit uncomputed result. The comparison never substitutes a best fit. The ordinary one-million estimated cell-step limit remains.

## Reproducible authored comparison

Start with the courtyard example, copy existing to proposal, change D4 to garden, lower D4 by5cm and close its east edge. The default three-way storage term is approximately−0.343059L; the maximum-cell-depth three-way term is−4.261170mm. The full maximum cell depth is63.132789mm.

With explicitly offered sealed-surface rates9 and22mm/h, the three-way storage term is respectively−20.698994L and+11.091164L. This reversal is an authored solver control, not field evidence or an inference that either rate is physically correct. At40mm/h the term is zero in this control; a third factor does not automatically introduce a nonzero interaction.

Ordinary project export/reopen preserves the source plans and original study. Results are temporary: choose the three-factor mode and recompute after reopening. Edits invalidate displayed results. Existing cell-group, surface/elevation and edge/ground modes remain available.

## Qualification

`node tests/proposal-factorial.test.mjs` independently assembles all eight worlds across40 authored2×2 terrain families, checks1,400 alternating-subset contrasts, all balances and original-source custody, and tests challenge-value independence, zero lateral transfer, missing factors, source-only changes, malformed edges and complete-work refusal.

`CHROME_BIN=/opt/google/chrome/chrome node tests/proposal-factorial.receiving.mjs` exercises the actual maintained browser with sandbox admission, authored source-file import, keyboard mode/rate selection, every table, a numerical full-world control, missing-evidence refusal, original-source persistence/reopen and desktop/narrow screenshots. Browser execution and current-main integration are separately required before qualification.

## Current-source qualification

Composed on `2fa5cff6f02a753ba2b52695f2648be36dc5485e`, retaining all17 upstream runtime/test changes since the first component merge. All955 native tests pass; the actual eight-world browser course passes11 groups with observed Chromium namespace/PID/network/Seccomp/TSYNC protections, zero app exceptions and390px document width. Both earlier component browser courses also passed11 groups each. Independent WORLDLAW review checked the eight-world/source algebra and1,400 subset controls. The only later changes were the visible table-scroll hint and a bounded receiver mount wait replacing a flaky fixed sleep.

Initial incomplete-runtime and constrained-subprocess failures were not counted as passes. Canonical vendor/evaluation/example/research sources were restored and verified; process-capable execution of the complete native suite passed. Local receiving Git metadata is labelled as a local composition, never as upstream history. This is model/software qualification, not field validation, physical access certification or deployment.
