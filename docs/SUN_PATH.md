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

## Verification

- `node tests/solar-path.test.mjs`: external ephemeris residuals, geographic/grid
  angles, exact maintained-kernel equivalence, changed date/location/orientation,
  low/polar sun, uncertainty/witness retention, strict UTC/calendar admission,
  endpoint coverage, source invalidation, no mutation, bounded work and time-zone
  independence.
- `npm test`: maintained product regression suite.
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
