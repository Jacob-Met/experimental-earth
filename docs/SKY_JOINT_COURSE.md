# Two original-time consequences under one shared sky profile

Open `sky-joint-course.html` through the maintained `python3 serve.py --port 0`
launcher. The accepted original-course page links to it. The inquiry retains
three original final existing-surface readings, one explicitly chosen original
sky-change boundary, and one common early/late four-bin profile pair.

Choose two distinct original times, a temperature component at each time, and
two maximum proposal-minus-existing temperature differences. Both desired
ceilings must hold under the same profile. Negative ceilings require cooling;
positive ceilings permit that amount of warming. The ceilings are separate
authored goals, not additional observations or changes to original bands.

## Why a joint question is necessary

The original-course inquiry computes a separate minimum and maximum at every
original time. Separate favorable values do not prove that one profile attains
both. This inquiry computes the complete two-dimensional image of the same
feasible profile family, then intersects it with both desired ceilings.

The two supplied examples reuse the unchanged authored original readings from
the three-receiver example, with D2 as the comparison point. All three input
records remain present, in order D2, B2, B1. Their original 0.001 °C half-widths
and thermal declarations are unchanged. The data are invented numerical
controls, not field measurements.

| Original D2 surface time | Separately possible difference, approximately °C | Competing desired ceiling, °C |
| --- | --- | --- |
| 08:00 UTC | -0.011237641195761932 to 0 | -0.010676 |
| 09:00 UTC | -2.46495813829216 to -2.4637143183135923 | -2.464896 |

Each ceiling is possible separately, but no common profile meets both. Raising
only the second ceiling to -2.4641 makes the exact represented joint question
feasible. Its constructed witness combines two original feasible candidates;
the early and late marginal profiles remain fixed across all original times,
receivers and designs. A separately retained probe at the original B2 point did
not establish such a conflict and is not presented as a counterexample.

## Exact represented model

Let `p[i,j]` be nonnegative mixture masses over the 16 early/late bin pairs,
with total mass one. For each original receiver, the accepted final band imposes
one lower and one upper linear inequality on these masses. The maintained exact
three-band intersection enumerates the complete feasible vertices, each with
at most four positive masses.

At each selected original time, the additive coefficient remains
`A(i,j) = C(i,0) + C(0,j) - C(0,0)` using exact rational representations of the
original binary64 course values. The two objectives subtract existing from
proposal at the explicitly selected component and original index.

The exact image of a convex polytope is the convex hull of its vertex images.
`shade-heat-joint-projection.js` sorts and deduplicates those images, constructs
their exact convex hull, and reuses the maintained
`vendor/chronos/exact-halfplanes.mjs` clipping primitive for the two closed
half-planes. Point, segment and empty images retain their dimensions.

For a nonempty intersection, the deterministic lexicographically first clipped
point is reconstructed from at most three original feasible candidate images.
Exact segment or triangle weights combine their original masses. Normalization,
nonnegativity, both selected objectives and all three final bands are checked.
This includes cases where no supplied vertex meets both ceilings but a mixture
does. A supplied vertex is not substituted for an interior feasible point.

The lifted 16-bin coupling is only an internal representation. Every additive
coefficient depends on the early and late marginals, so replacing the coupling
with the product of those marginals leaves every exact additive observation and
consequence unchanged. The original complete thermal evaluator then replays
that one pair of normalized numerical profiles through all three original
courses. No profile is changed between the two selected times.

## Original numerical results stay separate

All 192 original basis courses complete before compatibility screening. Every
retained original boundary is screened against the declared 1e-9 °C additive
consistency threshold. The three final existing-surface observations must have
coincident represented lower/upper endpoints for every original pair. The two
selected objectives additionally require coincident represented existing and
proposal endpoints for their component and time. This endpoint gate is not a
new proof of physical geometry or numerical solver accuracy.

The exact feasibility result concerns the represented additive coefficients.
The original numerical witness can differ by a few binary64 units. Its original
final-band statuses and its two original numerical ceiling statuses are
reported separately and visibly, without tolerances that turn failures into
passes. In the feasible example, the exact second consequence equals -2.4641;
the original numerical replay can be slightly above that ceiling. The interface
explicitly says that the numerical replay must not be reported as meeting it.

The screen is not a certified uniform bound over all profiles, a physical error
bound or validation against measured temperatures. The inquiry does not infer
a measured sky history, a physical change time, continuous-time extrema or a
validated intervention effect. Convex combinations in the joint plot are across
profile choices, not interpolation between time samples.

## Complete admission and bounded work

The strict source wrapper permits exactly two distinct original indices, with
surface or lower-store components, finite ceilings and an explicit purpose.
It retains the existing 5 MB combined original-source limit and 24-interval
course allowance. The entire query is refused if a limit is exceeded; no partial
or favorable subset is returned.

