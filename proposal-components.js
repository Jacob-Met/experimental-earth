import { runRain, validateProject } from './core.js';
import { sameInternalBarriers } from './internal-barriers.js';

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
  const edited = componentEditIndices(project);
  if (!Array.isArray(selectedIndices) || !selectedIndices.length ||
      selectedIndices.some(i => !Number.isInteger(i) || !edited.includes(i)) ||
      new Set(selectedIndices).size !== selectedIndices.length) {
    throw new Error('Select distinct edited cells for the first component.');
  }
  if (selectedIndices.length === edited.length) {
    throw new Error('Leave at least one edited cell in the remaining component.');
  }
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
      structuredClone(project.weather))]));
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
