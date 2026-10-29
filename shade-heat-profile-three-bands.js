import { rational as q, add, sub, mul, div, cmp, serial } from './vendor/chronos/exact-halfplanes.mjs';

const ZERO = q(0), ONE = q(1);
const exactKeys = (v, keys) => v !== null && typeof v === 'object' && !Array.isArray(v)
  && Object.keys(v).length === keys.length && keys.every(key => Object.hasOwn(v, key));
const choose2 = n => n * (n - 1) / 2;
const choose3 = n => n * (n - 1) * (n - 2) / 6;
const choose4 = n => n * (n - 1) * (n - 2) * (n - 3) / 24;
export const THREE_PROFILE_BAND_MAX_CANDIDATES = 22016;

// Exactness concerns the supplied represented coefficients, not physical accuracy.
// A simplex vertex cut by three independent slabs can require four original bins.
export function intersectThreeProfileBands(observed, readings) {
  if (!Array.isArray(observed) || observed.length !== 3
      || !Array.from(observed).every(row => Array.isArray(row) && row.length >= 2 && row.length <= 16
        && Array.from(row).every(Number.isFinite))
      || !observed.every(row => row.length === observed[0].length))
    throw Error('Provide three complete finite observation rows with 2 to 16 common bins');
  return intersectRows(observed.map(row => row.map(q)), readings);
}

export function intersectThreeRationalProfileBands(observed, readings) {
  const boundedFraction = value => Array.isArray(value) && value.length === 2
    && Array.from(value).every(part => typeof part === 'bigint') && value[1] > 0n
    && (value[0] < 0n ? -value[0] : value[0]).toString(2).length <= 4096
    && value[1].toString(2).length <= 4096;
  if (!Array.isArray(observed) || observed.length !== 3
      || !Array.from(observed).every(row => Array.isArray(row) && row.length >= 2 && row.length <= 16
        && Array.from(row).every(boundedFraction))
      || !observed.every(row => row.length === observed[0].length))
    throw Error('Provide three complete rows of 2 to 16 bounded exact rational coefficients');
  return intersectRows(observed.map(row => row.map(value => add(value, ZERO))), readings);
}

function determinant3(a, b, c, d, e, f, g, h, i) {
  return add(sub(mul(a, sub(mul(e, i), mul(f, h))),
    mul(b, sub(mul(d, i), mul(f, g)))), mul(c, sub(mul(d, h), mul(e, g))));
}

function intersectRows(rows, readings) {
  if (!Array.isArray(readings) || readings.length !== 3 || !Array.from(readings).every(reading =>
    exactKeys(reading, ['temperatureC', 'halfWidthC']) && Number.isFinite(reading.temperatureC)
      && Number.isFinite(reading.halfWidthC) && reading.halfWidthC >= 0))
    throw Error('Provide three finite original bands with nonnegative half-widths');
  const bins = rows[0].length;
  const bands = readings.map(reading => ({ lower: sub(q(reading.temperatureC), q(reading.halfWidthC)),
    upper: add(q(reading.temperatureC), q(reading.halfWidthC)) }));
  const planes = bands.map(band => cmp(band.lower, band.upper) === 0 ? [band.lower] : [band.lower, band.upper]);
  const maximumCandidates = bins + planes.reduce((sum, row) => sum + row.length, 0) * choose2(bins)
    + (planes[0].length * planes[1].length + planes[0].length * planes[2].length
      + planes[1].length * planes[2].length) * choose3(bins)
    + planes[0].length * planes[1].length * planes[2].length * choose4(bins);
  if (maximumCandidates > THREE_PROFILE_BAND_MAX_CANDIDATES) throw Error('Complete three-band capacity exceeded');
  const candidates = [], seen = new Set();
  const work = { examinedPairs: 0, examinedTriangles: 0, examinedTetrahedra: 0,
    singularTriangleRows: 0, singularTetrahedra: 0,
    testedPairPlanes: 0, testedPlanePairs: 0, testedPlaneTriples: 0, maximumCandidates };
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
    for (let r = 0; r < 3; r++) {
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
    for (let r = 0; r < 3; r++) for (let s = r + 1; s < 3; s++) {
      const a = sub(rows[r][j], rows[r][i]), b = sub(rows[r][k], rows[r][i]);
      const c = sub(rows[s][j], rows[s][i]), d = sub(rows[s][k], rows[s][i]);
      const determinant = sub(mul(a, d), mul(b, c));
      if (cmp(determinant, ZERO) === 0) { work.singularTriangleRows++; continue; }
      for (const first of planes[r]) for (const second of planes[s]) {
        work.testedPlanePairs++;
        const x = sub(first, rows[r][i]), y = sub(second, rows[s][i]);
        const wj = div(sub(mul(x, d), mul(b, y)), determinant);
        const wk = div(sub(mul(a, y), mul(x, c)), determinant);
        admit([i, j, k], [sub(sub(ONE, wj), wk), wj, wk]);
      }
    }
  }
  const admittedTriangleVertices = candidates.length - admittedOriginalVertices - admittedPairVertices;
  for (let i = 0; i < bins; i++) for (let j = i + 1; j < bins; j++) for (let k = j + 1; k < bins; k++)
    for (let l = k + 1; l < bins; l++) {
      work.examinedTetrahedra++;
      const [a, b, c] = [j, k, l].map(bin => sub(rows[0][bin], rows[0][i]));
      const [d, e, f] = [j, k, l].map(bin => sub(rows[1][bin], rows[1][i]));
      const [g, h, m] = [j, k, l].map(bin => sub(rows[2][bin], rows[2][i]));
      const determinant = determinant3(a, b, c, d, e, f, g, h, m);
      if (cmp(determinant, ZERO) === 0) { work.singularTetrahedra++; continue; }
      for (const first of planes[0]) for (const second of planes[1]) for (const third of planes[2]) {
        work.testedPlaneTriples++;
        const x = sub(first, rows[0][i]), y = sub(second, rows[1][i]), z = sub(third, rows[2][i]);
        const wj = div(determinant3(x, b, c, y, e, f, z, h, m), determinant);
        const wk = div(determinant3(a, x, c, d, y, f, g, z, m), determinant);
        const wl = div(determinant3(a, b, x, d, e, y, g, h, z), determinant);
        admit([i, j, k, l], [sub(sub(sub(ONE, wj), wk), wl), wj, wk, wl]);
      }
    }
  return { status: candidates.length ? 'compatible' : 'incompatible', bins, bands, candidates,
    work: { ...work, admittedOriginalVertices, admittedPairVertices, admittedTriangleVertices,
      admittedTetrahedronVertices: candidates.length - admittedOriginalVertices - admittedPairVertices - admittedTriangleVertices,
      candidates: candidates.length } };
}
