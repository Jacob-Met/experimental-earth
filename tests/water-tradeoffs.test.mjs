import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeWaterTradeoffs } from '../water-tradeoffs.js';

const pair = (changes, minutes = changes.map((_, i) => i)) => ({
  existing: { snapshots: changes.map((_, i) => ({ minute: minutes[i], storedLiters: 100 })) },
  proposal: { snapshots: changes.map((change, i) => ({ minute: minutes[i], storedLiters: 100 + change })) },
});

test('mixed course partitions every original index and exposes all exact extrema ties', () => {
  const input = pair([0, 3, 7, 7, 0, -2, -5, -5, 4], [0, 2, 5, 7, 8, 12, 14, 15, 20]);
  const before = structuredClone(input), result = summarizeWaterTradeoffs(input);
  assert.deepEqual(result.counts, { more: 4, less: 3, equal: 2 });
  assert.deepEqual(result.increase, { changeLiters: 7, indices: [2, 3] });
  assert.deepEqual(result.decrease, { changeLiters: -5, indices: [6, 7] });
  assert.deepEqual(result.groups, [
    { sign: 'equal', firstIndex: 0, lastIndex: 0 },
    { sign: 'more', firstIndex: 1, lastIndex: 3 },
    { sign: 'equal', firstIndex: 4, lastIndex: 4 },
    { sign: 'less', firstIndex: 5, lastIndex: 7 },
    { sign: 'more', firstIndex: 8, lastIndex: 8 },
  ]);
  assert.deepEqual(result.transitions, [
    { beforeIndex: 0, afterIndex: 1 }, { beforeIndex: 3, afterIndex: 4 },
    { beforeIndex: 4, afterIndex: 5 }, { beforeIndex: 7, afterIndex: 8 },
  ]);
  assert.deepEqual(input, before);
  for (let i = 0; i < result.rows.length; ++i) {
    assert.equal(result.rows[i].minute, input.existing.snapshots[i].minute);
    assert.equal(result.rows[i].changeLiters, input.proposal.snapshots[i].storedLiters - input.existing.snapshots[i].storedLiters);
  }
});

test('all-zero, one-direction and one-snapshot courses remain explicit', () => {
  for (const [changes, counts, increase, decrease] of [
    [[0, 0, 0], { more: 0, less: 0, equal: 3 }, null, null],
    [[2, 2, 1], { more: 3, less: 0, equal: 0 }, { changeLiters: 2, indices: [0, 1] }, null],
    [[-2, -1, -2], { more: 0, less: 3, equal: 0 }, null, { changeLiters: -2, indices: [0, 2] }],
    [[0], { more: 0, less: 0, equal: 1 }, null, null],
  ]) {
    const result = summarizeWaterTradeoffs(pair(changes));
    assert.deepEqual(result.counts, counts); assert.deepEqual(result.increase, increase); assert.deepEqual(result.decrease, decrease);
    assert.equal(result.groups.length, 1); assert.deepEqual(result.transitions, []);
  }
});

test('fractional boundaries are original adjacent samples and tiny differences have no hidden zero tolerance', () => {
  const input = { existing: { snapshots: [
    { minute: 0, storedLiters: 0 }, { minute: 1.25, storedLiters: 0 },
    { minute: 3.75, storedLiters: Number.MIN_VALUE }, { minute: 5.5, storedLiters: 0 },
  ] }, proposal: { snapshots: [
    { minute: 0, storedLiters: -0 }, { minute: 1.25, storedLiters: Number.MIN_VALUE },
    { minute: 3.75, storedLiters: 0 }, { minute: 5.5, storedLiters: 0 },
  ] } };
  const result = summarizeWaterTradeoffs(input);
  assert.deepEqual(result.counts, { more: 1, less: 1, equal: 2 });
  assert(Object.is(result.rows[0].changeLiters, -0));
  assert.equal(result.increase.changeLiters, Number.MIN_VALUE); assert.equal(result.decrease.changeLiters, -Number.MIN_VALUE);
  assert.deepEqual(result.transitions.map(t => [result.rows[t.beforeIndex].minute, result.rows[t.afterIndex].minute]), [[0, 1.25], [1.25, 3.75], [3.75, 5.5]]);
  assert.deepEqual(result.rows.map(r => r.minute), [0, 1.25, 3.75, 5.5]);
});

test('the721-row population is complete and the retained summary owns immutable scalar values', () => {
  const input = pair(Array.from({ length: 721 }, (_, i) => i % 3 - 1));
  const result = summarizeWaterTradeoffs(input);
  assert.deepEqual(result.counts, { more: 240, less: 241, equal: 240 });
  assert.equal(result.groups.length, 721); assert.equal(result.transitions.length, 720);
  const expectedMinutes = result.rows.map(row => row.minute), originalLast = result.rows.at(-1).changeLiters;
  input.existing.snapshots[0].minute = 900; input.proposal.snapshots.at(-1).storedLiters = 999;
  assert.deepEqual(result.rows.map(row => row.minute), expectedMinutes); assert.equal(result.rows.at(-1).changeLiters, originalLast);
  for (const object of [result, result.rows, result.rows[0], result.counts, result.groups, result.groups[0], result.transitions, result.transitions[0], result.increase, result.increase.indices]) assert(Object.isFrozen(object));
});

test('malformed, misaligned and nonfinite original populations refuse without a partial summary', () => {
  for (const mutate of [
    p => p.proposal.snapshots.pop(), p => { p.existing.snapshots[1].minute = 0; },
    p => { p.proposal.snapshots[1].minute = 9; }, p => { p.existing.snapshots[0].storedLiters = Infinity; },
    p => { p.proposal.snapshots[0].storedLiters = -1; },
  ]) { const input = pair([0, 1]); mutate(input); assert.throws(() => summarizeWaterTradeoffs(input), /snapshots/); }
  assert.throws(() => summarizeWaterTradeoffs({}), /snapshots/);
});
