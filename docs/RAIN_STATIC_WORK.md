# Rain simulation fixed-geometry work

Issue [#324](https://github.com/Jacob-Met/experimental-earth/issues/324) reduces repeated work in the maintained `runRain` consumer. Each synchronous run resolves cell elevations, infiltration declarations and open/crest edges once, preserving original pair order and trace indices. It reuses two zeroed scratch arrays between steps and avoids the crest allocator when no effective crest exists. The arrays and declarations are rebuilt on every call, including when the caller edits the same project object.

This changes no time step, model limit, runoff equation, infiltration precedence or output schema. The ordinary comparison, infiltration observation query and placement consumers use it without a new API or cache.

## Measured decision

The original baseline is `655b842d1f00afbc78ffd4ab7f84691fe0a6485e`, core blob `3543b403766510fede61f8fca05ab6d13197981a`. The selected candidate core blob is `08679e473182a5ab5c957c432777ba2a069371a1`. Final integration checks include the temperature-table main revision `80ec1b84bbe2846bd34aaf3206f5dc4add0e7516`.

A Linux x64 Intel Xeon host with four reported CPUs and Node 22.23.4 ran five alternating fresh-process pairs per workload. Each process measured first use separately, performed eight warmups, then used the same fixed repeat count. Every output hash agreed. All samples, CPU time and whole-process peak RSS are in [the benchmark receipt](receipts/rain-static-324-benchmark.json).

| Maintained consumer | Original warm median | Candidate warm median | Original / candidate |
| --- | ---: | ---: | ---: |
| Example courtyard comparison | 0.860 ms | 1.025 ms | 0.84× |
| Infiltration observation query | 23.167 ms | 17.896 ms | 1.29× |
| 24×24, 720-step open comparison | 108.370 ms | 67.935 ms | 1.60× |
| 24×24, 720-step crest comparison | 152.489 ms | 79.977 ms | 1.91× |

The small courtyard warm case regressed by 0.165 ms. The larger comparisons and repeated inference work justify the selected implementation; this is not an across-the-board speedup claim. First-use medians were 10.045→8.087, 92.219→91.706, 191.744→129.783 and 247.261→177.440 ms respectively. Median whole-process peak RSS ranged from about 78–165 MiB for the candidate, with mixed differences from baseline; no memory reduction is claimed.

An alternative using separate closed-edge and crest arrays was tested and rejected. Its warm speed ratios were 0.77×, 1.34×, 1.48× and 1.67×; it was slower than the selected representation in three workloads and had a slower first-use inference median. These are environment-specific engineering measurements, not physical-model validation.

## Receiving and reproduction

```sh
# Use a separate checkout of the pinned original revision.
node evaluation/rain-static-comparison.mjs --parity /path/to/original
node --expose-gc evaluation/rain-static-comparison.mjs --benchmark /path/to/original

# Normal native suite, then the actual browser consumer.
node --test --test-concurrency=2 tests/*.test.mjs
CHROME_BIN=/usr/bin/google-chrome-stable node evaluation/rain-static-browser.mjs
```

The comparison course requires the exact original core blob and a changed candidate. It compares complete outputs for 162 authored cases spanning ordinary rain, overrides, wetting fronts, closed stores, draining layers, budgets, tracing and origin attribution. Six edits reuse the same object and must both change the result and match the original implementation. Wrong baseline, unchanged candidate, corrupted result and invalid options were exercised as negative controls. The existing placement comparison adds 19 full-output courses.

The final combined tree passed all 1,090 native tests and 19 actual browser receiving groups. The browser edits the map and rain, reloads and reopens original projects, compares and challenges infiltration evidence, imports unit tables, enumerates 79 placement alternatives and explicitly adopts/reopens a proposal. No application exceptions were observed. Desktop and 390px rendering were inspected.

The browser runner uses the maintained isolated session and sandbox admission. This host's `/usr/local/bin/google-chrome` wrapper silently added `--no-sandbox`; admission refused it before product navigation. The direct installed executable passed all required protections without changing the helper or host security. Local CLI tests also encountered a child-process sandbox restriction; the native passing result is from the authorized Linux execution host.

[The receiving receipt](receipts/rain-static-324-receiving.json) retains source pins, case hashes, actual checks and sandbox evidence. These tests establish software parity and the maintained consumer path. They do not establish field accuracy or unique physical inference.
