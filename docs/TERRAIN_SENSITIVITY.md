# A supplied ground interval and a proposed change

The **Could an uncertain ground height change the proposal's effect?** panel connects imported survey provenance to a paired rain experiment. Import a complete elevation table through the existing terrain instrument, or reopen a project retaining those sources. Select one sourced existing-site cell and explicitly confirm the assumption that its height error transfers equally to the proposal. The proposed minus existing height change therefore stays fixed.

By default, the instrument evaluates the supplied low, central and high elevations in both plans under identical weather and default material capacities. An explicit sample-count selector also offers 5, 9 or 17 equally spaced elevations, including the original three. More samples can reveal an interior reversal; they still do not bound the full interval. All other ground heights, surfaces and absolute internal crests remain fixed. Inspect each pair's original/proposed quantities, signed differences and every cell's final and separate peak depths. No displayed hypothesis is adopted; project export retains the original inputs, and reopening clears the derived report before recomputation.

## What the experiment establishes

Three samples can reveal a reversal that a central-elevation calculation hides. In the authored courtyard, copy existing to proposal and lower B1 by 2.5 cm. With an authored B1 interval of ±5 cm, proposal minus existing peak standing water is approximately **+0.939696, −1.509384 and −3.424701 L** at the low, central and high samples. The central comparison's sign does not hold at the low sample. This is a deterministic control of the maintained model, not a field survey or intervention result.

A separate executed control illustrates the sampling limit: keep that B1 lowering but put the ±5 cm interval at A1. Low/central/high peak-standing-water effects are −6.129196, −1.509384 and −3.312427 L; the interior +2.5 cm perturbation gives **+0.098758 L**. Even three negative samples can miss a positive interior effect.

In single-cell mode these are three evaluations, **not extrema over the continuous interval**. A consistent direction at all three can reverse between them. In this mode other cells' errors and spatially correlated survey errors are excluded; supplied uncertainty does not define a probability distribution. The numerical interval and conceptual physics remain additional uncertainties. A negative difference denotes a smaller modeled quantity, not an overall recommendation. The maximum depths compared may occur at different places or times.

## Custody and admission

The existing source must contain a valid, positive elevation uncertainty. An unchanged copy of that exact origin in the proposal is allowed. A different or separately surveyed proposal elevation is refused: it cannot silently inherit the existing source's error. An unsourced proposal edit uses the person's explicit fixed-height-change assumption; this does not establish its physical applicability.

Derived solver inputs remove the selected cell's original terrain-origin field instead of forging new surveyed values. The original source and original existing/proposed cells remain intact in the report and saved project. Observations are not used to select heights, fitted, or attached to derived worlds. Other source records remain unchanged.

The complete work estimate (two solves per requested sample) is checked against one million cell-steps before calculation; a larger requested count can refuse even when the three-sample course fits. Every low/high existing and proposed elevation must remain inside the solver's −10 to 10 m range; intervals are refused rather than clipped. Zero or missing uncertainty, missing source and incompatible proposal sources receive explicit explanations. The panel renders source strings as literal text. A changed source/project or transfer declaration clears derived results.

## Verification

`node tests/terrain-sensitivity.test.mjs` exercises the sign-changing control, direct maintained-solver comparisons for every metric and local depth, conservation, exact source immutability, invariant intervention delta, same-plan parity, units, proposal/source admission and whole-experiment capacity refusal.

`CHROME_BIN=/opt/google/chrome/chrome node tests/terrain-sensitivity.receiving.mjs` receives an actual project File through the normal importer. It checks literal provenance, the explicit transfer gate, keyboard computation, all three cases, source immutability, desktop/narrow inspection, invalidation, original-project reopening and separate-source refusal through the maintained sandbox admission gate. Running a script is distinct from scientific validation; receipts must record the actual source and execution environment.

## Simultaneous two-cell hypotheses

The same panel now offers an explicit second supplied cell. Its complete two-axis table preserves both authored height changes and exposes combined effects that isolated comparisons can miss. See [Two supplied ground intervals](JOINT_TERRAIN_SENSITIVITY.md) for the executed joint reversal, admission, custody and finite-sampling limits. The default remains the single-cell instrument described above.
