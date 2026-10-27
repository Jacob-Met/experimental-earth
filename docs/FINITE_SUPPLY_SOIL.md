# Investigate a finite water-delivery soil test

Open `ponded-uptake.html` and use “What if the soil test runs short of water?”. Import an original ponded uptake study, then explicitly declare the separate test reference, original soil-state and nominal-area reuse, initial surface water, complete piecewise-constant incoming water rates, and no-other-loss assumption with its source. Enter original surface-inventory readings and their measurement bounds. An ordinary ponded study import does not invent these declarations. The example is fictional.

## Decision supported

Compare whether the original soil explanations remain compatible with the observed surface inventory under the declared delivery course. The unchanged `advanceWettingFront` kernel carries cumulative infiltration and surface water across all delivery boundaries and reading times. It never resets infiltration after a dry gap. Each candidate reports incoming, infiltrated and remaining water and its accounting residual. Original ponded calibration order and exclusion remain unchanged; the new observations are held aside. A compatible surface reading alone does not resolve an original calibration boundary.

Delivery timing matters. With K=10 mm/h and A=30 mm, the same 30 mm delivered over an hour leaves about 2.807 mm at the surface under uniform delivery, zero when delivered in the first half, and 10.364 mm when delivered in the last half. Under only 5 mm/h supply, both the constant K=10 and wetting-front explanations remain dry. Equal dry readings in this example cannot identify the soil mechanism.

## Source and limits

Rates are supplied as L/h or mL/h; surface inventories and reading bounds as L or mL. The original nominal area converts these to the maintained kernel's depth units. Delivery segments cover the complete course from zero and reading times must lie within it. Initial inventory and delivery are declared nominal quantities, not an interval uncertainty analysis. Only surface reading measurement bounds are compared. Positive conversion underflow and unsupported kernel inputs are refused. The complete course is bounded to 64 segments, 100 readings and 1,500 candidate/time advances.

This is a local model comparison under explicit assumptions. It does not infer evaporation, lateral losses, varying ponding-head effects, redistribution or drying-state resets. Wet/dry labels apply only at retained times; chart lines connect samples and do not certify continuous ponding. Arithmetic allowances are engineering guards, not formal numerical certification or physical model error bounds. No parameter, calibration or site state is adopted.

Save retains original source only. Reopening recomputes it; forged derived histories are ignored. Any input edit retires the result and export, and a delayed file read cannot overwrite newer declarations.

## Receiving

Nine focused native controls cover timing, supply-limited ambiguity, distinguishing readings, accounting, equal-rate segmentation, carried state, unchanged calibration, source-only replay and refusal. Eight actual-browser groups cover original intake, authored result, keyboard timing edits, low-supply ambiguity, save/reopen, missing assumptions, stale file completion and desktop/narrow rendering. The first browser attempt failed only its overbroad result-text count; the corrected receiver and successful receipt are retained separately. No full-repository gate or field validation is claimed.
