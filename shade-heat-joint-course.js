import { checkShadeHeatBytes } from './shade-heat.js';
import { prepareSkyCourseSource, SKY_COURSE_LIMITS } from './shade-heat-course-evidence.js';
import { buildOriginalBoundaryBasis, consequences, inspectWitness } from './shade-heat-epoch-kernel.js';
import { intersectThreeRationalProfileBands } from './shade-heat-profile-three-bands.js';
import { projectJointProfileFamily, JOINT_PROJECTION_LIMITS } from './shade-heat-joint-projection.js';
import { profileFraction } from './shade-heat-profile-band.js';
import { rational as q, add, sub, mul, cmp } from './vendor/chronos/exact-halfplanes.mjs';

export const SKY_JOINT_KIND = 'experimental-earth/two-original-time-joint-sky-inputs/1';
export const SKY_JOINT_MODEL = Object.freeze({
  name: 'three-final-readings-two-original-time-joint-consequences', version: 1,
  observation: 'three original final existing-surface bands at distinct receivers on one original course',
  profile: 'one shared four-bin early profile and one shared four-bin late profile throughout all original courses',
  boundary: 'one explicitly chosen original interval boundary',
  coefficient: 'represented C_i0+C_0j-C_00, gated by all sixteen complete original pair courses',
  consequence: 'exact joint image at two distinct original times with resolved geometry endpoints',
  question: 'two explicitly authored proposal-minus-existing temperature ceilings, separate from observations',
  witness: 'one common profile reconstructed from at most three complete-family vertices and replayed at all original times',
});
export const SKY_JOINT_LIMITS = Object.freeze({
  maxIntervals: 24, maxOriginalBoundaries: 25, maxGeometryChecks: SKY_COURSE_LIMITS.maxGeometryChecks,
  basisCourses: 192, witnessProfiles: 1, witnessCourses: 12, thermalCourses: 204,
  courseIntervals: 4896, replayEndpointRows: 75, numericalConsistencyScreenC: 1e-9,
  projection: JOINT_PROJECTION_LIMITS,
});
const ZERO = q(0);
const exactKeys = (value, keys) => value !== null && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const sameModel = value => exactKeys(value, Object.keys(SKY_JOINT_MODEL))
  && Object.keys(SKY_JOINT_MODEL).every(key => value[key] === SKY_JOINT_MODEL[key]);
const mixture = (candidate, row) => candidate.support.reduce((sum, bin, i) => add(sum, mul(candidate.weights[i], row[bin])), ZERO);

function preflight(source) {
  const originals = source.readings.map(({ source: input }) => {
    const path = input.declaration.path, cells = input.project.width * input.project.height;
    const intervals = Math.ceil((Date.parse(path.endUtc) - Date.parse(path.startUtc)) / (path.stepMinutes * 60000));
    return { intervals, estimatedRayTests: 6 * (cells - 1) * intervals,
      estimatedSkyFaceTests: 4 * (4 * (cells - 1) + 4) * (cells - 1) };
  });
  const intervals = originals[0].intervals, originalBoundaries = intervals + 1;
  const geometryChecks = originals.reduce((sum, row) => sum + row.estimatedRayTests + row.estimatedSkyFaceTests, 0);
  if (originals.length !== 3 || originals.some(row => row.intervals !== intervals)
      || intervals < 2 || intervals > SKY_JOINT_LIMITS.maxIntervals
      || source.query.limits.some(limit => limit.originalIndex >= originalBoundaries)
      || geometryChecks > SKY_JOINT_LIMITS.maxGeometryChecks)
    throw Error('Retain the complete three-source original course and choose two distinct original times within its allowance');
  return { originals, intervals, originalBoundaries, geometryPasses: 3, geometryChecks,
    reservedBasisCourses: 192, reservedWitnessProfiles: 1, reservedWitnessCourses: 12,
    reservedThermalCourses: 204, reservedCourseIntervals: 204 * intervals,
    reservedReplayEndpointRows: 3 * originalBoundaries,
    projection: { ...JOINT_PROJECTION_LIMITS } };
}

