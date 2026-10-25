import {validateProject, SURFACES} from './core.js';
import {validateDrainingLayer} from './draining-infiltration.js';
import {validateStudy} from './study-contract.js';
import {surfaceElevationEdits, edgeGroundEdits, COMPONENT_WORK_LIMIT} from './proposal-components.js';
import {compareThreeFactors} from './proposal-factorial.js';

/** Same original intervention under two explicitly different receiving assumptions.
 * Unlimited-model evidence support is never transferred to the finite model. */
export function compareReceivingComponents(project, layer, {study = null, subset = 'all'} = {}) {
  validateProject(project); validateDrainingLayer(layer, SURFACES);
  if (subset !== 'all') throw Error('Finite receiving comparisons require default capacities or all declared rates. Unlimited-model calibration and held-aside filters cannot support this receiving model.');
  if (study !== null) validateStudy(study);
  const ground = surfaceElevationEdits(project), edges = edgeGroundEdits(project);
  if (!ground.surfaceIndices.length || !ground.elevationIndices.length || !edges.edgeIndices.length) throw Error('Declare surface, elevation and internal-edge changes for the eight-world comparison.');
  const rates = study === null ? [null] : study.ratesMmHr;
  const estimatedCellSteps = 16 * rates.length * project.existing.length * Math.ceil(project.weather.durationMinutes / project.weather.stepMinutes);
  if (estimatedCellSteps > COMPONENT_WORK_LIMIT) throw Error('Complete receiving/component comparison exceeds the sixteen-world cell-step budget.');
  const base = {layer: structuredClone(layer), study: study === null ? null : structuredClone(study), estimatedCellSteps};
  const cells = [...project.existing, ...project.proposal];
  if (!cells.some(c => c.surface === layer.surface)) return {...base, status: 'layer-surface-absent', candidates: []};
  if (study && !cells.some(c => c.surface === study.surface)) return {...base, status: 'rate-surface-absent', candidates: []};
  const candidates = rates.map(rateMmHr => {
    const options = study ? {surfaceInfiltrationOverride: {surface: study.surface, rateMmHr}} : {};
    const unlimited = compareThreeFactors(project, options);
    const draining = compareThreeFactors(project, {...options, drainingLayer: layer});
    const changes = unlimited.metrics.map((a, i) => {
      const b = draining.metrics[i];
      const unlimitedFullEffect = a.values[7] - a.values[0], drainingFullEffect = b.values[7] - b.values[0];
      return {key: a.key, label: a.label, unit: a.unit, unlimitedFullEffect, drainingFullEffect,
        fullEffectDifference: drainingFullEffect - unlimitedFullEffect,
        unlimitedThreeWay: a.effects[7], drainingThreeWay: b.effects[7],
        threeWayDifference: b.effects[7] - a.effects[7]};
    });
    return {rateMmHr, unlimited, draining, changes};
  });
  return {...base, status: 'compared', candidates};
}
