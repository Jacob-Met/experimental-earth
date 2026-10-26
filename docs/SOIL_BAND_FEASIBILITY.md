# Seek proposals within the original depth bands

**Find proposals within original bands** complements the existing RMSE refinement.
It first recomputes and retains every proposal from that unchanged method, then
uses the unused part of the same 600-additional-run allowance to seek crossings
of an original calibration band. This can find compatible alternatives when a
very narrow original band coexists with broad, noisy readings. No original depth,
uncertainty, source or evidence role is changed.

After **Search declared grid**, choose either refinement button. The original
**Refine between grid values** remains the same method. The new band action can
also be run after it; it starts from the original project/query and recomputes the
published simplex stage, rather than trusting retained results as new evidence.
All original grid, simplex and band-guided proposals remain in the table. Ordering
still uses calibration RMSE. The closest RMSE proposal may be contradicted while
another tested proposal satisfies every original band; inspect the compatible
count and individual residuals, not only the first row.

Select 2–9 proposals for the existing comparison draft if useful. This never
adopts a soil property. **Save original search** retains the original project,
query and the distinct `calibration-band-crossings/1` method. Reopen through the
ordinary file input to recompute. Old grid and simplex files retain their original
meaning. Changing the working project or declarations retires the displayed result.

## What the additional computation does

The original calibration reading with the smallest supplied uncertainty in
millimetres is the anchor; ties use original notebook order. Held-aside readings
never choose the anchor, a trial parameter, a bracket, a stopping condition or
ordering. Their original bands still challenge every tested candidate.

The search offers the declared A grid values followed by their adjacent midpoints.
For each offered A, it tests the original K grid and considers every adjacent
sampled K interval whose predicted anchor depths lie on opposite sides of an
original anchor level. Levels are its original value, its nonnegative lower band
edge, and its upper band edge; duplicate levels are evaluated once. Each such
sampled crossing is bisected. All evaluations, including rejected intermediates,
remain in the complete candidate report.

A bracket stops at 40 iterations, an unrepresentable midpoint, or anchor-level
residual at most `1e-10 * max(1, levelMm)`. This is a computational stopping rule,
not a physical error bound. Compatibility is always evaluated separately by the
unchanged original-reading screener. It retains the screener's existing numeric
tolerance even for an explicitly zero-width original band; the band itself stays
zero and is never presented as measured certainty inferred by this procedure.

Both stages share at most 600 additional solver evaluations beyond the original
grid. The first stage can consume that whole allowance; in that case the band
stage cannot add more evaluations. The complete grid plus the full allowance is
reserved against three million cell-steps before computation. Reported cell-steps
count actual evaluations, and stopped searches retain their partial candidates.
The table and explanation show how many simplex proposals were retained, how many
new band proposals were tested, and completed versus considered brackets.

## What it does not establish

The method does not assume or establish that a routed depth is globally monotone
in K. It only follows observed sign changes between sampled values. Same-sign
endpoints can hide interior roots, a tangent root may not change sign, and the
finite A samples can miss other families. A completed sampled crossing is not a
certified parameter interval or continuous feasibility proof. No compatible
proposal does not establish that the declared box has no solution. The count of
nearby compatible proposals is not probability or independent evidence. Soil,
terrain, rainfall and numerical assumptions remain unvalidated model inputs.

## Evidence behind the mechanism choice

The authored 2×2 source in the refinement control has K=17.3 mm/h and A=6.2 mm.
Keep its first 17.5-minute depth with ±0.001 mm. Increase its later two reported
depths by 1 mm and give each ±2 mm. The original K/A pair is still inside every
band, but the published RMSE refinement returns no compatible proposal. A
normalized minimax simplex prototype also stops with maximum normalized residual
1.146 rather than finding support. Those failures are retained as evidence for
changing the proposal mechanism; neither is counted as a capability gain.

The combined band-crossing method retains all 173 simplex evaluations, adds 221
trials and finds 47 calibration-compatible proposals in 394 total evaluations.
For separately chosen later offsets +3, +5 and +10 mm, with respective bounds
±4, ±6 and ±11 mm, the combined method retains 96, 95 and 95 compatible proposals.
Every previously compatible proposal on the four uniformly tight refinement
controls remains exactly intact. These are authored software controls, not field
measurements, calibrated soil parameters or environmental prediction accuracy.

Run `node tests/wetting-front-feasibility.test.mjs`. Its controls include retained
old successes, original-input nonmutation, held-aside independence, dry ambiguity,
impossible data, zero-width bands, exact total budget exhaustion and source-only
replay. `tests/wetting-front-feasibility.browser.mjs` exercises the ordinary main
application through both methods, candidate transfer, generated-file reopen,
source invalidation and actual desktop/narrow result screenshots. Run the earlier
refinement browser course as well to check the unchanged existing mode.
