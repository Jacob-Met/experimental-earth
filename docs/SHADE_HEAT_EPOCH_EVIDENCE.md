# Let the sky change once

The two-epoch inquiry asks whether two original final surface-temperature bands can
be reconciled by allowing one declared change in the directional sky. It keeps
the original place, total irradiance, direct forcing, weather, interval grid,
materials and initial states. Both receivers and both designs share the same
early profile and the same late profile. The boundary is chosen explicitly; the
inquiry does not infer when a real sky changed.

Open **Let the sky change once** from the existing **Two readings, one sky** page,
or open `sky-epoch-evidence.html` through the documented local launcher:

```sh
python3 serve.py --port 0
```

All application modules and the authored example use ordinary top-level resources
served by this unchanged launcher. The example is an original input declaration
in `shade-heat-epoch-example.js`; no nested JSON-serving exception is required.

## Use original readings and an original boundary

Choose exactly two original temperature-band input files from the existing
single-point inquiry. Each retains its own original receiver, band, attribution,
source format, material parameters and initial temperatures. The normalized
nonthermal site, geometry, orientation, dated forcing and final UTC must agree.
The receivers must be distinct. Select which original receiver supplies the
proposal-minus-existing consequence.

This inquiry uses four equal directional bins in each epoch. The original bin
choice in each reading file remains part of its source record. It is not silently
rewritten to four. A split after interval 8 means the first eight original
intervals use the early profile and the remaining intervals use the late profile.
At least one complete interval must remain on each side. No new time step,
interpolation or invented boundary is introduced.

Declare the basis for sharing the two profiles across both points. This is an
explicit assumption with attribution, not an authentication of common physical
conditions. The authored example is identified as authored throughout; it is not
acquired measurement data or calibrated material evidence.

The page reports three comparisons separately:

| Comparison | Meaning |
| --- | --- |
| Original static model | The maintained four-bin, single-profile model, using its original represented thermal coefficients. |
| Additive static model | The new exact additive coefficient model with the same marginal profile in both epochs. |
| Two-epoch additive model | The new coefficient model with independently variable early and late profiles at the declared original boundary. |

If the two static comparisons disagree, the page says so. A change in numerical
coefficient model is then present, and compatibility cannot be attributed only to
allowing a change over time. A compatible result never identifies the actual sky
or validates an intervention.

## Complete original courses precede observation screening

For each original receiver, the maintained geometry sampler is run once. The
same one-bin transmissions and original direct/weather intervals used by the
static inquiry are reused. The geometry and thermal-course adapter is shared in
`shade-heat-profile-basis.js`; the original geometry integrator and thermal solver
are unchanged.

Every early/late one-bin pair is evaluated: 4 × 4 = 16 pairs. Each pair runs both
designs and both original forcing-envelope endpoints, giving 64 complete thermal
courses per point and 128 courses for the joined inquiry. No reading selects a
favorable subset of basis courses. A failed course refuses the whole inquiry.

At both receivers, every original pair's existing-surface lower and upper
observation endpoints must coincide. Unresolved observation endpoints refuse
the entire inquiry even if a reading would otherwise exclude that pair or the
other reading is already incompatible. The proposal's envelope endpoints remain
independent consequences under the existing forcing interpretation.

## Why the new coefficients are exact rational sums

The thermal model is affine in forcing at fixed material properties. Independently
rounded complete pair courses nevertheless need not obey an exact additive
identity. An initial raw-pair experiment found nonzero rectangle defects: joint
mixtures with the same early and late marginals could differ by a few binary64
rounding units. That experiment is retained as an informative failure; it is not
the implemented exact model.

Let `C_ij` be an original represented final temperature from early bin `i` and late
bin `j`, separately for each point, design, endpoint and heat store. The declared
surrogate uses:

```text
A_ij = rational(C_i0) + rational(C_0j) − rational(C_00)
```

The arithmetic stays rational from this construction through the intersection
and every objective. Seven reference courses determine the coefficients, while
all sixteen original courses remain a mandatory validity check. The inspector
retains every original final temperature and every exact additive-minus-original
discrepancy, including zeros. A fixed numerical consistency screen of `1e-9 °C`
applies to these computed discrepancies. It is an admission screen for this
bounded computation, not a certified error bound over all profiles or a physical
measurement allowance. No observation band is enlarged by that screen.

For nonnegative joint masses `w_ij` summing to one, define the early and late
marginals by their row and column sums. The additive consequence depends only on
those marginals. The product of the exact marginals therefore gives exactly the
same consequence as the joint mixture. This holds for both observation rows and
every design/endpoint/store objective. Joint coupling is an internal
representation; it is not an inferred physical relationship between epochs.

The shared two-band solver intersects the 16-coordinate simplex with the two
closed original observation slabs. Its complete vertex enumeration retains
supports of one, two and three coordinates. Two independent slabs can require
three-coordinate vertices. Constant, dependent, zero-width, empty and
lower-dimensional cases remain explicit. Strict numeric and rational input
wrappers share one private solver; the existing numeric interface is preserved.
The maintained exact arithmetic capacity guard still refuses rather than
returning a partial family.

All admitted vertices enter each paired objective. Surface and lower-store minima
and maxima are optimized separately. The page keeps only the distinct extremal
witnesses, at most four; their IDs are not necessarily contiguous. A witness's
exact early and late masses each sum to one. Exact fractions are authoritative;
decimal percentages and range displays are explicitly approximate.

## Original replay remains a separate result

