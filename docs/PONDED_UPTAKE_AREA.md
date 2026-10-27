# One common test area for a ponded-volume course

Open the sourced soil-test investigation from Rain Lab, enter the original study, then use **Could one measured test area explain the whole volume course?** Declare positive lower/upper test-area bounds and their source. Bounds must contain the original nominal area; they do not replace it. Compare by button or keyboard. Save original study and area produces an input-only JSON file; reopening validates and recomputes every conclusion.

## What changes the decision

A fictional 60-minute reading of 1 ± 0.1 L supports a constant K10 explanation at approximately 0.09–0.11 m², and K20 at 0.045–0.055 m². The broad declaration 0.04–0.12 m² cannot distinguish them. Tightening it to 0.09–0.11 m² excludes K20. This is a question about an area measurement's consequences, not a claim that the tighter bounds have been measured.

Every calibration reading must fit **one shared area**. At K10, a second 120-minute reading of 3 ± 0.1 L requires approximately 0.145–0.155 m². Both readings individually fit the declared 0.04–0.16 m² range, but no common area fits the course. Changing the second reading's role to held aside preserves the first reading's calibration range and shows that the held-aside reading contradicts every remaining area. It never refits the area to pass the challenge.

## Computation and qualifications

The maintained `pondedInfiltration` kernel supplies cumulative infiltrated depth for each original reading. A positive depth d and measured volume band [L,U] give area constraints L/d to U/d, clipped to the declaration. Calibration constraints are intersected across the entire course, not checked independently with a different area for each row. Zero predicted uptake is treated separately without division.

For nonzero-width declarations, each volume comparison carries a disclosed guard of 32 binary64 epsilons times the largest relevant volume magnitude. Expanded constraints form the possible range; contracted constraints form the interior range. `supported` requires a nonempty common interior, `excluded` requires an empty possible intersection, and `numerical-boundary` retains ambiguous contact. Zero-width declarations reuse the maintained exact-area comparison's classifications, including its existing conversion guard. The guard is an engineering arithmetic allowance, **not a formal enclosure of all kernel error or physical uncertainty**. Original caller volume/area bounds are preserved. Display rounding can make inner and outer endpoints look identical; the arithmetic guard is shown separately.

Held-aside readings are reported against the complete remaining possible calibration range: within for all, contradicts all, or area-sensitive/numerical-boundary. No calibration is explicitly reported and cannot establish support. At most nine hypotheses and one hundred readings are admitted by the existing validator; the mechanism evaluates each pair once and performs interval intersections, with no area sampling or new solver.

The original assumptions still apply: continuously ponded net infiltrated volume, homogeneous event-scale soil hypothesis, neglected ponding-head correction, and declared exclusion of storage change, evaporation, leakage and lateral losses. No measurement authenticity, unique soil property, automatic area adoption, physical validation or test-to-site transfer is established. Original nominal-area offered-reading questions remain a separate calculation and are not silently conditioned on this area range.

## Receiving

Native controls cover common-area impossibility, area-driven discrimination, exact-width parity, held-aside independence, monotone widening, units, zero prediction/time, source-only reopen and invalid declarations. The actual browser course exercises original volumes, keyboard comparison, changed bounds, incompatible calibration, held-aside contradictions, save/reopen, late original import invalidation and populated desktop/narrow views.
