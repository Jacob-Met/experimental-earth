import { prepareSharedSkyOriginalReadings } from './shade-heat-spatial-evidence.js';
import { checkShadeHeatBytes, SHADE_HEAT_LIMITS } from './shade-heat.js';
import { buildBasis, completeEpochReport, boundaryRanges } from './shade-heat-epoch-kernel.js';

export const EPOCH_SKY_KIND = 'experimental-earth/two-epoch-shared-sky-reading-inputs/1';
export const EPOCH_SKY_MODEL = Object.freeze({ name: 'two-original-points-two-declared-sky-epochs', version: 1,
  observation: 'two instantaneous original existing-surface bands at distinct receivers and one final UTC',
  profile: 'four equal azimuth bins in each of two epochs, shared by both points and designs',
  boundary: 'one explicitly chosen existing original interval boundary',
  coefficient: 'exact rational C_i0+C_0j-C_00 from seven reference courses, gated by all sixteen original pairs',
  arithmetic: 'exact two-band simplex intersection and marginal-equivalent additive objectives',
  comparison: 'original static coefficients and additive static diagonal reported separately',
});
export const EPOCH_SKY_LIMITS = Object.freeze({ bins: 4, pairs: 16,
  maxGeometryChecks: SHADE_HEAT_LIMITS.maxRayTests, maxBasisCourses: 128,
  maxWitnessCourses: 32, maxCourses: 160, maxCourseIntervals: 3840, maxCandidates: 2736,
  numericalConsistencyScreenC: 1e-9 });

const BINS = EPOCH_SKY_LIMITS.bins;
const exactKeys = (v, keys) => v !== null && typeof v === 'object' && !Array.isArray(v)
  && Object.keys(v).length === keys.length && keys.every(key => Object.hasOwn(v, key));
const sameModel = value => exactKeys(value, Object.keys(EPOCH_SKY_MODEL))
  && Object.keys(EPOCH_SKY_MODEL).every(key => value[key] === EPOCH_SKY_MODEL[key]);
function preflight(investigation) {
  const sources = investigation.readings.map(({ source }) => {
    const cells = source.project.width * source.project.height, path = source.declaration.path;
    const intervals = Math.ceil((Date.parse(path.endUtc) - Date.parse(path.startUtc)) / (path.stepMinutes * 60000));
    if (investigation.query.splitAfterInterval >= intervals)
      throw Error('Choose an existing original interval boundary with at least one whole interval on either side');
    return { intervals, geometryPasses: 1, estimatedRayTests: 6 * (cells - 1) * intervals,
      estimatedSkyFaceTests: 4 * (4 * (cells - 1) + BINS) * (cells - 1),
      basisCourses: 4 * BINS * BINS, reservedWitnessCourses: 4 * 4,
      courseIntervals: (4 * BINS * BINS + 4 * 4) * intervals };
  });
  const sum = key => sources.reduce((n, source) => n + source[key], 0);
  const work = Object.fromEntries(['geometryPasses', 'estimatedRayTests', 'estimatedSkyFaceTests',
    'basisCourses', 'reservedWitnessCourses', 'courseIntervals'].map(key => [key, sum(key)]));
  if (work.estimatedRayTests + work.estimatedSkyFaceTests > EPOCH_SKY_LIMITS.maxGeometryChecks
      || work.basisCourses > EPOCH_SKY_LIMITS.maxBasisCourses
      || work.reservedWitnessCourses > EPOCH_SKY_LIMITS.maxWitnessCourses
      || work.basisCourses + work.reservedWitnessCourses > EPOCH_SKY_LIMITS.maxCourses
      || work.courseIntervals > EPOCH_SKY_LIMITS.maxCourseIntervals)
    throw Error('The complete two-epoch basis and reserved witness replays exceed the shared inquiry allowance');
  return { ...work, sources };
}

