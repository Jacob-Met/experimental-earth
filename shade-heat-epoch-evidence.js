import { prepareSharedSkyOriginalReadings } from './shade-heat-spatial-evidence.js';
import { checkShadeHeatBytes, SHADE_HEAT_LIMITS } from './shade-heat.js';
import { sampleProfileBasisGeometry, evaluateProfileThermalCourse } from './shade-heat-profile-basis.js';
import { intersectTwoProfileBands, intersectTwoRationalProfileBands } from './shade-heat-profile-two-bands.js';
import { profileFraction } from './shade-heat-profile-band.js';
import { rational as q, add, sub, mul, cmp } from './vendor/chronos/exact-halfplanes.mjs';

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

const targets = ['existing', 'proposal'], bounds = ['lower', 'upper'], stores = ['surfaceC', 'subsurfaceC'];
const ZERO = q(0), ONE = q(1), BINS = EPOCH_SKY_LIMITS.bins;
const exactKeys = (v, keys) => v !== null && typeof v === 'object' && !Array.isArray(v)
  && Object.keys(v).length === keys.length && keys.every(key => Object.hasOwn(v, key));
const sameModel = value => exactKeys(value, Object.keys(EPOCH_SKY_MODEL))
  && Object.keys(EPOCH_SKY_MODEL).every(key => value[key] === EPOCH_SKY_MODEL[key]);
const abs = value => cmp(value, ZERO) < 0 ? sub(ZERO, value) : value;
const max = (a, b) => cmp(a, b) >= 0 ? a : b;
const mixture = (candidate, coefficients) => candidate.support.reduce((sum, bin, i) =>
  add(sum, mul(candidate.weights[i], coefficients[bin])), ZERO);
const mapFinal = getter => Object.fromEntries(targets.map(target => [target,
  Object.fromEntries(bounds.map(bound => [bound,
    Object.fromEntries(stores.map(store => [store, getter(target, bound, store)]))]))]));

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

function buildBasis(input, splitAfterInterval) {
  const source = input.source, geometry = sampleProfileBasisGeometry(source, BINS), pairs = [];
  if (splitAfterInterval >= geometry.sampled.intervals.length)
    throw Error('The declared split is not an original interval boundary');
  for (let early = 0; early < BINS; early++) for (let late = 0; late < BINS; late++) {
    const final = evaluateProfileThermalCourse(source, geometry,
      (target, _row, index) => bounds.map(bound =>
        geometry.transmissions[target][bound][index < splitAfterInterval ? early : late].transmission),
      'Two-epoch one-bin sky pair ' + (early + 1) + '/' + (late + 1),
      'Complete two-epoch inquiry refused at pair ' + (early + 1) + '/' + (late + 1));
    pairs.push({ early, late, final });
  }
  const coefficients = pairs.map(({ early, late }) => ({ early, late, final: mapFinal((target, bound, store) =>
    sub(add(q(pairs[early * BINS].final[target][bound][store]), q(pairs[late].final[target][bound][store])),
      q(pairs[0].final[target][bound][store]))) }));
  let maximumDiscrepancyC = ZERO, nonzeroDiscrepancies = 0;
  const discrepancies = pairs.map((pair, index) => ({ earlyBin: pair.early, lateBin: pair.late,
    originalFinalC: mapFinal((target, bound, store) => pair.final[target][bound][store]),
    additiveMinusOriginalC: mapFinal((target, bound, store) => {
      const delta = sub(coefficients[index].final[target][bound][store], q(pair.final[target][bound][store]));
      maximumDiscrepancyC = max(maximumDiscrepancyC, abs(delta));
      if (cmp(delta, ZERO)) nonzeroDiscrepancies++;
      return profileFraction(delta);
    }) }));
  return { input, geometry, pairs, coefficients, maximumDiscrepancyC, nonzeroDiscrepancies, discrepancies,
    splitUtc: new Date(Date.parse(source.declaration.path.startUtc)
      + geometry.sampled.intervals[splitAfterInterval].fromMinute * 60000).toISOString() };
}

