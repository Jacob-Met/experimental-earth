import { prepareShadeHeatSource, parseShadeHeatSource, checkShadeHeatBytes,
  sampleShadeHeatForcing, mappedSkyHorizontalIrradiance, SHADE_HEAT_LIMITS } from './shade-heat.js';
import { WEIGHTED_CONTINUOUS_SKY_MODEL } from './continuous-sky.js';
import { evaluateHeatColumnTarget } from './heat-column.js';
import { HEAT_COLUMN_MODEL } from './heat-column-contract.js';

export const SHADE_HEAT_PROFILE_RANGE_KIND = 'experimental-earth/shared-sky-final-range-inputs/1';
export const SHADE_HEAT_PROFILE_RANGE_MODEL = Object.freeze({
  name: 'shared-azimuth-final-paired-temperature-range', version: 1,
  sky: WEIGHTED_CONTINUOUS_SKY_MODEL.kind, thermal: HEAT_COLUMN_MODEL,
  profile: 'one nonnegative positive-mass profile shared by both scenarios and all original intervals',
  observable: 'final proposal-minus-existing surface and lower-store temperatures',
});
export const SHADE_HEAT_PROFILE_RANGE_LIMITS = Object.freeze({ maxCourses: 64, maxCourseIntervals: 1536 });
export const SHADE_HEAT_PROFILE_RANGE_SEMANTICS = 'The final paired temperature is affine in the normalized masses of equal-width azimuth bins. '
  + 'The same static brightness profile applies to both scenarios and every original weather interval. '
  + 'Each component range is obtained from every one-bin profile; surface and lower-store bounds have separate witnesses and need not occur together. '
  + 'Total original diffuse irradiance, direct-beam midpoint samples, materials, initial states and weather remain fixed. '
  + 'These ranges concern final temperatures, not daily peaks or changing profiles over time. '
  + 'Roof and beam ambiguity retain the original independent forcing-envelope interpretation, not one joint physical roof realization. '
  + 'Binary64 integration, clamping and omitted-sector diagnostics do not establish certified numerical enclosures, measured sky or physical accuracy. '
  + 'No off-map objects, reflection, nonlinear radiation, moisture, lateral heat flow or human comfort is inferred.';

const targets = ['existing', 'proposal'], bounds = ['lower', 'upper'];
const stores = ['surfaceC', 'subsurfaceC'], TAU = 2 * Math.PI;
const exactKeys = (value, keys) => value !== null && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));

export function normalizeProfileRangeQuery(query) {
  if (!exactKeys(query, ['bins']) || ![4, 8, 16].includes(query.bins))
    throw Error('Choose exactly 4, 8 or 16 equal azimuth bins for the shared-profile inquiry');
  return { bins: query.bins };
}

function binAtStart(angle, bins, step) {
  // Use the same explicit cut comparisons as the maintained sky integrator.
  // A midpoint or angle/step quotient can round a narrow sector into its neighbour.
  for (let i = 1; i < bins; i++) if (angle < i * step) return i - 1;
  return bins - 1;
}

function binTransmissions(skyline, bins) {
  const step = TAU / bins;
  const classified = skyline.arcs.map(arc => {
    const bin = binAtStart(arc.headingStartRad, bins, step);
    if (arc.headingStartRad < bin * step || arc.headingEndRad > (bin + 1) * step)
      throw Error('A continuous sky sector crosses an unresolved profile boundary');
    return { arc, bin };
  });
  return Array.from({ length: bins }, (_, bin) => {
    let integral = 0, correction = 0;
    // Include zero contributions in the original arc order, matching a complete
    // maintained one-hot integration without repeating its geometry work.
    for (const entry of classified) {
      const value = entry.bin === bin ? entry.arc.projectedIntegral : 0;
      const adjusted = value - correction, total = integral + adjusted;
      correction = (total - integral) - adjusted; integral = total;
    }
    const rawTransmission = integral / step;
    if (!(rawTransmission >= 0 && rawTransmission <= 1 + 1e-14))
      throw Error('A one-bin continuous sky integral is outside its supported range');
    return { transmission: Math.min(1, rawTransmission), rawTransmission,
      transmissionClamped: rawTransmission > 1, projectedIntegral: integral };
  });
}

