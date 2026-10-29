/** Exact extrema of the static gas-removal constraint over a declared Cartesian box.
 * Arithmetic describes the supplied binary64 numbers with exact unit scaling.
 * It does not establish that physical parameters lie inside the declared ranges.
 */
import { SOIL_AIR_ASSUMPTIONS } from './soil-air-boundary.js';

export const SOIL_AIR_BOX_SCHEMA = 'experimental-earth-soil-air-box/1';
export const SOIL_AIR_BOX_FILE_LIMIT = 96000;
export const SOIL_AIR_BOX_ASSUMPTIONS = Object.freeze([...SOIL_AIR_ASSUMPTIONS, 'allRangeCombinations']);
export const SOIL_AIR_BOX_PARAMETERS = Object.freeze([
  'columnDepth', 'initialFront', 'pondingHead', 'capillaryHead', 'atmosphericHead', 'targetFront',
]);
const factors = Object.freeze({ mm: 1n, cm: 10n, m: 1000n });
const byteLength = value => new TextEncoder().encode(value).byteLength;

function gcd(a, b) {
  while (b) [a, b] = [b, a % b];
  return a < 0n ? -a : a;
}
function rational(n, d = 1n) {
  if (d === 0n) throw new RangeError('Zero rational denominator.');
  if (d < 0n) { n = -n; d = -d; }
  const common = gcd(n, d);
  return { n: n / common, d: d / common };
}
const add = (a, b) => rational(a.n * b.d + b.n * a.d, a.d * b.d);
const subtract = (a, b) => rational(a.n * b.d - b.n * a.d, a.d * b.d);
const multiply = (a, b) => rational(a.n * b.n, a.d * b.d);
const divide = (a, b) => rational(a.n * b.d, a.d * b.n);
const compare = (a, b) => {
  const delta = a.n * b.d - b.n * a.d;
  return delta < 0n ? -1 : delta > 0n ? 1 : 0;
};
const ZERO = rational(0n), ONE = rational(1n);
const output = value => ({ numerator: String(value.n), denominator: String(value.d) });

function binary64(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError('Every range endpoint must be a finite number.');
  if (value === 0) return ZERO;
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, value, false);
  const bits = view.getBigUint64(0, false), exponent = Number((bits >> 52n) & 2047n);
  let mantissa = bits & ((1n << 52n) - 1n);
  if (exponent) mantissa |= 1n << 52n;
  if (bits >> 63n) mantissa = -mantissa;
  const shift = exponent ? exponent - 1075 : -1074;
  return shift >= 0 ? rational(mantissa << BigInt(shift)) : rational(mantissa, 1n << BigInt(-shift));
}
function exactMM(value, unit) { return multiply(binary64(value), rational(factors[unit])); }
// These scalar cutoffs preserve the prior software bounds as represented numbers.
// The relative gas-region margin below is deliberately the exact decimal 1e-8.
const MIN_POSITIVE_MM = binary64(0.000001);
const LIMITS = Object.freeze({
  columnDepth: [ONE, rational(100000n)],
  initialFront: [MIN_POSITIVE_MM, rational(100000n)],
  pondingHead: [MIN_POSITIVE_MM, rational(100000n)],
  capillaryHead: [ZERO, rational(100000n)],
  atmosphericHead: [rational(1000n), rational(20000n)],
  targetFront: [MIN_POSITIVE_MM, rational(100000n)],
});
const REMAINING_FRACTION = rational(99999999n, 100000000n);