export function prepareEpochSkySource(originals, query) {
  if (!exactKeys(query, ['bins', 'splitAfterInterval', 'sharingSource']) || query.bins !== BINS
      || !Number.isInteger(query.splitAfterInterval) || query.splitAfterInterval < 1
      || typeof query.sharingSource !== 'string' || !query.sharingSource.trim() || query.sharingSource.length > 400)
    throw Error('Declare four common bins, an integer original interval split and 1 to 400 characters explaining shared conditions');
  const joined = prepareSharedSkyOriginalReadings(originals, { bins: BINS, sharingSource: query.sharingSource });
  const investigation = { kind: EPOCH_SKY_KIND, model: { ...EPOCH_SKY_MODEL }, readings: joined.readings,
    query: { bins: BINS, splitAfterInterval: query.splitAfterInterval, sharingSource: query.sharingSource } };
  checkShadeHeatBytes(new Blob([JSON.stringify(investigation)]).size);
  preflight(investigation);
  return investigation;
}

export const EPOCH_SKY_SEMANTICS = 'Each exact early and late profile supplies both original receivers and both designs. The exact additive surrogate uses all sixteen complete original one-bin pair courses as a validity gate and seven reference courses for its coefficients. '
      + 'Exact joint mixtures and the product of their exact marginals have identical additive consequences; approximate replay weights are separately normalized. '
      + 'The original static model and the additive static specialization are distinct comparisons, so their agreement is reported rather than assumed. '
      + 'Zero-width bands and exact ranges apply only to the declared represented-coefficient model. Original floating-course discrepancies and replay band statuses remain visible. '
      + 'This does not recover an actual sky, establish physical causation, authenticate shared conditions or certify geometry, thermal integration or every-profile numerical error.';

function evaluate(investigation, reuse = null) {
  const work = preflight(investigation), split = investigation.query.splitAfterInterval;
  // Both complete original pair bases are prerequisites. Neither band filters a basis.
  const bases = investigation.readings.map((input, index) => buildBasis(input, split, reuse?.[index]));
  return completeEpochReport(investigation, bases, work, { model: EPOCH_SKY_MODEL, limits: EPOCH_SKY_LIMITS,
    reused: Boolean(reuse), semantics: EPOCH_SKY_SEMANTICS });
}

export function prepareEpochSkyEvidence(originals, query) {
  const investigation = prepareEpochSkySource(originals, query);
  return { investigation, report: evaluate(investigation) };
}

export function parseEpochSkyEvidence(text) {
  if (typeof text !== 'string') throw TypeError('Two-epoch inputs must be JSON text');
  checkShadeHeatBytes(new Blob([text]).size);
  let raw;
  try { raw = JSON.parse(text); } catch { throw Error('Invalid two-epoch reading-input JSON'); }
  if (!exactKeys(raw, ['kind', 'model', 'readings', 'query']) || raw.kind !== EPOCH_SKY_KIND || !sameModel(raw.model))
    throw Error('Unsupported two-epoch input model or saved results');
  return prepareEpochSkyEvidence(raw.readings, raw.query);
}


export const SKY_BOUNDARY_KIND = 'experimental-earth/offered-sky-boundary-reading-inputs/1';
export const SKY_BOUNDARY_MODEL = Object.freeze({ ...EPOCH_SKY_MODEL,
  name: 'two-original-points-offered-sky-change-boundaries',
  boundary: 'every explicitly offered existing original interval boundary, in supplied order',
  inference: 'complete finite alternative comparison; no interpolation or change-time identification',
});
// The original course has at most24 intervals, hence at most23 internal boundaries.
// Two receivers require32 static-diagonal courses once,96 other pair courses per
// boundary, and at most32 full witness courses per boundary. Admission reserves all.
export const SKY_BOUNDARY_LIMITS = Object.freeze({ maxBoundaries: 23,
  maxGeometryChecks: EPOCH_SKY_LIMITS.maxGeometryChecks,
  maxCompleteBasisCourses: 128 * 23, maxExecutedBasisCourses: 32 + 96 * 23,
  maxWitnessCourses: 32 * 23, maxCourses: 32 + 128 * 23,
  maxCourseIntervals: (32 + 128 * 23) * 24,
  maxCandidates: EPOCH_SKY_LIMITS.maxCandidates * 23 });
