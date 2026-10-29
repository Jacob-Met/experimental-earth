import { advancePressureHead } from './pressure-head.js';

export const PRESSURE_BATCH_SCHEMA = 'experimental-earth-pressure-batches/1';
export const PRESSURE_BATCH_FILE_LIMIT = 220000;
export const PRESSURE_BATCH_WORK_LIMIT = 2200;
const own = (o, key) => Object.prototype.hasOwnProperty.call(o, key);
const finite = (x, low, high) => typeof x === 'number' && Number.isFinite(x) && x >= low && x <= high;
function object(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      keys.some(key => !own(value, key)) || Object.keys(value).some(key => !keys.includes(key))) {
    throw Error(label + ' needs exactly its declared input fields; saved conclusions are not inputs.');
  }
}
function text(value, label, max = 1000) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw Error(label + ' is required (at most ' + max + ' characters).');
  return value;
}
function array(value, low, high, label) {
  if (!Array.isArray(value) || value.length < low || value.length > high ||
      Array.from({ length: value.length }, (_, i) => !own(value, i)).some(Boolean)) {
    throw Error(label + ' needs ' + low + '–' + high + ' explicit entries.');
  }
}
function quantity(value, label) {
  object(value, ['volume', 'unit', 'source'], label);
  if (!finite(value.volume, 0, 1e9) || !['L', 'mL'].includes(value.unit)) throw Error(label + ' needs a nonnegative original L or mL quantity.');
  text(value.source, label + ' source');
  const liters = value.volume * (value.unit === 'mL' ? .001 : 1);
  if (value.volume > 0 && liters === 0) throw Error(label + ' is too small to represent in liters.');
  return { volume: value.volume, unit: value.unit, source: value.source };
}
const liters = value => value.volume * (value.unit === 'mL' ? .001 : 1);
function depth(value, area, label) {
  const d = liters(value) / area;
  if (!finite(d, 0, 1e9) || (value.volume > 0 && d === 0)) throw Error(label + ' exceeds the maintained water-depth bounds.');
  return d;
}
function uniqueIds(rows, label) {
  const ids = new Set();
  for (const row of rows) {
    if (!row || typeof row !== 'object') throw Error(label + ' entries must be explicit objects.');
    text(row.id, label + ' ID', 80);
    if (ids.has(row.id)) throw Error(label + ' IDs must remain distinct.');
    ids.add(row.id);
  }
}
function evaluationPlan(protocol, readings, chartSamples = true) {
  const boundaries = [...new Set([0, protocol.durationMinutes, ...protocol.additions.map(a => a.minute)])].sort((a, b) => a - b);
  const boundarySet = new Set(boundaries);
  const times = [...new Set([...boundaries, ...readings.map(r => r.minute),
    ...(chartSamples ? Array.from({ length: 65 }, (_, i) => protocol.durationMinutes * (i / 64)) : [])])].sort((a, b) => a - b);
  return { boundaries, times, advancesPerCandidate: boundaries.length - 1 + times.filter(t => !boundarySet.has(t)).length };
}

