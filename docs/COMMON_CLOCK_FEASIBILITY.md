# Continuous common-clock feasibility

The existing clock diagnostic compares a small declared list of offsets. The
per-reading acquisition-window panel lets each record vary independently. This
panel asks a different question: which offsets within one explicitly sourced
continuous range are compatible with every assigned reading under each retained
infiltration hypothesis?

Declare a minimum and maximum offset within ±60 minutes, and their source/basis.
Positive offsets mean model sample time = original recorded minute + offset.
Original readings and the model clock are never edited. Every assigned calibration
and held-aside record remains included; unassigned/other-scenario records remain
in the saved source but do not constrain this study.

## Keep individual, calibration and challenge support distinct

Each reading retains its original value, tolerance, role, source, event-admitted
offset domain and compatible closed intervals. Offsets placing that reading
outside the modeled event are unsupported, not silently extrapolated. The report
also shows the common event-admitted domain for all assigned readings.

Calibration-compatible intervals are intersected using calibration records only.
Held-aside-compatible intervals are shown separately; final surviving intervals
are their intersection. A changed held-aside value or time cannot change the
calibration set or original-minute calibration ranking. With no calibration,
there is no calibrated surviving set. An empty feasible set does not identify
which source, clock, material parameter or omitted process is wrong.

The candidate order remains original-minute calibration RMSE order. This is
compatibility under explicit clock hypotheses, not a best-offset optimization,
refit, probability, authenticated timestamp or automatic model adoption.

## Continuous, possibly disconnected sets

The mechanism solves each depth band against every intersecting linear segment
of the retained solver trajectory, then shifts times back to offsets. Constant
segments, exact threshold contacts and single-point domains are preserved.
Overlapping or exactly touching closed components are united; gaps are not
filled with a convex hull or an epsilon merge. The endpoint precision is arithmetic
output, not an estimate of clock accuracy. A small explicitly reported depth guard
covers numerical comparisons; its value is not measurement uncertainty.

An authored flat 2 × 2 turf control with 30 mm/h rain for 60 minutes and 9 mm/h infiltration
supports a 21 ± .01 mm reading at recorded minute 60 for offsets approximately
[-.02857,.06667] minutes. A 15 ± .01 mm held-aside reading at recorded minute 120 needs
approximately [-20.06667,-19.93333]minutes. Both can fit independently, but there is
no common offset. A single 15 mm reading recorded at 60 minutes instead has two
separate feasible components: one on the rising course near −17.14 minutes, the
other on the falling course near +40 minutes. The panel retains both components.
These are authored numerical controls, not field measurements.

## Bounded work and original-input custody

Preflight bounds cap solver work at 3 million cell-steps, trajectory inspections at
500,000 estimated visits and accumulated interval-intersection work at 2 million
conservative comparison units. Intersections can split components, so the bound
accounts for their possible growth rather than only counting initial samples.
The supported project has at most 100 observations and at most 9 candidate rates.

Download saves a versioned input-only envelope with the complete original project
and clock-range declaration, up to 4 MiB. No computed verdict is serialized.
Reopening validates and recomputes independently without replacing the active
workspace. Included source identity is displayed in live and reopened results.
Source changes retire live output, and late file reads cannot repaint after a
source/input revision or a newer file selection.

Results depend on the retained solver snapshots and linear interpolation; they
are not physically validated time intervals or numerical convergence bounds.
The existing discrete common-clock and independent reading-window instruments
remain available and keep their meanings.

## Received integrated source

The owned runtime was received against main `31cb2a209c88d34174d6783844d6c750526f0fcd`, including the current rooted-store comparison. Ubuntu / Node 22.23.4: **654/654 native tests**. The launched Chrome 156 course passed **five behavior groups**, with same-browser Namespace, PID/network namespaces, seccomp and TSYNC admission. Keyboard interaction receives individually compatible but jointly empty evidence; actual input download/reopening preserves the active workspace; stale reads cannot repaint; disconnected support remains visible; expanded source displays fit 1440 px and 390 px. Root inspected both renders, pixel-identical to the preceding qualified consumer run.

Independent review used a separate zigzag trajectory with four disconnected bands, negative offsets yielding exact-touch singletons, a 2^-40 minute gap, a zero-width domain and peak equality. Held-aside depth and timestamp mutations left the calibration set and ordering exactly unchanged; event exclusions, work limits, raw-input replay and source nonmutation passed. Receipts, exact tested runtime blobs and screenshots are in `docs/receipts/common-clock-e794`. These qualify the declared numerical model and data handling, not field timing or environmental accuracy.
