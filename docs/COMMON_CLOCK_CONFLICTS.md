# Explain an original-source common-clock contradiction

After finding continuous common-clock intervals, choose **Explain original-source conflicts**. The explanation retains the complete original reading ledger and every offered hydraulic rate. It does not alter recorded minutes, uncertainty bands, nominal calibration ranking, model settings or the input-only replay format.

Calibration is explained first. Only when at least one offered rate retains calibration support does the consumer explain whether the held-aside readings close that support. If calibration is already inconsistent, the calibration witness excludes held-aside values. A project with no calibration readings cannot acquire calibrated status through this explanation.

## What a witness establishes

A subset is contradictory if its intersection is empty for **every** offered rate. The deterministic deletion search starts with the original-index-ordered ledger, removes a reading only when all offered rates still have empty support, then verifies every retained reading is necessary. Removing each witness reading must reopen a concrete offered rate and a continuous offset interval for the remaining witness subset. The interface shows an approximate point inside that interval as a check. Four-significant-digit previews are marked ≈ and are not certificates: tiny disconnected gaps or distinct endpoints may appear identical. Keyboard-accessible details expose the complete retained binary64 numeric bounds, all removal-support intervals and the exact retained selected offset without changing computed values. Empty sets read “no admitted offset.”

This is an **irreducible subset**, not a guaranteed smallest subset and not a recommendation to discard measurements. Its removal checks concern the remaining witness subset, not an amended fit to the complete ledger. All original outcomes remain visible above it. Different subsets may explain the same contradiction.

The explanation distinguishes a single reading outside the modeled event at every declared offset, a single reading without any compatible depth under the offered rates, and a multi-reading shared-clock contradiction. It also reports whether all readings are individually possible at any one offered rate: in that case, incompatible common timing is different from an individual impossible reading. Neither conclusion identifies a faulty source or proves the hydraulic model correct. Wider clock ranges, omitted hydraulic hypotheses, different initial state or forcing, measurement uncertainty and numerical approximation remain possible explanations.

## Continuous sets and bounded work

The algorithm consumes only freshly recomputed common-clock results and reuses their closed, possibly disconnected interval sets. It does not refit the model, round or replace unions with convex hulls. For n readings, at most 2n+2 intersection passes bound the initial check, deletion and removal witnesses. A conservative sum-of-prefix-components bound limits interval intersection scan steps to 5,000,000; reports above that limit remain unresolved. The count is a scan-work admission metric, not a measurement of all JavaScript operations or elapsed time. The earlier solver and interval-production bounds remain in effect.

Input downloads still contain only the original project and declaration. Reopening independently reconstructs the trajectories, feasibility sets and, on request, the conflict witness. No imported cached diagnosis is trusted.

## Controls and receiving

`node --test tests/common-clock-conflict.test.mjs` exercises an actual retained solver course: 60 minutes / 21 mm and 120 minutes / 15 mm, with 3, 9 and 22 mm/h offered. It checks original-source nonmutation and explicit removal support. A disconnected synthetic control uses A=[0,2]∪[4,6], B=[0,2]∪[8,10], C=[4,6]∪[8,10]: every pair is compatible, while all three are not. Additional controls distinguish rates excluded by different readings, event exclusion, redundant evidence, role separation and bounded-work refusal.

Actual browser receiving uses the maintained sandbox admission and browser-session helpers:

```
CHROME_BIN=/opt/google/chrome/chrome RUN_DIRECTORY=/tmp/earth-clock-conflicts-receiving node tests/common-clock-conflict.browser.mjs
```

It exercises keyboard explanation, original source text, complete-ledger preservation, input-only download/reopen, stale-source reset, disconnected intervals, and desktop/narrow conflict displays. Receiving was completed on current main `879db03cd8600cf1d4f0f0fffd40bf48b174caa7` plus the exact published runtime changes. All 672 native tests passed, and all seven actual Chrome156 browser groups passed with observed namespace/PID/network/seccomp/TSYNC sandbox admission. Desktop1440px and narrow390px captures were inspected. The initial full-precision prose was replaced with clearly approximate previews and keyboard-accessible verbatim bounds, then the full native and actual consumer checks were repeated.

Independent review verified universal quantification across every offered rate, deletion irreducibility, nonroot evidence roles and singleton removal support. Two returned-array aliases were found, fixed and independently rechecked; source domains remain unchanged after returned-witness mutation. An independent Boolean-membership experiment agreed on100 finite-set cases across three rates, including all43 conflicts. A retained tiny-gap display control preserves a1e−12 gap verbatim even where previews appear to touch.

See [verification](receipts/common-clock-conflict-e794/verification.json), [actual browser receipt](receipts/common-clock-conflict-e794/browser.json), [desktop](receipts/common-clock-conflict-e794/desktop.png) and [narrow display](receipts/common-clock-conflict-e794/narrow.png). These authored controls qualify the stated software behavior; no physically authenticated acquisition or corrected hydraulic fit is claimed.
