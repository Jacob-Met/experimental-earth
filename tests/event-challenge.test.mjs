import test from 'node:test';
import assert from 'node:assert/strict';
import { compareInfiltration } from '../infiltration-study.js';
import { makeExample } from '../core.js';
import { compareEvents, makeEventChallenge, reopenEventChallenge } from '../event-challenge.js';

function fixture() {
  const first = makeExample();
  first.width = first.height = 2; first.selectedIndex = 0;
  first.existing = Array.from({ length: 4 }, () => ({ elevationM: 0, surface: 'turf', provenance: 'analytic fixture' }));
  first.proposal = structuredClone(first.existing);
  Object.assign(first.weather, { rainMmHr: 30, stormMinutes: 60, durationMinutes: 60, mobilityPerHour: 0, boundaryExitPerHour: 0 });
  first.observations = [{ cellIndex: 0, minute: 60, depthMm: 20, uncertaintyMm: 11, source: 'analytic 30-k mm', scenario: 'existing', use: 'calibration' }];
  const second = structuredClone(first);
  second.weather.rainMmHr = 50;
  second.observations = [{ ...first.observations[0], depthMm: 40, uncertaintyMm: 0.01, use: 'challenge', source: 'analytic 50-k mm' }];
  return { first, second, study: { target: 'existing', surface: 'turf', ratesMmHr: [0, 10, 20] }, refs: { calibration: 'storm A', challenge: 'storm B' } };
}

test('separate storm narrows ambiguous calibration with analytic depths', () => {
  const {first, second, study, refs} = fixture();
  const result = compareEvents(first, second, study, refs);
  assert.deepEqual(result.candidates.map(c => c.rateMmHr), compareInfiltration(first, study).candidates.map(c => c.rateMmHr));
  assert.deepEqual(result.survivingRatesMmHr, [10]);
  assert.equal(result.status, 'one-survivor');
  assert.ok(Math.abs(result.candidates[0].secondEvent.rmseMm) < 1e-8);
});
test('challenge changes cannot reorder calibration; rejection does not refit', () => {
  const {first, second, study, refs} = fixture();
  second.observations[0].depthMm = 500;
  const result = compareEvents(first, second, study, refs);
  assert.deepEqual(result.candidates.map(c => c.rateMmHr), compareInfiltration(first, study).candidates.map(c => c.rateMmHr));
  assert.deepEqual(result.survivingRatesMmHr, []);
  assert.equal(result.status, 'challenged');
  assert.equal(first.weather.rainMmHr, 30);
});
test('same-event held-aside rejection is retained during transfer', () => {
  const {first, second, study, refs} = fixture();
  first.observations.push({...first.observations[0], depthMm: 500, uncertaintyMm: 0, use: 'challenge'});
  assert.deepEqual(compareEvents(first, second, study, refs).survivingRatesMmHr, []);
});
test('different geometry and non-weather assumptions reject transfer', () => {
  for (const mutate of [p=>p.existing[0].elevationM=1, p=>p.existing[0].surface='sealed', p=>p.weather.cellSizeM=3, p=>p.weather.stepMinutes=10, p=>p.weather.mobilityPerHour=1]) {
    const {first, second, study, refs} = fixture(); mutate(second);
    assert.throws(()=>compareEvents(first, second, study, refs), /match/);
  }
});
test('requires declared separate identity and appropriate evidence roles', () => {
  const {first, second, study, refs} = fixture();
  assert.throws(()=>compareEvents(first, second, study, {...refs, challenge:' storm A '}), /distinct/);
  assert.throws(()=>compareEvents(first, second, study, {...refs, challenge:''}), /reference/);
  second.observations[0].use='calibration';
  assert.throws(()=>compareEvents(first, second, study, refs), /contains calibration/);
  second.observations[0].use='unassigned';
  assert.throws(()=>compareEvents(first, second, study, refs), /held-aside/);
});
test('portable bundle owns snapshots, recomputes verdicts and rejects corruption', () => {
  const {first, second, study, refs} = fixture();
  const bundle = makeEventChallenge(first, second, study, refs);
  first.observations.length=0; second.weather.rainMmHr=100;
  const reopened=JSON.parse(JSON.stringify(bundle));
  reopened.result={survivingRatesMmHr:[2000]};
  assert.deepEqual(reopenEventChallenge(reopened).survivingRatesMmHr,[10]);
  reopened.challengeProject.observations[0].source='';
  assert.throws(()=>reopenEventChallenge(reopened),/source/);
});
