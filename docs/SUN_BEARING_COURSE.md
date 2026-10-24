# One bearing across the complete original solar course

After comparing or reopening a dated solar course, open **How many original
samples can be blocked under one common bearing?** Select one original ground
centre, declare a bearing half width from 0 through 180 degrees, and state the
source or assumption behind that range. The calculation retains every original
UTC timestamp and applies the same bearing to the entire course.

This answers a different question from inspecting each timestamp independently.
Each instant can have a possibly blocked direction even though no single
direction can block all of them. The common-bearing profile preserves that
relationship across time. The original geographic location, terrain, columns,
height bounds and timestamp declaration remain fixed.

## Reading the count enclosures

The summary shows four separate count enclosures: existing obstruction,
proposed obstruction, additional obstruction and removed obstruction. Each is
the smallest sufficient count and largest possible count across the complete
declared bearing range. They enclose the classifications supported by the
underlying numerical envelopes; the endpoints need not be attained. Extrema
for different categories need not occur at the same bearing.

At a particular bearing, a scenario's lower count sums timestamps inside its
sufficient blocked bands; its upper count sums timestamps inside its possible
obstruction bands. Additional obstruction requires a proposed blocked sample
and an existing sample without a mapped blocker. Its lower count uses proposed
inner membership and absence from the existing outer band; its upper count
uses proposed outer membership and absence from the existing inner band.
Removed obstruction uses the symmetric conditions. Both scenarios must be
eligible at that original timestamp for either paired count.

The original denominator remains visible. Below-horizon, low-elevation and
footprint observations retain their own categories instead of becoming clear
ground observations. An eligible numerical-unknown observation contributes a
conservative zero-to-one count throughout the domain. Separate modeled and
numerical-unknown tallies make that limitation inspectable.

Counts are original sampled instants. They are not minutes of shade, shaded
area, irradiance, probability or annual exposure. An original final timestamp
that is closer than the declared interval remains one original observation;
there is no duration weighting. Height bounds remain envelopes, not one newly
identified physical column height. Requiring a single common realization of
all heights could tighten these bounds further. No mapped blocker does not
establish actual sunlight.

## Complete angular arrangement

For every original timestamp, the mechanism reuses the maintained
[single-instant bearing analysis](SUN_BEARING.md), including its original
solar position, scenario geometry, numerical qualifications and independent
kernel witnesses. No list of sampled headings substitutes for a complete
angular profile.

The pure sweep retains every exact supplied interval endpoint. At an endpoint
it groups all starts before evaluating the closed point, then groups all ends
before evaluating the following open interval. Reference counts handle
overlapping bands. It checks that every inner band is contained in the outer
band on every resulting atom. A positive gap is preserved even when the two
binary64 endpoints have no representable midpoint.

Adjacent atoms with equal count enclosures may be coalesced only when their
union remains connected through an included endpoint. The profile is displayed
in pages of 40 pieces; paging changes only the displayed rows. All pieces,
endpoint inclusion flags and original timestamps remain in the report.

Ordinary ranges use an unwrapped degree axis across north. Exactly 180 degrees
of half width uses canonical [0, 360] degrees, while retaining the original
nominal bearing. This avoids a rounded `centre + 180 - (centre - 180)` span
slightly exceeding 360 degrees. It introduces no tolerance that closes gaps.

These are engineering-screened floating-point envelopes, not certified interval
arithmetic or a physical sunlight proof. The complete sweep composes the
supplied envelopes exactly with respect to their numeric endpoints; it does
not upgrade their geometric or physical qualification.

## Original-kernel checks and withheld conclusions

The nominal direction and declared endpoints reuse complete original-kernel
checks already retained by the single-instant investigations. Up to two extra
complete-course checks inspect useful profile directions through the maintained
`compareSunPath` calculation. An open atom without a strictly interior
representable number is retained in the arrangement but receives no fabricated
midpoint witness.

