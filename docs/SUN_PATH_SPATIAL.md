# Inspect sampled sun obstruction across the site

The dated sun-path comparison offers a spatial map of every retained ground
centre. Use it to find where the existing and proposed columns produce different
classifications, then inspect the original scenario rows and obstruction
witnesses at a selected UTC sample.

## Use the map

1. Compare a dated course in the sun-path panel. The map uses that original
   course, with the same site, geographic declaration and UTC samples.
2. In **Original course counts**, each ground centre shows separate counts of
   additional mapped obstruction, removed mapped obstruction and limited
   samples. A centre with both additional and removed samples is marked mixed;
   the counts are not subtracted into a net score.
3. Choose **One original UTC sample** and a timestamp to inspect the paired
   category at that instant across the whole grid.
4. Select a ground centre to synchronize the existing cell selector and complete
   detail. The map repeats both original scenario statuses and any obstruction
   witnesses without replacing them with an aggregate score.

Arrow keys move to neighboring ground centres without wrapping between rows.
Home and End select the first and last centre. One map button is in the tab
order; focus follows the selected centre. On narrow screens the labeled map
region scrolls horizontally while retaining its row and column geometry.

## Categories and limits

Additional obstruction means the existing scenario reports no mapped blocker
and the proposal reports blocked. Removed obstruction is the reverse. Equal
blocked and equal no-mapped-blocker results have separate unchanged categories.
Height-dependent or grazing comparisons remain unresolved. Footprints, low
solar elevations and below-horizon samples have their own limiting categories;
none is converted into clear ground.

Counts are numbers of sampled instants at ground centres. They do not measure
continuous duration, shaded area, spatial coverage, irradiance or thermal
comfort. A ground centre does not represent every point in its cell. All
location, orientation, terrain, height and solar-position limitations of the
[dated sun-path model](SUN_PATH.md) still apply.

The map summarizes the accepted original course. The separate finer-grid
investigation remains an explicit comparison; it does not silently replace the
map's sample grid. The complete report is checked before summarization, with
the same maximum of 193 samples and conservative 16-million slab-check budget.
An incomplete or inconsistent paired course is refused.

## Retained investigations

Reopening a saved sun-path investigation creates a separate map from that file's
recomputed original course. It keeps its own dimensions, selected ground centre
and UTC inspection beside a different active project. Changing the active
project does not adopt or edit the retained location, columns or declaration.
Changing the current source invalidates its map; closing the retained
inspection clears its map. Saving remains input-only, with no map verdict or
derived count trusted on reopen.

## Reproduce the authored control

The native and browser receivers use an 8-by-2 flat site with 2 m cells and a
10 m opaque proposal column at H1. The June 21 London course has 121 one-minute
samples between 06:00 and 08:00 UTC. A1 has 47 additional-obstruction samples,
F1 and G1 each have 121, and H1 remains a footprint for all 121 samples. This
demonstrates variation across the authored site; it is not measured field
validation or evidence of continuous shade duration.

Run the four native groups with:

```sh
node tests/solar-path-spatial.test.mjs
```

The browser receiver exercises the original map, retained native-file reopen
beside a different active project, original witnesses, trusted keyboard
selection, unchanged project bytes, closing and actual 390 CSS-pixel layout:

```sh
CHROME_BIN=/opt/google/chrome/chrome SUN_SPATIAL_RECEIPT_DIR=/tmp/sun-spatial node tests/solar-path-spatial.browser.mjs
```

It uses the maintained browser harness and sandbox verification. Source review
and native tests do not stand in for running this browser receiver.