export function prepareSkyJointSource(originals, query) {
  if (!exactKeys(query, ['bins', 'splitAfterInterval', 'sharingSource', 'limits', 'limitSource'])
      || !Array.isArray(query.limits) || query.limits.length !== 2
      || !Array.from(query.limits).every(limit => exactKeys(limit, ['originalIndex', 'store', 'maximumDifferenceC'])
        && Number.isInteger(limit.originalIndex) && limit.originalIndex >= 0 && limit.originalIndex <= 24
        && ['surfaceC', 'subsurfaceC'].includes(limit.store) && Number.isFinite(limit.maximumDifferenceC))
      || query.limits[0].originalIndex === query.limits[1].originalIndex
      || typeof query.limitSource !== 'string' || !query.limitSource.trim() || query.limitSource.length > 400)
    throw Error('Declare two distinct original times, their temperature components, finite ceilings and the basis for these desired limits');
  const course = prepareSkyCourseSource(originals, { bins: query.bins,
    splitAfterInterval: query.splitAfterInterval, sharingSource: query.sharingSource });
  const investigation = { kind: SKY_JOINT_KIND, model: { ...SKY_JOINT_MODEL }, readings: course.readings,
    query: { ...course.query, limits: query.limits.map(limit => ({ ...limit })), limitSource: query.limitSource.trim() } };
  checkShadeHeatBytes(new Blob([JSON.stringify(investigation)]).size);
  preflight(investigation);
  return investigation;
}

