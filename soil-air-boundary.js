/** Static constant-head, fully wet sharp-front gas balance. No elapsed-time solver.
 * Derivation and physical limits: docs/soil-air-boundary.md.
 */
export const SOIL_AIR_SCHEMA = 'experimental-earth-soil-air-boundary/1';
export const SOIL_AIR_FILE_LIMIT = 96000;
export const SOIL_AIR_ASSUMPTIONS = Object.freeze([
  'constantPonding', 'rigidUniformColumn', 'fullyWetSharpFront',
  'positiveConductivity', 'isothermalIdealGas', 'initiallyAmbientAir',
  'noOtherGasStorage', 'releaseOnlyGasExchange',
]);
const units = Object.freeze({ mm: 1, cm: 10, m: 1000 });
const bytes = text => new TextEncoder().encode(text).byteLength;

function record(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(value)) ||
      Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key))) {
    throw new TypeError(`${label} must contain exactly ${keys.join(', ')}.`);
  }
}
function text(value, label, limit = 1000) {
  if (typeof value !== 'string' || !value.trim() || value.length > limit) {
    throw new TypeError(`${label} needs a literal nonempty source string of at most ${limit} characters.`);
  }
  return value;
}
function unit(value, label) {
  if (typeof value !== 'string' || !Object.hasOwn(units, value)) throw new TypeError(`${label} must explicitly use mm, cm or m.`);
  return value;
}
function length(value, originalUnit, label, minimum, maximum) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`${label} must be a finite number.`);
  const mm = value * units[originalUnit];
  if (!Number.isFinite(mm) || mm < minimum || mm > maximum) {
    throw new RangeError(`${label} must be between ${minimum} and ${maximum} mm after the declared conversion.`);
  }
  return value;
}

export function normalizeSoilAirBoundary(input) {
  record(input, ['schema', 'title', 'column', 'boundary', 'target', 'hypotheses', 'assumptions'], 'Inquiry');
  if (input.schema !== SOIL_AIR_SCHEMA) throw new TypeError('Unsupported soil-air inquiry schema.');
  record(input.column, ['depth', 'initialFront', 'unit', 'source'], 'Column');
  record(input.boundary, ['pondingHead', 'atmosphericHead', 'unit', 'source'], 'Boundary');
  record(input.target, ['front', 'unit', 'source'], 'Target');
  record(input.assumptions, SOIL_AIR_ASSUMPTIONS, 'Model assumptions');
  for (const key of SOIL_AIR_ASSUMPTIONS) {
    if (input.assumptions[key] !== true) throw new TypeError(`Explicit model assumption required: ${key}.`);
  }
  const cu = unit(input.column.unit, 'Column unit');
  const bu = unit(input.boundary.unit, 'Boundary unit');
  const tu = unit(input.target.unit, 'Target unit');
  const column = {
    depth: length(input.column.depth, cu, 'Packed column depth', 1, 100000),
    initialFront: length(input.column.initialFront, cu, 'Initial front depth', 0.000001, 100000),
    unit: cu, source: text(input.column.source, 'Column source'),
  };
  const boundary = {
    pondingHead: length(input.boundary.pondingHead, bu, 'Constant ponding head', 0.000001, 100000),
    atmosphericHead: length(input.boundary.atmosphericHead, bu, 'Atmospheric absolute head', 1000, 20000),
    unit: bu, source: text(input.boundary.source, 'Boundary source'),
  };
  const target = {
    front: length(input.target.front, tu, 'Target front depth', 0.000001, 100000),
    unit: tu, source: text(input.target.source, 'Target source'),
  };
  const L = column.depth * units[cu], z0 = column.initialFront * units[cu], z = target.front * units[tu];
  // Keep the gas domain resolvably positive; the exact base is a separate limit.
  const smallestGap = L * 1e-8;
  if (L - z0 < smallestGap) throw new RangeError('Initial front must leave at least 1e-8 of the column depth as a positive gas region.');
  if (z < z0 || L - z < smallestGap) {
    throw new RangeError('Target front must be at or below the initial front and leave at least 1e-8 of the column depth before the base.');
  }
  if (!Array.isArray(input.hypotheses) || input.hypotheses.length < 1 || input.hypotheses.length > 9) {
    throw new RangeError('Offer 1 to 9 explicit capillary-head alternatives.');
  }
  const ids = new Set();
  const hypotheses = input.hypotheses.map(row => {
    record(row, ['id', 'capillaryHead', 'unit', 'source'], 'Capillary alternative');
    const id = text(row.id, 'Alternative name', 120), hu = unit(row.unit, 'Capillary unit');
    if (ids.has(id)) throw new TypeError('Alternative names must be distinct.');
    ids.add(id);
    return { id, capillaryHead: length(row.capillaryHead, hu, 'Capillary head', 0, 100000),
      unit: hu, source: text(row.source, 'Capillary source') };
  });
  return { schema: SOIL_AIR_SCHEMA, title: text(input.title, 'Inquiry title', 160), column, boundary, target,
    hypotheses, assumptions: Object.fromEntries(SOIL_AIR_ASSUMPTIONS.map(key => [key, true])) };
}

