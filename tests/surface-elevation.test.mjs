import test from 'node:test';
import assert from 'node:assert/strict';
import { makeExample, runRain, compare } from '../core.js';
import { compareSurfaceElevation, surfaceElevationEdits, compareProposalComponents,
  compareComponentHypotheses } from '../proposal-components.js';

const near = (a, b, tolerance = 1e-7) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);
function courtyard() {
  const p = makeExample(); p.proposal = structuredClone(p.existing);
  p.proposal[27].surface = 'garden'; p.proposal[27].elevationM -= 0.05;
  return p;
}
function direct(p, options = {}) {
  const surface = structuredClone(p.existing), elevation = structuredClone(p.proposal);
  surface.forEach((cell, i) => { cell.surface = p.proposal[i].surface; });
  elevation.forEach((cell, i) => { cell.surface = p.existing[i].surface; });
  return [p.existing, surface, elevation, p.proposal].map(cells =>
    runRain(cells, p.width, p.height, p.weather, options));
}

test('a single co-located intervention exposes opposed surface/grade effects and exact full-world results', () => {
  const p = courtyard(), before = JSON.stringify(p);
  assert.throws(() => compareProposalComponents(p, [27]), /remaining component/);
  const result = compareSurfaceElevation(p), ordinary = compare(p);
  assert.equal(result.partition, 'surface-elevation');
  assert.deepEqual(result.selectedIndices, [27]); assert.deepEqual(result.remainingIndices, [27]);
  const storage = result.metrics.find(m => m.key === 'storedLiters');
  near(storage.selectedEffect, -320.91526006458525);
  near(storage.remainingEffect, 75.46925154895348);
  near(storage.fullEffect, -249.99424139496318);
  near(storage.interaction, -4.548232879331408);
  for (const m of result.metrics) { near(m.existing, ordinary.existing[m.key]); near(m.full, ordinary.proposal[m.key]); }
  assert.equal(JSON.stringify(p), before);
});

test('immobile cells have an analytic surface effect but zero grade effect and interaction', () => {
  const p = courtyard(); p.width = p.height = 2; p.selectedIndex = 0;
  p.existing = Array.from({ length: 4 }, () => ({ elevationM: 0, surface: 'sealed', provenance: 'authored independent control' }));
  p.proposal = structuredClone(p.existing); p.proposal[0].surface = 'garden'; p.proposal[0].elevationM = -0.05;
  Object.assign(p.weather, { rainMmHr: 30, stormMinutes: 60, durationMinutes: 60,
    stepMinutes: 5, cellSizeM: 1, mobilityPerHour: 0, boundaryExitPerHour: 0 });
  const result = compareSurfaceElevation(p), storage = result.metrics.find(m => m.key === 'storedLiters');
  near(storage.existing, 116); near(storage.selected, 93); near(storage.remaining, 116); near(storage.full, 93);
  for (const m of result.metrics) { near(m.remainingEffect, 0); near(m.interaction, 0); }
});

test('overlapping and disjoint edited cells agree with independently assembled property worlds and volume closure', () => {
  const p = courtyard(); p.proposal[19].surface = 'garden'; p.proposal[35].elevationM += 0.02;
  const result = compareSurfaceElevation(p), runs = direct(p);
  assert.deepEqual(result.selectedIndices, [19, 27]); assert.deepEqual(result.remainingIndices, [27, 35]);
  for (const m of result.metrics) {
    for (const [i, key] of ['existing', 'selected', 'remaining', 'full'].entries()) near(m[key], runs[i][m.key]);
    near(m.fullEffect, m.selectedEffect + m.remainingEffect + m.interaction);
  }
  for (const b of Object.values(result.balances)) near(b.massErrorLiters, 0);
  near(result.metrics.filter(m => ['exitLiters', 'absorbedLiters', 'storedLiters'].includes(m.key)).reduce((sum, m) => sum + m.interaction, 0), 0);
  near(result.finalDepths.reduce((sum, cell) => sum + cell.interaction * p.weather.cellSizeM ** 2, 0),
    result.metrics.find(m => m.key === 'storedLiters').interaction);
});

test('supplied elevation records stay with their height and original evidence/provenance remain unchanged', () => {
  const p = courtyard();
  for (const target of ['existing', 'proposal']) p[target].forEach((cell, i) => {
    cell.terrainSource = { kind: 'supplied-elevation-table/1', fileName: `${target}.csv`, line: i + 2,
      datum: 'Authored common local datum', source: `${target} authored survey-format control`, unit: 'm',
      elevationValue: cell.elevationM, uncertaintyValue: 0.001, cellSizeM: p.weather.cellSizeM };
  });
  p.observations = [{ cellIndex: 27, minute: 60, depthMm: 20, uncertaintyMm: 2,
    source: 'Retained authored control reading', scenario: 'existing', use: 'calibration' }];
  const before = JSON.stringify(p), expected = direct(p);
  const result = compareSurfaceElevation(p);
  assert.equal(JSON.stringify(p), before);
  for (const m of result.metrics) { near(m.selected, expected[1][m.key]); near(m.remaining, expected[2][m.key]); }
});

