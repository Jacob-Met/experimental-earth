# A measured drainage course challenges the missing surface-state assumption

The maintained immediate dry-reservoir prediction missed the reserved latter half of an author-published soil-column recession. A delayed exponential fitted only to the earlier half reduced that reserved rate RMSE from **1.0480 to 0.1812 mm/hour**. The unchanged coupled surface/receiver kernel can reproduce the delayed curve exactly when given **hypothetical 0.3830 mm remaining surface water**. This evidence therefore does **not** establish that a new drainage law is needed, or that such surface water was present.

The engineering decision is to retain the maintained kernel, keep original surface-state evidence distinct from drainage-rate evidence, and preserve the adverse immediate-dry and viscous-tail results. An unobserved surface state must not be silently replaced by a physical-mechanism conclusion. Initial-ponding implementation remains with its existing owner, [#42](https://github.com/Jacob-Met/experimental-earth/issues/42); original runoff/storage work remains with [#227](https://github.com/Jacob-Met/experimental-earth/issues/227) and [#305](https://github.com/Jacob-Met/experimental-earth/issues/305).

## What was actually acquired

The source is Christina Bogner's [ViscousFlow repository](https://github.com/ChrisBogner/ViscousFlow/tree/5a3dbeec5bc846dd4198bb96704624dfe2e5cfde), pinned at commit `5a3dbeec5bc846dd4198bb96704624dfe2e5cfde`. Its `data/drainage.rda` Git blob is `2f9c9d3ff923d27da08f911092ea67bfb4c8df3a`; downloaded bytes were verified against that exact blob hash. The original binary SHA256 is `dc923b6060700d8075236f664f6f4646ea006d12d49db1c283b84062e6dd1cdc`.

The author's README identifies packed column C1: 15 cm diameter, 30 cm high, initially saturated from below and drained to field capacity, then irrigated at 10 mm/hour for 64,410 seconds with −10 hPa bottom suction. The associated [Bogner and Germann (2019) paper](https://doi.org/10.2136/vzj2018.09.0168) describes the experimental processing. This package contains an author-processed drainage-rate series, not raw balance readings or original cumulative drainage volumes.

`rdata 1.1.0` decoded 2,184 rows with columns `time_sec` and `q_mmh`, every 30 seconds from 60 to 65,550 seconds. The supplied float values were exported directly to CSV; no smoothing, resampling, clipping or additional rate derivation was applied. Reader warnings concern absent custom constructors for R tibble/readr metadata; its data-frame fallback retained both numeric columns and every row. The author publishes the package under MIT; the included `SOURCE_LICENSE.md` preserves that notice. The full original RDA and exact source documentation remain in the experiment recovery record.

## Frozen comparison and its limits

The protocol was saved before inspecting the numeric drainage values; only column names, timestamp range and spacing had been inspected. The README had already exposed the author's fitted front-arrival result, so this is **development diagnosis**, not independent model-selection evidence or externally administered blind testing.

The plateau level was fixed as the median of the original rows between 0.9 times irrigation end and irrigation end, following the author's prescribed interval. It was 10.0647969688627 mm/hour. All 19 original rows at 30–570 seconds after irrigation end fitted the candidate parameters. All 19 rows at 600–1,140 seconds were reserved for subsequent scoring. No reserved rate selected parameters, bounds, starts, family or training objective.

Three explicit alternatives were compared:

| Alternative | Fitted parameters after the shared plateau | Rate after irrigation stops |
|---|---|---|
| Maintained immediate dry reservoir | Drainage coefficient | Exponential decline immediately |
| Delayed linear decay | Integer-second delay and drainage coefficient | Plateau until the delay, then the same exponential |
| Author's viscous-tail form | Delay; exponent fixed at 3/2 | Plateau, then an inverse power tail |

The delayed alternative has an extra fitted parameter. Deterministic bounded grids and local golden-section refinement were used; this is not a certified global optimum. Positive plateau drainage also requires `k >= q0 / 10000` for the maintained 10,000 mm storage domain. Those implementation details and the difference between checking every returned prediction and every intermediate objective trial are recorded explicitly in `result.json`; the first protocol is retained unchanged.

## Results, including the losing alternative

| Alternative | Earlier-row RMSE (mm/hour) | Reserved-row RMSE (mm/hour) | Derived reserved-interval depth (mm) |
|---|---:|---:|---:|
| Immediate dry reservoir | 0.46049 | 1.04801 | 0.81428 |
| Delayed linear decay | 0.20522 | 0.18121 | 0.66933 |
| Viscous-tail form | 0.96447 | 1.71967 | 0.40383 |
| Original sampled rates | — | — | 0.66010 |

The depth column is trapezoidal integration **only across the sampled 600–1,140 second interval**. It is a derived diagnostic, not measured cumulative drainage or a full event water balance. No source measurement half-width or calibrated error distribution was supplied, so RMSE is not a compatibility verdict or a statistical significance claim.

The delayed fit has `k = 4.071420350471951 /hour` and delay 137 seconds. The exact hypothetical coupled witness uses initial surface depth `q0 × delay / 3600 = 0.3830214402039416 mm`, initial stored water and capacity `q0/k = 2.472060387401662 mm`, and infiltration rate `q0`. The unchanged `advanceDrainingLayer` then maintains equilibrium drainage while that surface water is consumed and follows the same exponential afterward. Across all 38 original tail times, its rates differ from the fitted formula by at most **1.78e−15 mm/hour**, with water balance checked.

This constructed witness proves non-unique explanation within the maintained mechanism. Its surface depth, infiltration and capacity are **not inferred soil properties or original observations**. A distinct transport process, boundary response or another model could also explain delay. The short processed course, imposed suction, long irrigation and absent surface readings do not qualify the full site simulation or the receiving-account inverse.

## Negative controls and reproduction

All parameters were frozen before reserved-row scoring. Replacing the reserved rates by wrong nonnegative values leaves the fitted models unchanged and worsens their scores. An all-zero plateau refuses informative fitting. The actual maintained dry kernel agrees with every returned exponential prediction; the separate coupled witness challenges the tempting but unsupported claim that delay requires replacement physics.

From the repository root:

```sh
node experiments/receiver-tail-c1/evaluate-tail.mjs /tmp/earth-c1-rerun
```

The run preserves the acquired CSV and historical receipts, writing new output only to the specified directory. `experiments/receiver-tail-c1/` retains the source CSV, license, acquisition hashes, timestamp metadata, original protocol, coefficient freeze, full residuals and coupled witness. This result remains a bounded measured diagnostic; the reserved rows are now consumed evidence and must not be reused as a new independent qualification set.
