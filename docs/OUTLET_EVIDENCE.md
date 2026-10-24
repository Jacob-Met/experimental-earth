# Collected-runoff evidence

The workbench can compare independently supplied collected volumes with its modeled total boundary outflow. Use **Which outlet assumptions explain the collected water?** in the normal Rain Lab.

1. Declare the observed scenario, event reference and collection arrangement. Confirm that the volume represents **every modeled boundary exit**. The model cannot compare a single drain or partial collection to its total.
2. Enter the collection start and end in minutes since the event began, the volume and its stated tolerance, units (`L`, `mL` or `m3`), and a reading source. Choose notebook-only, calibration or held-aside deliberately.
3. Compare 2–9 explicit outlet coefficients from 0 to 10 per hour. Calibration root-mean-square volume error orders the finite candidates. Held-aside readings can contradict them, but cannot change that order. All candidates remain visible; no coefficient is automatically adopted.
4. Inspect each signed residual and the solver snapshots used at both interval endpoints. Export the ordinary site project to retain the record, including original units, roles and source context. Browser reload retains it locally; comparison results are recomputed.

## What the calculation means

`runRain` already retains cumulative edge-exit liters. This consumer evaluates that cumulative series at the collection start and end, then subtracts the values. Off-step endpoints use linear interpolation between retained snapshots, with both brackets displayed. It does not multiply an instantaneous rate by the interval or silently snap a measurement to a model time.

Candidate coefficients change only the model's `boundaryExitPerHour`. Existing geometry, surface capacities, rain, lateral mobility and collection interval stay fixed. The simplified outlet model includes its existing exterior-stage assumption; a coefficient that matches a volume is not a measured pipe capacity or a unique physical explanation.

The first retained reading binds the record to the observed scenario, source-attributed geometry and weather. Editing the other scenario or a project title does not invalidate that record. Editing the observed site or weather preserves the readings and their original context, but refuses comparisons and new readings against the changed event. The numerical interval can be varied explicitly, and the tested outlet coefficient is not part of the binding. Export/reopen the original project to recover its complete state. A new-event preparation workflow must clear/archive `outletEvidence` rather than carry it into a new observed event. Removing the last collection releases that record's identity.

The binding is a canonical serialized context, not a signature or independent authentication of source claims. Attribution, coverage and evidence roles are supplied by the user. Assigning a held-aside role does not establish independent or prospective collection. Candidate lists and roles remain editable; using a result to choose candidates makes it part of fitting, even if its label is later changed. Notebook-only readings are excluded from scores. All calibration bands must be satisfied for compatibility; the nearest candidate is still rejected if it falls outside any band. No statistical probability or confidence interval is produced. Overlapping intervals are correlated, and the unweighted RMSE is only an ordering score in liters; intervals of different sizes can affect that score differently.

## Limits and evidence

At most 80 readings and 9 candidates are admitted. Interactive comparisons above two million estimated candidate cell-steps refuse before running the solver. All volume conversions, intervals, sources, candidate ranges and evidence roles are checked on ordinary project import. Failed operations preserve the accepted project.

The independent arithmetic control uses four flat 1 m² sealed cells with no lateral flow, 61 mm/hour rain, 1 mm/hour infiltration and two exterior sides per cell. With 30-minute steps and outlet coefficient 0.1/hour, the first collection is 16 L and the second is 26.4 L. At 0.2/hour these become 32 L and 49.6 L. These are authored controls, not field observations. Tests retain the contradictory second interval, the dry-event ambiguity, changed-event refusal, off-step interpolation, equivalent unit conversions and oversized-work refusal.

Run the maintained native tests with `npm test`; on runtimes where isolated reports only expose file totals, `node --test --test-isolation=none tests/*.test.mjs` prints each named case. The existing `npm run browser-receive` now includes actual form entry, candidate comparison, project download/import, reload, changed-storm refusal, invalid partial-collection import and a 390px layout check through the maintained browser session owner.

This is a conceptual-model evidence consumer. No real runoff dataset, environmental forecast, field calibration, Nebius execution or physical intervention is established by these controls.
