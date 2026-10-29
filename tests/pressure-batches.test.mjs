import test from 'node:test';
import assert from 'node:assert/strict';
import { comparePressureBatches, normalizePressureBatchStudy, serializePressureBatches, parsePressureBatches } from '../pressure-batches.js';
import { pressureBatchExample } from '../pressure-batches-example.js';
const fixture = () => structuredClone(pressureBatchExample);

test('source-only roundtrip preserves original units, phase, strings and duplicate-time observations', () => {
  const s = fixture(); s.source = '<img src=x onerror="alert(1)"> Original source retained literally';
  s.readings.splice(1, 0, { ...s.readings[0], id: 'Independent transcription', source: 'Separate original row at the same time and phase' });
  const before = structuredClone(s), saved = serializePressureBatches(s), reopened = parsePressureBatches(saved);
  assert.deepEqual(reopened, normalizePressureBatchStudy(s)); assert.deepEqual(s, before);
  assert.equal(reopened.protocol.additions[1].volume, 2000); assert.equal(reopened.protocol.additions[1].unit, 'mL');
  assert.equal(reopened.source, s.source); assert.equal(reopened.readings.length, 5);
  assert.deepEqual(reopened.readings.filter(r => r.minute === 60).map(r => r.phase), ['before', 'after']);
  const result = comparePressureBatches(reopened);
  assert.equal(result.candidates[0].predictions.length, 5); assert.equal(result.candidates[0].calibration.count, 2);
  assert.deepEqual(JSON.parse(saved), reopened); assert.equal('candidates' in JSON.parse(saved), false);
  assert.throws(() => parsePressureBatches(JSON.stringify({ ...s, winner: 'Pressure endpoint' })), /conclusions|input fields/);
});

test('equivalent liter and milliliter declarations preserve predictions without rewriting original values', () => {
  const a = fixture(), b = fixture();
  b.protocol.initialSurface = { ...b.protocol.initialSurface, volume: 0, unit: 'mL' };
  for (const q of b.protocol.additions) if (q.unit === 'L') { q.volume *= 1000; q.unit = 'mL'; }
  for (const q of b.readings) if (q.unit === 'L') { q.volume *= 1000; q.uncertainty *= 1000; q.unit = 'mL'; }
  const ra = comparePressureBatches(a), rb = comparePressureBatches(b);
  assert.deepEqual(ra.candidates.map(c => c.eventHistory), rb.candidates.map(c => c.eventHistory));
  for (let i = 0; i < ra.candidates.length; i++) {
    assert.deepEqual(ra.candidates[i].predictions.map(r => r.predictedSurfaceLiters), rb.candidates[i].predictions.map(r => r.predictedSurfaceLiters));
  }
  assert.equal(rb.study.readings[0].volume, 1000); assert.equal(rb.study.readings[0].unit, 'mL');
});

test('a prediction-only or challenge-only course never invents calibration support', () => {
  const s = fixture(); s.readings = [];
  const a = comparePressureBatches(s);
  assert.equal(a.hasCalibration, false); assert.deepEqual(a.calibrationOrder, []);
  assert.ok(a.candidates.every(c => c.calibration.compatible === null && c.predictions.length === 0));
  s.readings = fixture().readings.map(r => ({ ...r, role: 'challenge' }));
  const b = comparePressureBatches(s);
  assert.equal(b.hasCalibration, false); assert.deepEqual(b.calibrationOrder, []);
  assert.ok(b.candidates.every(c => c.calibration.count === 0 && c.challenge.count === 4));
});

test('missing or contradictory physical declarations and ambiguous batch-side readings refuse', () => {
  const mutations = [
    s => delete s.protocol.instantaneousBatches,
    s => s.protocol.instantaneousBatches = false,
    s => s.protocol.noOtherLoss = false,
    s => s.protocol.noOtherSupply = false,
    s => s.protocol.additions[1].minute = 0,
    s => s.protocol.additions.reverse(),
    s => s.readings[1].phase = 'no-addition',
    s => s.readings[0].phase = 'before',
    s => s.hypotheses[1].moistureDeficit = '',
    s => s.hypotheses[1].conductivityMmHr = 2001,
    s => s.hypotheses[1] = { ...s.hypotheses[0], id: 'Duplicate parameters' },
    s => s.protocol.additions[0].volume = -1,
    s => s.readings[0].uncertainty = NaN,
  ];
  for (const mutate of mutations) { const s = fixture(); mutate(s); assert.throws(() => comparePressureBatches(s)); }
});

test('all source rows remain in the result and repeated evaluation cannot modify the original study', () => {
  const s = fixture(), original = structuredClone(s);
  const a = comparePressureBatches(s), b = comparePressureBatches(s);
  assert.deepEqual(s, original); assert.deepEqual(a, b);
  assert.deepEqual(a.candidates.map(c => c.id), s.hypotheses.map(h => h.id));
  for (const c of a.candidates) assert.deepEqual(c.predictions.map(r => ({ id: r.id, source: r.source, phase: r.phase, role: r.role })),
    s.readings.map(r => ({ id: r.id, source: r.source, phase: r.phase, role: r.role })));
  assert.equal(a.candidates[0].calibration.compatible, false, 'the closest available explanation must not erase contradiction');
});
