# Proposal component experiment receiving

## Source and ownership

Native outcome: [experimental-earth #73](https://github.com/Jacob-Met/experimental-earth/issues/73).
Team `hamon-cb295a6c5277-20261023`, direct worker `experimental_earth`; independent integration/receiving by the team lead.

Initial baseline: `8896a02d04d5c6cd200c4cc70fecb5c01d797b77`.
Refreshed integration baseline: `aeaa12af91c3b9a9b442eafaaff2a2ceed9ac67f`, including the finite internal crest implementation. All 12 upstream changed files were fetched and composed before qualification; owner changes are preserved. Component edit detection now reuses the maintained `sameInternalBarriers` interface, including finite crest values and canonical ownership. Only `app.js`, `styles.css` and `README.md` differ from existing baseline files; four new module/panel/test files implement the experiment. The solver and other owners' modules are unchanged.

The following SHA-256 digests identify the exact reviewed feature files before this receipt is committed:

| File | SHA-256 |
| --- | --- |
| `app.js` | `50e7c3c27c083b0e8987eb4602904fc85de253bcdcf4ffd5312ed9e81d71aa21` |
| `styles.css` | `4967e3cdcfc5be18183ce04856926c0e1ad60e6c773ea4e67bc0ff058f0016bb` |
| `README.md` | `209fbac4b1ff0d66da280fbbd638e1d05ddcc8dd2fe6e81cbb21aaa7e2e9c802` |
| `proposal-components.js` | `fc1e4d8f17828ed657ed2f919dbcb521e35878cabd07d254ecaa5aa8cdd85254` |
| `proposal-components-panel.js` | `0fe4074852565b97b42abb3bb9f2ebbd825b9411cb5b1c40d506976a6c8577c0` |
| `tests/proposal-components.test.mjs` | `baf9591a9ad55c836ae233930574932e614393f4e72ebfbfac71986be3c55684` |
| `tests/proposal-components.receiving.mjs` | `3757d8f599cfa541d21463a143c4a3353b400f49fb5661cb0e39c0701b68ee45` |

## What the experiment establishes

Four maintained-solver calls compare existing, selected-cell edits only, remaining edits only and the full proposal under identical authored weather and default surface infiltration capacities. Each cell carries its authored changes together, including canonical east/south edge records. Source labels alone are not modeled edits. The interaction is `full − selected − remaining + existing`, in the native unit of each quantity. It is a finite model experiment, not a field causal estimate.

An independent immobile 2×2 one-hour control with 30 mm/h rain and closed exterior starts with sealed cells (1 mm/h infiltration), then changes one to garden (24) and another to turf (9). Final water volumes are 116, 93, 108 and 85 L: effects −23, −8 and −31 L, with zero interaction. A coupled-flow terrain/surface control has nonzero local interaction; reversing the component partition preserves interaction and swaps the two separate effects. Direct ordinary comparisons agree with full/existing cases. Canonical barrier ownership, mass closure, input/evidence immutability and a reachable one-million-cell-step refusal are covered.

For the fictional courtyard, grouping D3/D4/D5 versus E3/E4/E5 gives final-storage effects −869.507 and −878.957 L individually, but −1257.650 L together: +490.815 L interaction. The conserved volume-component interactions sum to approximately zero (3.2e−12 L residual), and the sum of cell storage interactions equals the site storage interaction. An additional immobile control changes all four sealed cells to gardens in two groups: each separate group leaves maximum depth at 29 mm, while their union lowers the maximum to 6 mm. Maximum-depth interaction is −23 mm although every local final-depth interaction and total-storage interaction is zero. Thus aggregation alone can produce interaction in maxima. These are authored numerical examples, not observed environmental benefits.

## Native verification

Local runtime Node.js v24.19.0:

```sh
node tests/proposal-components.test.mjs
node --test --test-isolation=none tests/*.test.mjs
node --check app.js
node --check proposal-components-panel.js
```

The initial six focused groups and **267 complete native tests passed**. After the final interpretation review, a seventh analytic focused test was added and all **seven focused groups passed**; it proves that a maximum can have nonzero interaction even when there is no water exchange. The four-case arithmetic did not change. After the finite-crest main update, a further canonical crest-only control passed: two crest-only owner cells are recognized, the partial case equals a direct ordinary simulation, source-only changes are excluded, altered crest values are included, and conservation/nonmutation hold. The current composition passes **eight focused groups and 282 complete native tests** locally. Explicit isolation disabling provides individual test counts with this local runtime; ordinary `npm test` also exited successfully but reported file-level suites. On the previous `8896a02` composition the independent remote receiver reported 268 native tests passing on Node.js 22.23.4 using `npm test`. The `aeaa12af` finite-crest composition subsequently passed **282 native tests, ten focused actual-Chrome groups and the complete 85-group maintained browser course** independently. Latest integration base is now `ab0675f0f5e6f004da257dee32fb50edb00c62c2`, adding threshold evidence: its core delta only imports/calls project-level threshold validation; it changes no cell physics or runRain arithmetic. The app import/refresh/mount hooks were composed without removing the threshold panel. The final `ab0675f0` composition passed all **15 component-plus-threshold native tests and ten focused actual-Chrome groups**. The threshold panel initializes alongside the component consumer, and the crest-only import remains valid. No further full-course rerun was needed because the incoming core change adds project-level validation without changing the hydrology.

## Actual browser receiving

The independent team lead ran actual Chrome 156 on the remote Linux receiver through the maintained `withBrowserSession` runtime. On the previous `8896a02` composition, the focused course passed **nine groups**, including genuine CDP keyboard Space activation of a focused cell checkbox and ArrowRight scrolling of the focused horizontal table region. It also exercised empty-subset refusal, all four model cases, all-cell diagnostics, input nonmutation, desktop/390px layout, weather invalidation/recomputation, reopened-project freshness and identical-plan refusal.

```sh
CHROME_BIN=/opt/google/chrome/chrome node tests/proposal-components.receiving.mjs
CHROME_BIN=/opt/google/chrome/chrome npm run browser-receive
```

The entire maintained browser receiving course also passed 85 groups on that previous composition. The current focused harness additionally imports a crest-only project and exercises its canonical component partition; its ten-group course passed on `aeaa12af`. The helper requires independent same-browser sandbox admission before product assertions; the generic process-owner receipt's `sandbox: not-assessed` field must not be represented as that admission. The received dedicated `sandbox.json` reports admitted=true with Namespace and Seccomp sandbox support. Retain it alongside the focused run receipt. The original screenshot capture selected other page sections despite passing behavioral assertions, so it is not component pixel evidence. The corrected focused harness explicitly sets 1440×1000 desktop/390×844 mobile viewports, instantly scrolls to the component panel, waits two animation frames and captures its page-coordinate DOM rectangle with `captureBeyondViewport`. The final `ab0675f0` [desktop](components-desktop.png) and [390px mobile](components-mobile.png) captures were independently inspected and show the actual panel/results. [Focused receiving](focused-browser.json), [sandbox admission](sandbox.json), [prior complete browser course](maintained-browser-aeaa12.json) and [source/verification manifest](verification.json) retain the distinct execution scopes.

## Limits and integration status

This receipt establishes source behavior and actual browser use, not field-calibrated hydrology, physical causality, intervention permission, deployed service behavior or a selected inference hypothesis. Derived partitions/results are temporary and are recomputed from saved plans after reopening. Finite internal crests are included through the maintained owner interface. Prospective model fields such as pending initial ponding are not guessed by edit detection; adopting new cell physics requires intentionally extending its signature and tests.

Independent review found no core blocker: the reviewer reported six focused groups plus 32 separately constructed coupled cases passing exact hybrid, complement-symmetry, equal-forcing, conservation and nonmutation checks. The final maximum-interpretation wording was incorporated as a review improvement. Normal merge remains separate from these checks. The integration commit and postmerge verification belong in the native issue/PR once completed; do not infer a merge from this premerge receipt.
