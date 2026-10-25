# Original logger timestamps in depth tables

The ordinary observation CSV preview accepts `timestamp,event_start` in place of
`minute`. All other required columns and optional evidence roles are unchanged.
For example:

```csv
cell,timestamp,event_start,depth,uncertainty,unit,source,scenario,use
A1,2026-10-25T01:15:30+02:00,2026-10-24T23:00:00Z,1,.1,cm,logger record,existing,calibration
```

This imports 10 ± 1 mm at 15.5 minutes. Both original clock strings remain in
`tableSource`, alongside the original depth/unit, source filename and record line.
Preview displays both clocks before any append. Export/reopen rechecks the
conversion against the notebook minute; changed inconsistent times are refused.
Every row in one table must declare the same event-start instant. Equivalent UTC
offsets are accepted. The normal notebook event-duration and capacity limits apply.

Use full ISO calendar date and time, including seconds, with `Z` or a numeric
UTC offset. Milliseconds are supported (one to three decimal digits). Invalid
dates, leap seconds, 24:00, timezone-free timestamps and unknown `-00:00` offsets
are refused rather than normalized. Observations before the declared start are
refused. Use explicit offsets on each side of a daylight-saving transition.

This is a declared clock correspondence, not a synchronization measurement or
clock-drift estimate. It does not acquire observations or assert that separately
imported tables describe the same event. Confirm their event association before
using calibration/challenge roles. Existing relative-minute tables remain supported.

Verification uses independently changed dates/offsets, leap-day and DST controls,
raw clock tampering, mixed-start/column refusals, stale previews and existing CSV
regressions. These are software controls, not physical logger qualification.

## Executed receiving (October 25, 2026)

Source reconstruction used commit `3a56627d99c72cf7434540f605c807ed6c5bd386`.
Final full-application receiving incorporated refreshed main `330ad155` placement-batching dependencies. Current owned-file base copies were compared before publication; only the timestamp
intake changes appear in those diffs. No hydraulic solver changes are included.

Executed `node --test tests/observation-table.test.mjs tests/observation-clock.test.mjs`
on Linux 6.18.55 with Node v24.22.1. Both test files passed with exit zero; this runtime
reports two file-level tests. The files contain 12 existing CSV groups and six new
clock groups, including canonical duplicate identity and distinct absolute events.

Executed the **full maintained application**, not only an isolated panel, using:

```
PLAYWRIGHT_MODULE=<installed Playwright module> \
BROWSER_EXECUTABLE_PATH=<installed Chrome executable> \
BROWSER_ARTIFACT_DIR=<writable receiving directory> \
node tests/observation-clock-full.browser.mjs
```

Receiving used Chrome 156.0.8078.47 headless at 390×844 with Chromium sandbox
explicitly enabled, running as `nobody` through the authorized loopback route.
The browser's sandbox page confirmed namespace and Seccomp-BPF support. The actual
application accepted the original CSV, displayed both clocks, appended by keyboard,
downloaded its project, retained the clock through reload and imported that project.
An invalid calendar date was refused with the prior notebook preserved. Retained screenshots show the accepted timestamp preview at 1440px and 390px; both were visually inspected. Neither viewport had horizontal overflow. No page errors or external requests were recorded. The earlier isolated panel
harness is not the final full-application evidence.

A direct maintained `compareInfiltration` receiving compared the same A1 calibration
and B2 held-aside rows supplied at absolute-clock times versus equivalent relative
15.5/45 minutes, with sealed-surface rates 1/9/22 mm/h. Complete results were exactly
equal, including residuals, ordering and water accounts, while source clock tokens
remained intact. Independently changing the held-aside depth from 20 to 30 mm left
calibration results unchanged and changed the challenge residuals. The authored
readings rejected all offered calibration candidates; this informative rejection
is retained rather than counted as physical calibration success.

Receipts: `docs/receipts/observation-clock-4f4650/`. The screenshot and authored
readings establish software receiving only. No actual logger acquisition, field
accuracy, clock synchronization or Nebius platform execution is claimed.
