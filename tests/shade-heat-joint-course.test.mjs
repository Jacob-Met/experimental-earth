import test from 'node:test';
import assert from 'node:assert/strict';
import { makeJointCourseExample } from '../shade-heat-joint-example.js';
import { prepareSkyJointSource, prepareSkyJointEvidence, parseSkyJointSource, parseSkyJointEvidence } from '../shade-heat-joint-course.js';
import { projectJointProfileFamily } from '../shade-heat-joint-projection.js';
import { rational as q, add, mul, cmp } from '../vendor/chronos/exact-halfplanes.mjs';
const exact = value => [BigInt(value.exact.numerator), BigInt(value.exact.denominator)];
const run = source => prepareSkyJointEvidence(source.readings, source.query);
const copy = value => structuredClone(value);

test('unchanged original readings permit each ceiling separately but exclude the simultaneous pair', () => {
  const source = makeJointCourseExample(), before = JSON.stringify(source), { investigation, report: r } = run(source);
  assert.equal(JSON.stringify(source), before); assert.equal(r.cellIndex, 7);
  assert.deepEqual(investigation.readings.map(x => x.query.reading.cellIndex), [7,5,1]);
  assert.equal(r.observationCompatibility, 'compatible'); assert.equal(r.jointCompatibility, 'jointly-incompatible');
  assert(r.individualRanges.every(x => x.individuallyPossible)); assert.equal(r.hull.length, 4);
  assert.equal(r.witness, null); assert.deepEqual(r.feasibleRegion, []);
  assert.equal(r.work.executedBasisCourses, 192); assert.equal(r.work.executedThermalCourses, 192);
  assert.deepEqual(r.axes.map(a => a.utc), ['2026-06-21T08:00:00.000Z','2026-06-21T09:00:00.000Z']);
});
test('a less strict second ceiling constructs one normalized shared profile and all original replays', () => {
  const source = makeJointCourseExample(true), { investigation, report: r } = run(source), w = r.witness;
  assert.equal(r.jointCompatibility, 'jointly-compatible'); assert.equal(w.construction.length, 2);
  assert.equal(cmp(w.masses.map(exact).reduce(add, q(0)), q(1)), 0);
  for (const phase of w.phaseProfiles) assert.equal(cmp(phase.map(exact).reduce(add, q(0)), q(1)), 0);
  w.jointValuesC.forEach((value, i) => assert(cmp(exact(value), q(investigation.query.limits[i].maximumDifferenceC)) <= 0));
  w.observedC.forEach((value, i) => {
    assert(cmp(exact(value), exact(r.readings[i].bandC.lower)) >= 0);
    assert(cmp(exact(value), exact(r.readings[i].bandC.upper)) <= 0);
  });
  assert.equal(w.originalReplays.length, 3);
  for (const replay of w.originalReplays) assert.deepEqual(replay.originalCourse.map(x => [x.index,x.utc,x.minute,x.thermalMinute]),
    r.originalBoundaries.map(x => [x.index,x.utc,x.minute,x.thermalMinute]));
  assert.equal(r.work.executedThermalCourses, 204); assert.equal(r.work.actualReplayEndpointRows, 51);
  assert.equal(r.work.exactWitnessMarginalEqualities, 432);
  assert.equal(cmp(exact(w.jointValuesC[1]), q(-2.4641)), 0);
  assert(w.originalLimits.every(x => ['within-authored-ceiling','above-authored-ceiling'].includes(x.endpointStatus.upper)));
  assert.deepEqual(parseSkyJointEvidence(JSON.stringify(investigation)), { investigation, report: r });
});
test('a false original band remains a distinct empty family after all original bases complete', () => {
  const source = makeJointCourseExample(); source.readings[1].query.reading.temperatureC = 400;
  const { report: r } = run(source);
  assert.equal(r.observationCompatibility, 'incompatible'); assert.equal(r.jointCompatibility, 'empty-family');
  assert.equal(r.individualRanges, null); assert.deepEqual(r.hull, []); assert.equal(r.witness, null);
  assert.equal(r.originalBoundaries.length, 17); assert.equal(r.work.executedBasisCourses, 192);
});
test('zero effect and an original initial-state axis preserve point and segment degeneracy', () => {
  const source = makeJointCourseExample();
  for (const reading of source.readings) reading.source.project.solarStudy.proposal = copy(reading.source.project.solarStudy.existing);
  source.query.limits.forEach(limit => { limit.maximumDifferenceC = 0; });
  const { report: point } = run(source);
  assert.equal(point.dimension, 0); assert.equal(point.jointCompatibility, 'jointly-compatible');
  assert(point.witness.jointValuesC.every(x => cmp(exact(x), q(0)) === 0));
  source.query.limits[1].maximumDifferenceC = -Number.MIN_VALUE;
  const { report: refused } = run(source); assert.equal(refused.jointCompatibility, 'jointly-incompatible');
  assert.equal(refused.individualRanges[1].individuallyPossible, false);
  const original = makeJointCourseExample(true); original.query.limits[0] = {originalIndex:0,store:'subsurfaceC',maximumDifferenceC:0};
  const { report: segment } = run(original); assert.equal(segment.dimension, 1); assert.equal(segment.axes[0].minute, 0);
  assert.equal(segment.jointCompatibility, 'jointly-compatible');
});
test('unresolved selected geometry and malformed desired limits are refused whole', () => {
  const original = makeJointCourseExample();
  const unresolved = copy(original);
  for (const input of unresolved.readings) input.source.project.solarStudy.proposal[0].heightMaxM = 4;
  assert.throws(() => run(unresolved), /unresolved geometry endpoints/);
  for (const mutate of [
    s => { s.query.limits[1].originalIndex = s.query.limits[0].originalIndex; },
    s => { s.query.limits[0].originalIndex = 17; },
    s => { s.query.limits[0].store = 'peak'; },
    s => { s.query.limits[0].maximumDifferenceC = Infinity; },
    s => { s.query.limits[0].savedValue = -1; },
    s => { s.query.limits = Array(2); },
    s => { delete s.query.limits[1]; },
    s => { s.query.limitSource = ''; },
    s => { s.query.derived = true; },
  ]) { const source = copy(original); mutate(source); assert.throws(() => prepareSkyJointSource(source.readings, source.query)); }
  const source = prepareSkyJointSource(original.readings, original.query);
  for (const mutate of [s => {s.report={};},s => {s.model.version=2;},s => {s.model.extra='x';},s => {s.kind='other';}]) {
    const forged=copy(source); mutate(forged); assert.throws(() => parseSkyJointSource(JSON.stringify(forged)));
  }
  assert.throws(() => parseSkyJointSource('not-json'));
});
test('maximum interval and partial-last-interval courses retain original identities and bounded full work', () => {
  for (const [stepMinutes,endUtc,indices,split] of [[20,'2026-06-21T12:00:00.000Z',[20,24],12],[30,'2026-06-21T12:07:00.000Z',[16,17],8]]) {
    const source=makeJointCourseExample(true);
    for(const reading of source.readings){Object.assign(reading.source.declaration.path,{stepMinutes,endUtc});reading.query.reading.utc=endUtc;reading.query.reading.halfWidthC=30;}
    source.query.splitAfterInterval=split;
    source.query.limits=indices.map(originalIndex=>({originalIndex,store:'surfaceC',maximumDifferenceC:100}));
    const {report:r}=run(source);assert.equal(r.jointCompatibility,'jointly-compatible');
    assert.equal(r.originalBoundaries.at(-1).utc,endUtc);assert.equal(r.work.executedThermalCourses,204);
    assert.equal(r.work.executedCourseIntervals,204*indices[1]);assert(r.work.executedCourseIntervals<=4896);
    if(stepMinutes===30)assert.equal(r.originalBoundaries.at(-1).minute,487);
  }
});
test('joint clipping can require a convex combination even though no supplied vertex meets both ceilings', () => {
  const candidates=[{support:[0],weights:[q(1)]},{support:[1],weights:[q(1)]}];
  const a=Array.from({length:16},()=>q(0)),b=Array.from({length:16},()=>q(0));a[1]=q(1);b[0]=q(1);
  const no=projectJointProfileFamily(candidates,[a,b],[q(.4),q(.4)]);
  assert(no.ranges.every(r=>r.individuallyPossible));assert.equal(no.status,'jointly-incompatible');
  const yes=projectJointProfileFamily(candidates,[a,b],[q(.6),q(.6)]);
  assert.equal(yes.status,'jointly-compatible');assert.equal(yes.witness.combination.length,2);
  assert(yes.witness.values.every(v=>cmp(v,q(.6))<=0));
  assert.equal(cmp(yes.witness.weights.reduce(add,q(0)),q(1)),0);
  assert.equal(cmp(yes.witness.values.reduce(add,q(0)),q(1)),0);
  assert.deepEqual(candidates,[{support:[0],weights:[q(1)]},{support:[1],weights:[q(1)]}]);
});
