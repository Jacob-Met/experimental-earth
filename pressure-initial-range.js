import { normalizePressureBatchStudy, preparePressureBatchInitialWater } from './pressure-batches.js';

export const PRESSURE_INITIAL_RANGE_SCHEMA = 'experimental-earth-pressure-initial-range/1';
export const PRESSURE_INITIAL_RANGE_FILE_LIMIT = 240000;
export const PRESSURE_INITIAL_RANGE_WORK_LIMIT = 450000;
const finite = (v, low, high) => typeof v === 'number' && Number.isFinite(v) && v >= low && v <= high;
const own = (v, k) => Object.prototype.hasOwnProperty.call(v, k);
const liters = row => row.volume * (row.unit === 'mL' ? .001 : 1);
function exact(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      keys.some(k => !own(value, k)) || Object.keys(value).some(k => !keys.includes(k))) {
    throw Error(label + ' needs exactly its original input fields. Saved results are not inputs.');
  }
}
function positiveQuantity(value, label) {
  exact(value, ['volume', 'unit'], label);
  if (!finite(value.volume, 0, 1e9) || !['L', 'mL'].includes(value.unit) || value.volume === 0) {
    throw Error(label + ' needs a positive original L or mL quantity.');
  }
  const converted = liters(value);
  if (!finite(converted, 1e-9, 1e6)) throw Error('Choose a numerical interval width from 1e-9 to 1e6 L.');
  return { volume: value.volume, unit: value.unit };
}

export function normalizePressureInitialRange(input) {
  exact(input, ['schema', 'study', 'initialWater', 'resolution'], 'Initial-water inquiry');
  if (input.schema !== PRESSURE_INITIAL_RANGE_SCHEMA) throw Error('Unknown initial-water inquiry version.');
  const study = normalizePressureBatchStudy(input.study), range = input.initialWater;
  exact(range, ['lower', 'upper', 'unit', 'source'], 'Initial-water declaration');
  if (!finite(range.lower, 0, 1e9) || !finite(range.upper, range.lower, 1e9) || !['L', 'mL'].includes(range.unit)) {
    throw Error('Declare ordered nonnegative initial-water bounds in L or mL.');
  }
  if (typeof range.source !== 'string' || !range.source.trim() || range.source.length > 1000) {
    throw Error('Retain the source and basis of the initial-water range, within 1000 characters.');
  }
  const factor = range.unit === 'mL' ? .001 : 1;
  const low = range.lower * factor, high = range.upper * factor;
  if ((range.lower > 0 && low === 0) || (range.upper > 0 && high === 0) ||
      (range.upper > range.lower && high === low)) throw Error('The original range loses a positive quantity or width in liters.');
  const nominal = liters(study.protocol.initialSurface);
  if (nominal < low || nominal > high) throw Error('The range must contain the original declared starting amount.');
  const resolution = positiveQuantity(input.resolution, 'Requested numerical width');
  // This validates complete high/low state and supply bounds before any search.
  preparePressureBatchInitialWater(study, { lowerLiters: low, upperLiters: high });
  return { schema: PRESSURE_INITIAL_RANGE_SCHEMA, study,
    initialWater: { lower: range.lower, upper: range.upper, unit: range.unit, source: range.source }, resolution };
}

function boundsForReadings(study, upperInitialLiters) {
  return study.readings.map((r, index) => {
    const value = liters(r), uncertainty = r.uncertainty * (r.unit === 'mL' ? .001 : 1);
    const original = [Math.max(0, value - uncertainty), value + uncertainty];
    const supplied = study.protocol.additions.reduce((sum, a) => sum +
      (a.minute < r.minute || (a.minute === r.minute && r.phase === 'after') ? liters(a) : 0), 0);
    // Fixed over this entire starting range. Future batches and held-aside
    // values do not change a calibration row's comparison allowance.
    const allowance = Math.max(16 * Number.MIN_VALUE, 128 * Number.EPSILON *
      (2 * (upperInitialLiters + supplied) + Math.abs(original[0]) + Math.abs(original[1])));
    return { index, id: r.id, role: r.role, originalBandLiters: original, arithmeticAllowanceLiters: allowance,
      comparisonBandLiters: [Math.max(0, original[0] - allowance), original[1] + allowance] };
  });
}
const midpoint = (low, high) => low + (high - low) / 2;
const predictionsFor = (result, rows) => rows.map(row => ({ ...result.predictions[row.index],
  rangeArithmeticAllowanceLiters: row.arithmeticAllowanceLiters, comparisonBandLiters: [...row.comparisonBandLiters] }));
