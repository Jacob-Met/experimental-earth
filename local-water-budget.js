import { changedBarrierCells } from './internal-barriers.js';
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

/** Sum a fixed region's boundary budget; internal crossings cancel exactly by construction. */
export function inspectRegionalWaterBudget(comparison, cellIndices) {
  const n = comparison?.width * comparison?.height;
  if (comparison?.status !== 'computed' || !Array.isArray(cellIndices) ||
      !cellIndices.length || cellIndices.length > n ||
      cellIndices.some(i => !Number.isInteger(i) || i < 0 || i >= n) ||
      new Set(cellIndices).size !== cellIndices.length) {
    throw new Error('Choose a nonempty set of distinct cells within a computed water budget');
  }
  const members = [...cellIndices].sort((a, b) => a - b), inside = new Set(members);
  if (members.length === 1) {
    // Preserve the already qualified single-cell summation order exactly.
    const local = structuredClone(inspectLocalWaterBudget(comparison, members[0]));
    delete local.cellIndex; delete local.existing.cellIndex; delete local.proposal.cellIndex;
    local.existing.internalCrossingLiters = 0; local.proposal.internalCrossingLiters = 0;
    return { cellIndices: members, ...local };
  }
  const outside = new Map();
  const totals = {};
  for (const target of ['existing', 'proposal']) {
    const ledger = comparison[target];
    const total = Object.fromEntries(COMPONENTS.map(key => [key, 0]));
    total.internalCrossingLiters = 0;
    for (const i of members) for (const key of ['rainLiters', 'absorbedLiters', 'boundaryExitLiters', 'storedLiters']) {
      total[key] += ledger.cells[i][key];
    }
    for (const edge of ledger.edges) {
      const aInside = inside.has(edge.a), bInside = inside.has(edge.b);
      if (aInside && bInside) {
        total.internalCrossingLiters += edge.aToBLiters + edge.bToALiters;
      } else if (aInside !== bInside) {
        const incoming = aInside ? edge.bToALiters : edge.aToBLiters;
        const outgoing = aInside ? edge.aToBLiters : edge.bToALiters;
        total.incomingLiters += incoming; total.outgoingLiters += outgoing;
        const cellIndex = aInside ? edge.b : edge.a;
        if (!outside.has(cellIndex)) outside.set(cellIndex, { cellIndex,
          existing: { incomingLiters: 0, outgoingLiters: 0 },
          proposal: { incomingLiters: 0, outgoingLiters: 0 } });
        const neighbor = outside.get(cellIndex)[target];
        neighbor.incomingLiters += incoming; neighbor.outgoingLiters += outgoing;
      }
    }
    total.balanceErrorLiters = total.rainLiters + total.incomingLiters - total.outgoingLiters -
      total.absorbedLiters - total.boundaryExitLiters - total.storedLiters;
    totals[target] = total;
  }
  const changes = Object.fromEntries(COMPONENTS.map(key => [key, totals.proposal[key] - totals.existing[key]]));
  const neighbors = [...outside.values()].sort((a, b) => a.cellIndex - b.cellIndex).map(n => ({ ...n,
    incomingChangeLiters: n.proposal.incomingLiters - n.existing.incomingLiters,
    outgoingChangeLiters: n.proposal.outgoingLiters - n.existing.outgoingLiters,
  }));
  const explainedStorageChangeLiters = changes.rainLiters + changes.incomingLiters -
    changes.outgoingLiters - changes.absorbedLiters - changes.boundaryExitLiters;
  return { cellIndices: members, ...totals, changes, neighbors, explainedStorageChangeLiters,
    changeBalanceErrorLiters: explainedStorageChangeLiters - changes.storedLiters };
}

export function localBudgetRegion(project, scope) {
  validateProject(project);
  if (scope === 'cell') return [project.selectedIndex ?? 0];
  if (scope === 'site') return project.existing.map((_, i) => i);
  if (scope === 'edited') {
    const changed = new Set(changedBarrierCells(project.existing, project.proposal, project.width, project.height));
    project.existing.forEach((cell, i) => {
      if (cell.elevationM !== project.proposal[i].elevationM || cell.surface !== project.proposal[i].surface) changed.add(i);
    });
    return [...changed].sort((a, b) => a - b);
  }
  throw new Error('Choose selected cell, edited footprint or whole site');
}

// Selection, notebook readings and other investigative controls do not change a
// saved-assumption budget. Weather and both geometries do; retain unknown weather
// fields so later qualified forcing extensions also invalidate this consumer.
export function localBudgetInputKey(project) {
  return JSON.stringify({ width: project.width, height: project.height,
    weather: project.weather, existing: project.existing, proposal: project.proposal });
}
