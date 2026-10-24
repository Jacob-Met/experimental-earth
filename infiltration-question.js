import { runRain } from './core.js';
import { compareInfiltration } from './infiltration-study.js';
import { greatestDepthDisagreement } from './depth-disagreement.js';

/**
 * A deterministic disagreement heuristic on the retained solver grid, not
 * expected information gain. Only calibration-compatible candidates enter;
 * held-aside values cannot choose the next question or alter its predictions.
 */
export function chooseInfiltrationQuestion(project, study = project.infiltrationStudy) {
  const comparison = compareInfiltration(project, study);
  const rates = comparison.compatibleRatesMmHr.slice().sort((a, b) => a - b);
  if (rates.length < 2) return { status: 'insufficient-alternatives', ratesMmHr: rates };
  const { target, surface } = study;
  const runs = rates.map(rateMmHr => runRain(project[target], project.width, project.height, project.weather,
    { surfaceInfiltrationOverride: { surface, rateMmHr } }));
  const { best, evaluatedCount, excludedCount } = greatestDepthDisagreement(runs, {
    recorded: project.observations.filter(reading => reading.scenario === target),
  });
  const counts = { evaluatedCount, excludedCount, ratesMmHr: rates, target, surface,
    stepMinutes: project.weather.stepMinutes };
  if (!evaluatedCount) return { status: 'all-recorded', ...counts };
  if (!best || best.spanMm <= 1e-8) return { status: 'indistinguishable', ...counts };
  const { depthsMm, ...point } = best;
  return { status: 'question', ...counts, ...point,
    predictions: rates.map((rateMmHr, index) => ({ rateMmHr, depthMm: depthsMm[index] })) };
}
