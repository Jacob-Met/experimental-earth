# Experimental startup bundle — not an accepted performance improvement

The maintained entry remains `index.html` → `app.js`. The separate
`index-bundled.html` entry is deliberately experimental and must not replace
the normal entry without real-browser validation and a measured startup gain.

## Reproduce

Run `npm ci`, `npm run build:preview`, `npm run check:preview`, then
`python3 serve.py` and compare the ordinary `/` with
`/index-bundled.html`. The build is deterministic and the check refuses
stale generated content. The source modules are not removed. JavaScript
workers and dynamically referenced CSS retain their browser-relative URLs;
this must also be checked in an actual browser.

The input is the maintained main source at
`fde1d453c01eb7b8fa8e67cf4fd37d29d4056135` on 2026-10-29.
A source-graph spike using esbuild 0.25.12 reduced 404 static ESM inputs
(total 2,867,555 source bytes) to one ESM output of 1,965,459 bytes
(566,417 bytes under level-9 gzip) and zero external static imports.
This measures graph form and bytes **not user-perceived speed**. Existing
source-bound baseline data reported 344 JavaScript resources, 2,570,683
decoded bytes and median 1,065 ms until ordinary interaction across five
Chrome 156 loopback contexts, but that is not a paired candidate comparison.

Static serving on HAMON Browser 1 independently passed 7 baseline and
8 preview HTTP checks (complete response hashes, MIME, retained worker/CSS
URLs, expected refusal of missing/private resources). A complete browser
acceptance and alternating performance comparison was attempted on
HAMON Coordination 5 and HAMON Browser 1 but **correctly refused** because
their Chrome 156 processes reported no active Chromium sandbox protection.
Do not disable the retained sandbox receiving check to obtain green results.

## Necessary gate before adoption

Run alternating baseline/preview measurements using the same maintained
browser verification on a host with an adequate Chromium sandbox. Confirm
ordinary initial readiness, all investigations and direct links, later-use
navigation, source/draft persistence, declared models/results, keyboard,
narrow/mobile layout, loading failures/recovery, and maintained offline
package with the exact generated bundle. Repeat source edits and ensure
`npm run check:preview` catches stale output. If there is no meaningful
consumer improvement or regressions emerge, discard this preview and keep
the ordinary module entry.

This work is isolated on a dedicated task-owner branch; no public release,
production merge, or performance acceptance is implied.
