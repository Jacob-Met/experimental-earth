import { sampleProfileBasisGeometry, evaluateProfileThermalCourse, evaluateProfileOriginalBoundaryCourse } from './shade-heat-profile-basis.js';
import { intersectTwoProfileBands, intersectTwoRationalProfileBands } from './shade-heat-profile-two-bands.js';
import { profileFraction } from './shade-heat-profile-band.js';
import { rational as q, add, sub, mul, cmp } from './vendor/chronos/exact-halfplanes.mjs';

// Internal complete-course adapter. Public inquiries normalize every original and
// admit their aggregate work before calling it. Reuse is private to one inquiry.
const targets = ['existing', 'proposal'], bounds = ['lower', 'upper'], stores = ['surfaceC', 'subsurfaceC'];
const ZERO = q(0), ONE = q(1), BINS = 4;
const abs = value => cmp(value, ZERO) < 0 ? sub(ZERO, value) : value;
const max = (a, b) => cmp(a, b) >= 0 ? a : b;
const mixture = (candidate, coefficients) => candidate.support.reduce((sum, bin, i) =>
  add(sum, mul(candidate.weights[i], coefficients[bin])), ZERO);
const mapFinal = getter => Object.fromEntries(targets.map(target => [target,
  Object.fromEntries(bounds.map(bound => [bound,
    Object.fromEntries(stores.map(store => [store, getter(target, bound, store)]))]))]));

const coefficientsAt = (pairs, at) => pairs.map(({ early, late }) => ({ early, late,
  final: mapFinal((target, bound, store) => sub(add(
    q(at(pairs[early * BINS], target, bound, store)), q(at(pairs[late], target, bound, store))),
  q(at(pairs[0], target, bound, store)))) }));

export function buildBasis(input, splitAfterInterval, reuse = null, retainOriginalBoundaries = false) {
  if (retainOriginalBoundaries && reuse) throw Error('Original-course bases use their own complete inquiry context');
  const source = input.source, freshGeometry = !reuse?.geometry;
  const geometry = reuse?.geometry ?? sampleProfileBasisGeometry(source, BINS), pairs = [];
  if (reuse && freshGeometry) reuse.geometry = geometry;
  const diagonal = reuse ? (reuse.diagonal ??= []) : [];
  let executedCourses = 0, reusedCompleteCourses = 0;
  if (splitAfterInterval >= geometry.sampled.intervals.length)
    throw Error('The declared split is not an original interval boundary');
  for (let early = 0; early < BINS; early++) for (let late = 0; late < BINS; late++) {
    // A diagonal course has the same profile on every original interval.
    // Its complete result is identical at every offered boundary in this inquiry.
    const prior = early === late ? diagonal[early] : null;
    const evaluated = prior ?? (retainOriginalBoundaries ? evaluateProfileOriginalBoundaryCourse : evaluateProfileThermalCourse)(source, geometry,
      (target, _row, index) => bounds.map(bound =>
        geometry.transmissions[target][bound][index < splitAfterInterval ? early : late].transmission),
      'Two-epoch one-bin sky pair ' + (early + 1) + '/' + (late + 1),
      'Complete two-epoch inquiry refused at pair ' + (early + 1) + '/' + (late + 1));
    const final = retainOriginalBoundaries ? evaluated.final : evaluated;
    if (prior) reusedCompleteCourses += 4; else executedCourses += 4;
    if (early === late) diagonal[early] = evaluated;
    pairs.push({ early, late, final, ...(retainOriginalBoundaries ? { trace: evaluated } : {}) });
  }
  const coefficients = coefficientsAt(pairs, (pair, target, bound, store) => pair.final[target][bound][store]);
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
    geometryExecutions: Number(freshGeometry), executedCourses, reusedCompleteCourses,
    splitUtc: new Date(Date.parse(source.declaration.path.startUtc)
      + geometry.sampled.intervals[splitAfterInterval].fromMinute * 60000).toISOString() };
}