function consequences(candidates, coefficients) {
  const evaluated = candidates.map((candidate, id) => {
    const final = mapFinal((target, bound, store) =>
      mixture(candidate, coefficients.map(v => v.final[target][bound][store])));
    const difference = Object.fromEntries(stores.map(store => [store, [
      sub(final.proposal.lower[store], final.existing.upper[store]),
      sub(final.proposal.upper[store], final.existing.lower[store]),
    ]]));
    return { id, candidate, final, difference };
  });
  if (!evaluated.length) return { ranges: null, witnesses: [], selected: [] };
  const ids = new Set();
  const ranges = Object.fromEntries(stores.map(store => [store,
    Object.fromEntries(bounds.map((bound, side) => {
      let best = evaluated[0];
      for (const item of evaluated) {
        const order = cmp(item.difference[store][side], best.difference[store][side]);
        if (side === 0 ? order < 0 : order > 0) best = item;
      }
      ids.add(best.id);
      return [bound, { differenceC: profileFraction(best.difference[store][side]), witnessId: best.id }];
    }))]));
  const selected = [...ids].map(id => evaluated[id]);
  const witnesses = selected.map(item => ({ id: item.id, support: [...item.candidate.support],
    masses: Array.from({ length: coefficients.length }, (_, index) => {
      const position = item.candidate.support.indexOf(index);
      return profileFraction(position < 0 ? ZERO : item.candidate.weights[position]);
    }), observedC: item.candidate.observed.map(profileFraction),
    finalC: mapFinal((target, bound, store) => profileFraction(item.final[target][bound][store])),
    differenceC: Object.fromEntries(stores.map(store => [store, item.difference[store].map(profileFraction)])) }));
  return { ranges, witnesses, selected };
}

function staticComparison(bases, bands, additive) {
  const coefficients = bases.map(basis => (additive ? basis.coefficients : basis.pairs.map(pair => ({
    ...pair, final: mapFinal((target, bound, store) => q(pair.final[target][bound][store])),
  }))).filter(pair => pair.early === pair.late));
  const rows = coefficients.map(points => points.map(v => v.final.existing.lower.surfaceC));
  const family = additive ? intersectTwoRationalProfileBands(rows, bands)
    : intersectTwoProfileBands(bases.map(basis => basis.pairs.filter(pair => pair.early === pair.late)
      .map(pair => pair.final.existing.lower.surfaceC)), bands);
  const result = consequences(family.candidates, coefficients[0]);
  return { compatibility: family.status, ranges: result.ranges, witnesses: result.witnesses, work: family.work };
}

function inspectWitness(item, bases, bands, splitAfterInterval) {
  const phases = [Array.from({ length: BINS }, () => ZERO), Array.from({ length: BINS }, () => ZERO)];
  item.candidate.support.forEach((pair, index) => {
    const weight = item.candidate.weights[index];
    phases[0][Math.floor(pair / BINS)] = add(phases[0][Math.floor(pair / BINS)], weight);
    phases[1][pair % BINS] = add(phases[1][pair % BINS], weight);
  });
  for (const phase of phases) if (cmp(phase.reduce(add, ZERO), ONE)) throw Error('Exact epoch mass was lost');
  const product = { support: Array.from({ length: BINS * BINS }, (_, i) => i),
    weights: Array.from({ length: BINS * BINS }, (_, i) => mul(phases[0][Math.floor(i / BINS)], phases[1][i % BINS])) };
  const approximate = phases.map(phase => {
    const values = phase.map(value => profileFraction(value).lower), sum = values.reduce((a, b) => a + b, 0);
    if (!(sum > 0) || !Number.isFinite(sum)) throw Error('Approximate epoch replay lost positive finite mass');
    return { weights: values.map(value => value / sum), preNormalizationMass: sum, massDrift: sum - 1 };
  });
  let maximumReplayResidualC = ZERO, exactMarginalEqualities = 0;
  const originalReplays = bases.map((basis, sourceIndex) => {
    const final = evaluateProfileThermalCourse(basis.input.source, basis.geometry,
      (target, _row, index) => bounds.map(bound => approximate[index < splitAfterInterval ? 0 : 1].weights.reduce(
        (sum, weight, bin) => sum + weight * basis.geometry.transmissions[target][bound][bin].transmission, 0)),
      'Normalized approximate replay of exact two-epoch witness ' + item.id,
      'Complete two-epoch witness replay refused at witness ' + item.id);
    const residualC = mapFinal((target, bound, store) => {
      const row = basis.coefficients.map(v => v.final[target][bound][store]);
      const expected = mixture(item.candidate, row);
      if (cmp(expected, mixture(product, row))) throw Error('Exact additive marginal equivalence was lost');
      exactMarginalEqualities++;
      const residual = sub(q(final[target][bound][store]), expected);
      maximumReplayResidualC = max(maximumReplayResidualC, abs(residual));
      return profileFraction(residual);
    });
    const reading = bands[sourceIndex], lower = sub(q(reading.temperatureC), q(reading.halfWidthC)),
      upper = add(q(reading.temperatureC), q(reading.halfWidthC));
    return { cellIndex: basis.input.query.reading.cellIndex, originalFinalC: final,
      originalMinusAdditiveC: residualC,
      originalObservationEndpointStatus: Object.fromEntries(bounds.map(bound => {
        const value = q(final.existing[bound].surfaceC);
        return [bound, cmp(value, lower) >= 0 && cmp(value, upper) <= 0 ? 'within-original-band' : 'outside-original-band'];
      })) };
  });
  if (cmp(maximumReplayResidualC, q(EPOCH_SKY_LIMITS.numericalConsistencyScreenC)) > 0)
    throw Error('An original witness replay exceeds the declared numerical consistency screen; no partial inquiry is accepted');
  return { phaseProfiles: phases.map(phase => phase.map(profileFraction)), approximateProfiles: approximate,
    originalReplays, maximumReplayResidualC: profileFraction(maximumReplayResidualC), exactMarginalEqualities };
}

