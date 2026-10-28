import { validateProject } from './core.js';
import { compareSolarDirectionsAt } from './solar-occlusion.js';
import { solarContext } from './solar-occlusion-contract.js';

export const DIFFUSE_SKY_MODEL = Object.freeze({
  name: 'mapped-isotropic-horizontal-sky', version: 1,
  quadrature: 'equal-sin-squared-elevation-and-azimuth-midpoints',
});
export const DIFFUSE_SKY_DEFAULT = Object.freeze({ azimuthSamples: 32, elevationBands: 16 });
export const DIFFUSE_SKY_LIMITS = Object.freeze({ maxDirections: 4096, maxRayTests: 16000000 });
export const DIFFUSE_SKY_SEMANTICS = 'Cosine-weighted midpoint directions approximate an equally bright diffuse sky above horizontal ground. '
  + 'Transmission ranges concern uncertain declared columns and numerical grazing on these sampled rays; they do not bound angular-sampling error. '
  + 'Only mapped opaque columns and stepped terrain obstruct the sky. Off-map and omitted objects remain unknown. '
  + 'No reflected light, anisotropic sky brightness, foliage transmission or physical calibration is inferred.';

export function normalizeDiffuseSky(input = DIFFUSE_SKY_DEFAULT) {
  if (!input || typeof input !== 'object' || Array.isArray(input)
      || Object.keys(input).length !== 2 || !Object.hasOwn(input, 'azimuthSamples') || !Object.hasOwn(input, 'elevationBands')) {
    throw Error('Declare only azimuthSamples and elevationBands for diffuse-sky sampling');
  }
  const { azimuthSamples, elevationBands } = input;
  if (!Number.isInteger(azimuthSamples) || azimuthSamples < 4 || azimuthSamples > 128 || azimuthSamples % 4 !== 0
      || !Number.isInteger(elevationBands) || elevationBands < 1 || elevationBands > 64
      || azimuthSamples * elevationBands > DIFFUSE_SKY_LIMITS.maxDirections) {
    throw Error('Use 4–128 azimuth samples in multiples of four, 1–64 elevation bands, and at most 4096 directions');
  }
  return { azimuthSamples, elevationBands };
}

/** For constant radiance L, horizontal irradiance is
 * L * integral(sin(elevation) * cos(elevation) d(elevation) d(azimuth)).
 * u = sin(elevation)^2 makes every equal u/azimuth bin carry equal weight.
 * This quadrature is an approximation, not a continuous visibility certificate.
 */
export function compareDiffuseSkyAt(project, cellIndex, input) {
  const sampling = normalizeDiffuseSky(input);
  validateProject(project);
  const cells = project.width * project.height;
  if (!Number.isInteger(cellIndex) || cellIndex < 0 || cellIndex >= cells) {
    throw Error('Choose one original ground cell for diffuse-sky sampling');
  }
  if (!project.solarStudy) return { status: 'no-study' };
  if (project.solarStudy.contextJson !== solarContext(project)) return { status: 'context-changed' };
  if (['existing', 'proposal'].some(target => project.solarStudy[target].some(row => row.cellIndex === cellIndex))) {
    throw Error('The diffuse-sky ground point is inside a declared column footprint');
  }
  const sampleCount = sampling.azimuthSamples * sampling.elevationBands;
  const estimatedRayTests = 6 * (cells - 1) * sampleCount;
  if (estimatedRayTests > DIFFUSE_SKY_LIMITS.maxRayTests) throw Error('Diffuse-sky investigation exceeds the ray-check budget');
  const directions = [], samples = [];
  const counts = {};
  for (const target of ['existing', 'proposal']) counts[target] = {
    'no-mapped-blocker': 0, blocked: 0, 'height-dependent': 0, grazing: 0,
  };
  for (let band = 0; band < sampling.elevationBands; band++) {
    const elevationDeg = Math.asin(Math.sqrt((band + .5) / sampling.elevationBands)) * 180 / Math.PI;
    for (let azimuth = 0; azimuth < sampling.azimuthSamples; azimuth++) {
      const headingDeg = (azimuth + .5) * 360 / sampling.azimuthSamples;
      samples.push({headingDeg,elevationDeg});
    }
  }
  const batch=compareSolarDirectionsAt(project,cellIndex,samples);
  if(batch.status!=='compared')throw Error('The maintained geometry refused diffuse-sky directions');
  for(let i=0;i<samples.length;i++){
      const {headingDeg,elevationDeg}=samples[i],ray=batch.rays[i];
      const row = { headingDeg, elevationDeg };
      for (const target of ['existing', 'proposal']) {
        if (!Object.hasOwn(counts[target], ray[target].status)) throw Error('Unsupported diffuse-sky obstruction state');
        counts[target][ray[target].status]++;
        row[target] = ray[target];
      }
      directions.push(row);
  }
  const result = { status: 'compared', model: DIFFUSE_SKY_MODEL, sampling, cellIndex,
    sampleCount, estimatedRayTests, directions, semantics: DIFFUSE_SKY_SEMANTICS };
  for (const target of ['existing', 'proposal']) {
    const c = counts[target];
    result[target] = { transmission: [c['no-mapped-blocker'] / sampleCount, (sampleCount - c.blocked) / sampleCount],
      counts: c, ambiguousDirections: c['height-dependent'] + c.grazing };
  }
  return result;
}
