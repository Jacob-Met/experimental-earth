import { checkShadeHeatBytes, SHADE_HEAT_LIMITS } from './shade-heat.js';
import { prepareThirdReceiverSource } from './shade-heat-third-receiver.js';
import { buildOriginalBoundaryBasis, consequences, staticComparison, inspectWitness } from './shade-heat-epoch-kernel.js';
import { intersectThreeProfileBands, intersectThreeRationalProfileBands, THREE_PROFILE_BAND_MAX_CANDIDATES } from './shade-heat-profile-three-bands.js';
import { profileFraction } from './shade-heat-profile-band.js';
import { rational as q, cmp } from './vendor/chronos/exact-halfplanes.mjs';

export const SKY_COURSE_KIND = 'experimental-earth/three-receiver-original-boundary-course-inputs/1';
export const SKY_COURSE_MODEL = Object.freeze({
  name: 'three-original-final-readings-two-epoch-original-course', version: 1,
  observation: 'three original final existing-surface bands at distinct receivers on the same original course',
  profile: 'one common four-bin early profile and one common four-bin late profile for every time, point and design',
  boundary: 'one explicitly chosen original interval boundary',
  coefficient: 'exact represented C_i0+C_0j-C_00 at each original interval end, gated by all sixteen complete pair courses',
  consequence: 'pointwise paired temperature bounds at original interval ends with complete common-profile witnesses',
});
export const SKY_COURSE_LIMITS = Object.freeze({ bins: 4, pairs: 16, maxIntervals: 24, maxOriginalBoundaries: 25,
  maxGeometryChecks: SHADE_HEAT_LIMITS.maxRayTests, maxBasisCourses: 192,
  maxWitnessProfiles: 100, maxWitnessCourses: 1200, maxCourses: 1392, maxCourseIntervals: 33408,
  maxCandidates: THREE_PROFILE_BAND_MAX_CANDIDATES, maxStaticCandidates: 192,
  maxCourseObjectiveMixtureTerms: THREE_PROFILE_BAND_MAX_CANDIDATES * 25 * 8 * 4,
  maxReplayEndpointRows: 7500, numericalConsistencyScreenC: 1e-9 });

const exactKeys = (value, keys) => value !== null && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const sameModel = value => exactKeys(value, Object.keys(SKY_COURSE_MODEL))
  && Object.keys(SKY_COURSE_MODEL).every(key => value[key] === SKY_COURSE_MODEL[key]);
const boundaryIdentity = rows => JSON.stringify(rows);

function preflight(investigation) {
  const sources = investigation.readings.map(({ source }) => {
    const path = source.declaration.path, cells = source.project.width * source.project.height;
    const intervals = Math.ceil((Date.parse(path.endUtc) - Date.parse(path.startUtc)) / (path.stepMinutes * 60000));
    return { intervals, estimatedRayTests: 6 * (cells - 1) * intervals,
      estimatedSkyFaceTests: 4 * (4 * (cells - 1) + 4) * (cells - 1) };
  });
  const intervals = sources[0].intervals, originalBoundaries = intervals + 1;
  if (sources.length !== 3 || sources.some(source => source.intervals !== intervals)
      || intervals < 2 || intervals > SKY_COURSE_LIMITS.maxIntervals
      || investigation.query.splitAfterInterval >= intervals)
    throw Error('Retain three complete original courses and one internal original interval boundary');
  const geometryChecks = sources.reduce((sum, source) => sum + source.estimatedRayTests + source.estimatedSkyFaceTests, 0);
  const basisCourses = 192, reservedWitnessProfiles = 4 * originalBoundaries;
  const reservedWitnessCourses = 12 * reservedWitnessProfiles;
  const reservedThermalCourses = basisCourses + reservedWitnessCourses;
  const courseIntervals = reservedThermalCourses * intervals;
  const courseObjectiveMixtureTerms = SKY_COURSE_LIMITS.maxCandidates * originalBoundaries * 8 * 4;
  const replayEndpointRows = reservedWitnessProfiles * 3 * originalBoundaries;
  if (geometryChecks > SKY_COURSE_LIMITS.maxGeometryChecks || originalBoundaries > SKY_COURSE_LIMITS.maxOriginalBoundaries
      || reservedWitnessProfiles > SKY_COURSE_LIMITS.maxWitnessProfiles
      || reservedWitnessCourses > SKY_COURSE_LIMITS.maxWitnessCourses
      || reservedThermalCourses > SKY_COURSE_LIMITS.maxCourses || courseIntervals > SKY_COURSE_LIMITS.maxCourseIntervals
      || courseObjectiveMixtureTerms > SKY_COURSE_LIMITS.maxCourseObjectiveMixtureTerms
      || replayEndpointRows > SKY_COURSE_LIMITS.maxReplayEndpointRows)
    throw Error('The complete original course and every reserved extreme-profile replay exceed the shared inquiry allowance');
  return { sources, geometryPasses: 3, geometryChecks, intervals, originalBoundaries, basisCourses,
    reservedWitnessProfiles, reservedWitnessCourses, reservedThermalCourses, courseIntervals,
    courseObjectiveMixtureTerms, replayEndpointRows,
    candidateCapacity: SKY_COURSE_LIMITS.maxCandidates + SKY_COURSE_LIMITS.maxStaticCandidates };
}

