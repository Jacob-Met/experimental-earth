import { prepareSolarReceiverGeometryAt } from './solar-occlusion.js';

export const CONTINUOUS_SKY_MODEL = Object.freeze({
  kind: 'experimental-earth/continuous-column-sky/1',
  radiance: 'isotropic',
  receiver: 'original ground centre, horizontal',
  geometry: 'maintained opaque ground columns without grazing padding',
});
const TAU = 2 * Math.PI;
const MAX_COLUMNS = 575;
const MAX_FACE_TESTS = 16000000;
export const CONTINUOUS_SKY_SEMANTICS = 'Continuous isotropic projected-sky integration for declared opaque ground columns. Height endpoints vary declared roof elevations. Binary64 evaluation is not a certified numerical enclosure; no off-map geometry, anisotropic brightness, reflection, foliage transmission or physical calibration is inferred. This unpadded geometry result is distinct from sampled epsilon-grazing classifications.';

export function normalizeContinuousSky(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      Object.keys(input).length !== 1 || !Object.hasOwn(input, 'method') ||
      input.method !== 'continuous-columns')
    throw Error('Declare only the continuous-columns sky method');
  return { method: 'continuous-columns' };
}

function unit(x, y) {
  const n = Math.hypot(x, y);
  if (!(n > 0) || !Number.isFinite(n)) throw Error('Unresolved sky direction');
  return [x / n, y / n];
}
function angleOf(v) {
  const a = Math.atan2(v[1], v[0]);
  return a < 0 ? a + TAU : a;
}
const cross = (a, b) => a[0] * b[1] - a[1] * b[0];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const midpoint = (a, b) => unit(a[0] + b[0], a[1] + b[1]);

function admitColumns(point, columns, topKey) {
  if (!Array.isArray(point) || point.length !== 3 || !Array.from(point).every(Number.isFinite) ||
      !Array.isArray(columns) || columns.length > MAX_COLUMNS ||
      !['minTop', 'maxTop'].includes(topKey)) throw Error('Unsupported continuous sky geometry');
  return Array.from(columns).flatMap(column => {
    if (!column || !Array.isArray(column.lo) || !Array.isArray(column.hi) ||
        column.lo.length !== 3 || column.hi.length !== 3 ||
        !Array.from(column.lo).every(Number.isFinite) || !Array.from(column.hi).every(Number.isFinite) ||
        !Number.isFinite(column[topKey]) || column.lo[0] >= column.hi[0] ||
        column.lo[1] >= column.hi[1] || column.lo[2] >= point[2])
      throw Error('Continuous sky requires ground-filled columns below the receiver');
    const height = column[topKey] - point[2];
    if (!(height > 0)) return [];
    const lo = [column.lo[0] - point[0], column.lo[1] - point[1]];
    const hi = [column.hi[0] - point[0], column.hi[1] - point[1]];
    if (lo[0] <= 0 && hi[0] >= 0 && lo[1] <= 0 && hi[1] >= 0)
      throw Error('Choose a receiver outside every declared column footprint');
    return [{ lo, hi, height, cellIndex: column.cellIndex,
      source: column.source, kind: column.kind }];
  });
}

function angularCuts(columns) {
  const cuts = new Map([
    [0, [1, 0]], [Math.PI / 2, [0, 1]],
    [Math.PI, [-1, 0]], [3 * Math.PI / 2, [0, -1]], [TAU, [1, 0]],
  ]);
  for (const c of columns) for (const x of [c.lo[0], c.hi[0]]) for (const y of [c.lo[1], c.hi[1]]) {
    const v = unit(x, y), a = angleOf(v);
    if (!cuts.has(a)) cuts.set(a, v);
  }
  return [...cuts].sort((a, b) => a[0] - b[0]).map(([angle, v]) => ({ angle, v }));
}

// Each corner/cardinal sector has a fixed first entering face for each column.
function enteringFace(column, direction) {
  let enter = 0, exit = Infinity, axis = -1, face = 0;
  for (let k = 0; k < 2; k++) {
    if (direction[k] === 0) {
      if (column.lo[k] > 0 || column.hi[k] < 0) return null;
      continue;
    }
    const near = direction[k] > 0 ? column.lo[k] : column.hi[k];
    const far = direction[k] > 0 ? column.hi[k] : column.lo[k];
    const a = near / direction[k], b = far / direction[k];
    if (a > enter) { enter = a; axis = k; face = near; }
    exit = Math.min(exit, b);
    if (exit <= enter) return null;
  }
  if (!(enter > 0) || axis < 0) throw Error('Unresolved continuous sky entering face');
  const coefficient = column.height / Math.abs(face);
  if (!Number.isFinite(coefficient)) throw Error('Continuous sky coefficient exceeds numerical support');
  return { axis, coefficient, cellIndex: column.cellIndex, source: column.source, kind: column.kind };
}

