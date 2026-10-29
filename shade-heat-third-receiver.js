import { prepareSkyBoundarySource, EPOCH_SKY_MODEL, EPOCH_SKY_LIMITS, EPOCH_SKY_SEMANTICS } from './shade-heat-epoch-evidence.js';
import { prepareSharedSkyOriginalReadings } from './shade-heat-spatial-evidence.js';
import { checkShadeHeatBytes, SHADE_HEAT_LIMITS } from './shade-heat.js';
import { buildBasis, completeEpochReport, boundaryRanges } from './shade-heat-epoch-kernel.js';
import { intersectThreeProfileBands, intersectThreeRationalProfileBands,
  THREE_PROFILE_BAND_MAX_CANDIDATES } from './shade-heat-profile-three-bands.js';
import { rational as q, add, sub, cmp } from './vendor/chronos/exact-halfplanes.mjs';

export const THIRD_RECEIVER_KIND = 'experimental-earth/three-receiver-sky-boundary-inputs/1';
const THREE_EPOCH_MODEL = Object.freeze({ ...EPOCH_SKY_MODEL,
  name: 'three-original-points-two-declared-sky-epochs',
  observation: 'three instantaneous original existing-surface bands at distinct receivers and one final UTC',
  profile: 'four equal azimuth bins in each of two epochs, shared by all three points and both designs',
  arithmetic: 'exact three-band simplex intersection and marginal-equivalent additive objectives',
});
export const THIRD_RECEIVER_MODEL = Object.freeze({ ...THREE_EPOCH_MODEL,
  name: 'three-original-points-offered-sky-change-boundaries',
  boundary: 'every explicitly offered existing original interval boundary, in supplied order',
  comparison: 'leading two original readings and all three original readings retained separately',
  inference: 'complete finite alternative comparison; no interpolation or physical change-time identification',
});
// Each receiver reserves64 complete pair courses and16 witness courses per
// boundary. The leading-two witnesses add32; their pair courses are already in
// the three-receiver basis. Static-diagonal reuse saves48 courses after boundary1.
export const THIRD_RECEIVER_LIMITS = Object.freeze({ sources: 3, bins: 4, maxBoundaries: 23,
  maxGeometryChecks: SHADE_HEAT_LIMITS.maxRayTests,
  maxCompleteBasisCourses: 192 * 23, maxExecutedBasisCourses: 48 + 144 * 23,
  maxWitnessCourses: 80 * 23, maxCourses: 48 + 224 * 23,
  maxCourseIntervals: (48 + 224 * 23) * 24,
  maxIntersectionCandidates: THREE_PROFILE_BAND_MAX_CANDIDATES,
  maxCandidates: (THREE_PROFILE_BAND_MAX_CANDIDATES + 2736 + 280) * 23,
  numericalConsistencyScreenC: EPOCH_SKY_LIMITS.numericalConsistencyScreenC });

const exactKeys = (v, keys) => v !== null && typeof v === 'object' && !Array.isArray(v)
  && Object.keys(v).length === keys.length && keys.every(key => Object.hasOwn(v, key));
const sameModel = value => exactKeys(value, Object.keys(THIRD_RECEIVER_MODEL))
  && Object.keys(THIRD_RECEIVER_MODEL).every(key => value[key] === THIRD_RECEIVER_MODEL[key]);
const exactFraction = value => [BigInt(value.exact.numerator), BigInt(value.exact.denominator)];
const bounds = ['lower', 'upper'], stores = ['surfaceC', 'subsurfaceC'];

function sourceWork(readings) {
  const sources = readings.map(({ source }) => {
    const cells = source.project.width * source.project.height, path = source.declaration.path;
    const intervals = Math.ceil((Date.parse(path.endUtc) - Date.parse(path.startUtc)) / (path.stepMinutes * 60000));
    return { intervals, geometryPasses: 1, estimatedRayTests: 6 * (cells - 1) * intervals,
      estimatedSkyFaceTests: 4 * (4 * (cells - 1) + 4) * (cells - 1),
      basisCourses: 64, reservedWitnessCourses: 16, courseIntervals: 80 * intervals };
  });
  const sum = key => sources.reduce((n, source) => n + source[key], 0);
  return { ...Object.fromEntries(['geometryPasses', 'estimatedRayTests', 'estimatedSkyFaceTests',
    'basisCourses', 'reservedWitnessCourses', 'courseIntervals'].map(key => [key, sum(key)])), sources };
}

