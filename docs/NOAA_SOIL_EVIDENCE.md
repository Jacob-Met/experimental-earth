# Original surface and soil-temperature evidence

The original NOAA hourly page includes a separate dual-channel comparison. Receive a source file, choose an original contiguous course and declare the surface, initial point states and offered lower-store alternatives as before. In section 5, choose an original soil depth, explicitly describe its association with the modeled lumped lower store, and declare its comparison band and calibration count. Compare both original channels.

This is a test of offered declarations. No capacity, conductance, initial state, spatial support or uncertainty is inferred. Each alternative remains in the report, including alternatives rejected by either channel. Surface and soil calibration/challenge outcomes are shown separately; joint calibration requires agreement with both channels' calibration readings, and joint challenge uses both channels' held-out rows without refitting. Different role labels do not establish acquisition independence.

## Original support and physical association

The [NOAA USCRN hourly product README](https://www.ncei.noaa.gov/pub/data/uscrn/products/hourly02/readme.txt) defines hours as the preceding 60-minute periods ending at the stamped UTC time. Fields 34–38 are mean soil temperatures at 5, 10, 20, 50 and 100 cm. Note K describes multiple co-located sensors sampled every five minutes contributing to these means. Missing temperatures are `-9999.0`. There are no separate soil QC columns in this format; this consumer does not invent per-probe flags or precision.

The model's lower store is lumped. A station mean at a particular depth does not establish a layer-average temperature or spatial representativeness. The required association is a retained user declaration, not an inferred physical fact. The exact interval-mean operator in `heat-column.js` supplies the lower prediction; source hourly means are not compared with endpoint temperatures. Original point initial states remain separate explicit assumptions.

The archived Tucson excerpt has valid 5 cm and 10 cm records and missing deeper records. Selecting a missing depth refuses the complete comparison rather than substituting another depth. The original offered family remains rejected with the default authored comparison bands; no parameters are changed to rescue it.

## Custody and replay

The separate `experimental-earth-noaa-soil-evidence/1` file retains the original NOAA input recipe plus depth, sensor-to-store association, band and soil calibration count. It contains no derived answers. Replay verifies the original byte digest, re-admits the original course and computes both channels again. Original fixed-width lines, timestamps and numeric lexemes remain inspectable. The digest binds supplied bytes; it does not authenticate acquisition.

Reopening this file displays the saved comparison independently and does not replace the main source/model draft. The displayed digest, original lines, clock and depth identify the saved comparison. Editing the main draft or soil declarations clears its results/download. Pending computations cannot install a result after source replacement or a newer draft generation.

## Verification

`node --test tests/noaa-hourly*.test.mjs tests/noaa-soil-evidence.test.mjs` covers original-byte replay and missing depths, plus an explicitly authored paired-channel control: broad surface bands admit all offered alternatives, while independent lower-channel screening selects the unchanged reference alternative. A held-out-only perturbation changes challenge admission while calibration and offered parameters stay unchanged. Wrong identity, unsupported depth, missing association and injected derived fields refuse.

`CHROME_BIN=/usr/bin/google-chrome-stable node tests/noaa-soil-evidence.browser.mjs` exercises actual source acquisition, keyboard comparison, input download/fresh replay, missing-depth refusal, changed depth, stale async completion, source identity refusal and desktop/narrow rendering under the maintained strict sandbox preflight. Browser qualification and exact-source receipts are recorded separately after actual execution.

## Received original annual source

The published receiver `experiments/receive-original-year-soil.mjs` predeclares 24-hour courses starting at 00:00 UTC on January 1, April 1, July 1 and October 1, 2025. It does not move dates or rank on fit. On the original 2,137,440-byte, 8,760-row Tucson file (SHA-256 `8a3f9e470c96557cb21a0e1bab0f556630f4c8ec50965666a8f5a32a0677ea75`), all four courses are admitted. Original 5/10 cm means provide eight complete depth-course comparisons; missing 20/50/100 cm values produce twelve complete refusals. All three unchanged illustrative alternatives remain calibration-rejected on both channels. Every accepted original-input recipe reopens exactly and its surface report equals the original surface-only report.

Treating both observed depths as the same uniform lower temperature with the explicitly authored ±0.5 °C bands gives disjoint bands in 21/20/20/19 of the 24 original hours respectively. This demonstrates a limitation of that declared association and one-state representation; it does not establish a calibrated physical profile or an adequate replacement model. No capacity, band, point initial state or course is tuned to obtain these results. The original year remains externally sourced rather than redistributed in Git.

The complete annual experiment, including repeated byte parsing and replay, took 6.668 s with whole-harness peak RSS 425,788 KiB on Node 22.23.4. This is neither browser memory nor a pure solver benchmark. The compact scientific receipt retains every course, depth, exclusion and rejected hypothesis.

Independent authored RK4 integration supplies a separate positive control: exactly one of three unchanged candidates survives both channels; a held-out-only +8 °C perturbation changes the challenge without changing calibration, surface outcomes or predictions. Exact lower-store means agree to 7.11e−14 °C. These channel replacements are synthetic and are not NOAA observations.

Receiving on parent `03dab7292a4e80a24e295b8fff6c3e0c6d13e32c`: 21 affected native tests and six actual browser groups pass with explicit Linux namespace/PID/network/seccomp/TSYNC admission. Desktop and narrow original-input/replay/refusal states were visually inspected. Receipts are under `docs/receipts/noaa-soil-*338.json`.
