# One common margin across original temperature targets

Open `sky-course-targets.html` from the three-profile inquiry. This comparison
retains the complete original observation record and both declared changes. It
asks whether **one set of three shared profiles** can meet every desired
temperature ceiling at once.

## Use the comparison

1. Try the authored example, reopen saved target inputs, or open a saved
   three-profile inquiry. Inspect every original observation in the first panel.
2. Select the original times and temperature components at the first original
   receiver. Enter a proposal-minus-existing ceiling in degrees Celsius and
   attribute these desired targets. Negative ceilings ask for cooling.
3. Apply the target edits, then find the best common profile. Editing clears the
   previous result. Cancel restores the applied targets and requires a fresh
   calculation. The adjustment control changes selected draft ceilings only.
4. Inspect each target and the same profile at every original time and receiver.
   The original numerical replay has separate band and ceiling statuses.
5. Download the original inputs and targets. Reopening calculates the complete
   result afresh; saved calculations are not an admitted input format.
   Large admitted sources use compact JSON when formatting would exceed the
   file allowance; the final download bytes are checked before saving.

Opening an earlier three-profile inquiry supplies an **unapplied draft** of zero
ceilings at its noninitial original times. These are explicitly proposed goals,
not new measurements. Review and apply them before calculation. To change a
measurement, receiver order or either declared boundary, revise the original
three-profile inquiry and open its newly saved inputs here.

## What the result means

For desired ceiling `c_i` and the paired model difference `f_i(x)` at original
target `i`, the calculation minimizes:

`M = max_i(f_i(x) - c_i)`

All original observations constrain the same `x`. A positive optimum proves
that no common profile in this exact additive family meets every ceiling. The
reported best compromise still satisfies every original observation. A zero or
negative optimum supplies one profile meeting all ceilings. The common margin
is `-M`; it is a margin in this represented coefficient model.

An individually attainable target need not be attainable together with the
others. The frozen example retains 24 authored observations and 32 finite
literal targets. All 32 targets are separately attainable, but their best common
excess is approximately `+0.00015394215 C`. Raising every desired ceiling by
`0.0002 C` makes the targets jointly compatible while leaving all observations
unchanged. These small values are numerical controls, not a claim of practical
cooling precision. The literals are never fitted or regenerated during intake.

If the original observation record is incompatible, target optimization is not
evaluated. The report contains no margin, substitute profile or target replay.
It retains all original inputs and the first-three-record comparison.

## Exact formulation and proof

The original family has nine nonnegative coordinates, three simplex upper
bounds and up to 48 observation-band inequalities. Each target retains all 64
additive triple coefficients. Its affine projection is `z_i + a_i*x`.

The safe lower anchor is:

`L = max_i(min_64(f_i) - c_i)`

Every normalized product profile is a convex combination of those 64 retained
coefficients. The extra nonnegative coordinate `t` gives one target row:

`a_i*x - t <= c_i + L - z_i`

Maximizing `-t` produces `M = L + t`. The original nine-coordinate constraints
remain intact. The separate ten-coordinate solver entry point permits at most
101 rows and one objective without broadening the older six- or nine-coordinate
APIs. The adapter requires the original three canonical simplex rows, preserving
the domain needed for the anchor.

The result retains the original augmented matrix, primal and dual certificate,
anchor, target coefficients, active target identities, three normalized profiles
and 64 product masses. It verifies the maximum same-profile excess against the
optimum and checks every original observation before replay. The prior complete
three-profile report is retained without changing its public shape.

## Original numerical replay and limits

Selected targets require resolved existing and proposal geometry endpoints.
One additional complete original numerical replay applies the common profiles
at every source and time. The report keeps original lower/upper temperatures,
paired differences and separate band/ceiling statuses. A numerical replay status
does not alter an exact-model feasibility result.

Only original sampled times are available. The plot contains markers with
actual UTC spacing and no connecting interpolation. There is no continuous-time
guarantee, recovered measured sky history, all-profile target guarantee or
physical intervention validation.

The inquiry admits 3–24 original observations, at most three original sources,
4 bins in each of three shared profiles, two ordered declared changes, at most
24 original intervals and 1–50 distinct original time/component targets. All
targets use the first original receiver; other receivers remain inspectable.

Before geometry or optimization, the whole inquiry reserves its parent work and
one additional complete witness replay. Maximum allowances are 1,980 thermal
courses, 47,520 course intervals, 101 witness profiles, 10,240 linear pivots,
20,000,000 counted linear rational operations and a 64 MiB complete report. The
original arithmetic bit limits remain unchanged. Exceeding any complete-work
allowance refuses the result atomically.

## Verification

Run the focused native gate:

```sh
node --test --test-isolation=none --test-reporter=tap \
  tests/shade-heat-exact-linear.test.mjs \
  tests/shade-heat-three-epoch.test.mjs \
  tests/shade-heat-course-targets.test.mjs
```

Run the actual consumer course with an installed Chrome ELF and active sandbox:

```sh
CHROME_BIN=/opt/google/chrome/chrome node tests/shade-heat-course-targets.browser.mjs
```

The browser course uses the actual worker report as its exact UI oracle. It
checks every retained original target, complete original observation identity,
profile and numerical replay binding; source-only download and fresh reopening;
explicit editing, partial original clocks, invalid files, superseded work and
desktop/mobile views. Independent exact-matrix checking is a separate evidence
gate and does not claim an independently implemented thermal model.
