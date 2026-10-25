import test from 'node:test';
import assert from 'node:assert/strict';
import { planComplementaryDepths } from '../complementary-depth-plan.js';

const trajectories = rows => rows.map(depthsMm => ({ snapshots: [
  { minute: 0, depthsMm: depthsMm.map(() => 0) }, { minute: 5, depthsMm },
] }));

test('complementary points distinguish a pair missed by largest span', () => {
  // Cell 0's largest span covers A–C and B–C; cell 1 adds A–B.
  const runs = trajectories([[0, 0], [1, 3], [10, 3]]);
  const report = planComplementaryDepths(runs, { uncertaintyMm: 1, maxReadings: 2 });
  assert.equal(report.complete, true);
  assert.deepEqual(report.questions.map(q => q.cellIndex), [0, 1]);
  assert.deepEqual(report.questions.map(q => q.newlySeparatedPairs.length), [2, 1]);
  const one = planComplementaryDepths(runs, { uncertaintyMm: 1, maxReadings: 1 });
  assert.deepEqual(one.unresolvedPairs, [{ first: 0, second: 1, index: 0 }]);
});

test('touching prospective bands do not distinguish a pair', () => {
  assert.equal(planComplementaryDepths(trajectories([[0], [2]]), { uncertaintyMm: 1 }).status, 'indistinguishable');
  assert.equal(planComplementaryDepths(trajectories([[0], [2.01]]), { uncertaintyMm: 1 }).complete, true);
});

test('bounded greedy result is explicitly not a global optimum', () => {
  const depths = [[6,10,8,2,6], [0,2,1,7,4], [10,4,4,5,7], [6,4,1,7,0], [2,2,10,1,10]];
  const report = planComplementaryDepths(trajectories(depths), { uncertaintyMm: 2, maxReadings: 2 });
  assert.deepEqual(report.questions.map(q => q.cellIndex), [2, 0]);
  assert.equal(report.separatedPairCount, 7);
  let alternativePairs = 0;
  for (let a = 0; a < depths.length; a++) for (let b = a + 1; b < depths.length; b++) {
    if ([0, 4].some(cell => Math.abs(depths[a][cell] - depths[b][cell]) > 4)) alternativePairs++;
  }
  assert.equal(alternativePairs, 8, 'A different pair covers more; the consumer must retain its greedy limitation');
});

test('recorded coordinates exclude questions independently of recorded values', () => {
  const runs = trajectories([[0, 0], [1, 3], [10, 3]]);
  const options = { uncertaintyMm: 1, recorded: [{ cellIndex: 0, minute: 5, depthMm: 99 }] };
  const report = planComplementaryDepths(runs, options);
  options.recorded[0].depthMm = 0;
  assert.deepEqual(planComplementaryDepths(runs, options), report);
  assert.equal(report.excludedCount, 1);
  assert.deepEqual(report.questions.map(q => q.cellIndex), [1]);
  assert.equal(report.complete, false);
});

test('stable ties choose earliest time then cell and duplicate patterns add no questions', () => {
  const runs = trajectories([[0, 0], [4, 4]]);
  runs.forEach(run => run.snapshots.push({ minute: 10, depthsMm: [...run.snapshots[1].depthsMm] }));
  const before = structuredClone(runs);
  const report = planComplementaryDepths(runs, { uncertaintyMm: 1 });
  assert.deepEqual(report.questions.map(q => [q.minute, q.cellIndex]), [[5, 0]]);
  assert.equal(report.distinctPatterns, 1);
  assert.deepEqual(runs, before);
});

test('explicit empty, all-recorded and signal-free results', () => {
  assert.equal(planComplementaryDepths([], { uncertaintyMm: 1 }).status, 'insufficient-alternatives');
  const runs = trajectories([[1], [1]]);
  assert.equal(planComplementaryDepths(runs, { uncertaintyMm: 0 }).status, 'indistinguishable');
  assert.equal(planComplementaryDepths(runs, { uncertaintyMm: 0, recorded: [{ cellIndex: 0, minute: 5 }] }).status, 'all-recorded');
});

test('refuse invalid options and incoherent trajectories', () => {
  const runs = trajectories([[0], [4]]);
  for (const uncertaintyMm of [NaN, -1, Infinity, '1', 1001]) assert.throws(() => planComplementaryDepths(runs, { uncertaintyMm }));
  for (const maxReadings of [0, 4, 1.5]) assert.throws(() => planComplementaryDepths(runs, { uncertaintyMm: 1, maxReadings }));
  runs[1].snapshots[1].minute = 6;
  assert.throws(() => planComplementaryDepths(runs, { uncertaintyMm: 1 }), /shared/);
  runs[1].snapshots[1].minute = 5;
  runs[1].snapshots[1].depthsMm[0] = NaN;
  assert.throws(() => planComplementaryDepths(runs, { uncertaintyMm: 1 }), /finite/);
});