/** Only original declarations are retained. No forcing or moisture is inferred. */
export function normalizePressureBatchStudy(input) {
  object(input, ['schema', 'title', 'place', 'source', 'protocol', 'hypotheses', 'readings'], 'Batch study');
  if (input.schema !== PRESSURE_BATCH_SCHEMA) throw Error('Unknown pressure-batch study version.');
  text(input.title, 'Study title', 160); text(input.place, 'Local test place', 240); text(input.source, 'Study source');
  const p = input.protocol;
  object(p, ['areaM2', 'areaSource', 'durationMinutes', 'initialSurface', 'instantaneousBatches', 'noOtherSupply', 'noOtherLoss', 'assumptionsSource', 'additions'], 'Batch protocol');
  if (!finite(p.areaM2, .0001, 100) || !finite(p.durationMinutes, 0, 720) || p.durationMinutes === 0) throw Error('Declare an area from0.0001 to100m² and a positive duration through720min.');
  text(p.areaSource, 'Area source'); text(p.assumptionsSource, 'Protocol assumptions source');
  if (p.instantaneousBatches !== true || p.noOtherSupply !== true || p.noOtherLoss !== true) throw Error('Explicitly declare ideal instantaneous batches, no rain or other supply between them, and no evaporation, leakage or lateral loss.');
  const initialSurface = quantity(p.initialSurface, 'Initial surface inventory');
  let totalDepth = depth(initialSurface, p.areaM2, 'Initial surface inventory');
  array(p.additions, 1, 64, 'Original batch additions'); uniqueIds(p.additions, 'Batch');
  let previous = -1;
  const additions = p.additions.map(a => {
    object(a, ['id', 'minute', 'volume', 'unit', 'source'], 'Batch');
    if (!finite(a.minute, 0, p.durationMinutes) || a.minute <= previous) throw Error('Batch times must strictly increase within the course. Do not sort or merge coincident original additions.');
    previous = a.minute;
    const q = quantity({ volume: a.volume, unit: a.unit, source: a.source }, 'Batch ' + a.id);
    const d = depth(q, p.areaM2, 'Batch ' + a.id);
    const nextTotal = totalDepth + d;
    if (!finite(nextTotal, 0, 1e9) || (d > 0 && nextTotal === totalDepth)) throw Error('Complete batch supply exceeds the maintained bounds or arithmetic resolution.');
    totalDepth = nextTotal;
    return { id: a.id, minute: a.minute, ...q };
  });
  array(input.hypotheses, 2, 9, 'Soil explanations'); uniqueIds(input.hypotheses, 'Explanation');
  const parameterSets = new Set();
  const hypotheses = input.hypotheses.map(h => {
    object(h, ['id', 'conductivityMmHr', 'capillaryDriveMm', 'moistureDeficit', 'initialCumulativeMm', 'source'], 'Soil explanation');
    text(h.source, 'Explanation source');
    if (!finite(h.conductivityMmHr, 0, 2000) || !finite(h.capillaryDriveMm, 0, 5000) ||
        !finite(h.moistureDeficit, 0, 1) || !finite(h.initialCumulativeMm, 0, 1e9) ||
        h.initialCumulativeMm + totalDepth > 1e9) throw Error('Explicit K, A, moisture deficit and initial cumulative infiltration must fit the maintained kernel bounds.');
    const key = JSON.stringify([h.conductivityMmHr, h.capillaryDriveMm, h.moistureDeficit, h.initialCumulativeMm]);
    if (parameterSets.has(key)) throw Error('Declare distinct soil explanations; duplicate parameter sets are not additional alternatives.');
    parameterSets.add(key);
    return { id: h.id, conductivityMmHr: h.conductivityMmHr, capillaryDriveMm: h.capillaryDriveMm,
      moistureDeficit: h.moistureDeficit, initialCumulativeMm: h.initialCumulativeMm, source: h.source };
  });
  array(input.readings, 0, 100, 'Original surface-inventory readings'); uniqueIds(input.readings, 'Reading');
  const batchTimes = new Set(additions.map(a => a.minute));
  let priorMinute = -1, priorPhase = -1;
  const readings = input.readings.map(r => {
    object(r, ['id', 'minute', 'phase', 'volume', 'uncertainty', 'unit', 'role', 'source'], 'Original reading');
    if (!finite(r.minute, 0, p.durationMinutes) || !['before', 'after', 'no-addition'].includes(r.phase) ||
        !['calibration', 'challenge'].includes(r.role) || !finite(r.uncertainty, 0, 1e9)) throw Error('Reading time, before/after phase, uncertainty and calibration/challenge role must be explicit.');
    if (batchTimes.has(r.minute) ? r.phase === 'no-addition' : r.phase !== 'no-addition') throw Error('At a batch time choose before or after that batch. At other times choose no-addition.');
    const phaseOrder = r.phase === 'after' ? 1 : 0;
    if (r.minute < priorMinute || (r.minute === priorMinute && phaseOrder < priorPhase)) throw Error('Keep original readings in time and before/after order; readings are never sorted or combined.');
    priorMinute = r.minute; priorPhase = phaseOrder;
    const q = quantity({ volume: r.volume, unit: r.unit, source: r.source }, 'Reading ' + r.id);
    if (r.uncertainty > 0 && r.uncertainty * (r.unit === 'mL' ? .001 : 1) === 0) throw Error('A declared uncertainty is too small to represent in liters.');
    return { id: r.id, minute: r.minute, phase: r.phase, ...q, uncertainty: r.uncertainty, role: r.role };
  });
  const times = [...new Set([0, p.durationMinutes, ...additions.map(a => a.minute), ...readings.map(r => r.minute)])].sort((a, b) => a - b);
  for (let i = 1; i < times.length; i++) if ((times[i] - times[i - 1]) / 60 === 0) throw Error('An original positive time interval is too small to resolve.');
  if (evaluationPlan({ ...p, additions }, readings).advancesPerCandidate * hypotheses.length > PRESSURE_BATCH_WORK_LIMIT) throw Error('The complete course exceeds2200 maintained-kernel advances.');
  return { schema: PRESSURE_BATCH_SCHEMA, title: input.title, place: input.place, source: input.source,
    protocol: { areaM2: p.areaM2, areaSource: p.areaSource, durationMinutes: p.durationMinutes,
      initialSurface, instantaneousBatches: true, noOtherSupply: true, noOtherLoss: true, assumptionsSource: p.assumptionsSource, additions },
    hypotheses, readings };
}

