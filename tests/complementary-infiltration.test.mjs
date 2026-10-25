import test from 'node:test';
import assert from 'node:assert/strict';
import { makeExample, runRain } from '../core.js';
import { planInfiltrationReadings } from '../complementary-infiltration.js';
import { chooseInfiltrationQuestion } from '../infiltration-question.js';

export function complementaryFixture() {
  const project = makeExample();
  project.weather.rainMmHr = 12;
  project.infiltrationStudy = { target: 'existing', surface: 'turf', ratesMmHr: [0, 3, 9, 22] };
  project.observations = [{ cellIndex: 0, minute: 0, depthMm: 0, uncertaintyMm: 0,
    source: 'Authored common-start control; not an acquired field reading', scenario: 'existing', use: 'calibration' }];
  return project;
}

test('current maintained solver needs complementary times for five pair distinctions', () => {
  const project = complementaryFixture(), before = structuredClone(project);
  const report = planInfiltrationReadings(project, { uncertaintyMm: 4, maxReadings: 2 });
  assert.deepEqual(report.questions.map(q => [q.cellIndex, q.minute, q.newlySeparatedPairs.length]), [[13, 45, 4], [13, 235, 1]]);
  assert.deepEqual(report.unresolvedPairs, [{ first: 2, second: 3, index: 5 }]);
  const largestSpan = chooseInfiltrationQuestion(project);
  assert.equal(largestSpan.minute, 75);
  assert.ok(largestSpan.predictions[1].depthMm - largestSpan.predictions[2].depthMm > 8);
  assert.ok(largestSpan.predictions[0].depthMm - largestSpan.predictions[1].depthMm < 8,
    'Largest-span question cannot separate the 0/3 pair at this precision');
  for (const [index, rateMmHr] of report.ratesMmHr.entries()) {
    const run = runRain(project.existing, project.width, project.height, project.weather,
      { surfaceInfiltrationOverride: { surface: 'turf', rateMmHr } });
    for (const question of report.questions) assert.equal(question.depthsMm[index], run.snapshots.find(s => s.minute === question.minute).depthsMm[question.cellIndex]);
  }
  assert.deepEqual(project, before);
});

test('held-aside values cannot choose questions or rescue calibration rejection', () => {
  const project = complementaryFixture();
  project.observations.push({ ...project.observations[0], cellIndex: 1, minute: 5, use: 'challenge', depthMm: 0 });
  const a = planInfiltrationReadings(project, { uncertaintyMm: 4 });
  project.observations[1].depthMm = 1000;
  const b = planInfiltrationReadings(project, { uncertaintyMm: 4 });
  assert.deepEqual(a.questions, b.questions);
  assert.deepEqual(a.ratesMmHr, b.ratesMmHr);
  project.observations[0].depthMm = 1000;
  assert.equal(planInfiltrationReadings(project, { uncertaintyMm: 4 }).status, 'insufficient-alternatives');
});

test('no calibration and absent surface invent no supported rates', () => {
  const project = complementaryFixture(); project.observations = [];
  assert.deepEqual(planInfiltrationReadings(project, { uncertaintyMm: 4 }).ratesMmHr, []);
  project.infiltrationStudy.surface = 'garden';
  assert.equal(planInfiltrationReadings(project, { uncertaintyMm: 4 }).calibrationStatus, 'surface-absent');
});

test('combined simulation work is refused before expensive execution', () => {
  const project = complementaryFixture(); project.width = 24; project.height = 24;
  project.existing = Array.from({ length: 576 }, () => ({ ...project.existing[0] }));
  project.proposal = structuredClone(project.existing);
  project.weather.durationMinutes = 720; project.weather.stepMinutes = 1;
  assert.throws(() => planInfiltrationReadings(project, { uncertaintyMm: 1 }), /million estimated cell-steps/);
});
