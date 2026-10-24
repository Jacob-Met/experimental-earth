# Rain integration-method challenge (research-only)

This experiment evaluates [issue #151](https://github.com/Jacob-Met/experimental-earth/issues/151) without replacing the maintained `runRain` implementation or modifying any user's site/observations. Run:

```sh
npm test
node evaluation/numerical-methods.mjs --example > example-method-comparison.json
node evaluation/numerical-methods.mjs evaluation/fixtures/step-sensitive.json > step-sensitive-method-comparison.json
node evaluation/numerical-methods.mjs path/to/ordinary-exported-project.json > site-method-comparison.json
```

It accepts **full regular project JSON** and retains the exact input file's SHA-256, local Git commit, and uncommitted-source flag in its JSON output. It refuses invalid source input, out-of-bounds method declarations, and more than 3 million estimated cell steps. The default rates come from a retained `infiltrationStudy` if present, otherwise the explicitly illustrative [3,9,22] mm/h. The work is read-only; the original source file is not changed.

For each declared rate and each 5 / 2.5 / 1.25 / 1-minute **outer interval**, the comparator runs identical existing/proposal cells, weather and rate under:

1. **Incumbent:** the actual maintained `runRain` solver with explicit synchronized, donor-capped transfers.
2. **Two substeps:** a separate, independently callable constant-rate solver that divides rain/absorption, neighbor flux and boundary exit into two equal time substeps, recomputing water heads between them.
3. **Internal numerical reference:** the same substep solver with a 1-minute outer interval and four subdivisions. This is a *numerical reference only*, not observed truth or a physical correctness guarantee.

The benchmark includes per-metric signed proposal-minus-existing effects, their directions and sign changes, absolute deviations from the internal numerical reference, and cases where substepping moves **farther** from that reference. It also reports water-balance error, nonnegative final depths, actual cell steps and local wall-clock runtimes. Measured timing is device/runtime dependent, may include JIT warmup, and is not a production speedup. The 1-minute lower limit applies to the **incumbent's supported user-selected interval**, not to this separate hypothetical research integrator's internal substeps.

**Important metric qualification:** max cell depth tracks intermediate pre-transfer peaks, whereas peak total storage is sampled at outer interval ends, matching the maintained metric; finer internal peaks are separate diagnostic data. The base substep=1 control matches the maintained fixed-rate `runRain` across ordinary cells, a sourced closed edge and a declared crest. Tracer, water-origin provenance, dynamic wetting-front infiltration and any unimplemented physical processes are *not* compared or replaced; those consumers retain the maintained core. Weather changes after a retained source observation do not automatically constitute real site measurements.

Interpret `referenceAgreementCounts` as a diagnostic of the *chosen numerical reference*. A method moving closer on one authored model is not intrinsically more physically accurate; differences can also reflect how precipitation is distributed within outer intervals. Actual field receiving, method validity across terrain/flow regimes, a complete original-consumer compatibility check and model calibration would be prerequisites to considering adoption.


## Reproduced authored counterexample

The checked-in 2x2 fixture retains the pre-existing step-sensitive terrain and three
fixed turf-rate hypotheses, with a single grade edit in the proposal. Running the
CLI on it reproduces the signed **proposal-minus-existing edge-outflow** differences
(in liters) below. The original method at 5 min appears to increase outflow for
the 24 mm/hour hypothesis; the two-substep method at 1.25 min changes that
classification to decreasing outflow. This is a numerical decision counterexample
**inside a hypothetical model**, not physical flood evidence.

| Outer step | Maintained incumbent | Two internal substeps |
| --- | ---: | ---: |
| 5 min | +0.235169 | +0.139625 |
| 2.5 min | +0.139625 | ~0 |
| 1.25 min | ~0 | -0.242034 |
| 1 min | -0.194139 | -0.358769 |
| 1 min x four substeps (internal reference only) | - | -0.406838 |

The larger 8x6 authored example with rates 3/9/22 produced 46 of 48
step x metric x rate comparisons closer to the internal reference under the
two-substep method, with **two cases farther away**. These counts cannot be
interpreted as real-world accuracy, convergence guarantees or independent data.
