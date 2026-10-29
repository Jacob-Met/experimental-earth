# Question an uncertain starting-water amount

Open a saved instantaneous-batch soil course at `pressure-batches.html`, then choose **Question an uncertain starting-water amount**. The separate `pressure-initial-range.html` page accepts the actual original-input download. It does not infer a physical uncertainty range from that file: the lower bound, upper bound and their source must be declared explicitly.

This inquiry asks whether each offered soil explanation can match all calibration readings using **one common starting surface-water amount**. It keeps the original area, batch sequence, K, A, moisture deficit, initial cumulative infiltration, nominal starting amount and every original reading unchanged. The nominal starting amount must lie within the offered range. It remains visible as a reference point and is never replaced with a fitted estimate.

## What the result means

For each original explanation, the page shows a calibration starting-water interval and a separate held-aside check. One starting amount must satisfy every calibration row together. The held-aside check keeps those calibration constraints and adds the challenge rows; it cannot rescue an explanation that calibration rejected. Editing or adding a held-aside row does not change the calibration search or its arithmetic allowance.

A retained explanation has a checked common starting amount whose modeled readings lie inside the original closed measurement bands. This example is not a unique estimate. The computed outer interval brackets the comparison search; the inner interval, when present, has passing lower and upper constraints under the explicit numerical comparison convention. Exact boundary brackets and a checked example are available in the details panel. These are numerical search results, not confidence intervals or certified error enclosures.

A numerical-contact result has only a comparison-allowance witness, not a witness strictly inside every original band. An unresolved result has not found a common passing witness within the available bracket resolution. Neither is silently promoted to an original-band fit. A rejected explanation either misses a band even at an extreme of the declared starting range or has incompatible lower and upper starting-water requirements.

No calibration rows means the declared interval is still uncalibrated. No held-aside rows means no challenge was performed. No original readings means conditional prediction only. All alternatives retain their original order, and all original rows remain inspectable. Nothing is adopted into the main workbench or saved as a fitted soil property.

## Why one shared amount matters

Consider the mathematical endpoint K = 1 mm/h, A = 0 mm, moisture deficit = 1, initial cumulative infiltration F0 = 1 mm, and area = 1 m². Before the first addition, two fictional readings are:

- At 30 minutes, `2 - sqrt(3)` L with a fictional ±0.01 L band.
- At 60 minutes, `2.8 - sqrt(6.6)` L with a fictional ±0.01 L band.

The first reading permits approximately 0.985935–1.014052 L of starting water. The second permits approximately 1.783614–1.816360 L. Each row fits separately, and the surface readings decrease with time, yet no common starting amount fits both. The supplied conflict example shows those disjoint requirements. A separate slow head-neglected mathematical control remains available; its survival does not make it a validated field explanation.

The other authored example begins with a nominal declaration of zero and offers an explicitly fictional range from 0 to 1.2 L. Its readings were constructed from one common 1 L start under the moisture-deficit-one endpoint. Calibration permits both offered explanations at different starting amounts. The held-aside reading rejects the head-neglected explanation while retaining a common starting range for the endpoint. Both examples are mathematical controls with authored sources and uncertainty, not field observations.

## Which original readings create an incompatible starting range?

When the aggregate lower starting-water requirement lies above the aggregate upper requirement, the inquiry evaluates one shared starting amount between those numerical boundaries. It names an original reading whose modeled surface water is strictly below its fixed comparison band and another whose modeled surface water is strictly above its band. Under the model’s monotone response, the first excludes every starting amount at or below that separator; the second excludes every starting amount at or above it. Together they explain why the two original readings cannot share a starting amount under this explanation and protocol.

The visible account retains each reading’s original ID, time, batch phase, calibration or held-aside role, quantity, unit, declared uncertainty and literal source. It shows the modeled value at the same separator, the original measurement band and the separate fixed range-comparison allowance. It does not fit either reading independently, change its evidence role, identify a physically faulty observation or claim an exhaustive inventory of conflicts.

Both strict violations must be present in the actual numerical prediction. Bracket ordering alone is insufficient. If either witness is absent, or the same row would serve both directions, the complete inquiry refuses instead of manufacturing a pair. The usual numerical monotonicity checks also include this new prediction. Endpoint refusals already identify the original rows that fail at the smallest or largest declared start; those refusals do not receive an invented pair. A retained explanation receives no conflict certificate.