// Each retained time is an original interval index, with its original clock and
// unchanged thermal accumulator clock. Complete all pairs before screening.
export function buildOriginalBoundaryBasis(input, splitAfterInterval) {
  const basis = buildBasis(input, splitAfterInterval, null, true);
  const originalBoundaries = basis.pairs[0].trace.originalBoundaries;
  for (const pair of basis.pairs) if (JSON.stringify(pair.trace.originalBoundaries) !== JSON.stringify(originalBoundaries))
    throw Error('Original pair courses lost a common interval boundary');
  const courseCoefficients = originalBoundaries.map((_, time) => coefficientsAt(basis.pairs,
    (pair, target, bound, store) => pair.trace.states[target][bound][time][store]));
  let maximumCourseDiscrepancyC = ZERO;
  const courseScreens = originalBoundaries.map((boundary, time) => {
    let maximumDiscrepancyC = ZERO, nonzeroDiscrepancies = 0;
    basis.pairs.forEach((pair, index) => mapFinal((target, bound, store) => {
      const delta = sub(courseCoefficients[time][index].final[target][bound][store],
        q(pair.trace.states[target][bound][time][store]));
      maximumDiscrepancyC = max(maximumDiscrepancyC, abs(delta));
      if (cmp(delta, ZERO)) nonzeroDiscrepancies++;
    }));
    maximumCourseDiscrepancyC = max(maximumCourseDiscrepancyC, maximumDiscrepancyC);
    return { index: boundary.index, maximumDiscrepancyC: profileFraction(maximumDiscrepancyC), nonzeroDiscrepancies };
  });
  return { ...basis, originalBoundaries, courseCoefficients, courseScreens, maximumCourseDiscrepancyC };
}