function stageBase(domain) {
  return { status: 'unconstrained', outerRangeLiters: [...domain], innerRangeLiters: [...domain],
    lowerBoundaryLiters: [domain[0], domain[0]], upperBoundaryLiters: [domain[1], domain[1]],
    numericalResolutionLimited: false, witness: null, rejection: null };
}
async function sharedRange(get, rows, domain, tolerance) {
  const base = stageBase(domain);
  if (!rows.length) return base;
  const lowerOk = result => rows.every(r => result.predictions[r.index].predictedSurfaceLiters >= r.comparisonBandLiters[0]);
  const upperOk = result => rows.every(r => result.predictions[r.index].predictedSurfaceLiters <= r.comparisonBandLiters[1]);
  const atLow = await get(domain[0]), atHigh = await get(domain[1]);
  const lowImpossible = !lowerOk(atHigh), highImpossible = !upperOk(atLow);
  if (lowImpossible || highImpossible) {
    const at = lowImpossible ? atHigh : atLow;
    const violating = rows.filter(r => lowImpossible
      ? at.predictions[r.index].predictedSurfaceLiters < r.comparisonBandLiters[0]
      : at.predictions[r.index].predictedSurfaceLiters > r.comparisonBandLiters[1]);
    return { ...base, status: 'rejected', outerRangeLiters: null, innerRangeLiters: null,
      rejection: { kind: lowImpossible ? 'below-lower-band-at-maximum-start' : 'above-upper-band-at-minimum-start',
        initialLiters: at.initialVolumeLiters, readings: predictionsFor(at, violating) } };
  }
  let lowerBracket = [domain[0], domain[0]], upperBracket = [domain[1], domain[1]], limited = false;
  if (!lowerOk(atLow)) {
    let low = domain[0], high = domain[1], steps = 0;
    while (high - low > tolerance && steps < 64) {
      const mid = midpoint(low, high); if (mid === low || mid === high) { limited = true; break; }
      if (lowerOk(await get(mid))) high = mid; else low = mid;
      steps++;
    }
    if (high - low > tolerance) limited = true;
    lowerBracket = [low, high];
  }
  if (!upperOk(atHigh)) {
    let low = domain[0], high = domain[1], steps = 0;
    while (high - low > tolerance && steps < 64) {
      const mid = midpoint(low, high); if (mid === low || mid === high) { limited = true; break; }
      if (upperOk(await get(mid))) low = mid; else high = mid;
      steps++;
    }
    if (high - low > tolerance) limited = true;
    upperBracket = [low, high];
  }
  const outer = [lowerBracket[0], upperBracket[1]], inner = [lowerBracket[1], upperBracket[0]];
  const result = { ...base, lowerBoundaryLiters: lowerBracket, upperBoundaryLiters: upperBracket,
    numericalResolutionLimited: limited, outerRangeLiters: outer, innerRangeLiters: inner[0] <= inner[1] ? inner : null };
  if (outer[0] > outer[1]) {
    // At this same amount, one original row needs more starting water and
    // another needs less. Monotonicity makes their requirements incompatible.
    // This replaces the normal passing-witness query; it does not fit rows
    // separately or increase the conservative evaluation allowance.
    const amount = midpoint(upperBracket[1], lowerBracket[0]), observed = await get(amount);
    const needsMore = rows.find(r => observed.predictions[r.index].predictedSurfaceLiters < r.comparisonBandLiters[0]);
    const needsLess = rows.find(r => observed.predictions[r.index].predictedSurfaceLiters > r.comparisonBandLiters[1]);
    if (!needsMore || !needsLess || needsMore.index === needsLess.index) {
      throw Error('The separated starting-water boundaries did not produce an original-reading conflict witness; no partial inquiry retained.');
    }
    return { ...result, status: 'rejected', outerRangeLiters: null, innerRangeLiters: null,
      rejection: { kind: 'no-common-starting-amount', lowerBoundaryLiters: lowerBracket, upperBoundaryLiters: upperBracket,
        separatingWitness: { initialLiters: amount, requiresMore: predictionsFor(observed, [needsMore])[0],
          requiresLess: predictionsFor(observed, [needsLess])[0] } } };
  }
  const amounts = result.innerRangeLiters ? [midpoint(...inner)] : [midpoint(...outer), outer[0], outer[1]];
  for (const amount of amounts) {
    const observed = await get(amount);
    if (!lowerOk(observed) || !upperOk(observed)) continue;
    const predictions = predictionsFor(observed, rows);
    const strictlyInside = predictions.every(r => r.classification === 'inside');
    return { ...result, status: strictlyInside ? 'retained' : 'numerical-contact',
      witness: { initialLiters: amount, originalBandStatus: strictlyInside ? 'inside' : 'unresolved-contact', predictions } };
  }
  return { ...result, status: 'unresolved' };
}

/** One common starting amount must explain every relevant original reading.
 * Bisection is conditional on the model's order-preserving response. The fixed
 * comparison allowance is a numerical convention, not measurement uncertainty
 * or a certified error enclosure. No result is adopted into the source study.
 */
