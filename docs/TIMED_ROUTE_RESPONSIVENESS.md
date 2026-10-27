# Timed route replay responsiveness

This focused change removes repeated whole-replay validation from one timed-route inspection. It preserves the retained linear model and the scalar snapshot API. Original route and replay ownership remains unchanged; the bounded responsiveness follow-up is tracked by claim `experimental-earth-timed-route-responsiveness-dae856c9`.

## Problem and approach

Previously, inspecting each declared arrival called `snapshotDepths`, which validated every cell in every retained snapshot each time. At 128 route cells, 576 site cells and 721 snapshots, that repeats roughly 53 million depth checks. The ordinary three-cell query is small, but the maximum supported route creates a noticeable synchronous pause.

`snapshotDepthsAtMinutes(result, minutes)` validates the complete replay once per query and then samples all requested times through the same private interpolation helper used by `snapshotDepths`. `inspectTimedRoute` uses those sampled rows at its cumulative arrival times. There is no persistent validation cache: a subsequent query validates the current source again.

## API and compatibility

- The existing authoritative replay validator runs before batch-list validation, including when both inputs are invalid.
- A batch contains 1–128 own, dense array entries. Every requested minute must be finite and inside the retained horizon.
- Requests may be unsorted or repeated; output order matches input order. Each returned depth array is independent of the source and other returned rows.
- The scalar `snapshotDepths` signature, validation order, error behavior and interpolation arithmetic are preserved.
- Timed traversal still uses declared cumulative arrival times and the same threshold comparison. No timing is inferred and no project or replay evidence is changed.

The batch eagerly samples all requested times before the inspector checks route-cell bounds. A request containing both an out-of-range cell and a later out-of-horizon arrival may therefore report the horizon error first. It remains refused. For example, a replay spanning 0–20, departure 20, route `[99, 1]` and step `[1]` now reports the invalid arrival at 21 before the invalid cell at 20. This narrow failure-priority change is intentional; it does not admit the request.

This change does not harden previously identified sparse source or route inputs, alter the authoritative validator, add a long-lived sampler, or change the modeled exposure intervals.

Batching retains all sampled rows until the inspection finishes. At 128 requests and 576 cells this is 73,728 numeric entries, approximately 0.56 MiB when counting eight bytes per number. That is a bounded numeric-payload estimate, not a measured JavaScript heap allocation; array storage, runtime representation and garbage collection add costs.

## Receiving evidence

The [paired execution receipt](receiving/timed-route-responsiveness-dae856c9/paired-receipt.json) records baseline commit `3033ca20391a1776f7f7bc9075413236d030bffa`, the candidate source/test/evaluator manifest, raw samples, output hashes and execution handles. Candidate command `estate-dae856c9-20261027-performance-verify-03` completed with exit code 0. Its production source SHA-256 values are:

- `ponding-exposure.js`: `b998b4a73d9667f4440c4f4bd1684c5e29f2256a5eb1e5f95eea5de90b197ad1`
- `route-traversal.js`: `eb9865b048eddcabb828c2a2f9bb857e08cd560cc16fd1b80b0ddae0b500cdb3`

The full native suite passed **1,442 tests**, with zero failures or skips. The independent real-browser receiving course passed **11 checks**, including the nonzero maintained-example comparison, analytic controls, exact arrivals, horizon refusal/recovery and source custody. A disposable negative control bypassing batch source validation was rejected by four intended assertions covering full-result validation, source-first precedence, mutation between calls and the traversal consumer. The mutation was not part of the delivered source.

### Measured response times

Native values below time the full paired existing/proposal traversal query, including exposure windows and requested-arrival inspection. Each case used three warmups and ten measurements; first-call timings are retained separately in the receipt.

| Native workload | Baseline median (ms) | Candidate median (ms) | Baseline maximum (ms) | Candidate maximum (ms) |
| --- | ---: | ---: | ---: | ---: |
| Default three-cell route | 0.442942 | 0.697516 | 1.889216 | 1.451155 |
| Default 48-cell route | 1.6714665 | 0.265487 | 1.910919 | 0.293505 |
| 128-cell route, 24×24 grid, 721 snapshots | 630.345963 | 16.4478515 | 635.906216 | 19.506795 |

All native result hashes matched between baseline and candidate. The small three-cell median increased by approximately 0.255 ms in this run; this is mixed small-case evidence, not a speedup at every workload size.

For the same maximum-case project imported through the actual application, synchronous browser submission fell from **676.5 ms median / 713.6 ms maximum** to **20.3 ms median / 21.5 ms maximum** across five measurements after one warmup. That is approximately **33.3× faster**, or a **97.0% reduction**, for this measured workload. The displayed result text and imported-file SHA-256 matched across runs. Both browser runs reported active sandbox admission and zero script exceptions.

### Reproduce with the frozen evaluators

Run from the candidate repository root:

```sh
npm test
CHROME_BIN=/usr/bin/google-chrome node tests/route-traversal-oracle.receiving.mjs
node tests/benchmarks/timed-route-latency.mjs "$PWD"
node tests/benchmarks/timed-route-browser-latency.mjs "$PWD"
```

To measure a separate baseline checkout, invoke these same evaluator files with that checkout's absolute path as the argument. The native evaluator SHA-256 is `f005b5c7c9bc739520ceb6907c290d273ba5fc8ca55114528d3dc9a1e5f9bd0c`; the browser evaluator SHA-256 is `b39ab60e763aa75fe513a7d2f0a59dd38c06d24cfece64f73f255fcb0eb28127`. Their bytes were unchanged between paired runs. The browser benchmark uses `/usr/bin/google-chrome` and preserves the maintained sandbox gate.

These are measurements on one host and three native workload sizes, not universal speed guarantees. Imports, solver generation and route setup are excluded from the timed regions. The additional next-animation-frame timing in the receipt measures a rendering opportunity, not completed paint. The benchmark's file-byte check establishes preservation of the original imported bytes, not custody of every in-memory application value; separate receiving checks cover their controlled source fixtures. Numerical correctness and responsiveness evidence concern the retained-snapshot consumer and do not validate physical flood conditions or safe traversal.
