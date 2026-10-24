import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { advanceWettingFront, pondedInfiltration } from '../wetting-front.js';
import { makeExample, runRain, validateProject, SURFACES } from '../core.js';
import { compareWettingFront, serializeWettingFrontInvestigation,
  parseWettingFrontInvestigation } from '../wetting-front-study.js';
import { DEFAULT_WETTING_FRONT_STUDY, validateWettingFrontStudy } from '../wetting-front-contract.js';

const near = (actual, expected, tolerance = 1e-9) => assert.ok(
  Math.abs(actual - expected) <= tolerance, `${actual} != ${expected} within ${tolerance}`);
const step = changes => advanceWettingFront({ cumulativeMm: 0, surfaceWaterMm: 0,
  rainMmHr: 30, hours: 1, conductivityMmHr: 10, capillaryDriveMm: 20, ...changes });
function authored() {
  const p = makeExample();
  p.width = p.height = 2; p.selectedIndex = 0;
  p.existing = Array.from({ length: 4 }, () => ({ elevationM: 0, surface: 'turf', provenance: 'authored math control' }));
  p.proposal = structuredClone(p.existing); p.proposal[0].surface = 'garden';
  Object.assign(p.weather, { rainMmHr: 30, stormMinutes: 60, durationMinutes: 60,
    stepMinutes: 5, cellSizeM: 1, mobilityPerHour: 0, boundaryExitPerHour: 0 });
  p.wettingFrontStudy = { target: 'existing', surface: 'turf', basis: 'Authored mathematical control, not field observations',
    hypotheses: [{ conductivityMmHr: 10, capillaryDriveMm: 0 },
      { conductivityMmHr: 10, capillaryDriveMm: 20 }, { conductivityMmHr: 10, capillaryDriveMm: 60 }] };
  return p;
}

test('ponded integration agrees with independent 90-digit Decimal references including cancellation and singular start', () => {
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/wetting-front-reference.json', import.meta.url)));
  for (const row of fixture.cases) {
    const actual = pondedInfiltration(Number(row.initialMm), Number(row.conductivityMmHr),
      Number(row.capillaryDriveMm), Number(row.hours));
    const expected = Number(row.incrementMm);
    near(actual, expected, 3e-14 * Math.max(1e-12, expected));
  }
});

test('finite rainfall postpones ponding; a full-step ponded cap gives a different and incorrect amount', () => {
  near(step({ hours: 1 / 3 }).infiltratedMm, 10);
  near(step({}).infiltratedMm, 24.59527911156540265);
  assert.ok(pondedInfiltration(0, 10, 20, 1) - step({}).infiltratedMm > 2.5);
  near(step({ hours: 0.1 }).surfaceWaterMm, 0);
});

test('a pool can empty and re-form within one segment; initial storage is never counted as rain', () => {
  const depleted = step({ surfaceWaterMm: 2 });
  near(depleted.infiltratedMm, 25.79124324750122112);
  near(depleted.surfaceWaterMm, 32 - 25.79124324750122112);
  const staysPonded = step({ surfaceWaterMm: 10 });
  near(staysPonded.infiltratedMm, 27.15353347891798117);
  near(step({ surfaceWaterMm: 2, hours: 0.2 }).infiltratedMm, 8);
});

test('dry, impermeable, zero-drive, exhausted-pool and supply-limited boundaries preserve mass', () => {
  near(step({ rainMmHr: 0 }).infiltratedMm, 0);
  near(step({ conductivityMmHr: 0 }).surfaceWaterMm, 30);
  near(step({ capillaryDriveMm: 0 }).infiltratedMm, 10);
  near(step({ rainMmHr: 5, surfaceWaterMm: 2 }).infiltratedMm, 7);
  near(step({ rainMmHr: 0, surfaceWaterMm: 2 }).infiltratedMm, 2);
  near(step({ rainMmHr: 10, surfaceWaterMm: 0 }).infiltratedMm, 10);
  assert.deepEqual(step({ hours: 0, surfaceWaterMm: 7 }),
    { infiltratedMm: 0, cumulativeMm: 0, surfaceWaterMm: 7 });
});

