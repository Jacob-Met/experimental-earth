import { runRain, validateProject } from './core.js';
import { INTERVENTION_METRICS, summarizeEffects } from './intervention-study.js';

const MAX_CELL_STEPS = 3_000_000;
const EPS = 1e-8;
const METRICS = Object.keys(INTERVENTION_METRICS);

/**
 * Hypothetical outlet coefficients, not site measurements or probabilities.
 * The current authored coefficient is always among the default alternatives.
 */
export function defaultOutletRates(weather) {
  if (!weather || typeof weather.boundaryExitPerHour !== 'number' ||
      !Number.isFinite(weather.boundaryExitPerHour) ||
      weather.boundaryExitPerHour < 0 || weather.boundaryExitPerHour > 10) {
    throw new Error('Invalid authored outlet rate');
  }
  return [...new Set([0, weather.boundaryExitPerHour, 2, 5])].slice(0, 3);
}

export function validateOutletRates(ratesPerHour) {
  if (!Array.isArray(ratesPerHour) || ratesPerHour.length < 2 ||
      ratesPerHour.length > 7 ||
      ratesPerHour.some(rate => typeof rate !== 'number' ||
        !Number.isFinite(rate) || rate < 0 || rate > 10) ||
      new Set(ratesPerHour).size !== ratesPerHour.length) {
    throw new Error('Use 2–7 distinct finite outlet coefficients between 0 and 10 per hour');
  }
  return ratesPerHour;
}

/**
 * Run the *same rainfall, geometry and surface properties* in each pair.
 * Only the outer-boundary sink coefficient changes between hypotheses.
 * A result describes numerical sensitivity; it does not choose or calibrate
 * a physical drainage rate, endorse an intervention, or alter the project.
 */
export function compareOutletScenarios(project, { ratesPerHour } = {}) {
  validateProject(project);
  const rates = validateOutletRates(ratesPerHour === undefined ?
    defaultOutletRates(project.weather) : ratesPerHour);
  const cellStepUpperBound = 2 * project.width * project.height *
    Math.ceil(project.weather.durationMinutes / project.weather.stepMinutes) *
    rates.length;
  if (cellStepUpperBound > MAX_CELL_STEPS) {
    throw new Error('Outlet comparison exceeds the 3 million cell-step budget');
  }

  const candidates = rates.map(ratePerHour => {
    const weather = { ...project.weather, boundaryExitPerHour: ratePerHour };
    const existing = runRain(project.existing, project.width, project.height, weather);
    const proposal = runRain(project.proposal, project.width, project.height, weather);
    const metrics = Object.fromEntries(METRICS.map(key => [key, {
      existing: existing[key], proposal: proposal[key],
      delta: proposal[key] - existing[key],
    }]));
    return {
      ratePerHour, metrics,
      rainLiters: { existing: existing.rainLiters, proposal: proposal.rainLiters },
      massErrorLiters: { existing: existing.massErrorLiters, proposal: proposal.massErrorLiters },
      peakDeltaMm: proposal.peakDepthMm.map((depth, i) => depth - existing.peakDepthMm[i]),
    };
  });
  const metrics = Object.fromEntries(METRICS.map(key =>
    [key, summarizeEffects(candidates.map(c => c.metrics[key].delta))]));
  const potentiallyWorseCells = project.existing.map((_, cellIndex) => {
    const envelope = summarizeEffects(candidates.map(c => c.peakDeltaMm[cellIndex]));
    return { cellIndex, ...envelope };
  }).filter(c => c.max > EPS)
    .sort((a, b) => b.max - a.max || a.cellIndex - b.cellIndex);

  return {
    status: 'compared',
    authoredRatePerHour: project.weather.boundaryExitPerHour,
    candidateCount: candidates.length,
    candidates, metrics, potentiallyWorseCells, cellStepUpperBound,
    interpretation: 'Paired conceptual sensitivity only. Neither outlet rate nor actual benefit is calibrated.',
  };
}
