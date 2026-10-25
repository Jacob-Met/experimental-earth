# Shared depth-sensor zero

The infiltration workbench can now test whether explicitly associated original readings admit one common additive instrument offset. In **Could one sensor zero explain these depth readings?**, choose the original rows, explain their shared instrument/zero association, and declare a lower and upper offset in millimetres. The selected infiltration study determines the observed site, surface and complete offered rate set.

The equation is `reported depth = modeled depth + offset`. A positive offset means the instrument reports a greater depth. For each original reading, its reported value `y`, supplied half-width `u`, and maintained model prediction `m` permit the closed offset interval `[y - m - u, y - m + u]`. The calculation intersects every selected calibration interval with the declared domain. It retains that calibration result unchanged while separately intersecting held-aside constraints. Every offered rate, original row, source, role and prediction bracket remains inspectable. Unselected readings do not constrain this instrument declaration.

No offset or infiltration rate is adopted. A compatible shared offset is a conditional explanation; missing mechanisms, wrong weather or other model errors can produce the same discrepancy. The result does not calibrate an instrument or establish its physical cause. A finite offered rate set is not a continuous parameter search, and accepting an offset after inspecting held-aside data makes that data part of model development.

## Authored analytic control

In a closed, flat grid with no lateral flow, a 30 mm/h storm lasting 60 minutes and a 9 mm/h infiltration capacity leave 21 mm at minute 60 and 12 mm at minute 120. Authored reported readings of 23 ± 0.1 mm and 14 ± 0.1 mm are inconsistent with zero offset but permit an offset around +2 mm. With offered rates 3, 9 and 22 mm/h and a declared −5 to +5 mm offset domain, the first reading permits both 3 and 9 mm/h; the later reading retains 9 mm/h. Changing only the later reading to 100 mm rejects all shared explanations without changing calibration intervals. These are software model controls, not acquired field measurements.

## Original-source custody

Download retains only the complete original project and explicit declaration. Reopening recomputes from those inputs and does not replace the active project. Changed model context or changed/reordered associated rows invalidates the original association. Changes to the active project or panel declarations retire displayed results. No externally supplied result is trusted.

The declared domain is bounded by −1000 and +1000 mm. The entire source simulation is refused before execution if the complete rate family exceeds one million estimated cell-steps. The input file limit is 4 MiB. There is no closest-fit fallback for contradictory or missing calibration evidence. Missing held-aside evidence remains explicit.

Predictions use the maintained solver and its retained snapshot interpolation. Interval endpoints are computed from those numeric predictions and original acceptance bands without adding another fitting tolerance. Very close interval contact can depend on floating arithmetic and the modeled time step; these are not physically exact uncertainty bounds.

Run `node --test tests/depth-offset-evidence.test.mjs` for the analytic and independent membership controls. Run `CHROME_BIN=/opt/google/chrome/chrome node tests/depth-offset.receiving.mjs` for actual app comparison, source download/reopen, contradictory held-aside receiving and narrow-layout checks. Execution receipts must be recorded separately; these commands alone do not establish that tests ran.

## Executed receiving — October 25, 2026

On base `65c00576e0648eadcf8cc90eeb7f3818369df6ea`, the core, infiltration, question-planner and new offset suites complete **49/49 tests**, with zero skips or failures. The10new tests include **4,920 independently computed interval-membership comparisons**. This is the relevant regression set, not a claim that every repository test ran.

The actual maintained browser consumer passes **eight groups**: missing association refusal; the conditional9mm/h-plus2mm explanation; real filesystem download preserving original inputs only; invalidation; fresh-module file reopening with active project unchanged; contradictory held-aside evidence while keeping calibration intervals;390px panel layout; and no uncaught browser errors. The unchanged maintained sandbox gate explicitly observes active Namespace, PID/network, Seccomp and TSYNC protections before app navigation. A prior launcher was refused as inactive; that refusal was not treated as a product pass.

An independent worker reviewed the interval logic, source/context custody, separate evidence roles and pre-execution budget. Root inspected the [desktop](receipts/depth-offset-3425640f/desktop.png) and [narrow](receipts/depth-offset-3425640f/narrow.png) captures. [Verification](receipts/depth-offset-3425640f/verification.json), [browser receipt](receipts/depth-offset-3425640f/browser.json) and [sandbox observation](receipts/depth-offset-3425640f/sandbox.json) record the exact scope. No field measurement, instrument calibration or service deployment is claimed.
