import { validateProject } from './core.js';
import { compareHeatColumnEvidence } from './heat-column-evidence.js';
import { evaluateHeatColumnTarget } from './heat-column.js';

const finite = (x, lo, hi) => typeof x === 'number' && Number.isFinite(x) && x >= lo && x <= hi;
// Conservative engineering separation allowance, not a certified error bound.
function guard(study, target, row) {
  const top = study.heatStudy[target], lower = study.lowerLayers[target];
  const scale = (Math.abs(row.inputJm2) + Math.abs(row.exchangeOutJm2) + Math.abs(row.transferDownJm2)) / top.capacityJm2K + Math.abs(row.transferDownJm2) / lower.capacityJm2K;
  return Number.EPSILON * 4096 * study.heatStudy.schedule.length * Math.max(1, Math.abs(row.surfaceC), Math.abs(row.subsurfaceC), Math.abs(top.initialC), Math.abs(lower.initialC), scale);
}

/** A bounded single-reading question over a declared uniform time grid.
 * Calibration alone selects alternatives. All existing reading supports are
 * excluded, including challenge supports, without inspecting challenge values.
 */
export function planHeatColumnQuestion(project, settings) {
  validateProject(project);
  const evidence = project.heatColumnEvidence;
  if (!evidence) return { status: 'no-evidence' };
  const duration = evidence.columnStudy.heatStudy.schedule.reduce((s, r) => s + r.minutes, 0);
  const { fromMinute, toMinute, sampleCount, halfWidthC, aggregation = 'instant', averagingMinutes = 0 } = settings ?? {};
  const mean = aggregation === 'interval-mean';
  if (!['instant', 'interval-mean'].includes(aggregation) || !finite(averagingMinutes, 0, duration) || (mean ? averagingMinutes <= 0 : averagingMinutes !== 0)) throw Error('Declare an instantaneous reading or a positive supported averaging duration');
  if (!finite(fromMinute, averagingMinutes, duration) || !finite(toMinute, fromMinute, duration) || fromMinute === toMinute ||
      !Number.isInteger(sampleCount) || sampleCount < 2 || sampleCount > 241 || !finite(halfWidthC, 0, 100)) {
    throw Error('Declare a nonempty window inside the exposure, 2–241 sampled times and a 0–100 °C prospective half-width');
  }
  const calibrationOnly = structuredClone(project);
  calibrationOnly.heatColumnEvidence.readings = evidence.readings.filter(r => r.use === 'calibration').map(r => structuredClone(r));
  const comparison = compareHeatColumnEvidence(calibrationOnly);
  if (!comparison.candidates) return { status: comparison.status };
  if (!comparison.counts.calibration) return { status: 'need-calibration' };
  const labels = comparison.calibrationLabels;
  if (labels.length < 2) return { status: labels.length ? 'one-alternative' : 'calibration-rejected', labels };
  const requested = Array.from({ length: sampleCount }, (_, i) => i === sampleCount - 1 ? toMinute : fromMinute + (toMinute - fromMinute) * i / (sampleCount - 1));
  if (new Set(requested).size !== requested.length) throw Error('Candidate times collapse at floating-point precision; widen the query window or use fewer samples');
  const times = requested.filter(t => !evidence.readings.some(r => {const start = mean ? t - averagingMinutes : t; const recordStart = r.aggregation === 'interval-mean' ? r.fromMinute : r.minute; return start <= r.minute && t >= recordStart;}));
  const result = { labels, settings: { fromMinute, toMinute, sampleCount, halfWidthC, aggregation, averagingMinutes }, requestedCount: requested.length,
    excludedCount: requested.length - times.length, inspectedCount: times.length, target: evidence.target,
    cellIndex: evidence.columnStudy.heatStudy.cellIndex, associationSource: evidence.associationSource };
  if (!times.length) return { ...result, status: 'no-unrecorded-time' };
  const courses = evidence.hypotheses.filter(h => labels.includes(h.label)).map(h => {
    const study = structuredClone(evidence.columnStudy);
    study.lowerLayers[evidence.target] = { ...study.lowerLayers[evidence.target], capacityJm2K: h.capacityJm2K, conductanceWm2K: h.conductanceWm2K, source: h.source };
    const windows = mean ? times.map(minute => ({fromMinute: minute - averagingMinutes, minute})) : [];
    const course = evaluateHeatColumnTarget(study, evidence.target, times, windows);
    const averages = new Map((course.averages ?? []).map(row => [row.minute, row]));
    if (mean && averages.size !== times.length) throw Error('A qualified interval-mean operator is required');
    return { label: h.label, source: h.source, study, averages, rows: new Map(course.trajectory.map(r => [r.minute, r])) };
  });
  let best = null;
  for (const minute of times) {
    const predictions = courses.map(c => { const original = c.rows.get(minute), average = c.averages.get(minute); const row = mean ? {...original, surfaceC: average.surfaceMeanC, subsurfaceC: average.subsurfaceMeanC} : original; return { label: c.label, source: c.source, temperatureC: row.surfaceC, guardC: guard(c.study, evidence.target, row) }; });
    const pairs = [];
    for (let a = 0; a < predictions.length; a++) for (let b = a + 1; b < predictions.length; b++) {
      const x = predictions[a], y = predictions[b];
      const gapC = Math.abs(x.temperatureC - y.temperatureC), guardC = x.guardC + y.guardC;
      pairs.push({ labels: [x.label, y.label], gapC, guardC, separated: gapC > 2 * halfWidthC + guardC });
    }
    const separatedCount = pairs.filter(p => p.separated).length;
    const minimumGapC = Math.min(...pairs.map(p => Math.max(0, p.gapC - p.guardC)));
    if (!best || separatedCount > best.separatedCount || separatedCount === best.separatedCount && minimumGapC > best.minimumGapC) best = { minute, ...(mean ? {fromMinute: minute - averagingMinutes, aggregation} : {}), predictions, pairs, separatedCount, minimumGapC };
  }
  return { ...result, status: best.separatedCount ? 'question' : 'no-separating-time', best,
    semantics: 'Largest separated-pair count on the declared time grid; ties prefer the largest guarded minimum pair gap, then the earliest time. This is not a continuous optimum, information gain, error bound or physical identification. Prospective bands contain no observed values.' };
}

export { guard as heatColumnQuestionGuard };
