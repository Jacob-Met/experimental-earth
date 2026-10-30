# Original-clock native replay in joint mechanism inference

## Why an explicit alternate reading method exists

An observation can fall between retained solver snapshots. Linear interpolation is the existing reading method, but it can distort a short-lived storm transition. In an independently authored scalar pressure-balance course, rainfall99.6 mm/h ends at30.73 minutes. The original30.5-minute depth is approximately42.992564 mm. A5-minute retained-snapshot course interpolates42.287449 mm; a1-minute course still interpolates42.768585 mm. Running the unchanged native model to the original30.5-minute endpoint returns42.992564 mm. Aligned45/60/90-minute controls agree to rounding.

The independent RK4 reference uses explicit wet/dry phases and ponding onset;100000/200000 steps per hour differ by less than1e-7 mm on these authored readings. This is an independent numerical control, not field evidence or a general error certificate.

## Receiving and inference

The optional native-prefix method replays the same original event from its original initial state separately to each distinct original depth-reading clock. Rain stops at the lesser of the proposed storm end and the requested endpoint. The maintained solver retains a final partial interval at that endpoint, so the original reading is compared directly with its native terminal depth rather than interpolating snapshots. The project, reading values, clocks, sources, roles and offered mechanisms are not rewritten.

Original offered mechanisms are received under this method as well as every finite proposed storm. The previous full-event interpolation comparison remains separately labeled. Native prefixes are separate numerical replays, not one jointly refined trajectory and not a time-step convergence or physical-accuracy certificate. Spatial routing and the maintained time-discretization remain unchanged.

The original snapshot method remains the default and its complete merged report is byte-identical. The alternate method requires its own explicit basis and uses a distinct source-only v2 schema; the v1 reader refuses that schema. Source-only reopen recomputes the chosen method. No parameters or observations are adopted automatically.

## Complete bounded work and limitations

Every original baseline paired run remains reserved. Prefix work additionally reserves every distinct positive original reading time for every original offered candidate and every maximum nested proposal point. Time0 uses the native zero initial surface state; other times must be at least5 minutes, the maintained minimum event duration. Unsupported early times refuse the whole request; there is no silent interpolation fallback. The existing3million cell-step and200000 evidence-row limits remain.

Calibration alone guides proposals and admits all original water, interval-gauge and cumulative-counter constraints. Held-aside rows are evaluated but never guide the proposal coordinates or change calibration acceptance. Every finite course and attempted point is retained. Finite failure does not exclude a continuous parameter region.

## Evidence

With original1e-4 mm bands, the authored between-snapshot course has16 calibration-compatible points and no survivors using interpolation. Native-prefix receiving retains17 calibration-compatible points and5 survivors from the authored offered pressure model, with rainfall and storm end within.002 of the authored values. Every other finite original mechanism remains represented. The complete worst-case native reservation is976640 cell steps.

Controls cover direct native endpoints for every original mechanism, fractional6.6-minute endpoints at1.1-minute steps, held-aside contradiction with identical calibration/course coordinates, minimum-time and aggregate-work refusal, original-only transfer and default full-report parity. The consumer separately identifies both reading methods, preserves imported method/source custody and retires pending imports when the method changes.
