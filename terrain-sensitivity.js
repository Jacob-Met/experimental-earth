import { runRain, validateProject } from './core.js';
import { ELEVATION_UNITS } from './terrain-contract.js';
import { INTERVENTION_METRICS, summarizeEffects } from './intervention-study.js';

export const TERRAIN_SENSITIVITY_BUDGET = 1000000;
const originKeys = ['kind','fileName','line','datum','source','unit','elevationValue','uncertaintyValue','cellSizeM'];

/** Explicit samples of one supplied interval, not an uncertainty envelope.
 * The same ground perturbation is transferred to both worlds, preserving the
 * authored intervention. Measurements are never reassigned to a derived world.
 */
export function compareTerrainSensitivity(project, { cellIndex, transferConfirmed = false, sampleCount = 3 } = {}) {
  validateProject(project);
  if (![3, 5, 9, 17].includes(sampleCount)) throw Error('Choose 3, 5, 9 or 17 elevation samples');
  if (!Number.isInteger(cellIndex) || cellIndex < 0 || cellIndex >= project.existing.length) throw Error('Choose one existing-site cell');
  if (transferConfirmed !== true) throw Error('Confirm the fixed intervention-height transfer assumption');
  const original = project.existing[cellIndex], proposed = project.proposal[cellIndex];
  const source = original.terrainSource;
  if (!source) throw Error('The selected existing cell needs a supplied elevation source');
  const uncertaintyM = source.uncertaintyValue * ELEVATION_UNITS[source.unit];
  if (!(uncertaintyM > 0)) throw Error('The selected source needs a positive supplied uncertainty');
  if (proposed.terrainSource && (proposed.elevationM !== original.elevationM ||
      originKeys.some(key => proposed.terrainSource[key] !== source[key]))) {
    throw Error('A separately surveyed proposal cannot receive this shared ground perturbation');
  }
  const offsets = Array.from({ length: sampleCount }, (_, i) => uncertaintyM * (2 * i / (sampleCount - 1) - 1));
  // Admit the complete experiment before any solver work. Do not clip intervals.
  for (const offset of offsets) for (const cell of [original, proposed]) {
    const height = cell.elevationM + offset;
    if (!Number.isFinite(height) || height < -10 || height > 10) throw Error('A sampled elevation exceeds the supported −10 to 10 m range');
  }
  const cellStepUpperBound = 2 * sampleCount * project.existing.length * Math.ceil(project.weather.durationMinutes / project.weather.stepMinutes);
  if (cellStepUpperBound > TERRAIN_SENSITIVITY_BUDGET) throw Error('The complete sampled comparison exceeds one million cell-steps');
  const candidates = offsets.map((offsetM, index) => {
    const runs = {};
    for (const target of ['existing', 'proposal']) {
      const cells = structuredClone(project[target]);
      cells[cellIndex].elevationM += offsetM;
      // Derived elevations are hypotheses, not rewritten survey records. The
      // exact original provenance is retained separately in the returned ledger.
      delete cells[cellIndex].terrainSource;
      runs[target] = runRain(cells, project.width, project.height, project.weather);
    }
    return { label: index === 0 ? 'low' : index === sampleCount - 1 ? 'high' : index === (sampleCount - 1) / 2 ? 'central' : `interior ${index}`, offsetM,
      existingElevationM: original.elevationM + offsetM, proposalElevationM: proposed.elevationM + offsetM,
      metrics: Object.fromEntries(Object.keys(INTERVENTION_METRICS).map(key => [key, {
        existing: runs.existing[key], proposal: runs.proposal[key], delta: runs.proposal[key] - runs.existing[key] }])),
      cells: runs.existing.finalDepthMm.map((depth, i) => ({ cellIndex: i,
        existingFinalMm: depth, proposalFinalMm: runs.proposal.finalDepthMm[i], finalDeltaMm: runs.proposal.finalDepthMm[i] - depth,
        existingPeakMm: runs.existing.peakDepthMm[i], proposalPeakMm: runs.proposal.peakDepthMm[i],
        peakDeltaMm: runs.proposal.peakDepthMm[i] - runs.existing.peakDepthMm[i] })),
      massErrorLiters: { existing: runs.existing.massErrorLiters, proposal: runs.proposal.massErrorLiters } };
  });
  return { cellIndex, source: structuredClone(source), originalExisting: structuredClone(original),
    originalProposal: structuredClone(proposed), interventionDeltaM: proposed.elevationM - original.elevationM,
    uncertaintyM, sampleCount, cellStepUpperBound, candidates,
    metrics: Object.fromEntries(Object.keys(INTERVENTION_METRICS).map(key => [key, summarizeEffects(candidates.map(c => c.metrics[key].delta))])) };
}
