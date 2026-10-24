# Challenge joint explanations across observed events

The one-event joint comparison can expose several soil/outlet pairs that satisfy the same observations. A second event can challenge those fixed explanations under different rainfall. This consumer transfers the original pairs and inspects separately supplied evidence; it does not fit a new pair or adopt parameters.

## Prepare the source evidence

In the first event, retain a sourced all-boundary collection, explicitly assigned depth evidence where available, and the saved joint pair set. Calibration evidence must exist. Any first-event held-aside readings continue to apply when the second event is considered.

Prepare a separate ordinary project for the second observed event. Keep the same observed scenario, cell layout, elevations, surfaces, grid scale, mobility assumption and numerical step. Rainfall forcing and duration may differ. Supply a distinct event reference, collection arrangement and original interval quantities. Mark its collection readings and any intended depth readings as held aside. Unassigned readings remain unused. Any calibration-assigned collection or same-scenario depth in the second event is refused, rather than silently relabeled.

The first event's explicit outlet coefficient in each pair overrides both projects' default outlet settings. The comparison therefore permits those unused defaults to differ. This does not infer a changed physical outlet.

## Use the application

1. Open the first project in the ordinary workspace and save its joint pair set.
2. In **Will these explanations survive another storm?**, open the second event's ordinary project. The loaded event and collection source are displayed.
3. Select any second-event held-aside depths that belong to the same event, scenario and minute-zero origin. Supply the source for that association. Every assigned collection reading in the loaded event is included automatically because it is already scoped to its collection record.
4. Explain why the second event is independently held aside, then choose **Compare the unchanged pairs**.
5. Inspect the first calibration, first holdout and second holdout separately. Expand each pair for original quantities, units, sources, predictions, signed residuals and interpolation brackets.
6. Download both events and evidence. Reopening this challenge recomputes from its retained snapshots without replacing the active workspace.

Loading a new second event clears its previous depth association and independence draft. Workspace changes or edited declarations retire the displayed comparison until a fresh comparison is requested. A malformed or retuned saved challenge is refused while the last accepted work remains available. Delayed file reads cannot overwrite newer workspace changes, draft edits or comparisons.

## Interpret the result

Every pair remains in its declared order. First calibration compatibility requires every assigned first-event calibration band. A survivor must also satisfy any first-event holdout and every associated second-event held-aside band. Contradictions cannot cancel across readings or quantities: millimetres and litres are never combined into one score. An absent depth or volume group is unscored.

One remaining pair is only one survivor among these declared finite alternatives. No survivors can indicate unsuitable hypotheses, model limitations, incompatible observations or a mistaken event association. Several survivors mean these observations have not distinguished the tested alternatives. None of these states identifies a unique physical soil or outlet property.

## Reproduce a two-storm control

The [authored two-storm bundle](../examples/joint-two-storms.json) can be reopened directly. It contains a flat four-cell control, not site measurements. Under the maintained model, the first 30-minute volume is 16 L for both pairs `(1 mm/h, 0.1/h)` and `(21 mm/h, 2/15/h)` at 61 mm/h rainfall. The second event has 41 mm/h rainfall, unchanged geometry and fixed pairs.

For the first step of the second event, infiltration leaves 20 mm and 10 mm in each cell respectively. Each corner has two boundary sides. The maintained boundary request is `(depth + 10 mm) × outlet/h × 0.5 h × 2`, capped by available depth. This gives 3 L versus 8/3 L per 1 m² cell, hence 12 L versus 32/3 L across all four cells. The supplied authored 12 L held-aside collection contradicts the second pair. That arithmetic checks the implemented mechanism and units; the boundary law is a simplified model assumption.

The first-event depth exists in the supplied notebook but is not associated in this example, so it does not silently remove either volume-compatible pair. Associating it explicitly would make it part of the first-event holdout.

## Retention and limits

`experimental-earth-joint-event-challenge/1` retains the complete calibration and challenge projects, the independently source-bound second-event depth association, the original pair set and a textual independence declaration. Saved verdicts are ignored. A changed source identity or selected depth snapshot refuses reuse. A retuned or reordered second-event pair set is refused.

An ordinary event import is limited to 1 MB; a combined challenge import/export is limited to 4 MiB. The two-event estimated workload is pair count × cells × the sum of the events' time-step counts. Work above two million cell-steps is refused before simulation. The application prepares the bundle and result together so a normal comparison runs each pair once per event.

Event identity, independence, measurement coverage and acquisition are supplied declarations. A second file or different weather does not establish independent measurement. Soil conditions may change between storms, and correlated or biased readings can agree without validating the model. Transfer assumes the declared fixed site and model hypotheses remain applicable. Physical validity, forecasting accuracy and cloud execution are not established by this workflow.

Run `node --test tests/*.test.mjs` for native controls, including independent second-storm arithmetic, first-calibration invariance, retained first holdouts, missing evidence, role refusal, source/geometry changes, exact pair transfer, bounded work and raw-bundle replay. `tests/browser.receiving.mjs` includes actual imports, downloads, reopening without workspace replacement, delayed real-file controls and normal-scale desktop/390px results.
