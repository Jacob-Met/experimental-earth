# Infer proposals for a hidden heat store

After saving original heat-column surface evidence, use **Find hidden-store
explanations from the original readings**. Declare a sourced lower-capacity and
conductance domain. The search keeps the original surface properties, lower
initial temperature, exposure, place and every calibration/challenge reading.
It offers editable numerical proposals; it does not identify a physical material.

Inspect every tested proposal and its original point or interval-mean residuals.
Choose **Edit this proposal as an alternative** to append it to the existing
evidence draft. Review or correct it, then use the existing **Save surface
evidence** and **Compare saved alternatives** actions. Unsaved evidence drafts,
a full 12-alternative draft and mismatched source evidence refuse this handoff.
No saved reading or physical parameter changes until the ordinary explicit save.

Download/reopen retains only the original project, search domain and method.
Reopening recomputes in an isolated inquiry without replacing the working site.
A different working source cannot receive that proposal until its original
project is explicitly reopened or the current source is searched instead.

## Mechanism and bounded meaning

`searchHeatColumnParameters(project, query)` reuses the maintained
`evaluateHeatColumnHypothesis` evaluator, factored without changing the existing
evidence comparison. That evaluator retains the full-course extrema admission,
interval-mean operator, energy accounting and separate engineering arithmetic
guard used by ordinary evidence screening.

Capacity is searched in logarithmic coordinates and conductance in linear
coordinates. A 5×5 coarse grid supplies three calibration-only seeds. Bounded,
damped Gauss–Newton steps use central finite differences, a two-dimensional
regularized normal equation and a backtracking line search. Each seed receives
at most 125 additional evaluations; the complete search is capped at 400.
The whole worst-case course/sample budget is admitted before evaluation. Every
evaluated point, including finite-difference probes, remains inspectable.
Coordinates are projected into the domain; reconstructed physical values are
clamped to its original endpoints to preserve very narrow valid domains despite
log/exp roundoff. Complete-course refusal aborts the inquiry rather than being
scored as a rejected explanation.

The least-squares step uses residuals divided by each original band width, with
a 0.000001 °C objective scale for zero-width readings. This floor never widens
compatibility bands. The coarse seed ranking uses the maximum normalized
calibration residual. Only the existing reading screener establishes
compatibility. Challenge readings never choose search seeds, directions,
acceptance or stopping. They remain visible for every evaluated proposal.

This is finite local search, not a continuous feasible region, global optimum,
unique property estimate or proof of impossibility. Broad or uninformative
readings may admit many proposals. Distinct numerical proposals are not
independent evidence. Floating-point runtime differences can change near-tie
paths and proposal counts; reopening recomputes rather than promising a frozen
numerical trajectory.

## Executed comparison and negative controls

The authored unseen target C=137000 J/(m²·K), G=31.7 W/(m²·K), calibrated at
27 and 81 minutes with ±0.02 °C bands and challenged at 143 minutes, is absent
from the manually offered pair and the 25-point coarse grid. In the local Node
course, refinement retained 37 compatible proposals among 99 evaluations;
Chrome 156 retained 38 among 100. Both preserve zero coarse-compatible proposals
and reach the ordinary editable evidence save/compare journey. These are
software/model controls, not acquired temperature validation.

A first coordinate-pattern approach failed an unfamiliar interval-mean target
C=91000/G=17.3, with best residual 14.084 times the declared band. That failure
motivated the damped derivative method; three separately chosen interval-mean
targets now admit compatible proposals. Independent review exposed a very narrow
capacity-domain roundoff failure; exact-domain clamping and a regression control
address it. Impossible time-zero readings, no calibration, uninformative initial
readings, challenge changes, stale sources and work limits remain separate cases.

The maintained **NOAA Tucson** nine hourly means supply a measured-data negative
control. With the original authored surface/initial conditions unchanged and an
explicitly authored C=10000–1000000/G=0–100 domain, the local course found zero
compatible proposals among 147 evaluations. Its best maximum normalized residual
was about31.173. This is not a rejection of all continuous parameter values or of
two-store physics. The original ±0.5 °C bands are illustrative, not NOAA instrument
uncertainty; no recorded temperature, role, window or source is modified.
See `examples/noaa-tucson-hourly/README.md` for original acquisition provenance.

## Receiving

```
node tests/heat-column-search.test.mjs
node tests/heat-column-evidence.test.mjs
CHROME_BIN=/path/to/chrome node tests/heat-column-search.browser.mjs
```

The browser course uses the maintained same-process sandbox admission. It checks
original project import, new inference, all-proposal inspection, actual source-only
download/reopen, forged-output refusal, changed original evidence, desktop/390px
rendering, keyboard selection and proposal-to-editable-draft/save/compare. Browser
screenshots/receipts are execution evidence, not environmental accuracy.

## Complementary original-band mode

The same consumer also offers **Find proposals within original bands**, a separate
bounded bracket continuation for unequal reading bands. The original
normalized-residual method and its saved files retain their behavior. See
[original-band inference](HEAT_COLUMN_BAND_SEARCH.md) for the mechanism, negative
controls, source-method identity and conditional coverage limits.

## A prospective reading for peak uncertainty

The separate [inferred peak question](HEAT_COLUMN_PEAK_QUESTION.md) uses all distinct compatible proposals to choose a sourced available reading time/window that minimizes worst conditional lower-store peak spread. It preserves the existing offered-alternative question planner and provides source-only download/direct fresh reopen. These are conditional finite-proposal predictions, not acquired observations or a continuous uncertainty enclosure.

## Optional combined family

The same consumer can [retain the complete focused family and add complementary sampling](HEAT_COMBINED_BANDS.md), at up to 800 actual evaluations. Every incumbent explanation is preserved. This broadens finite exploration without claiming continuous coverage; original methods remain unchanged.
