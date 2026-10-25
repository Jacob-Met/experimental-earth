import test from 'node:test';
import assert from 'node:assert/strict';
import {makeExample, runRain, interpolateDepth} from '../core.js';
import {compareIntervention, createInterventionBatch} from '../intervention-study.js';
const study = {target: 'existing', surface: 'sealed', ratesMmHr: [.2, 1, 4]};
const settings = {study, subset: 'all', allowAbsentSurface: true};

test('one batch preserves every paired result across distinct proposals, rates and exposure requests', () => {
  const p = makeExample(), source = structuredClone(p), compare = createInterventionBatch();
  for (const surface of ['sealed', 'turf', 'garden']) for (const index of [0, 12, 27, 47]) {
    const variant = structuredClone(p);
    variant.proposal[index].surface = surface;
    const options = {...settings, study: {...study, surface},
      exposureRequest: {thresholdMm: index + 1, cellIndices: [0, 27, 47]}};
    assert.deepEqual(compare(variant, options), compareIntervention(variant, options));
  }
  assert.deepEqual(p, source);
});
test('edits to the same source objects, grid dimensions and weather invalidate retained runs', () => {
  const p = makeExample(), compare = createInterventionBatch();
  compare(p, settings);
  const changes = [
    () => {p.existing[0].elevationM += .1;},
    () => {p.existing[1].surface = 'garden';},
    () => {p.existing[0].internalBarriers = {east: {closed: true, source: 'Changed wall'}};},
    () => {p.existing[0].internalBarriers.east = {crestElevationM: .2, source: 'Changed finite crest'};},
    () => {p.weather.rainMmHr = 103;},
    () => {p.weather.stepMinutes = 7;},
    () => {delete p.existing[0].internalBarriers; p.width = 6; p.height = 8;},
  ];
  for (const change of changes) {change(); assert.deepEqual(compare(p, settings), compareIntervention(p, settings));}
});
test('cache entries never conflate rates or material scopes across changing declarations', () => {
  const p = makeExample(), compare = createInterventionBatch();
  for (const surface of ['sealed', 'turf', 'garden', 'sealed']) {
    const options = {...settings, study: {...study, surface, ratesMmHr: [0,1,2,3,4,5,6,7,8]}};
    assert.deepEqual(compare(p, options), compareIntervention(p, options));
    assert.deepEqual(compare(p, settings), compareIntervention(p, settings));
  }
});
test('changing evidence still refilters the original source and preserves held-aside semantics', () => {
  const p = makeExample(), compare = createInterventionBatch();
  const modeled = runRain(p.existing, p.width, p.height, p.weather,
    {surfaceInfiltrationOverride: {surface: 'sealed', rateMmHr: 1}});
  const reading = {cellIndex: 27, minute: 60, depthMm: interpolateDepth(modeled, 27, 60).depthMm,
    uncertaintyMm: 0, source: 'Authored computational observation', scenario: 'existing', use: 'calibration'};
  p.observations = [reading, {...reading, use: 'challenge'}];
  const options = {study, subset: 'surviving'};
  const accepted = compare(p, options);
  assert.equal(accepted.status, 'compared');
  p.observations[1].depthMm = 1000;
  const rejected = compare(p, options);
  assert.deepEqual(rejected, compareIntervention(p, options));
  assert.equal(rejected.status, 'no-compatible-rates');
  p.observations = [];
  assert.equal(compare(p, options).status, 'need-calibration');
});
test('returned report edits cannot poison a later paired comparison', () => {
  const p = makeExample(), compare = createInterventionBatch();
  const options = {...settings, exposureRequest: {thresholdMm: 5, cellIndices: [0, 27]}};
  const expected = compareIntervention(p, options), result = compare(p, options);
  result.candidates[0].metrics.exitLiters.existing = -123;
  result.candidates[0].peakDeltaMm[0] = 456;
  result.candidates[0].pondingExposure.existing.length = 0;
  result.metrics = {}; result.cells.length = 0;
  assert.deepEqual(compare(p, options), expected);
});
test('a warm batch still refuses invalid source, options and complete work bounds', () => {
  const p = makeExample(), compare = createInterventionBatch(); compare(p, settings);
  p.weather.rainMmHr = NaN; assert.throws(() => compare(p, settings), /Weather/);
  p.weather.rainMmHr = 36;
  assert.throws(() => compare(p, {...settings, subset: 'surviving'}), /cannot filter/);
  assert.throws(() => compare(p, {...settings, study: {...study, ratesMmHr: [1,1]}}), /distinct/);
  const huge = makeExample(); huge.width = huge.height = 24; huge.selectedIndex = 0;
  huge.existing = Array.from({length: 576}, () => ({...p.existing[0]}));
  huge.proposal = structuredClone(huge.existing);
  Object.assign(huge.weather, {durationMinutes: 720, stepMinutes: 1});
  assert.throws(() => compare(huge, settings), /work budget/);
});
test('custom serializers and cyclic programmatic metadata use the unchanged uncached path', () => {
  const p = makeExample(), compare = createInterventionBatch();
  p.existing.toJSON = () => [];
  const before = compare(p, settings);
  p.existing[0].elevationM += .5;
  const changed = compare(p, settings);
  assert.notDeepEqual(changed, before);
  assert.deepEqual(changed, compareIntervention(p, settings));
  delete p.existing.toJSON;
  p.existing[0].extra = p.existing[0];
  assert.deepEqual(compare(p, settings), compareIntervention(p, settings));
  delete p.existing[0].extra;
  Object.defineProperty(p.existing[0], 'elevationM', {value: .3, writable: true, enumerable: false});
  compare(p, settings); p.existing[0].elevationM = .4;
  assert.deepEqual(compare(p, settings), compareIntervention(p, settings));
});
test('accessor inputs do not acquire additional reads or stale values from key construction', () => {
  const p = makeExample(), compare = createInterventionBatch();
  let reads = 0, elevation = p.existing[0].elevationM;
  Object.defineProperty(p.existing[0], 'elevationM', {get() {reads++; return elevation;}, enumerable: true});
  const expected = compareIntervention(p, settings), originalReads = reads;
  reads = 0; assert.deepEqual(compare(p, settings), expected); assert.equal(reads, originalReads);
  elevation += .3;
  assert.deepEqual(compare(p, settings), compareIntervention(p, settings));
});
