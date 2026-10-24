# Spatial observation comparison

The notebook's **Where do readings challenge this model?** view locates retained
depth evidence on the existing or proposed site. It compares the current authored
model with each reading using the maintained infiltration study's exact-time
`interpolateDepth` function. The ordinary notebook now uses that same prediction
instead of the nearest saved snapshot.

Choose an observed scenario and optionally an evidence role. Unassigned scenarios
are counted as excluded, never attributed to a site automatically. Calibration,
held-aside and notebook-only roles remain attached to their readings; this view
does not fit parameters or rank candidate hypotheses.

Each cell distinguishes no matching readings, all readings within their stated
bands, all outside, or a mixture. An unobserved cell is unknown, not agreement.
Selecting a cell shows every original source, time, observed depth and tolerance,
prediction, signed residual (observed minus predicted), and interpolation brackets.
Imported table filenames, row numbers and original quantities remain visible.
Opposing discrepancies are retained separately and explicitly identified; an
average cannot cancel them into apparent agreement. Band comparisons use the same
relative floating-point guard as the maintained infiltration study.

Map navigation enters Inspect mode and clears an unsaved depth/source draft so it
cannot be submitted against the new cell accidentally. It does not paint terrain,
alter retained readings or adopt inferred model properties. Results recompute
after model/evidence changes and after ordinary project reopen. The map and its
filters are derived session state; project JSON remains the existing source of
truth.

The view can reveal where a baseline assumption is contradicted and where it has
not been tested. It cannot establish why a mismatch occurred, field accuracy,
independent evidence, instrument quality, physical safety, or a uniquely correct
parameter. Readings must describe the same event/site as the authored assumptions.

## Verification

`node --test --test-isolation=none tests/*.test.mjs` passes 221 groups on the
candidate composed with source `4b867d01e60ce35da3c0e00f88a1b4d1ef382258`.
Seven added groups exercise analytic off-step depths, opposing residuals, scenario
and role exclusions, exact zero tolerance and band boundaries, changed rainfall
and cell surface, source immutability and ordinary JSON reopening.

`tests/observation-map.receiving.mjs` exports the actual-browser course for the
maintained browser session owner. Run its portable entry point with an installed
Chrome binary and a fresh receipt directory:

```sh
CHROME_BIN=/absolute/path/to/chrome \
OBSERVATION_MAP_RECEIPT_DIR=/tmp/earth-map-receiving \
node tests/observation-map.browser.mjs
```

Actual Chrome 156 receiving passed on the composed candidate: original source text,
opposing errors, exact-time notebook agreement, role/scenario filtering, safe cell
inspection while a painting brush was active, unsaved-draft clearing, changed rain,
reload and ordinary project reopening. The 1440px and 390px views were inspected.
The maintained Linux sandbox admission passed. The command retains the exact
project, runtime source hashes, screenshots and browser evidence; published
receipts are in `docs/receipts/observation-map-20261024/`.
These authored software controls do not establish environmental validity or an
installed deployment.
