# Compare a local soil test with separate water batches

Open the main workbench's standing-water investigation, then **compare a batch-water course**. The local page also opens directly at `pressure-batches.html` through the maintained local server.

This course extends the explicit surface-pressure hypothesis into separately timed, ideal instantaneous water additions. It reuses `advancePressureHead` without changing its hydraulic equation or limits. It is independent of spatial initial-ponding, variable-rainfall and continuous finite-delivery consumers.

## Original inputs

Declare one fixed test area and its source, the initial surface inventory, the complete batch list and its times, and an explicit no-other-supply/no-other-loss assumption. Each addition retains its original L or mL amount and source. An instantaneous addition is an assumption, not something inferred from a sparse timestamp. Actual finite pouring, unrecorded replenishment, overflow or leakage needs another protocol.

Each offered explanation includes K, A, moisture deficit, initial cumulative infiltration and its source. A alone cannot identify moisture deficit. A zero deficit selects the existing head-neglected mathematical control; nonzero A with zero deficit is not a physical zero-deficit inference. Dry intervals preserve the accumulated front and do not implement redistribution or soil recovery.

Original surface-inventory readings retain quantity, unit, declared uncertainty, source and calibration/challenge role. At an addition time, the record must explicitly say before or after. At other times it must say no-addition. Additions have strictly increasing distinct times; the consumer does not sort or combine simultaneous source records. Multiple original readings at the same time and phase remain separate.

Zero readings is a prediction-only course. Challenge-only readings never become calibration evidence. Calibration RMSE alone determines the displayed ordering, and every offered alternative remains available. A result near a closed band edge remains a numerical-boundary result, separately from measurement uncertainty. A closest fit can still be contradicted.

## State and observation semantics

Between batches, the maintained kernel advances F and W with zero rain. At a declared addition P, F is unchanged and W increases by P. These states are separately recorded before and after the jump. The whole-course water account includes only batches already applied by that phase.

Only actual batch boundaries advance the carried state. Original reading queries and chart samples are independently evaluated from the latest batch origin. Adding or changing a held-aside time therefore cannot alter the arithmetic path used for later calibration predictions. Chart joins are sampled model trajectories; original observations remain distinct markers and bands.

Input-only download/reopen retains the complete source and declarations and recomputes results. Unknown fields, versions and saved conclusions refuse. An invalid replacement leaves the previous accepted view intact; editing the draft retires its result and export. A delayed file read cannot overwrite a newer accepted input or a subsequent edit. The main site is never adopted or modified.

## Why a batch protocol was needed

The source investigation preserved the original SWIG archive (DOI [10.1594/PANGAEA.885492](https://doi.pangaea.de/10.1594/PANGAEA.885492), SHA256 `4446a24ec076ba9f4acca3c9e02c40aae550b00e55f94a0cc9d85fa9754fa9c2`). Its pressure/tension field does not establish one global signed boundary convention. The source workbook and metadata were inspected without changing values or filling missing fields.

The original methods of [Votrubova et al. (2017), Experimental methods](https://doi.org/10.1515/johh-2017-0015) describe replenishing the ring in separate batches when the surface returns to a marked level. Such a course is not a single closed falling pool, nor does a batch timestamp define a continuous delivery rate. The corresponding compiled head values and source protocol also leave unresolved unit and run-specific history questions. No conversion, refill history, initial moisture or measurement uncertainty was invented to make a field comparison possible.

Those records motivated this new explicit protocol capability. They do not physically validate it. No source dataset or original media is distributed by this change. The supplied browser example is labeled an authored mathematical endpoint control, including its fictional readings and uncertainty.

## Bounds and verification

The contract admits 2–9 distinct explanations, 1–64 additions at distinct times and 0–100 original readings, over a positive duration through 720 minutes and an area from 0.0001 to 100 m². The original K ≤ 2000 mm/h, A ≤ 5000 mm, deficit ≤ 1 and state-depth ≤ 1e9 mm bounds remain. Complete supply and front bounds are admitted before simulation. All sampling and comparison work is bounded to 2200 kernel advances. Saved inputs are limited to 220000 UTF-8 bytes. Serialization is admitted before an imported course replaces any accepted editor or result state.

`tests/pressure-batches-oracle.test.mjs` independently compares the new API against the beta1 closed form, checks mass and exact jumps, and includes concrete counterexamples to resetting the front or spreading a batch over invented pouring time. It checks exact calibration invariance under changed held-aside times/values and preserves batch states under query insertion.

`tests/pressure-batches.test.mjs` covers original-source roundtrip, L/mL equivalence, prediction/challenge-only behavior, refusal of ambiguous phases or absent assumptions, and nonmutation. Browser receiving must exercise the visible workbench entry, actual input-only download and fresh replay, phase editing, malformed/late files and desktop/mobile results. See the completed receiving receipt for the exact run and source hashes; a test script alone is not receiving evidence.

## Uncertain starting water

The visible initial-water inquiry link opens a separate shared-range check from this course’s original-input download. It requires an explicit starting-water interval and source, retains the nominal starting amount, and requires one common amount for all calibration rows. Held-aside readings challenge the calibrated range separately. See [the initial-water inquiry](pressure-initial-range.md) for the numerical brackets, authored examples and original-source replay boundary.