export function consequences(candidates, coefficients) {
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

export function staticComparison(bases, bands, additive, numeric = intersectTwoProfileBands, exact = intersectTwoRationalProfileBands) {
  const coefficients = bases.map(basis => (additive ? basis.coefficients : basis.pairs.map(pair => ({
    ...pair, final: mapFinal((target, bound, store) => q(pair.final[target][bound][store])),
  }))).filter(pair => pair.early === pair.late));
  const rows = coefficients.map(points => points.map(v => v.final.existing.lower.surfaceC));
  const family = additive ? exact(rows, bands)
    : numeric(bases.map(basis => basis.pairs.filter(pair => pair.early === pair.late)
      .map(pair => pair.final.existing.lower.surfaceC)), bands);
  const result = consequences(family.candidates, coefficients[0]);
  return { compatibility: family.status, ranges: result.ranges, witnesses: result.witnesses, work: family.work };
}

export function inspectWitness(item, bases, bands, splitAfterInterval, consistencyScreenC = 1e-9, retainOriginalBoundaries = false, observationLocations = null) {
  if (observationLocations !== null && (!retainOriginalBoundaries
      || !Array.isArray(observationLocations) || observationLocations.length !== bases.length
      || !Array.from(observationLocations).every((location, index) => location
        && Number.isInteger(location.originalIndex) && location.originalIndex >= 0
        && ['surfaceC', 'subsurfaceC'].includes(location.store)
        && bases[index].originalBoundaries[location.originalIndex]?.utc === location.utc
        && bases[index].input.query.reading.utc === location.utc
        && bases[index].input.query.reading.store === location.store)))
    throw Error('Each original observation must retain its exact admitted course time and component');
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
    const evaluated = (retainOriginalBoundaries ? evaluateProfileOriginalBoundaryCourse : evaluateProfileThermalCourse)(basis.input.source, basis.geometry,
      (target, _row, index) => bounds.map(bound => approximate[index < splitAfterInterval ? 0 : 1].weights.reduce(
        (sum, weight, bin) => sum + weight * basis.geometry.transmissions[target][bound][bin].transmission, 0)),
      'Normalized approximate replay of exact two-epoch witness ' + item.id,
      'Complete two-epoch witness replay refused at witness ' + item.id);
    const final = retainOriginalBoundaries ? evaluated.final : evaluated;
    const residualC = mapFinal((target, bound, store) => {
      const row = basis.coefficients.map(v => v.final[target][bound][store]);
      const expected = mixture(item.candidate, row);
      if (cmp(expected, mixture(product, row))) throw Error('Exact additive marginal equivalence was lost');
      exactMarginalEqualities++;
      const residual = sub(q(final[target][bound][store]), expected);
      maximumReplayResidualC = max(maximumReplayResidualC, abs(residual));
      return profileFraction(residual);
    });
    const originalCourse = retainOriginalBoundaries ? evaluated.originalBoundaries.map((boundary, time) => {
      if (JSON.stringify(boundary) !== JSON.stringify(basis.originalBoundaries[time]))
        throw Error('An original witness replay lost its exact interval identity');
      const exactC = mapFinal((target, bound, store) => {
        const row = basis.courseCoefficients[time].map(v => v.final[target][bound][store]);
        const expected = mixture(item.candidate, row);
        if (cmp(expected, mixture(product, row))) throw Error('Exact original-course marginal equivalence was lost');
        exactMarginalEqualities++;
        return expected;
      });
      const originalC = mapFinal((target, bound, store) => evaluated.states[target][bound][time][store]);
      const originalMinusAdditiveC = mapFinal((target, bound, store) => {
        const residual = sub(q(originalC[target][bound][store]), exactC[target][bound][store]);
        maximumReplayResidualC = max(maximumReplayResidualC, abs(residual));
        return profileFraction(residual);
      });
      return { ...boundary, originalC, additiveC: mapFinal((target, bound, store) => profileFraction(exactC[target][bound][store])),
        originalMinusAdditiveC };
    }) : null;
    const reading = bands[sourceIndex], lower = sub(q(reading.temperatureC), q(reading.halfWidthC)),
      upper = add(q(reading.temperatureC), q(reading.halfWidthC));
    const location = observationLocations?.[sourceIndex];
    const originalObservation = location ? { ...location,
      originalC: Object.fromEntries(bounds.map(bound => [bound,
        evaluated.states.existing[bound][location.originalIndex][location.store]])) } : null;
    return { cellIndex: basis.input.query.reading.cellIndex, originalFinalC: final,
      ...(originalObservation ? { originalObservation } : {}),
      ...(retainOriginalBoundaries ? { originalCourse } : {}),
      originalMinusAdditiveC: residualC,
      originalObservationEndpointStatus: Object.fromEntries(bounds.map(bound => {
        const value = q(originalObservation ? originalObservation.originalC[bound] : final.existing[bound].surfaceC);
        return [bound, cmp(value, lower) >= 0 && cmp(value, upper) <= 0 ? 'within-original-band' : 'outside-original-band'];
      })) };
  });
  if (cmp(maximumReplayResidualC, q(consistencyScreenC)) > 0)
    throw Error('An original witness replay exceeds the declared numerical consistency screen; no partial inquiry is accepted');
  return { phaseProfiles: phases.map(phase => phase.map(profileFraction)), approximateProfiles: approximate,
    originalReplays, maximumReplayResidualC: profileFraction(maximumReplayResidualC), exactMarginalEqualities };
}

