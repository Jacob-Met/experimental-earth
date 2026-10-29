import { rational as q, add, sub, mul, div, cmp, serial, clip } from './vendor/chronos/exact-halfplanes.mjs';
import { THREE_PROFILE_BAND_MAX_CANDIDATES } from './shade-heat-profile-three-bands.js';

const ZERO = q(0), ONE = q(1);
export const JOINT_PROJECTION_LIMITS = Object.freeze({
  candidates: THREE_PROFILE_BAND_MAX_CANDIDATES, bins: 16, support: 4,
  hullVertices: 242, clippedVertices: 244, clipEdgeTests: 488,
  mixtureTerms: THREE_PROFILE_BAND_MAX_CANDIDATES * 8,
  sortComparisons: THREE_PROFILE_BAND_MAX_CANDIDATES * 30,
  hullOrientationTests: THREE_PROFILE_BAND_MAX_CANDIDATES * 4,
  witnessTriangleTests: 240,
});
const fraction = value => Array.isArray(value) && value.length === 2
  && Array.from(value).every(part => typeof part === 'bigint') && value[1] > 0n
  && (value[0] < 0n ? -value[0] : value[0]).toString(2).length <= 4096
  && value[1].toString(2).length <= 4096;
const same = (a, b) => cmp(a[0], b[0]) === 0 && cmp(a[1], b[1]) === 0;
const cross = (a, b, c) => sub(mul(sub(b[0], a[0]), sub(c[1], a[1])),
  mul(sub(b[1], a[1]), sub(c[0], a[0])));
const order = (a, b) => cmp(a[0], b[0]) || cmp(a[1], b[1]);

