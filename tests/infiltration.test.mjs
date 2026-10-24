import test from 'node:test';
import assert from 'node:assert/strict';
import { makeExample, runRain, validateProject } from '../core.js';
import { compareInfiltration, interpolateDepth } from '../infiltration-study.js';
import { validateStudy } from '../study-contract.js';

const close = (a, b, tolerance = 1e-8) => assert.ok(Math.abs(a - b) <= tolerance, `${a} != ${b}`);
// Independent analytic oracle: isolated flat cells, rain 30 mm/h, one hour.
// For constant rate k < 30, depth(t) = (30-k) * t/60 mm.
function experiment() {
  const p = makeExample();
  p.width = 2; p.height = 2; p.selectedIndex = 0;
  p.existing = Array.from({ length: 4 }, () => ({ elevationM: 0, surface: 'turf', provenance: 'authored analytic fixture' }));
  p.proposal = structuredClone(p.existing);
  p.weather = { ...p.weather, rainMmHr: 30, stormMinutes: 60, durationMinutes: 60,
    stepMinutes: 5, cellSizeM: 2, mobilityPerHour: 0, boundaryExitPerHour: 0 };
  p.infiltrationStudy = { target: 'existing', surface: 'turf', ratesMmHr: [0, 10, 20] };
  p.observations = [
    { cellIndex: 0, minute: 30, depthMm: 10, uncertaintyMm: 0.01, source: 'analytic fixture A', scenario: 'existing', use: 'calibration' },
    { cellIndex: 1, minute: 60, depthMm: 20, uncertaintyMm: 0.01, source: 'analytic fixture B', scenario: 'existing', use: 'challenge' },
  ];
  return p;
}

test('analytic isolated-cell experiment distinguishes constant-rate hypotheses', () => {
  const result = compareInfiltration(experiment());
  assert.equal(result.status, 'one-survivor');
  assert.deepEqual(result.closestCalibrationRatesMmHr, [10]);
  assert.deepEqual(result.compatibleRatesMmHr, [10]);
  assert.deepEqual(result.survivingRatesMmHr, [10]);
  close(result.candidates[0].calibration.rmseMm, 0);
  close(result.candidates[0].challenge.rmseMm, 0);
  close(result.candidates[0].absorbedLiters, 10 * 4 * 4);
  close(result.candidates[0].storedLiters, 20 * 4 * 4);
});

test('held-aside contradictory reading challenges fit without changing calibration rank', () => {
  const p = experiment(), original = compareInfiltration(p);
  p.observations[1].depthMm = 0;
  const changed = compareInfiltration(p);
  assert.equal(changed.status, 'challenged');
  assert.deepEqual(changed.candidates.map(c => c.rateMmHr), original.candidates.map(c => c.rateMmHr));
  assert.deepEqual(changed.candidates.map(c => c.calibration), original.candidates.map(c => c.calibration));
  assert.deepEqual(changed.survivingRatesMmHr, []);
  assert.equal(changed.candidates[0].challenge.compatible, false);
});

test('unsupported calibration rejects every candidate instead of endorsing nearest fit', () => {
  const p = experiment(); p.observations[0].depthMm = 100;
  const r = compareInfiltration(p);
  assert.equal(r.status, 'calibration-rejected');
  assert.deepEqual(r.compatibleRatesMmHr, []);
  assert.deepEqual(r.closestCalibrationRatesMmHr, [0]);
});

test('dry-event readings cannot identify infiltration; tied alternatives remain', () => {
  const p = experiment(); p.weather.rainMmHr = 0;
  p.observations.forEach(o => { o.depthMm = 0; o.uncertaintyMm = 0; });
  const r = compareInfiltration(p);
  assert.equal(r.status, 'ambiguous');
  assert.deepEqual(r.closestCalibrationRatesMmHr, [0, 10, 20]);
  assert.deepEqual(r.survivingRatesMmHr, [0, 10, 20]);
});

test('no calibration cannot rank by challenge readings or suggest a fitted rate', () => {
  const p = experiment(); p.observations[0].use = 'challenge';
  const r = compareInfiltration(p);
  assert.equal(r.status, 'need-calibration');
  assert.deepEqual(r.closestCalibrationRatesMmHr, []);
  assert.deepEqual(r.compatibleRatesMmHr, []);
  assert.ok(r.candidates.every(c => c.calibration.rmseMm === null && c.calibration.compatible === null));
});

test('calibration without holdout is explicitly unchallenged', () => {
  const p = experiment(); p.observations.pop();
  assert.equal(compareInfiltration(p).status, 'needs-challenge');
});

test('legacy, notebook-only and other-scenario readings do not enter either score', () => {
  const p = experiment();
  p.observations.push({ cellIndex: 0, minute: 30, depthMm: 1000, uncertaintyMm: 0, source: 'legacy' });
  p.observations.push({ ...p.observations[0], depthMm: 900, use: 'unassigned' });
  p.observations.push({ ...p.observations[0], depthMm: 900, scenario: 'proposal' });
  const r = compareInfiltration(p);
  assert.deepEqual(r.counts, { calibration: 1, challenge: 1, ignored: 3, affectedCells: 4 });
  assert.deepEqual(r.closestCalibrationRatesMmHr, [10]);
});

