import test from 'node:test';
import assert from 'node:assert/strict';
import { makeTimedSkyExample } from '../shade-heat-timed-example.js';
import { makeJointCourseExample } from '../shade-heat-joint-example.js';
import { prepareTimedSkyCourseSource,prepareTimedSkyCourseEvidence,parseTimedSkyCourseSource,parseTimedSkyCourseEvidence,TIMED_SKY_COURSE_LIMITS } from '../shade-heat-timed-course.js';
import { prepareTimedSkyReadingSource,parseTimedSkyReadingSource,originalSkyReadingTimes } from '../shade-heat-timed-reading-source.js';
import { prepareSkyCourseEvidence } from '../shade-heat-course-evidence.js';
import { buildOriginalBoundaryBasis } from '../shade-heat-epoch-kernel.js';
import { rational as q,add,sub,cmp } from '../vendor/chronos/exact-halfplanes.mjs';

const copy=structuredClone,exact=x=>[BigInt(x.exact.numerator),BigInt(x.exact.denominator)];
const run=s=>prepareTimedSkyCourseEvidence(s.readings,s.query);
const source=makeTimedSkyExample(),before=JSON.stringify(source),authored=run(source);
const width=row=>sub(exact(row.ranges.surfaceC.upper.differenceC),exact(row.ranges.surfaceC.lower.differenceC));

test('an unchanged earlier reading narrows the same original receiver course while preserving all original times',()=>{
  const r=authored.report;assert.equal(r.compatibility,'compatible');assert.equal(r.firstTwo.compatibility,'compatible');
  assert.deepEqual(r.readings.map(x=>[x.cellIndex,x.originalIndex]),[[7,12],[7,16],[7,4]]);
  assert.deepEqual(r.readings.map(x=>x.temperatureC),source.readings.map(x=>x.query.reading.temperatureC));
  assert.equal(r.pointwiseCourse.length,17);assert.equal(r.finalUtc,'2026-06-21T12:00:00.000Z');
  assert(cmp(width(r.firstTwo.pointwiseCourse[4]),q(2.5))>0);assert(cmp(width(r.pointwiseCourse[4]),q(.013))<0);
  for (const [i,row] of r.pointwiseCourse.entries())assert(cmp(width(row),width(r.firstTwo.pointwiseCourse[i]))<=0);
  assert.equal(r.work.executedBasisCourses,192);assert.equal(r.numericalEvidence.points.length,3);
  assert.equal(JSON.stringify(source),before);
});

test('one fixed profile retains exact bands and separate original replay statuses at each observation time',()=>{
  const r=authored.report;assert(r.witnesses.length>0);
  for (const witness of r.witnesses) {
    assert.equal(cmp(witness.masses.map(exact).reduce(add,q(0)),q(1)),0);
    for (const [i,replay] of witness.originalReplays.entries()) {
      const reading=r.readings[i],observation=replay.originalObservation;
      assert.deepEqual([observation.originalIndex,observation.utc,observation.store],[reading.originalIndex,reading.utc,reading.store]);
      assert.equal(replay.originalCourse.length,17);
      assert(cmp(exact(witness.observedC[i]),exact(reading.bandC.lower))>=0);
      assert(cmp(exact(witness.observedC[i]),exact(reading.bandC.upper))<=0);
      const row=replay.originalCourse[reading.originalIndex];
      assert.equal(cmp(exact(row.additiveC.existing.lower[reading.store]),exact(witness.observedC[i])),0);
      for (const bound of ['lower','upper']) {
        const value=observation.originalC[bound];assert.equal(value,row.originalC.existing[bound][reading.store]);
        const within=cmp(q(value),exact(reading.bandC.lower))>=0&&cmp(q(value),exact(reading.bandC.upper))<=0;
        assert.equal(replay.originalObservationEndpointStatus[bound],within?'within-original-band':'outside-original-band');
      }
    }
  }
});

test('strict source-only roundtrip preserves three histories and excludes calculated output',()=>{
  const s=makeTimedSkyExample();[4,16,8].forEach((bins,i)=>{s.readings[i].query.bins=bins;});
  const first=run(s);assert.deepEqual(first.investigation.readings.map(x=>x.query.bins),[4,16,8]);
  assert.deepEqual(parseTimedSkyCourseEvidence(JSON.stringify(first.investigation)),first);
  assert.deepEqual(parseTimedSkyReadingSource(JSON.stringify(s.readings[2])),s.readings[2]);
  for(const mutate of [x=>{x.report={};},x=>{x.model.version=2;},x=>{x.query.result={};},x=>{x.kind='other';}]){
    const forged=copy(first.investigation);mutate(forged);assert.throws(()=>parseTimedSkyCourseSource(JSON.stringify(forged)));
  }
});

test('legacy final-only three-receiver specialization preserves accepted exact envelopes and numerical witnesses',()=>{
  const s=makeJointCourseExample(),query={bins:4,splitAfterInterval:8,sharingSource:s.query.sharingSource};
  const old=prepareSkyCourseEvidence(s.readings,query),timed=prepareTimedSkyCourseEvidence(s.readings,query);
  assert.deepEqual(timed.investigation.readings,old.investigation.readings);
  assert.deepEqual(timed.report.pointwiseCourse,old.report.pointwiseCourse);
  assert.deepEqual(timed.report.originalStatic,old.report.originalStatic);
  assert.deepEqual(timed.report.additiveStatic,old.report.additiveStatic);
  const witnesses=copy(timed.report.witnesses);
  for(const w of witnesses)for(const replay of w.originalReplays)delete replay.originalObservation;
  assert.deepEqual(witnesses,old.report.witnesses);
});

