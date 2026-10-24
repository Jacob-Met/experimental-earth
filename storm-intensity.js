import { runRain, validateProject } from './core.js';

// Every alternative changes only the declared constant rainfall intensity.
// The existing site, proposal, elapsed time and other assumptions are identical.
export const STORM_INTENSITY_METRICS = Object.freeze([
  ['exitLiters', 'Edge outflow', 'L'],
  ['peakPondingLiters', 'Peak standing water', 'L'],
  ['storedLiters', 'Final standing water', 'L'],
  ['maxDepthMm', 'Maximum cell depth', 'mm'],
]);
export const STORM_INTENSITY_WORK_LIMIT = 600_000;
const finite = n => typeof n === 'number' && Number.isFinite(n);

export function validateStormIntensities(project, rates) {
  validateProject(project);
  // Refuse an active timeline instead of overriding its rainfall provenance.
  if (Object.keys(project.weather).some(key =>
    /^rain(?:Timeline|Series|Segments|Schedule)$/i.test(key) &&
    project.weather[key] !== null && project.weather[key] !== undefined)) {
    throw new Error('This study supports constant-intensity storms only; retain the rainfall timeline for a separate comparison.');
  }
  if (!Array.isArray(rates) || rates.length < 2 || rates.length > 7 ||
      rates.some(rate => !finite(rate) || rate < 0 || rate > 250) ||
      new Set(rates).size !== rates.length) {
    throw new Error('Enter 2–7 distinct finite storm intensities from 0 to 250 mm/hour.');
  }
  const ordered = [...rates].sort((a, b) => a - b);
  const cellSteps = 2 * ordered.length * project.width * project.height *
    Math.ceil(project.weather.durationMinutes / project.weather.stepMinutes);
  if (cellSteps > STORM_INTENSITY_WORK_LIMIT) {
    throw new Error('Storm comparison exceeds the 600,000 estimated cell-step budget; use fewer rates, a shorter duration, or a smaller grid.');
  }
  return { ratesMmHr: ordered, cellSteps };
}

export function summarizeStormDifferences(deltas, magnitudes) {
  if (!Array.isArray(deltas) || !deltas.length || deltas.some(x => !finite(x)) ||
      !Array.isArray(magnitudes) || magnitudes.length !== deltas.length ||
      magnitudes.some(x => !finite(x) || x < 0)) throw new Error('Invalid comparison differences');
  const signs = deltas.map((delta, i) => {
    const tolerance = Math.max(1e-7, 1e-10 * magnitudes[i]);
    return delta > tolerance ? 1 : delta < -tolerance ? -1 : 0;
  });
  const lower = signs.filter(x => x === -1).length;
  const higher = signs.filter(x => x === 1).length;
  const unchanged = signs.length - lower - higher;
  const finding = lower && higher ? 'mixed directions across tested storms' :
    lower && unchanged ? 'lower or unchanged across tested storms' :
    higher && unchanged ? 'higher or unchanged across tested storms' :
    lower ? 'lower at every tested intensity' :
    higher ? 'higher at every tested intensity' :
    'no resolved numerical difference at tested intensities';
  return { lower, higher, unchanged, finding };
}

export function compareStormIntensities(project, rates) {
  const { ratesMmHr, cellSteps } = validateStormIntensities(project, rates);
  const sourceSignature = JSON.stringify(project);
  const rows = ratesMmHr.map(rainMmHr => {
    const weather = { ...project.weather, rainMmHr };
    const existing = runRain(project.existing, project.width, project.height, weather);
    const proposal = runRain(project.proposal, project.width, project.height, weather);
    if (Math.abs(existing.rainLiters - proposal.rainLiters) >
      Math.max(1e-7, 1e-10 * existing.rainLiters)) {
      throw new Error('Paired storm simulations did not use equal rainfall.');
    }
    const metrics = Object.fromEntries(STORM_INTENSITY_METRICS.map(([key]) =>
      [key, { existing: existing[key], proposal: proposal[key],
        delta: proposal[key] - existing[key] }]));
    return {
      rainMmHr, rainLiters: existing.rainLiters, metrics,
      massErrorLiters: { existing: existing.massErrorLiters, proposal: proposal.massErrorLiters },
    };
  });
  const findings = Object.fromEntries(STORM_INTENSITY_METRICS.map(([key]) =>
    [key, summarizeStormDifferences(
      rows.map(row => row.metrics[key].delta),
      rows.map(row => Math.max(Math.abs(row.metrics[key].existing),
        Math.abs(row.metrics[key].proposal))))]));
  return {
    status: 'compared', sourceSignature, ratesMmHr, cellSteps, rows, findings,
    meaning: 'Conditional constant-rainfall alternatives on unchanged geometry and assumptions. ' +
      'The notebook is not refitted and its measurements are not evidence for the alternate storms. ' +
      'Lower modeled outflow or ponding is not a calibrated safety or flood prediction.',
  };
}