export async function inspectPressureInitialRange(input, { signal, yieldControl = () => Promise.resolve() } = {}) {
  const inquiry = normalizePressureInitialRange(input), range = inquiry.initialWater;
  const factor = range.unit === 'mL' ? .001 : 1, low = range.lower * factor, high = range.upper * factor;
  const tolerance = liters(inquiry.resolution), width = high - low;
  const prepared = preparePressureBatchInitialWater(inquiry.study, { lowerLiters: low, upperLiters: high });
  const steps = width <= tolerance ? 0 : Math.min(64, Math.ceil(Math.log2(width) - Math.log2(tolerance)) + 1);
  const maximumEvaluations = inquiry.study.hypotheses.length * (16 + 4 * steps);
  const maximumAdvances = maximumEvaluations * prepared.advancesPerEvaluation;
  if (maximumAdvances > PRESSURE_INITIAL_RANGE_WORK_LIMIT) throw Error('The complete initial-water inquiry exceeds 450000 kernel advances.');
  const check = () => { if (signal?.aborted) { const error = Error('Initial-water inquiry cancelled.'); error.name = 'AbortError'; throw error; } };
  const bounds = boundsForReadings(inquiry.study, high), calibrationRows = bounds.filter(r => r.role === 'calibration');
  const challengeRows = bounds.filter(r => r.role === 'challenge'), candidates = [];
  let evaluations = 0;
  for (const h of inquiry.study.hypotheses) {
    check(); const cache = new Map();
    const get = async amount => {
      check();
      if (!cache.has(amount)) {
        if (evaluations >= maximumEvaluations) throw Error('Initial-water evaluation budget exhausted; no partial inquiry retained.');
        cache.set(amount, prepared.evaluate(h.id, amount)); evaluations++;
        if (evaluations % 8 === 0) { await yieldControl(); check(); }
      }
      return cache.get(amount);
    };
    const originalLow = await get(low), originalHigh = await get(high);
    const calibration = await sharedRange(get, calibrationRows, [low, high], tolerance);
    if (!calibrationRows.length) calibration.status = 'no-calibration';
    let challenge;
    if (!challengeRows.length) challenge = { ...stageBase(calibration.outerRangeLiters ?? [low, high]), status: 'no-challenge' };
    else if (calibration.status === 'rejected') challenge = { ...stageBase([low, high]),
      status: 'not-applied-calibration-rejected', outerRangeLiters: null, innerRangeLiters: null };
    else challenge = await sharedRange(get, [...calibrationRows, ...challengeRows], calibration.outerRangeLiters, tolerance);
    const nominal = await get(liters(inquiry.study.protocol.initialSurface));
    const calibratedLow = calibration.outerRangeLiters ? await get(calibration.outerRangeLiters[0]) : null;
    const calibratedHigh = calibration.outerRangeLiters ? await get(calibration.outerRangeLiters[1]) : null;
    const observed = [...cache.entries()].sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < observed.length; i++) for (const b of bounds) {
      const earlier = observed[i - 1][1].predictions[b.index].predictedSurfaceLiters;
      const later = observed[i][1].predictions[b.index].predictedSurfaceLiters;
      if (earlier > later + b.arithmeticAllowanceLiters) throw Error('Numerical predictions violate the monotone inquiry beyond its comparison allowance; no interval retained.');
    }
    candidates.push({ id: h.id, hypothesis: { ...h }, calibration, challenge, nominalCalibration: { ...nominal.calibration },
      readings: inquiry.study.readings.map((r, index) => ({ ...r,
        originalBandLiters: bounds[index].originalBandLiters, arithmeticAllowanceLiters: bounds[index].arithmeticAllowanceLiters,
        comparisonBandLiters: bounds[index].comparisonBandLiters,
        nominalPredictionLiters: nominal.predictions[index].predictedSurfaceLiters,
        calibrationRangePredictionLiters: calibratedLow ? [calibratedLow.predictions[index].predictedSurfaceLiters,
          calibratedHigh.predictions[index].predictedSurfaceLiters] : null,
        declaredRangePredictionLiters: [originalLow.predictions[index].predictedSurfaceLiters, originalHigh.predictions[index].predictedSurfaceLiters] })) });
    await yieldControl(); check();
  }
  return { inquiry, candidates, hasCalibration: calibrationRows.length > 0, hasChallenge: challengeRows.length > 0,
    requestedWidthLiters: tolerance, work: { maximumEvaluations, evaluations, maximumAdvances,
      advances: evaluations * prepared.advancesPerEvaluation, advancesPerEvaluation: prepared.advancesPerEvaluation },
    qualification: 'One common initial surface-water amount per explanation must satisfy the original calibration readings. Held-aside readings challenge that retained range separately and cannot rescue a rejected calibration. Returned boundaries are numerical brackets under an explicit arithmetic comparison convention, not confidence intervals, certified error bounds, identified soil properties or field validation. Original inputs remain unchanged.' };
}

export function serializePressureInitialRange(input) {
  const value = JSON.stringify(normalizePressureInitialRange(input), null, 2);
  if (new TextEncoder().encode(value).length > PRESSURE_INITIAL_RANGE_FILE_LIMIT) throw Error('Complete initial-water inputs exceed 240000 UTF-8 bytes.');
  return value;
}
export function parsePressureInitialRange(raw) {
  if (typeof raw !== 'string' || new TextEncoder().encode(raw).length > PRESSURE_INITIAL_RANGE_FILE_LIMIT) throw Error('Choose original initial-water inputs up to 240000 UTF-8 bytes.');
  return normalizePressureInitialRange(JSON.parse(raw));
}
