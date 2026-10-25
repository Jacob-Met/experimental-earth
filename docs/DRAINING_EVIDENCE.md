# Challenge storage and drainage with original ponding readings

Inside **Can drainage keep receiving space available?**, the evidence section
compares explicitly offered receiving explanations with the original notebook.
Use the current source and declared layer, add at least one distinct alternative,
choose the observed scenario and surface, then compare. Each alternative has a
total storage, initial retained water, drainage coefficient and attributed source
or hypothetical basis. The source's surface infiltration rates remain fixed.

The comparison evaluates both unchanged original maps once per explanation. It
reuses the selected scenario's run for every assigned point reading. Only rows
whose original scenario and role match the declaration participate; other rows
remain in the source and their excluded count is visible. Calibration bands admit
explanations. Held-aside bands can contradict those explanations but cannot change
their parameters, calibration results, ordering or modeled consequences. All
offered alternatives stay visible, including every rejected alternative.

## A reading can distinguish mechanisms only when their courses differ

The fictional example uses the independently calculated four-cell bed described
in [the draining-layer model](DRAINING_LAYER.md). A 5 mm initially empty store
with drainage coefficient 1/hour accepts `5 + 19 ln(24/19)` mm by hour one. A
closed store of exactly that capacity accepts the same amount. Both therefore
have surface depth `36 - (5 + 19 ln(24/19)) = 26.561317827551402` mm at minute60.
An early ±0.1 mm band admits both explanations.

At minute180, the draining layer has admitted another 10 mm while the closed
store has no additional room. The separately assigned authored late band around
16.561317827551402 mm rejects the closed explanation. Changing only that late
reading to the early depth instead retains the closed explanation. Calibration
support and every modeled consequence remain unchanged in both investigations.
These are authored analytic controls, not acquired field measurements.

## Read support and consequences together

Every row shows original values, uncertainty bands, sources, predicted values and
retained interpolation brackets for both evidence roles. No calibration means no
supported explanation. No held-aside readings means no explanation is labeled as
surviving both roles. A completely contradicted set stays empty; the closest fit
is never substituted. An absent receiving surface in the observed scenario is
reported explicitly and cannot acquire support from unrelated cells.

The consequence sections separately show all offered, calibration-compatible and
both-role-compatible alternatives. Each range spans only those discrete offered
rows. It is neither a continuous parameter envelope nor a confidence interval.
The proposed-minus-existing changes use the same hypothesis without fitting the
proposed layout to the original evidence. Surface boundary outflow, retained
below-ground water and subsurface drainage remain distinct quantities.

The original evaluator uses piecewise-linear interpolation between retained
solver snapshots and a scale-relative 1e-9 rounding guard in band comparisons.
That engineering tolerance is not added measurement uncertainty. Time steps,
fixed infiltration capacities, initial conditions and all limitations of the
declared receiver and horizontal routing remain assumptions. Agreement does not
establish soil calibration, environmental accuracy or a physical recommendation.

## Original-input custody and bounded work

Saving writes only `schema`, the complete original `project`, and `study`. It
does not save findings. Reopening recomputes from those original inputs without
replacing the active project; a separately reopened investigation stays independent
of active-site edits. Changes to a current source or draft retire its results and
save control. A delayed original-file read cannot revive a retired result or
overwrite a newer draft; the picker can retry the same original after retirement.

The study admits 2–12 distinct parameter triples with unique IDs and explicit
labels/bases. The complete two-map calculation is bounded at one million
cell-steps before any simulation; the original file is limited to 5 MiB. These
are computational limits, not physical support bounds. The original three-model
declaration comparison remains available alongside the evidence investigation.

## Verification

`node --test tests/draining-layer-evidence.test.mjs` covers independent analytic
ambiguity and late separation, held-aside independence, missing roles, complete
contradiction, original target scope, source-only replay, permutation, malformed
declarations and complete work refusal. It runs with the unchanged receiving-layer
regressions. The actual maintained application course is
`node tests/draining-evidence.receiving.mjs`, using the existing same-browser
sandbox harness. It receives real downloads/fresh uploads, original-site custody,
changed held-aside files, zero survivors, malformed and delayed files, source
retirement and asserted desktop/390px result viewports. Native and browser
qualification must be recorded against the exact published source before merge.
