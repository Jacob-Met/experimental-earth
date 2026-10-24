# Compare selected calendar dates on one site

A single day's sun-path comparison does not establish the proposal's behavior
in another season. The selected-date investigation keeps one complete retained
site and compares its existing and proposed columns on explicitly chosen dates.

## Compare and inspect

1. Compare a dated sun path, or reopen an ordinary saved sun-path investigation.
2. Open **Compare selected calendar dates on one retained site**. Choose the
   accepted current course or the separately reopened original course as the
   source. The source line identifies its site and UTC period.
3. Enter one to seven additional calendar dates in `YYYY-MM-DD` form, separated
   by commas or new lines, and compare the complete set. The original date is
   always included. Duplicate dates and impossible calendar dates are refused.
4. Choose a comparison ground centre. The table retains every paired category
   on every date, including limited samples. Additional and removed obstruction
   remain separate; neither winter darkness nor a footprint counts as clear.
5. Select a date to inspect its spatial map and original per-scenario witnesses
   at a selected UTC instant. Arrow keys select neighboring map cells. The
   complete selected course is available under its own disclosure.

All dates keep the original location, true-north grid bearing, ground and column
declarations, UTC starting clock, elapsed duration and sample spacing. A course
that crosses midnight still crosses midnight after shifting its start date.
Both endpoints remain included; an unaligned final interval stays shorter than
the regular spacing. Calendar arithmetic uses UTC without the device's time zone.

Equal UTC starting clocks do not guarantee equal local clocks or equal solar
times. Local seasonal clock changes are not inferred. Choose a separate ordinary
investigation when a different UTC window is the question you intend to ask.

## Limits and interpretation

Each course retains the maintained maximum of 193 sampled instants. The entire
set shares the conservative 16-million slab-check budget; all calendars and
aggregate work are admitted before any course result is exposed. A rejected
request is not silently shortened or reduced to a subset of dates.

The comparison counts discrete sampled instants at ground centres. It does not
infer continuous hours, whole-cell shaded area, an annual total, or conditions
between the selected dates. Original height, point-ray, solar-position,
orientation, location and off-map limitations continue to apply. See the
[dated sun-path model](SUN_PATH.md) and [spatial inspection](SUN_PATH_SPATIAL.md).

The authored 8-by-2 London control uses the same 10 m H1 column and the same
06:00–08:00 UTC window on each date. At A1, June 21 has 47 additional-obstruction
samples, while March 21 and September 21 have none. December 21 has 121
below-horizon samples. At F1, March, June and September have 41, 121 and 39
additional samples. These calculations demonstrate the mechanism on authored
geometry; they are not field measurements or evidence of continuous duration.

## Save, reopen and change a draft

**Save date comparison** downloads `experimental-earth-sun-dates.json`. It
contains the original input-only sun-path investigation, additional dates and
selected course. The original investigation also retains the selected ground
centre. The file includes the site's geographic location and source words;
share it when you intend to include those inputs.

Reopening recomputes every course from the original project and its pinned
SunCalc identity, independent of a different active project or ordinary retained
investigation. No cached verdict or derived count is accepted. The opened
comparison's own original course can be used for another explicit date set.
Closing clears this inspection without changing the active project or deleting
the downloaded file.

Changing a date draft or its chosen original source cancels queued calculations
and disables saving until comparison succeeds again. A previously accepted set
can remain visible with its original source and date labels. A refused file
keeps the previously accepted set; later source choices, draft edits or closing
prevent an older delayed read from replacing the current selection.

The envelope is `experimental-earth/sun-dates-inputs/1`, with exactly `kind`,
`investigation`, `additionalDates` and `selectedCourseIndex` fields. UTF-8 input
is limited to 6 MiB; the embedded project still passes the ordinary 4 MiB
portable-project admission. Unknown fields, model substitutions, stale column
contexts and invalid selections are refused. Retained declarations reproduce a
calculation; they do not authenticate a survey or observation.

## Verification

```sh
node tests/solar-path-dates.test.mjs
CHROME_BIN=/opt/google/chrome/chrome SUN_DATES_RECEIPT_DIR=/tmp/sun-dates node tests/solar-path-dates.browser.mjs
```

The native controls cover maintained per-date equivalence, seasonal differences,
leap and midnight endpoints, whole-set work admission, raw reopening, source
custody and byte limits. The actual browser receiver covers source choice,
selections, original witnesses, native file download/reopen, cancellation,
trusted keyboard navigation and narrow rendering through the maintained sandbox
verifier. Run that receiver separately; native tests do not establish a browser
pass.