export function completeEpochReport(investigation, bases, work, { model, limits,
  numeric = intersectTwoProfileBands, exact = intersectTwoRationalProfileBands, reused = false, semantics, precomputedFamily = null }) {
  const split = investigation.query.splitAfterInterval;
  for (let i = 0; i < bases.length; i++) {
    if (!bases[i].pairs.every(pair => pair.final.existing.lower.surfaceC === pair.final.existing.upper.surfaceC))
      throw Error('Original reading ' + (i + 1) + ' has unresolved existing observation endpoints; no favorable endpoint is selected');
    if (cmp(bases[i].maximumDiscrepancyC, q(limits.numericalConsistencyScreenC)) > 0)
      throw Error('Original pair courses exceed the declared additive consistency screen; no partial inquiry is accepted');
  }
  if (bases.some(basis => basis.splitUtc !== bases[0].splitUtc)) throw Error('Original interval boundaries do not coincide');
  const bands = investigation.readings.map(input => ({ temperatureC: input.query.reading.temperatureC,
    halfWidthC: input.query.reading.halfWidthC }));
  const family = precomputedFamily ?? exact(bases.map(basis =>
    basis.coefficients.map(v => v.final.existing.lower.surfaceC)), bands);
  if (family.candidates.length > limits.maxCandidates) throw Error('Complete two-epoch candidate allowance exhausted');
  const consequence = consequences(family.candidates, bases[0].coefficients);
  const witnesses = consequence.witnesses.map((witness, i) => ({ ...witness,
    ...inspectWitness(consequence.selected[i], bases, bands, split, limits.numericalConsistencyScreenC) }));
  const originalStatic = staticComparison(bases, bands, false, numeric, exact), additiveStatic = staticComparison(bases, bands, true, numeric, exact);
  return { status: 'compared', compatibility: family.status, model: { ...model },
    query: { ...investigation.query }, cellIndex: investigation.readings[0].query.reading.cellIndex,
    finalUtc: investigation.readings[0].query.reading.utc, splitUtc: bases[0].splitUtc,
    intervalCount: bases[0].geometry.sampled.intervals.length,
    readings: investigation.readings.map((input, i) => ({ ...input.query.reading, originalBins: input.query.bins,
      activeCommonBins: BINS, bandC: Object.fromEntries(bounds.map(bound => [bound, profileFraction(family.bands[i][bound])])) })),
    originalStatic, additiveStatic, staticCompatibilityAgrees: originalStatic.compatibility === additiveStatic.compatibility,
    ranges: consequence.ranges, witnesses,
    numericalEvidence: { consistencyScreenC: limits.numericalConsistencyScreenC,
      scope: 'A bounded numerical consistency screen of completed basis courses and displayed witnesses; not a certified error bound for every profile or physical measurement.',
      points: bases.map(basis => ({ cellIndex: basis.input.query.reading.cellIndex,
        maximumAdditivePairDiscrepancyC: profileFraction(basis.maximumDiscrepancyC),
        nonzeroDiscrepancies: basis.nonzeroDiscrepancies, pairs: basis.discrepancies })) },
    diagnostics: bases.map(basis => reused ? structuredClone(basis.geometry.diagnostics) : basis.geometry.diagnostics),
    work: { ...work, ...(reused ? {
      geometryPasses: bases.reduce((sum, basis) => sum + basis.geometryExecutions, 0),
      completeBasisCourses: bases.length * BINS * BINS * 4,
      reusedCompleteBasisCourses: bases.reduce((sum, basis) => sum + basis.reusedCompleteCourses, 0),
    } : {}), executedBasisCourses: bases.reduce((sum, basis) => sum + basis.executedCourses, 0),
      executedWitnessCourses: witnesses.length * bases.length * 4,
      executedThermalCourses: bases.reduce((sum, basis) => sum + basis.executedCourses, 0) + witnesses.length * bases.length * 4,
      actualSkyFaceTests: bases.reduce((sum, basis) => sum + basis.geometryExecutions * basis.geometry.sampled.diffuseSky.estimatedFaceTests, 0),
      profileIntersection: family.work,
      exactWitnessMarginalEqualities: witnesses.reduce((sum, witness) => sum + witness.exactMarginalEqualities, 0) },
    semantics };
}


const exactFraction = value => [BigInt(value.exact.numerator), BigInt(value.exact.denominator)];
export function boundaryRanges(reports) {
  const compatible = reports.map((report, boundaryIndex) => ({ report, boundaryIndex }))
    .filter(({ report }) => report.compatibility === 'compatible');
  if (!compatible.length) return null;
  return Object.fromEntries(stores.map(store => [store, Object.fromEntries(bounds.map((bound, side) => {
    let best = compatible[0];
    for (const item of compatible) {
      const order = cmp(exactFraction(item.report.ranges[store][bound].differenceC),
        exactFraction(best.report.ranges[store][bound].differenceC));
      if (side === 0 ? order < 0 : order > 0) best = item;
    }
    const chosen = best.report.ranges[store][bound];
    return [bound, { differenceC: structuredClone(chosen.differenceC), boundaryIndex: best.boundaryIndex,
      splitAfterInterval: best.report.query.splitAfterInterval, splitUtc: best.report.splitUtc, witnessId: chosen.witnessId }];
  }))]));
}
