import { validateProject } from './core.js';
import { compareSolarOcclusion } from './solar-occlusion.js';
import { solarContext } from './solar-occlusion-contract.js';
import { validateSunPath, sunPathPosition, SUN_PATH_MODEL } from './solar-path.js';
import { evaluateHeatColumnTarget } from './heat-column.js';
import { heatColumnCurrent, HEAT_COLUMN_MODEL } from './heat-column-contract.js';
import { serializePortableProject, parsePortableProject } from './project-portability.js';

export const SHADE_HEAT_MODEL = Object.freeze({
  name: 'mapped-shade-midpoint-two-store', version: 1,
  solar: SUN_PATH_MODEL.commit, thermal: HEAT_COLUMN_MODEL,
  forcing: 'DHI + mapped-beam-transmission * DNI * max(0, sin(apparent-elevation))',
});
export const SHADE_HEAT_KIND = 'experimental-earth/shade-heat-inputs/1';
export const SHADE_HEAT_LIMITS = Object.freeze({ maxIntervals: 24, maxMinutes: 1440,
  maxRayTests: 16000000, maxFileBytes: 5 * 1024 * 1024 });
export const SHADE_HEAT_SEMANTICS = 'Each interval holds its midpoint sun position and mapped obstruction constant. '
  + 'Temperature envelopes cover independent uncertain beam choices in this discretized declared model, not sunlight between samples, '
  + 'a joint physical realization of column heights, or formal floating-point bounds. '
  + 'Declared diffuse-horizontal input is unchanged by geometry, including at night; declare zero if appropriate. '
  + 'No sky-view attenuation, reflected sunlight, cloud inference, foliage transmission, nonlinear thermal radiation, '
  + 'moisture, lateral heat flow, field calibration or human comfort is modeled.';
const targets = ['existing', 'proposal'];
const bounds = ['lower', 'upper'];
const pathKeys = ['latitudeDeg', 'longitudeDeg', 'gridColumnBearingDeg', 'locationSource',
  'orientationSource', 'startUtc', 'endUtc', 'stepMinutes'];
const inputKeys = ['path', 'directNormalWm2', 'diffuseHorizontalWm2', 'reservoirC', 'weatherSource'];
const finite = (v, low, high) => typeof v === 'number' && Number.isFinite(v) && v >= low && v <= high;
const exactKeys = (value, keys) => value !== null && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === keys.length && keys.every(k => Object.hasOwn(value, k));

export function normalizeShadeHeat(input) {
  if (!exactKeys(input, inputKeys) || !exactKeys(input.path, pathKeys)) {
    throw Error('Supply only the supported location, UTC, direct/diffuse irradiance, reservoir and source inputs');
  }
  const validated = validateSunPath(input.path);
  if (!finite(input.directNormalWm2, 0, 2000) || !finite(input.diffuseHorizontalWm2, 0, 2000)
      || input.directNormalWm2 + input.diffuseHorizontalWm2 > 2000
      || !finite(input.reservoirC, -100, 200) || typeof input.weatherSource !== 'string'
      || !input.weatherSource.trim() || input.weatherSource.length > 400) {
    throw Error('Declare nonnegative direct/diffuse irradiance totaling at most 2000 W/m², reservoir −100–200 °C, and a source');
  }
  const duration = (Date.parse(validated.endUtc) - Date.parse(validated.startUtc)) / 60000;
  const count = Math.ceil(duration / validated.stepMinutes);
  if (duration > SHADE_HEAT_LIMITS.maxMinutes || count > SHADE_HEAT_LIMITS.maxIntervals
      || duration - (count - 1) * validated.stepMinutes < .1) {
    throw Error('Use at most 24 intervals within 1440 minutes, each at least 0.1 minute');
  }
  return { path: Object.fromEntries(pathKeys.map(k => [k, validated[k]])),
    directNormalWm2: input.directNormalWm2, diffuseHorizontalWm2: input.diffuseHorizontalWm2,
    reservoirC: input.reservoirC, weatherSource: input.weatherSource };
}

/** A horizontal beam receives DNI*sin(elevation). Diffuse input is a separate
 * declaration; a mapped opaque blocker removes only the beam in this model.
 */