function preflight(investigation) {
  const joint = sourceWork(investigation.readings), prior = sourceWork(investigation.readings.slice(0, 2));
  const count = investigation.query.splitAfterIntervals.length, intervals = joint.sources[0].intervals;
  if (!joint.sources.every(source => source.intervals === intervals)
      || investigation.query.splitAfterIntervals.some(split => split >= intervals))
    throw Error('Every offered change must be a common original interval boundary with whole intervals on either side');
  const work = { offeredBoundaries: count, geometryPasses: joint.geometryPasses,
    estimatedRayTests: joint.estimatedRayTests, estimatedSkyFaceTests: joint.estimatedSkyFaceTests,
    completeBasisCourses: 192 * count, reservedExecutedBasisCourses: 48 + 144 * count,
    reservedJointWitnessCourses: 48 * count, reservedPriorWitnessCourses: 32 * count,
    reservedWitnessCourses: 80 * count, reservedThermalCourses: 48 + 224 * count,
    reservedCourseIntervals: (48 + 224 * count) * intervals,
    reservedJointCandidates: THREE_PROFILE_BAND_MAX_CANDIDATES * count,
    reservedPriorCandidates: 2736 * count, reservedStaticCandidates: 280 * count,
    reservedCandidates: (THREE_PROFILE_BAND_MAX_CANDIDATES + 2736 + 280) * count };
  if (work.estimatedRayTests + work.estimatedSkyFaceTests > THIRD_RECEIVER_LIMITS.maxGeometryChecks
      || work.completeBasisCourses > THIRD_RECEIVER_LIMITS.maxCompleteBasisCourses
      || work.reservedExecutedBasisCourses > THIRD_RECEIVER_LIMITS.maxExecutedBasisCourses
      || work.reservedWitnessCourses > THIRD_RECEIVER_LIMITS.maxWitnessCourses
      || work.reservedThermalCourses > THIRD_RECEIVER_LIMITS.maxCourses
      || work.reservedCourseIntervals > THIRD_RECEIVER_LIMITS.maxCourseIntervals
      || work.reservedCandidates > THIRD_RECEIVER_LIMITS.maxCandidates)
    throw Error('All three original courses, offered boundaries and both witness families exceed the complete inquiry allowance');
  return { joint, prior, work, intervals };
}

export function prepareThirdReceiverSource(originals, query) {
  if (!Array.isArray(originals) || originals.length !== 3 || Array.from(originals).some(value => !value))
    throw Error('Supply exactly three complete original receiver reading inputs in the intended order');
  checkShadeHeatBytes(new Blob([JSON.stringify({ originals, query })]).size);
  // Reuse the maintained strict original-source join. Each independent point
  // keeps its own fixed thermal declaration; site and forcing must match exactly.
  const leading = prepareSkyBoundarySource(originals.slice(0, 2), query);
  const third = prepareSharedSkyOriginalReadings([originals[0], originals[2]],
    { bins: 4, sharingSource: query.sharingSource });
  const readings = [...leading.readings, third.readings[1]];
  if (new Set(readings.map(input => input.query.reading.cellIndex)).size !== 3)
    throw Error('The three original readings must use three distinct receiver cells');
  const investigation = { kind: THIRD_RECEIVER_KIND, model: { ...THIRD_RECEIVER_MODEL }, readings,
    query: { ...leading.query, splitAfterIntervals: [...leading.query.splitAfterIntervals] } };
  checkShadeHeatBytes(new Blob([JSON.stringify(investigation)]).size);
  preflight(investigation);
  return investigation;
}

