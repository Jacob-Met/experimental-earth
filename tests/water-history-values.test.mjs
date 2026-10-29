import assert from 'node:assert/strict';
import { test } from 'node:test';
import { retainedWaterValues, exactWaterNumber } from '../water-history-values.js';

const comparison = (minutes, existing, proposed) => ({
  existing: { snapshots: minutes.map((minute, i) => ({ minute, storedLiters: existing[i], depthsMm: [i] })) },
  proposal: { snapshots: minutes.map((minute, i) => ({ minute, storedLiters: proposed[i], depthsMm: [i + 1] })) },
});

test('Original paired numbers and fractional final time survive without display rounding', () => {
  const input = comparison([0, 2, 4, 5.5], [-0, Number.MIN_VALUE, 17210880000, 0.1], [0, 0.3, 17045280000, 0.3]);
  const before = structuredClone(input), values = retainedWaterValues(input);
  assert.equal(values.length, 4);
  for (let i = 0; i < values.length; ++i) {
    assert.ok(Object.is(values[i].minute, input.existing.snapshots[i].minute));
    assert.ok(Object.is(values[i].existingLiters, input.existing.snapshots[i].storedLiters));
    assert.ok(Object.is(values[i].proposedLiters, input.proposal.snapshots[i].storedLiters));
    assert.ok(Object.is(values[i].changeLiters, input.proposal.snapshots[i].storedLiters - input.existing.snapshots[i].storedLiters));
  }
  assert.deepEqual(input, before);
  input.existing.snapshots[1].storedLiters = 999;
  assert.equal(values[1].existingLiters, Number.MIN_VALUE);
  assert.throws(() => { values[0].minute = 1; }, TypeError);
  assert.throws(() => { values.pop(); }, TypeError);
});

test('Every one of 721 retained times is preserved, including zero and positive/negative differences', () => {
  const minutes = Array.from({ length: 721 }, (_, i) => i);
  const a = minutes.map(i => i * 23904000), b = minutes.map(i => (720 - i) * 23674000);
  const values = retainedWaterValues(comparison(minutes, a, b));
  for (let i = 0; i <= 720; ++i) assert.deepEqual(values[i], {
    minute: i, existingLiters: a[i], proposedLiters: b[i], changeLiters: b[i] - a[i],
  });
  assert.deepEqual(retainedWaterValues(comparison([0], [0], [0])), [{ minute: 0, existingLiters: 0, proposedLiters: 0, changeLiters: 0 }]);
});

test('Misaligned or invalid original courses refuse instead of inventing samples', () => {
  for (const value of [null, {}, comparison([], [], []), comparison([1, 1], [1, 2], [2, 3]), comparison([2, 1], [1, 2], [2, 3]),
    comparison([-1], [0], [0]), comparison([Infinity], [0], [0]), comparison([0], [-1], [0]), comparison([0], [0], [NaN]), comparison([0], ['1'], [0])]) {
    assert.throws(() => retainedWaterValues(value));
  }
  const input = comparison([0, 5.5], [0, 1], [0, 2]);
  input.proposal.snapshots[1].minute = 5;
  assert.throws(() => retainedWaterValues(input), /aligned/);
  input.proposal.snapshots.pop();
  assert.throws(() => retainedWaterValues(input), /Paired/);
});

test('Text is round-trip exact, with explicit signed changes and negative zero', () => {
  for (const value of [0, -0, Number.MIN_VALUE, -Number.MIN_VALUE, 0.1, 0.2 - 0.1, 0.3 - 0.1, -123.45678901234567, 17210880000, Number.MAX_VALUE]) {
    for (const signed of [false, true]) assert.ok(Object.is(Number(exactWaterNumber(value, signed)), value));
  }
  assert.equal(exactWaterNumber(12, true), '+12');
  assert.equal(exactWaterNumber(-12, true), '-12');
  assert.equal(exactWaterNumber(0, true), '0');
  assert.equal(exactWaterNumber(-0), '-0');
  for (const value of [null, '1', NaN, Infinity, -Infinity]) assert.throws(() => exactWaterNumber(value));
});
