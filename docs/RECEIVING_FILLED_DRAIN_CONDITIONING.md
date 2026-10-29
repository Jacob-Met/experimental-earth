# Original drainage for receivers that fill during rain

The existing **Include filled and never-filled alternatives** action can now use an original cumulative-drainage reading to propose receivers that filled by storm end. It keeps every original measurement, uncertainty band and role. Each proposal is checked against the complete original site before held readings challenge it, and the paired-layout consumer carries all calibration-compatible alternatives forward.

This extends [never-filled drainage conditioning](RECEIVING_DRAIN_CONDITIONING.md). It is a bounded conditional model search. It does not identify physical soil properties, certify a continuous parameter region, guarantee a model for every admitted input, or validate the conceptual model on a real site.

## Ordinary investigation

Enter the new reading in the existing receiver account form, including channel, time, total litres, original uncertainty, role and source. Explicitly copy the updated originals into the inference child and run the existing phase-alternative action. The accepted child remains independent of later parent changes.

Candidate details show the conditional full-store drainage rate, modeled fill and surface-dry times, and the computational decay-rate intersection. Original-only downloads reopen by recomputing the model family. A separate explicit assumption transfers that family into both original layouts; offered parameters and held readings do not select the fitted candidates.

The actual browser course reused `fresh-filled-8` after its independent comparison. Before entering its new original drainage reading, three calibration-compatible alternatives failed the later readings. After entry and explicit copying, four alternatives passed calibration and the original held readings. All four reached the paired consumer. Both source files reopened on a fresh page, and repeating Compare preserved the reopened source and options. This is consumer receiving on an authored source, not a physical intervention result.

## Conditional mechanism

Use hours and millimetres over the explicitly selected receiver area. Let `R` be rain intensity, `F = min(R, infiltration)` the available input rate, `T` storm duration, and `H` the original storm-end depth used as a computational anchor. Parameterize the filled course by `q = k C`, its full-store drainage rate. Then:

- Fill time: `tf = (R T - H - q T) / (F - q)`.
- Surface-dry time: `U = T + H / q`.
- Capacity: `C = q / k`.
- Initial storage: `S0 = q/k - (F-q) expm1(k tf)/k`.

The source predicates require a physically admissible filled-by-storm-end course and dry surface by the first retained reading. The full-store-rate interval is bounded by these conditions. At a fixed `q`, original post-dry retained amounts and cumulative drainage are monotone functions of `k` within the physical domain. Every original calibration band intersects that domain using bounded monotone bisection. Drainage at time zero is exactly zero; earlier, filled and post-dry drainage use their corresponding conservation expressions. An incompatible original remains incompatible.

The computational physical bounds preserve `0 <= S0 <= C`, `C <= 10000 mm` and `k <= 100/hour`. The empty boundary yields an explicit zero initial store; the implementation does not clip a negative inferred store into validity. Original uncertainty bands are never widened. Fixing `H` to a central computational anchor and offering finitely many `q/k` points can miss other valid models, including other phase regimes.

Nine fixed `q` points plus one refined point are inspected. The refinement covers eight adjacent intervals, with 48 golden-section updates in each: 409 complete rate assessments including their initial evaluations. Each fixed point offers at most one interior decay-rate witness; the selected refined point offers three interior witnesses. The maximum is 12 added models. Selection uses original calibration constraints only. There is no global-optimum or exhaustive-coverage claim.

## Frozen independent comparison

The numerical method and nine dependency hashes were frozen before the root contributor received the independent tuple values. SECOND authored and truth-checked 12 tuples without reading or running the inverse. The exact original rule, tuples, validator and release-compatible method freeze are retained in `experiments/filled-independent-*`.

All 12 originals remain recorded. Seven met the predeclared original-source conditions; five remain excluded with their original reasons. Four have a wet late surface, and one exceeds the unchanged forward admission bounds. The invalid duration was not shortened to make that case eligible. Two wet cases also lack a strictly decreasing positive inventory. Phase names based on retained truth snapshots are descriptive and do not prove absence of an unobserved transient fill.

| Same seven eligible original courses | Qualified predecessor | Frozen filled extension |
| --- | ---: | ---: |
| At least one full-site calibration witness | 6/7 | 7/7 |
| At least one such witness also passes the original later readings | 6/7 | 7/7 |
| Resource/admission refusals within that eligible set | 0 | 0 |

`fresh-filled-8` supplies the advance: zero supported predecessor models becomes four calibration-and-held-compatible models. The other six retain their support. These are witness-coverage counts, not selected-predictor accuracy or confidence intervals. Every eligible case counts, and held values never rank, fit or choose candidates.

The diagnostic Node run took 640.33 ms for the predecessor and 634.66 ms for the extension across the seven cases. This single ordered run is not a speed claim. The largest complete inference reservation was 454391 of the unchanged 1000000 cell-equivalent-step limit. Already-consumed difficult paired courses reserved 594486 and 986022, retaining every supported model and all six runs per model.

## Verification and informative failures

The final relevant native suite passed 51 tests: 46 named behavioral groups and five receipt-writing checks. An independent conservative Euler integration at two step sizes supplies eight filled-course controls. It advances surface, retained and drained water directly, covers drainage before/during/after filling, and checks step refinement before comparing the unchanged maintained forward model. Other controls cover contradictory originals, impossible time-zero drainage, held-role injection, full-grid corruption, source-only replay and refusal before every producer.

The actual current-main browser passed 22 groups with the full Chromium sandbox active, no browser exceptions or local resource failures, and confirmed server shutdown. The 16 incoming spatial-sky files are retained independently of the receiver changes. Browser evidence includes ordinary field entry, explicit source handoff, all-model paired consequences, fresh source-only reopen, unchanged held-independent parameters/question, contradiction refusal and stale-result clearing after complete work refusal.

Earlier failures remain evidence:

- Offering three, then two decay-rate witnesses at every fixed full-store rate exceeded the actual combined paired-consumer budget. The final bounded family reduces proposal work; it does not raise the cap or omit supported models after fitting.
- The first rate score discarded original bounds outside the physical decay domain. This created a false minimum despite a feasible original course. The corrected score retains the domain violation, with a separate positive-violation refusal.
- An independent native fixture initially omitted required source metadata; its metadata was corrected without changing numeric observations or bands.
- Two browser-test failures concerned the workload control: first the enlarged course still fit the cap, then the corrected input refused at the earlier incumbent gate. Both complete failure receipts and exact prior harnesses are retained. Only the test input/message expectation changed.

Previously consumed comparisons remain labeled development: the original 16-course family advances from14/16 to16/16, and the earlier seven-course family advances from5/7 to7/7. They are not substituted for the fresh comparison. The measured C1 tail mismatch remains in its separate record; this extension does not turn that failure into physical validation.

## Reproduce

Run the maintained native tests from the repository root:

```sh
node --test --test-reporter=tap --test-concurrency=2 tests/receiving-account-band-fit.test.mjs tests/receiving-retained-starts.test.mjs tests/receiving-account-consequences.test.mjs tests/receiving-account-phase-fit.test.mjs tests/receiving-drain-conditioning.test.mjs tests/receiving-filled-drain.test.mjs
node experiments/compare-independent-filled.mjs
```

The comparison checks the frozen source and original hashes before invoking either method, preserves all five exclusions, and writes complete per-case results. `tests/receiving-drain-predecessor.mjs` loads the exact qualified predecessor bytes with hash checks; it changes only import locations. Browser instructions and environment variables follow the existing `tests/receiving-account-band-fit.receiving.mjs` harness. Use its supported sandbox path; an unsandboxed launch is not the recorded proof.
