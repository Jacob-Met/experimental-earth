import { validateProject, runRain } from './core.js';
import { validateStudy } from './study-contract.js';
import { compareInfiltration } from './infiltration-study.js';
import { planComplementaryDepths } from './complementary-depth-plan.js';

export const COMPLEMENTARY_WORK_LIMIT = 1_000_000;

/** Reuse the maintained calibration interpretation, never select by challenge values. */
export function planInfiltrationReadings(project, options, study = project.infiltrationStudy) {
  validateProject(project);
  validateStudy(study);
  // Validate planning controls before paying for any solver run.
  planComplementaryDepths([], options);
  const cellSteps = 2 * study.ratesMmHr.length * project.width * project.height *
    Math.ceil(project.weather.durationMinutes / project.weather.stepMinutes);
  if (cellSteps > COMPLEMENTARY_WORK_LIMIT) throw Error('Complementary reading planning exceeds one million estimated cell-steps; reduce grid, duration or candidate count');
  const comparison = compareInfiltration(project, study);
  const ratesMmHr = [...comparison.compatibleRatesMmHr].sort((a, b) => a - b);
  const runs = ratesMmHr.map(rateMmHr => runRain(project[study.target], project.width, project.height,
    project.weather, { surfaceInfiltrationOverride: { surface: study.surface, rateMmHr } }));
  const report = planComplementaryDepths(runs, { ...options,
    recorded: project.observations.filter(reading => reading.scenario === study.target) });
  return { ...report, ratesMmHr, target: study.target, surface: study.surface,
    stepMinutes: project.weather.stepMinutes, cellStepUpperBound: cellSteps,
    calibrationStatus: comparison.status };
}
