import { rational as q, add, sub, mul, div, cmp, enclosure, serial } from './vendor/chronos/exact-halfplanes.mjs';

const ZERO = q(0), ONE = q(1);
const exactKeys = (v, keys) => v !== null && typeof v === 'object' && !Array.isArray(v)
  && Object.keys(v).length === keys.length && keys.every(key => Object.hasOwn(v, key));

/** Vertices of a simplex intersected with one closed observation slab.
 * Fractions concern the supplied binary64 coefficients, not the thermal solver.
 * Internal candidates retain exact weights; saved inputs never contain these.
 */
export function intersectProfileBand(observed, reading) {
  if (!Array.isArray(observed) || observed.length < 2 || observed.length > 16
      || Array.from(observed).some(value => !Number.isFinite(value)))
    throw Error('Provide 2 to 16 finite original observation coefficients');
  if (!exactKeys(reading, ['temperatureC', 'halfWidthC'])
      || !Number.isFinite(reading.temperatureC) || !Number.isFinite(reading.halfWidthC)
      || reading.halfWidthC < 0)
    throw Error('Provide a finite temperature and nonnegative original half-width');
  const values = observed.map(q), center = q(reading.temperatureC), width = q(reading.halfWidthC);
  const lower = sub(center, width), upper = add(center, width);
  const edges = cmp(lower, upper) === 0 ? [lower] : [lower, upper];
  const candidates = [];
  for (let i = 0; i < values.length; i++) {
    if (cmp(values[i], lower) >= 0 && cmp(values[i], upper) <= 0)
      candidates.push({ support: [i], weights: [ONE], observed: values[i] });
  }
  const admittedOriginalVertices = candidates.length;
  let examinedPairs = 0;
  for (let i = 0; i < values.length; i++) for (let j = i + 1; j < values.length; j++) {
    examinedPairs++;
    if (cmp(values[i], values[j]) === 0) continue;
    for (const edge of edges) {
      const a = cmp(values[i], edge), b = cmp(values[j], edge);
      // Endpoints are already represented by the original one-bin vertices.
      if (!((a < 0 && b > 0) || (a > 0 && b < 0))) continue;
      const wi = div(sub(edge, values[j]), sub(values[i], values[j])), wj = sub(ONE, wi);
      if (cmp(wi, ZERO) <= 0 || cmp(wi, ONE) >= 0 || cmp(wj, ZERO) <= 0)
        throw Error('An exact profile intersection lost its interior support');
      candidates.push({ support: [i, j], weights: [wi, wj], observed: edge });
    }
  }
  if (candidates.length > values.length ** 2)
    throw Error('Complete profile-intersection capacity exhausted; no partial range');
  return { status: candidates.length ? 'compatible' : 'incompatible', bins: values.length,
    candidates, band: { lower, upper },
    originalObservationRange: {
      lower: values.reduce((a, b) => cmp(a, b) <= 0 ? a : b),
      upper: values.reduce((a, b) => cmp(a, b) >= 0 ? a : b),
    },
    work: { examinedPairs, admittedOriginalVertices,
      mixedVertices: candidates.length - admittedOriginalVertices, candidates: candidates.length,
      maximumCandidates: values.length ** 2 } };
}

export function evaluateProfileMixture(candidate, coefficients) {
  return candidate.support.reduce((sum, bin, index) =>
    add(sum, mul(candidate.weights[index], q(coefficients[bin]))), ZERO);
}

export function profileFraction(value) {
  return { exact: serial(value), ...enclosure(value) };
}

export function describeProfileCandidate(candidate, bins) {
  return { support: [...candidate.support],
    weights: Array.from({ length: bins }, (_, bin) => {
      const index = candidate.support.indexOf(bin);
      return profileFraction(index < 0 ? ZERO : candidate.weights[index]);
    }), observedC: profileFraction(candidate.observed) };
}
