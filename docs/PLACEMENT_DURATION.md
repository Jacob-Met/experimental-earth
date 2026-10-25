# Within-window wet-duration placement goals

The placement panel can require every declared cell to meet a signed limit on additional minutes strictly above an authored modeled depth threshold. The reference is the current proposal under the same retained infiltration rate. A limit of zero allows no additional wet minutes; −50 requires at least 50 fewer modeled wet minutes. Every original source-supported rate must meet every peak-depth and duration goal. The site objective ranks only qualifying layouts; an empty qualifying set has no fallback winner. Adoption recomputes the full goal set and retains the existing proposal-evidence and source-change guards.

This is a finite comparison under authored assumptions, not a drainage design, safety threshold, access guarantee, or prediction of complete drawdown. The threshold and goal require an explicit basis. Minutes are restricted to the modeled window and use the maintained `pondingExposure` piecewise-linear interpolation between retained solver snapshots. Threshold equality does not count. Separate wet intervals remain separate; wet initial and final endpoints remain explicit. A wet final endpoint supplies no clearance time beyond that window.

## Source and computation

`compareIntervention` accepts optional `exposureRequest: {thresholdMm, cellIndices}`. It projects the existing maintained exposure result while each scenario's raw solver result is available. The default comparator omits this output. The request admits 1–12 distinct cells and a finite threshold greater than zero and at most 1000 mm. `placement-duration.js` admits a finite signed duration-change limit within the modeled duration and a nonempty basis of at most 500 characters. The placement report retains original/candidate intervals, endpoint flags, minutes, differences, and violations for every supported rate.

The search still enumerates the complete declared layout family and conditions evidence only on the original source. The existing fixed-original-support sensitivity course reevaluates identical layouts at the original, half, and quarter intervals (minimum 1 minute), without reclassifying evidence. Duration qualification and its per-rate witnesses are included at each interval. Changes demonstrate numerical sensitivity, not convergence or physical accuracy.

A shared conservative preflight counts three model cell-step allowances and two full-grid exposure cell-segment passes per declared rate/layout/interval when duration is requested. Both the base search and the full finer-step course enforce the existing three-million work bound before evaluation. No layouts or hypotheses are silently dropped to fit. The panel displays model and exposure components separately.

## Reproducible authored control

Use the courtyard example with proposal copied from existing, sealed rates 0.2/1/4 mm/h, garden replacement, two edits, eligible cells C3/D3/D4/E5 (indices18/19/27/36), and objective water not absorbed. At C2 (index10), count minutes above5mm. The unconstrained winner D4+E5 has worst duration change0 minutes; its first two rate cases remain wet at the240minute modeled end. A−50minute goal selects C3+D4 at all three tested intervals. A−50.75minute goal makes that layout qualify at5minutes but fail at2.5 and1.25minutes. A−240minute goal has no qualifying layout. These are software witnesses, not field observations.

## Receiving

```
node --test tests/placement-duration.test.mjs tests/placement-resolution.test.mjs tests/placement-constraints.test.mjs tests/placement-search.test.mjs tests/intervention.test.mjs tests/ponding-exposure.test.mjs
CHROME_BIN=/usr/bin/google-chrome-stable PLACEMENT_DURATION_RECEIPT_DIR=/tmp/earth-duration-receipt node tests/placement-duration.browser.mjs
```

The browser course uses the maintained active-sandbox gate, an absolute session directory, real panel imports and interactions, and retains raw sandbox receipt, checks, desktop/narrow screenshots. It checks withheld adoption, endpoint witnesses, unchanged project storage, changed qualification at finer intervals, stale-result invalidation and no-fallback refusal. The direct browser executable is required on hosts whose wrapper disables the sandbox.
