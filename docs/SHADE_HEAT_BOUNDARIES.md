# Compare explicitly offered sky-change boundaries

The standalone `sky-boundary-evidence.html` inquiry compares every explicitly offered original interval boundary using the same two original temperature readings. Open it from the changing-sky investigation (`sky-epoch-evidence.html`) through the ordinary `python3 serve.py --port 0` launcher.

This extends the accepted single-boundary investigation. It removes the need to run and reconcile separate inquiries manually. It does not infer an unoffered time, interpolate between boundaries, identify a measured sky, or establish physical intervention performance.

## Original inputs and ordinary use

Open exactly two original temperature-band input files, choose the point where existing and proposed designs are compared, enter distinct original interval numbers separated by commas, and explain why both points share the declared sky conditions. **Offer every original internal boundary** explicitly fills the list from the original interval grid. It does not run the inquiry until the person chooses Compare.

The two originals retain their original receiver cells, bands and attribution, bin histories, material properties and starting temperatures. They must satisfy the existing strict shared-source join: distinct receivers, coincident original final UTC, the same nonthermal site and forcing declarations, and supported existing-surface observations. Their individual thermal assumptions may differ. Original time intervals, direct forcing and total diffuse irradiance remain unchanged.

The list contains 1–23 distinct positive integer boundaries, with a whole original interval on either side. Supplied order is preserved. Empty entries, sparse arrays, duplicates, invented boundaries, unsupported originals or an over-capacity complete inquiry refuse the new query. Every offered boundary is admitted before geometry or thermal execution. A later failed course refuses the complete result; earlier successful alternatives do not become a partial success.

Every offered alternative stays in the overview, including incompatible alternatives. Each can be inspected separately. A completed all-incompatible inquiry has no paired range and remains exportable. Delayed file reads and old worker responses cannot replace a newer source or query. A malformed reopened file retains the previously accepted inquiry; editing the current question invalidates its prior result.

## Model and exact consequences

Each alternative reuses the maintained four-bin/two-epoch model: one profile before its original boundary and one after, shared by both receivers and both designs. At each receiver all 16 original one-bin early/late pair courses, including existing/proposed and lower/upper endpoints, are complete prerequisites. Neither original band filters away a pair course before admission.

The exact additive coefficients remain `C_i0 + C_0j − C_00`, formed from exact rational representations of the completed reference courses. All raw pair courses and their discrepancies are retained. Joint-mixture objectives equal the product of the exact early/late marginals under this declared additive model. This is the same model and numerical consistency screen as the single-boundary inquiry.

For each component, the complete inquiry takes the exact minimum of the per-boundary lower objectives and exact maximum of the upper objectives over compatible alternatives. These are outer bounds on the union. They do not assert that every intermediate difference is attainable. Comparisons use exact fractions, rather than rounded display numbers; exact ties keep the first supplied boundary.

Every outer bound retains its boundary index, original interval number, UTC and witness ID. The inspection action selects that exact report and finds the witness by ID within it; noncontiguous IDs are supported. The same shared renderer shows the exact phase profiles, calculated temperatures and full original thermal replay at both receivers.

Original-static and additive-static comparisons remain separate at every boundary. Static **thermal courses** are reusable; additive diagonal **coefficients** are rebuilt for each boundary because floating reference decompositions can differ. If the two static comparisons disagree, that evidence remains explicit. A conclusion cannot then be attributed only to allowing the sky to change.

Original floating-course replay remains separate from exact additive compatibility. Replay endpoints outside their original bands remain labeled outside. The 1e−9 °C consistency screen neither widens those bands nor certifies geometry, thermal integration, every-profile numerical accuracy or physical behavior.

## Complete work allowance and private reuse

A private context lives for one normalized original pair and one complete list. It cannot be provided by the caller, imported in a saved file, or reused across inquiries. It retains each receiver's geometry and the complete static-diagonal thermal courses only. Every off-diagonal pair course is still completed at each boundary. Returned-result mutation cannot poison a future inquiry.

For `N` offered boundaries and `I` original intervals:

| Work | Whole-query amount |
| --- | ---: |
| Geometry passes |2|
| Complete basis courses represented |128N|
| Newly evaluated basis courses |32 +96N|
| Identical completed courses reused |32(N−1)|
| Reserved full witness courses |32N|
| Reserved total thermal courses |32 +128N|
| Reserved thermal course intervals |(32 +128N)I|
| Reserved exact two-band candidates |2736N|

The original course has at most 24 intervals, so at most 23 internal boundaries can be offered. The complete maxima are 2240 newly evaluated basis courses, 736 reserved witness courses, 2976 total thermal courses and 71424 course intervals. The original shared geometry limit remains unchanged. Admission reserves every witness course before execution, and the completed totals are checked against that reservation. Existing single-boundary limits and public report shape remain unchanged.

## Authored courtyard result

The supplied B2/D2 control retains 16 original half-hour intervals from 04:00 to 12:00 UTC on 21 June 2026. All 15 internal boundaries are explicitly offered. Both original-static and additive-static comparisons are incompatible with its two original bands. Five changing-sky alternatives remain compatible:

| Change after interval | Original UTC | Exact vertices | Lower-store paired outer bounds, approximately °C |
| ---: | --- | ---: | --- |
|8|08:00|308|1.14066426 to1.15655042|
|9|08:30|288|1.13952874 to1.15647162|
|10|09:00|288|1.13952876 to1.15621964|
|11|09:30|288|1.13952913 to1.15540666|
|12|10:00|288|1.13953538 to1.15275648|

The other 10 alternatives remain incompatible and inspectable. The overall lower-store minimum comes from boundary 9, whereas its maximum comes from 8. The surface outer bounds are approximately 1.6366829698817265 to 1.6406829698817353°C; their exact coefficient differences can be much smaller than display precision and are not physical timing evidence.

One complete inquiry evaluates 1472 new basis courses and reuses 448 identical completed courses, then performs 120 witness courses: 1592 thermal courses in total. Fifteen separate maintained inquiries require 1920 basis plus the same 120 witness courses, totaling 2040, and 30 geometry passes instead of 2. These are verified work counts, not a universal elapsed-time performance claim.

A separately authored static-compatible control stays compatible at every offered boundary. All-incompatible controls retain all complete bases without creating ranges. Exact zero-effect ties retain the supplied order. These controls prevent the authored five-boundary pattern from becoming an assumed general result.

## Original-only saved format

`experimental-earth/offered-sky-boundary-reading-inputs/1` contains exactly `kind`, `model`, `readings` and `query`. The query contains exactly `bins:4`, `splitAfterIntervals` and `sharingSource`. Unknown fields, saved results, mismatched models and invalid originals refuse. Downloads contain compact original-input JSON; reopening recomputes the complete inquiry. The ordinary working project is not modified.

## Reproduction and qualification

Run the native controls with:

```sh
node --test --test-isolation=none --test-reporter=tap tests/shade-heat-epoch-evidence.test.mjs tests/shade-heat-boundary-evidence.test.mjs
```

With an installed Chromium executable in `CHROME_BIN` and a supported active Linux sandbox, run:

```sh
node tests/shade-heat-boundary-evidence.browser.mjs
node tests/shade-heat-epoch-evidence.browser.mjs
```

Both browser courses exercise the ordinary documented Python launcher. They cover actual original-file download/reopen, malformed and delayed sources, retired worker results, exact boundary/witness selection, desktop and 390px presentation, and unchanged working-project storage. The bounded source and qualification record is `docs/receipts/offered-sky-boundaries-52d429.json`. Absent GitHub checks are not counted as passed CI.