const geometryDiagnostics = skyline => ({
  activeColumns: skyline.activeColumns, angularSectors: skyline.angularSectors,
  collapsedSectors: skyline.collapsedSectors, omittedAngularWidthRad: skyline.omittedAngularWidthRad,
  estimatedFaceTests: skyline.estimatedFaceTests,
});

function evaluateSourceRange(source, query) {
  const { project, declaration } = source, { bins } = query;
  const cells = project.width * project.height;
  const start = Date.parse(declaration.path.startUtc), end = Date.parse(declaration.path.endUtc);
  const intervals = Math.ceil((end - start) / (declaration.path.stepMinutes * 60000));
  const work = {
    geometryPasses: 1,
    estimatedRayTests: 6 * (cells - 1) * intervals,
    estimatedSkyFaceTests: 4 * (4 * (cells - 1) + bins) * (cells - 1),
    thermalCourses: 4 * bins, courseIntervals: 4 * bins * intervals,
  };
  if (work.estimatedRayTests + work.estimatedSkyFaceTests > SHADE_HEAT_LIMITS.maxRayTests
      || work.thermalCourses > SHADE_HEAT_PROFILE_RANGE_LIMITS.maxCourses
      || work.courseIntervals > SHADE_HEAT_PROFILE_RANGE_LIMITS.maxCourseIntervals)
    throw Error('The complete shared-profile inquiry exceeds its geometry or thermal-course work budget');
  // A positive nonuniform scaffold requests every profile cut. Only its original
  // unweighted arc integrals, direct-ray status and weather are reused below.
  // It is never saved as an authored declaration or used as a thermal result.
  const sampled = sampleShadeHeatForcing(project, { ...declaration, diffuseSky: {
    method: 'weighted-continuous-columns', azimuthWeights: Array.from({ length: bins }, (_, i) => 1 + i % 2),
  } });
  const transmissions = {}, diagnostics = {};
  for (const target of targets) {
    const skyline = sampled.diffuseSky[target];
    transmissions[target] = { lower: binTransmissions(skyline.maximumRoofs, bins),
      upper: binTransmissions(skyline.minimumRoofs, bins) };
    diagnostics[target] = { maximumRoofs: geometryDiagnostics(skyline.maximumRoofs),
      minimumRoofs: geometryDiagnostics(skyline.minimumRoofs) };
  }
  const vertices = [];
  for (let bin = 0; bin < bins; bin++) {
    const vertex = { bin, headingStartDeg: bin * 360 / bins, headingEndDeg: (bin + 1) * 360 / bins,
      profile: Array.from({ length: bins }, (_, i) => i === bin ? 1 : 0), targets: {}, difference: {} };
    for (const target of targets) {
      vertex.targets[target] = { transmission: bounds.map(bound => transmissions[target][bound][bin]), final: {} };
      const pair = vertex.targets[target].transmission.map(value => value.transmission);
      for (const bound of bounds) {
        try {
          const study = structuredClone(project.heatColumnStudy);
          study.heatStudy.schedule = sampled.intervals.map(row => ({
            minutes: row.toMinute - row.fromMinute,
            incidentWm2: mappedSkyHorizontalIrradiance(row[target].status, row.elevationDeg,
              row.weather.directNormalWm2, row.weather.diffuseHorizontalWm2, pair)[bound],
            reservoirC: row.weather.reservoirC,
            source: 'Shared one-bin sky profile ' + (bin + 1) + '; original midpoint ' + row.sampleUtc,
          }));
          const final = evaluateHeatColumnTarget(study, target).summary.final;
          vertex.targets[target].final[bound] = { minute: final.minute,
            surfaceC: final.surfaceC, subsurfaceC: final.subsurfaceC };
        } catch (error) {
          throw Error('Complete shared-profile inquiry refused at bin ' + (bin + 1) + ', ' + target + ' ' + bound
            + ': ' + error.message + '. No partial profile range is accepted.');
        }
      }
    }
    for (const store of stores) vertex.difference[store] = [
      vertex.targets.proposal.final.lower[store] - vertex.targets.existing.final.upper[store],
      vertex.targets.proposal.final.upper[store] - vertex.targets.existing.final.lower[store],
    ];
    vertices.push(vertex);
  }
  const ranges = {};
  for (const store of stores) {
    const witnesses = [vertices.reduce((a, b) => a.difference[store][0] <= b.difference[store][0] ? a : b),
      vertices.reduce((a, b) => a.difference[store][1] >= b.difference[store][1] ? a : b)];
    ranges[store] = Object.fromEntries(bounds.map((bound, index) => {
      const v = witnesses[index], proposalBound = bound, existingBound = bounds[1 - index];
      return [bound, { differenceC: v.difference[store][index], bin: v.bin, profile: [...v.profile],
        proposalBound, existingBound, proposalC: v.targets.proposal.final[proposalBound][store],
        existingC: v.targets.existing.final[existingBound][store] }];
    }));
  }
  return { status: 'compared', model: SHADE_HEAT_PROFILE_RANGE_MODEL, query: { ...query },
    cellIndex: sampled.cellIndex, durationMinutes: (end - start) / 60000, finalUtc: declaration.path.endUtc,
    domain: 'Nonnegative equal-width bin masses summing to one; one profile shared by both designs and all original intervals',
    heading: WEIGHTED_CONTINUOUS_SKY_MODEL.heading, ranges, vertices, diagnostics,
    work: { ...work, executedThermalCourses: vertices.length * 4,
      actualSkyFaceTests: sampled.diffuseSky.estimatedFaceTests },
    semantics: SHADE_HEAT_PROFILE_RANGE_SEMANTICS };
}