| Work item | Reserved maximum |
| --- | ---: |
| Original interval ends plus initial state | 25 |
| Original complete basis thermal courses | 192 |
| Constructed shared-profile witnesses | 1 |
| Witness thermal courses across three points/designs/endpoints | 12 |
| Complete thermal courses | 204 |
| Complete course intervals | 4,896 |
| Receiver/time witness rows | 75 |
| Exact three-band candidates | 22,016 |
| Candidate objective mixture terms | 176,128 |
| Sort comparisons | 660,480 |
| Hull orientation tests | 88,064 |
| Complete hull vertices | 242 |
| Vertices after the two clips | 244 |
| Clipping edge tests | 488 |
| Witness reconstruction triangle tests | 240 |

The 242-vertex hull allowance reserves room for the two clips within the shared
244-vertex primitive. Sorting, orientation and reconstruction have explicit
abort bounds. These counters describe their named operations, not every
underlying rational arithmetic operation. Exact fractions retain the shared
4096-bit arithmetic refusal. Three complete geometry passes retain the existing
aggregate geometry allowance.

The authored incompatible example executes 192 thermal courses. Its feasible
control executes 204 courses / 3,264 intervals, retaining 51 original receiver
rows and checking 432 exact marginal equalities.

## Source-only consumer

The dedicated worker runs the complete inquiry. Intake accepts three original
reading files or extracts original evidence from a strict saved three-reading,
original-course or joint inquiry. Evidence extraction does not choose a new
boundary or replace the current desired limits. The dedicated reopen control
recomputes a complete saved joint inquiry.

Saved files contain only `kind`, the exact model declaration, original
`readings`, and the explicit `query`. Derived regions, witness profiles, replay
results and time-inspection choices are not accepted as evidence. Any original
point can be selected as the comparison point while all three original bands
remain constraints. Their original 4/8/16-bin inquiry histories are retained.

The plot distinguishes the complete model region, its intersection with the
desired limits, and one fixed witness. Exact values and separate original
numerical statuses remain available alongside it. UTC is visible first in the
time choice, with the full original timestamp immediately below. The original
time selector and keyboard slider inspect the same witness without computation.

Source/goal changes retire pending workers and file reads. Detached older
controls cannot reintroduce a previous context. Malformed or incompatible file
intake preserves the prior accepted inquiry; a newly submitted invalid query
does not produce a partial result. An empty original-band family retains its
original sources and times without inventing a consequence region.

## Qualification

- Nine distinct native groups pass: eight in the first combined course and
  the corrected empty-family control in an isolated rerun. The initial test
  mistakenly supplied 999 °C, outside the source parser's accepted range;
  the retained failure was corrected to a valid but incompatible 400 °C band.
- Native controls cover complete same-profile feasibility, normalized exact
  masses and marginal profiles, all original replay identities, source-only
  full replay, empty family, point/segment degeneracies, unresolved selected
  endpoints, sparse/malformed inputs, 24 intervals and partial final intervals.
- Independent Fraction receiving covers 163 projection/rectangle courses,
  exact objective extrema and witness reconstruction, plus 11 malformed,
  capacity and near-boundary controls. It includes a 2^-100 boundary and a
  243-vertex complete hull refusal.
- Independent direct receiving reconstructed the actual Chromium coefficients.
  A nonnegative rational Farkas certificate verifies all 16 original simplex
  inequalities and a strict contradiction of approximately 0.0003200829366765035
  for the incompatible pair. The supplied feasible profile separately satisfies
  unit mass, nonnegativity and all eight original-band/desired-ceiling inequalities.
- Independent wrapper receiving uses unfamiliar 37- and 41-minute courses,
  partial final intervals ending at 12:07 and 11:53, a swapped comparison point,
  mixed components, reversed selected-axis order, exact source replay and
  eight malformed or source/time controls.
- Actual browser receiving covers nine groups: ordinary parent entry, the
  incompatible and constructed feasible cases, exact actual-worker display
  bindings, all 17 original times, keyboard inspection without recomputation,
  actual source-only download/fresh reopen, all original-file histories,
  prior-source extraction, malformed/unresolved refusal, delayed files,
  retired worker results, empty family, zero-effect point, smallest-negative
  binary64 exclusion, desktop and 390px presentation.

The current-main composition preserves all seven paths from notebook CSV
export PR497, without overlapping edits. The scientific/thermal/geometry
adapters, existing input formats and prior course reports remain byte-identical.
The ordinary launcher and package asset discovery already include the new root
HTML/JS/CSS modules and their maintained nested dependencies.

Run the focused native controls with:

```sh
node --test --test-isolation=none tests/shade-heat-joint-course.test.mjs tests/shade-heat-joint-inputs.test.mjs
```

Run the maintained browser course with a supported sandboxed Chromium binary:

```sh
CHROME_BIN=/path/to/chrome node tests/shade-heat-joint-course.browser.mjs
```

The scoped source and execution identities are retained in
`docs/receiving/shade-heat-joint-course-52d429.json`.