export function prepareSkyCourseSource(originals, query) {
  if (!exactKeys(query, ['bins', 'splitAfterInterval', 'sharingSource']) || query.bins !== 4
      || !Number.isInteger(query.splitAfterInterval) || query.splitAfterInterval < 1)
    throw Error('Declare four common bins and one explicit original interval boundary');
  const joined = prepareThirdReceiverSource(originals, { bins: 4,
    splitAfterIntervals: [query.splitAfterInterval], sharingSource: query.sharingSource });
  const investigation = { kind: SKY_COURSE_KIND, model: { ...SKY_COURSE_MODEL }, readings: joined.readings,
    query: { bins: 4, splitAfterInterval: query.splitAfterInterval, sharingSource: joined.query.sharingSource } };
  checkShadeHeatBytes(new Blob([JSON.stringify(investigation)]).size);
  preflight(investigation);
  return investigation;
}

function evaluate(investigation) {
  const work = preflight(investigation), split = investigation.query.splitAfterInterval;
  // All three complete original bases precede every observation compatibility test.
  const bases = investigation.readings.map(input => buildOriginalBoundaryBasis(input, split));
  const originalBoundaries = bases[0].originalBoundaries;
  if (originalBoundaries.length !== work.originalBoundaries
      || bases.some(basis => boundaryIdentity(basis.originalBoundaries) !== boundaryIdentity(originalBoundaries)))
    throw Error('The complete original boundary identities do not coincide');
  for (const [index, basis] of bases.entries()) {
    if (!basis.pairs.every(pair => pair.final.existing.lower.surfaceC === pair.final.existing.upper.surfaceC))
      throw Error('Original reading ' + (index + 1) + ' has unresolved existing final endpoints; no favorable endpoint is selected');
    if (cmp(basis.maximumCourseDiscrepancyC, q(SKY_COURSE_LIMITS.numericalConsistencyScreenC)) > 0)
      throw Error('An original interval-end pair exceeds the declared additive consistency screen; no partial course is accepted');
  }
  const bands = investigation.readings.map(input => ({ temperatureC: input.query.reading.temperatureC,
    halfWidthC: input.query.reading.halfWidthC }));
  const family = intersectThreeRationalProfileBands(bases.map(basis =>
    basis.coefficients.map(v => v.final.existing.lower.surfaceC)), bands);
  if (family.candidates.length > SKY_COURSE_LIMITS.maxCandidates) throw Error('Complete original-course candidate allowance exhausted');
  const selectedIds = new Set();
  const pointwiseCourse = originalBoundaries.map((boundary, time) => {
    const result = consequences(family.candidates, bases[0].courseCoefficients[time]);
    for (const witness of result.witnesses) selectedIds.add(witness.id);
    return { ...boundary, ranges: result.ranges };
  });
  if (selectedIds.size > work.reservedWitnessProfiles) throw Error('Complete original-course witness allowance exhausted');
  const witnesses = [...selectedIds].map(id => {
    // Describe this exact candidate at the final reading time, then replay the
    // same two normalized marginal profiles through every original interval.
    const final = consequences([family.candidates[id]], bases[0].coefficients);
    const item = { ...final.selected[0], id };
    return { ...final.witnesses[0], id,
      ...inspectWitness(item, bases, bands, split, SKY_COURSE_LIMITS.numericalConsistencyScreenC, true) };
  });
  const originalStatic = staticComparison(bases, bands, false, intersectThreeProfileBands, intersectThreeRationalProfileBands);
  const additiveStatic = staticComparison(bases, bands, true, intersectThreeProfileBands, intersectThreeRationalProfileBands);
  const executedBasisCourses = bases.reduce((sum, basis) => sum + basis.executedCourses, 0);
  const executedWitnessCourses = witnesses.length * 12, executedThermalCourses = executedBasisCourses + executedWitnessCourses;
  const actualCourseObjectiveMixtureTerms = originalBoundaries.length * 8
    * family.candidates.reduce((sum, candidate) => sum + candidate.support.length, 0);
  const actualReplayEndpointRows = witnesses.length * 3 * originalBoundaries.length;
  if (executedBasisCourses !== work.basisCourses || executedWitnessCourses > work.reservedWitnessCourses
      || executedThermalCourses > work.reservedThermalCourses
      || executedThermalCourses * work.intervals > work.courseIntervals
      || actualCourseObjectiveMixtureTerms > work.courseObjectiveMixtureTerms
      || actualReplayEndpointRows > work.replayEndpointRows)
    throw Error('The complete original-course execution exceeded its admitted work; no partial result is accepted');
  return { status: 'compared', compatibility: family.status, model: { ...SKY_COURSE_MODEL },
    query: { ...investigation.query }, cellIndex: investigation.readings[0].query.reading.cellIndex,
    finalUtc: investigation.readings[0].query.reading.utc, splitUtc: bases[0].splitUtc,
    intervalCount: work.intervals, pointwiseCourse, witnesses,
    readings: investigation.readings.map((input, index) => ({ ...input.query.reading, originalBins: input.query.bins,
      activeCommonBins: 4, bandC: Object.fromEntries(['lower', 'upper'].map(bound =>
        [bound, profileFraction(family.bands[index][bound])])) })),
    originalStatic, additiveStatic, staticCompatibilityAgrees: originalStatic.compatibility === additiveStatic.compatibility,
    numericalEvidence: { consistencyScreenC: SKY_COURSE_LIMITS.numericalConsistencyScreenC,
      scope: 'Completed original pair courses and displayed whole-course witnesses are screened at every original interval end; this is not a certified every-profile or physical error bound.',
      points: bases.map(basis => ({ cellIndex: basis.input.query.reading.cellIndex,
        maximumAdditivePairDiscrepancyC: profileFraction(basis.maximumCourseDiscrepancyC), originalBoundaryScreens: basis.courseScreens })) },
    diagnostics: bases.map(basis => basis.geometry.diagnostics),
    work: { ...work, executedBasisCourses, executedWitnessCourses, executedThermalCourses,
      executedCourseIntervals: executedThermalCourses * work.intervals,
      actualCourseObjectiveMixtureTerms, actualReplayEndpointRows,
      actualSkyFaceTests: bases.reduce((sum, basis) => sum + basis.geometry.sampled.diffuseSky.estimatedFaceTests, 0),
      profileIntersection: family.work,
      exactWitnessMarginalEqualities: witnesses.reduce((sum, witness) => sum + witness.exactMarginalEqualities, 0) },
    semantics: 'The same three original final bands constrain one common pair of sky profiles throughout the original course. '
      + 'Pointwise ranges concern only the declared additive represented-coefficient model at the initial state and original interval ends. '
      + 'Different times and components may attain their extrema at different profiles; the envelope is not asserted to be a realizable trajectory. '
      + 'Every displayed witness retains one shared profile pair across all original times, receivers and designs, with separate original numerical replays and final-band statuses. '
      + 'Original UTC/minutes and accumulated thermal minutes are reported separately without nearest-time selection or interpolation. '
      + 'These are not continuous-time extrema, a reconstructed physical history, an identified change time or validated physical effects.' };
}

export function prepareSkyCourseEvidence(originals, query) {
  const investigation = prepareSkyCourseSource(originals, query);
  return { investigation, report: evaluate(investigation) };
}

export function parseSkyCourseEvidence(text) {
  if (typeof text !== 'string') throw TypeError('Original sky-course inputs must be JSON text');
  checkShadeHeatBytes(new Blob([text]).size);
  let raw;
  try { raw = JSON.parse(text); } catch { throw Error('Invalid original sky-course input JSON'); }
  if (!exactKeys(raw, ['kind', 'model', 'readings', 'query']) || raw.kind !== SKY_COURSE_KIND || !sameModel(raw.model))
    throw Error('Unsupported original sky-course model or saved results');
  return prepareSkyCourseEvidence(raw.readings, raw.query);
}
