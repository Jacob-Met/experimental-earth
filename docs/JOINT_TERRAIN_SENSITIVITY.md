# Two supplied ground intervals, one proposed change

Open **Also vary a second supplied cell** in the existing ground-height panel, enable simultaneous hypotheses and select a second supplied cell. Confirm that the error at each selected cell transfers equally to the proposal. The authored proposal minus existing elevation change is preserved separately at both cells. Choose 3, 5, 9 or 17 samples **per axis**; the instrument evaluates every combination or refuses the whole request if its work exceeds the supported budget.

The two-axis table shows every returned difference for the selected quantity. Row and column headers are offsets in metres from the supplied central elevations. Select a table entry with pointer or keyboard to inspect both cells' actual hypothetical elevations, all four paired quantities, and every cell's final and separate peak depth. Switching the displayed quantity retains the selected combination. The original project remains unchanged; reopening it restores inputs and the default single-cell mode, without a derived matrix.

## Why isolated comparisons cannot answer the combined question

In the authored courtyard, copy existing to proposal and lower B1 by 2.5 cm. Supply ±5 cm intervals at C1 and C2. Seventeen isolated C1 samples give peak-standing-water differences from −2.722455 to −0.433598 L; seventeen isolated C2 samples give −1.532833 to −1.125228 L. All are negative. Yet the simultaneous C1 +5 cm / C2 +5 cm hypothesis gives **+0.569775 L**.

The complete low/central/high family is:

| C1 offset / C2 offset | −0.05 m | 0 m | +0.05 m |
| --- | ---: | ---: | ---: |
| −0.05 m | −2.789480 | −2.722455 | −2.540521 |
| 0 m | −1.199973 | −1.509384 | −1.125228 |
| +0.05 m | −0.964258 | −0.433598 | +0.569775 |

Entries are proposal minus existing peak standing water in litres. This is an executed deterministic model control, not acquired survey evidence or a recommendation. A negative difference means a smaller modeled quantity; maximum quantities can refer to different places or times.

## Admission, custody and limits

Each axis uses the maintained single-cell terrain admission: a positive supplied uncertainty, supported units, compatible original proposal source or unsourced authored edit, explicit transfer confirmation, and existing/proposed endpoints inside −10 to 10 m. The selected cells must differ and declare the same datum and cell spacing. These declarations are necessary inputs, not proof that independent surveys are co-registered. Different declared datums are refused rather than converted or silently treated as equal.

The complete Cartesian work is `2 × sampleCount² × cellCount × ceil(duration / step)` and must not exceed one million cell-steps before any solve. The current courtyard can receive 9×9; its 17×17 request refuses. A smaller request remains an explicit choice, never an automatic substitute. The same storm, default capacities, unselected heights and absolute crests stay fixed. Solver inputs remove the two changed cells' terrain-source tags instead of forging surveyed values. Both untouched original cells and source records remain in the report and project.

Finite samples do not bound the continuous intervals. The supplied uncertainties do not specify probabilities, error correlation, or which combinations are physically jointly possible. The Cartesian family is a set of explicitly declared hypotheses. No observation is fitted or reassigned and no hypothetical terrain is adopted. Changes to sources, selected cells, transfer confirmation, sample count or project inputs clear stale output.

The numerical-reference wet-column proofs cover a flat, uniform, all-wet setting. They do not certify these varied-ground hypotheses. Conservation is an accounting check, not proof of numerical accuracy. Calculation interval and omitted physics remain additional limits.

## Verification entry points

`node tests/terrain-joint-sensitivity.test.mjs` checks the joint-only reversal, every combination against direct maintained runs, central-slice parity with the single-cell API, input-order invariance, preservation of both authored deltas and original sources, units, whole-family budget and admission refusal. The existing single-cell tests remain required after extracting the shared engine.

`CHROME_BIN=/opt/google/chrome/chrome node tests/terrain-joint.receiving.mjs` receives an actual imported project File, keyboard computation and combination selection, complete matrix/local results, quantity selection, desktop/narrow rendering, budget refusal, source/query invalidation, incompatible datums and original input reopening. Actual execution receipts belong with the integrated source; a prepared receiver is not itself a passed browser course.
