import { canonicalBottomHeatStudy, evaluateBottomHeatTarget } from './bottom-heat-study.js';
import { validateSurfaceTemperatureReadings } from './surface-temperature-readings.js';
import { constrainAffineReading as constraint, intersectParameterIntervals as intersect } from './cooling-fraction-evidence.js';

export const BOTTOM_EVIDENCE_SCHEMA = 'experimental-earth-bottom-evidence/1';
export const BOTTOM_EVIDENCE_FILE_LIMIT = 4 * 1024 * 1024;
const finite = (v, a, b) => typeof v === 'number' && Number.isFinite(v) && v >= a && v <= b;
const text = s => typeof s === 'string' && !!s.trim() && s.length <= 600;

export function canonicalBottomEvidence(input) {
  if (!input || input.schema !== BOTTOM_EVIDENCE_SCHEMA || input.quantity !== 'surface-temperature' ||
      !['existing', 'proposal'].includes(input.target) || !text(input.associationSource)) {
    throw Error('Retain a versioned original surface-temperature investigation, selected place and association source');
  }
  const original = canonicalBottomHeatStudy(input.original);
  const duration = original.heatColumnStudy.heatStudy.schedule.reduce((n, r) => n + r.minutes, 0);
  validateSurfaceTemperatureReadings(input.readings, duration);
  if (!input.readings.length) throw Error('Retain at least one original sourced surface reading');
  if (!Array.isArray(input.hypotheses) || input.hypotheses.length < 1 || input.hypotheses.length > 9) {
    throw Error('Offer 1–9 explicit bottom-conductance alternatives');
  }
  const seen = new Set(), labels = new Set();
  const hypotheses = Array.from(input.hypotheses).map(h => {
    if (!h || !text(h.label) || h.label.length > 80 || !text(h.source) ||
        !finite(h.conductanceWm2K, 0, 1000) || seen.has(h.conductanceWm2K) || labels.has(h.label) ||
        !Array.isArray(h.reservoirRangeC) || h.reservoirRangeC.length !== 2 ||
        !Array.from(h.reservoirRangeC).every(v => finite(v, -100, 200)) || h.reservoirRangeC[0] > h.reservoirRangeC[1]) {
      throw Error('Each unique conductance needs a unique label, ordered reservoir range within −100–200 °C and original source');
    }
    seen.add(h.conductanceWm2K); labels.add(h.label);
    return { label: h.label, conductanceWm2K: h.conductanceWm2K,
      reservoirRangeC: [...h.reservoirRangeC], source: h.source };
  });
  return { schema: BOTTOM_EVIDENCE_SCHEMA, quantity: 'surface-temperature', original, target: input.target,
    associationSource: input.associationSource, hypotheses, readings: structuredClone(input.readings) };
}

export function prepareBottomEvidence(original, input) {
  return canonicalBottomEvidence({ ...input, schema: BOTTOM_EVIDENCE_SCHEMA,
    quantity: 'surface-temperature', original });
}

function allowance(source, target, predictions, reading) {
  const s = source.heatColumnStudy, top = s.heatStudy[target], lower = s.lowerLayers[target];
  const scales = predictions.flatMap(p => [Math.abs(p.value), Math.abs(p.end.surfaceC), Math.abs(p.end.subsurfaceC),
    (Math.abs(p.end.inputJm2) + Math.abs(p.end.exchangeOutJm2) + Math.abs(p.end.transferDownJm2)) / top.capacityJm2K +
    (Math.abs(p.end.transferDownJm2) + Math.abs(p.end.bottomOutJm2)) / lower.capacityJm2K]);
  return Number.EPSILON * 4096 * s.heatStudy.schedule.length *
    Math.max(1, Math.abs(reading.temperatureC), Math.abs(top.initialC), Math.abs(lower.initialC), ...scales);
}

