# Preserve the target of an unfinished observation

Issue: [#398](https://github.com/Jacob-Met/experimental-earth/issues/398). Current main base: `c5ea614862391e447abf930720f0f68b147562eb`. Qualified GitHub test merge for [PR407](https://github.com/Jacob-Met/experimental-earth/pull/407): `c1677cd6319cde2e594cd061c4d8edc973da47b6`, tree `a279e209140df271e85ac6df69757df45d07946d`. Execution owner: `coord4`, through the retained root team's Renpō route.

## Defect and change

An unfinished A1 depth/source survived ordinary grid selection, while submission used the newly selected cell. The exact negative control stored an authored A1 source and 12.5 mm depth as B1 (`cellIndex: 1`), at minute 30, uncertainty 0.2 mm, existing/calibration. That incorrectly attributed reading was then available to the notebook and inference.

The controller clears **unsaved depth and source** when the selected cell or active project object changes, and when Suggest changes the target cell or minute. A persistent live status explains the retirement. Ordinary same-cell grid inspection, arrow-key focus without selection, and deliberate form edits preserve the draft. Accepted observations are unchanged. Existing observation-map preparation retains its prior explicit clearing behavior; project replacement conservatively clears a draft even at the same cell.

PR401's water-budget callback and stylesheet are preserved. Upstream [PR406](https://github.com/Jacob-Met/experimental-earth/pull/406) adds map-time inspection: its view/range/Previous/Next controls preserve the same project, selected cell and observation-form time, so unfinished readings remain intact. Actual grid selection still reaches the draft-retirement guard. These complementary behaviors were received together, including the upstream map-time course. #398 changes no scientific model or observation schema.

## Exact qualified source

| File | SHA256 |
| --- | --- |
| `app.js` | `25cca2e7f923bf3377bdd47aab486a5caa0da36c487b9d811e0c875c8526d6f3` |
| `index.html` | `c5afd93919ff4b40e1e1e9d8ead4dc9da39e2c8f7a287936991b9ff9bbf44dd9` |
| `tests/observation-draft.browser.mjs` | `27404089885a656e8281241885f9182c8ac39382785b68dbb693897caffefe7f` |

The exact composed tree was received with 1,242 present Git blobs and zero mismatches; 129 historical documentation assets were omitted from the execution copy. Runtime assets were checked through the documented server. The local receiving Git metadata is distinct from the upstream/test-merge identities. The earlier PR404 browser fixes and PR406 map-time implementation are preserved.

## Current qualification

- **Full maintained browser course: 105/105 passed** on the exact composed test merge, including PR406's map-time receiving.
- **Focused observation course: 8/8 passed** on the same composition. Both browser sessions admitted the sandbox and reported no runtime exceptions.
- **Fresh native: 1,305/1,305 passed. Fresh maintained launch: 322 exact served JS/CSS/index assets**, including the new map-snapshot stylesheet, through documented `npm run serve`.
- **Actual consumer:** native keyboard selection retires an A1 draft before it can become B1 evidence. Fresh explicit B1 evidence reaches the displayed B1 calibration residuals. The authored reading returns `calibration-rejected`, a valid negative result rather than a claim of model or field validation.
- **Portable evidence:** ordinary Export completes a real 11,562-byte disk download. The exact disk bytes reopen after clearing browser storage and reloading the runtime, preserving B1 value, source and role. Download SHA256: `227c95744002c54f7d94a5ecdd88420cf59041783bf121b7f11dc37bef371117`.
- **Actual pixels and viewport receiving:** the current 390 × 844 screenshot was inspected; selected cell, cleared depth/source and the complete retirement message are visible. The course requires four unobscured rectangles stable across 80 ms-separated observations before capture. Current recorded status bounds are y391.953125–451.34375; document width remains 390. A late out-of-view scroll is corrected before qualification. Current PNG SHA256: `b825f6b22d65122f6cf36a44eeaaa686b4f372a6bab1f90de8eb4dc7ab85361f`. Older screenshot hashes are not substituted for it.

Current receipts: [qualification manifest](qualification.json), [full browser](maintained-browser-receipt.json), [focused browser](browser-receipt.json), [native test tail](native-test-tail.txt), and [current screenshot](observation-draft-mobile.png). Original remote receipt bytes are retained.

The current operation is `e225224-earth407-composed-receive-01` on `coord4`, terminal exit 0. Its fresh native/served-asset checks, full 105-check browser result and focused 8-check result qualify the composed tree; both browser sessions admitted the sandbox and reported empty runtime-exception lists.

## Preserved negative and failed controls

The preceding `fe22a7752cfb4049097aac05a375db1d141ccd68` phase passed 98 full-browser and eight focused checks under `e225224-earth-current-receiving-01`. At that phase, 1,305 native checks and 321 served assets were correctly carried from unchanged production/native-test source. The current composition reran those checks freshly and received the added map-time feature. Earlier phase records remain historical evidence.

The [negative control](baseline-defect.json) used unchanged main `2447048f9022bdbeddbc6e9d60cc3b70538eeca6` with the same pinned receiver and `EARTH_DRAFT_BASELINE=1`. It returned semantic result `BASELINE_DEFECT_CONFIRMED`, with sandbox admission and no runtime exceptions. Exit 0 means successful defect detection, not correct product behavior. Unchanged application pins were:

- `app.js`: `b97a769f4f1bd3da5e4f4cc96e3c9e2e8d827a04bca9631a180c7007ec58dc34`.
- `index.html`: `97068615c028f2fbca7f7791a903874e91a49e8cddaffa26fe7998086b0af50f`.

The earlier [candidate](maintained-browser-failure.log) and [unchanged-main](unchanged-main-browser-failure.log) full courses both failed after 32 checks at the resolution focus assertion. The diagnostic in [#403](https://github.com/Jacob-Met/experimental-earth/issues/403) established that starting focus succeeded, then native Tab correctly reached the legitimate “Plan complementary depth readings” summary. The immediate-adjacency expectation was obsolete; no keyboard-product defect was established.

The existing owner resolved that receiving work in [#402](https://github.com/Jacob-Met/experimental-earth/issues/402) / [PR404](https://github.com/Jacob-Met/experimental-earth/pull/404). Its current navigation, reload and scroll-margin corrections were consumed rather than duplicated. #403 is closed as a duplicate with the actual diagnostic and upstream ownership credit retained. The historical failures remain evidence; they are neither relabeled as passes nor left as the current gate status.

Historical execution identities on `coord4`:

- `e225224-earth-release-verify-01`: native/served-asset qualification and the original maintained-browser failure.
- `e225224-earth-browser-reconcile-01`: unchanged-main comparison failure and earlier focused receiving.
- `e225224-earth-current-draft-negative-01`: exact unchanged-production defect control.

The obsolete, unreferenced `2447048` tree-object attempt remains separately quarantined with an unknown outcome. No old commit or ref update was submitted. Current publication uses the new base and payload through the original LA7 owner; it is not presented as recovery of that old operation.

## Maintainer reproduction

Use the complete current tree, Node 22 (recorded version `22.23.4`), Python 3, and native Chrome with its sandbox enabled. The recorded browser was Chrome `156.0.8078.47` at `/opt/google/chrome/chrome`. The maintained harness creates an isolated profile/run directory and admits namespace, PID/network namespace and seccomp isolation.

```sh
npm test
CHROME_BIN=/opt/google/chrome/chrome npm run browser-receive
CHROME_BIN=/opt/google/chrome/chrome node tests/observation-draft.browser.mjs
```

The documented manual launch remains `npm run serve`. The automated courses manage their own server/browser lifetime. The focused course refuses a pre-existing expected download, so an old file cannot satisfy it. To repeat the negative control, place the same receiver in an otherwise unchanged `2447048` checkout and set `EARTH_DRAFT_BASELINE=1`; do not run defect-expecting mode against the corrected application.