function evaluate(investigation) {
  const work = preflight(investigation), split = investigation.query.splitAfterInterval;
  // Both complete original pair bases are prerequisites. Neither band filters a basis.
  const bases = investigation.readings.map(input => buildBasis(input, split));
  for (let i = 0; i < bases.length; i++) {
    if (!bases[i].pairs.every(pair => pair.final.existing.lower.surfaceC === pair.final.existing.upper.surfaceC))
      throw Error('Original reading ' + (i + 1) + ' has unresolved existing observation endpoints; no favorable endpoint is selected');
    if (cmp(bases[i].maximumDiscrepancyC, q(EPOCH_SKY_LIMITS.numericalConsistencyScreenC)) > 0)
      throw Error('Original pair courses exceed the declared additive consistency screen; no partial inquiry is accepted');
  }
  if (bases[0].splitUtc !== bases[1].splitUtc) throw Error('Original interval boundaries do not coincide');
  const bands = investigation.readings.map(input => ({ temperatureC: input.query.reading.temperatureC,
    halfWidthC: input.query.reading.halfWidthC }));
  const family = intersectTwoRationalProfileBands(bases.map(basis =>
    basis.coefficients.map(v => v.final.existing.lower.surfaceC)), bands);
  if (family.candidates.length > EPOCH_SKY_LIMITS.maxCandidates) throw Error('Complete two-epoch candidate allowance exhausted');
  const consequence = consequences(family.candidates, bases[0].coefficients);
  const witnesses = consequence.witnesses.map((witness, i) => ({ ...witness,
    ...inspectWitness(consequence.selected[i], bases, bands, split) }));
  const originalStatic = staticComparison(bases, bands, false), additiveStatic = staticComparison(bases, bands, true);
  return { status: 'compared', compatibility: family.status, model: { ...EPOCH_SKY_MODEL },
    query: { ...investigation.query }, cellIndex: investigation.readings[0].query.reading.cellIndex,
    finalUtc: investigation.readings[0].query.reading.utc, splitUtc: bases[0].splitUtc,
    intervalCount: bases[0].geometry.sampled.intervals.length,
    readings: investigation.readings.map((input, i) => ({ ...input.query.reading, originalBins: input.query.bins,
      activeCommonBins: BINS, bandC: Object.fromEntries(bounds.map(bound => [bound, profileFraction(family.bands[i][bound])])) })),
    originalStatic, additiveStatic, staticCompatibilityAgrees: originalStatic.compatibility === additiveStatic.compatibility,
    ranges: consequence.ranges, witnesses,
    numericalEvidence: { consistencyScreenC: EPOCH_SKY_LIMITS.numericalConsistencyScreenC,
      scope: 'A bounded numerical consistency screen of completed basis courses and displayed witnesses; not a certified error bound for every profile or physical measurement.',
      points: bases.map(basis => ({ cellIndex: basis.input.query.reading.cellIndex,
        maximumAdditivePairDiscrepancyC: profileFraction(basis.maximumDiscrepancyC),
        nonzeroDiscrepancies: basis.nonzeroDiscrepancies, pairs: basis.discrepancies })) },
    diagnostics: bases.map(basis => basis.geometry.diagnostics),
    work: { ...work, executedBasisCourses: bases.length * BINS * BINS * 4,
      executedWitnessCourses: witnesses.length * bases.length * 4,
      executedThermalCourses: bases.length * BINS * BINS * 4 + witnesses.length * bases.length * 4,
      actualSkyFaceTests: bases.reduce((sum, basis) => sum + basis.geometry.sampled.diffuseSky.estimatedFaceTests, 0),
      profileIntersection: family.work,
      exactWitnessMarginalEqualities: witnesses.reduce((sum, witness) => sum + witness.exactMarginalEqualities, 0) },
    semantics: 'Each exact early and late profile supplies both original receivers and both designs. The exact additive surrogate uses all sixteen complete original one-bin pair courses as a validity gate and seven reference courses for its coefficients. '
      + 'Exact joint mixtures and the product of their exact marginals have identical additive consequences; approximate replay weights are separately normalized. '
      + 'The original static model and the additive static specialization are distinct comparisons, so their agreement is reported rather than assumed. '
      + 'Zero-width bands and exact ranges apply only to the declared represented-coefficient model. Original floating-course discrepancies and replay band statuses remain visible. '
      + 'This does not recover an actual sky, establish physical causation, authenticate shared conditions or certify geometry, thermal integration or every-profile numerical error.' };
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