function record(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(value)) ||
      Reflect.ownKeys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key) ||
        !Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), 'value'))) {
    throw new TypeError(`${label} must contain exactly ${keys.join(', ')}.`);
  }
}
function literal(value, label, limit = 1000) {
  if (typeof value !== 'string' || !value.trim() || value.length > limit) {
    throw new TypeError(`${label} needs a nonempty source string of at most ${limit} characters.`);
  }
  return value;
}
function receive(input) {
  record(input, ['schema', 'title', 'parameters', 'assumptions'], 'Range inquiry');
  if (input.schema !== SOIL_AIR_BOX_SCHEMA) throw new TypeError('Unsupported soil-air range inquiry schema.');
  record(input.parameters, SOIL_AIR_BOX_PARAMETERS, 'Parameter ranges');
  record(input.assumptions, SOIL_AIR_BOX_ASSUMPTIONS, 'Model and range assumptions');
  for (const key of SOIL_AIR_BOX_ASSUMPTIONS) {
    if (input.assumptions[key] !== true) throw new TypeError(`Explicit assumption required: ${key}.`);
  }
  const parameters = {}, ranges = {};
  for (const name of SOIL_AIR_BOX_PARAMETERS) {
    const row = input.parameters[name];
    record(row, ['lower', 'upper', 'unit', 'source'], name);
    if (typeof row.unit !== 'string' || !Object.hasOwn(factors, row.unit)) {
      throw new TypeError(`${name} must explicitly use mm, cm or m.`);
    }
    const lower = exactMM(row.lower, row.unit), upper = exactMM(row.upper, row.unit);
    if (compare(lower, upper) > 0) throw new RangeError(`${name} has reversed endpoints.`);
    const [minimum, maximum] = LIMITS[name];
    if (compare(lower, minimum) < 0 || compare(upper, maximum) > 0) {
      throw new RangeError(`${name} is outside the admitted millimetre bounds after exact unit conversion.`);
    }
    parameters[name] = { lower: row.lower, upper: row.upper, unit: row.unit, source: literal(row.source, `${name} source`) };
    ranges[name] = { lower, upper };
  }
  if (compare(ranges.initialFront.upper, ranges.targetFront.lower) > 0) {
    throw new RangeError('Every target must be at or below every initial front: initialFront.upper must not exceed targetFront.lower after exact conversion.');
  }
  if (compare(ranges.targetFront.upper, multiply(REMAINING_FRACTION, ranges.columnDepth.lower)) > 0) {
    throw new RangeError('Every combination must retain a gas region of at least exactly 1/100000000 of the column depth. The whole incompatible box is refused.');
  }
  const source = { schema: SOIL_AIR_BOX_SCHEMA, title: literal(input.title, 'Inquiry title', 160), parameters,
    assumptions: Object.fromEntries(SOIL_AIR_BOX_ASSUMPTIONS.map(key => [key, true])) };
  return { source, ranges };
}
export function normalizeSoilAirBox(input) { return receive(input).source; }
export function parseSoilAirBox(content) {
  if (typeof content !== 'string' || byteLength(content) > SOIL_AIR_BOX_FILE_LIMIT) {
    throw new RangeError(`Original range inquiry must be UTF-8 JSON within ${SOIL_AIR_BOX_FILE_LIMIT} bytes.`);
  }
  return normalizeSoilAirBox(JSON.parse(content));
}
export function serializeSoilAirBox(input) {
  const content = JSON.stringify(normalizeSoilAirBox(input), null, 2) + '\n';
  if (byteLength(content) > SOIL_AIR_BOX_FILE_LIMIT) throw new RangeError('Saved original ranges exceed the source byte limit.');
  return content;
}

function removal(point) {
  const { columnDepth: L, initialFront: z0, pondingHead: h, capillaryHead: psi, atmosphericHead: H, targetFront: z } = point;
  const retainedAtZeroDrive = divide(multiply(add(add(add(H, z), h), psi), subtract(L, z)), multiply(H, subtract(L, z0)));
  const unclipped = subtract(ONE, retainedAtZeroDrive);
  const required = compare(unclipped, ZERO) > 0 ? unclipped : ZERO;
  if (compare(required, ZERO) < 0 || compare(required, ONE) >= 0) throw new RangeError('Exact gas balance escaped the admitted interior domain.');
  return { required, unclipped };
}
function corner(source, ranges, minimum) {
  const upperForMinimum = new Set(['columnDepth', 'initialFront', 'pondingHead', 'capillaryHead']);
  const point = {}, parameters = {};
  for (const name of SOIL_AIR_BOX_PARAMETERS) {
    const bound = upperForMinimum.has(name) === minimum ? 'upper' : 'lower';
    point[name] = ranges[name][bound];
    parameters[name] = { bound, value: source.parameters[name][bound], unit: source.parameters[name].unit, exactMM: output(point[name]) };
  }
  const { required, unclipped } = removal(point);
  return { required, witness: { parameters, minimumRemovedFraction: output(required), unclippedBalance: output(unclipped),
    driveAtRequiredRemoval: compare(unclipped, ZERO) < 0 ? 'positive' : 'zero' } };
}
function roundedPercent(value, upward, places) {
  const scale = 10n ** BigInt(places), numerator = value.n * 100n * scale;
  const rounded = upward ? (numerator + value.d - 1n) / value.d : numerator / value.d;
  const whole = rounded / scale, fraction = String(rounded % scale).padStart(places, '0');
  return { text: `${whole}${places ? '.' + fraction : ''}`, rounded };
}

export function inspectSoilAirBox(input) {
  const { source, ranges } = receive(input);
  const lower = corner(source, ranges, true), upper = corner(source, ranges, false);
  if (compare(lower.required, upper.required) > 0) throw new RangeError('Exact corner ordering failed.');
  const decimalPlaces = 4;
  const lo = roundedPercent(lower.required, false, decimalPlaces), hi = roundedPercent(upper.required, true, decimalPlaces);
  const lowerPositive = compare(lower.required, ZERO) > 0, upperPositive = compare(upper.required, ZERO) > 0;
  return { source, classification: lowerPositive ? 'all-require-removal' : upperPositive ? 'mixed-requirement' : 'none-forced',
    lower: lower.witness, upper: upper.witness,
    display: { lowerPercent: lo.text, upperPercent: hi.text, decimalPlaces,
      positiveLowerBelowDisplay: lowerPositive && lo.rounded === 0n,
      upperRoundedTo100: hi.rounded === 100n * 10n ** BigInt(decimalPlaces) },
    arithmetic: { endpoints: 'exact supplied binary64 numbers', unitFactors: 'exact integer mm/cm/m factors',
      gasGapFraction: { numerator: '1', denominator: '100000000' },
      scalarMinimumPositiveMM: output(MIN_POSITIVE_MM), bound: 'attained extrema of the whole admitted Cartesian box' } };
}
