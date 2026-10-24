import test from 'node:test';
import assert from 'node:assert/strict';
import { makeExample, runRain, validateProject } from '../core.js';
import { appendOutletReading, compareOutletEvidence, cumulativeExitAt, predictCollectedVolume, OUTLET_WORK_LIMIT } from '../outlet-evidence.js';
import { outletContext } from '../outlet-evidence-contract.js';

function site() {
  const project = makeExample();
  project.width = 2; project.height = 2; project.selectedIndex = 0;
  project.existing = Array.from({length: 4}, () => ({elevationM: 0, surface: 'sealed', provenance: 'authored flat control'}));
  project.proposal = structuredClone(project.existing);
  project.weather = { ...project.weather, rainMmHr: 61, stormMinutes: 60, durationMinutes: 60,
    stepMinutes: 30, cellSizeM: 1, mobilityPerHour: 0, boundaryExitPerHour: 0.38 };
  return project;
}
const settings = {target: 'existing', eventRef: 'Authored arithmetic control, not a measured event',
  coverage: 'all-modeled-edges', collectionSource: 'Analytic total of all four cells, two exterior sides each', ratesPerHour: [0, 0.1, 0.2]};
const reading = {startMinute: 0, endMinute: 30, volume: 16, uncertainty: 0, unit: 'L',
  source: 'Authored analytic 4 × (30 + 10) × 0.1 × 0.5 × 2 = 16 L', use: 'calibration'};
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} versus ${expected}`);

test('matches independently calculated collected volumes and preserves mass', () => {
  const project = appendOutletReading(site(), settings, reading);
  const report = compareOutletEvidence(project);
  assert.equal(report.status, 'needs-challenge');
  assert.deepEqual(report.compatibleRatesPerHour, [0.1]);
  const candidate = report.candidates.find(c => c.ratePerHour === 0.1);
  close(candidate.calibration.errors[0].volumeLiters, 16);
  close(candidate.totalExitLiters, 42.4);
  close(report.candidates.find(c => c.ratePerHour === 0.2).totalExitLiters, 81.6);
  for (const c of report.candidates) close(c.massErrorLiters, 0);
});

test('subtracts cumulative endpoints and discloses off-step interpolation', () => {
  const p = site(); const result = runRain(p.existing, p.width, p.height, {...p.weather, boundaryExitPerHour: 0.1});
  close(cumulativeExitAt(result, 15).liters, 8);
  const middle = predictCollectedVolume(result, {startMinute: 15, endMinute: 45});
  close(middle.volumeLiters, 21.2);
  assert.deepEqual([middle.start.beforeMinute, middle.start.afterMinute, middle.end.beforeMinute, middle.end.afterMinute], [0, 30, 30, 60]);
  const a = predictCollectedVolume(result, {startMinute: 0, endMinute: 17});
  const b = predictCollectedVolume(result, {startMinute: 17, endMinute: 60});
  close(a.volumeLiters + b.volumeLiters, result.exitLiters);
  assert.throws(() => cumulativeExitAt(result, -1)); assert.throws(() => cumulativeExitAt(result, 61));
  assert.throws(() => predictCollectedVolume(result, {startMinute: 20, endMinute: 20}));
});

test('held-aside contradiction does not change calibration ordering or rescue a rejected candidate', () => {
  let p = appendOutletReading(site(), settings, reading);
  p = appendOutletReading(p, settings, {...reading, startMinute: 30, endMinute: 60, volume: 26.4, source: 'Authored independent second-interval arithmetic', use: 'challenge'});
  const supported = compareOutletEvidence(p);
  assert.equal(supported.status, 'one-survivor'); assert.deepEqual(supported.survivingRatesPerHour, [0.1]);
  p.outletEvidence.readings[1].volume = 49.6;
  const contradicted = compareOutletEvidence(p);
  assert.equal(contradicted.status, 'challenged'); assert.deepEqual(contradicted.survivingRatesPerHour, []);
  assert.deepEqual(contradicted.candidates.map(c => c.ratePerHour), supported.candidates.map(c => c.ratePerHour));
  assert.deepEqual(contradicted.candidates.map(c => c.calibration), supported.candidates.map(c => c.calibration));
  p.outletEvidence.readings[0].volume = 1e6;
  assert.equal(compareOutletEvidence(p).status, 'calibration-rejected');
});

test('dry observations preserve multiple explanations and unassigned evidence stays unscored', () => {
  const dry = site(); dry.weather.rainMmHr = 0;
  let p = appendOutletReading(dry, settings, {...reading, volume: 0});
  p = appendOutletReading(p, settings, {...reading, startMinute: 30, endMinute: 60, volume: 0, use: 'challenge'});
  const report = compareOutletEvidence(p);
  assert.equal(report.status, 'ambiguous'); assert.deepEqual(report.closestCalibrationRatesPerHour, [0, 0.1, 0.2]);
  assert.equal(report.survivingRatesPerHour.length, 3);
  p.outletEvidence.readings[0].use = 'unassigned'; p.outletEvidence.readings[0].volume = 1e9;
  const noFit = compareOutletEvidence(p); assert.equal(noFit.status, 'need-calibration');
  assert.deepEqual(noFit.candidates.map(c => c.ratePerHour), [0, 0.1, 0.2]);
  assert.equal(noFit.counts.ignored, 1); assert.equal(noFit.candidates[0].calibration.rmseLiters, null);
});

test('unit conversions, source details and roles survive ordinary project roundtrip', () => {
  const liters = appendOutletReading(site(), settings, reading);
  const milliliters = appendOutletReading(site(), settings, {...reading, volume: 16000, unit: 'mL'});
  const cubic = appendOutletReading(site(), settings, {...reading, volume: 0.016, unit: 'm3'});
  assert.deepEqual(compareOutletEvidence(liters), compareOutletEvidence(milliliters));
  assert.deepEqual(compareOutletEvidence(liters), compareOutletEvidence(cubic));
  const reopened = validateProject(JSON.parse(JSON.stringify(milliliters)));
  assert.deepEqual(reopened, milliliters); assert.equal(reopened.outletEvidence.readings[0].unit, 'mL');
});

test('records are bound to the observed scenario and event, without mutating input', () => {
  const input = site(), before = JSON.stringify(input);
  const p = appendOutletReading(input, settings, reading); const saved = JSON.stringify(p);
  compareOutletEvidence(p); assert.equal(JSON.stringify(input), before); assert.equal(JSON.stringify(p), saved);
  const unrelated = structuredClone(p); unrelated.title = 'A new title'; unrelated.proposal[0].elevationM = 1;
  assert.notEqual(compareOutletEvidence(unrelated).status, 'context-changed');
  const numerical = structuredClone(p); numerical.weather.stepMinutes = 15; numerical.weather.boundaryExitPerHour = 4;
  assert.notEqual(compareOutletEvidence(numerical).status, 'context-changed');
  const reordered = structuredClone(p); reordered.weather = Object.fromEntries(Object.entries(reordered.weather).reverse());
  assert.equal(outletContext(reordered, 'existing'), p.outletEvidence.contextJson);
  for (const mutate of [q => q.existing[0].elevationM = 1, q => q.weather.rainMmHr = 62,
    q => q.weather.cellSizeM = 2, q => q.source = 'another source', q => q.weather.durationMinutes = 90]) {
    const changed = structuredClone(p); mutate(changed); validateProject(changed);
    assert.equal(compareOutletEvidence(changed).status, 'context-changed');
    assert.throws(() => appendOutletReading(changed, settings, reading));
    assert.deepEqual(changed.outletEvidence, p.outletEvidence);
  }
  assert.throws(() => appendOutletReading(p, {...settings, eventRef: 'a different storm'}, reading));
  assert.throws(() => appendOutletReading(p, {...settings, target: 'proposal'}, reading));
});

test('invalid coverage, source, intervals, rates, quantities and record limits refuse atomically', () => {
  const input = site(), before = JSON.stringify(input);
  for (const bad of [{coverage: 'one-drain'}, {eventRef: ''}, {collectionSource: ' '},
    {ratesPerHour: [0.1, 0.1]}, {ratesPerHour: [0, 11]}]) {
    assert.throws(() => appendOutletReading(input, {...settings, ...bad}, reading));
  }
  for (const bad of [{source: ''}, {startMinute: -1}, {endMinute: 61}, {endMinute: 0},
    {unit: 'gallons'}, {volume: -1}, {uncertainty: NaN}, {volume: 1e13}, {use: 'inferred'}]) {
    assert.throws(() => appendOutletReading(input, settings, {...reading, ...bad}));
  }
  const p = appendOutletReading(input, settings, reading);
  p.outletEvidence.readings = Array.from({length: 80}, () => structuredClone(reading));
  assert.throws(() => appendOutletReading(p, settings, reading));
  assert.equal(p.outletEvidence.readings.length, 80); assert.equal(JSON.stringify(input), before);
  const badImport = structuredClone(p); badImport.outletEvidence.coverage = 'partial';
  assert.throws(() => validateProject(badImport));
});

test('work budget refuses before running an oversized candidate collection', () => {
  const p = site(); p.width = 24; p.height = 24;
  p.existing = Array.from({length: 576}, () => structuredClone(p.existing[0])); p.proposal = structuredClone(p.existing);
  p.weather.stepMinutes = 1; p.weather.durationMinutes = 720;
  const large = appendOutletReading(p, {...settings, ratesPerHour: [0,1,2,3,4,5,6,7,8]}, reading);
  const report = compareOutletEvidence(large);
  assert.equal(report.status, 'work-limit'); assert.equal(report.candidates.length, 0);
  assert.ok(report.cellSteps > OUTLET_WORK_LIMIT);
});
