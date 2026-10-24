# Paired proposal effects receiving

Issue: [#17](https://github.com/Jacob-Met/experimental-earth/issues/17).
Baseline: `89abcfec4fe5666dd5fce0c302d227f4f9cd5b0d`.
Team: `hamon-3ee49983b2f4-20261023`; recorded 2026-10-24 UTC.

## Delivered behavior

The existing infiltration investigation can distinguish candidate surface rates,
but did not show whether a proposed site intervention still helps across those
alternatives. The new panel runs existing/proposed scenarios as pairs for every
selected rate, using the same rate for the chosen surface in both scenarios.
It reports signed effects on edge outflow, peak standing water, final storage
and maximum cell depth, plus every cell whose local peak becomes deeper under
at least one candidate. It keeps competing objectives separate.

The user explicitly chooses all saved candidates, calibration-compatible rates,
or rates compatible with both calibration and held-aside readings. Missing or
contradictory evidence never substitutes the closest fit. Existing project
edits invalidate results. Comparing does not adopt a rate or change the project.

An analytic four-cell control provides an independent arithmetic check: under
30 mm/h rain for one hour, no lateral/edge flow and 1 square metre cells,
replacing turf with the default 24 mm/h garden gives storage changes of
-56, 0 and +16 litres for turf hypotheses 10, 24 and 28 mm/h. The actual solver
and browser both expose that reversal and four locally worsening cells. A
separate control shows lower total stored water while one cell deepens by
9–10 mm, ensuring site totals do not conceal local effects.

## Exact source and independent review

[source-manifest.json](source-manifest.json) identifies all 31 source files
copied into an isolated receiver, each verified by SHA-256 before execution.
The three modified existing files contain only the new panel's import/mount/
invalidation, the browser-course hook, and the README explanation. The existing
solver, infiltration comparison, observed-depth import and maintained browser
runtime are unchanged. Four new implementation/test files complete the slice.

The lead independently reviewed the paired override, evidence selection,
mutation/invalidation behavior, local-versus-site metrics, numeric bounds and
consumer integration. The conservative work-admission value was renamed to
`cellStepUpperBound` during review so it cannot be mistaken for measured work.
No blocking issue remained in the qualified source.

## Native and actual browser results

On authorized Linux device `cursor`, Node.js 22.23.4:

- **57 native tests passed**, including eight new intervention cases. The full
  [native log](native-tests.txt) retains every test result.
- **24 actual browser check groups passed**, preserving the existing 20 and
  adding analytic reversal/local effects, evidence-filter refusal, actual
  proposal-edit invalidation/recomparison without parameter adoption, and the
  390-pixel panel layout.
- Chrome `156.0.8078.47` reported active namespace and seccomp sandboxing in the
  same isolated browser session. No JavaScript exceptions were observed. The
  maintained process owner recorded normal direct-child exit and cleanup.

The complete [browser receipt](browser-receipt.json) records the checks,
sandbox admission, executable, launch arguments and session cleanup. Its
process-owner subreceipt intentionally leaves sandbox assessment to the
separate same-browser admission result in the outer receipt. The retained
390-pixel full-page capture was also visually inspected: the new panel fits the
existing reading order and the page has no horizontal overflow.

```sh
node --test tests/core.test.mjs tests/infiltration-question.test.mjs \
  tests/infiltration.test.mjs tests/intervention.test.mjs \
  tests/observation-table.test.mjs

CHROME_BIN=/opt/google/chrome/chrome \
  BROWSER_RUN_DIRECTORY=/tmp/hamon-3ee49983-earth-browser \
  node tests/browser.receiving.mjs
```

Choose a new exclusive `BROWSER_RUN_DIRECTORY` when reproducing the browser
course. The published helper owns the temporary HTTP server, browser profile
and process lifecycle; no browser security flag is disabled.

## Scientific and execution boundaries

The evidence is authored analytic controls and execution of the existing
conceptual solver. These finite ranges are not confidence intervals, physical
bounds or field validation. The comparison assumes that the same chosen surface
capacity transfers between scenarios; other surface rates and weather stay
fixed. Peak-depth differences compare each scenario's separate maximum and may
refer to different times. Time-step sensitivity and unmodeled processes remain
outside this slice. No provider integration or deployed application is claimed.
