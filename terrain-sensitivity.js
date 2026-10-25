import { INTERVENTION_METRICS, summarizeEffects } from './intervention-study.js';
import { admitTerrainAxis, reserveTerrainWork, runTerrainPair } from './terrain-sensitivity-engine.js';
export { TERRAIN_SENSITIVITY_BUDGET } from './terrain-sensitivity-engine.js';

/** Explicit samples of one supplied interval, not an uncertainty envelope.
 * The same ground perturbation is transferred to both worlds, preserving the
 * authored intervention. Measurements are never reassigned to a derived world.
 */
export function compareTerrainSensitivity(project, { cellIndex, transferConfirmed = false, sampleCount = 3 } = {}) {
  const { offsets, ...axis } = admitTerrainAxis(project, { cellIndex, transferConfirmed, sampleCount });
  const cellStepUpperBound = reserveTerrainWork(project, sampleCount);
  const candidates = offsets.map((offsetM, index) => ({
    label: index === 0 ? 'low' : index === sampleCount - 1 ? 'high' : index === (sampleCount - 1) / 2 ? 'central' : `interior ${index}`, offsetM,
    existingElevationM: axis.originalExisting.elevationM + offsetM,
    proposalElevationM: axis.originalProposal.elevationM + offsetM,
    ...runTerrainPair(project, [{ cellIndex, offsetM }])
  }));
  return { ...axis, sampleCount, cellStepUpperBound, candidates,
    metrics: Object.fromEntries(Object.keys(INTERVENTION_METRICS).map(key => [key, summarizeEffects(candidates.map(c => c.metrics[key].delta))])) };
}
