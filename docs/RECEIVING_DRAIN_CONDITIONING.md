# Use an original drainage reading to constrain a receiver

An additional whole-receiver drainage reading now constrains the optional
never-filled inverse before its candidates reach the original-map check. This
addresses an observed failure: useful new calibration evidence could previously
eliminate every finite proposal, even when an admissible receiver generated all
the original readings.

The existing **Include filled and never-filled alternatives** action uses this
constraint automatically when the copied original account includes cumulative
drainage calibration readings. Enter the reading, its time, source and uncertainty
in the ordinary whole-receiver account form, then explicitly copy the current
account into the inference investigation. An already copied investigation keeps
its own original source until that explicit copy. No extra parameter form or
invented retained-water reading is required.

## What the evidence establishes

The method was frozen before the contributor fitting it received eight newly
authored parameter tuples from an independent contributor. The independent
forward-model validation admitted seven under its predeclared source rules; one
had a negative recorded retained-water center and remains preserved as excluded.
All seven eligible original sources were evaluated, including both failures.

| Identical original sources | Calibration-compatible cases | Cases with a candidate also compatible with both later receiver readings |
| --- | ---: | ---: |
| Original band search | 1 / 7 | 1 / 7 |
| Qualified phase alternatives before this change | 1 / 7 | 1 / 7 |
| Drainage-conditioned phase alternatives | 5 / 7 | 5 / 7 |

These are independently authored model controls, not measured field validation.
The count means that at least one finite candidate satisfies every original band;
it does not identify the correct parameters, select a predictor, enclose all
compatible receivers or establish real environmental accuracy. Cases
`drain-new-03` and `drain-new-08` remain unresolved. No numerical method was changed
after these eight tuples were released.

The maximum complete reservation was 468,167 cell-equivalent steps. The seven
new-method evaluations took 698.396 ms in the recorded Node run. This local timing
does not establish a browser latency guarantee. The preserved independent record
is `experiments/independent-drain-comparison.json`, with every original, candidate,
refusal and baseline result. Its method freeze is
`experiments/drain-independent-method-freeze.json`; the original tuples, independent
forward validation and unchanged validator are adjacent files.

## Conditional mechanism

The existing never-filled conditional course assumes the same declared uniform,
isolated receiving layer and constant storm as the preceding phase mechanism.
The physical forward kernel, final original-map comparison, recorded uncertainty
bands and original rows are unchanged. Infiltration and the conditional dry time
still come from the supported original surface course. This does not infer an
unobserved wet surface or replace an original drainage reading with a derived
retained reading.

Let `k` be drainage per hour, `S0` initial receiving water per unit area, `T` storm
end and `U` the conditional end of surface ponding, all in consistent hour units.
The never-filled inventory is `S(t) = S0 exp(-kt) + S_input(t)`. The accumulated
inflow `I(t)` is the original constant rainfall-limited input until `T`, followed
by infiltration-limited input until `U`. Conservation gives

```text
D(t) = S0 (1 - exp(-kt)) + I(t) - S_input(t).
```

For every positive-time original drainage calibration band, this equation gives
an interval for `S0` at the current computational rate. Intersect that interval
with the original retained-water constraints and the original allowed initial
water range. Values are converted from liters to depth using the declared
receiving area exactly once. `expm1` evaluates the small exponential differences.
At time zero the drainage coefficient is zero, so that row cannot constrain
`S0`; it still binds every candidate in the final complete original-map check.
An impossible positive drainage reading at time zero therefore cannot pass.

The nine original rates remain. A positive-time drainage calibration row also
activates a bounded scalar refinement: search each of the eight adjacent rate
gaps with 48 golden-section updates, scoring the signed difference between the
intersected initial-water lower and upper bounds. Retain one additional best
finite computational rate. This is a finite search aid, with no assumption that
every gap is unimodal and no global or exhaustive-coverage claim.