function score(predictions, role) {
  const rows = predictions.filter(r => r.role === role);
  const outside = rows.filter(r => r.classification === 'outside').length;
  const boundary = rows.filter(r => r.classification === 'numerical-boundary').length;
  return { count: rows.length, inside: rows.length - outside - boundary, outside, boundary,
    compatible: !rows.length || boundary ? (outside ? false : null) : outside === 0,
    rmseLiters: rows.length ? Math.sqrt(rows.reduce((s, r) => s + r.residualLiters ** 2, 0) / rows.length) : null };
}

function evaluateExplanation(study, h, plan) {
  const p = study.protocol, area = p.areaM2;
  const additions = new Map(p.additions.map(a => [a.minute, a]));
  const initialDepth = depth(p.initialSurface, area, 'Initial inventory');
  let state = { minute: 0, front: h.initialCumulativeMm, surface: initialDepth, supplied: 0, infiltrated: 0 };
  const states = new Map(), origins = [], eventHistory = [];
  function advance(origin, time) {
    if (time === origin.minute) return origin;
    const next = advancePressureHead({ cumulativeMm: origin.front, surfaceWaterMm: origin.surface, rainMmHr: 0,
      hours: (time - origin.minute) / 60, conductivityMmHr: h.conductivityMmHr,
      capillaryDriveMm: h.capillaryDriveMm, moistureDeficit: h.moistureDeficit });
    return { minute: time, front: next.cumulativeMm, surface: next.surfaceWaterMm,
      supplied: origin.supplied, infiltrated: origin.infiltrated + next.infiltratedMm };
  }
  function record(s, phase, batch, isEvent = false) {
    const row = { minute: s.minute, phase, batchId: batch?.id ?? null, cumulativeInfiltrationMm: s.front,
      suppliedLiters: s.supplied * area, infiltratedLiters: s.infiltrated * area, surfaceLiters: s.surface * area,
      waterBalanceResidualLiters: (initialDepth + s.supplied - s.infiltrated - s.surface) * area };
    states.set(s.minute + '/' + phase, row);
    if (isEvent) eventHistory.push(row);
  }
  // Only actual batch boundaries carry state. Query and held-aside times never
  // split this integration or change later calibration predictions.
  for (const time of plan.boundaries) {
    state = advance(state, time);
    const batch = additions.get(time);
    if (batch) {
      record(state, 'before', batch, true);
      const amount = depth(batch, area, 'Batch ' + batch.id);
      state = { ...state, surface: state.surface + amount, supplied: state.supplied + amount };
      record(state, 'after', batch, true);
    } else record(state, 'no-addition', null, true);
    origins.push(state);
  }
  for (const time of plan.times) {
    if (additions.has(time) || states.has(time + '/no-addition')) continue;
    let origin = origins[0];
    for (const candidate of origins) { if (candidate.minute > time) break; origin = candidate; }
    record(advance(origin, time), 'no-addition', null);
  }
  const history = [...states.values()].sort((a, b) => a.minute - b.minute || (a.phase === 'after' ? 1 : 0) - (b.phase === 'after' ? 1 : 0));
  const predictions = study.readings.map(r => {
    const state = states.get(r.minute + '/' + r.phase), value = liters(r);
    const uncertainty = r.uncertainty * (r.unit === 'mL' ? .001 : 1);
    const low = Math.max(0, value - uncertainty), high = value + uncertainty;
    const predicted = state.surfaceLiters;
    const guard = Math.max(16 * Number.MIN_VALUE, 64 * Number.EPSILON *
      (Math.abs(predicted) + Math.abs(low) + Math.abs(high) + state.suppliedLiters + state.infiltratedLiters + liters(p.initialSurface)));
    const classification = predicted < low - guard || predicted > high + guard ? 'outside' :
      predicted > low + guard && predicted < high - guard ? 'inside' : 'numerical-boundary';
    return { ...r, batchId: state.batchId, predictedSurfaceLiters: predicted, residualLiters: predicted - value,
      originalBandLiters: [low, high], arithmeticAllowanceLiters: guard, classification };
  });
  return { id: h.id, hypothesis: h, eventHistory, history, predictions,
    calibration: score(predictions, 'calibration'), challenge: score(predictions, 'challenge') };
}

