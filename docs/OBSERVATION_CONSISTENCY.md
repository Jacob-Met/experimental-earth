# Compare simultaneous declared depth bands

The selected-cell evidence view now asks **Do simultaneous readings agree with
each other?** independently of the hydraulic simulation. This answers a different
question from whether each reading agrees with the current model.

Readings are grouped only when their assigned scenario, grid-cell index and exact
recorded minute are equal. Nearby times are never rounded into one group. An
unassigned scenario remains excluded because the application cannot establish
which site it describes. Calibration, held-aside and notebook-only roles all
remain explicit. This comparison includes every role at the selected cell, even
when the model-evidence map above is filtered to one role; hiding a contradictory
partner would conceal the evidence question.

For each repeated group, intersect the nonnegative declared intervals
`[max(0, depth - uncertainty), depth + uncertainty]`. The smallest upper endpoint
and largest lower endpoint determine whether a common depth exists. If the latter
exceeds the former, those two original readings form an inspectable contradictory
pair, with their gap shown in millimeters. Every source remains visible, including
CSV filename, row and original units. Nothing is averaged, dropped, relabeled or
used to fit a parameter. Exact-time labels retain their full numerical value.

Touching bands have a one-point intersection. A positive gap no larger than
`32 * Number.EPSILON * max(1, abs(lower), abs(upper))` is labeled **near contact
within numerical guard**, with no fabricated common interval. This guard handles
floating-point representation; it is not additional measurement tolerance.

The interval figure puts every reading on one shared millimeter scale. The
contradictory witness pair is colored separately and also described in text.
Individual zero-width bands remain point marks. The displayed axis spans at least
one millimeter; exact values and small gaps remain in the accompanying text.

## Interpretation

This checks consistency of the supplied scalar depth declarations. Assigned grid
cells are not verified physical co-location: variation within a cell, different
actual events, timing uncertainty or different measurement methods can explain
differing readings. A disjoint pair does not identify a faulty sensor or the
correct value. A common band does not establish measurement truth, statistical
independence, a valid model or field safety. No intervention or new measurement is
authorized by this diagnostic.

## Verification

The candidate composed with merged observation-map source
`2cd82d0d4cc9169e52729c6759287952fdde1851` passes 229 native groups using
`node --test --test-isolation=none tests/*.test.mjs`. Eight new groups cover exact
witness gaps, touching and zero tolerance, multi-reading extrema, exact time/cell/
scenario separation, nonnegative intervals, numerical near contact, provenance
immutability and reopening, and changed-tolerance controls.

`CHROME_BIN=/opt/google/chrome/chrome node tests/observation-consistency.browser.mjs`
runs both the maintained map course and the new consistency course through the
same sandbox-admitted browser owner. The course checks disjoint sources under a
role filter, unchanged stored evidence, near-time separation, changed tolerance,
reopening and narrow layout. Actual execution receipts are separate from native
qualification; neither establishes environmental validity.
