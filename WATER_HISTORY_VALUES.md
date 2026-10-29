# Read whole-site surface water at a retained time

The ordinary workbench's **Water still on the surface** chart includes a
**Read a retained time** control. It shows the existing-site and proposed-site
surface-water totals at one original model snapshot, together with the signed
proposed-minus-existing change. All three values are in litres across the whole
site. The map's local water depths remain a separate view.

Use the time slider or **Previous** / **Next**. When the slider has focus, arrow
keys move one original snapshot; **Home** and **End** select the first and last.
The label shows the actual retained minute, including a fractional final time,
and the position shows the snapshot count. The accessible slider value names
the time and position; the table has a caption and explicit row/column headings.

The initial choice is the last retained snapshot. After another comparison
completes, the same exact minute stays selected if it exists in the replacement
course; otherwise the final snapshot is selected. The choice is a view setting
for this tab. It does not edit or add a field to the project, run a comparison,
change the chart's source samples or persist in an exported project.

## Original values and completed comparisons

The readout uses the already completed comparison's original `minute` and
`storedLiters` values. It does not interpolate, round to the nearest time,
resample or solve again. Its difference is the normal JavaScript subtraction of
the proposed and existing original numbers. Text uses the shortest decimal
spelling that reads back to the same JavaScript Number, retaining negative zero
when present. A positive difference has an explicit `+` sign. Long decimal
spellings expose the stored numerical result; they do not establish physical
measurement precision or remove the model's existing qualifications.

The module copies only paired scalar values into a private immutable course.
It requires equal-length, increasing, exactly aligned original times and finite
nonnegative water totals. It does not retain an alias into a later mutable
project or result. The displayed project title is inserted as literal text.

The readout adopts a course only after the main workbench has committed its
complete comparison. While an import/calculation is pending or has failed,
selection is disabled and the readout identifies the last completed project.
The existing main status also explains the pending or failed source. Exporting
at that point retains the current input under the existing export behavior; it
does not relabel the retained water values as belonging to that input. Restoring
the last completed project re-enables its readout. A superseded Worker result
cannot replace the newer accepted comparison.

## Verification

Focused native checks:

```sh
node tests/water-history-values.test.mjs
```

The checks cover direct original-number identity and nonmutation, every one of
721 retained times, fractional endpoints, zero and signed differences,
misaligned/invalid-course refusal, immutable copies and round-trip text.

The maintained browser course requires Playwright and an actual Chromium
sandbox. Run it with a new output directory:

```sh
CHROME_BIN=/path/to/chrome \
PLAYWRIGHT_MODULE=/path/to/playwright-core/index.mjs \
EARTH_WATER_VALUES_BROWSER_OUTPUT=/tmp/earth-water-values-receiving \
node tests/browser.water-history-values.mjs
```

It serves the actual maintained page and compares every displayed selection
with direct `compare(project)` results for dry, ordinary, positive-change,
maximum-size and fractional-endpoint authored controls at desktop and 390px.
It verifies that each full numeric value stays on one line, and exercises
native keys/buttons, original export-byte identity, pending source
retention, newer-source retirement, actual Worker load failure and project
restore, plus fresh original-file reopening. Served JavaScript/CSS is bound to
the tested files and four screenshots capture the ordinary/large layouts.
Keyboard and semantic-markup checks do not claim a screen-reader speech test.

The independent full-history CSV outcome is tracked in
[issue531](https://github.com/Jacob-Met/experimental-earth/issues/531).