// Internal exact projection of the complete maintained three-band vertices.
// The caller owns observation feasibility and resolved original-course endpoints.
export function projectJointProfileFamily(candidates, objectives, ceilings) {
  if (!Array.isArray(candidates) || candidates.length > JOINT_PROJECTION_LIMITS.candidates
      || !Array.from(candidates).every(candidate => candidate && Array.isArray(candidate.support)
        && candidate.support.length >= 1 && candidate.support.length <= 4
        && Array.from(candidate.support).every((bin, i) => Number.isInteger(bin) && bin >= 0 && bin < 16
          && (i === 0 || bin > candidate.support[i - 1]))
        && Array.isArray(candidate.weights) && candidate.weights.length === candidate.support.length
        && Array.from(candidate.weights).every(weight => fraction(weight) && cmp(weight, ZERO) > 0)
        && cmp(candidate.weights.reduce(add, ZERO), ONE) === 0)
      || !Array.isArray(objectives) || objectives.length !== 2
      || !Array.from(objectives).every(row => Array.isArray(row) && row.length === 16
        && Array.from(row).every(fraction))
      || !Array.isArray(ceilings) || ceilings.length !== 2 || !Array.from(ceilings).every(fraction))
    throw Error('Provide a complete bounded profile family, two exact objectives and two exact ceilings');
  const work = { candidates: candidates.length, mixtureTerms: 0, sortComparisons: 0,
    hullOrientationTests: 0, clipEdgeTests: 0, witnessTriangleTests: 0 };
  const evaluate = (candidate, row) => candidate.support.reduce((sum, bin, i) => {
    if (++work.mixtureTerms > JOINT_PROJECTION_LIMITS.mixtureTerms)
      throw Error('Complete joint projection exceeds its mixture allowance');
    return add(sum, mul(candidate.weights[i], row[bin]));
  }, ZERO);
  const points = candidates.map((candidate, candidateId) => ({ candidateId,
    values: objectives.map(row => evaluate(candidate, row)) }));
  points.sort((a, b) => {
    if (++work.sortComparisons > JOINT_PROJECTION_LIMITS.sortComparisons)
      throw Error('Complete joint projection exceeds its sorting allowance');
    return order(a.values, b.values) || a.candidateId - b.candidateId;
  });
  const unique = points.filter((point, i) => i === 0 || !same(point.values, points[i - 1].values));
  function half(sequence) {
    const out = [];
    for (const point of sequence) {
      while (out.length >= 2) {
        if (++work.hullOrientationTests > JOINT_PROJECTION_LIMITS.hullOrientationTests)
          throw Error('Complete joint projection exceeds its orientation allowance');
        if (cmp(cross(out.at(-2).values, out.at(-1).values, point.values), ZERO) > 0) break;
        out.pop();
      }
      out.push(point);
    }
    return out;
  }
  let hull;
  if (unique.length <= 2) hull = unique;
  else {
    const lower = half(unique), upper = half([...unique].reverse());
    hull = [...lower.slice(0, -1), ...upper.slice(0, -1)];
  }
  // The shared bounded half-plane primitive admits at most 244 vertices.
  // Each of the two clips can add at most one convex-polygon vertex.
  if (hull.length > JOINT_PROJECTION_LIMITS.hullVertices)
    throw Error('The complete joint consequence hull exceeds the shared polygon allowance; no partial hull is accepted');
  const dimension = hull.length === 0 ? -1 : hull.length === 1 ? 0 : hull.length === 2 ? 1 : 2;
  const ranges = points.length ? objectives.map((_, axis) => {
    let lower = points[0], upper = points[0];
    for (const point of points) {
      if (cmp(point.values[axis], lower.values[axis]) < 0) lower = point;
      if (cmp(point.values[axis], upper.values[axis]) > 0) upper = point;
    }
    return { lower: lower.values[axis], upper: upper.values[axis],
      lowerCandidateId: lower.candidateId, upperCandidateId: upper.candidateId,
      individuallyPossible: cmp(lower.values[axis], ceilings[axis]) <= 0 };
  }) : null;
  const clipWork = { count: 0, limit: JOINT_PROJECTION_LIMITS.clipEdgeTests };
  let feasible = hull.map(point => point.values);
  feasible = clip(feasible, ONE, ZERO, ceilings[0], clipWork, JOINT_PROJECTION_LIMITS.clippedVertices);
  feasible = clip(feasible, ZERO, ONE, ceilings[1], clipWork, JOINT_PROJECTION_LIMITS.clippedVertices);
  work.clipEdgeTests = clipWork.count;
  if (!feasible.length) return { status: candidates.length ? 'jointly-incompatible' : 'empty-family',
    dimension, ranges, hull, feasible, witness: null, work };
  let chosen = feasible[0];
  for (const point of feasible) if (order(point, chosen) < 0) chosen = point;
  let combination = null;
  const exactVertex = hull.find(point => same(point.values, chosen));
  if (exactVertex) combination = [{ candidateId: exactVertex.candidateId, weight: ONE }];
  else if (hull.length === 2) {
    const axis = cmp(hull[0].values[0], hull[1].values[0]) ? 0 : 1;
    const weight = div(sub(chosen[axis], hull[0].values[axis]), sub(hull[1].values[axis], hull[0].values[axis]));
    combination = [{ candidateId: hull[0].candidateId, weight: sub(ONE, weight) },
      { candidateId: hull[1].candidateId, weight }];
  } else {
    const a = hull[0];
    for (let i = 1; i + 1 < hull.length; i++) {
      if (++work.witnessTriangleTests > JOINT_PROJECTION_LIMITS.witnessTriangleTests)
        throw Error('Complete joint witness exceeds its reconstruction allowance');
      const b = hull[i], c = hull[i + 1], denominator = cross(a.values, b.values, c.values);
      if (cmp(denominator, ZERO) <= 0) throw Error('The complete joint hull lost strict convex orientation');
      const wb = div(cross(a.values, chosen, c.values), denominator);
      const wc = div(cross(a.values, b.values, chosen), denominator), wa = sub(sub(ONE, wb), wc);
      if ([wa, wb, wc].every(weight => cmp(weight, ZERO) >= 0)) {
        combination = [a, b, c].map((point, j) => ({ candidateId: point.candidateId, weight: [wa, wb, wc][j] }));
        break;
      }
    }
  }
  if (!combination || combination.some(row => cmp(row.weight, ZERO) < 0)
      || cmp(combination.reduce((sum, row) => add(sum, row.weight), ZERO), ONE))
    throw Error('No complete exact profile reconstruction was established');
  combination = combination.filter(row => cmp(row.weight, ZERO) > 0);
  const masses = Array.from({ length: 16 }, () => ZERO);
  for (const { candidateId, weight } of combination) candidates[candidateId].support.forEach((bin, i) => {
    masses[bin] = add(masses[bin], mul(weight, candidates[candidateId].weights[i]));
  });
  const support = masses.flatMap((mass, bin) => cmp(mass, ZERO) > 0 ? [bin] : []);
  const weights = support.map(bin => masses[bin]);
  const values = objectives.map(row => support.reduce((sum, bin, i) => add(sum, mul(weights[i], row[bin])), ZERO));
  if (cmp(weights.reduce(add, ZERO), ONE) || !same(values, chosen)
      || values.some((value, i) => cmp(value, ceilings[i]) > 0))
    throw Error('The reconstructed common profile does not establish both exact ceilings');
  return { status: 'jointly-compatible', dimension, ranges, hull, feasible,
    witness: { support, weights, values, combination }, work };
}

export const serializeJointProjection = value => JSON.parse(JSON.stringify(value,
  (_key, item) => Array.isArray(item) && item.length === 2 && item.every(v => typeof v === 'bigint')
    ? serial(item) : item));