export function comparePressureBatches(input) {
  const study = normalizePressureBatchStudy(input);
  const plan = evaluationPlan(study.protocol, study.readings);
  const candidates = study.hypotheses.map(h => evaluateExplanation(study, h, plan));
  const hasCalibration = study.readings.some(r => r.role === 'calibration');
  const calibrationOrder = hasCalibration ? candidates.map((c, index) => ({ id: c.id, index, score: c.calibration.rmseLiters }))
    .sort((a, b) => a.score - b.score || a.index - b.index).map(c => c.id) : [];
  return { study, candidates, hasCalibration, calibrationOrder,
    requestedWork: plan.advancesPerCandidate * candidates.length,
    qualification: 'Declared instantaneous additions and a closed local water account between them. Front state is carried through dry gaps. Readings retain their explicit side of each addition. A zero deficit is a head-neglected mathematical control; A alone does not identify moisture deficit. No refill history, soil recovery, measurement uncertainty, field accuracy or site transfer is inferred.' };
}

/** Prepare repeated original-time predictions under one declared initial range.
 * No observation is invented, no chart sample advances carried state, and the
 * admitted hypothesis/forcing bytes cannot be changed through returned values.
 */
export function preparePressureBatchInitialWater(input, range) {
  object(range, ['lowerLiters', 'upperLiters'], 'Initial-water range');
  if (!finite(range.lowerLiters, 0, 1e9) || !finite(range.upperLiters, range.lowerLiters, 1e9)) {
    throw Error('Initial water needs finite ordered nonnegative bounds in liters.');
  }
  const lower = range.lowerLiters, upper = range.upperLiters;
  const study = normalizePressureBatchStudy(input);
  const withInitial = volume => ({ ...study, protocol: { ...study.protocol,
    initialSurface: { ...study.protocol.initialSurface, volume, unit: 'L' } } });
  // Admit both endpoints before allowing any execution, including complete
  // supply/front limits and representability of a positive lower amount.
  normalizePressureBatchStudy(withInitial(lower));
  normalizePressureBatchStudy(withInitial(upper));
  const plan = evaluationPlan(study.protocol, study.readings, false);
  const hypotheses = new Map(study.hypotheses.map(h => [h.id, h]));
  return {
    study: structuredClone(study), lowerLiters: lower, upperLiters: upper,
    advancesPerEvaluation: plan.advancesPerCandidate,
    evaluate(hypothesisId, initialVolumeLiters) {
      const hypothesis = hypotheses.get(hypothesisId);
      if (!hypothesis || !finite(initialVolumeLiters, lower, upper)) {
        throw Error('Choose an admitted explanation and an amount inside the original range.');
      }
      const result = evaluateExplanation(withInitial(initialVolumeLiters), hypothesis, plan);
      return { ...result, hypothesis: { ...result.hypothesis }, initialVolumeLiters };
    },
  };
}

export function serializePressureBatches(input) {
  const text = JSON.stringify(normalizePressureBatchStudy(input), null, 2);
  if (new TextEncoder().encode(text).length > PRESSURE_BATCH_FILE_LIMIT) throw Error('Complete pressure-batch inputs exceed220000 UTF-8 bytes.');
  return text;
}
export function parsePressureBatches(text) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).length > PRESSURE_BATCH_FILE_LIMIT) throw Error('Choose original pressure-batch inputs up to220000 UTF-8 bytes.');
  return normalizePressureBatchStudy(JSON.parse(text));
}
