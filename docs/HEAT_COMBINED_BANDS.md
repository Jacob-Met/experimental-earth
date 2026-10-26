# Retain focused heat explanations and add complementary sampling

The hidden-store inference consumer offers an explicit combined search. It runs
the unchanged focused original-band search and a complementary distributed
capacity schedule, retaining every tested explanation from both. Only exactly
identical capacity/conductance pairs are deduplicated; every producer method and
candidate ID remains attached to the resulting explanation. Every incumbent
calibration-compatible explanation survives. The default and original saved
search methods remain unchanged.

## Why combine the families

The focused method spends its remaining budget refining a low-residual capacity
after nine initial log-capacity lines. This can concentrate its finite family.
For the authored pulse, the original C=80000 J/(m²·K), G=20 W/(m²·K) explanation
has a lower-store peak of 32.3323836829°C. An authored lower reading at 69 minutes
with ±2°C precision leaves seven focused proposals with peaks
32.5982160861–32.6177967692°C, excluding that original modeled peak.
Complementary sampling distributes the remaining budget across breadth-first
log-capacity interval midpoints, using the exact same conductance scan,
calibration anchor and root evaluator. Its family includes that reference.

Distributed sampling alone is not a suitable replacement. Six narrow-band
controls retain 9/9/17/7/7/7 focused compatible proposals but no distributed ones.
An independent three-phase exposure with 18 fresh authored states produced
focused sampled peak ranges containing 18/18 original peaks and distributed
ranges containing 0/18 (four empty families and 14 ranges excluding the reference).
The standalone distributed selector was therefore held, not delivered.

The combined family retains the focused successes and adds the complementary
ones. In the original 40-state calibration-curve experiment, containment rises
from 31/40 to 40/40; on the independent 18-state exposure it remains 18/18. All six
narrow-band successes remain present. These are authored finite-family
challenges, not probabilities, continuous coverage or physical validation.
The independent seed was 718039; exposures were 35 minutes450 W/m²/22°C reservoir,
75 minutes850 W/m²/16°C and 140 minutes0 W/m²/19°C. Surface parameters were
C=22000, exchange=13, absorptivity=0.72, initial=21°C; lower initial=21°C. Reference
capacities spanned 50000–300000, conductances 10–50; searched bounds 40000–400000
and 5–60. Surface readings at 20/95 minutes used ±0.03/0.15°C; the separate lower
challenge at 160 minutes used ±1°C. No tuning followed the negative result.

## Cost and actual consumer

Select **Keep focused proposals and add distributed sampling** in the existing
inference form. The combined method performs up to 800 actual evaluations,
including repeated evaluations shared by the two unchanged producers. It
reports this actual work separately from the deduplicated candidate count.
The pulse uses 800 evaluations,642 distinct tested explanations and 230 compatible
ones. The report exposes both producer counts, complete candidate provenance
and the actual distributed capacity lines, including budget-limited lines.
A completed line means only that the finite conductance scan completed.

The existing inferred-peak planner consumes every distinct compatible model.
It reserves twice the search/prospective family size before execution and keeps
the 2,000,000 course-sample cap. The shared minimax helper keeps its legacy 400-row
default; only the combined consumer explicitly admits up to 800. Broad-band
regressions retain more than 400 compatible models without pruning. In the pulse
course, 141 times and both channels reserve 483200 work units; lower69 minutes is
the conditional minimax choice with worst remaining spread 3.9591122956°C from a
14.2512049010°C sampled peak range. A local Node24 run took approximately 466ms;
this is a software timing observation, not a remote/browser latency guarantee.

Adding explanations can widen the conditional range and change the question.
It cannot remove an incumbent explanation compatible with the same observation,
because the complete incumbent family is retained. It still does not establish
that the true physical explanation lies anywhere in either finite family.
No held-aside values choose the producer, discard proposals or change the search.

Downloads retain only original inputs and the explicit
`bounded-heat-combined-bands/1` method. Fresh reopening runs that method again;
downstream peak recipes also retain it. Original readings, initial states,
model/exposure and user site are not replaced. Derived candidate arrays cannot
be imported as original source.

## Verification

`node tests/heat-column-combined.test.mjs` verifies complete producer custody,
exact-only deduplication, every narrow-region success, full-family minimax and
source replay, more-than 400-model admission, held-aside independence and bounded
work/no-calibration refusal. Existing peak/channel tests preserve legacy output.
The browser course is `tests/heat-column-combined.browser.mjs`; receiving must
execute it with the existing browser sandbox intact. Browser evidence is only
counted after execution.
