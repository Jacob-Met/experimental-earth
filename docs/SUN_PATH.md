# Dated sun paths on the retained site

The sun-path panel connects a geographic place and explicit UTC instants to the
existing/proposed opaque-column obstruction comparison. It reuses the maintained
ground-centre ray calculation. It does not replace the saved single-direction
study or change the rain model.

## Use the comparison

1. Retain the site's columns and their height/source declarations in the existing
   direct-sun panel. A saved single-direction study establishes the geometry's
   source context; the path derives its own directions without overwriting it.
2. Enter latitude (north positive), longitude (east positive), and the source or
   explicit assumption behind that location. Exact geographic poles are refused
   because a true-north grid bearing is undefined there.
3. Declare the true-north bearing of **increasing grid columns**, clockwise from
   north, and its source. An east-right/south-down grid uses 90 degrees. Increasing
   rows must be 90 degrees clockwise from increasing columns. Mirrored grids and
   magnetic-to-true-north corrections are not inferred.
4. Enter existing UTC instants with seconds and `Z`, for example
   `2026-06-21T08:00:00Z`. A local day's endpoints may cross UTC midnight. The
   browser's time zone never interprets these timestamps. Choose a sampling step
   from 1 to 240 whole minutes; the maximum period is 48 hours.
5. Compare, then choose a ground cell. The two-row plot and complete table retain
   each sampled instant, calculated angles, paired classifications and obstruction
   witnesses. Keyboard selection works with the cell selector.

The calculation includes both endpoints. An unaligned final interval is shorter
than the chosen spacing. A maximum of 193 samples and a conservative 16-million
slab-check budget bound the complete calculation; exceeding either refuses the
whole course rather than silently truncating it. Larger grids can require a
coarser sample interval or shorter period.

## What each result establishes

`blocked`, `height-dependent`, `grazing`, `footprint` and `no-mapped-blocker` are
the existing solar model's classifications, with its original height semantics
and witnesses. At apparent solar elevations below 1 degree, that obstruction
model is not evaluated. A calculated centre at/below zero is separately labeled
below-horizon; a positive elevation below 1 degree is labeled low-elevation.
These are sampled centre directions, not whole-solar-disk visibility or exact
sunrise/sunset events.

Each dot is one calculation. There is no interpolation between dots, no inferred
continuous shade interval, and no conversion of sample counts into hours. A
short blockage can be missed between samples. Location, clock, orientation,
terrain-survey and solar-position errors are not propagated; the column-height
intervals keep their existing meaning. No mapped blocker still leaves off-map
structures, foliage, clouds and omitted objects unknown. There is no irradiance,
temperature, comfort or engineering-approval claim.

## Calculation and source

