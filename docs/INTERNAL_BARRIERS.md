# Internal walls, finite crests and openings

The paired site editor can now represent a closed connection between neighboring cells. Select a cell, choose the existing or proposed site and a compass direction in **Walls and openings**, enter a source or hypothetical assumption, and close or open that edge. Dark lines appear on the actual site maps. The same edge can be inspected or edited from either endpoint.

Declarations are part of the normal portable project and browser save. Copying the existing site into the proposal carries its edge declarations. Editing a surface or height preserves the separate edge source. All ordinary simulations, infiltration/outlet comparisons and rainfall tracing consume the maintained solver, so they use the same connectivity. Existing retained observations stay intact; users must check whether they still describe the edited site.

## Calculation

The maintained solver enumerates each internal east/south pair once. A closed pair requests no transfer. All remaining links retain the previous simultaneous, availability-capped calculation. The pair remains in the edge ledger with zero flux, preserving local-budget and reverse-attribution indices. Exterior outlet requests are unchanged. Water may still reach the other side by an available route around the wall.

The closure is reciprocal: it blocks either flow direction, even when the instantaneous hydraulic-head ordering changes. It has no height-dependent overflow or leakage model. A closed edge is impermeable throughout the simulation, not a claim about real wall strength, flood protection or overtopping. A declared opening uses the existing full cell-to-cell connection; opening width and discharge coefficients are not inferred.

## Portable representation

Each scenario cell may contain an optional `internalBarriers` object with `east` and/or `south` records. A record contains a boolean `closed` and a nonempty `source` of at most 240 characters. These canonical directions prevent duplicate/conflicting declarations for the same edge. North/west UI actions edit the corresponding neighbor's south/east record.

Absent records and `closed: false` both allow ordinary model transfer. The latter retains a source for an explicitly declared opening. Records on an exterior east/south edge are refused, as are unsupported keys, malformed states and missing sources. Older projects remain open internally and retain their calculations.

Cross-event hypothesis transfer checks hydraulic connectivity in addition to existing geometry, surfaces and model assumptions. It accepts equivalent absent/declared-open records and differing source notes, but refuses a changed wall. Collection evidence already binds the complete site cells, so edits retire its comparison until the retained event association is reviewed.

## Verification

`tests/internal-barriers.test.mjs` includes an independent 2×2 calculation: five liters of source-cell rainfall split equally between two low neighbors without walls; closing one link sends all five liters to the remaining neighbor; closing both retains them. A second-step gap control shows rerouting through an available opening. Further controls verify reciprocal editing, nonnegative storage, local/global conservation, forward/reverse rainfall attribution, unchanged exterior behavior, malformed-input rejection, portable reproduction and cross-event admission.

`tests/internal-barriers.receiving.mjs` exercises the actual browser controls and saved project. Authored analytical controls establish the implementation behavior, not physical calibration or provider/deployment qualification.

A wall/opening change contributes both adjacent cells to the existing directly edited-footprint water budget. Equivalent default/declared openings and source-note-only edits do not enlarge that physical footprint. Regional arithmetic remains the maintained accepted-flux accounting.

## Declared finite crests

A finite record instead contains `crestElevationM` and `source`, with no `closed` field. Its absolute elevation must be finite, between −10 and10 meters, and in the same declared datum as the adjoining ground. Select the edge, enter the elevation and source, then choose **Set finite crest**. Blue map lines and the edge inspector distinguish it from a permanently closed brown edge. Opening/closing the edge replaces its finite record; the ordinary project export, reopen and copy workflows retain it.

A crest at or below the higher adjoining ground is retained as a declaration but adds no modeled obstruction. For a crest above that ground, the frozen donor/receiver water-surface heads and crest determine the proposed overflow. In millimeters, with donor head H, receiver head R, crest C and the existing mobility-times-step coefficient k, its requested transfer depth is k times max(0,H−max(R,C)). The donor stopping depth is max(0,max(R,C)−donorGround). This is a conceptual linear overflow request, not a calibrated weir equation.

All outgoing requests from that donor—including ordinary open links and exterior outlets—compete for the same initial stored water. The limiter distributes each request as a fixed rate through the remaining normalized step time. At each successive stopping layer, it shares the available water in proportion to active rates, then stops all finite paths whose thresholds were reached. Lower paths may keep draining afterward. Thus a high crest can legitimately carry early overflow even if a lower outlet later drains the donor below it. Incoming water stays unavailable until the simultaneous movement is applied. Accepted per-edge totals reach the existing tracers and local budgets once, in their original order.

The ordinary open/closed operator remains exact for legacy projects and inert crests. This compatibility choice creates a model boundary: over unequal ground, a just-above-ground finite crest can use a different request than an exactly-ground-level open connection. Do not interpret that transition as calibrated small-curb physics. Receiver heads remain frozen during the step; there is no globally implicit hydraulic solution, erosion, breach, leakage, calibrated opening width or structural-strength model. Source notes and supplied elevations remain declarations.

Time-step sensitivity matters when rainfall crosses a crest within a step. One authored six-minute control transfers2liters with one six-minute step and1liter with two three-minute steps. Those different results are deliberately exposed; neither establishes a physical discharge. Existing numerical-sensitivity studies still call the same solver.

Study identity and edited-footprint checks retain finite elevations. A changed declaration affects both adjoining cells and prevents cross-event transfer without reassessment, even when a low crest is currently inert; provenance-only changes do not alter hydraulic identity. Ambiguous open-plus-crest records, non-plain records, inherited edge declarations and nonfinite/unsourced/exterior crests are refused.

`tests/finite-crests.test.mjs` covers independent rational layer allocations, below/at/above-crest behavior, reciprocal flow, multiple crests competing with lower drainage, full-solver forward/reverse origin and local/global budgets, portability, source-mode admission and numerical-step differences. Six frozen pre-crest outputs from commit4b867d01 remain bit-for-bit identical for legacy open/closed inputs. Independent review also checked randomized donor budgets and found the prototype-mode admission issue before its repair. These are authored numerical controls, not measured hydraulic validation.