export function compareBottomEvidence(input) {
  const evidence = canonicalBottomEvidence(input), { original, target, readings } = evidence;
  const times = readings.map(r => r.minute);
  const windows = readings.filter(r => r.aggregation === 'interval-mean').map(r => ({ fromMinute: r.fromMinute, minute: r.minute }));
  const counts = { calibration: readings.filter(r => r.use === 'calibration').length,
    challenge: readings.filter(r => r.use === 'challenge').length };
  const candidates = evidence.hypotheses.map(h => {
    try {
      // Evaluate only original declared endpoints, never an extrapolated reservoir.
      // Affinity at each time means endpoint course admission covers the interval.
      const courses = h.reservoirRangeC.map(reservoirC => {
        const source = canonicalBottomHeatStudy(original);
        source.bottoms[target] = { conductanceWm2K: h.conductanceWm2K, reservoirC, source: h.source };
        const result = evaluateBottomHeatTarget(source, target, times, windows);
        return { byTime: new Map(result.trajectory.map(r => [r.minute, r])),
          byWindow: new Map(result.averages.map(r => [JSON.stringify([r.fromMinute, r.minute]), r])) };
      });
      const rows = readings.map((reading, index) => {
        const predictions = courses.map(c => ({ end: c.byTime.get(reading.minute),
          value: reading.aggregation === 'interval-mean'
            ? c.byWindow.get(JSON.stringify([reading.fromMinute, reading.minute])).surfaceMeanC
            : c.byTime.get(reading.minute).surfaceC }));
        const values = predictions.map(p => p.value), guard = allowance(original, target, predictions, reading);
        const fixed = h.reservoirRangeC[0] === h.reservoirRangeC[1];
        const noCoupling = h.conductanceWm2K === 0 || original.heatColumnStudy.lowerLayers[target].conductanceWm2K === 0 ||
          reading.minute === 0;
        const unresolved = !fixed && !noCoupling && Math.abs(values[1] - values[0]) <= 2 * guard;
        // When endpoint variation is beneath numerical resolution, refuse to
        // manufacture a narrow inferred interval by dividing by that variation.
        const entireBandInterior = Math.min(...values) - guard > reading.temperatureC - reading.halfWidthC &&
          Math.max(...values) + guard < reading.temperatureC + reading.halfWidthC;
        const nominalRangeC = unresolved ? (entireBandInterior ? [...h.reservoirRangeC] : null) :
          constraint(h.reservoirRangeC, values[0], values[1], reading, 0);
        let arithmeticRangeC = constraint(h.reservoirRangeC, values[0], values[1], reading, guard);
        if (unresolved && arithmeticRangeC) arithmeticRangeC = [...h.reservoirRangeC];
        return { index, reading: structuredClone(reading), predictionsAtRangeEndsC: values,
          arithmeticGuardC: guard, nominalRangeC, arithmeticRangeC,
          sensitivity: fixed ? 'fixed-range' : noCoupling ? 'none' : unresolved ? 'numerically-unresolved' : 'varying' };
      });
      const retain = (use, key) => rows.filter(r => r.reading.use === use)
        .reduce((range, row) => intersect(range, row[key]), [...h.reservoirRangeC]);
      const calibrationRangeC = retain('calibration', 'nominalRangeC');
      const challengeRangeC = retain('challenge', 'nominalRangeC');
      const survivingRangeC = intersect(calibrationRangeC, challengeRangeC);
      const calibrationWithAllowanceC = retain('calibration', 'arithmeticRangeC');
      const challengeWithAllowanceC = retain('challenge', 'arithmeticRangeC');
      const survivingWithAllowanceC = intersect(calibrationWithAllowanceC, challengeWithAllowanceC);
      const status = !counts.calibration ? 'need-calibration' : !calibrationWithAllowanceC ? 'calibration-rejected' :
        !counts.challenge ? (calibrationRangeC ? 'needs-challenge' : 'numerical-contact') :
        !survivingWithAllowanceC ? 'challenged' : survivingRangeC ? 'compatible-range' : 'numerical-contact';
      return { hypothesis: structuredClone(h), status, rows, calibrationRangeC, challengeRangeC, survivingRangeC,
        calibrationWithAllowanceC, challengeWithAllowanceC, survivingWithAllowanceC };
    } catch (error) {
      if (!error.message.startsWith('Predicted two-layer temperature leaves')) throw error;
      return { hypothesis: structuredClone(h), status: 'unsupported-course', reason: error.message, rows: [],
        calibrationRangeC: null, challengeRangeC: null, survivingRangeC: null,
        calibrationWithAllowanceC: null, challengeWithAllowanceC: null, survivingWithAllowanceC: null };
    }
  });
  return { schema: 'experimental-earth-bottom-evidence-result/1', evidence, counts, candidates,
    calibrationLabels: candidates.filter(c => counts.calibration && c.calibrationRangeC).map(c => c.hypothesis.label),
    survivingLabels: candidates.filter(c => counts.calibration && counts.challenge && c.survivingRangeC).map(c => c.hypothesis.label),
    meaning: 'Original forcing, heat capacities, surface exchange, internal coupling and initial states stay fixed. Each offered conductance retains a continuous declared reservoir interval. Calibration and held-aside intersections are separate; no parameter is adopted. Numerical allowances are separate from the original reading bands and are not certified bounds, measurement uncertainty, probabilities or physical identification.' };
}

export function serializeBottomEvidence(input) {
  const text = JSON.stringify(canonicalBottomEvidence(input), null, 2);
  if (new TextEncoder().encode(text).length > BOTTOM_EVIDENCE_FILE_LIMIT) throw Error('Original evidence exceeds the 4 MiB portable limit');
  return text;
}
export function parseBottomEvidence(text) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).length > BOTTOM_EVIDENCE_FILE_LIMIT) {
    throw Error('Evidence must be UTF-8 JSON no larger than 4 MiB');
  }
  const result = canonicalBottomEvidence(JSON.parse(text));
  serializeBottomEvidence(result);
  return result;
}
