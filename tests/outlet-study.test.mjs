import test from 'node:test';
import assert from 'node:assert/strict';
import { makeExample, runRain } from '../core.js';
import { defaultOutletRates, compareOutletScenarios, validateOutletRates } from '../outlet-study.js';

const close = (a, b, tolerance = 1e-6) =>
  assert.ok(Math.abs(a - b) <= tolerance, String(a) + ' differs from ' + String(b));

test('defaults contain the authored outlet coefficient without duplicate hypotheses', () => {
  assert.deepEqual(defaultOutletRates({boundaryExitPerHour: 0.38}), [0, 0.38, 2]);
  assert.deepEqual(defaultOutletRates({boundaryExitPerHour: 0}), [0, 2, 5]);
  assert.deepEqual(defaultOutletRates({boundaryExitPerHour: 2}), [0, 2, 5]);
});

test('paired outlet hypotheses preserve the project and rain balance', () => {
  const project = makeExample();
  const original = JSON.stringify(project);
  const compared = compareOutletScenarios(project);
  assert.equal(compared.candidateCount, 3);
  assert.equal(compared.authoredRatePerHour, 0.38);
  assert.equal(compared.status, 'compared');
  assert.equal(JSON.stringify(project), original);
  assert.deepEqual(compared, compareOutletScenarios(project));
  let previousOutflow = -1;
  for (const c of compared.candidates) {
    close(c.rainLiters.existing, c.rainLiters.proposal);
    for (const name of ['existing', 'proposal'])
      assert.ok(Math.abs(c.massErrorLiters[name]) <= 1e-6);
    const r = runRain(project.existing, project.width, project.height,
      {...project.weather, boundaryExitPerHour: c.ratePerHour});
    close(r.exitLiters, c.metrics.exitLiters.existing);
    if (previousOutflow >= 0) assert.ok(r.exitLiters >= previousOutflow - 1e-6);
    previousOutflow = r.exitLiters;
  }
  assert.ok(compared.candidates.at(-1).metrics.peakPondingLiters.existing <
    compared.candidates[0].metrics.peakPondingLiters.existing);
});

test('a dry modeled event offers no invented difference or observation', () => {
  const p = makeExample(); p.weather.rainMmHr = 0;
  const result = compareOutletScenarios(p, { ratesPerHour: [0, 10] });
  for (const c of result.candidates)
    for (const m of Object.values(c.metrics)) close(m.delta, 0);
  assert.equal(result.potentiallyWorseCells.length, 0);
  for (const m of Object.values(result.metrics)) assert.equal(m.direction, 'unchanged');
});

test('closed boundary produces no outgoing water, while open boundary changes accumulation', () => {
  const p = makeExample();
  p.width = 2; p.height = 2; p.selectedIndex = 0;
  p.existing = Array.from({length: 4}, () => ({ elevationM: 0, surface: 'sealed', provenance: 'authored' }));
  p.proposal = structuredClone(p.existing);
  p.weather = { ...p.weather, rainMmHr: 60, stormMinutes: 60, durationMinutes: 60,
    mobilityPerHour: 0, cellSizeM: 1 };
  const r = compareOutletScenarios(p, {ratesPerHour:[0, 2]});
  close(r.candidates[0].metrics.exitLiters.existing, 0);
  assert.ok(r.candidates[1].metrics.exitLiters.existing > 0);
  assert.ok(r.candidates[1].metrics.storedLiters.existing <
    r.candidates[0].metrics.storedLiters.existing);
  assert.ok(r.candidates.every(c => c.metrics.storedLiters.delta === 0));
});

test('outlet inputs and computational budget reject invalid or ambiguous comparisons', () => {
  for (const values of [[],[1],[0,0],[0,Infinity],[0,-1],[0,11], [0, '2'],
    [0,1,2,3,4,5,6,7]]) {
    assert.throws(() => validateOutletRates(values), /2–7 distinct/);
  }
  const p = makeExample();
  assert.throws(() => compareOutletScenarios(p, {ratesPerHour:[0,0]}), /2–7 distinct/);
  p.width=24; p.height=24; p.selectedIndex=0;
  p.existing = Array.from({length:576},(_,i) => ({...p.existing[i%48]}));
  p.proposal = Array.from({length:576},(_,i) => ({...p.proposal[i%48]}));
  p.weather = {...p.weather, durationMinutes:720, stormMinutes:720, stepMinutes:1};
  assert.throws(() => compareOutletScenarios(p, {ratesPerHour:[0,1,2,3,4,5,6]}), /cell-step budget/);
});


test('authored grade-and-garden choice reverses peak ponding effect across outlet assumptions', () => {
  const p = makeExample();
  p.width = p.height = 2; p.selectedIndex = 0;
  const mk = (elevationM, surface) => ({elevationM, surface, provenance:'authored hypothetical control'});
  p.existing = [mk(-0.03,'turf'),mk(-0.03,'turf'),mk(-0.03,'sealed'),mk(0.08,'garden')];
  p.proposal = [mk(0,'turf'),mk(-0.03,'turf'),mk(0,'garden'),mk(0.08,'garden')];
  p.weather = {...p.weather, rainMmHr:48, stormMinutes:60, durationMinutes:120,
    stepMinutes:5, cellSizeM:1, mobilityPerHour:3};
  const report = compareOutletScenarios(p, {ratesPerHour:[0,0.6,5]});
  assert.equal(report.metrics.peakPondingLiters.direction, 'reverses');
  const changes = report.candidates.map(c=>c.metrics.peakPondingLiters.delta);
  assert.ok(changes.some(d=>d<-1), JSON.stringify(changes));
  assert.ok(changes.some(d=>d>1), JSON.stringify(changes));
  assert.equal(report.metrics.maxDepthMm.direction, 'higher');
  assert.ok(report.potentiallyWorseCells.length>0);
  for(const c of report.candidates) {
    close(c.rainLiters.existing, c.rainLiters.proposal);
    assert.ok(Math.abs(c.massErrorLiters.existing)<1e-6);
    assert.ok(Math.abs(c.massErrorLiters.proposal)<1e-6);
  }
});
