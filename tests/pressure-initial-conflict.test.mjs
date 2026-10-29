import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectPressureInitialRange, serializePressureInitialRange } from '../pressure-initial-range.js';
import { pressureInitialRangeConflictExample } from '../pressure-initial-range-example.js';
const surface = (initial, hour) => Math.max(0, 1 + initial - Math.sqrt(1 + 2 * (1 + initial) * hour));
const inverse = (w, hour) => w + hour + Math.sqrt(1 + 2 * hour * w + hour * hour) - 1;
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-12, `${a} versus ${b}`);
function checkPair(stage) {
  assert.equal(stage.status, 'rejected');
  assert.equal(stage.rejection.kind, 'no-common-starting-amount');
  const w = stage.rejection.separatingWitness;
  assert.ok(w && w.requiresMore.id !== w.requiresLess.id);
  assert.ok(w.initialLiters >= stage.rejection.upperBoundaryLiters[1]);
  assert.ok(w.initialLiters <= stage.rejection.lowerBoundaryLiters[0]);
  assert.ok(w.requiresMore.predictedSurfaceLiters < w.requiresMore.comparisonBandLiters[0]);
  assert.ok(w.requiresLess.predictedSurfaceLiters > w.requiresLess.comparisonBandLiters[1]);
  for (const r of [w.requiresMore, w.requiresLess]) near(r.predictedSurfaceLiters, surface(w.initialLiters, r.minute / 60));
  const requiresAtLeast = inverse(w.requiresMore.originalBandLiters[0], w.requiresMore.minute / 60);
  const permitsAtMost = inverse(w.requiresLess.originalBandLiters[1], w.requiresLess.minute / 60);
  assert.ok(requiresAtLeast > permitsAtMost, 'independent inverse confirms the two original bands require disjoint starting intervals');
  return w;
}
test('one evaluated separator identifies two original rows with independently incompatible starting ranges', async () => {
  const input = pressureInitialRangeConflictExample(), before = structuredClone(input);
  const result = await inspectPressureInitialRange(input), candidate = result.candidates[0];
  const w = checkPair(candidate.calibration);
  assert.equal(w.requiresMore.id, input.study.readings[1].id); assert.equal(w.requiresLess.id, input.study.readings[0].id);
  assert.equal(candidate.calibration.witness, null); assert.equal(candidate.calibration.outerRangeLiters, null);
  assert.deepEqual(input, before); assert.ok(result.work.evaluations <= result.work.maximumEvaluations);
  assert.ok(result.work.advances <= result.work.maximumAdvances);
});
test('conflict witness preserves literal source, original mL quantities and input-only replay', async () => {
  const input = pressureInitialRangeConflictExample();
  for (const r of input.study.readings) { r.volume *= 1000; r.uncertainty *= 1000; r.unit = 'mL'; r.source = '  Original <img onerror=unknown> µ ' + r.id + '  '; }
  const saved = serializePressureInitialRange(input), result = await inspectPressureInitialRange(input);
  const w = checkPair(result.candidates[0].calibration);
  for (const r of [w.requiresMore, w.requiresLess]) {
    const original = input.study.readings.find(x => x.id === r.id);
    for (const key of Object.keys(original)) assert.deepEqual(r[key], original[key]);
  }
  assert.equal(serializePressureInitialRange(result.inquiry), saved); assert.ok(!saved.includes('separatingWitness'));
});
test('challenge-only contradiction stays held aside and does not invent calibration evidence', async () => {
  const input = pressureInitialRangeConflictExample();
  for (const r of input.study.readings) r.role = 'challenge';
  const result = await inspectPressureInitialRange(input), candidate = result.candidates[0];
  assert.equal(candidate.calibration.status, 'no-calibration'); assert.equal(candidate.calibration.witness, null);
  const w = checkPair(candidate.challenge);
  assert.equal(w.requiresMore.role, 'challenge'); assert.equal(w.requiresLess.role, 'challenge');
  assert.equal(result.hasCalibration, false);
});
test('endpoint refusal and retained controls do not acquire a fabricated two-reading explanation', async () => {
  const input = pressureInitialRangeConflictExample();
  const original = await inspectPressureInitialRange(input);
  assert.equal(original.candidates[1].calibration.status, 'retained'); assert.equal(original.candidates[1].calibration.rejection, null);
  input.study.readings = [{ ...input.study.readings[0], volume: 100 }];
  const c = (await inspectPressureInitialRange(input)).candidates[0];
  assert.equal(c.calibration.rejection.kind, 'below-lower-band-at-maximum-start');
  assert.equal(c.calibration.rejection.separatingWitness, undefined);
  assert.equal(c.calibration.rejection.readings[0].id, input.study.readings[0].id);
});
