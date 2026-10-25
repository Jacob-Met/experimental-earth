# Compare same-time ponding connections

The **Can a different connection avoid deeper ponding?** panel asks a depth-only
question between two declared cells in the existing and proposed site. Offer all
grid cells with `ALL`, or list a restricted footprint. The result finds the lowest
possible maximum modeled depth along any edge-adjacent connection within that
footprint, at every original solver snapshot. A second search supplies a shortest
connection among paths attaining the same depth objective.

## Use and inspect

1. Enter two different endpoint labels, such as `A2` and `D2`.
2. Explicitly offer `ALL` or a set of labels, such as `A2 B2 C2 D2`.
3. Compare connections and choose an original modeled time. Inspect the maximum
   depth and complete witness cell sequence for each scenario.
4. Open the full native-time course to compare both objectives under the same
   weather. A negative proposal-minus-existing difference is only a lower modeled
   depth bottleneck, not evidence that a real route improved.
5. Download the original project and question. Reopen the file to independently
   recompute an isolated copy. The working site is never replaced by this action.

For the maintained fictional courtyard at minute 15, the straight A2–D2 row has
maximum modeled depth 10.652361275077158 mm. The discovered existing connection
A2 A1 B1 C1 D1 D2 has maximum 8.148554630401236 mm. This is an authored computational
example: a failing manually chosen connection does not prove the endpoints lack
another connection. Restricting the footprint to only A2 and D2 makes them
geometrically disconnected even if both cells are dry.

## Mechanism and bounds

Each site's original dense, finite, nonnegative depth vector supplies node costs.
The value of a path is the largest node cost, including its two endpoints.
Dijkstra's label-setting algorithm uses the relaxation
`candidate = max(current bottleneck, neighbor depth)`, with a binary heap. Once
the destination's minimum bottleneck is established, breadth-first search over
cells at or below that exact threshold finds a shortest witness. Ascending cell
indices break remaining witness ties deterministically. The footprint's list
order cannot alter that tie rule. Witnesses contain no repeated cells.

A disconnected footprint has no numeric objective; it is not assigned zero or a
very large fabricated depth. All native times and both original scenarios are
validated before computation. The complete course's admission estimate is
`2 × native snapshots × grid cells × ceil(log2(grid cells + 1))`, at most
2,000,000. This is a bounded workload estimate, not a measured runtime guarantee.
Only original native snapshots are assessed; no continuous connectivity interval,
interpolated depth course or duration is reported. The best witness may change
between snapshots. Two independent per-time witnesses do not describe one moving
person's passage.

## Source and transfer behavior

The investigation schema is `experimental-earth-connection/1`, containing only
`project` and `question` inputs. The question retains the exact endpoints and
complete offered footprint. Derived paths are recomputed on reopening. The normal
4 MiB transfer ceiling applies. Invalid source, mismatched dimensions, malformed
footprints or excessive work refuse the whole comparison. Reading a file cannot
silently overwrite a later question edit or site change. Changing a question or
working site invalidates the displayed course; the full original site remains
available in an earlier download.

## Interpretation

This graph only tests grid adjacency and modeled depth. Internal walls and crests
affect the original water model but do **not** become movement barriers in this
connection search. Ground slope, doors, width, surfaces suitable for movement,
legal access and physical obstructions are not evaluated. The word connection
here does not assert a walkable path, accessibility, flood safety, a valid travel
time or authority to intervene. No probabilities or physical accuracy are inferred
from a numerical optimum. Use the separate declared-route panel for its existing
same-time threshold intervals; this study does not alter that consumer or the
separately owned moving-traversal work.

## Verification

`node tests/ponding-connectivity.test.mjs` includes independent enumeration of all
simple paths on every binary-depth 3×2 grid and every internal-cell footprint
(1,024 combinations), checking minimum maximum depth and shortest witness length.
It also checks endpoint costs, deterministic ties, direct original courtyard
snapshots, changed proposals, native-time path switching, source nonmutation,
disconnection, dense-array admission and complete work refusal.

`node tests/ponding-connectivity.browser.mjs` exercises the served consumer,
keyboard submission, original-time selection, actual downloadable input Blob,
fresh-module File reopening, restricted/disconnected footprints, invalid inputs,
source changes, pending-read race and desktop/narrow rendering. Browser receiving
requires the maintained sandbox-admitted Linux Chrome session; implementation of
a course is not a claim that a particular execution passed.
