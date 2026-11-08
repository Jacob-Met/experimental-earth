# Ask a measurement question about a declared outcome target

The decision-question, measurement-comparison and paired-depth planners can use an optional `criterion` to distinguish finite hypotheses that disagree about a stated outcome target. Omitting it retains the existing strict sign-reversal behavior. This feature does not change the physical kernel or establish field validity.

## Signed outcome and inclusive comparison

For the selected metric, `delta = proposal - existing`. Declare one of:

```js
{ metric: 'storedLiters', criterion: { operator: 'at-most', value: -128 } }
{ metric: 'storedLiters', criterion: { operator: 'at-least', value: 128 } }
```

The first means a reduction of **at least 128 liters**. The second means an increase of **at least 128 liters**. Values use the selected metric's units: liters for exit, peak ponding and stored water; millimeters for maximum depth. Choose the outcome and direction deliberately: meeting a target is not synonymous with improving every outcome, and missing it is not synonymous with causing harm.

`at-most` uses inclusive `delta <= value`; `at-least` uses inclusive `delta >= value` on the represented numerical result. Equality meets the criterion. There is no hidden criterion epsilon or target discount. These comparisons do not remove floating-point or time-discretization uncertainty in the modeled deltas. Existing numerical guards for measurement-band separation remain separate from criterion classification.

The criterion value must be finite, and the operator must be supported. `null`, unknown operators and nonfinite values refuse. Only `undefined` preserves omitted-option legacy behavior. An explicit zero criterion is inclusive and can therefore differ from the old strict positive/negative classification around zero.

## Why this changes which measurement is useful

Consider an **authored model example**, not a field observation: a flat 2×2 grid of four 2 m × 2 m cells (16 m² total), existing turf and proposed garden, 30 mm/h rainfall for 60 minutes, a 60-minute modeled event, 30-minute solver steps, and zero lateral mobility and boundary outflow. Offer existing-turf infiltration rates of 10 and 20 mm/h; the unchanged garden default is 24 mm/h. A minute-zero dry calibration reading admits both offered rates without distinguishing them.

The modeled final depths are 20 or 10 mm for existing turf and 6 mm for proposed garden. Since 1 mm over 1 m² is 1 liter, existing volumes are 320 or 160 liters and proposed volume is 96 liters. The proposal-minus-existing deltas are therefore **−224 and −64 liters**. Both are reductions, so the legacy planner has no opposite-sign pair. With a required reduction of 128 liters (`at-most: -128`), the 10 mm/h alternative meets the criterion and the 20 mm/h alternative misses it. Their existing-site depth predictions at 60 minutes differ by 10 mm; under a declared ±2 mm prospective tolerance those two bands are disjoint. This is a conditional model calculation, not evidence that either infiltration rate describes a real site.

Conversely, two worlds can have opposite-sign effects yet both miss a demanding reduction target. Separating those worlds is not automatically useful for deciding whether that particular target is met.

Output shapes differ between the three consumers:

- `chooseDecisionQuestion` retains physical `lowerRatesMmHr`, `higherRatesMmHr` and `neutralRatesMmHr` cohorts. Classified custom results add `criterion`, `meetsCriterionRatesMmHr` and `missesCriterionRatesMmHr`; each returned prospective prediction adds `meetsCriterion`.
- `compareDecisionObservations` retains that complete depth result in `depth`. Its custom collection predictions also carry `meetsCriterion`, separately from their physical `direction`. The top-level result exposes the criterion and copies goal cohorts when the depth result has classified candidates.
- `planDecisionDepths` retains complete `candidates`, including their original metric deltas, and adds criterion/goal cohorts after candidate classification. Its questions carry `depthsMm` aligned with those candidates; they do **not** each have a `meetsCriterion` prediction field or the single-depth physical-cohort fields.

