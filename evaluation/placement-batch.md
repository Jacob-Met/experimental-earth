# Reuse unchanged site runs during complete placement comparisons

Issue: [#253](https://github.com/Jacob-Met/experimental-earth/issues/253). Integration baseline: `3a56627d99c72cf7434540f605c807ed6c5bd386`, including the incoming draining-layer change. Evaluation: 2026-10-25.

## Product change

The placement consumer previously reran the unchanged existing site for every proposed layout and declared infiltration rate. It now creates one local intervention evaluator and retains at most nine existing-site runs, keyed by complete ordinary source data and the surface/rate override. Proposal runs, evidence filtering, duration exposure, local constraints, ranking, adoption and conservative work admission retain their existing behavior. The hydraulic solver is byte-identical to the baseline.

Changing the existing site, dimensions or weather clears retained runs. Returned comparison reports contain newly constructed values, so caller edits cannot alter retained hydraulic results. Accessors, non-enumerable data, custom serializers, cycles and unsupported programmatic metadata use the unchanged uncached path. No result is saved in a workspace or reused between placement invocations.

For the ordinary 79-layout, three-rate comparison with no evidence filtering, the call structure changes from 474 hydraulic runs to 240: three existing-site runs and 237 proposal runs. This is a count derived from the implementation, not a measured speedup prediction. All 79 layouts and all three rates remain present.

## Observed comparison

Five alternating fresh-process pairs per workload on Node 24.22.1, Linux x64, Intel Xeon Platinum 8573C. First-use latency is recorded separately, followed by four further warmups and fixed repetitions of complete maintained consumers. Every timed process produced the same full-output hash as its baseline. Raw samples and source hashes are in `placement-batch-benchmark.json`.

| Maintained workload | Baseline median | Batch median | Ratio |
| --- | ---: | ---: | ---: |
| 79 layouts, three rates | 187.27 ms | 121.11 ms | 1.55× |
| 11 layouts with duration constraints | 40.55 ms | 22.77 ms | 1.78× |
| Six small layouts, five rates | 5.57 ms | 4.58 ms | 1.22× |
| Duration comparison across calculation intervals | 205.99 ms | 150.94 ms | 1.36× |

This is a shared execution host, with load recorded in the receipt; absolute latency and ratios vary. The preceding complete-consumer series measured 207.73 → 122.76 ms (1.69×) for the 79-layout workload. That original series is retained in `placement-batch-initial-benchmark.json`, including unchanged direct-solver consumers whose timing variation is noise, not an algorithm change. Peak RSS and CPU samples are retained for both trees. Peak RSS covers the entire fresh process including imports and warmups, rather than isolated cache memory. The bounded cache adds retained model state; the measurements do not establish a general memory reduction.

## Correctness and receiving

- **926/926 native tests**, zero failures, skips or cancellations. The integration baseline has 918 tests, including the 14 incoming draining-layer tests. Eight new tests cover distinct proposals, source mutation, rates/scopes, changing evidence, report mutation, refusals, unusual programmatic inputs and accessor behavior. Command and log digest are in `placement-batch-native-tests.json`.
- **19 exact full-output comparisons**, including 256 layout outputs across the first 18 cases and one complete duration-resolution report. Twelve authored seeded sites vary grid dimensions, terrain, closed walls/finite crests, materials, weather, rates, targets and duration goals. These are computational controls, not field measurements. Evidence cases retain calibration, held-aside rejection and missing-calibration outcomes. Changed source changes the plans; a deliberately altered result status fails the parity oracle. See `placement-batch-parity.json`.
- **12 browser receiving groups passed** through `tests/placement.browser.mjs`, including real 79-layout enumeration, changed objectives and eligibility, observed-proposal protection, explicit adoption, reload, narrow display containment and absent-material controls. Chrome 156 ran as the ordinary device user through `/opt/google/chrome/chrome`; the maintained namespace/seccomp sandbox check admitted it. `placement-batch-browser.json` retains the actual receipt, loaded source hashes and sandbox observation. This is an isolated native application receiving run, not a production deployment claim.

## Reproduce

Create a separate checkout of baseline commit `3a56627d99c72cf7434540f605c807ed6c5bd386`, then run from the candidate checkout:

```sh
node --test --test-concurrency=2 tests/*.test.mjs
node evaluation/placement-batch-comparison.mjs --parity /path/to/baseline
node evaluation/placement-batch-comparison.mjs --benchmark /path/to/baseline
CHROME_BIN=/path/to/sandbox-capable/chrome PLACEMENT_RECEIPT_DIR=/tmp/placement-receiving node tests/placement.browser.mjs
```

The native test and benchmark harnesses require permission to start child processes. In this execution environment the default local sandbox refused those subprocesses; the complete suites above ran through the authorized native route. A remote Chrome wrapper initially supplied `--no-sandbox` and was correctly refused by the maintained harness; the installed native executable passed without changing the check or security configuration.

## Rejected approaches

Four low-level solver-layout experiments were investigated before this change. Reusing edge/transfer scratch state preserved numerical output but produced inconsistent workload performance, including regressions in ordinary courtyard and infiltration runs. Two complete measured series are retained in `placement-batch-rejected-experiments.json`. None of those core changes is included. Their improvement on some workloads was insufficient evidence to replace the maintained solver. This batch change addresses duplicate complete work at the existing consumer boundary instead.

The conceptual environmental model and its limitations are unchanged. Faster exact enumeration is not evidence of physical accuracy, a larger admissible search, or a field recommendation.