test('a valid contradictory earlier band completes every original basis and cannot rescue or widen prior evidence',()=>{
  const s=makeTimedSkyExample();s.readings[2].query.reading.temperatureC=400;
  const r=run(s).report;assert.equal(r.firstTwo.compatibility,'compatible');assert.equal(r.compatibility,'incompatible');
  assert.equal(r.work.executedBasisCourses,192);assert.equal(r.work.executedWitnessCourses,0);
  assert(r.pointwiseCourse.every(row=>row.ranges===null));assert.deepEqual(r.witnesses,[]);
  assert.deepEqual(r.firstTwo.pointwiseCourse,authored.report.firstTwo.pointwiseCourse);
});

test('duplicate identities, changed repeated receiver declarations and malformed original time sources refuse whole',()=>{
  const original=makeTimedSkyExample();
  for(const mutate of [
    s=>{s.readings[2].query.reading.utc=s.readings[1].query.reading.utc;},
    s=>{s.readings[2].source.project.heatColumnStudy.lowerLayers.existing.capacityJm2K*=2;},
    s=>{s.readings[2].query.reading.utc='2026-06-21T06:01:00.000Z';},
    s=>{s.readings[2].query.reading.utc='2026-06-21T06:00:00Z';},
    s=>{s.readings[2].query.reading.store='mean';},
    s=>{s.readings[2].query.reading.cellIndex=5;},
    s=>{s.readings[2].query.reading.aggregation='interval-mean';},
    s=>{s.readings[2].query.reading.temperatureC=Infinity;},
    s=>{s.readings[2].query.reading.source='';},
    s=>{s.readings[2].query.reading.result={};},
    s=>{s.readings[2].source.declaration.reservoirC+=1;},
    s=>{s.readings=Array(3);},s=>{delete s.readings[1];},s=>{s.query.bins=8;},s=>{s.query.splitAfterInterval=16;}
  ]){const s=copy(original);mutate(s);assert.throws(()=>prepareTimedSkyCourseSource(s.readings,s.query));}
  const old=makeJointCourseExample().readings[0];old.query.reading.utc='2026-06-21T06:00:00.000Z';
  assert.throws(()=>parseTimedSkyReadingSource(JSON.stringify(old)),/final UTC/);
});

test('partial original courses admit mixed components and an original initial state without altering the full course',()=>{
  const initial=makeJointCourseExample().readings[0];
  Object.assign(initial.source.declaration.path,{startUtc:'2026-06-21T04:00:13.000Z',endUtc:'2026-06-21T06:07:37.000Z',stepMinutes:13});
  const basis=buildOriginalBoundaryBasis(initial,4),pair=basis.pairs.find(x=>x.early===1&&x.late===2);
  const choices=[[0,'subsurfaceC'],[5,'subsurfaceC'],[10,'surfaceC']];
  const readings=choices.map(([index,store])=>prepareTimedSkyReadingSource(initial.source.project,initial.source.declaration,{bins:4,reading:{
    ...initial.query.reading,utc:basis.originalBoundaries[index].utc,store,temperatureC:pair.trace.states.existing.lower[index][store],halfWidthC:.001}}));
  const r=prepareTimedSkyCourseEvidence(readings,{bins:4,splitAfterInterval:4,sharingSource:'Authored partial original mixed-temperature control'}).report;
  assert.equal(r.compatibility,'compatible');assert.equal(r.pointwiseCourse.length,11);
  assert.equal(r.pointwiseCourse.at(-1).minute,127.4);assert.equal(r.pointwiseCourse.at(-1).thermalMinute,127.4);
  assert.deepEqual(r.readings.map(x=>[x.originalIndex,x.store]),choices);
  assert(r.witnesses.every(w=>w.originalReplays.every((v,i)=>v.originalObservation.utc===readings[i].query.reading.utc)));
});

test('24 intervals reserve all original-time families and no truncation; unresolved observation endpoints refuse',()=>{
  const s=makeTimedSkyExample();
  for(const original of s.readings){original.source.declaration.path.endUtc='2026-06-21T16:00:00.000Z';original.query.reading.temperatureC=400;}
  const r=run(s).report;assert.equal(r.intervalCount,24);assert.equal(r.pointwiseCourse.length,25);
  assert.equal(r.work.reservedWitnessProfiles,100);assert.equal(r.work.reservedThermalCourses,1392);
  assert.equal(r.work.courseObjectiveMixtureTerms,TIMED_SKY_COURSE_LIMITS.maxCourseObjectiveMixtureTerms);
  assert.equal(r.work.executedCourseIntervals,4608);
  const bad=makeTimedSkyExample();for(const original of bad.readings)original.source.project.solarStudy.existing[0].heightMaxM=4;
  assert.throws(()=>run(bad),/unresolved existing endpoints/);
});
