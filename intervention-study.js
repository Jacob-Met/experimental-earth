import { runRain, validateProject } from './core.js';
import { compareInfiltration } from './infiltration-study.js';
import { DEFAULT_STUDY, validateStudy } from './study-contract.js';

export const INTERVENTION_METRICS = Object.freeze({
  exitLiters: { label: 'Edge outflow', unit: 'L' },
  peakPondingLiters: { label: 'Peak standing water', unit: 'L' },
  storedLiters: { label: 'Final stored water', unit: 'L' },
  maxDepthMm: { label: 'Maximum cell depth', unit: 'mm' },
});
const EPS = 1e-8;
export function summarizeEffects(values) {
  const min = Math.min(...values), max = Math.max(...values);
  return { min, max, direction: min < -EPS && max > EPS ? 'reverses' :
    max < -EPS ? 'lower' : min > EPS ? 'higher' :
    min >= -EPS && max <= EPS ? 'unchanged' : min < -EPS ? 'lower-or-equal' : 'higher-or-equal' };
}
/** Paired finite hypotheses, not probabilities. Same rate transfers to every
 * cell of the chosen surface in BOTH scenarios; other surfaces keep defaults. */
export function compareIntervention(project, { study = project.infiltrationStudy ?? DEFAULT_STUDY, subset = 'all', allowAbsentSurface = false } = {}) {
  validateProject(project); validateStudy(study);
  if (!['all', 'calibration', 'surviving'].includes(subset)) throw Error('Unknown hypothesis subset');
  if (typeof allowAbsentSurface !== 'boolean') throw Error('Absent-surface evaluation must be an explicit boolean');
  if (allowAbsentSurface && subset !== 'all') throw Error('Absent-surface evaluation cannot filter evidence');
  // Three simulations per candidate at most, including evidence comparison.
  const work = study.ratesMmHr.length * 3 * project.width * project.height * Math.ceil(project.weather.durationMinutes / project.weather.stepMinutes);
  if (work > 3000000) throw Error('This comparison exceeds the 3 million cell-step budget. Reduce grid, duration or candidate count.');
  const evidence = subset === 'all' ? null : compareInfiltration(project, study);
  if (subset !== 'all' && !evidence.counts.calibration) return { status: 'need-calibration', candidates: [], metrics: {}, cells: [], subset };
  if (subset === 'surviving' && !evidence.counts.challenge) return { status: 'need-challenge', candidates: [], metrics: {}, cells: [], subset };
  const rates = subset === 'all' ? study.ratesMmHr : subset === 'calibration' ? evidence.compatibleRatesMmHr : evidence.survivingRatesMmHr;
  if (!rates.length) return { status: 'no-compatible-rates', candidates: [], metrics: {}, cells: [], subset };
  const affected = Object.fromEntries(['existing', 'proposal'].map(target => [target, project[target].filter(c => c.surface === study.surface).length]));
  if (!affected.existing && !affected.proposal && !allowAbsentSurface) return { status: 'surface-absent', candidates: [], metrics: {}, cells: [], subset };
  const candidates = rates.map(rateMmHr => {
    const options = { surfaceInfiltrationOverride: { surface: study.surface, rateMmHr } };
    const existing = runRain(project.existing, project.width, project.height, project.weather, options);
    const proposal = runRain(project.proposal, project.width, project.height, project.weather, options);
    const metrics = Object.fromEntries(Object.keys(INTERVENTION_METRICS).map(key => [key, { existing: existing[key], proposal: proposal[key], delta: proposal[key] - existing[key] }]));
    return { rateMmHr, metrics, peakDeltaMm: proposal.peakDepthMm.map((depth, i) => depth - existing.peakDepthMm[i]),
      massErrorLiters: { existing: existing.massErrorLiters, proposal: proposal.massErrorLiters } };
  });
  const metrics = Object.fromEntries(Object.keys(INTERVENTION_METRICS).map(key => [key, summarizeEffects(candidates.map(c => c.metrics[key].delta))]));
  const cells = project.existing.map((_, cellIndex) => ({ cellIndex, ...summarizeEffects(candidates.map(c => c.peakDeltaMm[cellIndex])) }))
    .filter(c => c.max > EPS).sort((a, b) => b.max - a.max || a.cellIndex - b.cellIndex);
  return { status: 'compared', subset, surface: study.surface, evidenceTarget: study.target, affected, candidates, metrics, cells, cellStepUpperBound: work };
}
