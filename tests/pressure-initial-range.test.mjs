import test from 'node:test';
import assert from 'node:assert/strict';
import { preparePressureBatchInitialWater, comparePressureBatches } from '../pressure-batches.js';
import { pressureInitialRangeExample, pressureInitialRangeConflictExample } from '../pressure-initial-range-example.js';
import { inspectPressureInitialRange, normalizePressureInitialRange, parsePressureInitialRange,
  serializePressureInitialRange, PRESSURE_INITIAL_RANGE_WORK_LIMIT } from '../pressure-initial-range.js';

test('original-only inquiry replay preserves source, nominal inventory, range and numerical units', () => {
  const input = pressureInitialRangeExample();
  input.initialWater = { lower: 0, upper: 1200, unit: 'mL', source: '  Original <range> source with µ and literal whitespace  ' };
  const original = structuredClone(input), saved = serializePressureInitialRange(input);
  assert.deepEqual(parsePressureInitialRange(saved), original);
  assert.deepEqual(input, original);
  assert.throws(() => parsePressureInitialRange(JSON.stringify({ ...input, winner: 'invented' })), /exactly/);
  assert.throws(() => normalizePressureInitialRange({ ...input, initialWater: { ...input.initialWater, lower: 1 } }), /contain/);
  assert.throws(() => normalizePressureInitialRange({ ...input, resolution: { volume: 0, unit: 'L' } }), /positive/);
});

test('prepared original-time predictions own their admitted source and preserve ordinary comparison values', () => {
  const input = pressureInitialRangeExample(), source = structuredClone(input.study);
  const prepared = preparePressureBatchInitialWater(input.study, { lowerLiters: 0, upperLiters: 1.2 });
  const before = prepared.evaluate('Pressure endpoint', 0);
  const original = comparePressureBatches(source).candidates.find(c => c.id === 'Pressure endpoint');
  assert.deepEqual(before.predictions, original.predictions);
  assert.deepEqual(before.eventHistory, original.eventHistory);
  prepared.study.protocol.additions[0].volume = 999;
  input.study.hypotheses[1].conductivityMmHr = 999;
  before.hypothesis.conductivityMmHr = 999;
  before.predictions[0].source = 'changed returned value';
  const after = prepared.evaluate('Pressure endpoint', 0);
  assert.deepEqual(after.predictions, original.predictions);
  assert.deepEqual(after.eventHistory, original.eventHistory);
  assert.throws(() => prepared.evaluate('unknown', 0), /admitted/);
  assert.throws(() => prepared.evaluate('Pressure endpoint', 1.3), /inside/);
});

test('cancellation returns no partial inquiry and leaves the source reusable', async () => {
  const input = pressureInitialRangeExample(), original = structuredClone(input), controller = new AbortController();
  await assert.rejects(inspectPressureInitialRange(input, { signal: controller.signal,
    yieldControl: async () => controller.abort() }), { name: 'AbortError' });
  assert.deepEqual(input, original);
  const received = await inspectPressureInitialRange(input);
  assert.equal(received.candidates[0].calibration.status, 'retained');
  assert.equal(received.candidates[0].challenge.status, 'rejected');
  assert.equal(received.candidates[1].challenge.status, 'retained');
  assert.ok(received.work.advances <= received.work.maximumAdvances);
  assert.ok(received.work.maximumAdvances <= PRESSURE_INITIAL_RANGE_WORK_LIMIT);
});

test('empty evidence remains a prediction-only range without synthetic observations', async () => {
  const input = pressureInitialRangeConflictExample(); input.study.readings = [];
  const result = await inspectPressureInitialRange(input);
  assert.equal(result.hasCalibration, false); assert.equal(result.hasChallenge, false);
  for (const candidate of result.candidates) {
    assert.equal(candidate.calibration.status, 'no-calibration');
    assert.equal(candidate.challenge.status, 'no-challenge');
    assert.equal(candidate.calibration.witness, null); assert.deepEqual(candidate.readings, []);
    assert.deepEqual(candidate.calibration.outerRangeLiters, [.2, 2]);
  }
});

test('floating-point spacing is reported when a requested starting-volume width cannot be reached', async () => {
  const input = pressureInitialRangeExample();
  input.study.protocol.areaM2 = 100;
  input.study.protocol.initialSurface.volume = 1e9;
  input.study.protocol.additions = [{ id: 'Later batch', minute: 120, volume: 0, unit: 'L', source: 'Explicit zero control' }];
  input.study.hypotheses = [
    { id: 'No flux A', conductivityMmHr: 0, capillaryDriveMm: 0, moistureDeficit: 0, initialCumulativeMm: 1, source: 'Authored fixed-state control' },
    { id: 'No flux B', conductivityMmHr: 0, capillaryDriveMm: 1, moistureDeficit: .5, initialCumulativeMm: 1, source: 'Distinct declared parameters with zero conductivity' },
  ];
  input.study.readings = [{ id: 'Original inventory', minute: 1, phase: 'no-addition', volume: 1e9 - .5,
    uncertainty: .01, unit: 'L', role: 'calibration', source: 'Authored arithmetic-spacing control' }];
  input.initialWater = { lower: 1e9 - 1, upper: 1e9, unit: 'L', source: 'Authored bounded range' };
  input.resolution = { volume: 1e-9, unit: 'L' };
  const result = await inspectPressureInitialRange(input);
  for (const candidate of result.candidates) {
    assert.equal(candidate.calibration.numericalResolutionLimited, true);
    assert.ok(candidate.calibration.lowerBoundaryLiters[1] - candidate.calibration.lowerBoundaryLiters[0] > 1e-9);
    assert.ok(candidate.calibration.witness);
  }
});
