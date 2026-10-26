# Rooted water between original rain events

The existing rooted-store investigation can now keep the same store through a
sequence of original event projects. In **What remains when the next rain
arrives?**, start from the complete rooted draft above, add current-event copies
or original site JSON files in chronological order, and declare the dry gap,
transpiration and initially-dry surface basis for each entry. Copies are labeled
hypothetical by default. The final dry schedule and both root declarations are
retained independently of later edits to the parent investigation.

The comparison uses every event's original paired surface maps and rain forcing.
The unchanged native rain solver supplies per-cell infiltration intervals. Their
recharge enters the same rooted inventory, using the maintained exact
piecewise-forced root propagator. Gap and final dry intervals continue from the
previous state. Inspection at an arbitrary elapsed time evaluates that propagator
rather than interpolating graph samples. Cumulative recharge, overflow drainage,
supplied transpiration, unmet demand and the remaining inventory close the rooted
water account. Existing and proposal remain separate, under the same chronology
and demands.

Each surface calculation independently starts dry. This is **not** a coupled
seasonal hydraulic simulation: surface ponding, wetting-front state and runoff do
not carry into the next surface event; root storage does not alter infiltration.
The original surface inventory remaining at each event end is shown explicitly
and is not counted as root recharge. The same site geometry, barriers, scale and
numerical assumptions must match across entries for both scenarios. No observation
is fitted, reclassified or silently turned into a measured root inventory.

## Original source and bounds

The `experimental-earth-rooted-event-course/1` file contains original event
projects, complete rooted declarations, event references, gap/event demand sources,
dry-surface association and final dry schedule only. Reopening validates and
recomputes the entire course; computed conclusions are refused as extra fields.
The active site is never replaced by opening this investigation. Event changes
retire the prior result. Pending file reads cannot supersede a newer edit/action.

A course admits1–12events, at most366elapsed days, the existing per-event trace
budget, and at most1,000,000paired retained cell-steps in aggregate. The complete
course is validated before the first native solver call. File export and import
share a16MiB UTF-8 limit. These are work bounds, not scientific uncertainty bounds.

## Verification and interpretation

`node tests/root-zone-course.test.mjs` checks the maintained single-event timing
consumer, native paired rain accounts, cumulative conservation, overflow,
source-only replay, source/chronology/work refusal and12unfamiliar courses against
an independent fine-step scalar differential-equation calculation. An intentional
reset of rooted inventory does not reproduce the carried-course result.

`evaluation/root-zone-course-original.mjs` uses the retained original USDA ER2
precipitation rows: DRY source lines2–11 (0–40minutes) and WET lines15–22
(0–14minutes), each reporting74mm/h and zero run-on. Extending these discrete
values uniformly between the chosen endpoints is an explicit modeled assumption.
The hypothetical garden, rooted properties, transpiration and one-day spacing do
not reconstruct the original experimental site or establish actual event spacing.
Within the same7.0375day horizon and21.6mm modeled root recharge, spacing these
source-conditioned events supplies19.995316mm versus17.028747mm for adjacent
events; modeled overflow changes from3.481323mm to zero. Original row tokens and
source SHA256 are retained by that executable receipt. These figures demonstrate
the consequence mechanism, not field-validated seasonal response.

The actual maintained-browser course is
`CHROME_BIN=/path/to/real/chrome node tests/root-zone-course.browser.mjs`.
It requires the existing sandboxed Linux browser owner and checks original file
intake, source edits and changed consequences, source-only download/fresh reopen,
current-draft and original-event acquisition, desktop/narrow display and refusal
of forged conclusions. Browser receiving is recorded separately from native tests.
