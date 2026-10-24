import { runRain, validateProject } from './core.js';
import { interpolateDepth } from './infiltration-study.js';
import { predictCollectedVolume, OUTLET_WORK_LIMIT } from './outlet-evidence.js';
import { outletContext, OUTLET_UNITS } from './outlet-evidence-contract.js';
import { JOINT_EVIDENCE_SCHEMA, validateJointStudy, outletEventIdentity, readingIdentity } from './joint-evidence-contract.js';

export function prepareJointStudy(project, { surface, pairs, depthIndices = [], depthAssociation = '' }) {
  validateProject(project);
  const record = project.outletEvidence;
  if (!record || record.durationMinutes !== project.weather.durationMinutes || record.contextJson !== outletContext(project, record.target)) {
    throw new Error('The outlet record must belong to the current observed site and weather.');
  }
  if (!Array.isArray(depthIndices)) throw new Error('Select notebook readings explicitly.');
  const depthReferences = depthIndices.map(index => {
    const reading = project.observations[index];
    if (!Number.isInteger(index) || !reading || reading.scenario !== record.target ||
        !['calibration', 'challenge'].includes(reading.use)) {
      throw new Error('Associate only explicitly assigned readings of the same observed scenario.');
    }
    return { index, readingJson: readingIdentity(reading) };
  });
  const study = { schema: JOINT_EVIDENCE_SCHEMA, target: record.target, surface,
    pairs: structuredClone(pairs), outletIdentity: outletEventIdentity(record),
    depthReferences, depthAssociation: depthAssociation.trim() };
  validateJointStudy(study);
  return study;
}

function summarize(errors, unit) {
  return { count: errors.length, compatible: errors.length ? errors.every(e => e.withinBand) : null,
    rmse: errors.length ? Math.sqrt(errors.reduce((sum, e) => sum + e.residual ** 2, 0) / errors.length) : null,
    unit, errors };
}
function assess(result, depthEntries, volumeEntries) {
  const depth = summarize(depthEntries.map(({ index, reading }) => {
    const prediction = interpolateDepth(result, reading.cellIndex, reading.minute);
    const residual = reading.depthMm - prediction.depthMm;
    return { index, ...prediction, observed: reading.depthMm, tolerance: reading.uncertaintyMm,
      predicted: prediction.depthMm, residual,
      withinBand: Math.abs(residual) <= reading.uncertaintyMm + 1e-9 * Math.max(1, reading.depthMm, prediction.depthMm) };
  }), 'mm');
  const volume = summarize(volumeEntries.map(({ index, reading }) => {
    const prediction = predictCollectedVolume(result, reading);
    const observed = reading.volume * OUTLET_UNITS[reading.unit], tolerance = reading.uncertainty * OUTLET_UNITS[reading.unit];
    const residual = observed - prediction.volumeLiters;
    return { index, ...prediction, observed, tolerance, predicted: prediction.volumeLiters, residual,
      withinBand: Math.abs(residual) <= tolerance + 1e-9 * Math.max(1, observed, prediction.volumeLiters) };
  }), 'L');
  const count = depth.count + volume.count;
  return { depth, volume, count, compatible: count ? depth.compatible !== false && volume.compatible !== false : null };
}

/** One maintained simulation per explicit pair. No ranking across unlike units. */
export function compareJointEvidence(project, study = project.jointEvidenceStudy) {
  validateProject(project); validateJointStudy(study);
  if (!study) throw new Error('Save an explicit pair set and evidence association first.');
  const record = project.outletEvidence;
  const empty = { candidates: [], compatiblePairs: [], survivingPairs: [] };
  if (!record || record.durationMinutes !== project.weather.durationMinutes || study.target !== record.target || study.outletIdentity !== outletEventIdentity(record) ||
      record.contextJson !== outletContext(project, record.target)) return { ...empty, status: 'context-changed' };
  const selected = [];
  for (const ref of study.depthReferences) {
    const reading = project.observations[ref.index];
    if (!reading || ref.readingJson !== readingIdentity(reading) || reading.scenario !== study.target ||
        !['calibration', 'challenge'].includes(reading.use)) return { ...empty, status: 'depth-evidence-changed' };
    selected.push({ index: ref.index, reading });
  }
  const volumes = record.readings.map((reading, index) => ({ reading, index }));
  const byRole = (entries, role) => entries.filter(e => e.reading.use === role);
  const calibrationDepth = byRole(selected, 'calibration'), challengeDepth = byRole(selected, 'challenge');
  const calibrationVolume = byRole(volumes, 'calibration'), challengeVolume = byRole(volumes, 'challenge');
  const counts = { calibrationDepth: calibrationDepth.length, challengeDepth: challengeDepth.length,
    calibrationVolume: calibrationVolume.length, challengeVolume: challengeVolume.length,
    ignoredDepth: project.observations.length - selected.length,
    ignoredVolume: volumes.length - calibrationVolume.length - challengeVolume.length,
    affectedCells: project[study.target].filter(cell => cell.surface === study.surface).length };
  if (!counts.affectedCells) return { ...empty, counts, status: 'surface-absent' };
  const cellSteps = project.width * project.height * Math.ceil(project.weather.durationMinutes / project.weather.stepMinutes) * study.pairs.length;
  if (cellSteps > OUTLET_WORK_LIMIT) return { ...empty, counts, cellSteps, workLimit: OUTLET_WORK_LIMIT, status: 'work-limit' };
  const candidates = study.pairs.map(pair => {
    const result = runRain(project[study.target], project.width, project.height,
      { ...project.weather, boundaryExitPerHour: pair.outletPerHour },
      { surfaceInfiltrationOverride: { surface: study.surface, rateMmHr: pair.infiltrationMmHr } });
    return { ...pair, calibration: assess(result, calibrationDepth, calibrationVolume),
      challenge: assess(result, challengeDepth, challengeVolume),
      absorbedLiters: result.absorbedLiters, exitLiters: result.exitLiters,
      storedLiters: result.storedLiters, massErrorLiters: result.massErrorLiters };
  });
  const compatible = candidates.filter(c => c.calibration.compatible === true);
  const surviving = compatible.filter(c => c.challenge.compatible !== false);
  let status = 'ambiguous';
  if (!counts.calibrationDepth && !counts.calibrationVolume) status = 'need-calibration';
  else if (!compatible.length) status = 'calibration-rejected';
  else if ((counts.challengeDepth || counts.challengeVolume) && !surviving.length) status = 'challenged';
  else if (!counts.challengeDepth && !counts.challengeVolume) status = 'needs-challenge';
  else if (surviving.length === 1) status = 'one-survivor';
  return { status, counts, cellSteps, stepMinutes: project.weather.stepMinutes, candidates,
    compatiblePairs: compatible.map(c => c.label), survivingPairs: surviving.map(c => c.label) };
}
