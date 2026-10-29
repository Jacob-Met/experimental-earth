# Original rainfall interval consistency

This diagnostic asks whether any nonnegative constant rainfall intensity satisfies all original **calibration** interval totals under the declared storm support. It does not select a soil rate, add an offered intensity, or verify event association.

For original interval [a,b], storm end s, rainfall depth d and uncertainty u, the rainy overlap is min(b,s)-min(a,s). When overlap is positive, the permitted intensity interval is [max(0,d-u)*60/overlap,(d+u)*60/overlap], after maintained unit conversion. Positive minimum rainfall with zero overlap is contradictory. A zero-overlap interval whose uncertainty includes zero places no bound on intensity.

The implementation intersects these intervals using exact rational arithmetic on the represented binary64 inputs. It retains the original readings responsible for the largest lower bound and smallest upper bound. An empty intersection supplies these two witnesses; a positive dry-window reading supplies a single witness. Held-aside and unassigned readings never narrow this calibration interval.

A nonempty interval with no offered intensity establishes only that the supplied rainfall bands admit intensities absent from the finite offers. Soil and depth compatibility still require a separate explicit investigation. The existing finite-pair checker includes a numerical allowance; this diagnostic checks the nominal supplied uncertainty bands. Near-boundary differences therefore do not establish physical contradiction.

The maintained gauge panel computes this diagnostic from original inputs on comparison and reopen. No derived consistency result is accepted from the input bundle. Editing or replacing source clears the accepted result through the existing lifecycle.

Fresh native recovery checks include an independent integer cross-product oracle over irregular windows, a fractional storm endpoint, inclusive uncertainty endpoints, held-aside isolation, original witnesses, sparse-offer refusal and subnormal positive rain. Browser qualification is recorded separately and must not be inferred from these native checks.
