import { validateProject } from './core.js';
import { evaluateHeatColumnTarget } from './heat-column.js';
import { screenHeatReadings } from './surface-heat-evidence.js';
import { HEAT_COLUMN_EVIDENCE_SCHEMA, validateHeatColumnEvidence, heatColumnEvidenceCurrent } from './heat-column-evidence-contract.js';

export function prepareHeatColumnEvidence(project, input) {
  validateProject(project);
  if (!project.heatColumnStudy) throw Error('Save the original two-store declaration before associating surface readings');
  if (project.heatColumnEvidence && input.target !== project.heatColumnEvidence.target) {
    throw Error('The retained readings belong to another selected place; export them before clearing and changing the target');
  }
  if (project.heatColumnEvidence && !heatColumnEvidenceCurrent(project, project.heatColumnEvidence)) {
    throw Error('The retained investigation belongs to another two-store declaration; export it before clearing and associating new evidence');
  }
  if (input.quantity !== undefined && input.quantity !== 'surface-temperature') {
    throw Error('These readings must explicitly represent surface temperature, not lower-store temperature or energy');
  }
  const evidence = validateHeatColumnEvidence({ schema: HEAT_COLUMN_EVIDENCE_SCHEMA, quantity: 'surface-temperature',
    columnStudy: structuredClone(project.heatColumnStudy), target: input.target,
    associationSource: input.associationSource, hypotheses: structuredClone(input.hypotheses),
    readings: structuredClone(input.readings) });
  if (!heatColumnEvidenceCurrent(project, evidence)) throw Error('The saved two-store exposure no longer matches the current place');
  return evidence;
}

function variant(evidence, h) {
  const study = structuredClone(evidence.columnStudy);
  study.lowerLayers[evidence.target] = { ...study.lowerLayers[evidence.target],
    capacityJm2K: h.capacityJm2K, conductanceWm2K: h.conductanceWm2K, source: h.source };
  return study;
}

// Engineering roundoff guard scales with accumulated transfer/capacity as
// well as temperature. It is kept separate from the declared measurement band.
// It is not a formal error enclosure or a statistical uncertainty estimate.
function arithmeticGuard(study, target, prediction, reading) {
  const top = study.heatStudy[target], lower = study.lowerLayers[target];
  const transferScale = (Math.abs(prediction.inputJm2) + Math.abs(prediction.exchangeOutJm2) +
    Math.abs(prediction.transferDownJm2)) / top.capacityJm2K + Math.abs(prediction.transferDownJm2) / lower.capacityJm2K;
  return Number.EPSILON * 2048 * study.heatStudy.schedule.length *
    Math.max(1, Math.abs(reading.temperatureC), Math.abs(prediction.surfaceC),
      Math.abs(prediction.subsurfaceC), Math.abs(top.initialC), Math.abs(lower.initialC), transferScale);
}

export function evaluateHeatColumnHypothesis(evidence, h, times = []) {
    times = [...new Set([...times, ...evidence.readings.map(r => r.minute)])];
    const study = variant(evidence, h);
    // Evaluation checks the complete exposure and both stores' interior extrema,
    // including unsupported intervals where no observation was supplied.
    const windows = evidence.readings.filter(r => r.aggregation === 'interval-mean').map(r => ({ fromMinute: r.fromMinute, minute: r.minute }));
    const course = evaluateHeatColumnTarget(study, evidence.target, times, windows);
    const byTime = new Map(course.trajectory.map(row => [row.minute, row]));
    const means = new Map(course.averages.map(row => [JSON.stringify([row.fromMinute, row.minute]), row]));
    const rows = evidence.readings.map((r, index) => {
      const prediction = byTime.get(r.minute);
      const mean = r.aggregation === 'interval-mean' ? means.get(JSON.stringify([r.fromMinute, r.minute])) : null;
      const predictionC = mean ? mean.surfaceMeanC : prediction.surfaceC, residualC = r.temperatureC - predictionC;
      const arithmeticGuardC = arithmeticGuard(study, evidence.target, mean ?
        { ...prediction, surfaceC: mean.surfaceMeanC, subsurfaceC: mean.subsurfaceMeanC } : prediction, r);
      return { index, use: r.use, minute: r.minute, predictionC, residualC, arithmeticGuardC,
        ...(mean ? { aggregation: 'interval-mean', fromMinute: r.fromMinute } : {}),
        withinBand: Math.abs(residualC) <= r.halfWidthC + arithmeticGuardC };
    });
    return { label: h.label, calibration: screenHeatReadings(rows.filter(r => r.use === 'calibration')),
      challenge: screenHeatReadings(rows.filter(r => r.use === 'challenge')), trajectory: course.trajectory,
      summary: { surface: course.summary.surface, subsurface: course.summary.subsurface },
      final: course.summary.final };
}

