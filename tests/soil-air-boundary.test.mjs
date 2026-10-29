import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectSoilAirBoundary, normalizeSoilAirBoundary, parseSoilAirBoundary, serializeSoilAirBoundary } from '../soil-air-boundary.js';
import { soilAirBoundaryExample } from '../soil-air-boundary-example.js';

function exactCourse(front = 20) {
  const x = soilAirBoundaryExample();
  x.column.depth = 100; x.column.initialFront = 10;
  x.boundary.pondingHead = 5; x.boundary.atmosphericHead = 1408;
  x.target.front = front; x.hypotheses = [{ id: 'Exact pressure-volume control', capillaryHead: 15, unit: 'mm', source: 'Authored to have a 12 mm force-balance root.' }];
  return x;
}
function close(actual, expected, tolerance = 2e-13) {
  assert.ok(Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected)), `${actual} vs ${expected}`);
}

test('an independently constructed 12 mm equilibrium conserves gas and gives exact target removal', () => {
  const answer = inspectSoilAirBoundary(exactCourse()).alternatives[0];
  close(answer.closedAir.advancementMm, 2); close(answer.closedAir.limitingFrontMm, 12);
  close(answer.closedAir.gaugeHeadMm, 32); close(answer.closedAir.absoluteHeadMm, 1440);
  close(answer.closedAir.gasVolumeFraction, 88 / 90);
  close(answer.closedAir.absoluteHeadMm * 88, 1408 * 90);
  assert.equal(answer.target.relation, 'beyond-closed-limit');
  close(answer.target.closedGaugeHeadMm, 176); close(answer.target.zeroFlowGaugeHeadMm, 40);
  close(answer.target.closedDrivingHeadMm, -136); close(answer.target.minimumRemovedFraction, 17 / 198);
  // Independently substitute the allowed remaining gas amount into P V = n R T.
  const remaining = 1 - answer.target.minimumRemovedFraction;
  close(1408 * remaining * 90 / 80 - 1408, 40);
  close(answer.target.ventedDrivingHeadMm, 40);
  assert.equal(answer.profile.at(-1).kind, 'base-limit-only');
});

test('one target below, at and above the root keeps static contact distinct from a positive release requirement', () => {
  const before = inspectSoilAirBoundary(exactCourse(11)).alternatives[0];
  const contact = inspectSoilAirBoundary(exactCourse(12)).alternatives[0];
  const beyond = inspectSoilAirBoundary(exactCourse(12.000001)).alternatives[0];
  assert.equal(before.target.minimumRemovedFraction, 0); assert.ok(before.target.closedDrivingHeadMm > 0);
  assert.equal(contact.target.relation, 'numerical-contact'); assert.equal(contact.target.minimumRemovedFraction, null);
  assert.equal(beyond.target.relation, 'beyond-closed-limit'); assert.ok(beyond.target.minimumRemovedFraction > 0);
  assert.ok(beyond.target.closedDrivingHeadMm < 0);
});

test('original values, units, literal sources and ordering survive recomputation and source-only reopening', () => {
  const original = exactCourse(), literal = '  Original <img src=x onerror="throw 1"> & α source\nwith trailing space  ';
  original.title = 'Literal original course'; original.column.source = literal; original.target.source = literal;
  const snapshot = structuredClone(original), result = inspectSoilAirBoundary(original);
  assert.deepEqual(original, snapshot); assert.deepEqual(result.source, original);
  const saved = serializeSoilAirBoundary(original); assert.deepEqual(parseSoilAirBoundary(saved), original);
  assert.deepEqual(Object.keys(JSON.parse(saved)), ['schema','title','column','boundary','target','hypotheses','assumptions']);
  assert.ok(!saved.includes('minimumRemovedFraction')); assert.ok(!saved.includes('limitingFrontMm'));
  const meters = structuredClone(original);
  meters.column.depth /= 1000; meters.column.initialFront /= 1000; meters.column.unit = 'm';
  meters.boundary.pondingHead /= 1000; meters.boundary.atmosphericHead /= 1000; meters.boundary.unit = 'm';
  meters.target.front /= 1000; meters.target.unit = 'm'; meters.hypotheses[0].capillaryHead /= 1000; meters.hypotheses[0].unit = 'm';
  assert.deepEqual(inspectSoilAirBoundary(meters).alternatives, result.alternatives);
  result.source.column.source = 'external mutation'; assert.equal(original.column.source, literal);
});

test('greater target depth requires no less gas removal; greater declared capillary head relaxes the bound', () => {
  const x = soilAirBoundaryExample(); let previous = 0;
  for (const front of [5, 6, 10, 30, 100, 200, 300, 390, 399.9999]) {
    x.target.front = front; const result = inspectSoilAirBoundary(x);
    const fractions = result.alternatives.map(row => row.target.minimumRemovedFraction);
    assert.ok(fractions.every(value => value !== null && value >= 0 && value < 1));
    assert.ok(fractions[0] >= previous); previous = fractions[0];
    assert.ok(fractions[0] >= fractions[1] && fractions[1] >= fractions[2]);
    assert.ok(result.alternatives[0].closedAir.limitingFrontMm < result.alternatives[1].closedAir.limitingFrontMm);
    assert.ok(result.alternatives[1].closedAir.limitingFrontMm < result.alternatives[2].closedAir.limitingFrontMm);
  }
});

test('unsupported physical states and imported conclusions refuse without repairing original inputs', () => {
  const changes = [
    x => x.column.initialFront = 0,
    x => x.column.initialFront = 100,
    x => x.target.front = 100,
    x => x.target.front = 9,
    x => x.boundary.pondingHead = 0,
    x => x.boundary.atmosphericHead = -1,
    x => x.hypotheses[0].capillaryHead = -1,
    x => x.assumptions.noOtherGasStorage = false,
    x => x.column.unit = 'kPa',
    x => x.boundary.source = ' ',
    x => x.hypotheses.push(structuredClone(x.hypotheses[0])),
    x => x.computedRelease = .1,
  ];
  for (const change of changes) { const x = exactCourse(); change(x); const snapshot = structuredClone(x); assert.throws(() => normalizeSoilAirBoundary(x)); assert.deepEqual(x, snapshot); }
  assert.throws(() => parseSoilAirBoundary('{"schema":')); assert.throws(() => parseSoilAirBoundary(' '.repeat(96001)));
});
