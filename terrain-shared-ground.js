import { INTERVENTION_METRICS, summarizeEffects } from './intervention-study.js';
import { admitTerrainSources, terrainOffsets, assertTerrainOffsets, reserveTerrainWork, runTerrainPair } from './terrain-sensitivity-engine.js';

/** A person's declared common additive ground error relative to fixed crests
 * and unselected terrain. Neither inferred correlation nor a datum conversion.
 */
export function compareSharedGround(project, { cellIndices, basis, transferConfirmed = false, sampleCount = 3, halfWidthM } = {}) {
  if (!Array.isArray(cellIndices) || !cellIndices.length || new Set(cellIndices).size !== cellIndices.length) throw Error('Select a nonempty footprint of distinct supplied cells');
  if (typeof basis !== 'string' || !basis.trim() || basis.length > 1000) throw Error('Describe the shared ground-error basis in 1–1000 characters');
  const indices = [...cellIndices].sort((a, b) => a - b);
  const axes = admitTerrainSources(project, { cellIndices: indices, transferConfirmed });
  if (axes.some(axis => axis.source.datum !== axes[0].source.datum || axis.source.cellSizeM !== axes[0].source.cellSizeM)) throw Error('Every selected source needs the same declared datum and spacing');
  const maximumHalfWidthM = Math.min(...axes.map(axis => axis.uncertaintyM));
  const commonHalfWidthM = halfWidthM === undefined ? maximumHalfWidthM : halfWidthM;
  const offsetsM = terrainOffsets(commonHalfWidthM, sampleCount);
  if (commonHalfWidthM > maximumHalfWidthM) throw Error('The declared shared interval must fit every selected supplied interval');
  assertTerrainOffsets(axes, offsetsM);
  const cellStepUpperBound = reserveTerrainWork(project, sampleCount);
  const candidates = offsetsM.map((offsetM, index) => ({
    label: index === 0 ? 'low' : index === sampleCount - 1 ? 'high' : index === (sampleCount - 1) / 2 ? 'central' : `interior ${index}`,
    offsetM,
    elevations: axes.map(axis => ({ cellIndex: axis.cellIndex, existingElevationM: axis.originalExisting.elevationM + offsetM, proposalElevationM: axis.originalProposal.elevationM + offsetM })),
    ...runTerrainPair(project, indices.map(cellIndex => ({ cellIndex, offsetM })))
  }));
  const selected = new Set(indices), crests = [];
  for (const target of ['existing', 'proposal']) for (const [cellIndex, cell] of project[target].entries()) {
    for (const [edge, declaration] of Object.entries(cell.internalBarriers ?? {})) if (Object.hasOwn(declaration, 'crestElevationM')) {
      crests.push({ target, cellIndex, edge, ...structuredClone(declaration) });
    }
  }
  return { cellIndices: indices, axes, basis, sampleCount, commonHalfWidthM, maximumHalfWidthM,
    limitingCellIndices: axes.filter(axis => axis.uncertaintyM === maximumHalfWidthM).map(axis => axis.cellIndex),
    offsetsM, cellStepUpperBound,
    fixedReferences: { crests, unselectedTerrain: project.existing.flatMap((cell, cellIndex) => selected.has(cellIndex) ? [] : [{ cellIndex, existingElevationM: cell.elevationM, proposalElevationM: project.proposal[cellIndex].elevationM }]) },
    candidates, metrics: Object.fromEntries(Object.keys(INTERVENTION_METRICS).map(key => [key, summarizeEffects(candidates.map(c => c.metrics[key].delta))])) };
}
