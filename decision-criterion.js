// A criterion concerns the represented proposal-minus-existing delta.
// It is not a measurement tolerance, probability, or universal benefit score.
export function normalizeDecisionCriterion(criterion) {
  if (criterion === undefined) return undefined;
  if (!criterion || typeof criterion !== 'object' || Array.isArray(criterion)) {
    throw Error('Choose an explicit at-most or at-least decision criterion with a finite value');
  }
  const fields = Object.getOwnPropertyDescriptors(criterion);
  const keys = Reflect.ownKeys(fields);
  if (keys.length !== 2 || !keys.includes('operator') || !keys.includes('value') ||
      !Object.hasOwn(fields.operator, 'value') || !Object.hasOwn(fields.value, 'value')) {
    throw Error('Decision criterion requires only operator and value');
  }
  const operator = fields.operator.value, value = fields.value.value;
  if (!['at-most', 'at-least'].includes(operator) || !Number.isFinite(value)) {
    throw Error('Decision criterion needs at-most or at-least and a finite numeric value');
  }
  return {operator, value};
}

function matches(delta, criterion) {
  if (!Number.isFinite(delta)) throw Error('Decision criterion requires a finite modeled change');
  return criterion.operator === 'at-most' ? delta <= criterion.value : delta >= criterion.value;
}

export function meetsDecisionCriterion(delta, criterion) {
  const declared = normalizeDecisionCriterion(criterion);
  if (declared === undefined) throw Error('An explicit decision criterion is required');
  return matches(delta, declared);
}

// Physical effect directions stay distinct from criterion satisfaction.
export function partitionDecisionCandidates(candidates, metric, criterion) {
  const declared = normalizeDecisionCriterion(criterion);
  const lower = candidates.filter(c => c.metrics[metric].delta < -1e-8);
  const higher = candidates.filter(c => c.metrics[metric].delta > 1e-8);
  const neutral = candidates.filter(c => Math.abs(c.metrics[metric].delta) <= 1e-8);
  const accepted = declared === undefined ? null : candidates.map(c => matches(c.metrics[metric].delta, declared));
  const meets = accepted === null ? [] : candidates.filter((_, i) => accepted[i]);
  const misses = accepted === null ? [] : candidates.filter((_, i) => !accepted[i]);
  const opposingPairs = [], pairIndices = [];
  let index = 0;
  for (let a = 0; a < candidates.length; a++) for (let b = a + 1; b < candidates.length; b++, index++) {
    const da = candidates[a].metrics[metric].delta, db = candidates[b].metrics[metric].delta;
    const disagree = accepted === null
      ? (da < -1e-8 && db > 1e-8) || (db < -1e-8 && da > 1e-8)
      : accepted[a] !== accepted[b];
    if (disagree) { opposingPairs.push([a, b]); pairIndices.push(index); }
  }
  return {criterion: declared, lower, higher, neutral, meets, misses, opposingPairs, pairIndices};
}

export function decisionCriterionContext(groups) {
  if (groups.criterion === undefined) return {};
  return {criterion: {...groups.criterion},
    meetsCriterionRatesMmHr: groups.meets.map(c => c.rateMmHr),
    missesCriterionRatesMmHr: groups.misses.map(c => c.rateMmHr)};
}
