import test from 'node:test';
import assert from 'node:assert/strict';
import { makeWettingFrontEventsFixture } from './wetting-front-events-fixture.mjs';
import { compareWettingFront } from '../wetting-front-study.js';
import { admitWettingFrontEvents, compareWettingFrontEvents, parseWettingFrontEvents,
  serializeWettingFrontEvents, reopenWettingFrontEvents,
  WETTING_FRONT_EVENTS_SCHEMA } from '../wetting-front-events.js';

const args = f => [f.first, f.second, f.study, f.references, f.initialConditions];
const near = (actual, expected, message) => assert.ok(Math.abs(actual - expected) <=
  2e-9 * Math.max(1, Math.abs(expected)), `${message}: ${actual} != ${expected}`);

test('a second authored event challenges the original ambiguous explanations without fitting or adoption', () => {
  const f = makeWettingFrontEventsFixture(), before = JSON.stringify(f);
  const first = compareWettingFront(f.first, f.study);
  assert.equal(first.compatibleIds.length, 2);
  const result = compareWettingFrontEvents(...args(f));
  assert.deepEqual(result.firstSurvivingIds, first.survivingIds);
  assert.deepEqual(result.candidates.map(row => row.id), first.candidates.map(row => row.id));
  assert.deepEqual(result.survivingIds, [1]);
  assert.equal(result.status, 'one-survivor');
  const survivor = result.candidates.find(row => row.id === 1);
  near(survivor.second.model.selectedCell.depths.at(-1).depthMm, 33.392524218346, 'second depth');
  for (const row of result.candidates) {
    assert.deepEqual(row.first, first.candidates.find(candidate => candidate.id === row.id));
    assert.equal(row.second.model.selectedCell.depths[0].depthMm, 0);
  }
  assert.equal(JSON.stringify(f), before);
});

test('72 constant-rate second-event controls match independent closed-cell water balances at every saved time', () => {
  let candidates = 0;
  for (const rain of [20, 60, 120]) for (const storm of [0, 13, 37]) for (const duration of [37, 60]) {
    const f = makeWettingFrontEventsFixture();
    f.study.hypotheses = [0, 6, 25, 80].map(conductivityMmHr => ({ conductivityMmHr, capillaryDriveMm: 0 }));
    f.first.wettingFrontStudy = structuredClone(f.study);
    f.first.weather.stepMinutes = f.second.weather.stepMinutes = 7;
    f.first.observations[0].depthMm = 0; f.first.observations[0].uncertaintyMm = 1000;
    Object.assign(f.second.weather, { rainMmHr: rain, stormMinutes: storm, durationMinutes: duration });
    Object.assign(f.second.observations[0], { minute: duration, depthMm: 0, uncertaintyMm: 1000 });
    f.initialConditions.challengeDrivesMm = [0, 0, 0, 0];
    const before = JSON.stringify(f), result = compareWettingFrontEvents(...args(f));
    for (const row of result.candidates) {
      candidates++;
      const K = row.conductivityMmHr;
      for (const [model, weather] of [[row.first.existing, f.first.weather], [row.second.model, f.second.weather]]) {
        for (const point of model.selectedCell.depths) {
          const supplied = weather.rainMmHr * Math.min(point.minute, weather.stormMinutes) / 60;
          near(point.depthMm, Math.max(0, supplied - K * point.minute / 60), 'independent A=0 balance');
        }
        const final = model.selectedCell.depths.at(-1).depthMm;
        near(model.storedLiters, 4 * final, 'all four unit-area cells');
        near(model.rainLiters, model.storedLiters + model.absorbedLiters, 'whole event conservation');
        assert.equal(model.exitLiters, 0);
      }
    }
    assert.equal(JSON.stringify(f), before);
  }
  assert.equal(candidates, 72);
});

test('all six source-order permutations keep each explicit second drive with its original explanation', () => {
  const source = makeWettingFrontEventsFixture();
  source.study.hypotheses.push({ conductivityMmHr: 14, capillaryDriveMm: 2 });
  source.first.wettingFrontStudy = structuredClone(source.study);
  source.initialConditions.challengeDrivesMm = [40, 0, 12];
  const baseline = compareWettingFrontEvents(...args(source));
  for (const order of [[0,1,2], [0,2,1], [1,0,2], [1,2,0], [2,0,1], [2,1,0]]) {
    const f = structuredClone(source);
    f.study.hypotheses = order.map(i => source.study.hypotheses[i]);
    f.first.wettingFrontStudy = structuredClone(f.study);
    f.initialConditions.challengeDrivesMm = order.map(i => source.initialConditions.challengeDrivesMm[i]);
    const report = compareWettingFrontEvents(...args(f));
    for (const candidate of report.candidates) {
      const original = baseline.candidates.find(row => row.id === order[candidate.id - 1] + 1);
      assert.equal(candidate.conductivityMmHr, original.conductivityMmHr);
      assert.equal(candidate.firstCapillaryDriveMm, original.firstCapillaryDriveMm);
      assert.equal(candidate.challengeCapillaryDriveMm, original.challengeCapillaryDriveMm);
      assert.deepEqual(candidate.second, original.second);
      assert.equal(candidate.survives, original.survives);
    }
  }
});

