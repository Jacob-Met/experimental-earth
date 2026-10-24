# Internal walls and openings

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
