# Does the inferred soil grid depend on the calculation interval?

After a finite soil-parameter search, choose **Check finer calculation intervals**.
The consumer repeats the same original K/A grid at the saved hydraulic step,
half that step and one quarter, floored at the existing one-minute minimum.
Duplicate intervals run once. It changes no rainfall, terrain, observation,
parameter axis or original saved project value.

Every grid pair remains present at every step, even if it was rejected at the
original interval. Each calculation orders candidates by calibration error only.
The summary displays the calibration-compatible pairs at every interval. Expand
the detailed ledger to inspect each original calibration and held-aside reading,
prediction, signed residual, band classification and interpolation bracket.
Held-aside values cannot change calibration compatibility or the closest set.

The diagnostic reports changes in compatibility sets, the tolerance-aware closest
set or individual reading-band classifications. Unchanged decisions may accompany
changed predictions. This finite calculation-interval check does not establish
convergence, an error bound, a continuous inverse solution or field accuracy.
Original source assumptions and grid truncation remain material limitations.

All finer requests are admitted before solving: the complete course is limited
to two million estimated cell-steps, and every individual search retains its
one-million limit. Refusal produces no partial comparison. At the one-minute
minimum the consumer explains that no finer supported interval is available.

The normal search download still contains original project and query only. A
reopened search can run this diagnostic against its own original source without
replacing the active site. Search edits or workspace changes retire the entire
derived result. No finer time step or fitted soil pair is automatically adopted.

## Executed authored distinction

The authored courtyard example at cell 37, minute 120 has a one-minute model
reference depth of 27.128813082303168 mm for K=10 mm/h and A=20 mm. Assigning a
±0.1 mm calibration band to that authored value and testing the grid
K={5,10,15}, A={0,20,40} gives no compatible pairs at 5 and 2.5 minutes, but
retains K=10/A=20 at 1.25 minutes. The associated residuals are approximately
0.54017, 0.20078 and 0.03254 mm. This is a computational sensitivity control,
not a physical observation or qualification of the one-minute solution.

An independent closed flat column with constant infiltration K=20, rain 30 mm/h
and no routing has depth (30−20)×37/60 mm at minute 37. The maintained solver and
its off-step interpolation agree with that analytic formula across 7, 3.5 and 1.75
minute calculations. Separate tests retain dry nonidentifiability, source/grid
identity, held-aside independence, distinct minimum steps and the case where the
aggregate budget fits but one finer run exceeds its own limit.

Run `node tests/wetting-front-search-resolution.test.mjs` for the seven native
groups. `node tests/wetting-front-search-resolution.browser.mjs` receives visible
keyboard execution, the actual reversal, changed-weather invalidation,
original-input download/reopen, narrow layout and settled screenshots through
the maintained sandboxed browser owner. Authored browser code is not a claim of
executed browser qualification; exact receiving belongs with the integration PR.
