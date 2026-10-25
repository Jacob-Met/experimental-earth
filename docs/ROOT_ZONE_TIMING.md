# Rooted water through the original infiltration intervals

## Question and consumer

The timing comparison in the existing rooted-water panel follows the original selected cell's accepted infiltration through the complete modeled event, then through the same declared dry period. It compares that course with the same total recharge delivered as one pulse at event end. Both courses use the same separately attributed potential transpiration during the event.

The earlier root-zone investigation remains available and keeps its original no-event-transpiration assumption. Declaring zero event demand in the timing investigation recovers its event-end storage and subsequent dry response, subject to floating arithmetic.

## Original water custody

The implementation calls the maintained `runRain` twice, once for each original site map. It requests its original local water budget and all-cell rainfall attribution with every native step captured. It does not introduce another runoff solver or choose an investigated infiltration hypothesis: the original maps' default constant surface infiltration capacities remain in use.

Every cell must start with exactly zero native surface inventory. Final attributed absorption is reconciled against the complete local budget for every cell before the selected cell is extracted. Nonzero initial water, incomplete attribution, missing coverage or nonmonotonic selected cumulative infiltration refuses the calculation. In particular, untagged initial ponding must not be renamed rainfall. This preserves the distinct initial-ponding work in #42.

The selected interval recharge is the difference between consecutive original cumulative absorbed volumes divided by the original cell area. The complete event, including drainage time after rain stops and a final partial native interval, is retained. Two traces together are limited to 250,000 retained cell-steps before simulation.

Within each native interval, recharge is explicitly assumed uniform. Native step totals do not establish physical sub-step timing. Root storage does not feed back into the surface model.

## Root response

The rooted store retains the original declaration: capacity `C = 1000 × (fieldCapacity − wiltingPoint) × rootDepthM`, original initial available water, and depletion fraction `p`. Write `T = (1 − p) C`.

For constant recharge rate `r` and separately declared potential transpiration `E`, the model solves

`dS/dt = r − E min(1, S/T)`

between zero and capacity, with immediate excess drainage at capacity. The explicit `T = 0` limit supplies demand until available water is exhausted. A zero recharge interval reuses `advanceRootZoneDry`. Below a positive threshold the solution is exponential; above it the solution is linear. Regime transitions are solved directly, with a bounded maximum of four legs per interval. This is a one-way conceptual store model, not an additional hydraulic inference.

The implementation uses nonnegative exponential terms to avoid cancellation below zero, handles a finite rate with an overflowing rate–time product by its stable equilibrium form, preserves zero-duration state, and refuses a nonfinite stress rate. Every returned state must be finite, inside capacity, and consistent with its water account.

The matched end pulse first subjects the original initial store to the identical event demand, then applies the entire original recharge and immediate excess drainage. This prevents the comparison from confounding timing with an omitted demand period. Both profiles then reuse the maintained dry solver. Original declared initial water stays in the original root object; the event-end boundary used for dry propagation is explicitly labeled computed and is never written into saved source inputs.

The constitutive stress rule is adapted from [FAO56 chapter 8](https://www.fao.org/4/X0490E/x0490e0e.htm). The continuous forced response and uniform within-interval infiltration are explicit modeling adaptations. Potential plant transpiration excludes soil evaporation. No further rain, irrigation, capillary rise, lateral soil flow, root growth or measured crop response is inferred.

## Inspection and replay

The graph has separate event and whole-course windows. Its end pulse includes an explicit jump. Display samples do not supply the time inspector: each chosen time is recomputed from its retained interval's initial state or the maintained dry response. Exactly at event end the pulse has been applied.

The table retains cumulative recharge, potential/supplied/unmet transpiration, drainage, available water and the water-account residual. Existing and proposed source cells are selectable; the original full-event volume, cell area, source declarations and every recharge interval remain inspectable.

`experimental-earth-root-zone-timing-investigation/1` stores exactly `schema`, `project`, `study` and `demand`. It accepts no saved conclusions. The existing root study is retained as the original baseline declaration; timing and event demand belong to this separate wrapper. Imports are byte bounded and recompute before adoption. Neither kind of root investigation replaces the active site.

Starting a source replacement in either the original or timing panel synchronously retires pending work in the other panel. Older reads cannot commit after a newer action. A failed replacement preserves the last accepted comparison; a changed source/property/demand invalidates derived results and export.

## Executed controls

- Eleven focused native groups cover independent constant-regime solutions, both threshold crossings, split-interval parity, capacity overflow, zero demand, originally reported extreme numeric failures, original-versus-computed boundary custody, native partial final intervals, all-cell reconciliation and strict replay.
- Independent review repeated 240 analytic and 60 RK4 courses for the forced solver, then 5,000 low-recharge long-duration positive-state cases. The three initial numeric counterexamples are retained as regressions.
- A separate review executed 985 timing/account/source controls, including matched demand, partial event inspection, pulse boundaries, nonselected-cell discrepancies and wet initial surface refusal.
- The actual browser course covers both original site cases, exact time, original-input download/reopen, forged-result refusal, original field invalidation, keyboard input, desktop/narrow display and both cross-panel asynchronous completion orders.
- For an authored 720-minute event with 30 minutes of rain, empty initial store, 18 mm capacity, p=0.5 and 12 mm/day event demand, the original example cell receives 6.502656342 and 37.814868646 mm in the two site cases. The interval-fed event-end stores are 4.021304911 and 13.896614767 mm, versus 6.502656342 and 18 mm for the matched end pulses. These are model controls, not field measurements or recommendations.