Every witness retains all original UTC samples, scenario classifications and
original column sources. The summary displays count enclosures when uncertain
or grazing classifications prevent a definite count. These checked directions
are independent controls; agreement among them does not establish a complete
range by sampling.

A rejected single-instant numerical envelope is replaced by an unknown
zero-to-one contribution, including when an original witness contradicts a
partial band. Its rejected geometry is not reused as proof. If a separately
checked complete course contradicts the composed envelopes, the complete-course
count summary and profile are withheld. Original sample investigations,
witnesses and the disagreement remain available for inspection.

## Complete admission and original inputs

Admission reserves work for the complete original course before evaluating any
geometry. For N site cells and T original timestamps, the conservative witness
reservation is `9 * 6 * N * (N - 1) * T` slab checks: up to seven existing
single-instant full-site checks per timestamp and two additional full-course
checks. The complete reservation must fit the maintained 16-million-check
limit. The endpoint-event reservation is `max(8, 16 * (N - 1)) * T`, capped at
250,000; the sweep also checks actual endpoint work. Neither limit permits
reporting a truncated timestamp or site subset as a complete investigation.

**Save common-bearing course** downloads
`experimental-earth-sun-bearing-course.json`. Its exact top-level fields are
`kind`, `model`, `project`, `declaration` and `settings`. The kind is
`experimental-earth/sun-bearing-course-inputs/1`. Settings contain only the
original `cellIndex`, `halfWidthDeg` and nonblank `basis`; the geographic/UTC
declaration retains its eight accepted fields. The outer byte limit is 5 MiB
and the portable project limit remains 4 MiB.

Reopening validates the model, original obstruction context and complete raw
inputs, then recomputes every original sample, profile and witness. Cached
profiles, counts or verdict fields are refused. This supports reproducibility
from declared inputs, not source authentication or a promise of identical
results after future model revisions.

The consumer distinguishes the accepted current course, ordinary retained
course and an opened common-bearing investigation's own original source. An
opened investigation can be inspected beside a different active project.
Changing source, cell, range or basis disables saving and supersedes queued
work. Failed imports retain accepted results; newer input events and closing
the view supersede delayed file reads.

## Executed authored control and receiving

The authored four-by-two flat site has two-metre cells and a ten-metre C1
proposal column. Its original London declaration (51.5 degrees latitude,
-0.1 degrees longitude) retains nine half-hourly UTC timestamps from 06:00
through 10:00 on 21 June 2026. The nominal bearing follows the maintained solar
azimuth at 08:00 and the declared half width is 90 degrees.

Every timestamp is individually possibly obstructed, yet the common-bearing
proposal and additional-obstruction enclosures are [0, 7], with existing and
removed enclosures [0, 0]. The complete profile has 37 pieces. A separately
evaluated original-kernel course at about 92.892343 degrees has seven blocked
and two clear proposal observations. This is a software control using authored
geometry, not a measured site or evidence of an environmental outcome.

Run the focused native controls:

```sh
node tests/solar-bearing-course-sweep.test.mjs
node tests/solar-bearing-course.test.mjs
node tests/solar-bearing.test.mjs
```

They cover exact endpoint grouping, paired membership, reference counts,
positive gaps, eligibility, numerical-unknown normalization, complete-course
kernel comparisons, full-circle admission, complete work refusal and input-only
replay. Separate original-kernel comparisons are regression controls, not the
range algorithm.

The actual browser receiver uses the maintained sandbox-qualified harness:

```sh
CHROME_BIN=/opt/google/chrome/chrome \
SUN_BEARING_COURSE_RECEIPT_DIR=/tmp/sun-bearing-course \
node tests/solar-bearing-course.browser.mjs
```

It exercises trusted keyboard activation, original sample and witness details,
complete profile access, actual download and native reopen, source custody
beside a different project, footprint denominators, invalid inputs, queued-work
and delayed-read cancellation, and readable native HTML labels at 390 pixels.
An authored receiver is distinct from an executed receiving result.