test('constant-rain time subdivision preserves the local solution through 500 changed-input transition cases', () => {
  let seed = 1821329;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
  for (let index = 0; index < 500; index++) {
    const input = { cumulativeMm: random() * 60, surfaceWaterMm: random() * 30,
      rainMmHr: random() * 200, hours: random() * 2,
      conductivityMmHr: random() * 80, capillaryDriveMm: random() * 150 };
    if (index % 3 === 0) input.surfaceWaterMm = 0;
    if (index % 5 === 0) input.cumulativeMm = 0;
    const whole = advanceWettingFront(input);
    let F = input.cumulativeMm, W = input.surfaceWaterMm;
    for (let part = 0; part < 17; part++) {
      const result = advanceWettingFront({ ...input, hours: input.hours / 17, cumulativeMm: F, surfaceWaterMm: W });
      F = result.cumulativeMm; W = result.surfaceWaterMm;
    }
    near(F, whole.cumulativeMm, 1e-9);
    near(W, whole.surfaceWaterMm, 1e-9);
    near(whole.infiltratedMm + whole.surfaceWaterMm,
      input.surfaceWaterMm + input.rainMmHr * input.hours, 1e-10);
  }
});

test('invalid numerical inputs are refused before a nonfinite or negative state is created', () => {
  for (const key of ['cumulativeMm', 'surfaceWaterMm', 'rainMmHr', 'hours', 'conductivityMmHr', 'capillaryDriveMm']) {
    for (const value of [-1, NaN, Infinity, '10', null]) assert.throws(() => step({ [key]: value }));
  }
  assert.throws(() => step({ hours: 13 }), /bounds/);
});

test('actual maintained runoff reproduces analytic ponding, including nonaligned storm end', () => {
  const p = authored(), model = { surface: 'turf', conductivityMmHr: 10, capillaryDriveMm: 20 };
  const result = runRain(p.existing, 2, 2, p.weather, { surfaceWettingFront: model });
  for (const depth of result.finalDepthMm) near(depth, 5.40472088843459735);
  near(result.absorbedLiters, 4 * 24.59527911156540265);
  near(result.massErrorLiters, 0);
  const weather = { ...p.weather, stormMinutes: 23.4, durationMinutes: 61.3, stepMinutes: 7.2 };
  const wet = step({ hours: 23.4 / 60 });
  const dry = step({ rainMmHr: 0, cumulativeMm: wet.cumulativeMm,
    surfaceWaterMm: wet.surfaceWaterMm, hours: (61.3 - 23.4) / 60 });
  const split = runRain(p.existing, 2, 2, weather, { surfaceWettingFront: model });
  split.finalDepthMm.forEach(depth => near(depth, dry.surfaceWaterMm));
  near(split.rainLiters, 4 * 30 * 23.4 / 60);
  near(split.massErrorLiters, 0);
});

test('routing, internal walls, local budgets and passive traces consume the same accepted absorption', () => {
  const p = makeExample();
  p.existing[0].internalBarriers = { east: { closed: true, source: 'authored wall' } };
  const options = { surfaceWettingFront: { surface: 'turf', conductivityMmHr: 7, capillaryDriveMm: 40 },
    traceBudget: true, rainTrace: { sourceCells: [0, 9, 27], captureSteps: true } };
  const before = structuredClone(p);
  const result = runRain(p.existing, p.width, p.height, p.weather, options);
  near(result.massErrorLiters, 0, 1e-8);
  near(result.rainTrace.massErrorLiters, 0, 1e-8);
  for (const cell of result.waterBudget.cells) near(cell.balanceErrorLiters, 0, 1e-8);
  for (const snapshot of result.rainTrace.snapshots) near(snapshot.massErrorLiters, 0, 1e-8);
  result.wettingFront.cumulativeInfiltrationMm.forEach((depth, index) => {
    if (p.existing[index].surface === 'turf') near(depth * p.weather.cellSizeM ** 2, result.waterBudget.cells[index].absorbedLiters);
    else assert.equal(depth, null);
  });
  assert.deepEqual(p, before);
});

