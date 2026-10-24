# Joint soil and outlet evidence

A collected volume can fit more than one combination of infiltration and outlet loss. This workbench compares a finite set of explicit pairs against the original collected volumes and selected ponding depths from the same event. It exposes ambiguity and contradictions without adopting a parameter value.

## Use the comparison

1. Retain a sourced collection in the collected-runoff panel. Its coverage must describe all boundary exits represented by this model. Record original quantities, units, intervals and evidence roles.
2. In **Could different soil and outlet conditions explain the same water?**, choose the surface whose infiltration varies. Enter 2–12 distinct pairs, one per line: infiltration in mm/h, then the outlet coefficient per hour.
3. Select any assigned notebook depths from the same observed scenario. Supply the source for their common event and minute-zero origin. No depth joins the comparison merely because it is in the notebook.
4. Save the pair set and association, then compare. Editing a draft retires the displayed result until the inputs are saved. The original site, weather, readings and active model parameters remain unchanged.
5. Use ordinary project export/import or reload to retain the association. Reopening recomputes the comparison; saved conclusions are not used as evidence.

Calibration compatibility means that a pair satisfies every assigned calibration band. Held-aside evidence can contradict a compatible pair; it never orders or chooses the alternatives. Pairs remain in declared order. A missing depth or volume group is unscored, rather than a zero error. Depth errors stay in millimetres and volume errors in litres; they are never added into a mixed-unit score.

The prediction plane shows a selected collection horizontally and a selected depth vertically. Dashed lines bound each supplied ± tolerance; zero tolerance is one line. Numbered points match the table. The plane displays two readings, while the full comparison uses all assigned readings. Expand each pair to inspect every prediction, signed residual, source and interpolation bracket. Small screens retain readable controls and scroll the evidence table within its own region.

## An inspectable ambiguity control

Open [the authored example](../examples/joint-evidence-ambiguity.json). It is an analytic control, not a field dataset: a flat 2×2 sealed grid with 1 m² cells, rain at 61 mm/h for 60 minutes, a 30-minute model step and no neighbor transfer. Enter these pairs:

```text
1, 0.1
21, 0.13333333333333333
```

Both predict 16 L collected during minutes 0–30. The supplied calibration record stores that quantity as 16,000 mL. With no associated depth, the volume cannot distinguish the two explanations. Their predicted depths at minute 30 are 26 mm and 16 mm. Explicitly associating the authored 26 mm held-aside depth contradicts the second pair while leaving the first compatible. A second collection over minutes 30–60 would differ too: 26.4 L versus approximately 24.5333 L. These independently calculated values exercise the maintained solver; they do not establish a unique physical explanation.

## Source identity and computation

`jointEvidenceStudy` stores the observed scenario, surface, explicit pairs, collection-event identity, selected depth indices and complete canonical depth snapshots, plus the user's event-association statement. Collection identity includes its event reference, source, coverage, site/weather context and duration. A changed site, storm or collection identity refuses comparison. A changed or moved selected depth refuses until the user explicitly associates it again. Appending an unselected depth does not silently add evidence. Collection readings remain live inside their already scoped record.

Each pair runs the existing `runRain` solver once with a surface infiltration override and an explicit outlet coefficient. Depth prediction reuses `interpolateDepth`; volume prediction reuses the difference of interpolated cumulative boundary losses through `predictCollectedVolume`. The result discloses the current numerical step. Changing the step permits a fresh numerical comparison; it does not change the supplied quantities. An estimated grid-cells × time-steps × pair-count budget above two million refuses before running simulations.

There are explicit outcomes for absent surfaces, changed sources, no calibration, rejected calibration, rejected held-aside evidence, ambiguity and the work limit. Invalid pair or association edits preserve the last accepted project.

## Meaning and limits

Event association and independence are supplied declarations. The application cannot verify acquisition, detect correlated readings or prove that a held-aside measurement was unseen. Changing the pair set after inspecting held-aside results makes those results part of fitting. An all-boundary collection must actually cover the modeled exits; a partial drain collection is not equivalent.

The underlying rain, infiltration and boundary-loss model is simplified. The finite candidate set, time step and interpolation affect the conclusions. Passing every supplied band does not prove physical uniqueness, environmental accuracy, predictive skill on another event or suitability for engineering decisions.

## Verification

Run `node --test tests/*.test.mjs` for native checks. The dedicated joint tests include the independent equal-volume control, native-unit band intersection, missing evidence, role separation, source retirement, exact project roundtrip, duration consistency and bounded work. The maintained `tests/browser.receiving.mjs` course exercises real pair entry, association refusal, export/reopen, stale sources, the prediction plane and actual narrow-screen layout with Chromium sandbox admission.
