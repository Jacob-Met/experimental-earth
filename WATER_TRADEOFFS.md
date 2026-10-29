# Inspect how a proposal changes surface water across the event

The ordinary workbench's **Across the whole event** section summarizes the
completed existing/proposed whole-site water course. It helps distinguish a
lower final total from a proposal that has less surface water at every retained
time. For example, the authored `water-history-tradeoff.json` fixture has more
proposed water at 31 original snapshots and less at 17, with one equal snapshot.
That is a modeled sample-wise tradeoff, not a physical recommendation.

The section shows:

- Counts of original snapshots with more, less and equal proposed surface water.
- The greatest positive and negative proposed-minus-existing differences, in
  litres. When an extreme has several exact ties, choose any original tied time
  and use **Inspect selected time**.
- Groups of consecutive original snapshots with the same sign. Expand
  **Inspect … groups of original snapshots** to inspect either endpoint of a
  group. Each boundary identifies its two adjacent original sample times.

**Inspect** moves focus to the exact paired whole-site values in **Read a
retained time** below. Use its arrow keys or Previous/Next controls to continue
through the original course. Inspection is a view choice: it does not edit the
project, solve again or shorten the complete CSV download.

## Interpret the original samples

Counts are numbers of retained snapshots, not durations or probabilities. A
group describes consecutive stored samples; it does not establish what happened
at every intervening instant. A sign transition is bracketed by the two adjacent
retained times. No exact crossing time is interpolated or inferred.

Differences use the original proposed and existing stored numbers. Text uses
their shortest round-trip decimal spelling, including a signed positive
difference and negative zero where present. Classification uses the actual sign
without a hidden near-zero tolerance. Small floating-point differences and long
decimal spellings do not establish physical measurement precision.

An all-equal course explicitly counts every original snapshot as equal and has
neither an increase nor a decrease. A one-direction course has only its actual
extreme; the absent direction is stated explicitly. Positive and negative
extrema retain every exactly tied original index, including fractional times.
More or less surface water does not by itself rank a proposal.

## Completed source and controls

The section copies the same accepted paired snapshots used by the ordinary
readout. It names the completed project as literal text. During a pending or
failed comparison, the last completed summary remains named and inspection is
disabled. A newer completed source replaces the whole summary together. An old
detached button cannot select a time in a newer source, even when both courses
contain the same minute or index.

The readout's `selectMinute(value)` method accepts only a finite number that is
an exact original minute in the currently available course. It returns `false`
without changing the selection for an absent, coerced, nonfinite or unavailable
request. A successful selection updates the original paired values, focuses the
time slider and returns `true`.

## Verification

The focused native course uses independently specified mixed, all-zero,
one-direction, tied, fractional, tiny signed and 721-row controls. It checks the
complete partition, exact extrema ties, immutable copied scalars and malformed
population refusal:

```sh
node tests/water-tradeoffs.test.mjs
```

The maintained browser course requires Playwright and sandboxed Chromium:

```sh
CHROME_BIN=/path/to/chrome \
PLAYWRIGHT_MODULE=/path/to/playwright-core/index.mjs \
EARTH_WATER_TRADEOFF_BROWSER_OUTPUT=/tmp/earth-water-tradeoffs-receiving \
node tests/browser.water-tradeoffs.mjs
```

It compares the actual ordinary workbench with direct maintained-model rows,
exercises keyboard extrema/group inspection at desktop and 390px, and verifies
unchanged project/CSV download bytes. It checks a detached older control,
pending comparison, actual Worker load failure and original-source restoration,
then reopens an actual original project download in a fresh browser context.
A separately labeled isolated component case exercises all tied fractional
choices and the exact-minute API; those constructed snapshots are not an
additional maintained-model result. Served JavaScript/CSS bytes are bound to
the source, missing assets and offsite requests are refused, and actual desktop
and narrow layouts are captured for inspection.

The independent peak-time/tie context outcome is ready in
[issue 544](https://github.com/Jacob-Met/experimental-earth/issues/544).
