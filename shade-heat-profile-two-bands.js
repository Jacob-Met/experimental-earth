import { rational as q, add, sub, mul, div, cmp, serial } from './vendor/chronos/exact-halfplanes.mjs';

const ZERO = q(0), ONE = q(1);
const exactKeys = (v, keys) => v !== null && typeof v === 'object' && !Array.isArray(v)
  && Object.keys(v).length === keys.length && keys.every(key => Object.hasOwn(v, key));
const choose2 = n => n * (n - 1) / 2;
const choose3 = n => n * (n - 1) * (n - 2) / 6;

// Exactness concerns the supplied represented coefficients, not physical accuracy.
// Two independent slabs can introduce vertices supported by three original bins.
export function intersectTwoProfileBands(observed, readings) {
  if (!Array.isArray(observed) || observed.length !== 2
      || !Array.from(observed).every(row => Array.isArray(row) && row.length >= 2 && row.length <= 16
        && Array.from(row).every(Number.isFinite)) || observed[0].length !== observed[1].length)
    throw Error('Provide two complete finite observation rows with 2 to 16 common bins');
  return intersectRows(observed.map(row => row.map(q)), readings);
}

export function intersectTwoRationalProfileBands(observed, readings) {
  const boundedFraction = value => Array.isArray(value) && value.length === 2
    && Array.from(value).every(part => typeof part === 'bigint') && value[1] > 0n
    && (value[0] < 0n ? -value[0] : value[0]).toString(2).length <= 4096
    && value[1].toString(2).length <= 4096;
  if (!Array.isArray(observed) || observed.length !== 2
      || !Array.from(observed).every(row => Array.isArray(row) && row.length >= 2 && row.length <= 16
        && Array.from(row).every(boundedFraction)) || observed[0].length !== observed[1].length)
    throw Error('Provide two complete rows of 2 to 16 bounded exact rational coefficients');
  return intersectRows(observed.map(row => row.map(value => add(value, ZERO))), readings);
}

function intersectRows(rows, readings) {
  if (!Array.isArray(readings) || readings.length !== 2 || !Array.from(readings).every(reading =>
    exactKeys(reading, ['temperatureC', 'halfWidthC']) && Number.isFinite(reading.temperatureC)
      && Number.isFinite(reading.halfWidthC) && reading.halfWidthC >= 0))
    throw Error('Provide two finite original bands with nonnegative half-widths');
  const bins = rows[0].length;
  const bands = readings.map(reading => ({ lower: sub(q(reading.temperatureC), q(reading.halfWidthC)),
    upper: add(q(reading.temperatureC), q(reading.halfWidthC)) }));
  const planes = bands.map(band => cmp(band.lower, band.upper) === 0 ? [band.lower] : [band.lower, band.upper]);
  const maximumCandidates = bins + (planes[0].length + planes[1].length) * choose2(bins)
    + planes[0].length * planes[1].length * choose3(bins);
  const candidates = [], seen = new Set();
  const work = { examinedPairs: 0, examinedTriangles: 0, parallelTriangles: 0,
    testedPairPlanes: 0, testedPlanePairs: 0, maximumCandidates };
  const evaluate = (support, weights, row) => support.reduce((sum, bin, i) => add(sum, mul(weights[i], row[bin])), ZERO);
  function admit(support, weights) {
    if (weights.some(weight => cmp(weight, ZERO) <= 0 || cmp(weight, ONE) > 0)) return;
    if (cmp(weights.reduce(add, ZERO), ONE) !== 0) throw Error('Exact simplex mass was lost');
    const values = rows.map(row => evaluate(support, weights, row));
    if (values.some((value, i) => cmp(value, bands[i].lower) < 0 || cmp(value, bands[i].upper) > 0)) return;
    const key = JSON.stringify([support, weights.map(serial)]);
    if (seen.has(key)) return;
    seen.add(key); candidates.push({ support, weights, observed: values });
    if (candidates.length > maximumCandidates) throw Error('Complete candidate capacity exhausted');
  }
  for (let i = 0; i < bins; i++) admit([i], [ONE]);
  const admittedOriginalVertices = candidates.length;
  for (let i = 0; i < bins; i++) for (let j = i + 1; j < bins; j++) {
    work.examinedPairs++;
    for (let r = 0; r < 2; r++) {
      if (cmp(rows[r][i], rows[r][j]) === 0) continue;
      for (const plane of planes[r]) {
        work.testedPairPlanes++;
        const a = cmp(rows[r][i], plane), b = cmp(rows[r][j], plane);
        if (!((a < 0 && b > 0) || (a > 0 && b < 0))) continue;
        const wi = div(sub(plane, rows[r][j]), sub(rows[r][i], rows[r][j]));
        admit([i, j], [wi, sub(ONE, wi)]);
      }
    }
  }
  const admittedPairVertices = candidates.length - admittedOriginalVertices;
  for (let i = 0; i < bins; i++) for (let j = i + 1; j < bins; j++) for (let k = j + 1; k < bins; k++) {
    work.examinedTriangles++;
    const a = sub(rows[0][j], rows[0][i]), b = sub(rows[0][k], rows[0][i]);
    const c = sub(rows[1][j], rows[1][i]), d = sub(rows[1][k], rows[1][i]);
    const determinant = sub(mul(a, d), mul(b, c));
    if (cmp(determinant, ZERO) === 0) { work.parallelTriangles++; continue; }
    for (const first of planes[0]) for (const second of planes[1]) {
      work.testedPlanePairs++;
      const x = sub(first, rows[0][i]), y = sub(second, rows[1][i]);
      const wj = div(sub(mul(x, d), mul(b, y)), determinant);
      const wk = div(sub(mul(a, y), mul(x, c)), determinant);
      admit([i, j, k], [sub(sub(ONE, wj), wk), wj, wk]);
    }
  }
  return { status: candidates.length ? 'compatible' : 'incompatible', bins, bands, candidates,
    work: { ...work, admittedOriginalVertices, admittedPairVertices,
      admittedTriangleVertices: candidates.length - admittedOriginalVertices - admittedPairVertices,
      candidates: candidates.length } };
}
