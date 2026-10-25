# Ponding connectivity receiving — issue #192

## Outcome and source

Additive same-time endpoint connectivity at original solver snapshots, with an
explicit offered cell footprint, minimum maximum modeled depth, shortest witness
among equal bottleneck paths and original-input download/fresh reopen. The source
started at main `879db03cd8600cf1d4f0f0fffd40bf48b174caa7` and was composed with
main `511f13018ae27a76f2d9abe314544ef6baa9140a`. The incoming common-clock-conflict and
rooted-water-timing files were preserved byte-for-byte against their Git blob SHA.
Upstream `app.js` and `README.md` had not changed, so only the declared additive
mount/refresh and documentation edits were carried forward.

## Independent checks

Eight named native groups pass. An independent all-simple-path enumeration over
1,024 binary 3×2 grid/footprint cases checks the minimax value and shortest witness
length. An additional read-only experiment compared 200 deterministic arbitrary
multilevel 3×3 grids against full simple-path enumeration; every minimum and
shortest length matched. The actual maintained courtyard demonstrates the
A2–D2 minute 15 detour: 8.148554630401236 mm versus the straight row's
10.652361275077158 mm. This is authored computational evidence.

The team's independent core review accepted the minimax Dijkstra followed by a
separate threshold BFS. It identified sparse-array admission and pre-allocation
parser-dimension gaps; both were corrected and covered by explicit tests before
remote receiving. Review did not claim environmental or physical validity.

## Actual execution and retained failures

- Local Node 24 new native groups: 8 passed, zero failures/skips. Original local
  full-suite child CLI checks hit a reproduced `spawnSync` EPERM with empty
  output; those checks were not counted as passed locally.
- Authorized remote Linux Node 22 source receiving initially passed 670 of 671
  tests. The one failure was the existing reading-methods CLI requiring a real
  `git rev-parse HEAD` in an unpacked source directory. A clearly labeled local
  hydrated-source snapshot was initialized; the test then passed and the full
  original composed course passed 671 of 671, zero failures/skips. That local Git
  identity is not an upstream commit identity.
- `/usr/local/bin/google-chrome` was observed to be a wrapper injecting
  `--no-sandbox`; maintained sandbox admission correctly refused it. The real
  `/opt/google/chrome/chrome` passed admission. The guard was preserved.
- The first actual consumer course did not submit its focused form because its
  CDP Enter event omitted carriage-return text; the expected 49 rows remained
  unchanged. The harness was corrected to assert focus and send Enter with
  `text` and `unmodifiedText` set to carriage return, matching the maintained
  receiver convention. No product runtime change resolved this harness failure.
- Corrected actual sandbox-admitted Chrome 156 receiving passed all 8 groups:
  keyboard/native-time course; minimax witness/source nonmutation; raw Blob
  download and fresh File reopen; restricted/disconnected footprints; malformed
  source/query refusal; desktop/narrow layout; site invalidation; and pending-read
  race. No page exceptions were reported.

Commands: `node --test tests/*.test.mjs` and
`CHROME_BIN=/opt/google/chrome/chrome node tests/ponding-connectivity.browser.mjs`,
run from the isolated received source root. These checks establish local software
behavior, not public deployment, platform/model qualification, field accuracy,
physical access, a timed traversal or permission to intervene.

## Refreshed composition receiving

After receiving all 17 incoming text blobs from main
`511f13018ae27a76f2d9abe314544ef6baa9140a`, the complete composed native suite
passed **691/691**, with zero failures or skips. The same actual browser course
passed **8/8 groups**, with no reported page exceptions, under the maintained
sandbox admission and `/opt/google/chrome/chrome`.

Remote local hydrated-source verification snapshot:
`f487f9c620d61d22596688d9fb6d563da7bea418` (not an upstream commit).
The unique run directory was `/tmp/hamon-8db6c36/earth-receipt-final`.
Commands, from the composed source directory:

```sh
node --test tests/*.test.mjs
CHROME_BIN=/opt/google/chrome/chrome BROWSER_RUN_DIRECTORY=/tmp/hamon-8db6c36/earth-receipt-final node tests/ponding-connectivity.browser.mjs
```

These are premerge composition results. A source merge and actual merged-consumer
receiving are separate subsequent checks, not inferred from this result.

## Result-view visual correction

The initial desktop/narrow captures showed the form. A stronger receiver then
opened the full course and scrolled the actual witnesses and first four rows into
view. It exposed a real narrow layout defect: the disclosed table expanded the
page to 407 px under a configured 390 px viewport. The width assertion was kept.
The owned panel now sets `min-width: 0`, bounds its table wrapper and reuses the
maintained fixed-column, wrapping `resolution-table` presentation. No global CSS,
solver, graph algorithm or numerical assertion changed. The stronger course keeps
both top-of-panel and result-view screenshots for each viewport.

The corrected bounded layout passed the eight-group course and its narrow result
image was inspected. That inspection exposed a second concrete readability issue:
very small signed differences wrapped inside a number. Numeric table cells now
use four significant digits, switching to three-digit scientific notation for
magnitudes below 0.01 or at least 1,000; their full computed values remain in the
cell title. Numeric cells do not wrap. Original row values, graph computation and
input exports remain unchanged. The result-view receiver explicitly verifies
that every numeric cell stays on one line and fits its available width.

Publication was refreshed onto
`dbc32189cf3a39baf0394cf77d5090283ed0f736` after the unrelated evaporative-cooling
merge. All 13 incoming text files were verified against upstream blob identities.
The complete incoming `app.js` and `README.md` were retained before applying the
same narrow connectivity mount/refresh and appended documentation. The seven new
cooling native groups and eight connectivity groups also passed locally on that
composition; the cooling mechanism was not modified by this work.

## Final review and receiving

The final composed browser course passed all eight groups and the lead visually
accepted the narrow numeric table and both output witnesses. Independent final
review then found that a paired sparse snapshot array could bypass `forEach`
validation, producing a partial course. Validation now explicitly visits every
snapshot slot with `Array.from`. A new native regression covers paired all-hole
arrays, paired interior holes, and a hole on either individual scenario. All
**9/9** connectivity native groups passed locally after this correction, with
zero failures or skips. Dense solver results, graph computation and UI behavior
were unchanged. The review finding and its regression were retained before
publication rather than treating the earlier passing dense course as complete
input admission evidence.

## Final publication receiving

The exact publication was composed with cooling main `dbc32189cf3a39baf0394cf77d5090283ed0f736` and received on Node22.23.4 / Chrome156.0.8078.47. `node --test tests/*.test.mjs` passed **699/699**, zero skipped or failed. The preserved browser course passed all8 groups with active namespace/seccomp sandbox admission, complete results visible at390px, nonwrapping numeric cells and exact values retained in cell titles. The local Git snapshot `ccb2efab3c0f0998322bb717a6ea40bea462b7af` identifies the hydrated verification workspace, not an upstream commit. The sandbox browser run directory was `/tmp/hamon-8db6c36/earth-publication-browser`.

A second independent optimizer-worker review found the sparse snapshot-array admission hole before publication. Both all-hole and interior-hole variants now refuse; a dense positive remains complete. The reviewer independently received the correction and reported no further graph/source-reopen blocker. The final consumer uses the same minimax and separate shortest-witness algorithms.
