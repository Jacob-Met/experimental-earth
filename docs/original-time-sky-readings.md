# Temperature evidence at its original times

Open `sky-timed-readings.html` through the documented `python3 serve.py --port 0` launcher, or follow **What do earlier readings reveal?** from the original sky-course page.

This inquiry asks what a third instantaneous temperature reading adds to two original readings. Each observation retains its own exact receiver, original UTC, existing-temperature component, value, half-width and attribution. The comparison uses one common early four-bin sky profile and one common late four-bin profile across every original receiver, time and both designs.

## A concrete distinction from final-only evidence

The authored example retains the complete D2 source course from 04:00 to 12:00 UTC on 21 June 2026, with its original 30-minute steps and an explicitly declared change after interval 8, at 08:00. It supplies existing-surface readings at 10:00, 12:00 and 06:00, each with its unchanged ±0.001 °C band. These are explicitly attributed numerical controls, not field observations.

At 06:00, the first two records admit an approximate proposal-minus-existing surface-temperature range of **−2.585671 to 0 °C**. Adding the third original reading narrows that range to approximately **−2.585671 to −2.573367 °C**: its width falls from about **2.586 to 0.0123 °C**. The narrowing concerns the modeled consequence under these authored declarations. It does not identify a measured sky history or establish a physical intervention effect.

The source experiment also retains a different ordering, with observations at 06:00, 08:00 and 12:00, in which the third band gives no further narrowing at the inspected 06:00 and 08:00 times. That control is not a claim of no additional effect at every other original time. A valid but contradictory third reading of 400 °C yields an empty all-three family while retaining the unchanged leading-two family and every original time. Neither a failed family nor a no-gain case is reported as an improvement.

## Work with the original evidence

Load three original reading files, or extract their original evidence from a saved three-reading inquiry. This intake retains each prior 4-, 8- or 16-bin history without adopting its prior change boundary; the current inquiry explicitly uses four common bins. Legacy final-only originals keep their original kind and final-time restriction. They cannot be reinterpreted as earlier readings by changing a timestamp in an old-format file.

The first two records form the reference family. The first record also selects the receiver where the existing and proposed designs are compared. Choosing a different first record changes both that reference order and the comparison point explicitly; it does not silently substitute another observation.

**Revise this attributed reading** exposes only original-state UTC choices and the existing surface/lower-store component, value, band width and source. Entering a draft clears the result and blocks computation and export until **Use revised reading** or **Cancel reading edits**. Admission checks the complete three-record combination before replacing the loaded original. A refused duplicate or source conflict retains the admitted record. Changing a UTC or component is an explicit new attributed observation, never a reinterpretation of a loaded value.

Source-only downloads contain `kind`, `model`, `readings` and `query`. They contain no calculated ranges, profiles, replay status or selected inspection point. Reopening recomputes the complete inquiry. Malformed source intake leaves the previous accepted inquiry available; changing a query or drafting an observation retires the old result. Late file reads, retired workers and detached controls cannot restore an older context.

## Exact identities and the maintained calculation

Exactly three distinct `(cellIndex, utc, store)` identities are required. The observed target is `existing`, aggregation is `instant`, and the store is `surfaceC` or `subsurfaceC`. UTC must identify the original initial state or an original interval end exactly. There is no nearest-time matching, interpolation, interval mean or resampling.

All sources must retain the same original site, geometry, orientation, forcing and dated time grid. Repeated receivers are admitted only when their complete original source and thermal declarations are identical. Receiver-local declarations may differ at distinct receivers under the existing shared-site contract. Every source retains its full original course, including any partial final interval.

The maintained original-boundary kernel evaluates all sixteen early/late bin pairs at each of the three original sources. With both designs and both original geometric endpoints, this is **192 complete basis courses**, including when receivers repeat. No repeated-receiver optimization or performance gain is claimed.

For each original state and component, the additive coefficient is the exact rational value of the represented binary64 expression **C(i,0) + C(0,j) − C(0,0)**, formed using exact arithmetic. All complete original pair courses are screened against those coefficients at every original time. Observation rows select each reading's actual original time and component; no reading is moved to the end of the course.

The sixteen nonnegative joint masses sum to one. The maintained two-band and three-band simplex intersections enumerate their complete feasible vertices within the declared bounds. The leading-two family remains separately identified. At every retained time, the all-three exact range must be a subset of its leading-two range; a third reading cannot rescue an empty leading-two family or widen it.

The internal joint masses represent the two marginal profiles. Exact marginal equalities are checked. The coupling is not an observed sky history. Every displayed all-three extremal witness is replayed once as one fixed early/late profile pair over every full source course. Prior-family candidate identifiers are kept separate and are not links into the all-three witness collection.

## Read the result correctly

Pale blue whiskers show the leading-two ranges; green whiskers show all-three pointwise ranges. Each endpoint can require a different profile. The collection of pointwise bounds is not one realized trajectory. Orange markers follow one selected fixed profile through all original times. Keyboard time inspection changes only the inspected original state and does not recompute the inquiry.

The per-observation tables keep **exact additive compatibility** separate from **original numerical replay status** at the actual observed UTC and component. Separately normalized floating-point profile replay can place an endpoint outside its original band even when the exact additive witness is feasible. The interface states that result explicitly. The 1e−9 °C consistency screen covers evaluated pair states and displayed witnesses; it is not a uniform every-profile error enclosure, a physical error bound or validation against measurements.

When all three bands are incompatible, the original sources, every time and the leading-two comparison remain available. There is no invented all-three plot or witness.

## Bounded work and compatibility

The inquiry admits 2–24 original intervals, at most 25 original states, four common bins and sixteen pair masses. The complete reservation includes 192 basis courses, at most 100 distinct extremal witnesses, 1,200 witness courses, 1,392 total thermal courses, 33,408 course intervals and 7,500 receiver/time witness rows. Shared geometry limits and 4,096-bit rational arithmetic limits remain in force.

The complete three-band capacity is 22,016 candidates; the prior two-band capacity is 2,736, with 192 candidates reserved across both static comparisons. The pointwise objective allowance is 19,801,600 mixture terms. This counter bounds the stated objective mixtures, not every rational operation. Exhausting a bound refuses the complete inquiry; it does not return a favorable partial subset.

The existing kernel and view changes are narrow: an optional explicitly bound observation-location argument for original-time replay, and export of the existing phase-profile figure. Default legacy calls preserve their report shape. The original final-only, original-course and joint-limit consumers retain their current semantics.

## Qualification

Run the maintained native controls with:

```sh
node --test --test-isolation=none --test-reporter=tap tests/shade-heat-timed-course.test.mjs tests/shade-heat-timed-inputs.test.mjs
```

Run the actual browser course in a supported environment with a working Chromium sandbox:

```sh
CHROME_BIN=/path/to/chrome node tests/shade-heat-timed-course.browser.mjs
```

The browser course uses the documented loopback launcher and a fresh owned browser session. It checks every original time and both comparison families against the actual worker report, original observation UTC/component tables, source-only download/reopen, explicit revisions and cancellation, duplicate identity refusal, source histories and ordering, malformed/contradictory evidence, stale file/worker retirement, keyboard inspection and 390/1440 px views. It records complete raw Chromium pair values and reports so exact checks need not assume that Node and Chromium thermal arithmetic are bit-identical.

The accompanying receiving receipt distinguishes native controls, independent source review, independent exact runtime evidence, the actual browser run and its source identity. No unrun CI, deployment or physical validation is claimed.
