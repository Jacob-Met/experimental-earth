# Investigate ponded soil uptake and offered next readings

From the Rain Lab, follow **Open the sourced soil-test investigation**. Load the fictional example to learn the JSON format, or supply your original study. Enter cumulative **net infiltrated** volumes with original L/mL units, elapsed times, uncertainty, test area, place, method and sources. Mark readings as calibration or held aside. Comparison shows every declared soil explanation, modeled quantity and residual; it never changes the mapped site.

## What the calculation admits
The test must be declared continuously ponded. Added water alone is not net infiltration: surface storage changes, leakage, evaporation and lateral loss must be excluded by the stated method. The existing `pondedInfiltration` calculation represents a homogeneous Green–Ampt sharp front with ponding head neglected. Each explanation supplies conductivity K, capillary drive A and initial cumulative infiltration independently. Area is treated as declared exact. This does not infer a unique soil property or establish transfer from a test patch to other mapped cells.

Calibration values order explanations; held-aside values only challenge them. Declared ± bands are acceptance bounds, not statistical confidence intervals. A numerical boundary is explicitly unresolved, rather than widened into physical support or rejection: the comparison guard is16×Number.EPSILON×max(abs(prediction),abs(band endpoints),Number.MIN_VALUE). This is a computational convention, not a certified solver error enclosure. Another clearly contradictory calibration row still excludes an explanation.

## Decide among offered next readings
Supply an acquisition basis, current elapsed time and at most32 explicit future times, each with an availability flag and a ±liter bound. Only calibration-supported or numerical-boundary-possible explanations enter the question comparison. Already recorded times, unavailable offers and times before the retained course ends cannot become new questions. Every available comparison shows its predicted reading bands and remaining unresolved pairs.

The maintained finite pair-coverage policy prefers the offer distinguishing the most pairs, with earliest time breaking ties. It reuses `planComplementaryDepths` after converting volume/area to equivalent infiltration depth; this is test uptake, not surface ponding. The policy does not estimate probabilities, expected information gain, a continuous-time optimum or physical acquisition feasibility. An empty/nonseparating offer list yields no invented question. Held-aside reading values never choose the question.

Save source and offers, then reopen to recompute. Derived decisions are not trusted as evidence. Editing either input retires the result and export; completion of a pending original-source import also clears questions calculated during the read. No reading is fabricated or added to the original notebook.

## Qualified receiving
Base `e7c269f1f805ec47cd65fd8ef43989849ab3c979`; full unchanged native gate **1319 passed, zero failed/skipped**, with the original exact Python-oracle receipts. Actual browser **13 groups passed**, zero runtime exceptions, verified namespace/PID/network/seccomp/TSYNC admission. Desktop/narrow views show preferred90, unavailable45 and unresolved60 in the authored crossing example. See [receiving evidence](receiving/ponded-uptake-69d25c99168e/README.md).
