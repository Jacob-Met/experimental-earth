import test from 'node:test';
import assert from 'node:assert/strict';
import { makeExample } from '../core.js';
import { chooseInfiltrationQuestion } from '../infiltration-question.js';

function fixture() {
  const p = makeExample(); p.width = 2; p.height = 2; p.selectedIndex = 0;
  p.existing = Array.from({ length: 4 }, () => ({ elevationM: 0, surface: 'turf', provenance: 'analytic fixture' }));
  p.proposal = structuredClone(p.existing);
  p.weather = { ...p.weather, rainMmHr: 30, stormMinutes: 60, durationMinutes: 60, mobilityPerHour: 0, boundaryExitPerHour: 0 };
  p.observations = [{ cellIndex: 0, minute: 30, depthMm: 10, uncertaintyMm: 5, source: 'authored broad calibration band', scenario: 'existing', use: 'calibration' }];
  p.infiltrationStudy = { target: 'existing', surface: 'turf', ratesMmHr: [0, 10, 20] };
  return p;
}

test('analytic linear alternatives separate most at the known final time', () => {
  const p = fixture(), before = JSON.stringify(p), q = chooseInfiltrationQuestion(p);
  assert.equal(q.status, 'question'); assert.equal(q.minute, 60); assert.equal(q.cellIndex, 0);
  assert.ok(Math.abs(q.spanMm - 20) < 1e-8);
  assert.deepEqual(q.predictions.map(p => p.rateMmHr), [0, 10, 20]);
  q.predictions.forEach(({ rateMmHr, depthMm }) => assert.ok(Math.abs(depthMm - (30 - rateMmHr)) < 1e-8));
  assert.equal(q.evaluatedCount, 47); assert.equal(q.excludedCount, 1);
  assert.equal(JSON.stringify(p), before);
});

test('recorded same-scenario coordinates are excluded without reading their values', () => {
  const p = fixture();
  p.observations.push({ ...p.observations[0], minute: 60, depthMm: 20, use: 'challenge' });
  const first = chooseInfiltrationQuestion(p);
  assert.equal(first.cellIndex, 1); assert.equal(first.minute, 60);
  p.observations[1].depthMm = 1000;
  assert.deepEqual(chooseInfiltrationQuestion(p), first);
});

test('dry event yields no distinguishing measurement even with compatible rates', () => {
  const p = fixture(); p.weather.rainMmHr = 0;
  p.observations[0].depthMm = 0; p.observations[0].uncertaintyMm = 0;
  assert.equal(chooseInfiltrationQuestion(p).status, 'indistinguishable');
});

test('single supported candidate or no calibration gives no experiment recommendation', () => {
  const p = fixture(); p.observations[0].uncertaintyMm = 0.01;
  assert.equal(chooseInfiltrationQuestion(p).status, 'insufficient-alternatives');
  p.observations = [];
  assert.equal(chooseInfiltrationQuestion(p).status, 'insufficient-alternatives');
});

test('fully observed candidate grid produces no fabricated new question', () => {
  const p = fixture(); p.weather.durationMinutes = 5; p.weather.stormMinutes = 5;
  p.observations = Array.from({ length: 4 }, (_, cellIndex) => ({ cellIndex, minute: 5, depthMm: 1,
    uncertaintyMm: 3, source: 'authored full grid readings', scenario: 'existing', use: 'calibration' }));
  const q = chooseInfiltrationQuestion(p);
  assert.equal(q.status, 'all-recorded'); assert.equal(q.excludedCount, 4); assert.equal(q.evaluatedCount, 0);
});

test('another scenario record cannot hide an unmeasured point in this scenario', () => {
  const p = fixture();
  p.observations.push({ ...p.observations[0], minute: 60, scenario: 'proposal', use: 'challenge' });
  assert.equal(chooseInfiltrationQuestion(p).cellIndex, 0);
});
