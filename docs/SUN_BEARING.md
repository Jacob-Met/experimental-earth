# Inspect a complete true-north bearing range

After comparing a dated solar course, open **Does the conclusion depend on the
declared true-north bearing?** Choose the accepted current course, an ordinary
reopened course, or the original source retained by an opened bearing
investigation. Select one original ground centre and one original sampled UTC
instant. Declare a bearing half width from 0 through 180 degrees and the source
or assumption behind it.

The calculation varies the grid's true-north bearing only. The original site,
geographic location, sampled time, solar elevation and declared column-height
bounds stay fixed. A range crossing north remains on one unwrapped degree axis;
for example, 350 ± 20 degrees is shown as 330 through 370. A zero-width range is
one direction. The result is conditional on the entered geometry and range,
not a survey of orientation accuracy or a measurement of actual sunlight.

## Whole-range conclusions and checked directions

Each scenario has two angular bands. The inner band is a sufficient blocked
region; the outer band encloses possible mapped obstruction. The calculation
can establish **blocked throughout** when the union of the inner bands covers
the complete declared range, or **no mapped blocker throughout** when the outer
union does not intersect it. Otherwise the whole-range conclusion is not
established. Positive gaps are never closed merely because they are small.

Footprint, below-horizon and low-elevation cases retain their own categories.
Existing and proposed scenarios remain separate. An additional- or
removed-obstruction conclusion throughout the range requires the corresponding
sufficient conclusions in both scenarios. No mapped blocker does not establish
actual direct sun: unmapped obstructions and the underlying physical-model
limitations remain.

A separate table retains at most seven directions evaluated by the maintained
`compareSolarOcclusion` kernel: the nominal bearing, the two endpoints, and up
to two useful directions per scenario. It retains original column witnesses and
source words. Different checked directions can demonstrate bearing sensitivity.
Agreement among these directions alone does not establish the whole range.
If an independently checked direction contradicts a sufficient envelope result,
that result is demoted to numerically unresolved.

## Geometry and numerical qualification

For a positive solar elevation, each other opaque grid column has a finite
horizontal reach determined by its top height above the selected ground centre.
The implementation intersects that horizontal disk with the column rectangle
and derives its complete angular span from corners and circle-edge events.
It uses the scenario's own terrain origin, maximum height for the outer
envelope and minimum height for the inner envelope. Multiple distinct columns
can jointly cover a range even when none covers it alone.

The outer rectangle expands by twice the maintained spatial epsilon. The inner
rectangle contracts by three times that epsilon, retaining room for the
kernel's eroded-slab and positive-chord tests. The maintained lower face is
below every selected upward ray under these admitted site bounds. Near-circle
intersections use a factored radicand. Numerically ambiguous tangent or edge
events fall back to the full rectangle's outer span and no inner span instead
of claiming a narrow empty intersection. Outer angular endpoints expand and
inner endpoints contract by a 1e-7-degree fringe before range clipping.

These are engineering-screened floating-point envelopes. They are not certified
interval arithmetic, a physical sunlight proof, a calibrated orientation
distribution or an accuracy guarantee. The original point-sampling, height,
terrain, solar-position and opaque-column limitations still apply. This view
does not establish shaded area, irradiance, comfort, continuous exposure time
or an annual total.

The complete calculation is admitted before work begins. The witness bound is
seven full-site kernel evaluations, counted conservatively as six slab checks
for every ordered cell pair per evaluation. The existing 16-million-check
budget applies to that complete bound; no partial site or selected subset is
reported as a whole investigation.

## Preserve and reopen the original inputs

**Save bearing investigation** downloads
`experimental-earth-sun-bearing.json`. The input-only envelope has exactly
`kind`, `model`, `project`, `declaration` and `settings`. Settings retain the
original cell and sample indices, half width and basis. The geographic/UTC
declaration retains the original eight accepted fields. Model identity and
original obstruction context are checked on admission.

Reopening recomputes the selected solar position, complete angular geometry and
kernel witnesses from the original source. It does not calculate or replace an
unrelated complete time course. Cached results, geometry and verdict fields
are refused. The outer file limit is 5 MiB; the maintained portable project
limit remains 4 MiB. This is reproducibility from declared inputs, not source
authentication or a promise that future kernel revisions produce identical
numerical results.

An opened investigation can be explored beside a different active project.
Current, ordinary retained and opened-investigation sources remain distinct.
Draft changes disable saving and cancel queued calculations while clearly
retaining the last accepted result. Failed imports preserve accepted work;
newer inputs, source changes or closing the inspection supersede delayed reads.

## Executed control and receiving

The authored four-by-two flat site uses two-metre cells and a four-metre C1
column. At the equator on 20 March 2026 at 09:00 UTC, the maintained solar model
places the sun at approximately 90.12655 degrees azimuth and 43.14195 degrees
elevation. At A1, a nominal grid bearing 30 degrees below that azimuth has no
mapped blocker, while the declared ±35-degree range contains a maintained-kernel
blocked witness from C1. This is an authored software control, not a measured
site or evidence of a physical environmental outcome.

Run `node tests/solar-bearing.test.mjs` for geometry, complete-range controls,
multiple-column coverage, north wrap, zero/full ranges, height/footprint/night
cases, source and work admission, and input-only replay. The randomized
direction comparisons are regression oracles against the maintained kernel;
the range mechanism itself does not infer complete coverage from sampled
headings.

The actual consumer receiver runs through the maintained browser sandbox check:

```sh
CHROME_BIN=/opt/google/chrome/chrome SUN_BEARING_RECEIPT_DIR=/tmp/sun-bearing \
node tests/solar-bearing.browser.mjs
```

It exercises trusted keyboard activation, actual download/native reopen,
original-source custody beside a different project, source choices, selection,
invalid input, pending-work and delayed-read cancellation, and a 390-pixel view
with expanded source details. Native tests and authored browser code are
separate from an executed browser receiving result.
