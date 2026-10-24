import { runRain, validateProject } from './core.js';
import { validateStudy } from './study-contract.js';

/** Interpolate only within retained solver steps; disclose both bracket times. */
export function interpolateDepth(result, cellIndex, minute) {
  const snapshots = result.snapshots;
  if (!Number.isInteger(cellIndex) || cellIndex < 0 || cellIndex >= snapshots[0].depthsMm.length ||
      !Number.isFinite(minute) || minute < 0 || minute > snapshots.at(-1).minute) {
    throw new Error('Reading time or cell is outside the modeled event');
  }
  let lo = 0, hi = snapshots.length - 1;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (snapshots[mid].minute < minute) lo = mid + 1;
    else hi = mid;
  }
  const after = snapshots[lo];
  if (after.minute === minute) return { depthMm: after.depthsMm[cellIndex], beforeMinute: minute, afterMinute: minute, method: 'snapshot' };
  const before = snapshots[lo - 1];
  const fraction = (minute - before.minute) / (after.minute - before.minute);
  return {
    depthMm: before.depthsMm[cellIndex] + fraction * (after.depthsMm[cellIndex] - before.depthsMm[cellIndex]),
    beforeMinute: before.minute, afterMinute: after.minute, method: 'linear interpolation',
  };
}

export function evaluateReadings(result, readings) {
  const errors = readings.map(({ reading, index }) => {
    const prediction = interpolateDepth(result, reading.cellIndex, reading.minute);
    const residualMm = reading.depthMm - prediction.depthMm;
    const tolerance = 1e-9 * Math.max(1, reading.depthMm, prediction.depthMm);
    return { index, ...prediction, residualMm, withinBand: Math.abs(residualMm) <= reading.uncertaintyMm + tolerance };
  });
  return {
    count: errors.length,
    rmseMm: errors.length ? Math.sqrt(errors.reduce((sum, e) => sum + e.residualMm ** 2, 0) / errors.length) : null,
    compatible: errors.length ? errors.every(e => e.withinBand) : null,
    withinCount: errors.filter(e => e.withinBand).length,
    errors,
  };
}

/**
 * Compare finite, user-chosen hypotheses; this is not a statistical estimator.
 * Only calibration readings determine ordering. Challenge readings can reject
 * a candidate, but can never improve its rank or silently change a parameter.
 */
export function compareInfiltration(project, study = project.infiltrationStudy) {
  validateProject(project);
  validateStudy(study);
  const { target, surface, ratesMmHr } = study;
  const readings = project.observations.map((reading, index) => ({ reading, index }));
  const calibration = readings.filter(({ reading }) => reading.scenario === target && reading.use === 'calibration');
  const challenge = readings.filter(({ reading }) => reading.scenario === target && reading.use === 'challenge');
  const affectedCount = project[target].filter(cell => cell.surface === surface).length;
  const counts = { calibration: calibration.length, challenge: challenge.length,
    ignored: readings.length - calibration.length - challenge.length, affectedCells: affectedCount };
  if (!affectedCount) return { status: 'surface-absent', counts, candidates: [], compatibleRatesMmHr: [], survivingRatesMmHr: [], closestCalibrationRatesMmHr: [] };

  const candidates = ratesMmHr.map(rateMmHr => {
    const result = runRain(project[target], project.width, project.height, project.weather,
      { surfaceInfiltrationOverride: { surface, rateMmHr } });
    return { rateMmHr, calibration: evaluateReadings(result, calibration), challenge: evaluateReadings(result, challenge),
      absorbedLiters: result.absorbedLiters, exitLiters: result.exitLiters, storedLiters: result.storedLiters,
      massErrorLiters: result.massErrorLiters };
  });
  candidates.sort((a, b) => (a.calibration.rmseMm ?? 0) - (b.calibration.rmseMm ?? 0) || a.rateMmHr - b.rateMmHr);
  const compatible = candidates.filter(c => c.calibration.compatible === true);
  const bestError = candidates[0].calibration.rmseMm;
  const closest = bestError === null ? [] : candidates.filter(c =>
    Math.abs(c.calibration.rmseMm - bestError) <= 1e-9 * Math.max(1, bestError)).map(c => c.rateMmHr).sort((a, b) => a - b);
  const survivors = compatible.filter(c => c.challenge.compatible !== false);
  let status = 'ambiguous';
  if (!calibration.length) status = 'need-calibration';
  else if (!compatible.length) status = 'calibration-rejected';
  else if (challenge.length && !survivors.length) status = 'challenged';
  else if (!challenge.length) status = 'needs-challenge';
  else if (survivors.length === 1) status = 'one-survivor';
  return { status, counts, candidates, closestCalibrationRatesMmHr: closest,
    compatibleRatesMmHr: compatible.map(c => c.rateMmHr), survivingRatesMmHr: survivors.map(c => c.rateMmHr) };
}
