# What original notebook bands establish

The **What do the notebook bands establish?** panel asks an evidence-only
connection question for two endpoints within an explicitly offered grid-cell
footprint. It uses only original notebook readings for the exact selected scenario
and minute. Simulated depths, infiltration hypotheses, clock corrections and
interpolated readings never fill an unmeasured cell.

## Use the notebook and inspect its sources

Enter readings through the maintained notebook or import a sourced project. In
the new panel choose the observed scenario, exact minute, positive depth threshold,
two different endpoints and offered cells (`ALL` explicitly offers every cell).
Then inspect the original notebook bands.

The result distinguishes six outcomes:

| Outcome | Conditional meaning |
| --- | --- |
| Band-supported | A displayed path has a common upper bound at or below the threshold in every cell. |
| Unresolved | A merely possible path exists, but some cells are unmeasured or their bands span the threshold. |
| Band-excluded | A displayed boundary of above-threshold cells separates the endpoints. Every offered connection must meet at least one of those cells. |
| Conflicting bands | Repeated bands have a gap larger than the maintained numerical guard. No whole-footprint conclusion is drawn. |
| Numerical contact | Repeated bands have a small positive gap within the guard. No overlap is invented and no whole-footprint conclusion is drawn. |
| Disconnected footprint | The offered cells cannot connect the endpoints even if all were dry. This is distinguished from an exclusion based on readings. |

Open the source ledger to inspect **every offered cell**, original reading index,
value, tolerance, scenario, exact minute, source and role. Calibration, challenge
and notebook-only roles remain unchanged and visible. This consumer does not fit
anything or compute training/held-out scores. Readings with a different scenario,
minute or footprint cell are excluded from this exact question; the count is
reported and their original records remain in the project.

Download the original notebook and question to reopen an isolated copy in a fresh
session. Reopening recomputes the conclusion and leaves the working site alone.
Changing the working notebook, site or query clears the previous result. A pending
file read cannot overwrite a later question edit or site change.

## Conditional logic and retained ambiguity

For one reading, the lower depth is `max(0, depth − tolerance)` and the upper depth
is `depth + tolerance`. Repeated readings at the exact same scenario, cell and
minute reuse the maintained `observationConsistency` common-band and numerical
contact diagnostic. Nothing selects a preferred source or removes a disagreeing
row. A contradictory or numerically unresolved repeated band anywhere in the
offered footprint withholds the whole-footprint classification.

A cell with no matching reading stays unmeasured. Among consistent bands:

- A common upper bound at or below the chosen threshold supports a low cell.
- A common lower bound strictly above it supports a high cell.
- All other bands straddle the decision and remain unresolved.

The existing connectivity graph searches the low-only graph first. A witness there
is supported for every completion of the remaining unknown depths that respects
the supplied bands. A second graph permits unmeasured and straddling cells. A
path there is merely possible, not established by the readings. If even that
graph cannot connect the endpoints, its entire reachable source component has a
boundary consisting only of high cells; that boundary is returned with its sources.
A high source endpoint itself is a valid one-cell separating witness.

The returned boundary is deterministic but is **not** claimed to be a smallest
cut, unique explanation or best measurement plan. A possible path is a shortest
grid path under this graph's tie rule, not a ranking of acquisitions or the fewest
missing observations. The source component and its boundary use the same
edge-neighbor relation as the maintained model-only connection consumer.

The band logic considers values inside their declared bounds without a probability
model. It does not assume statistical independence, infer correlations, establish
correctness of those bounds or authenticate that the readings came from the same
place/event. Correlations not supplied by this interface may make an unresolved
case more constrained than this analysis represents. As with the notebook itself,
using an exact scenario/cell/minute assumes common event and location; different
actual events or sub-cell variation can explain disagreements.

## Authored distinguishing control

On a declared 3×3 footprint between A2 and C2, five low readings along
A2 A1 B1 C1 C2 support a connection. Removing the B1 reading makes the question
unresolved; the absence is never replaced with a modeled depth. High readings at
B1, B2 and B3 instead form a separating boundary even while other cells remain
unmeasured. Disjoint repeats yield a source disagreement. These are authored
computational controls, not acquired field readings.

## Limits and transfer contract

Grid adjacency does not establish a walkable route, slope, wall opening, suitable
width, legal access, timed traversal or physical safety. No intervention is
performed or authorized. Supported inputs inherit the project's 2–24 cell grid
dimensions and at most 100 original readings; thresholds are positive and at most
1,000 mm. The consumer performs no hydraulic solves.

Transfers use `experimental-earth-observed-connection/1` with only the original
`project` and normalized `query`. They share the 4 MiB input/output ceiling. Saved
derived reports have no authority; reopening always recomputes from original
inputs. All prior source fields and rejected/unused notebook rows remain intact.

## Verification

`node tests/observed-connectivity.test.mjs` compares all 729 low/high/unknown
3×2 ledgers against 4,096 independently enumerated completions, including each
returned cut and path witness. It checks source indices/roles, exact-time/scenario
isolation, conflicts and numerical contact, equality/straddling bands, disconnected
footprints, raw-input replay and independence from changed model assumptions.
The predecessor's nine native groups continue to test the shared graph.

`node tests/observed-connectivity.browser.mjs` exercises original project import,
keyboard comparison, a real maintained notebook-form entry, source download and
fresh file reopen, literal attribution, visible desktop/narrow outputs,
missing-bridge/cut/conflict/contact results and stale/pending-read behavior. A
successful software course does not establish physical measurement validity.

## Inspect the threshold range

The result also recomputes the smallest connection threshold possible under the
original bands and, when finite, the smallest threshold supported for every
completion of those bands. The lower endpoint uses every measured common lower
bound and zero for unmeasured cells. The upper endpoint is the minimax connection
across measured common upper bounds; if every offered path needs an unmeasured
cell, no finite upper endpoint is reported. Unknown upper depths are never
replaced by the notebook's numeric input ceiling. Supplied upper bands above
1,000 mm remain visible.

Both endpoints are attained by the corresponding all-lower/all-upper assignments
when finite, because a connection's minimax depth is monotone in every cell.
The lower and upper witnesses can be different paths. Below the possible endpoint
the bands exclude a connection; at or above a finite supported endpoint they
support one; intermediate thresholds remain unresolved. These are tight bounds
under only the supplied marginal bands, not probabilities, physical access or
measurement verification. Unrepresented correlations can narrow the possibilities.
Repeated-band conflict, numerical contact and disconnected footprints withhold
this range. Saved investigations retain only original inputs and recompute the
endpoints on reopening.

Run `node --test tests/observed-connection-range.test.mjs tests/observed-connectivity.test.mjs`.
Independent simple-path enumeration checks all 729 small-grid band ledgers and
their agreement with the maintained threshold classification, including equality.
A separate control enumerates all 64 endpoint completions of six finite bands.
Further controls include unknown upper bounds, original bands exceeding 1,000 mm,
endpoints, detours, conflicts, event isolation and raw replay.
The maintained `tests/observed-connectivity.browser.mjs` course checks visible
endpoints, no finite upper-bound results, source-only reopening and retirement
after source edits. Actual browser qualification must be executed before reporting
success; authored controls remain distinct from field acquisition.