function evaluate(investigation) {
  const work = preflight(investigation), split = investigation.query.splitAfterInterval;
  // Complete every original pair at all three points before any compatibility decision.
  const bases = investigation.readings.map(input => buildOriginalBoundaryBasis(input, split));
  const originalBoundaries = bases[0].originalBoundaries;
  if (originalBoundaries.length !== work.originalBoundaries
      || bases.some(basis => JSON.stringify(basis.originalBoundaries) !== JSON.stringify(originalBoundaries)))
    throw Error('The original paired courses do not retain identical original times');
  for (const [index, basis] of bases.entries()) {
    if (!basis.pairs.every(pair => pair.final.existing.lower.surfaceC === pair.final.existing.upper.surfaceC))
      throw Error('Original reading ' + (index + 1) + ' has unresolved existing final endpoints; no favorable endpoint is selected');
    if (cmp(basis.maximumCourseDiscrepancyC, q(SKY_JOINT_LIMITS.numericalConsistencyScreenC)) > 0)
      throw Error('An original pair course exceeds the declared additive consistency screen; no partial inquiry is accepted');
  }
  for (const limit of investigation.query.limits) {
    if (!bases[0].pairs.every(pair => ['existing', 'proposal'].every(target =>
      pair.trace.states[target].lower[limit.originalIndex][limit.store]
        === pair.trace.states[target].upper[limit.originalIndex][limit.store])))
      throw Error('A selected original-time objective has unresolved geometry endpoints; exact joint consequences are not selected from favorable endpoints');
  }
  const bands = investigation.readings.map(({ query: { reading } }) => ({
    temperatureC: reading.temperatureC, halfWidthC: reading.halfWidthC }));
  const observed = bases.map(basis => basis.coefficients.map(value => value.final.existing.lower.surfaceC));
  const family = intersectThreeRationalProfileBands(observed, bands);
  const objectives = investigation.query.limits.map(limit => bases[0].courseCoefficients[limit.originalIndex].map(value =>
    sub(value.final.proposal.lower[limit.store], value.final.existing.lower[limit.store])));
  const ceilings = investigation.query.limits.map(limit => q(limit.maximumDifferenceC));
  const projection = projectJointProfileFamily(family.candidates, objectives, ceilings);
  let witness = null;
  if (projection.witness) {
    const candidate = { support: [...projection.witness.support], weights: projection.witness.weights.map(value => add(value, ZERO)) };
    candidate.observed = observed.map(row => mixture(candidate, row));
    if (candidate.observed.some((value, i) => cmp(value, family.bands[i].lower) < 0 || cmp(value, family.bands[i].upper) > 0))
      throw Error('The constructed joint profile does not retain every original final band');
    const described = consequences([candidate], bases[0].coefficients);
    const replay = inspectWitness(described.selected[0], bases, bands, split, SKY_JOINT_LIMITS.numericalConsistencyScreenC, true);
    const originalLimits = investigation.query.limits.map((limit, i) => {
      const row = replay.originalReplays[0].originalCourse[limit.originalIndex];
      const lower = sub(q(row.originalC.proposal.lower[limit.store]), q(row.originalC.existing.upper[limit.store]));
      const upper = sub(q(row.originalC.proposal.upper[limit.store]), q(row.originalC.existing.lower[limit.store]));
      return { ...limit, utc: row.utc, differenceC: { lower: profileFraction(lower), upper: profileFraction(upper) },
        endpointStatus: { lower: cmp(lower, ceilings[i]) <= 0 ? 'within-authored-ceiling' : 'above-authored-ceiling',
          upper: cmp(upper, ceilings[i]) <= 0 ? 'within-authored-ceiling' : 'above-authored-ceiling' } };
    });
    witness = { ...described.witnesses[0], ...replay,
      jointValuesC: projection.witness.values.map(profileFraction), originalLimits,
      construction: projection.witness.combination.map(row => ({ candidateId: row.candidateId, weight: profileFraction(row.weight) })) };
  }
  const executedBasisCourses = bases.reduce((sum, basis) => sum + basis.executedCourses, 0);
  const executedWitnessCourses = witness ? 12 : 0, executedThermalCourses = executedBasisCourses + executedWitnessCourses;
  const executedCourseIntervals = executedThermalCourses * work.intervals;
  const actualReplayEndpointRows = witness ? 3 * originalBoundaries.length : 0;
  if (executedBasisCourses !== work.reservedBasisCourses || executedWitnessCourses > work.reservedWitnessCourses
      || executedThermalCourses > work.reservedThermalCourses || executedCourseIntervals > work.reservedCourseIntervals
      || actualReplayEndpointRows > work.reservedReplayEndpointRows)
    throw Error('The complete joint consequence inquiry exceeded its admitted work');
  return { status: 'compared', observationCompatibility: family.status, jointCompatibility: projection.status,
    model: { ...SKY_JOINT_MODEL }, query: { ...investigation.query, limits: investigation.query.limits.map(limit => ({ ...limit })) },
    cellIndex: investigation.readings[0].query.reading.cellIndex,
    finalUtc: investigation.readings[0].query.reading.utc, splitUtc: bases[0].splitUtc, originalBoundaries,
    axes: investigation.query.limits.map((limit, i) => ({ ...originalBoundaries[limit.originalIndex],
      store: limit.store, maximumDifferenceC: profileFraction(ceilings[i]) })),
    individualRanges: projection.ranges?.map(range => ({ lower: profileFraction(range.lower), upper: profileFraction(range.upper),
      lowerCandidateId: range.lowerCandidateId, upperCandidateId: range.upperCandidateId,
      individuallyPossible: range.individuallyPossible })) ?? null,
    dimension: projection.dimension,
    hull: projection.hull.map(point => ({ candidateId: point.candidateId, differencesC: point.values.map(profileFraction) })),
    feasibleRegion: projection.feasible.map(point => point.map(profileFraction)), witness,
    readings: investigation.readings.map((input, i) => ({ ...input.query.reading, originalBins: input.query.bins,
      activeCommonBins: 4, bandC: { lower: profileFraction(family.bands[i].lower), upper: profileFraction(family.bands[i].upper) } })),
    diagnostics: bases.map(basis => basis.geometry.diagnostics),
    numericalEvidence: { consistencyScreenC: SKY_JOINT_LIMITS.numericalConsistencyScreenC,
      scope: 'Original pairs and the displayed shared-profile numerical replay are screened at original boundaries; this is not a physical or uniform every-profile error bound.',
      points: bases.map(basis => ({ cellIndex: basis.input.query.reading.cellIndex,
        maximumAdditivePairDiscrepancyC: profileFraction(basis.maximumCourseDiscrepancyC), originalBoundaryScreens: basis.courseScreens })) },
    work: { ...work, executedBasisCourses, executedWitnessCourses, executedThermalCourses, executedCourseIntervals,
      actualReplayEndpointRows, exactWitnessMarginalEqualities: witness?.exactMarginalEqualities ?? 0,
      profileIntersection: family.work, executedProjection: projection.work },
    semantics: 'The two ceilings are desired paired consequences, not additional observations. The complete exact image of one common final-band profile family is intersected with both ceilings at the two selected original times. '
      + 'Joint feasibility concerns only the represented additive coefficients with resolved selected geometry endpoints. Every feasible result includes one normalized common profile pair and a separate complete original numerical replay at all three points. '
      + 'Original replay values and their ceiling/final-band statuses can differ from the exact additive claim. No new time samples, interpolation, continuous-time bounds, physical history or validated intervention effects are inferred.' };
}

export function prepareSkyJointEvidence(originals, query) {
  const investigation = prepareSkyJointSource(originals, query);
  return { investigation, report: evaluate(investigation) };
}
export function parseSkyJointSource(text) {
  if (typeof text !== 'string') throw TypeError('Joint original-time inputs must be JSON text');
  checkShadeHeatBytes(new Blob([text]).size);
  let raw;
  try { raw = JSON.parse(text); } catch { throw Error('Invalid joint original-time input JSON'); }
  if (!exactKeys(raw, ['kind', 'model', 'readings', 'query']) || raw.kind !== SKY_JOINT_KIND || !sameModel(raw.model))
    throw Error('Use the declared joint original-time input model without saved results');
  return prepareSkyJointSource(raw.readings, raw.query);
}
export function parseSkyJointEvidence(text) {
  const investigation = parseSkyJointSource(text);
  return { investigation, report: evaluate(investigation) };
}
