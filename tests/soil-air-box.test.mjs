import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SOIL_AIR_BOX_FILE_LIMIT, inspectSoilAirBox, normalizeSoilAirBox, parseSoilAirBox, serializeSoilAirBox,
} from '../soil-air-box.js';
import { makeSoilAirBoxExample } from '../soil-air-box-example.js';

const clone = value => structuredClone(value);
function fixed(values = {}) {
  const source = makeSoilAirBoxExample();
  const numbers = { columnDepth: 100, initialFront: 10, pondingHead: 5, capillaryHead: 15, atmosphericHead: 1408, targetFront: 20, ...values };
  for (const [name, value] of Object.entries(numbers)) source.parameters[name] = { lower: value, upper: value, unit: 'mm', source: `Authored exact control for ${name}.` };
  return source;
}
function nextUp(value) {
  const view = new DataView(new ArrayBuffer(8)); view.setFloat64(0, value, false);
  view.setBigUint64(0, view.getBigUint64(0, false) + 1n, false); return view.getFloat64(0, false);
}
const fraction = (numerator, denominator) => ({ numerator: String(numerator), denominator: String(denominator) });

test('an independent integer pressure-volume construction gives 17/198 and attained fixed-range extrema', () => {
  // Initial gas PV is 1408*90. At 20mm and zero drive, remaining PV is 1448*80.
  // The difference 10880 is checked here with independent integer arithmetic.
  const initial = 1408n * 90n, retained = 1448n * 80n;
  assert.equal((initial - retained) * 198n, initial * 17n);
  const result = inspectSoilAirBox(fixed());
  assert.equal(result.classification, 'all-require-removal');
  assert.deepEqual(result.lower.minimumRemovedFraction, fraction(17, 198));
  assert.deepEqual(result.upper.minimumRemovedFraction, fraction(17, 198));
  assert.equal(result.lower.driveAtRequiredRemoval, 'zero');
  assert.deepEqual(result.display, { lowerPercent: '8.5858', upperPercent: '8.5859', decimalPlaces: 4, positiveLowerBelowDisplay: false, upperRoundedTo100: false });
});

test('the declared authored box returns exact global corner fractions and the correct original endpoints', () => {
  const result = inspectSoilAirBox(makeSoilAirBoxExample());
  assert.deepEqual(result.lower.minimumRemovedFraction, fraction(71909, 142000));
  assert.deepEqual(result.upper.minimumRemovedFraction, fraction(48523, 55120));
  assert.equal(result.display.lowerPercent, '50.6401');
  assert.equal(result.display.upperPercent, '88.0316');
  for (const name of ['columnDepth', 'initialFront', 'pondingHead', 'capillaryHead']) {
    assert.equal(result.lower.parameters[name].bound, 'upper');
    assert.equal(result.upper.parameters[name].bound, 'lower');
  }
  for (const name of ['atmosphericHead', 'targetFront']) {
    assert.equal(result.lower.parameters[name].bound, 'lower');
    assert.equal(result.upper.parameters[name].bound, 'upper');
  }
});

test('zero, mixed, exact contact and positive below display resolution remain distinct', () => {
  const before = inspectSoilAirBox(fixed({ targetFront: 11 }));
  assert.equal(before.classification, 'none-forced');
  assert.equal(before.lower.driveAtRequiredRemoval, 'positive');
  const contact = inspectSoilAirBox(fixed({ targetFront: 12 }));
  assert.equal(contact.classification, 'none-forced');
  assert.equal(contact.lower.driveAtRequiredRemoval, 'zero');
  assert.deepEqual(contact.lower.unclippedBalance, fraction(0, 1));
  const source = fixed(); source.parameters.targetFront.lower = 11;
  const mixed = inspectSoilAirBox(source);
  assert.equal(mixed.classification, 'mixed-requirement');
  assert.deepEqual(mixed.lower.minimumRemovedFraction, fraction(0, 1));
  assert.deepEqual(mixed.upper.minimumRemovedFraction, fraction(17, 198));
  const small = inspectSoilAirBox(fixed({ targetFront: nextUp(12) }));
  assert.equal(small.classification, 'all-require-removal');
  assert.ok(BigInt(small.lower.minimumRemovedFraction.numerator) > 0n);
  assert.equal(small.display.lowerPercent, '0.0000');
  assert.equal(small.display.upperPercent, '0.0001');
  assert.equal(small.display.positiveLowerBelowDisplay, true);
  const nearBase = inspectSoilAirBox(fixed({ columnDepth: 1, initialFront: 0.000001, pondingHead: 0.000001, capillaryHead: 0, atmosphericHead: 1000, targetFront: 0.99999998 }));
  assert.equal(nearBase.display.upperPercent, '100.0000');
  assert.equal(nearBase.display.upperRoundedTo100, true);
  assert.ok(BigInt(nearBase.upper.minimumRemovedFraction.numerator) < BigInt(nearBase.upper.minimumRemovedFraction.denominator));
});

