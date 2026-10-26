# A depth question from original receiving evidence

## Capability and source

The maintained draining-receiver investigation can compare explicitly offered layer explanations against original calibration readings and challenge them with held-aside readings. It previously did not connect those supported trajectories to the maintained complementary-depth planner.

This change reuses `planComplementaryDepths` with a one-reading budget. It considers only calibration-compatible trajectories already computed by the maintained comparison, excludes recorded coordinates in the original target scenario, names the separated and unresolved pairs, and keeps every evidence result. It performs no additional runoff simulation.

The planning half-width is explicitly the largest original calibration half-width. Held-aside values never select the question. The proposed cell/time belongs to the original modeled event and may precede entered readings; it is not presented as a future acquisition schedule or an observed fact.

If fewer than two calibration-compatible explanations remain, no question is offered. If the complete family exceeds the maintained planner's bound, the question is unavailable while all evidence rows remain. Broad or overlapping bands and fully recorded trajectories yield no separating question. Source-only saves retain the existing schema and recompute on reopening.

## Qualification

Originally implemented against `560c2a3186899da547df488b000d165dea9bd5c4`, then composed without conflicts on maintained `316301b9fd577df6093112913d1fa8025f076756`. Five source/test paths change; the shared planner and runoff solvers are unchanged.

On that composed source, `npm test` passed **1,228/1,228**, with no skipped tests. The first archive-only run had one unrelated CLI test fail because `git rev-parse HEAD` had no repository metadata; the exact composed source was committed locally as `b823371dd5a36983af855c4f4a6b5139b94e74ae`, then the complete suite passed. This local receiving commit identifies the tested source tree; it is not a maintained release SHA.

Run the browser receiver with:
```sh
BROWSER_RUN_DIRECTORY=<owned-output> CHROME_BIN=<sandbox-capable-chrome> node tests/draining-evidence.receiving.mjs
```

Twelve actual sandboxed browser groups pass, including source-file upload, actual source-only download/reopen, held-aside changes, malformed-source refusal, late-file retirement, current-site invalidation, and desktop/390px presentation. See [browser receipt](browser.json), [desktop question](question-desktop.png) and [narrow question](question-narrow.png).

## Independently calculated unfamiliar input

The actual original-file browser upload declares an isolated flat 2×2 site, 36 mm/hour rain for one hour, 24 mm/hour intake, a five-minute calculation step, initially empty closed stores of 5 and 6 mm, and no drainage. Calibration is A1 at minute 5: 1 ±0.1 mm. Held-aside A1 at minute 180 is 31 ±0.1 mm.

Independent arithmetic gives both early depths as 3 mm rain minus 2 mm intake = 1 mm. At minute 15, 9 mm rain minus the filled stores gives **4 versus 3 mm**. After rain, 36 mm minus those stores gives **31 versus 30 mm**. The maintained product proposes A1 at modeled minute 15, separating the two ±0.1 mm bands.

Changing only the held-aside value from 31 to 30 swaps the surviving explanation and leaves the question identical. Widening calibration uncertainty to ±100 mm withholds a separating question. This is authored numerical receiving of a conditional finite-family question, not measured hydrological accuracy or unique physical identification.

## Concurrent-main refresh

Before merge, maintained main advanced to `fda7d228d5e0b7a9a4d6662e6c8fbcec01f070e4` with an unrelated paired-trend planning change. All five changed source/test paths compose byte-for-byte unchanged. On this complete combination, `npm test` passed **1,232/1,232**, with no skips, and all twelve browser groups passed again. Local receiving commit: `7b4550c627d2830ced834a84b93d51d8ecccbdd0`. Independent source/visual review accepted the five-path change; the latest-main refresh changes no question implementation.