export function compareHeatColumnEvidence(project) {
  validateProject(project);
  const evidence = project.heatColumnEvidence;
  if (!evidence) return { status: 'no-evidence' };
  if (!heatColumnEvidenceCurrent(project, evidence)) return { status: 'context-changed' };
  const durationMinutes = evidence.columnStudy.heatStudy.schedule.reduce((sum, row) => sum + row.minutes, 0);
  const times = [...new Set([...evidence.readings.flatMap(r => r.aggregation === 'interval-mean' ? [r.fromMinute, r.minute] : [r.minute]),
    ...Array.from({ length: 121 }, (_, i) => i === 120 ? durationMinutes : durationMinutes * (i / 120))])];
  const candidates = evidence.hypotheses.map(h => evaluateHeatColumnHypothesis(evidence, h, times));
  const calibration = candidates.filter(c => c.calibration.compatible === true);
  const survivors = calibration.filter(c => c.challenge.compatible !== false);
  const calibrationCount = evidence.readings.filter(r => r.use === 'calibration').length;
  const challengeCount = evidence.readings.length - calibrationCount;
  let status = 'ambiguous';
  if (!calibrationCount) status = 'need-calibration';
  else if (!calibration.length) status = 'calibration-rejected';
  else if (challengeCount && !survivors.length) status = 'challenged';
  else if (!challengeCount) status = 'needs-challenge';
  else if (survivors.length === 1) status = 'one-survivor';
  const range = values => values.length ? { minimum: Math.min(...values), maximum: Math.max(...values) } : null;
  return { status, durationMinutes, candidates, counts: { calibration: calibrationCount, challenge: challengeCount },
    calibrationLabels: calibration.map(c => c.label), survivingLabels: survivors.map(c => c.label),
    peakRanges: { lowerMaximumC: range(survivors.map(c => c.summary.subsurface.maximumC)),
      lowerMaximumMinute: range(survivors.map(c => c.summary.subsurface.maximumMinute)) },
    semantics: 'Only these finite sourced lower-capacity/conductance alternatives are screened. Surface properties, lower initial temperature and exposure stay fixed. Instantaneous readings compare point values; interval means compare the complete declared averaging window. Overlapping windows or role labels do not establish independent acquisition. Challenge readings never refit or rank alternatives. Engineering arithmetic guards and maxima are not certified bounds, physical calibration or probabilities.' };
}

export function authoredHeatColumnEvidenceExample(project, target = 'existing') {
  if (!project.heatColumnStudy || !['existing', 'proposal'].includes(target)) throw Error('Save a two-store declaration before filling an authored investigation');
  const base = project.heatColumnStudy.lowerLayers[target];
  const ratios = [[.75, 27.510121852810165 / 20], [1, 1], [1.5, 16.295174716022963 / 20],
    [3, 14.009639299457522 / 20], [6.25, 13.122086618787623 / 20]];
  const hypotheses = ratios.map(([capacity, conductance], i) => ({
    label: String.fromCharCode(65 + i) + (i === 1 ? ' · reference lower store' : ' · offered lower store'),
    capacityJm2K: Math.min(1e7, Math.max(1000, base.capacityJm2K * capacity)),
    conductanceWm2K: Math.min(1000, base.conductanceWm2K * conductance),
    source: 'Authored illustrative alternative; no lower capacity, conductance or physical depth was measured' }));
  const duration = project.heatColumnStudy.heatStudy.schedule.reduce((sum, row) => sum + row.minutes, 0);
  const times = [duration / 7, 2 * duration / 7];
  const reference = evaluateHeatColumnTarget(project.heatColumnStudy, target, times);
  const readings = times.map((minute, i) => ({ minute,
    temperatureC: reference.trajectory.find(row => row.minute === minute).surfaceC,
    halfWidthC: i ? .25 : .05, use: i ? 'challenge' : 'calibration',
    source: 'Authored analytic control from the retained reference; not an acquired, independent or held-aside sensor reading' }));
  return { target, associationSource: 'Fictional surface-reading investigation on the retained two-store declaration; no acquisition occurred', hypotheses, readings };
}

