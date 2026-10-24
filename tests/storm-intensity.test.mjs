import test from 'node:test';
import assert from 'node:assert/strict';
import { makeExample, runRain, validateProject } from '../core.js';
import {
  compareStormIntensities, validateStormIntensities, summarizeStormDifferences,
  STORM_INTENSITY_METRICS, STORM_INTENSITY_WORK_LIMIT,
} from '../storm-intensity.js';

const close = (a, b, tolerance = 1e-7) =>
  assert.ok(Math.abs(a - b) < tolerance, `${a} differs from ${b}`);

test('the same rain is applied to both sites; each result matches the original solver', () => {
  const project = makeExample();
  const result = compareStormIntensities(project, [72, 0, 36]);
  assert.deepEqual(result.ratesMmHr, [0, 36, 72]);
  assert.equal(result.rows.length, 3);
  for (const row of result.rows) {
    const weather = { ...project.weather, rainMmHr: row.rainMmHr };
    const a = runRain(project.existing, project.width, project.height, weather);
    const b = runRain(project.proposal, project.width, project.height, weather);
    close(row.rainLiters, a.rainLiters);
    close(a.rainLiters, b.rainLiters);
    for (const [key] of STORM_INTENSITY_METRICS) {
      close(row.metrics[key].existing, a[key]);
      close(row.metrics[key].proposal, b[key]);
      close(row.metrics[key].delta, b[key] - a[key]);
    }
    close(row.massErrorLiters.existing, a.massErrorLiters);
    close(row.massErrorLiters.proposal, b.massErrorLiters);
    assert.ok(Math.abs(a.massErrorLiters) < 1e-6);
    assert.ok(Math.abs(b.massErrorLiters) < 1e-6);
  }
  assert.equal(result.rows[0].rainLiters, 0);
  assert.ok(result.rows[2].rainLiters > result.rows[1].rainLiters);
  assert.ok(result.cellSteps <= STORM_INTENSITY_WORK_LIMIT);
});

test('comparison preserves exact project, weather, notebook and current ordinary run', () => {
  const project = makeExample();
  project.observations.push({
    cellIndex: 4, minute: 60, depthMm: 2, uncertaintyMm: 1,
    source: 'authored fixture observation', scenario: 'existing', use: 'challenge',
  });
  validateProject(project);
  const before = JSON.stringify(project);
  const original = runRain(project.existing, project.width, project.height, project.weather);
  const result = compareStormIntensities(project, [12, 36, 72]);
  assert.equal(JSON.stringify(project), before);
  assert.equal(result.sourceSignature, before);
  const ordinary = runRain(project.existing, project.width, project.height, project.weather);
  assert.deepEqual(original, ordinary);
  assert.ok(result.rows.every(row => row.metrics.storedLiters));
});

test('identical geometries remain identical across dry and wet scenarios', () => {
  const project = makeExample();
  project.proposal = structuredClone(project.existing);
  const result = compareStormIntensities(project, [0, 1, 36, 250]);
  for (const row of result.rows) for (const [key] of STORM_INTENSITY_METRICS) {
    close(row.metrics[key].delta, 0);
  }
  for (const [key] of STORM_INTENSITY_METRICS) {
    assert.equal(result.findings[key].lower, 0);
    assert.equal(result.findings[key].higher, 0);
    assert.equal(result.findings[key].unchanged, 4);
  }
});

test('invalid rates, duplicate rates and numerical nonfinites refuse before running', () => {
  const project = makeExample();
  for (const bad of [
    null, undefined, '12,36', [], [36], [1, 2, 3, 4, 5, 6, 7, 8],
    [36, 36], [36, -1], [36, 251], [36, NaN], [36, Infinity],
    [36, -Infinity], [36, '72'], [0, 0],
  ]) assert.throws(() => compareStormIntensities(project, bad));
});

test('clear numerical-direction classification retains near-zero and mixed signs', () => {
  const mixed = summarizeStormDifferences([-2, 3, 0], [12, 12, 12]);
  assert.deepEqual([mixed.lower, mixed.higher, mixed.unchanged], [1, 1, 1]);
  assert.match(mixed.finding, /mixed/);
  const nearZero = summarizeStormDifferences([1e-8, -1e-8], [100, 100]);
  assert.equal(nearZero.unchanged, 2);
  assert.equal(summarizeStormDifferences([-2, 0], [2, 0]).higher, 0);
  assert.equal(summarizeStormDifferences([0, 2], [0, 2]).lower, 0);
  for (const [a, b] of [[[], []], [[NaN], [1]], [[2], []], [[1], [-1]]]) {
    assert.throws(() => summarizeStormDifferences(a, b));
  }
});

test('strict aggregate cell-step budget refuses expensive 24 x 24 grids', () => {
  const project = makeExample();
  project.width = 24;
  project.height = 24;
  project.existing = Array.from({length: 576}, () => ({
    elevationM: 0, surface: 'turf', provenance: 'authored',
  }));
  project.proposal = structuredClone(project.existing);
  project.selectedIndex = 0;
  project.weather = {...project.weather, stepMinutes: 1, durationMinutes: 720};
  validateProject(project);
  assert.throws(() => validateStormIntensities(project, [0, 36]), /cell-step budget/);
});

test('explicit future timeline is refused, not silently overridden', () => {
  const project = makeExample();
  project.weather.rainTimeline = [{minute: 0, rainMmHr: 22}];
  assert.throws(() => compareStormIntensities(project, [12, 36]), /constant-intensity storms only/);
  delete project.weather.rainTimeline;
  assert.equal(compareStormIntensities(project, [12, 36]).rows.length, 2);
});

test('changed source parameters change the signature and computed receiving', () => {
  const project = makeExample();
  const before = compareStormIntensities(project, [36, 72]);
  project.weather.boundaryExitPerHour = 0;
  const after = compareStormIntensities(project, [36, 72]);
  assert.notEqual(before.sourceSignature, after.sourceSignature);
  assert.notEqual(before.rows[1].metrics.exitLiters.existing, after.rows[1].metrics.exitLiters.existing);
});
