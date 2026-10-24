# Faster wetting-front inversion

The soil model previously solved every ponded segment with up to 64 bisections. The replacement retains its cancellation-aware integrated-time expression and monotone physical bracket, and uses safeguarded Newton steps inside that bracket. An out-of-bracket/nonfinite step falls back to bisection. Relative integrated-time residual at most eight machine epsilons terminates the iteration; the 64-step fallback remains. Finite-rain onset, depleted/reforming-pool phases and accepted absorption/custody are unchanged. This improves computation, not physical accuracy or field qualification.

## Numerical and consumer evidence

- 20,000 changed-input local phase cases: maximum original/candidate absolute result delta 2.73e-12 mm; 9 original high-precision references pass.
- 160 independent 100-digit Decimal roots: maximum relative error 1.007e-14. Independent root reviewer additionally used a 400-digit doubling-bracket oracle on 7 adversarial cases, including prior infiltration 1e9 mm and demand 1e-280; maximum relative error 8.84e-17. The reviewer accepted the mathematical mechanism.
- The 15 existing soil test groups pass on the candidate. Two added groups retain 12 difficult high-precision roots and finite/monotone/supply-bounded behavior across 144 very small/large parameter-duration combinations.
- Four actual `compareWettingFront` performance layouts have matching nested structure/status and numerical values within the declared 1e-8 relative/absolute comparator; maximum observed delta 2.10e-12. Seven alternating warm measurements per variant/layout yield median milliseconds 35.08 → 24.94, 112.95 → 66.37, 22.45 → 22.03 and 16.41 → 10.29. The third layout is retained as negligible benefit.
- A separate 12-case authored observation/question course covers equal final-depth K 10/A 20 and K 24.595279111565403/A 0, declared question precision 1/1.1/touching bands, and held-aside 30-minute readings around band edges. Calibration ordering, compatible/surviving IDs, challenge status, selected reading and band separation agree; max numeric delta 2.84e-14. This is tested semantic parity, not bitwise equality or a universal boundary guarantee.
- Six alternating fresh Node-process runs per variant, each executing ten real studies: median whole wall 1174.96 → 748.04 ms and CPU 1463.90 → 1014.26 ms. Retained final RSS 125.92 → 126.61 MB is a small non-win; it is not peak RSS.

These measurements use Linux/Python 3.12.14/Node 24.19.0 and a captured source snapshot identified in `source-pins.json`, including then-working reading-question modules. They are not relabeled as an earlier exact main commit. Native-owner receiving against current maintained source is recorded in the PR. Original and candidate code remain recoverable through version history. Timing/JIT effects and authored geometry limits remain explicit.

## Optimizer integration

The reusable concrete experiment stays in the natural research home: [TOGISHI soil example](https://github.com/Jacob-Met/hamon-memory-research/blob/unified-togishi-engine/togishi-engine/examples/earth_wetting_front_optimizer.py) and [bundle guide](https://github.com/Jacob-Met/hamon-memory-research/blob/unified-togishi-engine/togishi-engine/examples/earth_wetting_front/README.md). Its source pin is included in that contribution's evidence; no second optimizer or native consumer copy is introduced here.

Actual maintained staged Engine/Journal/EvaluationBudget receiving executed the incumbent, this candidate and an intentionally wrong faster constant-capacity kernel. The wrong-fast result was vetoed; the qualified alternative was selected. Final exact example source ran normally and with optimized Python; journal reopen reused explicitly pinned observations and executed no new Node process. Source merge, installed deployment and automatic law-kernel graduation remain separate. No deployment or cloud/field benefit is claimed by this source optimization.

## Exact maintained source receiving

The final receiving uses immutable source at `387a4619f198b1f6d35a4b47085825d72388fc87`, with original kernel Git blob `c04d2da604713870b1fcedf080d2b5d7c1b6cbc3` / SHA256 `6d0d451a4a35a0997bc8432160324e7c4d0b8ec8dd844349741d545ba9419633`, against candidate SHA256 `8bc57f051eb7c505aa569e05abd78c1b81d4acca689a9e5dffd8a57c61186694`. The 12 semantic cases pass unchanged; actual Engine selection, wrong-fast veto and zero-execution reopen pass normally and with optimized Python. `MAINTAINED_387_RECEIPT.json` retains each run's own timing. The normal maintained run measured 11.97% discovery improvement; earlier captured-snapshot timing is not relabeled as this run.

A first receiving attempt accidentally copied an already-staged candidate as both alternatives from a mutable handoff directory. That same-source comparison is explicitly unqualified and retained in research evidence; its CLI report failed on the absent distinct candidate. The corrected example refuses duplicate source alternatives before native execution, and the final receiving uses the verified immutable baseline. The numerical kernel did not change.