test('unit scaling is exact after binary64 decoding, with no decimal or rounded conversion substitution', () => {
  const source = fixed({ columnDepth: 4000, initialFront: 1000, pondingHead: 1000, capillaryHead: 1000, atmosphericHead: 10000, targetFront: 2000 });
  const original = inspectSoilAirBox(source);
  assert.deepEqual(original.lower.minimumRemovedFraction, fraction(1, 15));
  for (const [unit, scale] of [['cm', 10], ['m', 1000]]) {
    const next = clone(source);
    for (const row of Object.values(next.parameters)) { row.lower /= scale; row.upper /= scale; row.unit = unit; }
    assert.deepEqual(inspectSoilAirBox(next).lower.minimumRemovedFraction, original.lower.minimumRemovedFraction);
  }
  const decimal = fixed(); decimal.parameters.columnDepth = { lower: .1, upper: .1, unit: 'm', source: 'Literal binary64 .1 m.' };
  const converted = inspectSoilAirBox(decimal);
  assert.notDeepEqual(converted.lower.minimumRemovedFraction, inspectSoilAirBox(fixed()).lower.minimumRemovedFraction);
  assert.deepEqual(converted.lower.parameters.columnDepth.exactMM, fraction(450359962737049625n, 4503599627370496n));
});

test('the complete box is refused before evaluation when any combination violates exact order or gap', () => {
  const bad = [];
  let source = fixed(); source.parameters.targetFront.lower = 9; bad.push(source);
  source = fixed(); source.parameters.columnDepth.lower = 19; bad.push(source);
  source = fixed(); source.parameters.pondingHead.lower = 0; bad.push(source);
  source = fixed(); source.parameters.capillaryHead.lower = -1; bad.push(source);
  source = fixed(); source.parameters.atmosphericHead.upper = 20001; bad.push(source);
  source = fixed(); source.parameters.initialFront.lower = Number.MIN_VALUE; bad.push(source);
  source = fixed(); source.parameters.targetFront.lower = NaN; bad.push(source);
  source = fixed(); source.parameters.targetFront.upper = Infinity; bad.push(source);
  source = fixed(); source.parameters.targetFront.lower = '20'; bad.push(source);
  source = fixed(); source.parameters.targetFront.lower = 21; bad.push(source);
  source = fixed(); source.assumptions.allRangeCombinations = false; bad.push(source);
  source = fixed(); source.parameters.capillaryHead.correlation = 'none'; bad.push(source);
  const gap = fixed({ columnDepth: 1, initialFront: .000001, pondingHead: .000001, capillaryHead: 0, atmosphericHead: 1000, targetFront: 1 - 1e-8 });
  assert.doesNotThrow(() => inspectSoilAirBox(gap));
  const beyond = nextUp(gap.parameters.targetFront.upper);
  gap.parameters.targetFront.lower = gap.parameters.targetFront.upper = beyond; bad.push(gap);
  source = fixed({ initialFront: .1, targetFront: .1 });
  source.parameters.targetFront = { lower: .01, upper: .01, unit: 'cm', source: 'Rounded Number multiplication would hide this order violation.' };
  assert.equal(.01 * 10, .1); bad.push(source);
  for (const value of bad) assert.throws(() => inspectSoilAirBox(value));
});

test('only original finite ranges, literal sources, units and explicit assumptions survive source replay', () => {
  const source = makeSoilAirBoxExample();
  source.parameters.capillaryHead.source = '  Original <raw> text; “quoted” mm / cm / m.  ';
  const content = serializeSoilAirBox(source);
  assert.deepEqual(parseSoilAirBox(content), source);
  assert.deepEqual(JSON.parse(content), source);
  assert.equal(Object.hasOwn(JSON.parse(content), 'classification'), false);
  const extra = clone(source); extra.lower = { numerator: '0', denominator: '1' };
  assert.throws(() => normalizeSoilAirBox(extra));
  assert.throws(() => parseSoilAirBox(' '.repeat(SOIL_AIR_BOX_FILE_LIMIT + 1)));
  assert.throws(() => parseSoilAirBox(null));
  const accessor = clone(source); let reads = 0;
  Object.defineProperty(accessor.parameters.columnDepth, 'lower', { enumerable: true, get() { reads++; return 395; } });
  assert.throws(() => normalizeSoilAirBox(accessor)); assert.equal(reads, 0);
  const symbol = clone(source); symbol[Symbol('hidden')] = 'unretained';
  assert.throws(() => normalizeSoilAirBox(symbol));
  const snapshot = clone(source); inspectSoilAirBox(source); assert.deepEqual(source, snapshot);
});
