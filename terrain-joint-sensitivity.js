import { INTERVENTION_METRICS, summarizeEffects } from './intervention-study.js';
import { admitTerrainAxis, reserveTerrainWork, runTerrainPair } from './terrain-sensitivity-engine.js';

/** A finite Cartesian family of declared hypotheses, not an independent error
 * distribution, a continuous enclosure, or proof of joint physical possibility.
 */
export function compareJointTerrainSensitivity(project, { cellIndices, transferConfirmed = false, sampleCount = 3 } = {}) {
  if (!Array.isArray(cellIndices) || cellIndices.length !== 2 || new Set(cellIndices).size !== 2) throw Error('Choose two distinct supplied cells');
  const indices = [...cellIndices].sort((a, b) => a - b);
  const axes = indices.map(cellIndex => admitTerrainAxis(project, { cellIndex, transferConfirmed, sampleCount }));
  if (axes[0].source.datum !== axes[1].source.datum || axes[0].source.cellSizeM !== axes[1].source.cellSizeM) {
    throw Error('Both supplied cells need the same declared datum and spacing');
  }
  const candidateCount = sampleCount ** 2;
  const cellStepUpperBound = reserveTerrainWork(project, candidateCount);
  const candidates = [];
  for (let row = 0; row < sampleCount; row++) for (let column = 0; column < sampleCount; column++) {
    const offsetsM = [axes[0].offsets[row], axes[1].offsets[column]];
    const changes = axes.map((axis, i) => ({ cellIndex: axis.cellIndex, offsetM: offsetsM[i] }));
    candidates.push({ axisIndices: [row, column], offsetsM,
      elevations: axes.map((axis, i) => ({ cellIndex: axis.cellIndex,
        existingElevationM: axis.originalExisting.elevationM + offsetsM[i],
        proposalElevationM: axis.originalProposal.elevationM + offsetsM[i] })),
      ...runTerrainPair(project, changes) });
  }
  return { cellIndices: indices, axes, sampleCount, candidateCount, cellStepUpperBound, candidates,
    metrics: Object.fromEntries(Object.keys(INTERVENTION_METRICS).map(key => [key, summarizeEffects(candidates.map(c => c.metrics[key].delta))])) };
}
