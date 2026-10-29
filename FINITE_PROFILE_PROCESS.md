# Explicit finite timed-arrival process

`uniform-source-finite-profile/1` extends the optional timed-arrival research process with one explicitly declared receiving layer. The maintained model and the original `uniform-source-profile/1` remain unchanged. The receiving-hypothesis inference family is separate and is refused by this option.

At a node, surface water H receives a constant incoming rate over each upstream profile interval. Uptake q has priority when H=0. Receiving storage obeys S'=q-dS with 0<=S<=C; at S=C, uptake cannot exceed dC. Requested outgoing flow competes with uptake while wet and receives only remaining supply while dry. The implementation advances to actual surface-empty or store-full events before changing regimes, uses expm1/log1p forms for small drainage, and returns the outgoing time profile. Absorbed water is an internal transfer into the receiver; drained water is an external sink. Surface and receiving ledgers are checked separately. Positive event times that cannot be represented, nonfinite state and more than16 node events refuse; no partial result is returned.

This solves constant-node subproblems under piecewise incoming profiles and frozen graph heads/request shares. It does not establish exact graph dynamics, validated wetting-front propagation, physical field accuracy or timestep convergence. Crests remain unsupported. Exposure still uses outer-step snapshots. Extreme finite declarations may produce a bounded numerical refusal rather than a representable answer.

## Actual planning consumer

The mixed panel exposes the distinct version and explicit surface, total capacity, initial stored water, drainage coefficient and source fields. Blank numeric fields refuse; explicit zero is retained. Changing the receiving surface clears attributed parameters. Raw save/reopen retains every declaration and recomputes results. Original evidence support and every hypothetical layout use the same finite model and layer; private signatures bind model, source, layer and offered costs through adoption. Original proposal observations still prevent replacing that observed geometry. Held-aside challenge readings cannot refit calibration support. Finite-event work is charged to the same cumulative3M budget, including finer comparisons.

## Qualification

Native checks include five independent analytic empty/full/drainage cases,12 constant-forcing subdivision comparisons, six capacity-limited pulse/mirror cases, graph edge-order and malformed/work/overflow refusals. A binding .2mm receiver with .1mm initial water and .7/hour drainage receives original model-generated calibration at rate1, all nine mixed layouts match direct model executions, and raw/adoption/model/layer custody controls pass. Maintained14 and previous profile5 native groups also pass.

Actual sandboxed Chrome receives the complete maintained and optional process flows, including the nine-rate work refusal without a partial table. The finite path displays/reopens the attributed layer, refuses blank capacity, recomputes all nine layouts after download/reload, and persists the chosen finite model in adoption provenance.

A separately retained19-layout authored courtyard course compares a fixed rate1 at5/2.5/2/1minute intervals. A nonbinding capacity3mm control reproduces the prior profile process, including its coarse winner reversal. A binding capacity.2mm course retains one winner but its margin shrinks .20147/.10905/.10772/.08072L; one-minute work is2,589,812. This is conditional numerical sensitivity, not convergence or validated optimality.

Run `node tests/finite-node.test.mjs`, `node tests/finite-graph.test.mjs`, `node tests/finite-profile.test.mjs`, plus the maintained mixed/profile suites. The existing browser command in PROFILE_PROCESS.md now includes the finite courses.
