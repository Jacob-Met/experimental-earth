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

export function surfaceElevationEdits(project) {
  validateProject(project);
  return {
    surfaceIndices: project.existing.flatMap((cell, i) => cell.surface !== project.proposal[i].surface ? [i] : []),
    elevationIndices: project.existing.flatMap((cell, i) => cell.elevationM !== project.proposal[i].elevationM ? [i] : []),
    barriersChanged: !sameInternalBarriers(project.existing, project.proposal),
  };
}

/** Split the two property families, which may overlap in the same cell. */
export function compareSurfaceElevation(project) {
  return componentExperiment(project, undefined, {}, 'surface-elevation');
}

/** Separate canonical edge declarations from surface and ground changes. */
export function edgeGroundEdits(project) {
  validateProject(project);
  return {
    edgeIndices: project.existing.flatMap((cell, i) => sameInternalBarriers([cell], [project.proposal[i]]) ? [] : [i]),
    groundIndices: project.existing.flatMap((cell, i) => cell.surface !== project.proposal[i].surface || cell.elevationM !== project.proposal[i].elevationM ? [i] : []),
  };
}

export function compareEdgesGround(project) {
  return componentExperiment(project, undefined, {}, 'edges-ground');
}

function withEdges(cell, edgeSource) {
  const result = structuredClone(cell);
  delete result.internalBarriers;
  if (edgeSource.internalBarriers !== undefined) result.internalBarriers = structuredClone(edgeSource.internalBarriers);
  result.provenance = 'Derived edge/ground combination; retained source plans contain original declarations';
  return result;
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

function experimentPlan(project, selectedIndices, partition) {
  if (partition === 'edges-ground') {
    const edits = edgeGroundEdits(project);
    if (!edits.edgeIndices.length || !edits.groundIndices.length) throw Error('Add both an internal edge change and a surface or elevation change to separate these factors.');
    return { selectedIndices: edits.edgeIndices, remainingIndices: edits.groundIndices,
      scenarios: {
        existing: project.existing,
        selected: project.existing.map((cell, i) => withEdges(cell, project.proposal[i])),
        remaining: project.proposal.map((cell, i) => withEdges(cell, project.existing[i])),
        full: project.proposal,
      } };
  }
  if (partition === 'surface-elevation') {
    const edits = surfaceElevationEdits(project);
    if (edits.barriersChanged) throw Error('Surface/elevation separation requires unchanged internal edge conditions. Changed walls or crests need the cell-group experiment.');
    if (!edits.surfaceIndices.length || !edits.elevationIndices.length) throw Error('Add both a surface change and an elevation change to separate these two factors. They may share one cell.');
    return { selectedIndices: edits.surfaceIndices, remainingIndices: edits.elevationIndices,
      scenarios: {
        existing: project.existing,
        selected: project.existing.map((cell, i) => ({ ...cell, surface: project.proposal[i].surface,
          provenance: 'Derived comparison: existing geometry and proposed surface; retained plans contain the original sources' })),
        remaining: project.proposal.map((cell, i) => ({ ...cell, surface: project.existing[i].surface,
          provenance: 'Derived comparison: proposed geometry and existing surface; retained plans contain the original sources' })),
        full: project.proposal,
      } };
  }
  if (partition !== 'cells') throw Error('Unknown component partition');
  const edited = validatePartition(project, selectedIndices);
  const selected = new Set(selectedIndices);
  return { selectedIndices: [...selected].sort((a, b) => a - b),
    remainingIndices: edited.filter(i => !selected.has(i)),
    scenarios: {
      existing: project.existing,
      selected: project.existing.map((cell, i) => selected.has(i) ? project.proposal[i] : cell),
      remaining: project.proposal.map((cell, i) => selected.has(i) ? project.existing[i] : cell),
      full: project.proposal,
    } };
}

function componentExperiment(project, selectedIndices, options = {}, partition = 'cells') {
  const plan = experimentPlan(project, selectedIndices, partition);
  const estimatedCellSteps = 4 * project.existing.length *
    Math.ceil(project.weather.durationMinutes / project.weather.stepMinutes);
  if (estimatedCellSteps > COMPONENT_WORK_LIMIT) {
    throw new Error(`Component experiment exceeds ${COMPONENT_WORK_LIMIT} estimated cell-steps.`);
  }
  const runs = Object.fromEntries(Object.entries(plan.scenarios).map(([key, cells]) =>
    [key, runRain(structuredClone(cells), project.width, project.height,
      structuredClone(project.weather), options)]));
  const values = read => decompose(...['existing', 'selected', 'remaining', 'full']
    .map(key => read(runs[key])));
  return {
    selectedIndices: plan.selectedIndices,
    remainingIndices: plan.remainingIndices,
    ...(partition !== 'cells' ? { partition } : {}),
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
    { study = project.infiltrationStudy ?? DEFAULT_STUDY, subset = 'all', partition = 'cells' } = {}) {
  experimentPlan(project, selectedIndices, partition); validateStudy(study);
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
      { surfaceInfiltrationOverride: { surface: study.surface, rateMmHr } }, partition) }));
  return { status: 'compared', subset, surface: study.surface, evidenceTarget: study.target,
    candidates, estimatedCellSteps,
    interactions: COMPONENT_METRICS.map((metric, i) => ({ ...metric,
      ...summarizeEffects(candidates.map(c => c.result.metrics[i].interaction)) })) };
}