function projectedIntegral(a, b, controller) {
  const determinant = cross(a, b);
  // Every arc is confined to one quadrant. Nonpositive width is a numerical
  // duplicate cut, not an independently classified open sector.
  if (!(determinant > 0)) return 0;
  if (!controller) return Math.atan2(determinant, dot(a, b));
  const g = Math.hypot(1, controller.coefficient);
  const denominator = controller.axis === 0
    ? g * g * a[0] * b[0] + a[1] * b[1]
    : a[0] * b[0] + g * g * a[1] * b[1];
  return Math.atan2(g * determinant, denominator) / g;
}

/** Bounded review kernel; normal consumers use compareContinuousSkyAt. */
export function integrateContinuousColumns(point, columns, topKey = 'maxTop') {
  const active = admitColumns(point, columns, topKey);
  const cuts = angularCuts(active);
  const estimatedFaceTests = (cuts.length - 1) * active.length;
  if (estimatedFaceTests > MAX_FACE_TESTS) throw Error('Continuous sky exceeds the geometry work budget');
  const arcs = [];
  let total = 0, correction = 0, collapsedSectors = 0, omittedAngularWidthRad = 0;
  for (let i = 0; i < cuts.length - 1; i++) {
    const left = cuts[i], right = cuts[i + 1];
    if (!(cross(left.v, right.v) > 0)) {
      collapsedSectors++; omittedAngularWidthRad += right.angle - left.angle; continue;
    }
    const middle = midpoint(left.v, right.v), strongest = [null, null];
    for (const c of active) {
      const face = enteringFace(c, middle);
      if (face && (!strongest[face.axis] || face.coefficient > strongest[face.axis].coefficient))
        strongest[face.axis] = face;
    }
    const A = strongest[0]?.coefficient ?? 0, B = strongest[1]?.coefficient ?? 0;
    const endpoints = [left];
    if (A > 0 && B > 0) {
      const v = unit(Math.sign(middle[0]) * B, Math.sign(middle[1]) * A);
      const angle = angleOf(v);
      if (angle > left.angle && angle < right.angle && cross(left.v, v) > 0 && cross(v, right.v) > 0)
        endpoints.push({ angle, v });
    }
    endpoints.push(right);
    for (let j = 0; j < endpoints.length - 1; j++) {
      const a = endpoints[j], b = endpoints[j + 1], m = midpoint(a.v, b.v);
      const controller = A === 0 && B === 0 ? null
        : A * Math.abs(m[0]) >= B * Math.abs(m[1]) ? strongest[0] : strongest[1];
      const integral = projectedIntegral(a.v, b.v, controller);
      if (!(integral >= 0) || !Number.isFinite(integral)) throw Error('Unresolved continuous sky integral');
      const adjusted = integral - correction, sum = total + adjusted;
      correction = (sum - total) - adjusted; total = sum;
      arcs.push({ headingStartRad: a.angle, headingEndRad: b.angle,
        angularWidthRad: Math.atan2(cross(a.v, b.v), dot(a.v, b.v)),
        headingStartDeg: a.angle * 180 / Math.PI,
        headingEndDeg: b.angle * 180 / Math.PI, projectedIntegral: integral,
        controller: controller ? { ...controller } : null });
    }
  }
  const transmission = total / TAU;
  if (!(transmission >= 0 && transmission <= 1 + 1e-14)) throw Error('Continuous sky integral is outside its supported range');
  return { transmission: Math.min(1, transmission), rawTransmission: transmission,
    transmissionClamped: transmission > 1, arcs, estimatedFaceTests,
    activeColumns: active.length, angularSectors: cuts.length - 1,
    collapsedSectors, omittedAngularWidthRad };
}

export function compareContinuousSkyAt(project, cellIndex) {
  const geometry = prepareSolarReceiverGeometryAt(project, cellIndex);
  if (geometry.status !== 'prepared') return geometry;
  if (geometry.existing.footprint || geometry.proposal.footprint)
    throw Error('Choose a ground receiver outside declared column footprints');
  const result = { status: 'compared', model: CONTINUOUS_SKY_MODEL, cellIndex,
    estimatedFaceTests: 0, semantics: CONTINUOUS_SKY_SEMANTICS };
  for (const target of ['existing', 'proposal']) {
    const { point, columns } = geometry[target];
    const minimumRoofs = integrateContinuousColumns(point, columns, 'minTop');
    const maximumRoofs = integrateContinuousColumns(point, columns, 'maxTop');
    if (maximumRoofs.transmission > minimumRoofs.transmission + 1e-13)
      throw Error('Unresolved continuous height-envelope ordering');
    result[target] = { transmission: [maximumRoofs.transmission, minimumRoofs.transmission],
      minimumRoofs, maximumRoofs };
    result.estimatedFaceTests += minimumRoofs.estimatedFaceTests + maximumRoofs.estimatedFaceTests;
  }
  if (result.estimatedFaceTests > MAX_FACE_TESTS) throw Error('Continuous sky exceeds the complete geometry work budget');
  return result;
}
