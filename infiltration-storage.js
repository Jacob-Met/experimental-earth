/**
 * Closed below-surface receiving store. Capacity is the explicitly available
 * space at event start in mm over each affected cell; it is not inferred from
 * a surface label, rooted-water capacity or an observed soil property.
 */
export const INFILTRATION_STORAGE_MODEL = 'experimental-earth-closed-infiltration-store/1';
export function validateInfiltrationStorage(model, surfaces) {
  const keys = ['schema', 'surface', 'remainingCapacityMm', 'source'];
  if (!model || typeof model !== 'object' || Array.isArray(model) ||
      Object.keys(model).some(key => !keys.includes(key)) ||
      keys.some(key => !Object.hasOwn(model, key)) ||
      model.schema !== INFILTRATION_STORAGE_MODEL ||
      typeof model.surface !== 'string' || !Object.hasOwn(surfaces, model.surface) ||
      typeof model.remainingCapacityMm !== 'number' || !Number.isFinite(model.remainingCapacityMm) ||
      model.remainingCapacityMm < 0 || model.remainingCapacityMm > 10000 ||
      typeof model.source !== 'string' || !model.source.trim() || model.source.length > 500) {
    throw Error('Supply a known surface, 0–10,000 mm remaining closed-store capacity and an attributed source or explicit hypothetical assumption');
  }
  return model;
}

/** Receive exactly the infiltration that the maintained water solver accepts. */
export function createInfiltrationStorage(cells, cellAreaM2, model, surfaces) {
  if (model === undefined) return null;
  validateInfiltrationStorage(model, surfaces);
  const capacity = model.remainingCapacityMm;
  const retained = cells.map(cell => cell.surface === model.surface ? 0 : null);
  const limited = cells.map(() => false);
  return {
    accept(index, offeredMm) {
      if (retained[index] === null) return offeredMm;
      const space = Math.max(0, capacity - retained[index]);
      const acceptedMm = Math.min(offeredMm, space);
      if (offeredMm > space) limited[index] = true;
      retained[index] += acceptedMm;
      return acceptedMm;
    },
    finish() {
      const affected = retained.filter(value => value !== null);
      return {
        schema: INFILTRATION_STORAGE_MODEL,
        declaration: structuredClone(model),
        retainedMm: retained.slice(),
        remainingMm: retained.map(value => value === null ? null : Math.max(0, capacity - value)),
        limitedCells: limited.slice(),
        affectedCellCount: affected.length,
        capacityAffectedCellCount: limited.filter(Boolean).length,
        retainedLiters: affected.reduce((sum, value) => sum + value, 0) * cellAreaM2,
        availableCapacityLiters: affected.length * capacity * cellAreaM2,
      };
    },
  };
}
