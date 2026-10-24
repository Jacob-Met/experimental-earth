import { runRain, validateProject } from './core.js';
import { sameInternalBarriers } from './internal-barriers.js';
import { compareInfiltration } from './infiltration-study.js';
import { DEFAULT_STUDY, validateStudy } from './study-contract.js';
import { summarizeEffects } from './intervention-study.js';

export const COMPONENT_WORK_LIMIT = 1_000_000;
export const COMPONENT_METRICS = Object.freeze([
  { key: 'exitLiters', label: 'Water leaving edges', unit: 'L' },
  { key: 'absorbedLiters', label: 'Water infiltrated', unit: 'L' },
  { key: 'storedLiters', label: 'Final stored water', unit: 'L' },
  { key: 'peakPondingLiters', label: 'Peak standing water', unit: 'L' },
  { key: 'maxDepthMm', label: 'Maximum cell depth', unit: 'mm' },
]);

// Delegate edge equivalence (open, closed, finite crest) to its maintained owner.
// Edges travel with their canonical east/south owner cell; sources are not edits.

export function componentEditIndices(project) {
  validateProject(project);
  return project.existing.flatMap((cell, i) =>
    cell.elevationM === project.proposal[i].elevationM &&
      cell.surface === project.proposal[i].surface &&
      sameInternalBarriers([cell], [project.proposal[i]]) ? [] : [i]);
}

function decompose(existing, selected, remaining, full) {
  return { existing, selected, remaining, full,
    selectedEffect: selected - existing,
    remainingEffect: remaining - existing,
    fullEffect: full - existing,
    interaction: full - selected - remaining + existing };
}

/** A finite factorial model experiment, not a causal estimate from field data. */
export function compareProposalComponents(project, selectedIndices) {
  return componentExperiment(project, selectedIndices);
}

function validatePartition(project, selectedIndices) {
  const edited = componentEditIndices(project);
  if (!Array.isArray(selectedIndices) || !selectedIndices.length ||
      selectedIndices.some(i => !Number.isInteger(i) || !edited.includes(i)) ||
      new Set(selectedIndices).size !== selectedIndices.length) {
    throw new Error('Select distinct edited cells for the first component.');
  }
  if (selectedIndices.length === edited.length) {
    throw new Error('Leave at least one edited cell in the remaining component.');
  }
  return edited;
}

function componentExperiment(project, selectedIndices, options = {}) {
  const edited = validatePartition(project, selectedIndices);
  const estimatedCellSteps = 4 * project.existing.length *
    Math.ceil(project.weather.durationMinutes / project.weather.stepMinutes);
  if (estimatedCellSteps > COMPONENT_WORK_LIMIT) {
    throw new Error(`Component experiment exceeds ${COMPONENT_WORK_LIMIT} estimated cell-steps.`);
  }
  const selected = new Set(selectedIndices);
  const scenarios = {
    existing: project.existing,
    selected: project.existing.map((cell, i) => selected.has(i) ? project.proposal[i] : cell),
    remaining: project.proposal.map((cell, i) => selected.has(i) ? project.existing[i] : cell),
    full: project.proposal,
  };
  const runs = Object.fromEntries(Object.entries(scenarios).map(([key, cells]) =>
    [key, runRain(structuredClone(cells), project.width, project.height,
      structuredClone(project.weather), options)]));
  const values = read => decompose(...['existing', 'selected', 'remaining', 'full']
    .map(key => read(runs[key])));
  return {
    selectedIndices: [...selected].sort((a, b) => a - b),
    remainingIndices: edited.filter(i => !selected.has(i)),
    estimatedCellSteps,
    metrics: COMPONENT_METRICS.map(metric => ({ ...metric,
      ...values(run => run[metric.key]) })),
    finalDepths: project.existing.map((_, cellIndex) => ({ cellIndex,
      ...values(run => run.finalDepthMm[cellIndex]) })),
    balances: Object.fromEntries(Object.entries(runs).map(([key, run]) =>
      [key, { rainLiters: run.rainLiters, massErrorLiters: run.massErrorLiters }])),
  };
}

/** Select rates from the unchanged observed source, then hold each fixed in all four cases. */
export function compareComponentHypotheses(project, selectedIndices,
    { study = project.infiltrationStudy ?? DEFAULT_STUDY, subset = 'all' } = {}) {
  validatePartition(project, selectedIndices); validateStudy(study);
  if (!['all', 'calibration', 'surviving'].includes(subset)) throw Error('Unknown hypothesis subset');
  // Bound even rejected candidates' source evidence pass before running it.
  const estimatedCellSteps = study.ratesMmHr.length * 5 * project.existing.length *
    Math.ceil(project.weather.durationMinutes / project.weather.stepMinutes);
  if (estimatedCellSteps > COMPONENT_WORK_LIMIT) throw Error('Component hypothesis comparison exceeds the combined cell-step budget.');
  const evidence = subset === 'all' ? null : compareInfiltration(project, study);
  const empty = status => ({ status, subset, surface: study.surface, evidenceTarget: study.target,
    candidates: [], interactions: [], estimatedCellSteps });
  if (evidence?.status === 'surface-absent') return empty('surface-absent-in-observed-source');
  if (evidence && !evidence.counts.calibration) return empty('need-calibration');
  if (subset === 'surviving' && !evidence.counts.challenge) return empty('need-challenge');
  const rates = subset === 'all' ? study.ratesMmHr : subset === 'calibration'
    ? evidence.compatibleRatesMmHr : evidence.survivingRatesMmHr;
  if (!rates.length) return empty('no-compatible-rates');
  if (![...project.existing, ...project.proposal].some(c => c.surface === study.surface)) return empty('surface-absent');
  const candidates = rates.map(rateMmHr => ({ rateMmHr,
    result: componentExperiment(project, selectedIndices,
      { surfaceInfiltrationOverride: { surface: study.surface, rateMmHr } }) }));
  return { status: 'compared', subset, surface: study.surface, evidenceTarget: study.target,
    candidates, estimatedCellSteps,
    interactions: COMPONENT_METRICS.map((metric, i) => ({ ...metric,
      ...summarizeEffects(candidates.map(c => c.result.metrics[i].interaction)) })) };
}
