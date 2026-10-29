# Receiving-layer witnesses from original measurement bands

The optional **Search the original calibration bands** action finds receiving
layers that the analytic calibration-center proposals can miss when original
readings have small, declared uncertainty. It fits capacity, initial water and
drainage together. It retains the analytic family and checks every numerical
candidate on the complete original site before reporting any support.

The maintained consumer contains an authored uncertainty example. Run the
analytic proposals first: every central proposal contradicts a calibration
band. Run the band search: three finite numerical witnesses pass every
calibration band and the separately held readings. Inspect either family,
every original reading and the explicitly offered next measurements. Saving
and reopening retains original inputs and recomputes the selected method.

This is a bounded local witness search. Failure is unresolved; success does not
establish unique material parameters, continuous uncertainty coverage, field
accuracy or automatic adoption.

## Original evidence and domain

The existing original-project and receiving-account admission is reused:

- An original scenario, known surface and explicit whole-footprint association.
- One declared uniform receiving layer, initially dry surface, constant
  positive event rain followed by a dry period.
- Zero lateral water mobility and zero surface-boundary outflow.
- Receiving readings and offers at exact maintained solver endpoints.
- Original calibration and held-aside roles; no derived receiver values are
  inserted into either original channel.

The numerical search uses capacity from `1e-10` to `10000` mm, drainage from
`1e-10` to `100` per hour, and initial-water fraction from zero to one. Zero or
smaller positive capacity/drainage are not covered by this positive numerical
parameterization. The original analytic producer and its explicit physical
boundaries remain visible separately.

## Numerical mechanism

The variables are `log(capacity)`, `initial water / capacity`, and
`log(drainage)`. Each trial is constructed inside the declared domain and is
forwarded through the maintained model. A refused analytic root is never
clipped into an accepted receiver.

For each original calibration row, form the signed model residual divided by
its declared half-width, using the maintained floating comparison scale when
the half-width is zero. The objective uses the portion outside a normalized
interior target of ±0.98. That interior target does not enlarge a measurement
band or replace the final full-site evaluator. These are numerical objective
weights, not independent standard deviations or likelihoods.

Each iteration uses central finite differences, with coordinate increment
`1e-4 * max(1, abs(coordinate))`. The damped step solves the augmented system

```text
[ J                              ] delta = [ -residual ]
[ sqrt(lambda) * diagonal(scale) ]         [ 0         ]
```

where each scale is at least one and otherwise the norm of its Jacobian column.
The solve reuses the unchanged column-normalized, two-pass QR primitive from
WORLDLAW. See [the pinned dependency](../vendor/README.md). No normal-equation
or zero-coefficient fallback is introduced. Nonfinite arithmetic is refused.
The coordinate step is bounded, and only an objective decrease accepts a trial.

At most three starts and thirty iterations are permitted. When an original
storm-end depth and three distinct late drainage calibrations resolve the
drainage-curve rate, the starts use initial-storage fractions zero, one-half
and one. For each start, the maintained exact water kernel solves the original
storm-depth center for capacity using 56 bisections. These are computational
starts, not accepted inverses or assumed initial water. A valid drainage-curve
rate can still supply a numerical start when the analytic capacity branch
refuses. Otherwise, the search uses up to three calibration-ranked positive
analytic proposals.

Every original calibration row constrains the ensuing fit, including rows not
used to construct a start, duplicate-time readings and observations on other
surfaces. The coefficients for all searches are frozen before held values are
read. Held values cannot choose starts, change a fit, rank an offered
measurement or rescue a calibration contradiction.

## Reusing the full model efficiently

Under the admitted uniform, zero-flow conditions, every selected cell has the
same surface and receiving course. The search evaluates four identical cells
with the unchanged `runRain` implementation and scales receiving totals by
the original selected-cell count divided by four. Unselected surface readings
are parameter-independent; one full original-grid run supplies their fixed
predictions when needed.

After fitting, every candidate is run again on the entire original grid.
Only that full run supplies the reported calibration bands, held readings and
offered measurements. A reduced-course witness cannot confer full-site
support. A native negative control deliberately corrupts the full-site result
after a reduced witness is found and confirms that support becomes zero.

## Complete work reservation

Before any analytic inverse, kernel or forward-model evaluation, the action
reserves all of:

- The complete existing analytic family.
- Three starts × `(1 + 7 × 30)` = 633 reduced model trials.
- Up to one fixed-surface full-grid run and three final full-grid runs.
- Up to 174 exact seed-kernel calls and 128 drainage-rate bisections.

Full-grid cell-steps, reduced four-cell steps and seed-kernel calls count toward
one million cell-equivalent steps. An excessive complete request refuses
before the incumbent or any fitted prefix runs. Offer ranking retains its
separate existing pair-work limit.

The received 48-cell mixed-surface browser case reserved 454,638 cell-equivalent
steps. It executed 255 reduced trials, three final full-site checks and 174
seed-kernel calls. Two searched candidates passed calibration; one also passed
the held measurements. This demonstrates a complete maintained consumer on a
larger original site, not merely a reduced-model result.

## Qualification and observed limits

The method was fixed before the first evaluation of a separate authored
144-tuple grid. Eligibility was selected from the authored truth before
inversion: positive storm-end surface depth, a full receiver at storm end and
a dry surface by the first receiver reading. Seventy courses qualified;
seventy-four remain excluded with their actual reasons. Geometry had twelve
mixed-surface cells and eight selected receivers, with parameter values,
original observation times, area and perturbations different from development.

| Evidence set | Eligible courses | Analytic calibration support | Numerical calibration support | Numerical support after held readings |
| --- | ---: | ---: | ---: | ---: |
| Separate authored mixed-surface grid | 70 | 2 | 70 | 62 |
| Consumed development perturbation set | 184 | 0 | 181 | 165 |

The eight held failures in the separate grid remain failures. The three
development calibration failures and sixteen development held failures are
not promoted by a fallback. The development set is not an independent holdout.

All 176 calibration-compatible numerical witnesses in the separate grid were
scored after fitting against authored truth, without choosing a preferred
returned model. Median / maximum absolute errors were 0.002309 / 0.008931 mm
for capacity, 0.000399 / 0.004731 mm for initial water, and 0.0000571 /
0.0006156 per hour for drainage. These narrow authored cases do not establish
accuracy on real soils or arbitrary source uncertainties.

Executed verification:

- 28 combined native tests: eight new behavioral groups, six existing account
  groups, eleven analytic-inverse groups, and three receipt checks.
- Nine new actual-browser groups, including original-file download/reopen,
  both held channels changed, contradictory calibration, forged saved results,
  missing basis, complete-work refusal, separate parent-source custody,
  delayed-file and queued-computation retirement, and the 48-cell input.
- Ten existing analytic-inverse browser groups against the composed consumer.
- Active Chromium sandbox, zero page errors and failed resources in the passing
  courses; desktop and 390-pixel layouts visually inspected.
- Independent scoped numerical and consumer source reviews by the retained
  SECOND GROUND contributor, without claiming a second execution of the tests.

An initial negative-control fixture failed its own dry-regime eligibility
assertion. It was replaced with the first truth-eligible member of the already
declared grid before inspecting any inverse result; production method bytes
were unchanged. The first browser course could not mount because the new QR
module was outside the maintained server's exact nested-asset list. Its 404
receipt is retained. Adding only that required module allowed the passing
course; no directory-wide access was enabled.

The composed runtime preserves all sixteen changed runtime files from main
`b28dbec5e7339eb024bb7332dca88f5ce35c0b82`, checked against their Git blob hashes.
None overlaps this contribution. This is a locally qualified API-derived
runtime snapshot; it is not a full repository checkout, a CI run, a merge or
an installed deployment.

## Reproduce

```sh
node --test --test-isolation=none \
  tests/receiving-account-band-fit.test.mjs \
  tests/receiving-account-proposals.test.mjs \
  tests/receiving-account-evidence.test.mjs

node tests/receiving-account-band-fit.receiving.mjs
node tests/receiving-account-proposals.receiving.mjs
```

The browser commands require the existing Playwright/Chromium paths and the
maintained full-sandbox receiving setup. Receipts under
`docs/receipts/receiving-bands/` retain exact sources and the informative first
failures. The source-only format is
`experimental-earth-receiving-account-band-search/1`; its only fields are
`schema`, `project`, `selection` and `account`. Saved candidates or conclusions
are refused.

Continuous feasible-region coverage, arbitrary forcing, lateral flow,
heterogeneous receivers and measured-field qualification remain unresolved.
The finite numerical starts do not prove that another compatible receiver
does not exist, even when only one returned candidate survives.
