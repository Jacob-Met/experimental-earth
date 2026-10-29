import test from 'node:test';
import assert from 'node:assert/strict';
import { makeExample, runRain, runPressureHeadRain, SURFACES } from '../core.js';
import { comparePressureHead, serializePressureHeadInvestigation,
  parsePressureHeadInvestigation, PRESSURE_HEAD_FILE_LIMIT } from '../pressure-head-study.js';
import { validatePressureHeadModel, validatePressureHeadStudy,
  PRESSURE_HEAD_MODEL_SCHEMA, PRESSURE_HEAD_STUDY_SCHEMA } from '../pressure-head-contract.js';
import { parseWettingFrontInvestigation } from '../wetting-front-study.js';

const near = (actual, expected, message = '') => assert.ok(Number.isFinite(actual) &&
  Math.abs(actual - expected) <= 1e-8, `${message}: ${actual} differs from ${expected}`);
function authored(width = 2) {
  const project = makeExample();
  project.width = project.height = width; project.selectedIndex = 0;
  project.existing = Array.from({ length: width * width }, () => ({
    elevationM: 0, surface: 'turf', provenance: 'Authored analytical control, not field data' }));
  project.proposal = structuredClone(project.existing); project.observations = [];
  Object.assign(project.weather, { rainMmHr: 60, stormMinutes: 60, durationMinutes: 60,
    stepMinutes: 7, cellSizeM: 1, mobilityPerHour: 0, boundaryExitPerHour: 0 });
  return project;
}
const model = (conductivityMmHr = 10, capillaryDriveMm = 0, moistureDeficit = .3) => ({
  schema: PRESSURE_HEAD_MODEL_SCHEMA, surface: 'turf', conductivityMmHr, capillaryDriveMm, moistureDeficit });
const study = () => ({ schema: PRESSURE_HEAD_STUDY_SCHEMA, target: 'existing', surface: 'turf',
  basis: 'Authored mathematical controls; deficit is declared independently of A.',
  hypotheses: [0, .3, 1].map(moistureDeficit => ({ conductivityMmHr: 10, capillaryDriveMm: 0, moistureDeficit })) });
const closedStore = { schema: 'experimental-earth-closed-infiltration-store/1', surface: 'turf',
  remainingCapacityMm: 4, source: 'Explicit authored receiving capacity; not rooted-water storage' };
function run(project, declaration, options) {
  return runPressureHeadRain(project.existing, project.width, project.height, project.weather, declaration, options);
}

test('216 closed-cell courses match the independent dry-start constant-rain analytical solution', () => {
  let count = 0;
  for (const K of [0, 1, 10, 100]) for (const R of [0, 5, 60]) for (const deficit of [0, .3, 1])
    for (const duration of [30, 60]) for (const interval of [1, 7, 30]) {
      const project = authored(); Object.assign(project.weather, { rainMmHr: R,
        stormMinutes: duration, durationMinutes: duration, stepMinutes: interval });
      const before = JSON.stringify(project), result = run(project, model(K, 0, deficit), { traceBudget: true });
      // With A=0, dry initial state and continuous rain, F=lambda*t while ponded.
      // lambda solves lambda^2 - K(1-deficit)*lambda - K*deficit*R=0.
      const a = K * (1 - deficit), lambda = (a + Math.sqrt(a * a + 4 * K * deficit * R)) / 2;
      const F = Math.min(R, lambda) * duration / 60, W = R * duration / 60 - F;
      near(result.rainLiters, 4 * R * duration / 60, 'rain');
      near(result.absorbedLiters, 4 * F, 'absorbed'); near(result.storedLiters, 4 * W, 'standing');
      near(result.exitLiters, 0, 'closed boundary'); near(result.massErrorLiters, 0, 'whole budget');
      for (let i = 0; i < 4; i++) {
        near(result.pressureHead.cumulativeInfiltrationMm[i], F, 'front');
        near(result.finalDepthMm[i], W, 'depth'); near(result.waterBudget.cells[i].balanceErrorLiters, 0, 'local budget');
      }
      assert.equal(JSON.stringify(project), before); count++;
    }
  assert.equal(count, 216);
});

test('nine partial-storm courses match the independent beta=1 falling-head square-root solution', () => {
  let count = 0;
  for (const K of [1, 10, 50]) for (const stepMinutes of [1, 7, 30]) {
    const project = authored(); Object.assign(project.weather, { stormMinutes: 19, durationMinutes: 37, stepMinutes });
    const result = run(project, model(K, 0, 1));
    const wetF = Math.sqrt(K * 60) * 19 / 60;
    const finalF = Math.min(19, Math.sqrt(wetF * wetF + 2 * K * 19 * 18 / 60));
    near(result.absorbedLiters, 4 * finalF, 'rain followed by falling head');
    near(result.storedLiters, 4 * (19 - finalF), 'remaining water'); near(result.massErrorLiters, 0);
    count++;
  }
  assert.equal(count, 9);
});

test('accepted infiltration alone advances the front under a closed store; local budgets and passive tracing agree', () => {
  for (const deficit of [0, .3, 1]) {
    const project = authored(), result = run(project, model(10, 0, deficit), {
      infiltrationStorage: closedStore, traceBudget: true,
      rainTrace: { sourceCells: [0], captureSteps: true } });
    near(result.absorbedLiters, 16); near(result.storedLiters, 224); near(result.massErrorLiters, 0);
    assert.deepEqual(result.pressureHead.cumulativeInfiltrationMm, [4, 4, 4, 4]);
    assert.deepEqual(result.infiltrationStorage.retainedMm, [4, 4, 4, 4]);
    for (const cell of result.waterBudget.cells) near(cell.balanceErrorLiters, 0);
    near(result.rainTrace.massErrorLiters, 0); near(result.rainTrace.absorbedLiters, 4);
  }
});