const sameBoundaryModel = value => exactKeys(value, Object.keys(SKY_BOUNDARY_MODEL))
  && Object.keys(SKY_BOUNDARY_MODEL).every(key => value[key] === SKY_BOUNDARY_MODEL[key]);

function boundaryInput(investigation, splitAfterInterval) {
  return { kind: EPOCH_SKY_KIND, model: { ...EPOCH_SKY_MODEL }, readings: investigation.readings,
    query: { bins: BINS, splitAfterInterval, sharingSource: investigation.query.sharingSource } };
}
function preflightBoundaries(investigation) {
  // Every offered boundary is admitted before any geometry or thermal evaluation.
  const inputs = investigation.query.splitAfterIntervals.map(split => boundaryInput(investigation, split));
  const perBoundary = inputs.map(preflight), first = perBoundary[0], count = inputs.length;
  const intervalCount = first.sources[0].intervals;
  const work = { offeredBoundaries: count, geometryPasses: first.geometryPasses,
    estimatedRayTests: first.estimatedRayTests, estimatedSkyFaceTests: first.estimatedSkyFaceTests,
    completeBasisCourses: 128 * count, reservedExecutedBasisCourses: 32 + 96 * count,
    reservedWitnessCourses: 32 * count, reservedThermalCourses: 32 + 128 * count,
    reservedCourseIntervals: (32 + 128 * count) * intervalCount,
    reservedCandidates: EPOCH_SKY_LIMITS.maxCandidates * count };
  if (work.estimatedRayTests + work.estimatedSkyFaceTests > SKY_BOUNDARY_LIMITS.maxGeometryChecks
      || work.completeBasisCourses > SKY_BOUNDARY_LIMITS.maxCompleteBasisCourses
      || work.reservedExecutedBasisCourses > SKY_BOUNDARY_LIMITS.maxExecutedBasisCourses
      || work.reservedWitnessCourses > SKY_BOUNDARY_LIMITS.maxWitnessCourses
      || work.reservedThermalCourses > SKY_BOUNDARY_LIMITS.maxCourses
      || work.reservedCourseIntervals > SKY_BOUNDARY_LIMITS.maxCourseIntervals
      || work.reservedCandidates > SKY_BOUNDARY_LIMITS.maxCandidates)
    throw Error('All offered boundaries and their complete witness reserve exceed the whole inquiry allowance');
  return { inputs, work, intervalCount };
}

