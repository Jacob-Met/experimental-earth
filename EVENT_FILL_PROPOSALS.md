# Analytic receiver-fill proposals in an explicit research model

`uniform-source-finite-event-fill/research2` is an optional model. The maintained default and `uniform-source-finite-event-midpoint/research1` remain unchanged. Source calibration, hypothetical layouts and fixed-support refinement all use the selected model; raw investigations retain that version and adoption records it.

The only numerical change from research1 is a timestep proposal for a receiver below capacity. For current uptake q, drainage d, capacity C and storage S, when q > dC the constant-uptake fill time is log1p(d(C-S)/(q-dC))/d. The implementation uses a ratio form with the d=0 limit to avoid division by zero and small-argument cancellation. This replaces the former linear two-times-gap proposal. The existing midpoint stages, root fallback, final conservative allocation and work limits remain. Since uptake can change with graph state, the proposal is not an exact coupled event time. Nonfinite/unrepresentable proposals can fall back to the existing controls.

## Actual calibration benefit

An authored 2×2 isolated control has rainfall6mm/hour, receiving capacity1mm, drainage2/hour and no transport. Its independently calculated fill time is log(1.5)/2 hours, followed by surface accumulation4mm/hour. At60minutes its depth is4(1-fillTime). With declared infiltration rates[1,4,8] and authored uncertainty1e-6mm, research1 rejects all rates at30/15/5-minute steps; the new model retains8 and completes all9 mixed layouts at each step. Both retain8 at1minute. Candidate work is1416/1416/3720/17544 respectively. Raw reopen, held-aside challenge isolation and frozen-support refinement are tested. The tiny uncertainty is an analytic software control, not a claim about attainable field measurements.

## Limits and counterevidence

Of648 independently compared isolated finite-node cases,647 completed and one retained an unrepresentable-event refusal. Maximum accepted error fell from0.007413mm to floating roundoff. Four analytic,40 closed-linear,24 held finite and12 pulse courses remain qualified within their stated scope.

The complete19-layout courtyard still has timestep-dependent near-tie scores. At5/2.5/2/1minutes candidate work is1009162/1484714/1507660/2484636; prior event work was1035496/1331330/1632092/2494954. Thus cost does not improve uniformly. Nearly unchanged selected scores do not establish convergence or validated optimality. Larger exponential-stage variants were rejected: they increased work and caused a1minute3M refusal despite isolated-node accuracy. This narrower option does not imply a general nonlinear accuracy or stability theorem.

Run `node tests/event-fill-calibration.test.mjs` and the maintained mixed-placement browser receiver with sandboxed Chromium. Existing event tolerance, approximate roots, residue handling, exposure snapshots and bounded-refusal qualifications continue to apply.
