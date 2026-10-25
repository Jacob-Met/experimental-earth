# A declared shared ground-height error across a supplied footprint

The terrain instrument's **Investigate a shared ground-height error across a supplied footprint** disclosure asks a different question from independently varying two heights. Select the cells explicitly, write the basis for the shared-error hypothesis and confirm its transfer to the proposal. Every selected ground height then receives the same additive offset in each world. Each cell's authored proposal minus existing elevation change stays fixed.

The source table does not establish this shared-error model. Equal filenames, datum labels or adjacent cells are not evidence that their errors move together. The written basis is retained as the person's declaration, not verified survey evidence. Nothing infers a probability, correlation or physically supported joint distribution.

## Common interval and original sources

For positive supplied half-widths `u₁ … uₙ`, a common additive error must fit every selected interval. The largest supported symmetric interval is therefore `±min(u₁ … uₙ)`. A smaller explicit half-width may be entered. For example, selected sources of ±5 cm and ±2 cm admit a common ±2 cm interval; requesting ±3 cm refuses. Neither original source uncertainty is rewritten.

Every selected source must be present, have positive uncertainty, and declare compatible datum and cell spacing. A separately surveyed proposal cannot silently inherit the source error. The complete selected footprint is admitted or refused: no cell is dropped to make the comparison run. The default footprint is empty; **Select all supplied cells** is an explicit action and includes sources with zero uncertainty, which cause a clear refusal rather than automatic omission.

Only the actual common samples are checked against the solver's −10 to 10 m height range. The common intersection can be narrower than one source's individual interval; this is a declared shared-error family, not clipping an individual source at the solver boundary. Any requested sample outside the supported range refuses the whole request.

## Ground error relative to a fixed crest is not a datum conversion

All unselected ground and all declared absolute internal crest elevations stay fixed. The report lists those references, including their scenario and source, and retains every selected original source and authored height change. A coherent ground shift relative to a fixed crest changes relative geometry. Moving the ground and crest together is a different operation.

An executed authored-courtyard control makes the distinction concrete. Copy existing to proposal and lower B1 by 2.5 cm. With no absolute crest, shifting all 48 ground heights together by −5, 0 or +5 cm leaves proposal minus existing peak standing water at −1.5093844903258287 L. Add a fixed 0.11 m absolute crest at B1's east edge in both worlds:

| Common ground offset | Peak-standing-water difference, proposal − existing |
| --- | ---: |
| −0.05 m | −0.9708695513108978 L |
| 0 m | −0.9708695513108978 L |
| +0.05 m | −1.5093844903258287 L |

A separate direct-run control moving the crest together with the ground preserves −0.9708695513108978 L within 1.8×10⁻¹² L. The product's shared-ground hypothesis deliberately holds the crest fixed and does not present itself as a coordinate-datum conversion. These are computational controls, not acquired survey or intervention outcomes.

## Inspecting the result

The result shows the common interval, all selected source records and which sources limit the interval. Expand the fixed-reference ledger to inspect declared absolute crests and every unselected cell's unchanged elevations. The sample table shows all requested common offsets for a chosen modeled quantity. Select an offset with keyboard or pointer to inspect all four paired quantities, every selected hypothetical elevation, and every cell's final and separate peak depths. Changing the displayed quantity retains the selected offset.

The full work estimate is `2 × sampleCount × gridCellCount × ceil(duration / step)`, reserved before any solve. Selecting more footprint members does not multiply the number of full-site solves. The available counts remain 3, 5, 9 and 17. A count exceeding the one-million-cell-step budget refuses as a whole rather than silently reducing the samples.

Footprint and basis changes clear results and transfer confirmation. Interval, sample-count and transfer edits clear derived output. A source/project change resets the selected footprint and basis. Original project export/reopen retains only original inputs, without a shared-error declaration, derived matrix or adopted hypothetical heights. The existing single-cell and independent two-cell instruments remain available.

## Limits and verification

Finite samples do not bound a continuous interval or establish physical feasibility. A smaller modeled quantity is not an overall benefit; compared maxima can occur at different places or times. Weather, default material capacities, calculation interval and omitted physics remain modeling assumptions. Flat all-wet numerical references do not certify varied-ground hypotheses, and conservation alone is not an accuracy proof.

`node tests/terrain-shared-ground.test.mjs` exercises direct maintained-solver equality, complete local quantities, one-cell and two-cell-diagonal parity, full-footprint translation/fixed-crest controls, source and intervention custody, common-interval/unit admission, full-family bounds and work refusal. Retained single/joint tests and serialized-report parity check the shared admission refactor.

`CHROME_BIN=/opt/google/chrome/chrome node tests/terrain-shared-ground.receiving.mjs` uses a complete authored 48-row CSV through the normal terrain preview/apply path, then explicit keyboard footprint selection, written basis and transfer gates, source/reference ledgers, selected local results, narrow rendering, interval/count/source invalidation, whole-footprint refusal and raw input reopening. Actual source-qualified execution receipts must accompany integration; a prepared receiver alone is not a passed browser course.
