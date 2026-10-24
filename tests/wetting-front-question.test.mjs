import test from 'node:test';
import assert from 'node:assert/strict';
import { makeExample, validateProject } from '../core.js';
import { compareWettingFront, serializeWettingFrontInvestigation,
  parseWettingFrontInvestigation } from '../wetting-front-study.js';

const near = (actual, expected, tolerance = 1e-10) => assert.ok(
  Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
function fixture() {
  const project = makeExample(); project.width = project.height = 2; project.selectedIndex = 0;
  project.existing = Array.from({ length: 4 }, () => ({ surface: 'turf', elevationM: 0,
    provenance: 'Authored mechanism-identifiability control, not a field survey' }));
  project.proposal = structuredClone(project.existing);
  Object.assign(project.weather, { rainMmHr: 30, stormMinutes: 60, durationMinutes: 60,
    stepMinutes: 5, cellSizeM: 1, mobilityPerHour: 0, boundaryExitPerHour: 0 });
  project.observations = [{ cellIndex: 0, minute: 60, depthMm: 5.404720888434597,
    uncertaintyMm: 0.05, source: 'Independent Decimal endpoint; authored mathematical control',
    scenario: 'existing', use: 'calibration' }];
  project.wettingFrontStudy = { target: 'existing', surface: 'turf',
    basis: 'Equal final depth does not identify the event response',
    hypotheses: [{ conductivityMmHr: 10, capillaryDriveMm: 20 },
      { conductivityMmHr: 24.595279111565403, capillaryDriveMm: 0 }],
    question: { scope: 'selected', fromMinute: 0, toMinute: 60, uncertaintyMm: 1 } };
  return project;
}

test('equal endpoint explanations yield a different earlier reading without additional simulation work', () => {
  const project = fixture(), before = JSON.stringify(project), report = compareWettingFront(project);
  assert.equal(report.compatibleIds.length, 2);
  for (const candidate of report.candidates) assert.ok(candidate.calibration.rmseMm < 1e-12);
  const q = report.question;
  assert.equal(q.status, 'question'); assert.equal(q.minute, 30); assert.equal(q.cellIndex, 0);
  near(q.predictions[0].depthMm, 0.5908037178904904);
  near(q.predictions[1].depthMm, 2.702360444217298);
  near(q.spanMm, 2.111556726326808);
  assert.deepEqual(q.candidateIds, [1, 2]); assert.equal(q.disjointPairCount, 1);
  assert.equal(q.allPairsDisjoint, true); assert.equal(q.evaluatedCount, 11); assert.equal(q.excludedCount, 1);
  const ordinary = structuredClone(project); delete ordinary.wettingFrontStudy.question;
  assert.equal(report.cellSteps, compareWettingFront(ordinary).cellSteps);
  assert.equal(JSON.stringify(project), before);
});

test('a broader declared reading band removes separation; touching bands remain unresolved', () => {
  const project = fixture(), first = compareWettingFront(project).question;
  project.wettingFrontStudy.question.uncertaintyMm = 1.1;
  const wider = compareWettingFront(project).question;
  assert.equal(wider.minute, first.minute); assert.equal(wider.spanMm, first.spanMm);
  assert.equal(wider.disjointPairCount, 0); assert.equal(wider.allPairsDisjoint, false);
  assert.ok(wider.pairs[0].bandGapMm < 0);
  project.wettingFrontStudy.question.uncertaintyMm = first.spanMm / 2;
  assert.equal(compareWettingFront(project).question.disjointPairCount, 0);
});

test('all candidate bands remain visible when one close pair is unresolved', () => {
  const project = fixture();
  project.wettingFrontStudy.hypotheses.push({ conductivityMmHr: 24.6, capillaryDriveMm: 0 });
  const q = compareWettingFront(project).question;
  assert.equal(q.predictions.length, 3); assert.equal(q.pairCount, 3);
  assert.equal(q.disjointPairCount, 2); assert.equal(q.allPairsDisjoint, false);
  assert.deepEqual(q.pairs.filter(pair => !pair.disjoint).map(pair => [pair.firstId, pair.secondId]), [[2, 3]]);
});

test('explicit time windows and selected-cell scope constrain the actual question', () => {
  const project = fixture(); project.selectedIndex = 3;
  Object.assign(project.wettingFrontStudy.question, { fromMinute: 40, toMinute: 50 });
  let q = compareWettingFront(project).question;
  assert.equal(q.cellIndex, 3); assert.equal(q.minute, 40); assert.equal(q.evaluatedCount, 3);
  Object.assign(project.wettingFrontStudy.question, { fromMinute: 1, toMinute: 4 });
  q = compareWettingFront(project).question;
  assert.equal(q.status, 'no-supported-times'); assert.equal(q.eligibleCount, 0);
  assert.equal(Object.hasOwn(q, 'minute'), false);
});

test('held-aside coordinates exclude repeats but their values never select or rank a question', () => {
  const project = fixture(); project.wettingFrontStudy.question.scope = 'grid';
  project.observations.push({ ...project.observations[0], minute: 30, depthMm: 0.6,
    uncertaintyMm: 0.01, use: 'challenge', source: 'Held aside authored control' });
  const first = compareWettingFront(project).question;
  assert.equal(first.cellIndex, 1); assert.equal(first.minute, 30);
  project.observations[1].depthMm = 1000; project.observations[1].uncertaintyMm = 0;
  const changed = compareWettingFront(project);
  assert.equal(changed.status, 'challenged'); assert.deepEqual(changed.question, first);
  project.observations[1].scenario = 'proposal';
  assert.equal(compareWettingFront(project).question.cellIndex, 0);
});

test('a fully recorded requested window produces no replacement reading', () => {
  const project = fixture();
  Object.assign(project.wettingFrontStudy.question, { fromMinute: 60, toMinute: 60, scope: 'grid' });
  project.observations = Array.from({ length: 4 }, (_, cellIndex) => ({ ...project.observations[0], cellIndex }));
  const q = compareWettingFront(project).question;
  assert.equal(q.status, 'all-recorded'); assert.equal(q.excludedCount, 4); assert.equal(q.evaluatedCount, 0);
  assert.equal(Object.hasOwn(q, 'predictions'), false);
});

test('dry indistinguishable events and missing calibration do not manufacture a question', () => {
  const project = fixture(); project.weather.rainMmHr = 0;
  project.observations[0].depthMm = 0; project.observations[0].uncertaintyMm = 0;
  assert.equal(compareWettingFront(project).question.status, 'indistinguishable');
  project.observations = [];
  assert.equal(compareWettingFront(project).question.status, 'insufficient-alternatives');
  project.wettingFrontStudy.surface = 'sealed';
  assert.equal(compareWettingFront(project).question.status, 'insufficient-alternatives');
});

test('question inputs survive input-only reopening and recompute the same finite choice', () => {
  const project = fixture(), before = JSON.stringify(project), expected = compareWettingFront(project).question;
  const text = serializeWettingFrontInvestigation(project), bundle = parseWettingFrontInvestigation(text);
  assert.deepEqual(bundle.study.question, project.wettingFrontStudy.question);
  assert.deepEqual(Object.keys(bundle.study.question).sort(), ['fromMinute', 'scope', 'toMinute', 'uncertaintyMm']);
  assert.equal(Object.hasOwn(bundle, 'results'), false);
  assert.deepEqual(compareWettingFront(bundle.project, bundle.study).question, expected);
  assert.equal(JSON.stringify(project), before);
});

test('invalid windows, saved conclusions and oversized work are refused before changing accepted inputs', () => {
  const source = fixture();
  for (const changes of [{ uncertaintyMm: -1 }, { uncertaintyMm: NaN }, { uncertaintyMm: '1' },
    { fromMinute: 30, toMinute: 20 }, { scope: 'all accessible' }, { minute: 30 }, { toMinute: 721 }]) {
    const project = structuredClone(source); Object.assign(project.wettingFrontStudy.question, changes);
    assert.throws(() => validateProject(project), /reading question/);
  }
  const beyond = structuredClone(source); beyond.wettingFrontStudy.question.toMinute = 61;
  const before = JSON.stringify(beyond);
  assert.throws(() => compareWettingFront(beyond), /window must fit/);
  assert.throws(() => serializeWettingFrontInvestigation(beyond), /window must fit/);
  assert.equal(JSON.stringify(beyond), before);
  const large = structuredClone(source); large.width = large.height = 24;
  large.existing = Array.from({ length: 576 }, () => ({ ...source.existing[0] }));
  large.proposal = structuredClone(large.existing); large.weather.durationMinutes = 720; large.weather.stepMinutes = 1;
  assert.throws(() => compareWettingFront(large), /cell-steps/);
});