test('unrepresented closed/crest changes refuse while unchanged edge states and source-only changes remain admissible', () => {
  const p = courtyard();
  p.existing[0].internalBarriers = { east: { crestElevationM: 0.2, source: 'existing authored crest' } };
  p.proposal[0].internalBarriers = { east: { crestElevationM: 0.2, source: 'same declared crest, another source' } };
  assert.equal(surfaceElevationEdits(p).barriersChanged, false);
  assert.doesNotThrow(() => compareSurfaceElevation(p));
  p.proposal[0].internalBarriers.east.crestElevationM = 0.21;
  assert.throws(() => compareSurfaceElevation(p), /unchanged internal edge/);
  assert.doesNotThrow(() => compareProposalComponents(p, [0]));
  p.proposal[0].internalBarriers.east = { closed: true, source: 'different barrier factor' };
  assert.throws(() => compareSurfaceElevation(p), /unchanged internal edge/);
});

test('property-factor hypotheses retain original full-proposal evidence and held-aside independence', () => {
  const p = courtyard(), study = { target: 'proposal', surface: 'sealed', ratesMmHr: [1, 9] };
  const predicted = study.ratesMmHr.map(rateMmHr => direct(p, { surfaceInfiltrationOverride: { surface: study.surface, rateMmHr } })[3].finalDepthMm[27]);
  p.observations = [{ cellIndex: 27, minute: 240, depthMm: predicted[0], uncertaintyMm: 24,
    source: 'Authored broad full-plan control', scenario: 'proposal', use: 'calibration' },
  { cellIndex: 27, minute: 240, depthMm: predicted[0], uncertaintyMm: 0.1,
    source: 'Authored held-aside control, not physical independence', scenario: 'proposal', use: 'challenge' }];
  const options = { study, subset: 'calibration', partition: 'surface-elevation' };
  const calibration = compareComponentHypotheses(p, undefined, options);
  assert.deepEqual(calibration.candidates.map(c => c.rateMmHr), [1, 9]);
  for (const candidate of calibration.candidates) {
    const expected = direct(p, { surfaceInfiltrationOverride: { surface: study.surface, rateMmHr: candidate.rateMmHr } });
    for (const m of candidate.result.metrics) near(m.interaction, expected[3][m.key] - expected[1][m.key] - expected[2][m.key] + expected[0][m.key]);
  }
  assert.deepEqual(compareComponentHypotheses(p, undefined, { ...options, subset: 'surviving' }).candidates.map(c => c.rateMmHr), [1]);
  p.observations[1].depthMm = predicted[1];
  assert.deepEqual(compareComponentHypotheses(p, undefined, options), calibration);
  assert.deepEqual(compareComponentHypotheses(p, undefined, { ...options, subset: 'surviving' }).candidates.map(c => c.rateMmHr), [9]);
});

test('no-op/single-factor requests and oversized computations are explicit refusals', () => {
  const p = makeExample();
  assert.throws(() => compareSurfaceElevation(p), /both a surface change and an elevation change/);
  p.proposal = structuredClone(p.existing); p.proposal[0].elevationM += 0.05;
  assert.throws(() => compareSurfaceElevation(p), /both a surface change and an elevation change/);
  p.proposal = structuredClone(p.existing);
  assert.throws(() => compareSurfaceElevation(p), /both a surface change and an elevation change/);
  const large = courtyard(); large.width = large.height = 24;
  large.existing = Array.from({ length: 576 }, () => ({ surface: 'sealed', elevationM: 0, provenance: 'authored budget control' }));
  large.proposal = structuredClone(large.existing); large.proposal[0].surface = 'garden'; large.proposal[0].elevationM = -0.05;
  Object.assign(large.weather, { durationMinutes: 720, stepMinutes: 1 });
  assert.throws(() => compareSurfaceElevation(large), /exceeds 1000000/);
  assert.throws(() => compareComponentHypotheses(large, undefined, { partition: 'surface-elevation' }), /combined cell-step budget/);
  assert.throws(() => compareComponentHypotheses(courtyard(), undefined, { partition: 'unknown' }), /Unknown component partition/);
});
