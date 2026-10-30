# Stable finite-receiver capacity and storage arithmetic

Both optional event models retain their versions, physical process, time updates, event eligibility, work bounds and default selection. This fix replaces two algebraically equivalent expressions used after an accepted step.

With receiving capacity C, current storage S, decay z=d*dt and phi=(1-exp(-z))/z, available uptake was `(C-S*exp(-z))/phi`. For a full receiver and a tiny positive interval, exp can round to1 and the subtraction becomes zero, even though drainage releases positive capacity. A tiny surface residue then remains unchanged until the4096-iteration refusal.

The numerator is now `(C-S)+S*(-expm1(-z))`. Its terms are nonnegative under the admitted declarations and it retains small released capacity. Near full storage, reconstruction uses `C-(capacity-uptake)*phi`; near empty storage it retains `retained+uptake*phi`. The exact uptake==capacity branch still produces C. This complementary reconstruction prevents inconsistent rounding aboveC after the capacity change. No state clipping or positive-depth tolerance is introduced. Extreme nonfinite/state/ledger refusals remain.

## Receiving and limits

The frozen1296-case rainfall/storage course had39 step-bound refusals before this fix and none after the paired fix. The capacity-only attempt introduced invalid-state refusals and is retained as rejected evidence. Compensated-clock variants recovered an isolated event but worsened courtyard work; they are not included.

A concrete actual mixed-calibration case uses rainfall6mm/hour for30minutes, duration90minutes,5-minute steps, no transport, capacity1mm, initial storage0 and drainage2/hour. Its independently calculated30-minute surface depth is1.5mm for infiltration3mm/hour, before the receiver fills. Both event versions now retain that original rate and receive all9 layouts; the prior consumer throws a step-bound error later in the simulation. Raw reopen, challenge isolation, half-step fixed support and adoption are checked. The1e-8mm observation uncertainty is authored software evidence, not field precision.

Thirty-six tiny/full-storage controls and six refusal controls pass. Existing analytic, closed-linear, held finite, pulse and model-consumer courses remain qualified. Complete19-layout courtyard work at5/2.5/2/1minutes is997304/1363670/1564332/2481864; costs are not uniformly better. Near-tie timestep dependence remains. No universal runtime, accuracy, convergence or no-refusal claim follows.

Run `node tests/event-stable-capacity.test.mjs`, `node tests/event-capacity-consumer.test.mjs`, existing event tests and the sandboxed mixed-placement browser receiver.
