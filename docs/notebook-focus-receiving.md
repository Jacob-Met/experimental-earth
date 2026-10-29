# Notebook keyboard continuity receiving

Changing a retained reading's scenario or evidence role previously saved the correct value but replaced its focused select with a new DOM node, leaving keyboard focus on BODY. The change keeps focus on the same reading and control; removing a reading moves to its next visual neighbour, or the depth entry when none remain. Reading identity is retained only in memory, without adding saved-source fields.

Root executed the maintained application in sandboxed Chromium 156 on Linux. Independent retained review examined the source change, receiver, receipts and actual screenshots. The current candidate passed all 1,792 native tests in 254 files, and nine browser courses covering native Arrow/Tab continuation, scenario reset and disabled use, genuine Enter removal and boundaries, real worker pending/completion, newer title focus and selection, replacement source and stale replies, failure/Retry, pending removal, and explicit restore. Original project content remained exact except for intentional edits; failure preserved the accepted save. No browser exceptions were recorded.

The first Retry course exposed focus dropping when its focused button became hidden. Guarded transfer to the pending status before hiding that button corrected the failure; the repeated course passed without forcing focus in the fixture. Initial screenshots captured earlier panels because smooth scrolling had not completed during setup. The corrected receiver establishes the visible control with instant setup before native input, then checks visibility and centre-point hit testing without scrolling after the edit.

Actual 1440px and 390px screenshots show a distinct orange focus ring around the edited evidence-role select, readable labels and reading context, and an unobscured active control. Before/after control bounds are identical in each tested viewport; pending completion also returns to a visible scenario select. At 390px the bottom floating navigation and toast overlap some lower-page content, but not the focused row or control in this course; this is not a claim that all page content or all scroll positions are unobscured.

Evidence: native command `estate-1d713-focus-native-suite-001`; browser visibility command `estate-1d713-focus-visibility-browser-004`; `notebook-focus-desktop.png` and `notebook-focus-narrow.png`. These checks qualify the current source candidate, not a merged commit, downloaded package or release. Other browsers, assistive technologies and touch interactions have not been newly qualified.


Run the focused course with Node 22+ and a sandbox-capable Chromium:

```sh
BROWSER_RUN_DIRECTORY=/absolute/new/evidence-directory \
CHROME_BIN=/absolute/path/to/chrome \
node tests/notebook-focus.browser.mjs
```

For an extracted distribution served by its maintained `serve.py`, set `APP_ROOT` to the extraction directory and `APP_URL` to the exact loopback origin. The receiver navigates to that origin and performs the same native input and worker course. The fixture controls delivery and injected failure of real worker computations; it does not substitute calculated results.
