# Compare offered sky-change times with the complete temperature record

Open `sky-record-boundaries.html` from the complete-record inquiry at `sky-many-readings.html`. The page compares the same original temperature record at every explicitly offered internal boundary of its original clock.

The investigator can now ask which offered times remain compatible with the complete record. The preceding inquiry admits one chosen boundary. This inquiry retains the whole offered list, its first-three reference, and every original observation, including the alternatives that the complete record rejects.

## Use the inquiry

1. Load three to 24 original instantaneous temperature-reading files, or the original evidence from a saved inquiry. At most three complete receiver sources are admitted. Repeated readings at a receiver require the same complete source declaration and distinct receiver/UTC/component identities.
2. Choose the first record explicitly. It determines the comparison point and leads the first-three reference; the remaining records retain their order. Every record constrains the complete family.
3. Offer distinct original interval indices, separated by commas, and declare the basis for shared sky conditions. The page shows the full original UTC for every offer. “Offer every internal original boundary” fills the list explicitly; it does not run a search between those times.
4. Compare the whole list. Each time remains visible with separate first-three and complete-record compatibility. A rejected alternative keeps its original-matrix incompatibility certificate.
5. Inspect a retained boundary, an original consequence time, and any profile attaining a limit. The selected fixed profile belongs to that one boundary and is replayed through every original receiver course and observation.
6. Download original inputs to reopen the inquiry. Reopening recomputes every offer. Loading the originals from an inquiry keeps the currently declared offer list; reopening the inquiry itself restores its saved list and conditions.

## What the authored example establishes

The authored record contains 24 original bands across three complete receiver sources, with 17 retained original times. All 15 internal boundaries are offered.

| Evidence family | Compatible offered boundaries |
| --- | --- |
| First three original bands | All 15 |
| Complete 24-band record | Original 08:00 UTC boundary only |

The example's original temperature values come from the authored early-bin-1/late-bin-2 control with the original 08:00 change. They are fixed numerical controls, not field measurements. This is evidence that the complete record can discriminate between the offered alternatives under the declared model; it is not a measurement of an actual sky-change time.

At the original 06:00 state, the surface consequence union at D2 has an approximately 0.012304295 °C first-three width and 0.001010827 °C complete-record width. The page shows both widths directly on narrow screens, as well as the signed ranges and every attaining boundary/profile.

Controls preserve ambiguity and failure:

- A three-record inquiry makes no artificial information gain: its reference and full-record unions agree, and all exact attaining boundary ties remain.
- An independently received partial final clock can retain multiple compatible offered times in the originally supplied nonsorted order.
- A contradictory final 400 °C original band rejects every offered alternative without dropping that record or substituting the still-compatible reference family.
- Unoffered times are not considered. Even a single surviving offer does not identify a physical time or exclude other sky or thermal models.

## Exact comparison and original numerical replay

Each alternative uses the maintained complete-original-record evaluator unchanged. One common four-bin early profile and one late profile apply across every original receiver, time, and design. Its six-coordinate exact marginal program retains every original band and supplies original-matrix feasible/optimal or Farkas certificates.

The new composition takes exact minima and maxima across all compatible offered alternatives, independently at each original time and temperature component. It retains every exact tie, including the original offer index, interval, UTC, objective proof, and profile identity. The first-three reference union is constructed separately. Additional original bands can narrow, leave unchanged, or reject that reference; they cannot widen it or rescue an incompatible reference.

A pointwise union envelope is not one possible trajectory. Different endpoints can use different boundaries and profiles. Orange markers use one selected fixed profile at one named boundary. Original numerical observation replay remains separately visible, including any endpoint outside its original band. The 1e-9 °C numerical consistency screen is not a physical accuracy or uniform solver-error bound.

The only change to `shade-heat-many-course.js` is the read-only `inspectManySkyCourseWork` export. It performs the existing strict admission and complete work reservation without executing a thermal course. All 15 complete child reports were compared exactly against the previously executed accepted PR501 baseline reports.

## Complete work admission

The whole offer list is admitted before any alternative runs. A later work or report refusal returns no partial comparison. Every reading and offer is retained; the inquiry never silently chooses a favorable subset.

| Limit | Admission |
| --- | --- |
| Original readings / unique receiver sources | 3–24 / at most 3 |
| Common sky bins / profiles per alternative | 4 / 2 |
| Original intervals / retained states | At most 24 / 25 |
| Explicit offered boundaries | 1–23, distinct and internal |
| Aggregate geometry-check reservation | 16,000,000 |
| Aggregate thermal-interval reservation | 300,000 |
| Complete report | At most 64 MiB |

Other aggregate reservations multiply the unchanged single-boundary complete witness and exact-linear allowances by the number of offers. The interval ceiling can require fewer offers for a larger original course; it does not authorize dropping observations. For three receiver sources and 24 original intervals, eight offers reserve 267,264 thermal intervals; nine would reserve 300,672 and are refused as a whole.

The authored 15-offer inquiry reserves 15,120 thermal courses / 241,920 intervals. Its observed complete execution uses 2,880 basis courses and 36 witness courses, totaling 2,916 courses / 46,656 intervals. These are work counts for the authored control, not general latency or physical-accuracy claims.

## Qualification

Run focused native receiving with a Node runtime supporting the maintained test runner:

```sh
node --test --test-isolation=none --test-reporter=tap tests/shade-heat-record-boundaries.test.mjs
```

Eight core groups cover complete-list discrimination, unchanged single-boundary specialization, exact unions and ties, no gain, all-incompatible retention, unfamiliar mixed components and a partial final interval, complete aggregate refusal, and strict original-input replay. Current-main composition also retains and passes the three original-rate chart-axis regression groups from PR461.

Independent Fraction review checks all union endpoints and ties, their original objective proofs, same-boundary witness values, complete work sums, and unfamiliar nonsorted partial clocks. A separate consumer review covers file/worker transactions, full-list/source preservation, exact origin selection, connected/generation guards, and source-only export.

The actual browser course is `tests/shade-heat-record-boundaries.browser.mjs`. It uses the maintained loopback launcher and active Linux namespace/seccomp sandbox. Its eight groups cover the real parent link, all 15 alternatives and 17 original times, actual source-file intake, fixed-profile/observation bindings, real download and fresh reopen, explicit reordering, no-gain/tied and all-incompatible controls, malformed or over-budget refusal, stale file/worker retirement, keyboard interaction, and 1440/390 layouts. Runtime reports are the exact DOM oracle; a separate Node comparison is numerical and does not establish a physical error bound.

Source identities, private integration receipts, accepted-runtime receiving, and the independent portable checker are retained with the outcome's evidence. No public deployment or unrun CI success is claimed.
