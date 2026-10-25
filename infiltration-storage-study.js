import {runRain, validateProject, SURFACES} from './core.js';
import {validateInfiltrationStorage} from './infiltration-storage.js';

export const STORAGE_FILE_LIMIT = 5 * 1024 * 1024;
export const MAX_STORAGE_CELL_STEPS = 1_000_000;
export const STORAGE_MEANING = 'An explicitly closed receiving layer with the declared space remaining at event start. The same capacity applies separately to each cell of the selected surface in both source maps. Water that cannot enter stays in the surface calculation. No below-surface drainage, evaporation, lateral groundwater exchange or capacity recovery is modeled. This is a declared mechanism comparison, not an inferred soil property or validated environmental prediction.';

function admit(project, storage) {
  validateProject(project);
  validateInfiltrationStorage(storage, SURFACES);
  const work = project.width * project.height * Math.ceil(project.weather.durationMinutes / project.weather.stepMinutes) * 4;
  if (work > MAX_STORAGE_CELL_STEPS) throw Error('Closed-store comparison exceeds the complete four-run work budget');
  return work;
}

/** Compare a capacity-limited model and the unchanged baseline on the same inputs. */
export function compareInfiltrationStorage(project, storage) {
  const cellSteps = admit(project, storage);
  const result = {
    schema: 'experimental-earth-infiltration-storage-comparison/1',
    storage: structuredClone(storage), cellSteps, meaning: STORAGE_MEANING,
  };
  for (const side of ['existing', 'proposal']) {
    const args = [project[side], project.width, project.height, project.weather];
    const unlimited = runRain(...args, {traceBudget: true});
    const limited = runRain(...args, {traceBudget: true, infiltrationStorage: storage});
    result[side] = {unlimited, limited};
  }
  result.affectedCellCount = {
    existing: result.existing.limited.infiltrationStorage.affectedCellCount,
    proposal: result.proposal.limited.infiltrationStorage.affectedCellCount,
  };
  result.status = result.affectedCellCount.existing + result.affectedCellCount.proposal > 0
    ? 'compared' : 'surface-absent';
  result.change = {};
  for (const key of ['absorbedLiters', 'storedLiters', 'exitLiters', 'peakPondingLiters', 'maxDepthMm']) {
    const unlimited = result.proposal.unlimited[key] - result.existing.unlimited[key];
    const limited = result.proposal.limited[key] - result.existing.limited[key];
    result.change[key] = {unlimited, limited, difference: limited - unlimited};
  }
  return result;
}

export function checkStorageFileBytes(bytes) {
  if (!Number.isSafeInteger(bytes) || bytes < 0 || bytes > STORAGE_FILE_LIMIT) {
    throw Error('Closed-store investigation exceeds the 5 MiB input limit');
  }
}
export function serializeInfiltrationStorage(project, storage) {
  admit(project, storage);
  const text = JSON.stringify({
    schema: 'experimental-earth-infiltration-storage-investigation/1', project, storage,
  }, null, 2);
  checkStorageFileBytes(new TextEncoder().encode(text).byteLength);
  return text;
}
export function parseInfiltrationStorage(text) {
  if (typeof text !== 'string') throw Error('Read an original JSON investigation');
  checkStorageFileBytes(new TextEncoder().encode(text).byteLength);
  const input = JSON.parse(text);
  if (!input || input.schema !== 'experimental-earth-infiltration-storage-investigation/1' ||
      Object.keys(input).some(key => !['schema', 'project', 'storage'].includes(key)) ||
      !Object.hasOwn(input, 'project') || !Object.hasOwn(input, 'storage')) {
    throw Error('Unsupported closed-store investigation; saved conclusions are not accepted');
  }
  admit(input.project, input.storage);
  return input;
}
