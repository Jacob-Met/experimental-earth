# Route blockage through time

Inspect when a chosen route exceeds a modeled depth threshold and which cells account for that duration in the existing and proposed scenarios.

## Inspect a route

In **Ponding through time**, choose the minute and depth threshold. Under **Inspect a connected route**, enter distinct adjacent cells in route order.

The original same-time inspection evaluates the listed cells at the selected minute. The duration breakdown summarizes exceedance over the reported ponding timeline, comparing all route cells at the same time.

Open the **Existing** and **Proposal** disclosures to inspect the same route and threshold against each scenario. Each contains a table ordered by sole-cell duration:

| Column | Meaning |
| --- | --- |
| Cell | A cell in the authored route. |
| Sole cell above (min) | Time when this cell exceeds the threshold and no other route cell does. |
| Above, including overlaps (min) | All time this cell exceeds the threshold, including time when other cells also exceed it. |

The multiple-cell duration counts time when two or more route cells exceed the threshold. Each shared interval counts once, regardless of how many cells overlap.

**Sum of sole-cell durations + multiple-cell duration = any-cell-above duration.**

Do not add the inclusive column to obtain route duration: those entries overlap.

## Three-cell example

Suppose A exceeds the threshold during minutes [0, 4] and [8, 10], B during [2, 6], and C during [5, 9]. Endpoint instants contribute no duration.

| Cell | Sole cell above (min) | Above, including overlaps (min) |
| --- | ---: | ---: |
| A | 3 | 6 |
| C | 2 | 4 |
| B | 1 | 4 |

A is alone during [0, 2] and [9, 10], B during [4, 5], and C during [6, 8]. Multiple cells overlap during [2, 4], [5, 6], and [8, 9], totaling 4 minutes.

At least one cell exceeds the threshold throughout the 10-minute example:

**3 + 2 + 1 + 4 = 10 minutes.**

Adding the inclusive column instead gives 14 cell-minutes, counting each shared interval for every cell involved.

## Compare scenarios

Read each scenario's sole and shared durations together. A cell may account for substantial sole duration in one scenario while shared exceedance dominates the other. These values describe the retained results; they do not predict the effect of changing or removing an individual cell.

The query is temporary and does not edit the project or source evidence. Changing the site or threshold recomputes both scenarios together. An invalid route clears the results.

## Interpolation and source limits

Exceedance is strictly **depth > threshold**. Equality is not exceedance, and crossing instants have zero duration.

Durations use linear interpolation between retained depth samples and inherit the source result's time coverage, spatial resolution, and modeling assumptions. They do not establish measured flood validation or route safety.

Tiny positive gaps remain unassigned in this breakdown. Older aggregate windows may bridge gaps shorter than 1e-8 minute, so their displayed spans can differ slightly from the exact duration attribution.

This view compares all declared cells at the same time. It does not simulate walking speed, departure time, or sequential arrival along the route; timed traversal remains separate work in [#99](https://github.com/Jacob-Met/experimental-earth/issues/99).

## Receiving

Run the native tests with `npm test`. With a supported sandboxed Chromium installation, run `CHROME_BIN=/path/to/chromium node tests/route-blockage.receiving.mjs`.

The browser course opens the maintained application, uses its keyboard navigation and route form, compares displayed durations with an independent endpoint/midpoint oracle over the actual model results, and exercises threshold changes, replay, ordinary scenario edits, invalid routes, and project-file replacement. It retains source qualifiers, scoped table headers, screenshots at desktop and 390px widths, and browser cleanup receipts. Its default courtyard and smaller import fixture are authored models, not field observations.