export function prepareSkyBoundarySource(originals, query) {
  if (!exactKeys(query, ['bins', 'splitAfterIntervals', 'sharingSource']) || query.bins !== BINS
      || !Array.isArray(query.splitAfterIntervals) || !query.splitAfterIntervals.length
      || query.splitAfterIntervals.length > SKY_BOUNDARY_LIMITS.maxBoundaries
      || !Array.from(query.splitAfterIntervals).every(value => Number.isInteger(value) && value >= 1)
      || new Set(query.splitAfterIntervals).size !== query.splitAfterIntervals.length)
    throw Error('Offer 1 to 23 distinct integer original interval boundaries in a dense list, using four bins');
  const first = prepareEpochSkySource(originals, { bins: BINS,
    splitAfterInterval: query.splitAfterIntervals[0], sharingSource: query.sharingSource });
  const investigation = { kind: SKY_BOUNDARY_KIND, model: { ...SKY_BOUNDARY_MODEL }, readings: first.readings,
    query: { bins: BINS, splitAfterIntervals: Array.from(query.splitAfterIntervals), sharingSource: query.sharingSource } };
  checkShadeHeatBytes(new Blob([JSON.stringify(investigation)]).size);
  preflightBoundaries(investigation);
  return investigation;
}
export function prepareSkyBoundaryEvidence(originals, query) {
  const investigation = prepareSkyBoundarySource(originals, query);
  const admitted = preflightBoundaries(investigation), reuse = [{}, {}];
  // This private context lives for exactly one normalized original pair. It cannot
  // be supplied by a caller, reused across inquiries or populated from saved results.
  const reports = admitted.inputs.map(input => evaluate(input, reuse));
  const sum = key => reports.reduce((total, report) => total + report.work[key], 0);
  const work = { ...admitted.work,
    geometryPasses: sum('geometryPasses'), actualSkyFaceTests: sum('actualSkyFaceTests'),
    completeBasisCourses: sum('completeBasisCourses'),
    reusedCompleteBasisCourses: sum('reusedCompleteBasisCourses'), executedBasisCourses: sum('executedBasisCourses'),
    executedWitnessCourses: sum('executedWitnessCourses'), executedThermalCourses: sum('executedThermalCourses'),
    executedCourseIntervals: sum('executedThermalCourses') * admitted.intervalCount,
    candidates: reports.reduce((total, report) => total + report.work.profileIntersection.candidates, 0) };
  if (work.geometryPasses !== admitted.work.geometryPasses
      || work.completeBasisCourses !== admitted.work.completeBasisCourses
      || work.executedBasisCourses !== admitted.work.reservedExecutedBasisCourses
      || work.executedBasisCourses + work.reusedCompleteBasisCourses !== work.completeBasisCourses
      || work.executedWitnessCourses > admitted.work.reservedWitnessCourses
      || work.executedThermalCourses > admitted.work.reservedThermalCourses
      || work.executedCourseIntervals > admitted.work.reservedCourseIntervals
      || work.candidates > admitted.work.reservedCandidates)
    throw Error('The complete offered-boundary inquiry exceeded its admitted work; no partial result is accepted');
  const compatibleBoundaries = reports.filter(report => report.compatibility === 'compatible')
    .map(report => report.query.splitAfterInterval);
  const report = { status: 'compared', compatibility: compatibleBoundaries.length ? 'compatible' : 'incompatible',
    model: { ...SKY_BOUNDARY_MODEL }, query: { ...investigation.query,
      splitAfterIntervals: [...investigation.query.splitAfterIntervals] },
    finalUtc: reports[0].finalUtc, cellIndex: reports[0].cellIndex, intervalCount: admitted.intervalCount,
    compatibleBoundaries, boundaries: reports, ranges: boundaryRanges(reports), work,
    semantics: 'Every explicitly offered original boundary is retained in supplied order. Each uses the same two original readings, weather, geometry, thermal assumptions and complete two-epoch model. '
      + 'The displayed outer bounds enclose the union over compatible offered alternatives; they do not assert that every intermediate difference is attainable. '
      + 'Each extreme remains attached to its original boundary and exact profile witness. Ties retain the first supplied boundary. '
      + 'No unoffered boundary, interpolated time or physical change time is inferred. Original static, additive static and original replay evidence remain separate at every boundary.' };
  return { investigation, report };
}
export function parseSkyBoundaryEvidence(text) {
  if (typeof text !== 'string') throw TypeError('Offered sky-boundary inputs must be JSON text');
  checkShadeHeatBytes(new Blob([text]).size);
  let raw;
  try { raw = JSON.parse(text); } catch { throw Error('Invalid offered sky-boundary input JSON'); }
  if (!exactKeys(raw, ['kind', 'model', 'readings', 'query']) || raw.kind !== SKY_BOUNDARY_KIND || !sameBoundaryModel(raw.model))
    throw Error('Unsupported offered sky-boundary model or saved results');
  return prepareSkyBoundaryEvidence(raw.readings, raw.query);
}