function emptyFromLeadingTwo(readings) {
  // This exact subset proof only follows a completed leading-two intersection
  // on the same first two coefficient rows. Every third-point original basis
  // course still completes and passes the same numerical gates before reporting.
  return { status: 'incompatible', bins: 16,
    bands: readings.map(input => ({ lower: sub(q(input.query.reading.temperatureC), q(input.query.reading.halfWidthC)),
      upper: add(q(input.query.reading.temperatureC), q(input.query.reading.halfWidthC)) })), candidates: [],
    work: { examinedPairs: 0, examinedTriangles: 0, examinedTetrahedra: 0,
      singularTriangleRows: 0, singularTetrahedra: 0, testedPairPlanes: 0,
      testedPlanePairs: 0, testedPlaneTriples: 0, maximumCandidates: THREE_PROFILE_BAND_MAX_CANDIDATES,
      admittedOriginalVertices: 0, admittedPairVertices: 0, admittedTriangleVertices: 0,
      admittedTetrahedronVertices: 0, candidates: 0, emptyByLeadingTwoSubset: true } };
}

function verifySubset(prior, joint) {
  if (joint.compatibility !== 'compatible') return;
  if (prior.compatibility !== 'compatible') throw Error('The third original band cannot rescue a rejected leading-two inquiry');
  for (const store of stores) for (const bound of bounds) {
    const order = cmp(exactFraction(joint.ranges[store][bound].differenceC), exactFraction(prior.ranges[store][bound].differenceC));
    if (bound === 'lower' ? order < 0 : order > 0)
      throw Error('The third original band cannot widen a leading-two exact objective range');
  }
}

const semantics = 'All three original receiver bands constrain the same exact early and late profiles. '
  + 'The complete original pair courses, fixed per-point thermal declarations and supplied bands are preserved. '
  + 'The leading-two comparison is retained separately and uses the same first two complete bases. '
  + 'Up to four nonzero original pair weights can be necessary; independently overlapping bands do not establish a common witness. '
  + 'Original-static, additive-static and normalized original-course replays remain separate numerical evidence. '
  + 'A numerical consistency screen is not a certified solver bound, authenticated shared sky, physical change time or validated intervention.';

