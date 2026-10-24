import { validateProject } from './core.js';
import { interpolateDepth } from './infiltration-study.js';

/** Spatial evidence summary of the current authored model, never a fitted rate. */
export function mapObservations(project, results, target = 'existing', role = 'all') {
  validateProject(project);
  if (!['existing', 'proposal'].includes(target)) throw Error('Choose an observed scenario');
  if (!['all', 'calibration', 'challenge', 'unassigned'].includes(role)) throw Error('Unknown evidence role');
  const cells = project[target].map((_, cellIndex) => ({ cellIndex, readings: [], status: 'unobserved' }));
  let excludedScenario = 0, excludedRole = 0;
  for (const [index, reading] of project.observations.entries()) {
    if (reading.scenario !== target) { excludedScenario++; continue; }
    const use = reading.use || 'unassigned';
    if (role !== 'all' && use !== role) { excludedRole++; continue; }
    const prediction = interpolateDepth(results[target], reading.cellIndex, reading.minute);
    const residualMm = reading.depthMm - prediction.depthMm;
    // Same floating-point guard used by the maintained infiltration study.
    const guard = 1e-9 * Math.max(1, reading.depthMm, prediction.depthMm);
    const withinBand = Math.abs(residualMm) <= reading.uncertaintyMm + guard;
    cells[reading.cellIndex].readings.push({ index, reading: structuredClone(reading),
      ...prediction, residualMm, withinBand,
      direction: withinBand ? 'within' : residualMm > 0 ? 'underprediction' : 'overprediction' });
  }
  for (const cell of cells) {
    const within = cell.readings.filter(r => r.withinBand).length;
    cell.withinCount = within;
    cell.outsideCount = cell.readings.length - within;
    cell.status = !cell.readings.length ? 'unobserved' : !cell.outsideCount ? 'within' : !within ? 'outside' : 'mixed';
    cell.opposingMismatches = cell.readings.some(r => r.direction === 'underprediction') &&
      cell.readings.some(r => r.direction === 'overprediction');
  }
  return { target, role, cells, excludedScenario, excludedRole,
    readingCount: cells.reduce((n, c) => n + c.readings.length, 0),
    observedCells: cells.filter(c => c.readings.length).length,
    mismatchedCells: cells.filter(c => c.outsideCount).length };
}