export function parseSoilAirBoundary(content) {
  if (typeof content !== 'string' || bytes(content) > SOIL_AIR_FILE_LIMIT) {
    throw new RangeError(`Original inquiry must be UTF-8 JSON within ${SOIL_AIR_FILE_LIMIT} bytes.`);
  }
  return normalizeSoilAirBoundary(JSON.parse(content));
}
export function serializeSoilAirBoundary(input) {
  const content = JSON.stringify(normalizeSoilAirBoundary(input), null, 2) + '\n';
  if (bytes(content) > SOIL_AIR_FILE_LIMIT) throw new RangeError(`Saved original inputs exceed ${SOIL_AIR_FILE_LIMIT} bytes.`);
  return content;
}

function equilibrium(L, z0, a, H) {
  const gap = L - z0;
  const D = L - 2 * z0 - a - H, E = (z0 + a) * gap;
  const q = Math.hypot(D, 2 * Math.sqrt(E));
  const advancementMm = D < 0 ? 2 * E / (q - D) : (D + q) / 2;
  const remainingGasDepthMm = gap - advancementMm;
  const limitingFrontMm = z0 + advancementMm;
  const gaugeHeadMm = H * (advancementMm / remainingGasDepthMm);
  if (!(advancementMm > 0 && remainingGasDepthMm > 0 && limitingFrontMm > z0 && limitingFrontMm < L)) {
    throw new RangeError('The closed-air equilibrium cannot be resolved inside the admitted gas region.');
  }
  return { D, advancementMm, limitingFrontMm, remainingGasDepthMm,
    gasVolumeFraction: remainingGasDepthMm / gap, gaugeHeadMm,
    absoluteHeadMm: H + gaugeHeadMm,
    balanceResidualMm: limitingFrontMm + a - gaugeHeadMm };
}
function atFront(L, z0, a, H, root, frontMm) {
  const d = frontMm - z0, difference = d - root.advancementMm;
  const otherFactor = root.advancementMm + d - root.D;
  const numericalContactMm = 64 * Number.EPSILON * (L + z0 + Math.abs(root.limitingFrontMm) + root.advancementMm + a);
  const relation = Math.abs(difference) <= numericalContactMm ? 'numerical-contact' :
    difference < 0 ? 'before-closed-limit' : 'beyond-closed-limit';
  // Factoring the equilibrium polynomial avoids 1 - fmax cancellation.
  const removed = difference * otherFactor / (H * (L - z0));
  const minimumRemovedFraction = relation === 'numerical-contact' ? null : relation === 'before-closed-limit' ? 0 : removed;
  if (minimumRemovedFraction !== null && !(minimumRemovedFraction >= 0 && minimumRemovedFraction < 1)) {
    throw new RangeError('The target gas-removal fraction cannot be resolved inside its physical domain.');
  }
  return { frontMm, relation, minimumRemovedFraction, numericalContactMm,
    closedGaugeHeadMm: H * (d / (L - frontMm)),
    zeroFlowGaugeHeadMm: frontMm + a,
    closedDrivingHeadMm: -difference * otherFactor / (L - frontMm),
    ventedGaugeHeadMm: 0, ventedDrivingHeadMm: frontMm + a };
}

export function inspectSoilAirBoundary(input) {
  const source = normalizeSoilAirBoundary(input);
  const L = source.column.depth * units[source.column.unit], z0 = source.column.initialFront * units[source.column.unit];
  const h0 = source.boundary.pondingHead * units[source.boundary.unit], H = source.boundary.atmosphericHead * units[source.boundary.unit];
  const targetMm = source.target.front * units[source.target.unit];
  const alternatives = source.hypotheses.map(hypothesis => {
    const capillaryHeadMm = hypothesis.capillaryHead * units[hypothesis.unit], a = h0 + capillaryHeadMm;
    const root = equilibrium(L, z0, a, H);
    const target = atFront(L, z0, a, H, root, targetMm);
    const profile = Array.from({ length: 80 }, (_, i) => {
      const point = atFront(L, z0, a, H, root, z0 + (L - z0) * i / 80);
      return { frontMm: point.frontMm, minimumRemovedFraction: point.minimumRemovedFraction, kind: point.relation };
    });
    profile.push({ frontMm: L, minimumRemovedFraction: 1, kind: 'base-limit-only' });
    const { D, ...closedAir } = root;
    return { id: hypothesis.id, capillaryHeadMm, closedAir, target, profile };
  });
  return { source, geometry: { depthMm: L, initialFrontMm: z0, pondingHeadMm: h0, atmosphericHeadMm: H, targetMm },
    alternatives, vented: { gaugeHeadMm: 0, internalAirPressureStall: false,
      boundary: 'Only the region above the packed base is modeled; no time or post-saturation prediction.' } };
}
