import { runRain, validateProject } from './core.js';

export const MAX_LOCAL_BUDGET_CELL_STEPS = 500_000;
const COMPONENTS = ['rainLiters', 'incomingLiters', 'outgoingLiters',
  'absorbedLiters', 'boundaryExitLiters', 'storedLiters'];

/** Account for one whole modeled event under the saved, unchanged assumptions. */
export function compareLocalWaterBudget(project) {
  validateProject(project);
  const cellSteps = 2 * project.width * project.height *
    Math.ceil(project.weather.durationMinutes / project.weather.stepMinutes);
  if (cellSteps > MAX_LOCAL_BUDGET_CELL_STEPS) {
    return { status: 'work-limit', cellSteps, limit: MAX_LOCAL_BUDGET_CELL_STEPS };
  }
  const run = target => runRain(project[target], project.width, project.height,
    project.weather, { traceBudget: true });
  const existing = run('existing'), proposal = run('proposal');
  return { status: 'computed', cellSteps, width: project.width, height: project.height,
    durationMinutes: project.weather.durationMinutes,
    existing: existing.waterBudget, proposal: proposal.waterBudget,
    global: {
      existing: { rainLiters: existing.rainLiters, absorbedLiters: existing.absorbedLiters,
        exitLiters: existing.exitLiters, storedLiters: existing.storedLiters,
        massErrorLiters: existing.massErrorLiters },
      proposal: { rainLiters: proposal.rainLiters, absorbedLiters: proposal.absorbedLiters,
        exitLiters: proposal.exitLiters, storedLiters: proposal.storedLiters,
        massErrorLiters: proposal.massErrorLiters },
    },
  };
}

/** Directed crossings can count the same water more than once, including reversal. */
export function inspectLocalWaterBudget(comparison, cellIndex) {
  if (comparison?.status !== 'computed' || !Number.isInteger(cellIndex) ||
      cellIndex < 0 || cellIndex >= comparison.width * comparison.height) {
    throw new Error('Select a cell within a computed local water budget');
  }
  const existing = comparison.existing.cells[cellIndex];
  const proposal = comparison.proposal.cells[cellIndex];
  const changes = Object.fromEntries(COMPONENTS.map(key => [key, proposal[key] - existing[key]]));
  const neighbors = [];
  for (let i = 0; i < comparison.existing.edges.length; i++) {
    const a = comparison.existing.edges[i], b = comparison.proposal.edges[i];
    if (a.a !== cellIndex && a.b !== cellIndex) continue;
    const isA = a.a === cellIndex;
    const incoming = isA ? 'bToALiters' : 'aToBLiters';
    const outgoing = isA ? 'aToBLiters' : 'bToALiters';
    neighbors.push({ cellIndex: isA ? a.b : a.a,
      existing: { incomingLiters: a[incoming], outgoingLiters: a[outgoing] },
      proposal: { incomingLiters: b[incoming], outgoingLiters: b[outgoing] },
      incomingChangeLiters: b[incoming] - a[incoming],
      outgoingChangeLiters: b[outgoing] - a[outgoing],
    });
  }
  neighbors.sort((a, b) => a.cellIndex - b.cellIndex);
  const explainedStorageChangeLiters = changes.rainLiters + changes.incomingLiters -
    changes.outgoingLiters - changes.absorbedLiters - changes.boundaryExitLiters;
  return { cellIndex, existing, proposal, changes, neighbors, explainedStorageChangeLiters,
    changeBalanceErrorLiters: explainedStorageChangeLiters - changes.storedLiters };
}

// Selection, notebook readings and other investigative controls do not change a
// saved-assumption budget. Weather and both geometries do; retain unknown weather
// fields so later qualified forcing extensions also invalidate this consumer.
export function localBudgetInputKey(project) {
  return JSON.stringify({ width: project.width, height: project.height,
    weather: project.weather, existing: project.existing, proposal: project.proposal });
}
