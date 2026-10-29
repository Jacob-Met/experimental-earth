# Use the complete original temperature record

Open `sky-many-readings.html` with the documented `python3 serve.py --port 0` launcher, or follow **Open the complete-record inquiry** from the original-time reading page.

The accepted original-time inquiry admits exactly three temperature readings. This separate consumer admits **3–24 distinct original instantaneous readings from at most three complete receiver sources**. Every original band remains a constraint on one common early four-bin sky profile and one common late four-bin profile. The first three readings form an explicit reference family; the first record selects the comparison receiver. There is no automatic selection of a favorable three-record subset.

## What the added records establish in the authored control

The example retains the original D2, B2 and B1 source courses from 04:00 to 12:00 UTC on 21 June 2026, with 30-minute original intervals and a declared change at 08:00. All 24 readings keep their own original receiver, UTC, surface/lower-store component, temperature, ±0.001 °C band and attribution. Values were taken from complete authored numerical pair courses, with zero-based early bin 1 and late bin 2. They are not field observations or an accuracy benchmark.

At D2 at 06:00, the first three bands admit a proposal-minus-existing surface range of approximately **−2.585671 to −2.573367 °C**, width **0.0123043 °C**. With the complete record, that range becomes approximately **−2.585671 to −2.584660 °C**, width **0.00101083 °C**. Across the 17 original times and two components, 32 pointwise ranges narrow and the two initial-state ranges stay unchanged.

The retained prefix experiment tested 3, 4, 6, 12 and 24 records, without changing any admitted band. The first three exactly reproduced all 68 endpoints of the accepted three-reading inquiry. Twelve and 24 records give the same width at the inspected 06:00 and 08:00 surface states: more evidence need not narrow a particular bound. This is not a claim of no effect at every other state. Setting only the last admitted temperature to 400 °C rejects the complete family while preserving the compatible first-three reference and all original inputs and times.

These findings concern conditional bounds under the declared additive model. They do not reconstruct an observed sky history, validate a physical intervention or establish thermal-model accuracy.

## Keep the original record intact

Load 3–24 original reading files, or extract originals from a saved complete-record or supported three-reading inquiry. Intake preserves prior 4-, 8- or 16-bin histories without adopting a saved change boundary; the new query explicitly uses four common bins. Legacy final-only records retain their kind and final-UTC restriction. Source-only downloads contain only `kind`, `model`, `readings` and `query`; fresh reopen recomputes the result.

Every identity is `(cellIndex, utc, store)`, with target `existing`, aggregation `instant`, and component `surfaceC` or `subsurfaceC`. UTC must exactly identify the original initial state or an original interval end. Duplicate identities, interpolated times, interval means and conflicting repeated-receiver sources are refused. All sources must retain the same original site, geometry, orientation, forcing and dated time grid. Distinct receivers may retain their own original thermal declarations under the maintained shared-site contract.

The original-record panel exposes every reading and its attribution. Drafting a revision retires the result and blocks computation/export until **Use revised reading** or **Cancel reading edits**. The complete proposed record is admitted before replacing an original. Refused duplicates and source conflicts retain the loaded evidence. Choosing a different first record explicitly changes the first-three reference and comparison receiver. Detached controls, stale file reads and retired workers cannot revive older evidence.

Every original interval remains in the calculation, including a partial final interval. There is no truncation at an observation time or inference between retained states.

## Six coordinates preserve the exact additive sky model

The maintained original-boundary kernel evaluates all sixteen early/late bin pairs for each unique original receiver. Both designs and both geometric endpoints are evaluated, giving 64 complete basis courses per unique source. Complete source equality is checked before reuse. With three unique receivers there are 192 basis courses; three readings of one identical receiver require 64. This is an execution-count reduction, not a general wall-time performance claim.

At each original state, the exact represented additive coefficient is

`C(i,j) = C(i,0) + C(0,j) − C(0,0)`.

Every supplied sixteen-pair observation and objective row must satisfy this identity exactly. All original numerical pair states are separately screened against it. Let `e1,e2,e3` and `l1,l2,l3` be the nonzero-index early and late weights, with `e0 = 1−e1−e2−e3` and `l0 = 1−l1−l2−l3`. Nonnegativity and the two sum inequalities describe two full four-bin simplices. An additive row is its zero-pair constant plus six linear coefficients in these coordinates.

Any feasible sixteen-mass coupling has these two marginal profiles. Conversely, their product reconstructs every additive observation and objective exactly. The optimizer therefore loses no feasible additive value when it uses six marginal coordinates. It does not infer a correlation or measured transition between sky bins.

Each original interval band becomes two exact inequalities. At every original time and for both temperature stores, the paired lower difference is `proposal.lower − existing.upper` and the upper difference is `proposal.upper − existing.lower`. Lower bounds maximize the negated **entire** objective row, then negate the result. Objective constants remain in the reported certificate binding.

## Exact optimization and certificates