export function mappedHorizontalIrradiance(status, elevationDeg, directNormalWm2, diffuseHorizontalWm2) {
  if (!finite(elevationDeg, -90, 90) || !finite(directNormalWm2, 0, 2000)
      || !finite(diffuseHorizontalWm2, 0, 2000) || directNormalWm2 + diffuseHorizontalWm2 > 2000) {
    throw Error('Horizontal input requires supported finite irradiance and elevation');
  }
  if (status === 'footprint') throw Error('The selected ground point is inside a declared column footprint; select an exposed ground point');
  const fullBeamWm2 = directNormalWm2 * Math.max(0, Math.sin(elevationDeg * Math.PI / 180));
  let transmission;
  if (status === 'blocked' || status === 'below-horizon') transmission = [0, 0];
  else if (status === 'no-mapped-blocker') transmission = [1, 1];
  else if (['height-dependent', 'grazing', 'low-elevation'].includes(status)) transmission = [0, 1];
  else throw Error('Unsupported mapped obstruction state');
  return { fullBeamWm2, transmission, lower: diffuseHorizontalWm2 + transmission[0] * fullBeamWm2,
    upper: diffuseHorizontalWm2 + transmission[1] * fullBeamWm2 };
}

function sourceAdmission(project, input) {
  validateProject(project);
  const declaration = normalizeShadeHeat(input);
  if (!project.solarStudy || project.solarStudy.contextJson !== solarContext(project)) {
    throw Error('Save current sourced obstruction geometry in the direct-sun investigation first');
  }
  if (!project.heatColumnStudy || !heatColumnCurrent(project, project.heatColumnStudy)) {
    throw Error('Save current surface and lower-store declarations in the heat investigation first');
  }
  const cellIndex = project.heatColumnStudy.heatStudy.cellIndex;
  if (targets.some(target => project.solarStudy[target].some(row => row.cellIndex === cellIndex))) {
    throw Error('The saved heat point is inside a declared column footprint; use another ground point');
  }
  const start = Date.parse(declaration.path.startUtc), end = Date.parse(declaration.path.endUtc);
  const count = Math.ceil((end - start) / (declaration.path.stepMinutes * 60000));
  const cells = project.width * project.height, estimatedRayTests = 6 * cells * (cells - 1) * count;
  if (estimatedRayTests > SHADE_HEAT_LIMITS.maxRayTests) {
    throw Error('The complete coupled investigation exceeds the 16 million ray-check budget; use fewer intervals or a smaller source grid');
  }
  return { declaration, cellIndex, start, end, count, estimatedRayTests };
}