export function prepareThirdReceiverEvidence(originals, query) {
  const investigation = prepareThirdReceiverSource(originals, query), admitted = preflight(investigation);
  const reuse = [{}, {}, {}], reports = [];
  for (const splitAfterInterval of investigation.query.splitAfterIntervals) {
    const input = { readings: investigation.readings,
      query: { bins: 4, splitAfterInterval, sharingSource: investigation.query.sharingSource } };
    const bases = input.readings.map((reading, i) => buildBasis(reading, splitAfterInterval, reuse[i]));
    const firstTwo = completeEpochReport({ ...input, readings: input.readings.slice(0, 2) }, bases.slice(0, 2), admitted.prior,
      { model: EPOCH_SKY_MODEL, limits: EPOCH_SKY_LIMITS, reused: true, semantics: EPOCH_SKY_SEMANTICS });
    const joint = completeEpochReport(input, bases, admitted.joint, { model: THREE_EPOCH_MODEL,
      limits: { ...THIRD_RECEIVER_LIMITS, maxCandidates: THIRD_RECEIVER_LIMITS.maxIntersectionCandidates },
      numeric: intersectThreeProfileBands, exact: intersectThreeRationalProfileBands, reused: true, semantics,
      precomputedFamily: firstTwo.compatibility === 'incompatible' ? emptyFromLeadingTwo(input.readings) : null });
    verifySubset(firstTwo, joint);
    verifySubset(firstTwo.originalStatic, joint.originalStatic);
    verifySubset(firstTwo.additiveStatic, joint.additiveStatic);
    reports.push({ ...joint, firstTwo });
  }
  const sum = key => reports.reduce((total, report) => total + report.work[key], 0);
  const priorWitnessCourses = reports.reduce((total, report) => total + report.firstTwo.work.executedWitnessCourses, 0);
  const jointWitnessCourses = sum('executedWitnessCourses');
  const work = { ...admitted.work, geometryPasses: sum('geometryPasses'), actualSkyFaceTests: sum('actualSkyFaceTests'),
    completeBasisCourses: sum('completeBasisCourses'), executedBasisCourses: sum('executedBasisCourses'),
    reusedCompleteBasisCourses: sum('reusedCompleteBasisCourses'),
    executedJointWitnessCourses: jointWitnessCourses, executedPriorWitnessCourses: priorWitnessCourses,
    executedWitnessCourses: jointWitnessCourses + priorWitnessCourses,
    executedThermalCourses: sum('executedBasisCourses') + jointWitnessCourses + priorWitnessCourses,
    candidates: reports.reduce((total, report) => total + [report, report.firstTwo].reduce((n, r) => n
      + r.work.profileIntersection.candidates + r.originalStatic.work.candidates + r.additiveStatic.work.candidates, 0), 0),
    jointIntersectionsExcludedByLeadingTwo: reports.filter(report => report.work.profileIntersection.emptyByLeadingTwoSubset).length };
  work.executedCourseIntervals = work.executedThermalCourses * admitted.intervals;
  if (work.geometryPasses !== admitted.work.geometryPasses
      || work.completeBasisCourses !== admitted.work.completeBasisCourses
      || work.executedBasisCourses !== admitted.work.reservedExecutedBasisCourses
      || work.executedBasisCourses + work.reusedCompleteBasisCourses !== work.completeBasisCourses
      || work.executedJointWitnessCourses > admitted.work.reservedJointWitnessCourses
      || work.executedPriorWitnessCourses > admitted.work.reservedPriorWitnessCourses
      || work.executedWitnessCourses > admitted.work.reservedWitnessCourses
      || work.executedThermalCourses > admitted.work.reservedThermalCourses
      || work.executedCourseIntervals > admitted.work.reservedCourseIntervals
      || work.candidates > admitted.work.reservedCandidates)
    throw Error('The complete three-receiver inquiry exceeded its admitted work; no partial result is accepted');
  const firstTwoReports = reports.map(report => report.firstTwo);
  const compatibleBoundaries = reports.filter(report => report.compatibility === 'compatible').map(report => report.query.splitAfterInterval);
  const firstTwoCompatibleBoundaries = firstTwoReports.filter(report => report.compatibility === 'compatible').map(report => report.query.splitAfterInterval);
  const report = { status: 'compared', compatibility: compatibleBoundaries.length ? 'compatible' : 'incompatible',
    model: { ...THIRD_RECEIVER_MODEL }, query: { ...investigation.query, splitAfterIntervals: [...investigation.query.splitAfterIntervals] },
    cellIndex: investigation.readings[0].query.reading.cellIndex, finalUtc: reports[0].finalUtc,
    intervalCount: admitted.intervals, compatibleBoundaries, firstTwoCompatibleBoundaries,
    excludedByThird: firstTwoCompatibleBoundaries.filter(split => !compatibleBoundaries.includes(split)),
    boundaries: reports, ranges: boundaryRanges(reports), firstTwoRanges: boundaryRanges(firstTwoReports), work,
    semantics: semantics + ' Every offered boundary remains in supplied order, including incompatible alternatives. '
      + 'Outer bounds enclose the finite union and do not assert intermediate attainability. Each extreme keeps its original boundary and witness identity. '
      + 'Even one remaining offered boundary is only conditional on this model, these original readings and this offered list; it is not a measured change time.' };
  return { investigation, report };
}

export function parseThirdReceiverEvidence(text) {
  if (typeof text !== 'string') throw TypeError('Three-receiver boundary inputs must be JSON text');
  checkShadeHeatBytes(new Blob([text]).size);
  let raw;
  try { raw = JSON.parse(text); } catch { throw Error('Invalid three-receiver boundary input JSON'); }
  if (!exactKeys(raw, ['kind', 'model', 'readings', 'query']) || raw.kind !== THIRD_RECEIVER_KIND || !sameModel(raw.model))
    throw Error('Unsupported three-receiver boundary input model or saved results');
  return prepareThirdReceiverEvidence(raw.readings, raw.query);
}
