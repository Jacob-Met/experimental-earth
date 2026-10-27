# Independent receiving for timed route comparisons

This additive receiving course checks the timed-traversal consumer introduced by PR #437. Original issue #99 owner `hamon-auto11-earth-timed-route-20261024` remains unchanged. It does not replace the owner's course, alter production calculations, or claim physical route safety.

## Run from the repository root

```sh
node --test tests/route-traversal.test.mjs tests/route-traversal.oracle.test.mjs
CHROME_BIN=/usr/bin/google-chrome node tests/route-traversal-oracle.receiving.mjs
```

The browser course uses the maintained browser-session harness and defaults to `/usr/bin/google-chrome`. `CHROME_BIN` may identify an existing compatible executable. It requires Linux Chromium and the harness's active sandbox admission. Do not disable the sandbox or weaken admission to obtain a passing result. On the receiving host, `/usr/local/bin/google-chrome` was a wrapper adding `--no-sandbox` and a shared profile; that wrapper is unsuitable for this isolated, sandbox-required course.

Preparation of these files is not an execution receipt. Record the tested commit, command, exit status, and output before claiming qualification. The browser prints its outcome records and unique run directory only after successful completion. Preserve the run directory's session and sandbox receipts, including failure receipts when present. A browser launch or sandbox refusal means the browser consumer remains unqualified; passing numerical tests does not substitute for browser receiving.

## Independent numerical expectation

`tests/support/route-traversal-oracle.mjs` reads raw snapshot times and depths. It partitions departure time at shifted snapshot boundaries and threshold crossings, samples each resulting interval's midpoint at each cell's cumulative arrival offset, and joins qualifying adjacent intervals. It does not call `pondingExposure`, `timedRouteWindows`, or the production snapshot sampler. Midpoint classification is sufficient inside each partition because the retained depth functions are linear and all relevant crossings are partition boundaries.

The unit course checks overlapping constraints and cumulative travel times, changed timing, reverse order, an existing/proposal difference of +7 minutes, threshold changes, isolated equality, equality plateaus, and 48 deterministic varied snapshot cases. Separate exact-arrival checks compare production samples with independently interpolated depths. These cases intentionally avoid floating-point stress at the production interval tolerance.

Agreement establishes consistency with the specified piecewise-linear snapshot interpretation for these inputs. It does not validate the rain solver against measurements, infer travel speeds, prove physical passability, bound unobserved changes between snapshots, or establish correctness for every malformed or extreme numerical input. The shared solver generates the maintained-example snapshots; it is not an independent physical reference.

## Browser consumer coverage

The course first opens the maintained `index.html` application in the harness's new isolated profile and restores the fictional example through the application's reset control. It submits `D3 E3 F3`, one minute per step, threshold 20 mm, and departures from 0 to the lesser of 30 minutes or the retained end minus two minutes. It compares all rendered windows, counts, totals, and the proposal difference with the raw-snapshot oracle applied to `compare(makeExample())`. Both totals must be positive and less than the requested duration, and the proposal difference must be positive. The current example produces approximately 23.34 existing minutes and 24.79 proposal minutes, a +1.46-minute difference; expectations are recomputed from raw snapshots during the course. The explicit reset establishes the source project; this is not an arbitrary saved-project comparison. Before replacing the page for analytic fixtures, it saves desktop and 390-pixel-wide traversal screenshots in the run directory and checks for horizontal overflow.

It then replaces the test page's body and mounts the real parent route panel and timed-traversal panel with analytic fixtures. This second phase exercises production controls and refresh behavior with controlled model data; it is not another maintained-application startup check. The grid is 3 by 2, with A1/B1/C1 as the route and three dry padding cells. Existing B1 has depths 0, 2, 0 mm at minutes 0, 10, 20; all other cells and the proposal stay dry.

| Query | Expected modeled result |
| --- | --- |
| Threshold 1; route A1 B1 C1; steps 2,1; departures 0–10 | Existing window 0–3: 3 minutes. Proposal 0–10: 10 minutes. Difference +7. |
| Same query, earliest departure 3 | B1 arrives at minute 5 exactly at threshold. The requested point qualifies, but no positive-duration existing window remains. |
| Same query, earliest departure 4 | First existing exceedance is B1 at minute 6, depth 1.2 mm. |
| Parent threshold changes to 2, then back to 1 | Difference becomes 0, then returns to +7 without resubmitting timing. |
| Steps change to 5,1; departures 0–10 | No positive-duration existing window; proposal retains 10 minutes. |
| Route changes to C1 B1 A1, then timing 1,2 is submitted | Old timing result is cleared. New existing window 0–4 totals 4 minutes; proposal totals 10; difference +6. |
| Latest departure 19 with cumulative travel time 3 | Refusal clears old results; restoring latest departure 10 recovers the comparison. |
| Proposal retained endpoint deliberately changes from 20 to 21 | Mismatched-horizon refusal clears old results; restoring the endpoint and refreshing recovers the comparison. |

For each screenshot, the course scrolls immediately to the traversal section, waits for layout frames, asserts that the section's top is inside the viewport, and clips the capture to the section's complete document-coordinate bounds. Capturing beyond the viewport retains the full mobile form and results. Horizontal overflow is checked separately. Screenshot paths and capture regions are recorded in the outcome; visual review must still confirm the intended content is present. A prior viewport-only capture could occur during smooth scrolling and show unrelated page content, so numerical success alone does not establish target screenshot coverage.

The course checks project/snapshot immutability before the deliberate endpoint edit and after its restoration, and requires no recorded browser script exceptions. Its random run directory and the harness's exclusive directory creation prevent profile reuse; Chromium receives that newly created profile through `--user-data-dir`.

## Received execution

The October 27 receiving record preserves the original command identities, source hashes, sandbox admission, and deliberate failure controls in [the execution receipt](receipts/timed-route-independent-dae856c9.json). The full native suite passed 1,416 tests on the original `38e8da9` production base. After composing the merged navigation update at `e4a6d4b`, 30 focused tests and all 11 browser outcomes passed. Desktop and narrow-width captures were inspected after correcting the capture's scrolling behavior; the original failed captures and the fractional-scroll assertion failure remain identified in the receipt.

The final captures show the [desktop traversal](receiving/timed-route-independent-dae856c9/desktop.png) and [390-pixel traversal](receiving/timed-route-independent-dae856c9/mobile.png). They are evidence from the actual maintained application with the declared example inputs, not independent field measurements.

## Review observations outside this change

Source review identified bounded API edge cases involving sparse route arrays, positive intervals shorter than the absolute tolerance, and the tolerance difference between window horizon admission and strict snapshot inspection. These observations are not production fixes or claims that ordinary authored routes exhibit those failures. They remain separate from this consumer receiving course.
