# Full browser receiving: current navigation, reloads and panel positioning

Issue: [#402](https://github.com/Jacob-Met/experimental-earth/issues/402)  
Source base: `2447048f9022bdbeddbc6e9d60cc3b70538eeca6`  
Date: 2026-10-26

## Result

The maintained `node tests/browser.receiving.mjs` course passed **98 checks and 47 completed reloads in 73.12 seconds**, using Node 22.23.4 and sandboxed Chrome 156.0.8078.47. No runtime exceptions were recorded. The launched browser child exited and the session logs completed.

The run includes the custom water-budget area delivered by #401 and the existing ponding, infiltration, outlet, joint-evidence, decision, regional accounting, rain-attribution and measurement courses. The exact four source hashes, all check descriptions, sandbox assessment and retained failure history are in [receiving.json](receiving.json).

## Why the receiving code changed

A matched native-keyboard probe on the pre-feature baseline and #401 candidate showed that Tab correctly reaches **Plan complementary depth readings** before the resolution action. The former assertion incorrectly expected one Tab to jump directly to the later action. The revised course traverses the real focus order with native Tab, requires that intermediate disclosure, bounds traversal by the current DOM, rejects a wrap back to the start and retains the destination's visible-focus assertion.

The full course then exposed an actual receiving race: fixed delays after `Page.reload` could inspect the old document or a document that had not completed the application's startup. The driver now waits for a changed `performance.timeOrigin`, completed document load and the final mounted investigation navigation. It dispatches each reload once, honors cancellation, retries only the known context-replacement errors and provides bounded timeout diagnostics. The receipt reports completed reloads rather than silently ignoring them.

Two later screenshot assertions assumed a panel would scroll to zero pixels. The unchanged stylesheet specifies a 16 px scroll margin. Outlet and joint receiving now compare the rendered top with the computed margin using the existing one-pixel tolerance and finite, nonnegative, in-viewport guards. Width, overflow, scale, scientific quantities, evidence provenance, import/export and stale-result assertions remain in force.

## Evidence retained

| Run | Result | Finding |
| --- | --- | --- |
| Matched baseline/candidate focus probe | Same native focus order | Both reach the legitimate complementary-depth disclosure before the resolution action. |
| Full course 001 | Failed after 8 checks | A reload followed by a fixed 400 ms wait observed zero ponding cells rather than four. |
| Full course 002 | Failed after 44 checks | Outlet top was 15.515625 px, consistent with the maintained 16 px margin, rather than the obsolete zero expectation. |
| Full course 003 | Failed after 47 checks | Joint top was 16.46875 px and exposed the same obsolete zero expectation. |
| Full course 004 | **98 checks passed** | 47 completed reloads; no runtime exceptions; sandbox admitted. |

The lead inspected the actual outlet and joint 390 px captures. Both were readable and contained within the page; the image hashes are retained in the JSON receipt. An independent internal reviewer accepted the exact four executed files after the complete course passed.

## Scope and limits

Only four receiving files changed. Application code, CSS, numerical models, fixtures, shared browser helpers and the sandbox gate did not change. The prior 1,305/1,305 native-unit result applies to identical application and unit-test sources; this browser-only run does not claim a new native-unit execution.

This is source and browser qualification. It does not establish field accuracy or a deployed service. Full native logs and screenshots remain attached to the originating execution; this committed record omits host addresses, process identifiers and browser-control endpoints.
