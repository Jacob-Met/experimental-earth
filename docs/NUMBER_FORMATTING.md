# Numeric formatting during workbench redraws

Ordinary workbench edits redraw the main comparison and ponding replay. The maintained main helpers previously called `Number.toLocaleString` for every value. The main map can format several values for every cell in both scenarios. `number-format.js` retains three private `Intl.NumberFormat` instances and serves the existing helper call sites.

## Display contract

| Consumer | Original conversion and precision | Retained behavior |
| --- | --- | --- |
| Main map, comparison and selected-cell values | `Number(value)`, en-US, maximum one fractional digit | Same values, strings and signed zero |
| Reading values | `Number(value)`, en-US, maximum six significant digits | Same significant-digit rounding |
| Ponding replay | `Number(x.toFixed(2))`, then default en-US formatting | The original two-stage rounding order |

The ponding conversion deliberately keeps `toFixed` before `Number`. Replacing it with a two-decimal locale option would change some existing strings: the original expression renders `1.005` as `1`. The native parity course also covers `-0`, negative values rounded to zero, nonfinite values, extreme magnitudes, and the existing numeric coercion and type refusals.

The three formatter objects remain private. No per-value cache grows with edits, and no formatted text is written into the project. `app.js` keeps its helper names and all call sites; `ponding-panel.js` keeps its existing `num` call sites. Source elevations, precision choices, layout, labels, editor events, the full forward comparison and every panel refresh retain their existing behavior. The active elevation-presentation work can still change its own display choices independently.

## Historical pre-worker receiving

The historical browser course started the unchanged maintained `serve.py` independently for canonical baseline and candidate. It compares actual served module response hashes, all main depth attributes and accessible names, comparison metrics/chart/balance, selected-cell and notebook text, every ponding label and detail, and original downloaded project bytes. It exercises keyboard selection, notebook entry, material/elevation brushes, invalid weather, ponding replay and threshold changes, and reopening the original export in a fresh 390-pixel context. All seven groups passed with no page errors, failed assets or off-site requests.

The native helper course compares the literal incumbent expressions over 1,115 deterministic numeric values per helper, plus coercion, refusal and interleaving controls. The full maintained project gate and exact source identities are recorded in the companion qualification receipt.

### Historical synchronous change-handler times (before the rain worker)

These historical measurements belong to the formatter-only qualification on tested base `bd812d28b824f3e215de3a5f739c808ac9f4264e`, reconciled to `c20a357e4e34c0f6de30fb942ae9ed4b08b975c2`. They do not measure the current worker composition. Each row uses seven alternating baseline/candidate pairs on Chromium 156.0.8078.73. Values are medians in milliseconds.

| Authored case | Action | Baseline ms | Candidate ms |
| --- | --- | ---: | ---: |
| courtyard | Title change | 21.1 | 13.6 |
| courtyard | Changed weather | 26.1 | 11.9 |
| medium | Title change | 71.0 | 44.5 |
| medium | Changed weather | 72.4 | 45.7 |
| maximum | Title change | 275.3 | 169.8 |
| maximum | Changed weather | 262.7 | 160.0 |

These measurements time synchronous `change` dispatch and its handler/DOM-update work. They exclude typing, Playwright transport, subsequent paint and a complete visual-response frame. They are a bounded same-input local comparison on a shared host, not a fleet or device guarantee. All raw pairs and rendered/source identities are retained with the qualification evidence. The large case uses 24×24 cells and 720 one-minute steps; the medium case uses 12×12 cells and 80 steps; the courtyard uses the maintained 8×6 example and 48 steps.

## Decision and remaining work

An earlier comparison-cache trial preserved numerical correctness but showed mixed small/medium results and extra cost on fresh physical changes. Its four variants and negative findings remain archived under source SHA `e53a49954e7cc78a7a6336cf7ac1a89f6a077438f4560c111fb696c9566a58e6`. This formatter change contains no comparison cache. It follows the measured formatting bottleneck and improves the actual tested ordinary-change paths while retaining the full comparison.

The main rain-comparison worker has since been delivered. The current composition starts from the merged worker application and changes only the formatter import and numeric helper bodies in `app.js`, plus the formatter import and existing `num` alias in `ponding-panel.js`. It retains worker scheduling, exact complete model results, cancellation, source-revision checks, explicit failure/retry/restore, accepted-only persistence, and observation-source custody. It does not restore the historical synchronous application or add a comparison cache.

## Current worker composition: qualified

Both sides of the adapted browser course use the same current worker, controller, core and maintained server bytes from main `48907c1af73603e7a7c98a1feda471084e4cd75e`, tree `36bae719a176085feeb5809f7d05c6956ae2a964`. This includes the merged mixed-material planner and its minimum-timestep correction. The baseline app is pinned to SHA-256 `343a35f2fcec45672ce59576415eed1ef4d15c92fb546164e11380e9220667c3`; the candidate app is `1a9b99926de2262ed7e868291793714b243546d9f9e3addcf96362ac730b3d22`. The actual served app, ponding panel and formatter responses must match their exact source bytes. Historical qualification remains separately identified in the companion receipt and original archive.