The maximum is 409 rate evaluations: nine original evaluations plus two initial
evaluations and 48 updates in each of eight gaps. At most ten rates produce three
initial-water representatives and two explicitly arbitrary capacity witnesses,
for at most 60 never-filled proposals. Together with the unchanged 30 filled
starts this reserves 90 extra proposals, before deduplication. The incumbent's
three final candidates bring the complete final-map reservation to 93 checks.
All original-band intersections, inverse work and final-map work are reserved
before any producer runs. The paired-layout consumer incorporates that expanded
reservation before fitting or running either layout.

Only calibration rows enter this search. Candidate provenance includes all
original retained and drainage calibration indices and distinguishes the refined
rate from the nine fixed starts. Held-aside values can contradict frozen
candidates; they cannot change the rates, parameters, calibration support,
reserved work or measurement questions. The displayed capacities remain arbitrary
witnesses above the modeled never-filled inventory, not capacity estimates.

## Failed approach and development evidence

Before implementing this constraint, the same predeclared additional-drainage
rule was applied to the already consumed sixteen phase courses: one original
cumulative-drainage calibration row at the later retained-reading time with
half-width 0.02 L. Later held retained and drainage readings were unchanged.
The old band and phase searches supported only one of sixteen courses.

Intersecting the new drainage band at only the original nine rates improved
support to two of sixteen. That failed first method and its exact source are
preserved in `experiments/drain-conditioning-first-failure.json`. Its valid-rate
interval could fall between the fixed rates. The bounded refinement described
above improved this consumed development comparison to fourteen of sixteen,
including later held support. `phase-07` and `phase-14` remain unresolved. This
development result is separate from the seven independently qualified inputs.

The failed method was not removed or retroactively described as a success. The
scalar method, comparison and frozen source hashes are preserved in
`experiments/drain-conditioning-scalar-method.json` and
`experiments/drain-conditioning-scalar-result.json`. The independent comparison
loads the exact qualified predecessor source, relocating only module imports,
and checks that every other numerical dependency matches its frozen hash.

## Actual consumer and negative controls

The existing original-account form was exercised in the maintained browser
application. Before adding drainage, the authored never-filled example admits
twelve calibration candidates, six also supported by the held readings. After
entering and explicitly copying the additional original drainage row, it admits
twelve calibration candidates, ten also supported by the held readings. All
twelve reach the paired-layout consumer, which performs 72 comparison runs and
retains the two held failures. Every original row survives source-only download
and a fresh browser reopening; no fitted result is stored as authoritative input.

The 19-group browser course retains the earlier phase, band and paired receiving
checks and adds original-form entry, explicit copy isolation, drainage-conditioned
replay, changed-held independence, contradictory original drainage and complete
expanded-budget refusal. Desktop and 390-pixel layouts were inspected. Chromium
ran as an unprivileged user with its namespace and seccomp sandbox active. The
qualified receipt records no browser errors or failed application resources.
These are local composed-application results, not a merged or installed release.

One earlier browser attempt failed because the harness read a lazily created
details panel before its toggle handler had rendered it. The harness now waits
for that existing panel content to attach before applying the unchanged semantic
assertion. The original failure remains in
`docs/receipts/drain-conditioning/browser-first-harness-failure.json`. No product
numeric tolerance or success condition was relaxed.

The new native controls use independently integrated piecewise ODE originals
before, during and after the storm/ponding phases, across eight rainfall and
initial-water combinations. They also challenge held-row misuse, contradictory
calibration, impossible time-zero drainage, all-producer budget preflight,
full-source replay and the actual paired consumer. The prior phase controls remain
in force. Exact commands, source hashes and subsequent current-main composition
receipts accompany the qualification packet.

## Remaining capability

Useful original drainage evidence now reaches the never-filled generation
mechanism, with improved independent finite-witness coverage. The two unresolved
new courses and two unresolved development courses remain the next mechanism
question. They must be investigated through the filled-course inverse and actual
original observations, without counting a larger search, a fallback or a merely
plausible curve as an identified physical receiver.
