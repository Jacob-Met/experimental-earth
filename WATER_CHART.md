# Readable whole-site water histories

The ordinary rain comparison now sizes its chart to the available screen width.
Labels keep a 12px text size, including at a 390px viewport, instead of shrinking
with a fixed 700-unit SVG. The left gutter is measured from the actual formatted
water values. Endpoint time labels anchor into the plot, and the chart chooses
five, three or two time ticks according to their measured separation. The rain
end annotation also remains inside the viewport.

The comparison still draws both complete original `storedLiters` histories at
their retained native sample times. It does not resample, interpolate or change
the calculation. Axis labels use the existing numeric formatter; they are a
rounded visual scale, not a substitute for exact snapshot values. The separate
exact-value interaction is tracked in issue #529.

`createWaterChart` receives only a completed comparison. It privately captures
the two series and that comparison's duration and rain end. Resizing redraws
those accepted values; a pending calculation cannot combine an older history
with a newer draft's time axis. A hidden chart defers drawing until it has a
positive width. `ResizeObserver` reacts to available width, and unchanged widths
do not trigger another render.

## Verification

Run the focused native layout course with:

```sh
node tests/water-chart.test.mjs
```

It covers measured gutters and tick separation for ordinary and large numeric
labels, dry histories, fractional final times, nonmutation and all 721 samples
in each original series. Browser receiving compares the unchanged baseline
with the maintained candidate, including actual DOM text bounds, original
solver samples, pending-worker resizing and real export/reopen:

```sh
CHROME_BIN=/path/to/real/sandboxed/chrome \
PLAYWRIGHT_MODULE=/path/to/playwright-core/index.mjs \
EARTH_CHART_BASELINE_ROOT=/path/to/pre-change/source \
EARTH_CHART_BROWSER_OUTPUT=/path/to/fresh/output \
node tests/browser.water-chart.mjs
```

The output directory must be fresh. The baseline must be a complete source tree
from before this layout change. Browser requests are bound to the original
served source bytes; both servers use retained log files rather than unread
stderr pipes. The course deliberately retains the baseline's clipped or small
labels as negative evidence, and does not treat an incomplete run as a pass.

## Recorded receiving on 29 October 2026

The three native groups passed. Actual sandboxed Chrome156 receiving completed
eight baseline and eight candidate geometry/source comparisons at 1440px and
390px, plus pending-worker resize and original export/fresh-context reopen.
All candidate text remained 12px with complete bounds and separated ticks;
the prior mobile text measured approximately 5.217px. The baseline's large
water labels and final time tick were clipped. Both complete histories matched
the maintained solver, and all 2,231 runtime/test source files were unchanged.
All 717 served JavaScript/CSS source bindings matched their original bytes.
The four desktop/mobile before/after captures were visually inspected.

The first browser controller failed while holding a worker request. Its failure
is retained and is not counted as a passing course. The repaired controller
uses one request owner; production code was unchanged. Exact commands, source,
geometry, sandbox evidence and capture hashes are retained in
`docs/receipts/water-chart-366053231788.json`.

The large source is an authored supported-range control: 24×24 cells, 720
minutes and 100m cell size. It establishes computational and layout behavior,
not measured flooding or physical forecast accuracy. No model, worker, stored
project, original export or other investigation consumer is changed.