export function prepareShadeHeatProfileRangeSource(project, declaration, query) {
  const normalized = normalizeProfileRangeQuery(query), source = prepareShadeHeatSource(project, declaration);
  const investigation = { kind: SHADE_HEAT_PROFILE_RANGE_KIND, model: { ...SHADE_HEAT_PROFILE_RANGE_MODEL },
    source, query: normalized };
  checkShadeHeatBytes(new Blob([JSON.stringify(investigation)]).size);
  return investigation;
}

export function compareShadeHeatProfileRange(project, declaration, query) {
  const investigation = prepareShadeHeatProfileRangeSource(project, declaration, query);
  return evaluateSourceRange(investigation.source, investigation.query);
}

export function prepareShadeHeatProfileRange(project, declaration, query) {
  const investigation = prepareShadeHeatProfileRangeSource(project, declaration, query);
  return { investigation, report: evaluateSourceRange(investigation.source, investigation.query) };
}

export function serializeShadeHeatProfileRange(project, declaration, query) {
  const text = JSON.stringify(prepareShadeHeatProfileRange(project, declaration, query).investigation, null, 2);
  checkShadeHeatBytes(new Blob([text]).size);
  return text;
}

export function parseShadeHeatProfileRange(text) {
  if (typeof text !== 'string') throw TypeError('Shared-profile inputs must be JSON text');
  checkShadeHeatBytes(new Blob([text]).size);
  let value;
  try { value = JSON.parse(text); } catch { throw Error('Invalid shared-profile input JSON'); }
  const expected = SHADE_HEAT_PROFILE_RANGE_MODEL;
  if (!exactKeys(value, ['kind', 'model', 'source', 'query']) || value.kind !== SHADE_HEAT_PROFILE_RANGE_KIND
      || !exactKeys(value.model, Object.keys(expected)) || Object.keys(expected).some(key => value.model[key] !== expected[key]))
    throw Error('Unsupported shared-profile model or envelope; saved result fields are not accepted');
  const query = normalizeProfileRangeQuery(value.query), source = parseShadeHeatSource(JSON.stringify(value.source));
  const investigation = { kind: SHADE_HEAT_PROFILE_RANGE_KIND, model: { ...expected }, source, query };
  return { investigation, report: evaluateSourceRange(source, query) };
}