`shade-heat-exact-linear.js` is a new bounded internal optimizer for `max c·x`, `A·x ≤ b`, `x ≥ 0`. It reuses the maintained exact rational arithmetic. It does not replace the existing two-band or three-band intersection APIs. The implementation uses a two-phase simplex with original slack columns, artificial variables for negative right-hand sides, and Bland's smallest-index entering/leaving rule. The pivot rule follows [Bland, 1977](https://doi.org/10.1287/moor.2.2.103); no third-party solver source is copied.

Every returned result is checked against the original matrix rather than its transformed tableau:

- A feasible point satisfies all original inequalities and nonnegativity.
- An optimum has a nonnegative dual vector `y`, `Aᵀy ≥ c`, and exact equality `c·x = b·y`.
- Incompatibility has nonnegative `y`, `Aᵀy ≥ 0`, and strict contradiction `b·y < 0`.
- The general bounded API also verifies an unbounded feasible ray. The consumer's compact sky simplices cannot produce an unbounded finite objective.

The first-three and complete-record families each optimize the entire requested list before a report is returned. All complete-record bounds must be subsets of the corresponding first-three bounds. Additional records cannot rescue an incompatible reference family. Work exhaustion, malformed evidence or a failed numerical screen refuses the whole inquiry; an earlier feasible family is never substituted as the complete answer.

The report retains exact original pair rows, six-coordinate matrices, objective projections, primal/dual or Farkas certificates and range/witness bindings. Fractions in `exactEvidence` use two decimal integer strings `[numerator, positive denominator]`. The interface exposes these certificates in an optional detail panel. Saved inputs exclude calculated certificates and results.

## Read fixed-profile replays separately

The first-three ranges are pale blue; complete-record ranges are green. Each extremum may use a different profile, so the envelope is not one possible realized course. Orange markers follow one selected profile pair through every original time.

Distinct marginal profiles selected by the complete objective family are replayed over every unique complete original source. Each of the 3–24 observations then receives its own original numerical lower/upper values and within/outside-band status at its exact original UTC and component. Repeated readings share the underlying complete replay, not their observation result.

Exact additive compatibility and original floating-point replay status are separate. Normalized approximate profile replay can put an observation endpoint outside its original band even when the exact additive witness is feasible. That status remains visible. The 1e−9 °C screen covers completed pair states and displayed witnesses; it is not a certified error bound for every possible profile, continuous time or physical measurement.

## Complete work limits

The consumer admits 2–24 original intervals and at most 25 states. Its reservation covers at most 192 basis courses, 100 selected profiles, 1,200 witness courses, 1,392 total thermal courses, 33,408 thermal intervals, 7,500 unique-source/time replay rows and 2,400 observation replay rows. Geometry remains bounded by the maintained shared limit.

Each exact optimizer call admits at most six variables, 50 inequalities, 100 objectives, 2,048 pivots and 4,000,000 counted rational helper operations. The two complete families reserve twice those pivot/operation limits. Projection, product construction and report assembly are separately bounded by the admitted dimensions; the operation counter does not claim to count every VM or bit operation. Every normalized rational result remains subject to the maintained 4,096-bit guard. The entire objective list is validated before optimization and a budget failure returns no partial objective list.

The 24-record example executes 192 complete basis courses and 36 witness courses. It retains 72 observation replay rows across three displayed profiles. The retained exact-optimizer prefix timings exclude thermal/UI work and are not advertised as complete-consumer speed comparisons.

## Qualification and scope

The maintained native controls are:

```sh
node --test --test-isolation=none --test-reporter=tap \
  tests/shade-heat-exact-linear.test.mjs \
  tests/shade-heat-many-course.test.mjs \
  tests/shade-heat-timed-course.test.mjs \
  tests/shade-heat-timed-inputs.test.mjs
```

The recorded run passes 26 groups. Independent reviews cover 160 exact small linear systems with 344 objective optima; degenerate artificial removal, unbounded rays and whole-list budget refusal; 72 independent additive pair extrema/product witnesses; and the complete original-record source/replay/proof bindings. Unfamiliar partial-course and four-record cases are retained, together with contradictory and no-gain controls.

Actual browser receiving uses:

```sh
CHROME_BIN=/path/to/chrome node tests/shade-heat-many-course.browser.mjs
```

Its nine groups exercise the parent entry, actual worker, every original time and both evidence families, all 24 original model/replay rows, real source-only download and fresh reopen, explicit reading revisions, complete-file ordering/history, malformed and contradictory inputs, stale file/worker retirement, keyboard inspection and 390/1440 px views with an active Chromium sandbox. The actual worker is the exact DOM oracle. Node/Chromium differences are recorded separately rather than assuming bit-identical thermal arithmetic.

The portable stdlib Fraction checker in the retained evidence bundle independently reconstructs every additive row from the raw original pair courses, verifies 204 exact optimum certificates across the compatible and contradictory reports, binds all 68 complete-family bounds to witnesses, and checks all 72 observation replay rows. Changed-bound, changed-dual and missing-final-record controls must fail.

The existing thermal/geometry solvers, source clocks, legacy band APIs, observed-channel temporal-weight inquiry, initial-state inference and observation planners are unchanged. The only existing product file changed is the owned original-time page's onward link. Qualification establishes this private source/consumer capability and its stated model identities; it does not claim public deployment, CI success, cloud-platform qualification or physical validation.
