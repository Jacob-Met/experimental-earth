import { validateProject } from './core.js';
import { DEFAULT_STUDY, validateStudy } from './study-contract.js';
import { compareIntervention, INTERVENTION_METRICS } from './intervention-study.js';

// A small, user-triggered comparison, not a solver-accuracy certificate.
export const MAX_INTERVENTION_RESOLUTION_CELL_STEPS = 3_000_000;
const EPS = 1e-8;
const sign = n => n > EPS ? 1 : n < -EPS ? -1 : 0;

/** Compare exactly the same finite infiltration assumptions and two site plans
 * at successively finer *supported* solver steps. Evidence filters are not
 * reapplied: doing so could silently change the candidate population.
 * This is a sensitivity check, not convergence or physical calibration. */
export function compareInterventionResolution(project, study = project.infiltrationStudy ?? DEFAULT_STUDY) {
  validateProject(project);
  validateStudy(study);
  const baseStepMinutes = project.weather.stepMinutes;
  const stepsMinutes = [...new Set([baseStepMinutes,
    Math.max(1, baseStepMinutes / 2), Math.max(1, baseStepMinutes / 4)])];
  const affected = {
    existing: project.existing.filter(cell => cell.surface === study.surface).length,
    proposal: project.proposal.filter(cell => cell.surface === study.surface).length,
  };
  // Match the conservative three-run budget accounting used in intervention-study.
  const estimatedCellSteps = 3 * project.width * project.height * study.ratesMmHr.length *
    stepsMinutes.reduce((sum, step) => sum + Math.ceil(project.weather.durationMinutes / step), 0);
  const context = { baseStepMinutes, stepsMinutes, surface: study.surface,
    ratesMmHr: study.ratesMmHr.slice(), affected, estimatedCellSteps,
    maxCellSteps: MAX_INTERVENTION_RESOLUTION_CELL_STEPS };
  const refuse = status => ({ ...context, status, runs: [], candidates: [], metrics: {}, directionChanges: [] });
  if (!affected.existing && !affected.proposal) return refuse('surface-absent');
  if (stepsMinutes.length < 2) return refuse('minimum-step');
  if (estimatedCellSteps > MAX_INTERVENTION_RESOLUTION_CELL_STEPS) return refuse('work-limit');

  const runs = stepsMinutes.map(stepMinutes => {
    const copied = { ...project, weather: { ...project.weather, stepMinutes } };
    const report = compareIntervention(copied, { study, subset: 'all' });
    return { stepMinutes, candidates: report.candidates, metrics: report.metrics };
  });
  const candidates = study.ratesMmHr.map((rateMmHr, index) => {
    const metrics = Object.fromEntries(Object.keys(INTERVENTION_METRICS).map(key => {
      const deltas = runs.map(run => run.candidates[index].metrics[key].delta);
      const signs = deltas.map(sign);
      return [key, { deltas, signs, changedSign: signs.some(s => s !== signs[0]),
        minDelta: Math.min(...deltas), maxDelta: Math.max(...deltas),
        spread: Math.max(...deltas) - Math.min(...deltas) }];
    }));
    return { rateMmHr, metrics };
  });
  const directionChanges = Object.keys(INTERVENTION_METRICS).filter(key =>
    runs.some(run => run.metrics[key].direction !== runs[0].metrics[key].direction));
  const metrics = Object.fromEntries(Object.keys(INTERVENTION_METRICS).map(key => [key, {
    stepDirections: runs.map(run => run.metrics[key].direction),
    changedDirection: directionChanges.includes(key),
    changedCandidateSigns: candidates.filter(candidate => candidate.metrics[key].changedSign).map(candidate => candidate.rateMmHr),
  }]));
  return { ...context, status: 'compared', runs, candidates, metrics, directionChanges };
}