The extra prediction uses the existing cached, cancellation-aware evaluator and replaces the passing-witness branch. Each stage needs one separator query instead of up to three passing-witness attempts, so the existing conservative evaluation and kernel-advance caps remain unchanged. This is conditional numerical evidence under the declared arithmetic convention, not a certified error enclosure.

## Search and numerical boundary

Under one fixed admitted explanation and batch sequence, later surface water is nondecreasing in starting water, including dry sticking and later reponding. While water is positive, the state equations are

`F' = K (1 + (A + beta W) / F)` and `W' = -F'`.

Their off-diagonal derivatives are nonnegative: `dF'/dW = K beta/F` and `dW'/dF = K(A + beta W)/F²`. The dry boundary and identical instantaneous additions preserve this order. The inquiry uses that model property to bisect the aggregate lower-band and upper-band constraints. It never searches for a separate starting amount for each row. A sampled numerical monotonicity violation beyond the declared allowance refuses the complete result.

For the independent beta-one positive-water control before a batch, the inverse starting amount for observed depth `w` at elapsed hours `t` is

`W0 = w + Kt + sqrt(F0² + 2Kt(A + w) + (Kt)²) - F0`.

A zero reading is handled as a depletion interval, not a unique starting amount. The independent tests exercise both cases, joint incompatibility, L/mL equivalence and calibration invariance when challenge values/times or future batches change.

The original measurement band and numerical comparison allowance remain separate. For each reading, the allowance is fixed over the declared starting interval and depends only on its original band, maximum starting water and batches already applied at that reading's explicit phase. Future additions and other rows' values do not enlarge that row's allowance. The implementation uses `128 * Number.EPSILON` times that bounded scale, with a positive subnormal floor. This is a floating-point comparison convention, not a proof that it encloses every solver error.

The requested interval width is a computational tolerance from 1e-9 to 1e6 L; it is not measurement uncertainty. Each lower or upper search stops after at most 64 bisections, at the requested width or at floating-point spacing. If the requested width cannot be represented, the result says so and exposes the actual brackets. Work is admitted conservatively before searching, capped at 450000 kernel advances, with cooperative cancellation and no returned partial report.

## Source custody and replay

The inquiry schema is `experimental-earth-pressure-initial-range/1`. Its only top-level fields are `schema`, the unchanged original `study`, `initialWater` (`lower`, `upper`, original `unit`, literal `source`) and `resolution` (`volume`, original `unit`). Original L/mL declarations and source strings survive download/reopen. Calculated intervals, selected explanations and saved conclusions are not accepted as inputs.

The complete inquiry is limited to 240000 UTF-8 bytes. Import first checks parsing, normalized serialization size, complete numerical admission and the detached result view. Only then can it replace the accepted source, editor and result. A compact file that fits the byte limit but expands past it on normalized export refuses atomically. Late successful or failed file reads cannot replace newer acceptance or edits. Edits retire the old calculation and export; Stop cancels pending work without publishing an incomplete answer.

`preparePressureBatchInitialWater` factors the existing batch evaluator without changing its arithmetic. It captures a private normalized course, validates both starting-range endpoints, evaluates only original reading times and retains original batch event states. Returned study and hypothesis objects cannot mutate that captured source. The original batch comparison continues to use its existing chart and reading plan.

## Receiving and limitations

The focused native course combines the original twelve batch tests with thirteen initial-range tests. The latter include independent positive-water inverses, the zero plateau, the jointly impossible example, source/result mutation isolation, prediction-only behavior, exact source replay, cancellation and unrepresentable requested width. The eight-group actual Chromium course starts at the maintained workbench, downloads a batch course, imports it into this inquiry, performs a real inquiry download and fresh replay, and exercises numerical/original display, malformed and oversized replacement, stale file reads, cancellation and desktop/390px views. Maintained `serve.py` asset receiving is checked separately. The generated receiving record identifies the exact executed source and composition.

This is one local, one-dimensional, fixed-area model with complete ideal instantaneous additions and no other supply or loss. It does not infer pouring duration, spatial ponding, leakage, overflow, moisture deficit, missing refill history or measurement uncertainty. The source investigation did not admit a field comparison with complete run identity and boundary history. The existing pressure kernel's physical assumptions and limitations still apply; mathematical and browser receiving do not establish physical validation, deployment or remote integration.
