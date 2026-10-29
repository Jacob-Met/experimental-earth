import test from 'node:test';
import assert from 'node:assert/strict';
import { modelNumber, readingNumber, pondingNumber } from '../number-format.js';

// These literal incumbent expressions establish display compatibility. They
// deliberately retain different rounding/conversion rules for each consumer.
const oldModel = value => Number(value).toLocaleString('en-US', { maximumFractionDigits: 1 });
const oldReading = value => Number(value).toLocaleString('en-US', { maximumSignificantDigits: 6 });
const oldPonding = x => Number(x.toFixed(2)).toLocaleString('en-US');
const cases = [NaN, Infinity, -Infinity, -0, 0, Number.MIN_VALUE, -Number.MIN_VALUE,
  Number.MAX_VALUE, -Number.MAX_VALUE, Number.EPSILON, -Number.EPSILON,
  .005, -.005, .05, -.05, .15, -.15, .25, -.25, 1.005, -1.005,
  2.675, -2.675, 9.99999, -9.99999, 999.95, -999.95, 999999.5,
  1e-12, -1e-12, 1e20, 1e21, 1e22, Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER];
for (let exponent = -320; exponent <= 308; exponent += 7) {
  cases.push(1.23456789 * 10 ** exponent, -1.23456789 * 10 ** exponent);
}
let state = 0x6c59b7;
for (let i = 0; i < 900; i++) {
  state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
  const exponent = (state % 34) - 18;
  cases.push((state / 2 ** 32 - .5) * 10 ** exponent);
}

test('main numeric labels preserve every literal incumbent string over signed and extreme quantities', () => {
  for (const value of cases) assert.equal(modelNumber(value), oldModel(value), String(value));
});
test('significant-digit reading labels preserve every literal incumbent string', () => {
  for (const value of cases) assert.equal(readingNumber(value), oldReading(value), String(value));
});
test('ponding labels retain toFixed then Number semantics, including rounding ties and signed zero', () => {
  for (const value of cases) assert.equal(pondingNumber(value), oldPonding(value), String(value));
  assert.equal(pondingNumber(1.005), '1');
  assert.equal(pondingNumber(-0), '0');
  assert.equal(pondingNumber(-.001), '-0');
  assert.equal(modelNumber(-0), '-0');
});
test('existing numeric conversion and type refusal are preserved without changing caller objects', () => {
  const supported = [undefined, null, true, false, '', ' 12.345 ', '-0', 'NaN', 'Infinity', [], [1.25], [1,2], 12n, new Number(3.456)];
  for (const value of supported) {
    assert.equal(modelNumber(value), oldModel(value));
    assert.equal(readingNumber(value), oldReading(value));
  }
  for (const value of [undefined, null, '1.2', 12n, Symbol('authored')]) {
    let expected; try { oldPonding(value); } catch (error) { expected = error; }
    assert.ok(expected); assert.throws(() => pondingNumber(value), expected.constructor);
  }
  assert.throws(() => modelNumber(Symbol('authored')), TypeError);
  assert.throws(() => readingNumber(Symbol('authored')), TypeError);
  let calls = 0;
  const source = Object.freeze({ valueOf() { calls++; return 12.345; } });
  assert.equal(modelNumber(source), '12.3'); assert.equal(calls, 1);
  assert.equal(readingNumber(source), '12.345'); assert.equal(calls, 2);
});
test('interleaved consumers retain their distinct precision and expose no mutable formatter state', () => {
  const expected = cases.slice(0, 100).map(value => [oldModel(value), oldReading(value), oldPonding(value)]);
  for (let round = 0; round < 3; round++) {
    for (let i = 0; i < expected.length; i++) {
      const value = cases[i]; assert.deepEqual([modelNumber(value), readingNumber(value), pondingNumber(value)], expected[i]);
    }
  }
});