export function compareShadeHeat(project, input) {
  const admitted = sourceAdmission(project, input);
  const { declaration, cellIndex, start, end, count, estimatedRayTests } = admitted;
  const working = structuredClone(project), intervals = [];
  for (let i = 0; i < count; i++) {
    const from = start + i * declaration.path.stepMinutes * 60000;
    const to = Math.min(end, from + declaration.path.stepMinutes * 60000);
    // All accepted instants use whole seconds. Odd-second intervals may have a
    // half-second midpoint, so use the earlier full second and disclose it.
    const sampleMs = Math.floor((from + to) / 2000) * 1000;
    const utc = new Date(sampleMs).toISOString();
    const position = sunPathPosition(utc, declaration.path.latitudeDeg,
      declaration.path.longitudeDeg, declaration.path.gridColumnBearingDeg);
    let comparison;
    if (position.elevationDeg >= 1) {
      working.solarStudy = { ...project.solarStudy, headingDeg: position.headingDeg,
        elevationDeg: position.elevationDeg, sunSource: 'Calculated source-bound midpoint ' + utc };
      comparison = compareSolarOcclusion(working);
      if (comparison.status !== 'compared') throw Error('The maintained obstruction calculation refused a midpoint');
    }
    const row = { fromMinute: (from - start) / 60000, toMinute: (to - start) / 60000,
      fromUtc: new Date(from).toISOString(), toUtc: new Date(to).toISOString(), sampleUtc: utc,
      sampleOffsetSeconds: sampleMs / 1000 - (from + to) / 2000, ...position };
    for (const target of targets) {
      const ray = comparison ? comparison[target][cellIndex] : { cellIndex,
        status: position.elevationDeg <= 0 ? 'below-horizon' : 'low-elevation', witness: null };
      row[target] = { ...ray, irradiance: mappedHorizontalIrradiance(ray.status, position.elevationDeg,
        declaration.directNormalWm2, declaration.diffuseHorizontalWm2) };
    }
    intervals.push(row);
  }
  const studies = {}, responses = {}, durationMinutes = (end - start) / 60000;
  // Exact thermal courses reuse the maintained propagator and its interior
  // turning points; no separate integration or extrema finder is introduced.
  const requested = Array.from({ length: Math.floor(durationMinutes) + 1 }, (_, i) => i);
  for (const target of targets) {
    studies[target] = {}; responses[target] = {};
    for (const bound of bounds) {
      const study = structuredClone(project.heatColumnStudy);
      study.heatStudy.schedule = intervals.map(row => ({ minutes: row.toMinute - row.fromMinute,
        incidentWm2: row[target].irradiance[bound], reservoirC: declaration.reservoirC,
        source: 'Derived ' + bound + ' incident input at ' + row.sampleUtc + '; full weather/geometry basis is retained in shade-heat inputs' }));
      studies[target][bound] = study;
      responses[target][bound] = evaluateHeatColumnTarget(study, target, requested);
    }
  }
  const times = [...new Set(targets.flatMap(target => bounds.flatMap(bound =>
    responses[target][bound].trajectory.map(row => row.minute))))].sort((a, b) => a - b);
  const maps = {};
  for (const target of targets) {
    maps[target] = {};
    for (const bound of bounds) {
      responses[target][bound] = evaluateHeatColumnTarget(studies[target][bound], target, times);
      maps[target][bound] = new Map(responses[target][bound].trajectory.map(row => [row.minute, row]));
    }
  }
  const trajectory = times.map(minute => {
    const row = { minute };
    for (const target of targets) row[target] = Object.fromEntries(bounds.map(bound => [bound, maps[target][bound].get(minute)]));
    row.difference = Object.fromEntries(['surfaceC', 'subsurfaceC'].map(field => [field,
      [row.proposal.lower[field] - row.existing.upper[field], row.proposal.upper[field] - row.existing.lower[field]]]));
    return row;
  });
  const summary = {};
  for (const target of targets) {
    summary[target] = Object.fromEntries(['surface', 'subsurface'].map(store => [store, {
      maximumRangeC: bounds.map(bound => responses[target][bound].summary[store].maximumC),
      maximumMinutes: bounds.map(bound => responses[target][bound].summary[store].maximumMinute),
    }]));
    summary[target].final = Object.fromEntries(bounds.map(bound => [bound, responses[target][bound].summary.final]));
    summary[target].ambiguousIntervals = intervals.filter(row => row[target].irradiance.lower !== row[target].irradiance.upper).length;
  }
  return { status: 'compared', model: SHADE_HEAT_MODEL, declaration, cellIndex,
    durationMinutes, estimatedRayTests, intervals, trajectory, summary, semantics: SHADE_HEAT_SEMANTICS };
}

export function checkShadeHeatBytes(bytes) {
  if (!Number.isSafeInteger(bytes) || bytes < 0 || bytes > SHADE_HEAT_LIMITS.maxFileBytes) {
    throw Error('Shade and heat investigation exceeds the 5 MiB file limit');
  }
}

export function prepareShadeHeatInvestigation(project, input) {
  const source = parsePortableProject(serializePortableProject(project));
  const declaration = normalizeShadeHeat(input);
  const report = compareShadeHeat(source, declaration);
  const investigation = { kind: SHADE_HEAT_KIND, model: { ...SHADE_HEAT_MODEL }, project: source, declaration };
  checkShadeHeatBytes(new Blob([JSON.stringify(investigation)]).size);
  return { investigation, report };
}

export function serializeShadeHeatInvestigation(project, input) {
  const { investigation } = prepareShadeHeatInvestigation(project, input);
  const text = JSON.stringify(investigation, null, 2);
  checkShadeHeatBytes(new Blob([text]).size);
  return text;
}

export function parseShadeHeatInvestigation(text) {
  if (typeof text !== 'string') throw TypeError('Shade and heat inputs must be JSON text');
  checkShadeHeatBytes(new Blob([text]).size);
  let value;
  try { value = JSON.parse(text); } catch { throw Error('Invalid shade and heat input JSON'); }
  if (!exactKeys(value, ['kind', 'model', 'project', 'declaration']) || value.kind !== SHADE_HEAT_KIND
      || !exactKeys(value.model, Object.keys(SHADE_HEAT_MODEL))
      || Object.keys(SHADE_HEAT_MODEL).some(key => value.model[key] !== SHADE_HEAT_MODEL[key])) {
    throw Error('Unsupported shade and heat input model or envelope; saved result fields are not accepted');
  }
  return prepareShadeHeatInvestigation(value.project, value.declaration);
}