test('zero-drive variant matches constant-rate consumer and cannot conflict with another override', () => {
  const p = makeExample();
  const constant = runRain(p.existing, p.width, p.height, p.weather,
    { surfaceInfiltrationOverride: { surface: 'turf', rateMmHr: 9 } });
  const model = runRain(p.existing, p.width, p.height, p.weather,
    { surfaceWettingFront: { surface: 'turf', conductivityMmHr: 9, capillaryDriveMm: 0 } });
  model.finalDepthMm.forEach((depth, index) => near(depth, constant.finalDepthMm[index]));
  near(model.absorbedLiters, constant.absorbedLiters, 1e-8);
  assert.throws(() => runRain(p.existing, p.width, p.height, p.weather,
    { surfaceWettingFront: { surface: 'turf', conductivityMmHr: 9, capillaryDriveMm: 1 },
      infiltrationOverride: { cellIndex: 0, rateMmHr: 1 } }), /one infiltration/);
});

test('reverse rainfall origins agree with independently propagated forward tags under wetting-front absorption', () => {
  const p = authored();
  p.existing[0].elevationM = 0.2; p.existing[1].surface = 'garden';
  Object.assign(p.weather, { mobilityPerHour: 2, boundaryExitPerHour: 0.7, stepMinutes: 7, stormMinutes: 23.4 });
  const surfaceWettingFront = { surface: 'turf', conductivityMmHr: 7, capillaryDriveMm: 30 };
  const fateArrays = { stored: 'storedByCellLiters', absorbed: 'absorbedByCellLiters', exit: 'exitByCellLiters' };
  for (const [fate, key] of Object.entries(fateArrays)) {
    const reverse = runRain(p.existing, 2, 2, p.weather,
      { surfaceWettingFront, rainOrigins: { targetCells: [1, 3], fate } }).rainOrigins;
    for (let source = 0; source < 4; source++) {
      const forward = runRain(p.existing, 2, 2, p.weather,
        { surfaceWettingFront, rainTrace: { sourceCells: [source] } }).rainTrace;
      near(reverse.bySourceLiters[source], forward[key][1] + forward[key][3], 1e-9);
    }
    near(reverse.balanceErrorLiters, 0, 1e-9);
  }
});

test('extra hypothesis properties cannot overwrite actual rain, elapsed time or cumulative water state', () => {
  const p = authored(), model = { surface: 'turf', conductivityMmHr: 10, capillaryDriveMm: 20 };
  const clean = runRain(p.existing, 2, 2, p.weather, { surfaceWettingFront: model });
  const injected = runRain(p.existing, 2, 2, p.weather, { surfaceWettingFront: { ...model,
    hours: 12, rainMmHr: 0, cumulativeMm: 5000, surfaceWaterMm: 5000 } });
  assert.deepEqual(injected, clean);
});

test('separating authored observations select a mechanism; held-aside changes do not alter calibration ordering', () => {
  const p = authored();
  p.observations = [
    { cellIndex: 0, minute: 20, depthMm: 0, uncertaintyMm: 1e-8, scenario: 'existing', use: 'calibration', source: 'Analytic authored onset control' },
    { cellIndex: 0, minute: 60, depthMm: 5.40472088843459735, uncertaintyMm: 1e-8,
      scenario: 'existing', use: 'challenge', source: 'Independent Decimal authored control' },
  ];
  const before = structuredClone(p), report = compareWettingFront(p);
  assert.deepEqual(report.compatibleIds, [2, 3]);
  assert.deepEqual(report.survivingIds, [2]);
  assert.equal(report.status, 'one-survivor');
  assert.equal(report.baseline.calibration.compatible, false);
  assert.deepEqual(p, before);
  const changed = structuredClone(p); changed.observations[1].depthMm = 200;
  const challenged = compareWettingFront(changed);
  assert.deepEqual(challenged.candidates.map(row => row.id), report.candidates.map(row => row.id));
  assert.deepEqual(challenged.candidates.map(row => row.calibration), report.candidates.map(row => row.calibration));
  assert.equal(challenged.status, 'challenged');
});