The offline dependency is [SunCalc 2.1.1 at
21449f3](https://github.com/mourner/suncalc/tree/21449f34820c3c80a27a78cdc940747ff19ca1e3),
kept unmodified with its BSD 2-Clause license in `vendor/suncalc/`. Its `getPosition`
returns degrees, north-clockwise azimuth and apparent altitude including the
upstream standard-refraction approximation. This is the version-2 convention;
version 1 used different units and azimuth origin. Grid heading is the wrapped
difference between that geographic azimuth and the declared column bearing.

The native reference gate evaluates every one of 728 Sun positions retained in
upstream's independent JPL Horizons fixture, across 14 locations and 13 dates.
The fixture's provenance and exact upstream blob are in `vendor/suncalc/README.md`.
This is reuse of upstream-retained ephemeris evidence, not a fresh JPL query or
local field validation. The consumer restricts dates to 1900–2100; this is an
admission range, not an accuracy guarantee for every admitted date/location.

## State and privacy

Coordinates and orientation drafts stay in page memory; they are neither sent to
a remote service nor stored in the ordinary project. A reload clears them. The
saved obstruction declaration remains in the ordinary portable project. No
automatic geolocation, location lookup or runtime CDN is used.

Changing a draft invalidates the derived result. A changed terrain/source or
column declaration also clears it, including a queued calculation. An obsolete
geometry context is refused rather than reassigning old columns to new terrain.
Unrelated rainfall-only changes do not alter the solar comparison.

## Save and reopen an investigation

After a successful comparison, **Save investigation with location and site**
downloads `experimental-earth-sun-path.json`. This is a separate input-only file,
not the ordinary project export. It includes the original complete project,
geographic coordinates and source words, true-north grid bearing, UTC endpoints,
sampling step, selected ground cell and exact SunCalc identity. Share it only
when you intend to include that location and site information. Saving uses the
source captured for the displayed comparison; an unrelated later rain edit does
not quietly replace that original project in the file.

Open **Reopen a retained sun-path investigation** and choose the file. The app
validates the full original project through the maintained project-portability
contract, checks the saved obstruction context, and runs `compareSunPath` again.
Its separate selector and result table use the retained grid, even when the
active project has different dimensions or is subsequently replaced. No saved
verdict is accepted and no retained location, columns or scenario is adopted
into the active project. Closing this view or reloading clears the inspection;
the downloaded file remains available to reopen.

Files use `experimental-earth/sun-path-inputs/1`, accept at most 5 MiB of UTF-8
JSON, and preserve the ordinary 4 MiB project admission limit. The envelope has
exactly `kind`, `model`, `project`, `declaration` and `selectedCellIndex` fields.
The declaration contains the eight geographic/source/time inputs accepted by
the panel; sample counts and all results are derived again. Unknown envelope or
declaration fields, a different sun-position model, an out-of-grid selection,
invalid UTC inputs, stale column context and excess calculation work are refused.
A failed file leaves the previously accepted independent inspection visible.
A later import or closing the view prevents a delayed older file read from
publishing over it.

This is reproducibility from declared inputs, not an authenticity certificate.
A person can edit valid inputs and receive the corresponding new comparison.
The SunCalc version/commit is pinned and checked; obstruction is recalculated
with this application's maintained kernel, so the file does not promise an
unchanging result across future revisions of that kernel. The versioned format
is an admission contract, not a hash of all application source. Height, point
sampling and physical-model limitations remain unchanged.

## Verification

- `node tests/solar-path.test.mjs`: external ephemeris residuals, geographic/grid
  angles, exact maintained-kernel equivalence, changed date/location/orientation,
  low/polar sun, uncertainty/witness retention, strict UTC/calendar admission,
  endpoint coverage, source invalidation, no mutation, bounded work and time-zone
  independence.
- `npm test`: maintained product regression suite.
- `node tests/solar-path-receipt.test.mjs`: input-only roundtrip, independently
  recomputed changing outcomes, changed-source refusal, model/envelope admission,
  retained-grid selection, UTF-8 byte limits, literal sources and immutability.
- `CHROME_BIN=/opt/google/chrome/chrome node tests/solar-path-receipt.browser.mjs`:
  the original dated-path course followed by actual download, fresh-page native
  file reopen beside a different active project, keyboard inspection, malformed
  files, delayed import supersession/close, source independence and actual 390px
  layout. Set `SUN_PATH_INVESTIGATION_RECEIPT_DIR` to retain its captures and
  exact loaded-source hashes in a chosen directory.
- `CHROME_BIN=/opt/google/chrome/chrome node tests/solar-path.browser.mjs`:
  actual authored-source import, paired timeline, changed inputs, literal source
  text, stale queued work, source mismatch, reload, keyboard inspection, no
  external runtime requests and an **actual 390 CSS-pixel viewport**. The
  maintained browser owner verifies the launched Linux Chromium sandbox.
- `CHROME_BIN=/opt/google/chrome/chrome node tests/solar.browser.mjs`: existing
  single-direction consumer regression.

The stronger viewport check exposed an inherited long-source overflow in the
existing column list. The accompanying narrow CSS rule wraps those words and
lets that panel shrink, preserving the original strings and all geometry logic.

## Inspect additional discrete times

After comparing a dated course, use **Inspect additional discrete times** to
compare a finer whole-minute divisor. A separate control in the reopened
investigation uses that file's original site and declaration, even when the
active project is different. Both controls retain the coarse course and offer
the complete finer course under a disclosure. Changing the selected ground
cell updates its comparison without changing either source.

The finer interval must be smaller than the original interval and divide it
evenly. A one-minute original interval has no supported refinement. The full
finer grid uses the same limit of 193 samples and 16 million conservative slab checks;
work beyond either limit refuses before exposing a partial comparison. Shared
times have exactly the maintained coarse calculation. An unaligned final
endpoint remains included in both grids.

The comparison lists inserted times whose scenario classification differs from
both original interval endpoints, with the original obstruction witnesses.
Distinct timestamps and per-scenario observations have separate counts: one
timestamp can contribute a new classification in both existing and proposal.
Neither count measures duration, convergence or the absence of further changes
between the finer samples. A classification can also change its witness without
changing its status; this summary is about status changes, while the full finer
course retains all witnesses.

The authored 8-by-2 flat-site control has a distant 10 m opaque column. Hourly
samples at 06:00, 07:00 and 08:00 UTC report no mapped blocker at A1; the finer grid
finds 47 blocked samples from 06:07 through 06:53. This does not establish 47 minutes
of continuous shade. The geometry, solar-position approximation and all source
uncertainties remain the same in both grids.

Declaration, source, fine-input, new retained import and close changes cancel
queued comparisons. A refused finer course leaves the accepted original course
intact. The ordinary saved investigation retains its original coarse declaration;
reopen it and explicitly compare a finer interval again. No cached derived
classification or finer choice is silently adopted into the original inputs.

Run `node tests/solar-path-sampling.test.mjs` for the six native groups.
The following receives the actual current and retained controls, original source
custody, saved-file reopen, invalidations, keyboard activation and 390px rendering
through the maintained sandbox verifier:

```sh
CHROME_BIN=/opt/google/chrome/chrome SUN_SAMPLING_RECEIPT_DIR=/tmp/sun-sampling node tests/solar-path-sampling.browser.mjs
```

## Inspect changes across the site

The original-course spatial map shows every retained ground centre, with
separate additional, removed and limited sample counts or the paired categories
at one original UTC instant. Selecting a centre preserves the original scenario
detail and witnesses. Reopened investigations have their own independent map.
See [spatial inspection](SUN_PATH_SPATIAL.md) for controls, category semantics,
limits and the authored site control.

## Compare explicitly selected dates

The [selected-date investigation](SUN_PATH_DATES.md) keeps the original site,
location, orientation, UTC starting clock and elapsed period while comparing
one to seven additional calendar dates. It retains the original course, complete
per-date categories, selected-date spatial witnesses and a separate input-only
save/reopen path. The selected dates do not establish an annual total or a
continuous seasonal interval.

## Inspect the declared true-north bearing range

The [bearing-range investigation](SUN_BEARING.md) keeps the original site and one
selected sampled UTC instant while varying only grid bearing across an explicit
range. Complete angular envelopes distinguish sufficient obstruction throughout,
no mapped blocker throughout and unresolved conclusions. Separate maintained-
kernel witnesses can expose orientation sensitivity. The investigation has its
own input-only save/reopen path and does not turn sampled times into a continuous
duration or establish physical sunlight.