The course waits for ready state and deep equality of the entire accepted project with the requested source after imports, timed title/weather edits, keyboard selection, notebook entry and physical brush changes. It also requires a new comparison generation for accepted changes. Equal obsolete DOM from two pending workers cannot satisfy this gate. Invalid weather instead must retain the previous accepted source.

New timings record two distinct browser-local intervals: synchronous event dispatch, and dispatch through accepted-source persistence and completed display refresh. The latter includes worker startup, simulation, transfer, validation and DOM work, as applicable. Neither interval establishes that a paint completed. Alternating pairs still share host and browser scheduling costs; the new results must not be combined with the historical pre-worker table as if conditions were unchanged.

The full current native gate passed **1,919 tests, zero failures/skips/cancellations**, across 275 maintained test files using Node 22.23.4. All candidate source stayed unchanged through the current browser and native receiving. The earlier 1,907-test, seven-browser-group result on `8a9ba68` is retained separately; the new result includes the eight-path mixed-material integration and the final reviewed browser runner.

The final reviewed browser course passed **all seven groups** in actual Chrome 156.0.8078.47 with affirmative namespace/PID/network/Seccomp sandbox diagnostics. It preserved complete displayed numeric evidence and exact project bytes through notebook and keyboard actions, changed material/elevation, refused invalid input, replay controls, actual export and a fresh 390-pixel consumer. There were zero page errors, failed assets or off-site requests. The executed module hashes cover 333 baseline and 334 candidate modules; all unrelated executed modules match. Candidate source bytes stayed unchanged during receiving.

### Current same-input worker measurements

Each row contains seven alternating baseline/candidate pairs. These browser-local medians are milliseconds. Accepted display includes the same complete physical comparison and source persistence on both sides.

| Authored case | Action | Baseline dispatch | Candidate dispatch | Baseline accepted display | Candidate accepted display |
| --- | --- | ---: | ---: | ---: | ---: |
| courtyard | Title change | 17.5 | 9.4 | 17.7 | 9.5 |
| courtyard | Changed weather | 15.4 | 9.9 | 15.5 | 10.0 |
| medium | Title change | 1.1 | 1.1 | 154.2 | 136.4 |
| medium | Changed weather | 1.1 | 1.0 | 147.6 | 127.3 |
| maximum | Title change | 2.6 | 2.5 | 654.8 | 522.3 |
| maximum | Changed weather | 2.6 | 2.2 | 652.1 | 556.0 |

Accepted-display medians improved in all six observed cases. The large worker cases still spend substantial time in simulation, transfer, validation and refresh; this formatting change does not remove those costs. These are authored same-input measurements on one shared host, not field validation, a paint measurement or a general device guarantee.

### Preserved failures and the runner correction

The first current attempt refused a system Chrome wrapper that injected `--no-sandbox`, before navigating to the application. Later attempts used the real vendor binary and passed sandbox checks but stalled in the unchanged baseline during the maximum case. Diagnostic receiving retained the pending generation and prior saved project instead of treating the timeout as a formatter regression.

The test runner had piped Python's HTTP request log without consuming it. Each new worker fetched the model modules again; accumulated log output eventually blocked the server before response headers. A causal control drained **80,075 bytes** after the original ten-second failure: that already-dispatched generation completed with the exact requested source **828 ms** later, without another edit. The final runner writes server logs directly to separate exclusive files. Its successful current-main course retained 111,372 baseline and 143,861 candidate log bytes. The per-edit ten-second and per-group 45-second limits did not change. A focused missing-Python control also confirms startup refusal and cleanup, rather than an unhandled child-process error.

The complete failures, causal observation, raw successful pairs, exact source identities and independent review are retained in `docs/receipts/number-format-366053231788.json`.

### Separate display follow-on

Visual inspection of both successful captures found an existing chart limitation: large y-axis labels are clipped by the fixed SVG gutter, and narrow-screen scaling makes chart labels very small. The current-main screenshots are byte-identical to those inspected captures. The formatter preserves that canonical layout and those exact strings. [Issue 524](https://github.com/Jacob-Met/experimental-earth/issues/524) queues a responsive-chart outcome to size the gutter and tick presentation for actual values while preserving the physical series and export; formatter parity does not claim that display issue is resolved.

## Reproduce

```sh
node --test tests/number-format.test.mjs
node --test --test-concurrency=2 --test-reporter=spec tests/*.test.mjs
EARTH_FORMAT_BASELINE_ROOT=/absolute/canonical-checkout \
EARTH_FORMAT_BROWSER_OUTPUT=/absolute/fresh-output \
PLAYWRIGHT_MODULE=/absolute/playwright/index.mjs \
CHROME_BINARY=/absolute/chrome \
node tests/browser.number-format.mjs
```

The browser must retain its Chromium sandbox. The baseline must be the current worker app matching the exact source identity pinned in the adapted course, not the historical pre-worker baseline. The maintained original-reading CLI requires real Git source metadata; use a real checkout or an explicitly identified local qualification commit rather than fabricating an upstream revision.