test('a successful second challenge cannot rescue first-event calibration or held-aside contradictions', () => {
  const calibration = makeWettingFrontEventsFixture();
  Object.assign(calibration.first.observations[0], { depthMm: 1000, uncertaintyMm: 0 });
  const rejected = compareWettingFrontEvents(...args(calibration));
  assert.equal(rejected.status, 'calibration-rejected');
  assert.deepEqual(rejected.survivingIds, []);
  assert.ok(rejected.candidates.some(row => row.second.challenge.compatible));
  const challenge = makeWettingFrontEventsFixture();
  challenge.first.observations.push({ ...challenge.first.observations[0],
    use: 'challenge', depthMm: 1000, uncertaintyMm: 0, source: 'Authored disconfirming first-event reading' });
  const challenged = compareWettingFrontEvents(...args(challenge));
  assert.equal(challenged.status, 'first-event-challenged');
  assert.deepEqual(challenged.survivingIds, []);
});

test('event identities, observation roles and separately declared starting conditions are required', () => {
  const refuse = change => { const f = makeWettingFrontEventsFixture(); change(f); assert.throws(() => admitWettingFrontEvents(...args(f))); };
  for (const change of [
    f => { f.references.challenge = ' ' + f.references.calibration + ' '; },
    f => { f.references.calibration = ''; },
    f => { f.references.extra = 'inferred'; },
    f => { f.references = Object.create(f.references); },
    f => { f.initialConditions.basis = ' '; },
    f => { f.initialConditions.challengeDrivesMm = [20]; },
    f => { delete f.initialConditions.challengeDrivesMm[0]; },
    f => { f.initialConditions.challengeDrivesMm = Object.assign(new Array(2), {1:0}); },
    f => { f.initialConditions.recoveryFraction = 1; },
    f => { f.first.observations[0].use = 'challenge'; },
    f => { f.second.observations[0].use = 'calibration'; },
    f => { f.second.observations = []; },
  ]) refuse(change);
  for (const value of [NaN, Infinity, -1, 5001, '20', null]) {
    refuse(f => { f.initialConditions.challengeDrivesMm[0] = value; });
  }
});

test('observed site and numerical assumptions must match while irrelevant object key order does not matter', () => {
  for (const change of [
    f => { f.second.existing[0].elevationM += .01; },
    f => { f.second.existing[0].surface = 'garden'; },
    f => { f.second.existing[0].provenance = 'A different site declaration'; },
    ...['cellSizeM', 'mobilityPerHour', 'boundaryExitPerHour', 'stepMinutes'].map(key =>
      f => { f.second.weather[key] += 1; }),
  ]) {
    const f = makeWettingFrontEventsFixture(); change(f);
    assert.throws(() => admitWettingFrontEvents(...args(f)));
  }
  const f = makeWettingFrontEventsFixture();
  f.second.existing = f.second.existing.map(cell => ({
    provenance: cell.provenance, surface: cell.surface, elevationM: cell.elevationM,
  }));
  f.second.proposal[0].surface = 'garden';
  assert.doesNotThrow(() => admitWettingFrontEvents(...args(f)));
});

test('combined work admission includes both events before any simulation', () => {
  const f = makeWettingFrontEventsFixture();
  for (const project of [f.first, f.second]) {
    project.width = project.height = 24;
    project.existing = Array.from({length:576}, () => structuredClone(project.existing[0]));
    project.proposal = structuredClone(project.existing);
    project.weather.stepMinutes = 1;
  }
  f.second.weather.durationMinutes = 688;
  const admitted = admitWettingFrontEvents(...args(f));
  assert.equal(admitted.firstCellSteps, 207360);
  assert.equal(admitted.secondCellSteps, 792576);
  assert.equal(admitted.cellSteps, 999936);
  f.second.weather.durationMinutes = 689;
  assert.throws(() => admitWettingFrontEvents(...args(f)), /combined two-event comparison/);
});

test('input-only save and reopen recompute without adopting forged findings or mutating sources', () => {
  const f = makeWettingFrontEventsFixture(), before = JSON.stringify(f);
  const text = serializeWettingFrontEvents(...args(f)), bundle = parseWettingFrontEvents(text);
  assert.deepEqual(Object.keys(bundle), ['schema', 'calibrationProject', 'challengeProject', 'study', 'references', 'initialConditions']);
  assert.equal(bundle.schema, WETTING_FRONT_EVENTS_SCHEMA);
  assert.deepEqual(bundle.calibrationProject, f.first); assert.deepEqual(bundle.challengeProject, f.second);
  assert.deepEqual(reopenWettingFrontEvents(bundle), compareWettingFrontEvents(...args(f)));
  assert.throws(() => parseWettingFrontEvents(JSON.stringify({...bundle, results:{survivingIds:[2]}})), /saved conclusions/);
  assert.throws(() => reopenWettingFrontEvents({...bundle, results:{survivingIds:[2]}}), /saved conclusions/);
  assert.throws(() => parseWettingFrontEvents(JSON.stringify({...bundle, schema:'future/1'})), /Unsupported/);
  assert.throws(() => parseWettingFrontEvents(' '.repeat(5*1024*1024+1)), /5 MiB/);
  assert.equal(JSON.stringify(f), before);
});