Early results such as `need-calibration` can precede classification and omit cohorts. With classified candidates but no cross-criterion pairs, all three consumers return `no-decision-disagreement`, with `criterionAgreement` distinguishing `all-meet` from `all-miss`. That status describes agreement among offered hypotheses; it is not a recommendation to adopt or abandon the proposal.

## API use

For the example above, construct an ordinary project using maintained defaults for unrelated fields, then explicitly supply the authored conditions:

```js
import { makeExample } from './core.js';
import { chooseDecisionQuestion } from './decision-question.js';
import { compareDecisionObservations } from './decision-observation.js';
import {
  planDecisionDepths, exportDecisionDepthPlan, reopenDecisionDepthPlan,
} from './decision-depth-pair.js';

const project = makeExample();
project.width = project.height = 2;
project.selectedIndex = 0;
project.existing = Array.from({length: 4}, () => ({
  elevationM: 0, surface: 'turf', provenance: 'authored flat example',
}));
project.proposal = project.existing.map(cell => ({...cell, surface: 'garden'}));
Object.assign(project.weather, {
  cellSizeM: 2, rainMmHr: 30, stormMinutes: 60, durationMinutes: 60,
  stepMinutes: 30, mobilityPerHour: 0, boundaryExitPerHour: 0,
});
project.infiltrationStudy = {
  target: 'existing', surface: 'turf', ratesMmHr: [10, 20],
};
project.observations = [{
  cellIndex: 0, minute: 0, depthMm: 0, uncertaintyMm: 0,
  source: 'authored uninformative calibration',
  scenario: 'existing', use: 'calibration',
}];

const options = {
  metric: 'storedLiters', uncertaintyMm: 2,
  criterion: {operator: 'at-most', value: -128},
};
const depth = chooseDecisionQuestion(project, options);
const modalities = compareDecisionObservations(project, {
  metric: options.metric, criterion: options.criterion,
  depthToleranceMm: 2, collectionEnabled: false,
});
const pair = planDecisionDepths(project, options);

// At least -128 means a reduction of no more than 128 L (or an increase).
// For these two offered alternatives, it reverses which one meets the rule.
const reverseBoundary = chooseDecisionQuestion(project, {
  ...options, criterion: {operator: 'at-least', value: -128},
});
// Explicit inclusive zero means no increase, including exact equality.
const noIncrease = chooseDecisionQuestion(project, {
  ...options, criterion: {operator: 'at-most', value: 0},
});
const saved = exportDecisionDepthPlan(project, options); // version 2
const reopened = reopenDecisionDepthPlan(saved);       // recomputes report
```

The source imports above are relative to the repository root. `depthToleranceMm` is the modality-comparison option; `uncertaintyMm` is used by the single/pair planners. Their existing admission differs: modality comparison requires a positive tolerance, while single/pair planners permit zero. Omit `criterion` to use the legacy rule; do not substitute `null` or explicit zero for omission.

## Evidence and measurement limits

The criterion does not select or discard calibration hypotheses. The maintained calibration evidence determines the offered alternatives. Held-aside observation values do not select the next question; recorded locations and collection intervals still exclude reuse. Work bounds, offered acquisition limits and prospective measurement tolerances remain applicable.

The planners compare declared finite alternatives and their modeled measurement bands. They do not assign probabilities, estimate expected information gain or price acquisition costs. A predicted distinguishing reading is not a guarantee that a real measurement identifies the true physical explanation or resolves the decision. Unoffered parameters and other outcomes remain outside this particular comparison. No new physical validation follows from the criterion or its tests.

## Export and reopen

An investigation without a criterion keeps `experimental-earth-decision-depth-pair/1`. An explicit criterion exports `experimental-earth-decision-depth-pair/2`, preserving that declaration with the original project and planning options. Reopening v2 requires a valid criterion and recomputes the report. Reopening v1 with a criterion refuses rather than silently changing the meaning of a legacy investigation. Stored report claims are not substitutes for recomputation.

The guide describes source contracts and a declared illustrative model case. Test receipts, runtime qualification and actual browser receiving are separate evidence; none establishes field validity.
