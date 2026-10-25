import {validateProject, runRain, SURFACES, makeExample} from './core.js';
import {DRAINING_LAYER_SCHEMA, validateDrainingLayer} from './draining-infiltration.js';
import {INFILTRATION_STORAGE_MODEL} from './infiltration-storage.js';

export const DRAINING_FILE_LIMIT = 5 * 1024 * 1024;
export const MAX_DRAINING_CELL_STEPS = 1_000_000;
export const DRAINING_MEANING = 'Each selected-surface cell has its own declared total storage and initial water. Infiltration fills it; drainage removes a constant fraction of its current contents per hour and frees receiving space. Water refused by a full layer remains in the surface-flow calculation. Initial water below ground is accounted separately from rainfall. This conceptual linear-reservoir comparison omits groundwater backpressure, lateral subsurface flow, roots and evaporation; it does not identify soil properties or establish field performance. Routing still uses the maintained time steps.';
const sides = ['existing', 'proposal'];
function admit(project, layer) {
  validateProject(project); validateDrainingLayer(layer, SURFACES);
  const cellSteps = project.width * project.height * Math.ceil(project.weather.durationMinutes / project.weather.stepMinutes) * 6;
  if (cellSteps > MAX_DRAINING_CELL_STEPS) throw Error('Draining-layer comparison exceeds the complete six-run work budget');
  return cellSteps;
}

/** Three receiving assumptions applied to both unchanged original source maps. */
export function compareDrainingLayer(project, layer) {
  const cellSteps = admit(project, layer);
  const closed = {schema: INFILTRATION_STORAGE_MODEL, surface: layer.surface,
    remainingCapacityMm: layer.capacityMm - layer.initialStoredMm,
    source: 'Closed counterpart of the original declared layer; same initial remaining space. ' + layer.source};
  // The canonical closed declaration bounds its source length independently.
  closed.source = closed.source.slice(0, 500);
  const report = {schema: 'experimental-earth-draining-layer-comparison/1',
    layer: structuredClone(layer), cellSteps, meaning: DRAINING_MEANING};
  for (const side of sides) {
    const args = [project[side], project.width, project.height, project.weather];
    report[side] = {
      unlimited: runRain(...args, {traceBudget: true}),
      closed: runRain(...args, {traceBudget: true, infiltrationStorage: closed}),
      draining: runRain(...args, {traceBudget: true, drainingLayer: layer}),
    };
  }
  report.status = sides.some(side => report[side].draining.drainingLayer.affectedCellCount > 0)
    ? 'compared' : 'surface-absent';
  report.change = {};
  for (const metric of ['absorbedLiters', 'storedLiters', 'exitLiters', 'maxDepthMm']) {
    report.change[metric] = Object.fromEntries(['unlimited', 'closed', 'draining'].map(kind =>
      [kind, report.proposal[kind][metric] - report.existing[kind][metric]]));
  }
  return report;
}

export function checkDrainingFileBytes(bytes) {
  if (!Number.isSafeInteger(bytes) || bytes < 0 || bytes > DRAINING_FILE_LIMIT) {
    throw Error('Original draining-layer investigation exceeds the 5 MiB limit');
  }
}
export function serializeDrainingLayer(project, layer) {
  admit(project, layer);
  const text = JSON.stringify({schema: 'experimental-earth-draining-layer-investigation/1', project, layer}, null, 2);
  checkDrainingFileBytes(new TextEncoder().encode(text).byteLength);
  return text;
}
export function parseDrainingLayer(text) {
  if (typeof text !== 'string') throw Error('Read an original JSON investigation');
  checkDrainingFileBytes(new TextEncoder().encode(text).byteLength);
  const input = JSON.parse(text), keys = ['schema', 'project', 'layer'];
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      input.schema !== 'experimental-earth-draining-layer-investigation/1' ||
      keys.some(key => !Object.hasOwn(input, key)) || Object.keys(input).some(key => !keys.includes(key))) {
    throw Error('Unsupported original draining-layer investigation; saved conclusions are not accepted');
  }
  admit(input.project, input.layer);
  return input;
}

export function makeDrainingExample() {
  const project = makeExample();
  project.title = 'Fictional bed with a draining receiving layer';
  project.width = project.height = 2; project.selectedIndex = 0;
  project.source = 'Authored flat closed site; no field observations';
  project.existing = Array.from({length: 4}, () => ({elevationM: 0, surface: 'sealed', provenance: project.source}));
  project.proposal = project.existing.map(cell => ({...cell, surface: 'garden', provenance: 'Hypothetical receiving bed'}));
  Object.assign(project.weather, {rainMmHr: 36, stormMinutes: 60, durationMinutes: 240,
    cellSizeM: 1, mobilityPerHour: 0, boundaryExitPerHour: 0});
  return {project, layer: {schema: DRAINING_LAYER_SCHEMA, surface: 'garden',
    capacityMm: 5, initialStoredMm: 0, drainagePerHour: 1,
    source: 'Authored 5 mm empty layer; linear drainage coefficient 1 /hour. No measured material calibration.'}};
}
