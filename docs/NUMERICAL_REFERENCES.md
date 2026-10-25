# Numerical references and rejected compositions

The maintained numerical-method receiver compares the incumbent with conserved
substeps on an exported project. A finer numerical result is not ground truth.
This extension adds a separate **analytic equation reference** through the same
CLI, plus a local dry-source counterexample. It does not change `runRain` or
adopt a replacement solver.

## An equation with an independently known solution

Run `node evaluation/numerical-methods.mjs --wet-columns`. The report contains
both original and maintained-substep depths, their errors against the continuous
solution, residuals against the literal discrete recurrence, conservation and
work counts. Existing `--example` and exported-project arguments are unchanged.

The authored site is a flat, closed 2×2 grid with identical rows: sealed paving
on the left and turf on the right. Their maintained infiltration rates are
1 and 9 mm/h. Uniform rain R exceeds 9 mm/h. With mobility k per hour, the
columns remain wet; symmetry removes vertical transfer. Their mean depth m
and left-minus-right depth difference d obey the declared smooth equations

    m' = R − 5             d' = 8 − 2 k d
    m(t) = (R − 5)t        d(t) = (4/k)(1 − exp(−2kt))

The depths are m±d/2. This is an exact solution of the specified conceptual
equations, not a measured environmental response or a hydrological validation.

For h hours, q=1−2kh and an integer number n of equal steps, the maintained
rain/infiltration-before-transfer update has the independent recurrence

    d[n+1] = q(d[n] + 8h)
    d[n] = q(4/k)(1 − q^n).

The report derives these formulas from the maintained surface constants. It
admits only R above both infiltration rates and q≥0 for every requested outer
interval. In this regime d is nonnegative and bounded by 4/k; requested outgoing
water is bounded by 8h while the left cell receives more than 8h after infiltration.
Thus the assumed wet, uncapped regime is self-consistent. Drying, terrain relief,
walls, crests, nonuniform rain and arbitrary initial water are outside this proof.

At R=36 mm/h, k=0.5/h and one hour, the continuous depths are approximately
33.5284822353 and 28.4715177647 mm. Incumbent contrast errors at 5, 2 and 1 minutes
are −0.3049324094, −0.1204801747 and −0.0599973152 mm. The 2-to-1-minute error
ratio is 2.00809, consistent with first-order refinement in this smooth example.
Conservation can be essentially exact while local depth is numerically wrong.
Substep results are checked against the same equations, without copying a solver.

## A dry-source counterexample

`evaluation/dry-source-counterexample.js` models one source with initial depth h
and two empty destinations with ground-head drops 2 and 1 mm, at unit mobility.
Original simultaneous head-based requests are proportionally capped to the
available source depth. Their destination fractions approach 2/3 and 1/3 as h
shrinks. Exact pair-relaxation operations in a forward/reverse half-step sequence
instead approach 1 and 0; reversing the pair order approaches 1/2 and 1/2.
Destination water is included in subsequent pair heads. Every course conserves
supply and remains nonnegative.

This isolates a persistent allocation difference when supply and requested flux
shrink together: the limiter remains active. Smooth-regime splitting arguments
cannot establish equivalence here. It is a local counterexample, not an additional
site solver or a claim that every full-grid discrepancy has this cause.

## Findings carried from separate composition experiments

Before integration, 1,152 authored courtyard grade/rain/mobility cases were run
at six intervals from 5 to 0.25 minutes. Exact pair splitting, flow-only SSP,
full-forcing SSP and an adaptive original-Euler prototype were investigated.
None demonstrated sufficient equal-work consumer benefit for adoption.

The full-forcing SSP comparison used 22 direction-sensitive cases and a
0.0625-minute incumbent reference. At equal Euler-stage counts, SSP 5 minutes
versus explicit 2.5 minutes produced 13 versus 4 reference-sign disagreements;
SSP 1 minute versus explicit 0.5 minutes produced 2 versus 1. The adaptive
original-Euler trial produced 1 disagreement versus 0 for equal-stage fixed
explicit, with mean absolute reference differences 0.24358 versus 0.04154 L.
These selected stress cases are not population failure rates. The fine reference
is not certified converged truth; some retained cases reverse again on further
refinement. The rejected experimental solvers are not added to the product.

## Receiving

`node --test tests/wet-column-reference.test.mjs tests/dry-source-counterexample.test.mjs`
checks the analytic/discrete relations, changed rain/mobility/duration, q=0,
nonmutation, unsupported/dry declarations, dry-source order limits and conservation.
Direct CLI receiving also parsed all 30 analytic rows and reopened an exported
project through the original receiver with its original SHA-256 unchanged.
The source dependency closure was matched against maintained tree
9982d98d26a4fa727d57047df2bc9c15647d15ae. These checks qualify the bounded
numerical examples, not field accuracy or general convergence.


## Archived reproduction of rejected research

The [deterministic reproduction archive](receipts/numerical-reference-20261024/rejected-methods-reproduction.zip)
retains the frozen rejected-method scripts, adaptive builder/runner, exact source
blob manifest and selected-case receipts supporting the negative counts above.
The [source receipt](receipts/numerical-reference-20261024/source-receipt.json)
records the source tree, commands, verification and archive hashes. Extract outside
the checkout and follow README.txt, using the pinned 9982d98 source closure. The
wrapper refuses mismatched blobs and writes generated sweeps only into a fresh
OS temporary directory. No large generated sweeps are committed.

This archive is historical evidence, not a second maintained benchmark. Use the
existing evaluation CLI for current work. Runtime varies with machine/load; exact
case arithmetic is reproducible within floating-point tolerance. Its short course
receives the mechanism but does not reproduce full-course population counts.
