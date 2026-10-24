import { validateProject } from './core.js';
import { inspectSurfaceHeat, absorbedSurfaceHeatEnergy } from './surface-heat.js';
import { HEAT_EVIDENCE_SCHEMA, HEAT_ENERGY_EVIDENCE_SCHEMA, validateHeatEvidence, heatEvidenceCurrent } from './surface-heat-evidence-contract.js';

export function prepareHeatEvidence(project, input) {
  validateProject(project);
  if (!project.surfaceHeatStudy) throw Error('Save a source-bound heat exposure before associating temperature evidence.');
  const energyReadings = input.energyReadings === undefined ? [] : structuredClone(input.energyReadings);
  if (!Array.isArray(energyReadings)) throw Error('Supply an array of absorbed-energy readings.');
  if (input.energyQuantity !== undefined && input.energyQuantity !== 'absorbed-input') {
    throw Error('The supplied energy quantity must explicitly be absorbed input; incident energy and stored heat cannot be relabeled.');
  }
  const evidence = validateHeatEvidence({ schema: energyReadings.length ? HEAT_ENERGY_EVIDENCE_SCHEMA : HEAT_EVIDENCE_SCHEMA,
    heatStudy: structuredClone(project.surfaceHeatStudy), target: input.target,
    associationSource: input.associationSource, hypotheses: structuredClone(input.hypotheses), readings: structuredClone(input.readings),
    ...(energyReadings.length ? { energyQuantity: 'absorbed-input', energyReadings } : {}) });
  if (!heatEvidenceCurrent(project, evidence)) throw Error('The saved heat exposure no longer matches the selected place.');
  return evidence;
}

function screen(rows) {
  return { count: rows.length, compatible: rows.length ? rows.every(row => row.withinBand) : null,
    withinCount: rows.filter(row => row.withinBand).length, rows };
}

// Shared role-preserving finite screening for both maintained heat models.
export { screen as screenHeatReadings };

/** Finite, declared hypotheses. Challenge readings never refit or rank them. */
export function compareHeatEvidence(project) {
  validateProject(project);
  const evidence = project.surfaceHeatEvidence;
  if (!evidence) return { status: 'no-evidence' };
  validateHeatEvidence(evidence);
  if (!heatEvidenceCurrent(project, evidence)) return { status: 'context-changed' };
  const durationMinutes = evidence.heatStudy.schedule.reduce((sum, row) => sum + row.minutes, 0);
  const boundaries = [0];
  for (const row of evidence.heatStudy.schedule) boundaries.push(boundaries.at(-1) + row.minutes);
  const times = [...new Set([...boundaries, ...evidence.readings.map(r => r.minute),
    ...Array.from({ length: 121 }, (_, i) => durationMinutes * i / 120)])].sort((a, b) => a - b);
  const candidates = evidence.hypotheses.map(h => {
    const study = { ...evidence.heatStudy, existing: h, proposal: h };
    // Every segment endpoint is evaluated, including unobserved intervals. An
    // unsupported trajectory cannot be accepted just because its readings fit.
    const trajectory = times.map(minute => ({ minute, ...inspectSurfaceHeat(study, minute).existing }));
    const temperatureRows = evidence.readings.map((reading, index) => {
      const prediction = inspectSurfaceHeat(study, reading.minute).existing;
      const residualC = reading.temperatureC - prediction.temperatureC;
      const arithmeticGuardC = Number.EPSILON * 128 * Math.max(1, Math.abs(reading.temperatureC), Math.abs(prediction.temperatureC));
      return { kind: 'temperature', index, use: reading.use, minute: reading.minute, predictionC: prediction.temperatureC, residualC, arithmeticGuardC,
        withinBand: Math.abs(residualC) <= reading.halfWidthC + arithmeticGuardC };
    });
    const energyRows = (evidence.energyReadings ?? []).map((reading, index) => {
      const predictionJm2 = absorbedSurfaceHeatEnergy(study, 'existing', reading.fromMinute, reading.toMinute);
      const residualJm2 = reading.energyJm2 - predictionJm2;
      // A tiny window near a flux change can be dominated by accumulated
      // schedule-time rounding, even when its predicted energy is almost zero.
      // Include that absolute scale, not only the computed energy magnitude.
      const peakAbsorbedWm2 = h.absorptivity * Math.max(...study.schedule.map(row => row.incidentWm2));
      const boundaryScaleJm2 = peakAbsorbedWm2 * 60 * durationMinutes * study.schedule.length ** 2;
      const arithmeticGuardJm2 = Number.EPSILON * 128 * Math.max(1, reading.energyJm2, predictionJm2, boundaryScaleJm2);
      return { kind: 'absorbed-input', index, use: reading.use, fromMinute: reading.fromMinute, toMinute: reading.toMinute,
        predictionJm2, residualJm2, arithmeticGuardJm2, withinBand: Math.abs(residualJm2) <= reading.halfWidthJm2 + arithmeticGuardJm2 };
    });
    const rows = [...temperatureRows, ...energyRows];
    return { label: h.label, calibration: screen(rows.filter(r => r.use === 'calibration')),
      challenge: screen(rows.filter(r => r.use === 'challenge')), trajectory,
      final: trajectory.at(-1), responseRatios: { inputPerCapacity: h.absorptivity / h.capacityJm2K,
        exchangePerCapacity: h.exchangeWm2K / h.capacityJm2K, initialC: h.initialC } };
  });
  const calibration = candidates.filter(c => c.calibration.compatible === true);
  const survivors = calibration.filter(c => c.challenge.compatible !== false);
  const allReadings = [...evidence.readings, ...(evidence.energyReadings ?? [])];
  const calibrationCount = allReadings.filter(r => r.use === 'calibration').length;
  const challengeCount = allReadings.length - calibrationCount;
  let status = 'ambiguous';
  if (!calibrationCount) status = 'need-calibration';
  else if (!calibration.length) status = 'calibration-rejected';
  else if (challengeCount && !survivors.length) status = 'challenged';
  else if (!challengeCount) status = 'needs-challenge';
  else if (survivors.length === 1) status = 'one-survivor';
  const energyRanges = {};
  for (const key of ['inputJm2', 'exchangedJm2', 'storedJm2']) {
    const values = survivors.map(c => c.final[key]);
    energyRanges[key] = values.length ? { minimum: Math.min(...values), maximum: Math.max(...values) } : null;
  }
  return { status, durationMinutes, candidates, counts: { calibration: calibrationCount, challenge: challengeCount },
    modalities: { temperature: evidence.readings.length, absorbedEnergy: evidence.energyReadings?.length ?? 0 },
    calibrationLabels: calibration.map(c => c.label), survivingLabels: survivors.map(c => c.label), energyRanges };
}

