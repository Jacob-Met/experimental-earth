import test from 'node:test';
import assert from 'node:assert/strict';
import { makeShadeHeatExample } from '../shade-heat-example.js';
import { prepareSolarStudy, compareSolarOcclusionAt, compareSolarDirectionsAt } from '../solar-occlusion.js';

const directions = [
  { headingDeg: 0, elevationDeg: 1 },
  { headingDeg: 90, elevationDeg: 45 },
  { headingDeg: 180, elevationDeg: 90 },
  { headingDeg: 270, elevationDeg: 10 },
  { headingDeg: 359.99999999999994, elevationDeg: 89.99999999999999 },
];
function fixture() {
  const { project } = makeShadeHeatExample();
  project.proposal[1].elevationM = 8;
  project.solarStudy = prepareSolarStudy(project, {
    ...project.solarStudy,
    proposal: [{ ...project.solarStudy.proposal[0], heightMinM: 0, heightMaxM: 100 }],
  });
  return project;
}
function freeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

test('batch retains complete scalar reports and witnesses over terrain and uncertain heights', () => {
  const project = fixture();
  for (const cell of [0, 5, project.width * project.height - 1, project.solarStudy.proposal[0].cellIndex]) {
    const batch = compareSolarDirectionsAt(project, cell, directions);
    assert.equal(batch.status, 'compared');
    assert.equal(batch.rays.length, directions.length);
    directions.forEach((direction, index) => {
      const scalarInput = structuredClone(project);
      Object.assign(scalarInput.solarStudy, direction);
      assert.deepEqual(batch.rays[index], compareSolarOcclusionAt(scalarInput, cell));
    });
  }
});

test('whole direction population is admitted or refused, including sparse and over-limit lists', () => {
  const project = fixture();
  for (const population of [
    [], Array(2), [directions[0], null],
    [directions[0], { headingDeg: 360, elevationDeg: 45 }],
    [directions[0], { headingDeg: 0, elevationDeg: NaN }],
    [directions[0], { headingDeg: 0, elevationDeg: .9999999999999999 }],
    Array.from({ length: 4097 }, () => directions[0]),
  ]) assert.throws(() => compareSolarDirectionsAt(project, 5, population));
  assert.throws(() => compareSolarDirectionsAt(project, -1, directions));
  assert.throws(() => compareSolarDirectionsAt(project, project.width * project.height, directions));
  assert.equal(compareSolarDirectionsAt(project, 5, Array.from({ length: 4096 }, () => directions[2])).rays.length, 4096);
});

test('batch preserves missing-study and source-changed refusal contracts', () => {
  const missing = fixture();
  delete missing.solarStudy;
  assert.deepEqual(compareSolarDirectionsAt(missing, 5, directions), { status: 'no-study' });
  for (const mutate of [
    p => { p.existing[0].provenance += ' changed'; },
    p => { p.existing[0].elevationM += .1; },
    p => { p.source = 'Different retained source'; },
  ]) {
    const project = fixture();
    mutate(project);
    assert.deepEqual(compareSolarDirectionsAt(project, 5, directions), { status: 'context-changed' });
  }
});

test('frozen project and direction inputs remain unchanged and result mutation stays isolated', () => {
  const project = freeze(fixture());
  const population = freeze(structuredClone(directions));
  const before = structuredClone(project), directionBefore = structuredClone(population);
  const report = compareSolarDirectionsAt(project, 5, population);
  report.rays[0].existing.status = 'consumer edit';
  report.rays[0].direction[0] = 123;
  const witness = report.rays.flatMap(r => [r.existing.witness, r.proposal.witness]).find(Boolean);
  assert.ok(witness, 'fixture must exercise a real source witness');
  witness.source = 'consumer witness edit';
  assert.deepEqual(project, before);
  assert.deepEqual(population, directionBefore);
  const repeated = compareSolarDirectionsAt(project, 5, population);
  assert.notEqual(repeated.rays[0].existing.status, 'consumer edit');
  assert.ok(repeated.rays.every(r => ![r.existing.witness, r.proposal.witness].some(w => w?.source === 'consumer witness edit')));
});
