# Original receiving-water accounts

The draining-layer evidence investigation now offers **Can water below ground distinguish these explanations?** It compares original total retained-water and cumulative-drainage readings with every explicitly offered receiving-layer hypothesis. It can also inspect explicit future measurement offers without inventing a measured value.

This addresses an observable limitation of surface-depth evidence. The maintained empty-store inverse can produce an alternative storage/drainage combination whose surface course matches a layer that actually starts with water. Another surface point may therefore add no discrimination. A receiver inventory or drainage total is a different observable.

## Use the maintained consumer

1. Offer at least two receiving explanations in the original draining-layer evidence investigation. Choose **Start a new account from these explanations**, or load the authored equal-surface example.
2. State how the measurements correspond to the whole selected receiving footprint. The copied source lists the original scenario, surface, cell indices, area, event, parameters and their sources.
3. Add original receiving readings with their channel, event minute, litre value, uncertainty, source and calibration or held-aside role. Blank numeric fields are refused.
4. Separately offer measurements that are explicitly available to ask for. Each offer records its channel, time, uncertainty and availability basis; it contains no observed value.
5. Compare every original band and inspect the proposed question, every offered question, every explanation and every original reading. Download and reopen retain only original inputs and recompute the result.

The account has its own copied original source. Editing the parent investigation cannot silently move existing measurements onto a different footprint or parameter set. Starting a new account explicitly replaces that copy and clears its old readings/offers. Neither workflow modifies the active project or adopts a layer.

## Physical contract

Both channels use the unchanged `runRain` / `draining-infiltration.js` forward path:

- **Retained** is the total water currently below all cells with the selected surface in the original target scenario, in litres. It includes initially stored water that remains.
- **Drained** is the cumulative water that has left those receivers since the original event began, in litres. It may include initially stored water.

The footprint area is the number of selected cells times the square of the original cell width. A point soil-moisture probe, an unregistered sub-area, and surface-boundary outflow are different quantities. A source attribution and association are declarations, not independent verification of a measurement device or its coverage.

Account readings and offers must be at exact retained solver endpoints. The adapter does not interpolate an inventory or cumulative drainage. The existing surface-depth evaluator retains its existing interpolation and rounding convention. A relative `1e-9 * max(1, absolute compared values)` guard prevents floating arithmetic noise from becoming a band contradiction; it is not extra measurement uncertainty or a certified numerical enclosure.

## Support and question selection

Every original surface and receiver calibration band constrains the same finite set of unchanged parameter declarations. A hypothesis is compatible only if all its calibration rows agree. No calibration rows means no supported hypothesis. Contradictory repeated readings remain contradictory; no nearest fit replaces an empty set.

Held-aside readings only challenge the calibration-compatible hypotheses. Their values cannot alter parameters, calibration support or the prospective question ranking. An already-recorded receiver channel/time is excluded from selection even if its reading was held aside. A recorded surface reading does not exclude a distinct receiver observable at the same time.

For an offered measurement with half-width `u`, two predictions separate only when their absolute gap is strictly greater than `2*u` plus both numerical guards. The selected offer separates the most calibration-compatible pairs; ties retain original offer order. Every offer, its predictions and every pair remain inspectable. No offers, all-recorded offers, overlapping/touching bands, or fewer than two supported hypotheses produce explicit no-question states.

The maintained surface-depth question planner provides a comparison at the largest original surface calibration half-width. Its own bounds remain in force; an unsupported complete surface question is reported as unsupported. These are questions about the original modeled event, and a proposed time may already be in the past. Availability must be declared explicitly.

## Authored mechanism control

The example uses four one-square-metre garden cells and the maintained forward model. One hypothesis declares capacity `7.3 mm`, initial water `3 mm`, and drainage `0.63 /hour`. The existing empty-store inverse provides another hypothesis with capacity approximately `4.485276187 mm` and drainage `1.025354919 /hour`.

Original surface depths at minutes 60 and 180 calibrate; minute 240 is held aside. At a surface half-width of `0.00001 mm`, both hypotheses remain supported and the maintained surface question planner finds no separating point. At minute 180, they instead predict:

| Receiving channel | Initial-water hypothesis | Empty alternative | Absolute gap |
|---|---:|---:|---:|
| Total retained water | 29.200000 L | 17.941105 L | 11.258895 L |
| Cumulative drainage | 54.088414 L | 53.347309 L | 0.741105 L |

Both explicit `±0.1 L` offers separate the pair; original offer order selects retained water. After an original retained-water reading is supplied, the drainage offer remains available. Changing only that held-aside reading switches the surviving hypothesis while leaving calibration support and the selected drainage question unchanged.

The native test independently checks the full-store mass account. With infiltration `f=24 mm/hour`, `q=k*C`, and filling time `tf=log((f-k*S)/(f-q))/k`, retained water at three hours is `4*C` litres and drainage is `4*(S + f*tf + q*(3-tf) - C)` litres. This checks the account against an independently expressed equation rather than copying the adapter's output.

These are authored software/model controls, not acquired environmental observations, identification guarantees or evidence that a particular instrument can attain the declared precision.

## Admission, persistence and verification

`receiving-account-evidence.js` accepts 2–12 original receiving hypotheses, at most 128 readings and 128 offers, exact object fields, finite bounded values, distinct IDs and nonempty source/association declarations. The complete family reserves at most one million cell-steps before any simulation; no over-budget partial result is reported. Original-only JSON is limited to 2 MiB. Derived result fields are rejected on reopen.

Native verification: `node tests/receiving-account-evidence.test.mjs`. Six behavior groups plus the receipt check passed, including independent mass-account values, held-aside invariance, contradiction/no-calibration/no-fallback, touching bands, stable ties, wrong-footprint rejection, unsupported endpoint/channel/role/value refusal, full-family budget refusal, source nonmutation and strict round-trip replay. A separate contributor reviewed the mechanism and independently ran all seven tests successfully.

Actual browser verification: `CHROME_BIN=/absolute/path/to/chrome node tests/receiving-account.receiving.mjs` with Playwright available (or an explicit `PLAYWRIGHT_MODULE` path). Run as an unprivileged user on Linux. The course launches the maintained `serve.py` on an ephemeral localhost port and requires active Chromium namespace, PID, network, seccomp and TSYNC protections before product assertions. It never disables Chromium's sandbox.

Seven actual-browser groups passed on 2026-10-27: original-source handoff and keyboard comparison, held-value mutation, real download and fresh-context reopen, contradictory/blank/off-grid/forged-result negatives, independent copied source after parent edit, delayed-file retirement, and desktop/390-pixel usability. The narrow result was visually inspected; zero browser exceptions occurred and the owned server stopped. Exact native, browser and source-manifest receipts are in `docs/receipts/receiving-accounts/`.

This additive workflow does not change the maintained hydrology, surface observation roles, receiving proposal inverse, cross-event comparison, component/placement analysis or another contributor's post-storm-pair proposal work.