export function authoredHeatEvidenceExample(project, target = 'existing') {
  if (!project.surfaceHeatStudy) throw Error('Save a heat exposure before loading this authored example.');
  const initialC = project.surfaceHeatStudy[target].initialC;
  const hypotheses = [
    { label: 'A · reference', absorptivity: .4, capacityJm2K: 40000, exchangeWm2K: 10, initialC, source: 'Authored hypothesis, not an acquired material property' },
    { label: 'B · twice every heat coefficient', absorptivity: .8, capacityJm2K: 80000, exchangeWm2K: 20, initialC, source: 'Authored common-scale alternative; same response ratios, different energy' },
    { label: 'C · slower response', absorptivity: .4, capacityJm2K: 80000, exchangeWm2K: 10, initialC, source: 'Authored changed-capacity alternative' },
  ];
  const duration = project.surfaceHeatStudy.schedule.reduce((sum, row) => sum + row.minutes, 0);
  const reference = { ...project.surfaceHeatStudy, existing: hypotheses[0], proposal: hypotheses[0] };
  const readings = [.1, .25, .5, .75, 1].map((fraction, index) => ({ minute: duration * fraction,
    temperatureC: inspectSurfaceHeat(reference, duration * fraction).existing.temperatureC, halfWidthC: .05,
    use: index < 3 ? 'calibration' : 'challenge', source: 'Authored analytic control generated from hypothesis A; not a measured or independently held-aside reading' }));
  return { target, hypotheses, readings, associationSource: 'Fictional controlled illustration on the retained exposure; no temperature acquisition has occurred' };
}

export function authoredHeatEnergyExample(project, target = 'existing') {
  const example = authoredHeatEvidenceExample(project, target);
  const study = { ...project.surfaceHeatStudy, existing: example.hypotheses[0], proposal: example.hypotheses[0] };
  const toMinute = study.schedule.reduce((sum, row) => sum + row.minutes, 0);
  const energyJm2 = absorbedSurfaceHeatEnergy(study, 'existing', 0, toMinute);
  example.energyReadings = [{ fromMinute: 0, toMinute, energyJm2, halfWidthJm2: Math.max(1, energyJm2 * .01),
    use: 'challenge', source: 'Authored absorbed-input control generated from hypothesis A; not a measured, independent or held-aside sensor reading' }];
  example.associationSource = 'Fictional combined temperature/absorbed-energy illustration on the retained exposure; no acquisition has occurred';
  return example;
}