For each displayed extremum, the exact marginal weights are converted to
approximate binary64 weights, normalized, and replayed through both original
thermal models. The mass before normalization and normalized weights are retained.
Each original replay temperature is compared with the additive prediction using
exact arithmetic on the represented values. A replay exceeding the same `1e-9 °C`
numerical screen refuses the complete result.

An original replay endpoint can fall just outside a closed original band even
when its exact additive witness is on that band's boundary. The inspector labels
that endpoint **outside original band**. It does not silently apply a tolerance,
call the replay compatible, or substitute the surrogate prediction as an
observation. Zero-width band compatibility applies only to the declared exact
coefficient model. Replay discrepancies describe the computations performed;
they do not certify the original solver or the continuum of untested profiles.

An incompatible result completes the entire admitted basis, reports no range and
no witnesses, and remains an exportable original-input inquiry. A refused result
is distinct from an incompatible family.

## Authored result and retained negative findings

The authored control uses original receivers B2 and D2, 16 original half-hour
intervals on 2026-06-21, and an explicit change after interval 8 at 08:00 UTC.
The second receiver has explicitly authored surface and lower-store capacities
equal to one tenth of the first fixture's corresponding capacities; they are not
fitted. Original existing-surface bands are:

| Receiver | Authored reading | Half-width |
| --- | ---: | ---: |
| B2 | 23.750014796817474 °C | 0.001 °C |
| D2 | 26.18914032745404 °C | 0.001 °C |

Both static comparisons reject this control. The two-epoch model retains 308
vertices and yields these paired additive consequences at B2:

| Heat store | Minimum proposal − existing | Maximum proposal − existing |
| --- | ---: | ---: |
| Surface | approximately +1.636682969881735 °C | approximately +1.640682969881735 °C |
| Lower store | approximately +1.140664263564286 °C | approximately +1.156550420628798 °C |

Positive values mean a warmer proposal in the declared model. These numbers are
an authored capability demonstration, not a physical recommendation. Some
extremal original replays are outside the original bands by roughly `10^-15 °C`;
their outside status remains visible.

The exploratory 80-control family admitted 32 cases that the static model rejected,
with zero such gains for the equal-thermal-capacity control. An earlier receiver
pair produced no distinguishing result and was retained as a negative finding.
Changing the split is also consequential: the same final bands can be compatible
at one original boundary and incompatible at another. The interface does not
search for a boundary or select one on the user's behalf.

## Work limits and source custody

The complete two-point query shares the existing maximum geometry allowance.
It admits at most 128 basis courses plus 32 reserved original witness replay
courses, 160 courses total and 3,840 course intervals. These are explicit new
two-epoch inquiry limits; the existing static formats and their budgets are
unchanged. All work is admitted before geometry execution or observation
screening. The existing source byte limit and maximum original interval count
also apply.

The source-only envelope is
`experimental-earth/two-epoch-shared-sky-reading-inputs/1`, with exactly `kind`,
`model`, `readings` and `query`. The query has exactly `bins`,
`splitAfterInterval` and `sharingSource`. Saved ranges, profiles and result fields
are not accepted as original evidence. The compact download preserves complete
original declarations and recomputes after reopening; it does not store results
as inputs or consume main-workspace project state.

Two-file intake is transactional. Invalid members, incomplete pairs and invalid
UTF-8 cannot mix new input with an earlier accepted pair. New source or query
intent retires older file reads and workers. Invalid file admission preserves the
previous accepted inquiry; an explicit query edit retires its result.

## Reproduce the qualification

The native course includes the authored distinction; exact marginal closure;
original outside-band replay status; exact parity with the maintained static
consumer; held-back split indices 3 and 13, direct irradiance 0 and 150 W/m² and
proposal roof uncertainty using independent full weighted-sky sampling; source
custody; whole-query endpoint refusal; and strict rational admission.

```sh
node --test --test-isolation=none \
  tests/shade-heat-profile-range.test.mjs \
  tests/shade-heat-profile-evidence.test.mjs \
  tests/shade-heat-spatial-evidence.test.mjs \
  tests/shade-heat-epoch-evidence.test.mjs
python3 tests/shade-heat-rational-bands-independent.py .
CHROME_BIN=/path/to/chrome node tests/shade-heat-epoch-evidence.browser.mjs
CHROME_BIN=/path/to/chrome node tests/shade-heat-spatial-evidence.browser.mjs
```

The independent Python Fraction oracle generates 160 deterministic nonbinary
rational cases, including denominators 3, 5, 7 and 11, dependent and affine-dependent
rows, constants, zero rows and zero-width bands. Full-dimensional Gaussian
active-set enumeration checks complete vertices and objective extrema. It does
not reproduce the product's support-one/two/three enumeration algorithm.

The actual browser courses launch unchanged `serve.py` and exercise the original
example module, workers, file controls, fresh source-only downloads/reopening,
receiver ordering, changed boundaries, stale file and worker responses, empty
families and malformed sources. Desktop and 390px layouts include the explicit
outside-band replay notice. Browser sandbox state is checked independently of
the generic session receipt's placeholder field. Exact source hashes and run
counts belong in the accompanying qualification receipt; unconfigured CI checks
are not reported as passed.

The implementation preserves the observation-channel temporal-weight inquiry,
point geometry, uncertain initial-state, heat-planning, lateral-transfer and
longwave owners. It adds no fitting, measured-sky identification, certified
geometry/thermal error, physical causal inference, public deployment or source
adoption on behalf of another owner.