test('calibration alone orders hypotheses; held-aside readings challenge without changing rank or inputs', () => {
  const project = authored(), declared = study();
  const depth = minute => (60 - Math.sqrt(600)) * minute / 60;
  project.observations = [
    { cellIndex: 0, minute: 30, depthMm: depth(30), uncertaintyMm: .05,
      scenario: 'existing', use: 'calibration', source: '<b>Authored exact analytical control</b>' },
    { cellIndex: 0, minute: 60, depthMm: depth(60), uncertaintyMm: .05,
      scenario: 'existing', use: 'challenge', source: 'Authored held-aside analytical value; not field data' },
  ];
  const before = JSON.stringify({ project, declared }), result = comparePressureHead(project, declared);
  assert.deepEqual(result.candidates.map(row => row.id), [3, 2, 1]);
  assert.deepEqual(result.compatibleIds, [3]); assert.deepEqual(result.survivingIds, [3]);
  assert.equal(result.status, 'one-survivor'); assert.equal(JSON.stringify({ project, declared }), before);
  const changed = structuredClone(project); changed.observations[1].depthMm = 50;
  const challenged = comparePressureHead(changed, declared);
  assert.deepEqual(challenged.candidates.map(row => row.id), [3, 2, 1]);
  assert.deepEqual(challenged.compatibleIds, [3]); assert.deepEqual(challenged.survivingIds, []);
  assert.equal(challenged.status, 'challenged');
  const absent = comparePressureHead(project, { ...declared, surface: 'garden' });
  assert.equal(absent.status, 'surface-absent'); assert.deepEqual(absent.compatibleIds, []); assert.deepEqual(absent.survivingIds, []);
  const noReadings = comparePressureHead(authored(), declared);
  assert.equal(noReadings.status, 'need-calibration'); assert.deepEqual(noReadings.compatibleIds, []);
  assert.deepEqual(noReadings.survivingIds, []);
  const text = serializePressureHeadInvestigation(project, declared), reopened = parsePressureHeadInvestigation(text);
  assert.deepEqual(Object.keys(reopened), ['schema', 'project', 'study']);
  assert.deepEqual(reopened.project, project); assert.deepEqual(reopened.study, declared);
  assert.deepEqual(comparePressureHead(reopened.project, reopened.study), result);
  assert.equal(result.sourceSignature, JSON.stringify({ project, study: declared }));
});

test('strict explicit model, study and file admission refuses missing or inherited assumptions and incompatible routes', () => {
  const project = authored(), declared = study(), valid = model();
  for (const key of ['conductivityMmHr', 'capillaryDriveMm', 'moistureDeficit']) {
    const missing = { ...valid }; delete missing[key]; assert.throws(() => run(project, missing));
  }
  for (const moistureDeficit of [-.1, 1.1, '0.3', null, NaN, Infinity])
    assert.throws(() => run(project, { ...valid, moistureDeficit }));
  assert.throws(() => run(project, undefined), /Declare a pressure-head model/);
  assert.throws(() => run(project, undefined, { surfacePressureHead: valid }), /Declare a pressure-head model/);
  assert.throws(() => validatePressureHeadModel(Object.create(valid), SURFACES));
  assert.throws(() => validatePressureHeadModel({ ...valid, surface: new String('turf') }, SURFACES));
  assert.throws(() => validatePressureHeadStudy(Object.create(declared), SURFACES));
  assert.throws(() => validatePressureHeadStudy({ ...declared,
    hypotheses: [Object.create(declared.hypotheses[0]), declared.hypotheses[1]] }, SURFACES));
  assert.throws(() => comparePressureHead(project, { ...declared, basis: '   ' }));
  assert.throws(() => comparePressureHead(project, { ...declared, verdict: 'winner' }));
  assert.throws(() => comparePressureHead(project, { ...declared, hypotheses: [declared.hypotheses[0], declared.hypotheses[0]] }));
  const text = serializePressureHeadInvestigation(project, declared), bundle = JSON.parse(text);
  assert.throws(() => parsePressureHeadInvestigation(JSON.stringify({ ...bundle, results: { winner: 1 } })), /saved conclusions/);
  assert.throws(() => parsePressureHeadInvestigation(JSON.stringify({ ...bundle, schema: 'experimental-earth-pressure-head-investigation/2' })));
  assert.throws(() => parseWettingFrontInvestigation(text));
  assert.throws(() => parsePressureHeadInvestigation(' '.repeat(PRESSURE_HEAD_FILE_LIMIT + 1)), /5 MiB/);
  assert.throws(() => runRain(project.existing, 2, 2, project.weather, { surfaceWettingFront: valid }));
  const legacy = { surface: 'turf', conductivityMmHr: 10, capillaryDriveMm: 0 };
  assert.throws(() => run(project, valid, { surfaceWettingFront: legacy }), /separately/);
  assert.throws(() => run(project, valid, { surfaceInfiltrationOverride: { surface: 'turf', rateMmHr: 10 } }), /separately/);
  assert.throws(() => run(project, valid, { infiltrationOverride: { cellIndex: 0, rateMmHr: 10 } }), /separately/);
  const large = authored(24); Object.assign(large.weather, { stormMinutes: 720, durationMinutes: 720, stepMinutes: 1 });
  const many = { ...declared, hypotheses: Array.from({ length: 9 }, (_, i) => ({
    conductivityMmHr: i + 1, capillaryDriveMm: 20, moistureDeficit: .3 })) };
  assert.throws(() => comparePressureHead(large, many), /one million cell-steps/);
});