test('off-step reading reports bracket and linearly interpolates rather than snapping', () => {
  const p = experiment();
  const run = runRain(p.existing, 2, 2, p.weather, { surfaceInfiltrationOverride: { surface: 'turf', rateMmHr: 10 } });
  const value = interpolateDepth(run, 0, 17.5);
  close(value.depthMm, 20 * 17.5 / 60);
  assert.equal(value.beforeMinute, 15); assert.equal(value.afterMinute, 20);
  assert.equal(value.method, 'linear interpolation');
  assert.equal(interpolateDepth(run, 0, 0).method, 'snapshot');
  close(interpolateDepth(run, 0, 60).depthMm, 20);
  for (const [index, minute] of [[-1, 0], [4, 0], [0, -1], [0, 61], [0, NaN]]) {
    assert.throws(() => interpolateDepth(run, index, minute), /outside/);
  }
});

test('compared off-step measurement uses explicit time and signed residual', () => {
  const p = experiment(); p.observations[0].minute = 17.5;
  p.observations[0].depthMm = 20 * 17.5 / 60;
  const r = compareInfiltration(p);
  assert.deepEqual(r.closestCalibrationRatesMmHr, [10]);
  const wrong = r.candidates.find(c => c.rateMmHr === 20);
  close(wrong.calibration.errors[0].residualMm, 10 * 17.5 / 60);
  assert.equal(wrong.calibration.errors[0].beforeMinute, 15);
});

test('equal calibration scores preserve all closest alternatives', () => {
  const p = experiment(); p.infiltrationStudy.ratesMmHr = [11, 9];
  const r = compareInfiltration(p);
  assert.deepEqual(r.closestCalibrationRatesMmHr, [9, 11]);
});

test('no target surface gives no candidate claim', () => {
  const p = experiment(); p.infiltrationStudy.surface = 'garden';
  const r = compareInfiltration(p);
  assert.equal(r.status, 'surface-absent'); assert.equal(r.candidates.length, 0);
});

test('measurement outside affected cells cannot identify rates without physical coupling', () => {
  const p = experiment(); p.existing[0].surface = 'sealed'; p.existing[1].surface = 'sealed';
  p.observations[0].depthMm = 14.5; p.observations[1].depthMm = 29;
  const r = compareInfiltration(p);
  assert.equal(r.status, 'ambiguous'); assert.equal(r.counts.affectedCells, 2);
  assert.equal(r.compatibleRatesMmHr.length, 3);
});

test('surface override affects matching cells and still conserves all water', () => {
  const p = experiment(); p.existing[0].surface = 'sealed';
  const before = JSON.stringify(p);
  for (const rateMmHr of [0, 10, 2000]) {
    const r = runRain(p.existing, 2, 2, p.weather, { surfaceInfiltrationOverride: { surface: 'turf', rateMmHr } });
    close(r.finalDepthMm[0], 29);
    close(r.finalDepthMm[1], Math.max(0, 30 - rateMmHr));
    close(r.massErrorLiters, 0);
    assert.ok(r.snapshots.every(s => s.depthsMm.every(d => d >= 0)));
  }
  assert.equal(JSON.stringify(p), before);
});

test('invalid candidate sets and roles reject on import rather than silently score', () => {
  for (const ratesMmHr of [[], [10], [10, 10], [0, NaN], [-1, 10], [1, Infinity], [0, 2001], [1, '2'], Array.from({ length: 10 }, (_, i) => i)]) {
    assert.throws(() => validateStudy({ target: 'existing', surface: 'turf', ratesMmHr }), /distinct/);
  }
  for (const patch of [{ scenario: 'other' }, { scenario: null }, { use: null }, { use: 'training' }, { scenario: 'unassigned', use: 'calibration' }]) {
    const p = experiment(); Object.assign(p.observations[0], patch);
    assert.throws(() => validateProject(p), /evidence role/);
  }
  for (const patch of [{ target: 'other' }, { surface: 'constructor' }]) {
    const p = experiment(); Object.assign(p.infiltrationStudy, patch);
    assert.throws(() => validateProject(p), /distinct/);
  }
});

test('invalid surface overrides and competing override scopes fail explicitly', () => {
  const p = experiment();
  for (const surfaceInfiltrationOverride of [null, { surface: 'constructor', rateMmHr: 1 }, { surface: 'turf', rateMmHr: Infinity }]) {
    assert.throws(() => runRain(p.existing, 2, 2, p.weather, { surfaceInfiltrationOverride }), /Invalid/);
  }
  assert.throws(() => runRain(p.existing, 2, 2, p.weather, {
    surfaceInfiltrationOverride: { surface: 'turf', rateMmHr: 10 },
    infiltrationOverride: { cellIndex: 1, rateMmHr: 9 },
  }), /one infiltration/);
});

test('comparison retains observed data and exact choices across portable JSON', () => {
  const p = experiment(), before = JSON.stringify(p);
  const result = compareInfiltration(p);
  assert.equal(JSON.stringify(p), before);
  const restored = validateProject(JSON.parse(before));
  assert.deepEqual(compareInfiltration(restored), result);
  assert.equal(JSON.stringify(restored), before);
});
