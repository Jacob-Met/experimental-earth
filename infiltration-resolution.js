import { validateProject } from './core.js';
import { validateStudy } from './study-contract.js';
import { compareInfiltration } from './infiltration-study.js';

// Bounds an explicit interactive diagnostic; this is not a solver accuracy limit.
export const MAX_RESOLUTION_CELL_STEPS = 2_000_000;
function sameRates(a, b) {
  const ordered = b.slice().sort((x, y) => x - y);
  return a.length === b.length && a.slice().sort((x, y) => x - y).every((rate, i) => rate === ordered[i]);
}

/**
 * Repeat the same hypotheses/readings at distinct dt, dt/2 and dt/4, bounded by
 * the solver's one-minute minimum. Only the copied weather.stepMinutes changes.
 * This checks decision sensitivity, not convergence, an error bound or physics.
 */
export function compareInfiltrationResolution(project, study = project.infiltrationStudy) {
  validateProject(project);
  validateStudy(study);
  const baseStepMinutes = project.weather.stepMinutes;
  const stepsMinutes = [...new Set([baseStepMinutes, Math.max(1, baseStepMinutes / 2), Math.max(1, baseStepMinutes / 4)])];
  const affectedCells = project[study.target].filter(cell => cell.surface === study.surface).length;
  const assignedReadings = project.observations.filter(reading =>
    reading.scenario === study.target && ['calibration', 'challenge'].includes(reading.use)).length;
  const estimatedCellSteps = project.width * project.height * study.ratesMmHr.length *
    stepsMinutes.reduce((sum, step) => sum + Math.ceil(project.weather.durationMinutes / step), 0);
  const context = { baseStepMinutes, stepsMinutes, target: study.target, surface: study.surface,
    affectedCells, assignedReadings, estimatedCellSteps, maxCellSteps: MAX_RESOLUTION_CELL_STEPS };
  const refusal = status => ({ ...context, status, runs: [], candidates: [], changes: null });
  if (!affectedCells) return refusal('surface-absent');
  if (!assignedReadings) return refusal('no-assigned-readings');
  if (stepsMinutes.length < 2) return refusal('minimum-step');
  if (estimatedCellSteps > MAX_RESOLUTION_CELL_STEPS) return refusal('work-limit');

  const runs = stepsMinutes.map(stepMinutes => ({ stepMinutes,
    ...compareInfiltration({ ...project, weather: { ...project.weather, stepMinutes } }, study) }));
  // Preserve calibration-only order. Comparing every raw rank would mistake
  // floating-point near ties for a change to the tolerance-aware closest set.
  const candidates = runs[0].candidates.map(candidate => {
    const matching = runs.map(run => run.candidates.find(c => c.rateMmHr === candidate.rateMmHr));
    const readings = ['calibration', 'challenge'].flatMap(role => candidate[role].errors.map(error => {
      const predictions = matching.map((c, i) => ({ stepMinutes: stepsMinutes[i],
        ...c[role].errors.find(e => e.index === error.index) }));
      const depths = predictions.map(p => p.depthMm);
      const minDepthMm = Math.min(...depths), maxDepthMm = Math.max(...depths);
      return { index: error.index, role, minDepthMm, maxDepthMm, spreadMm: maxDepthMm - minDepthMm,
        bandChanged: predictions.some(p => p.withinBand !== predictions[0].withinBand), predictions };
    }));
    return { rateMmHr: candidate.rateMmHr, readings };
  });
  const changes = {
    closestCalibration: runs.some(run => !sameRates(run.closestCalibrationRatesMmHr, runs[0].closestCalibrationRatesMmHr)),
    calibrationCompatible: runs.some(run => !sameRates(run.compatibleRatesMmHr, runs[0].compatibleRatesMmHr)),
    surviving: runs.some(run => !sameRates(run.survivingRatesMmHr, runs[0].survivingRatesMmHr)),
    readingBands: candidates.some(candidate => candidate.readings.some(reading => reading.bandChanged)),
  };
  return { ...context, status: Object.values(changes).some(Boolean) ? 'step-sensitive' : 'no-decision-change',
    changes, runs, candidates };
}
