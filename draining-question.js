import {planComplementaryDepths} from './complementary-depth-plan.js';

/** A prospective calibration-only check, using the existing complete finite planner.
 * Original observed values are never replaced; recorded coordinates are not proposed again. */
export function chooseDrainingQuestion(runs, halfWidthMm, recorded = []) {
  const ids = runs.map(run => run.id);
  let plan;
  try {
    plan = planComplementaryDepths(runs.map(run => run.result), {
      uncertaintyMm: halfWidthMm, maxReadings: 1, recorded,
    });
  } catch (error) {
    return {status: 'unsupported', ids, halfWidthMm, reason: error.message};
  }
  const first = plan.questions[0];
  const named = pairs => pairs.map(({first, second}) => [ids[first], ids[second]]);
  return {
    status: plan.status === 'planned' ? 'question' :
      plan.status === 'insufficient-alternatives' ? 'no-supported-pair' : 'no-separation',
    ids, halfWidthMm, plan, pairCount: plan.pairs.length,
    question: first ? {
      cellIndex: first.cellIndex, minute: first.minute,
      predictions: first.depthsMm.map((depthMm, index) => ({id: ids[index], depthMm})),
      separatedPairs: named(first.separated.map(index => plan.pairs[index])),
      unresolvedPairs: named(plan.unresolvedPairs),
    } : null,
  };
}