test('dry observations leave parameter alternatives ambiguous; absent surface cannot identify parameters', () => {
  const p = authored(); p.weather.rainMmHr = 0;
  p.observations = ['calibration', 'challenge'].map((use, index) => ({
    cellIndex: 0, minute: 30 + 30 * index, depthMm: 0, uncertaintyMm: 0,
    scenario: 'existing', use, source: 'Authored dry control' }));
  const report = compareWettingFront(p);
  assert.equal(report.status, 'ambiguous'); assert.deepEqual(report.survivingIds, [1, 2, 3]);
  p.wettingFrontStudy.surface = 'sealed';
  const absent = compareWettingFront(p);
  assert.equal(absent.status, 'surface-absent'); assert.deepEqual(absent.compatibleIds, []);
  assert.deepEqual(absent.survivingIds, []);
});

test('complete matched geometry, equal rain, observation roles and source inputs survive input-only replay', () => {
  const p = authored();
  p.observations.push({ cellIndex: 0, minute: 20, depthMm: 0, uncertaintyMm: 1,
    scenario: 'proposal', use: 'calibration', source: '<img src=x onerror=alert(1)>' });
  const original = structuredClone(p), text = serializeWettingFrontInvestigation(p);
  const reopened = parseWettingFrontInvestigation(text);
  assert.deepEqual(reopened.project, p); assert.deepEqual(reopened.study, p.wettingFrontStudy);
  assert.deepEqual(compareWettingFront(reopened.project, reopened.study), compareWettingFront(p));
  assert.equal(compareWettingFront(p).counts.ignored, 1);
  assert.deepEqual(p, original);
  for (const row of compareWettingFront(p).candidates) {
    assert.equal(row.existing.rainLiters, row.proposal.rainLiters);
    near(row.change.storedLiters, row.proposal.storedLiters - row.existing.storedLiters);
  }
  const forged = JSON.parse(text); forged.results = { oneTrueSoil: 2 };
  assert.throws(() => parseWettingFrontInvestigation(JSON.stringify(forged)), /conclusions/);
});

test('bounded declarations and aggregate work are admitted before simulations or imports', () => {
  const p = authored();
  const duplicate = structuredClone(p.wettingFrontStudy);
  duplicate.hypotheses.push(duplicate.hypotheses[0]);
  assert.throws(() => validateWettingFrontStudy(duplicate, SURFACES), /distinct/);
  for (const value of [null, {}, { ...DEFAULT_WETTING_FRONT_STUDY, basis: '' },
    { ...DEFAULT_WETTING_FRONT_STUDY, hypotheses: [{ conductivityMmHr: 1, capillaryDriveMm: 2 }] }]) {
    assert.throws(() => validateProject({ ...p, wettingFrontStudy: value }));
  }
  p.width = p.height = 24;
  p.existing = Array.from({ length: 576 }, () => ({ ...p.existing[0] }));
  p.proposal = structuredClone(p.existing);
  Object.assign(p.weather, { durationMinutes: 720, stepMinutes: 1 });
  assert.throws(() => compareWettingFront(p), /cell-steps/);
  assert.throws(() => serializeWettingFrontInvestigation(p), /cell-steps/);
  assert.throws(() => parseWettingFrontInvestigation(' '.repeat(5 * 1024 * 1024 + 1)), /file limit/);
});
