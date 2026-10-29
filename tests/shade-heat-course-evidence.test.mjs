import test from 'node:test';
import assert from 'node:assert/strict';
import { makeThirdReceiverExample } from '../shade-heat-third-example.js';
import { prepareThirdReceiverEvidence } from '../shade-heat-third-receiver.js';
import { prepareSkyCourseSource, prepareSkyCourseEvidence, parseSkyCourseEvidence, SKY_COURSE_LIMITS } from '../shade-heat-course-evidence.js';
import { consequences } from '../shade-heat-epoch-kernel.js';
import { intersectThreeRationalProfileBands } from '../shade-heat-profile-three-bands.js';
import { rational as q, add, sub, cmp } from '../vendor/chronos/exact-halfplanes.mjs';

const example = () => { const raw=makeThirdReceiverExample();return {readings:raw.readings,query:{bins:4,splitAfterInterval:8,sharingSource:raw.query.sharingSource}}; };
const run = input => prepareSkyCourseEvidence(input.readings,input.query);
const fraction = value => [BigInt(value.exact.numerator),BigInt(value.exact.denominator)];
const input=example(),saved=JSON.stringify(input),authored=run(input);

 test('Original final bands constrain an earlier cooling course and later warming with exact accepted final parity',()=>{
  const r=authored.report;
  assert.equal(r.compatibility,'compatible');assert.equal(r.pointwiseCourse.length,17);
  assert.deepEqual(r.pointwiseCourse.map(p=>p.index),Array.from({length:17},(_,i)=>i));
  assert.equal(r.pointwiseCourse[8].utc,'2026-06-21T08:00:00.000Z');
  assert.ok(r.pointwiseCourse[8].ranges.surfaceC.upper.differenceC.upper < -2);
  assert.ok(r.pointwiseCourse[9].ranges.surfaceC.upper.differenceC.upper < 0);
  assert.ok(r.pointwiseCourse[10].ranges.surfaceC.lower.differenceC.lower > 0);
  assert.ok(r.pointwiseCourse[12].ranges.subsurfaceC.upper.differenceC.upper < 0);
  assert.ok(r.pointwiseCourse[13].ranges.subsurfaceC.lower.differenceC.lower > 0);
  const final=prepareThirdReceiverEvidence(input.readings,{bins:4,splitAfterIntervals:[8],sharingSource:input.query.sharingSource}).report.boundaries[0];
  assert.deepEqual(r.pointwiseCourse.at(-1).ranges,final.ranges);
  assert.deepEqual(r.originalStatic,final.originalStatic);assert.deepEqual(r.additiveStatic,final.additiveStatic);
  assert.deepEqual(r.witnesses.map(w=>w.id),[0,30,2]);
  assert.equal(r.work.executedBasisCourses,192);assert.equal(r.work.executedWitnessCourses,36);
  assert.equal(r.work.executedThermalCourses,228);assert.equal(r.work.executedCourseIntervals,3648);
  assert.equal(JSON.stringify(input),saved);
 });

 test('Every time extreme binds one complete common-profile witness with exact final bands and separate original replay',()=>{
  const r=authored.report;
  for(const row of r.pointwiseCourse)for(const store of ['surfaceC','subsurfaceC'])for(const [bound,other] of [['lower','upper'],['upper','lower']]){
   const extreme=row.ranges[store][bound],w=r.witnesses.find(w=>w.id===extreme.witnessId);assert.ok(w);
   const state=w.originalReplays[0].originalCourse[row.index];
   assert.deepEqual(state.utc,row.utc);assert.equal(state.thermalMinute,row.thermalMinute);
   assert.equal(cmp(sub(fraction(state.additiveC.proposal[bound][store]),fraction(state.additiveC.existing[other][store])),fraction(extreme.differenceC)),0);
  }
  for(const w of r.witnesses){
   assert.equal(cmp(w.masses.reduce((sum,mass)=>add(sum,fraction(mass)),q(0)),q(1)),0);
   for(const phase of w.phaseProfiles)assert.equal(cmp(phase.reduce((sum,mass)=>add(sum,fraction(mass)),q(0)),q(1)),0);
   assert.equal(w.originalReplays.length,3);
   w.originalReplays.forEach((replay,index)=>{
    assert.equal(replay.originalCourse.length,17);
    const band=r.readings[index].bandC;
    assert.ok(cmp(fraction(w.observedC[index]),fraction(band.lower))>=0);
    assert.ok(cmp(fraction(w.observedC[index]),fraction(band.upper))<=0);
    for(const bound of ['lower','upper']){
     const actual=q(replay.originalFinalC.existing[bound].surfaceC);
     const within=cmp(actual,fraction(band.lower))>=0&&cmp(actual,fraction(band.upper))<=0;
     assert.equal(replay.originalObservationEndpointStatus[bound],within?'within-original-band':'outside-original-band');
    }
   });
   assert.ok(w.maximumReplayResidualC.upper<=1e-9);
  }
 });

 test('Pointwise extreme faces can require different profiles rather than one attainable envelope course',()=>{
  const family=intersectThreeRationalProfileBands(Array.from({length:3},()=>Array.from({length:4},()=>q(0))),Array.from({length:3},()=>({temperatureC:0,halfWidthC:0})));
  const coefficients=values=>values.map(value=>({final:Object.fromEntries(['existing','proposal'].map(target=>[target,Object.fromEntries(['lower','upper'].map(bound=>[bound,{surfaceC:q(target==='existing'?0:value),subsurfaceC:q(target==='existing'?0:value)}]))]))}));
  const early=consequences(family.candidates,coefficients([0,1,1,1]));
  const late=consequences(family.candidates,coefficients([1,0,1,1]));
  assert.equal(early.ranges.surfaceC.lower.witnessId,0);assert.equal(late.ranges.surfaceC.lower.witnessId,1);
  assert.equal(early.ranges.surfaceC.lower.differenceC.lower,0);assert.equal(late.ranges.surfaceC.lower.differenceC.lower,0);
  // Both minima would require w0=1 and w1=1, contradicting exact mass one.
  for(const c of family.candidates){const weights=Array(4).fill(q(0));c.support.forEach((bin,i)=>weights[bin]=c.weights[i]);assert.ok(cmp(weights[0],q(1))!==0||cmp(weights[1],q(1))!==0);}
 });

 test('Source-only fresh replay preserves three histories and does not adopt derived results or earlier mutated reports',()=>{
  const source=example();[4,16,8].forEach((bins,index)=>source.readings[index].query.bins=bins);
  const normalized=prepareSkyCourseSource(source.readings,source.query);
  assert.deepEqual(normalized.readings.map(r=>r.query.bins),[4,16,8]);
  const first=parseSkyCourseEvidence(JSON.stringify(normalized)),expected=structuredClone(first);
  first.report.pointwiseCourse[8].ranges.surfaceC.lower.differenceC.lower=-999;
  assert.deepEqual(parseSkyCourseEvidence(JSON.stringify(normalized)),expected);
  for(const raw of [{...normalized,report:{}},{...normalized,reuse:{}},{...normalized,model:{...normalized.model,coefficient:'changed'}},
   {...normalized,query:{...normalized.query,result:{}}}])assert.throws(()=>parseSkyCourseEvidence(JSON.stringify(raw)));
  assert.throws(()=>parseSkyCourseEvidence('null'));assert.throws(()=>parseSkyCourseEvidence({}));
 });

 test('An incompatible final reading still completes all three bases and retains every original boundary without a fabricated course',()=>{
  const source=example();source.readings[2].query.reading.temperatureC=50;
  const r=run(source).report;assert.equal(r.compatibility,'incompatible');assert.equal(r.pointwiseCourse.length,17);
  assert.ok(r.pointwiseCourse.every(p=>p.ranges===null));assert.deepEqual(r.witnesses,[]);
  assert.equal(r.work.executedBasisCourses,192);assert.equal(r.work.executedWitnessCourses,0);
  assert.equal(r.numericalEvidence.points.length,3);assert.ok(r.numericalEvidence.points.every(p=>p.originalBoundaryScreens.length===17));
 });

 test('The actual24-interval maximum retains all25original states within its complete course and witness reservation',()=>{
  const source=example();source.query.splitAfterInterval=23;
  for(const reading of source.readings){reading.source.declaration.path.endUtc='2026-06-21T16:00:00.000Z';reading.query.reading.utc='2026-06-21T16:00:00.000Z';reading.query.reading.temperatureC=50;}
  const r=run(source).report;assert.equal(r.intervalCount,24);assert.equal(r.pointwiseCourse.length,25);
  assert.equal(r.pointwiseCourse.at(-1).utc,'2026-06-21T16:00:00.000Z');assert.equal(r.work.reservedWitnessProfiles,100);
  assert.equal(r.work.reservedThermalCourses,SKY_COURSE_LIMITS.maxCourses);assert.equal(r.work.reservedThermalCourses,1392);
  assert.equal(r.work.courseIntervals,33408);assert.equal(r.work.replayEndpointRows,7500);
  assert.equal(r.work.courseObjectiveMixtureTerms,17612800);assert.equal(r.work.executedCourseIntervals,4608);
 });

 test('Partial original intervals keep exact source clocks and actual thermal endpoints rather than substituted sample times',()=>{
  const source=example();source.query.splitAfterInterval=4;
  for(const r of source.readings){r.source.declaration.path.startUtc='2026-06-21T04:00:13.000Z';r.source.declaration.path.endUtc='2026-06-21T06:07:37.000Z';r.source.declaration.path.stepMinutes=13;r.query.reading.utc='2026-06-21T06:07:37.000Z';r.query.reading.temperatureC=50;}
  const r=run(source).report;assert.equal(r.pointwiseCourse.length,11);
  assert.equal(r.pointwiseCourse[0].utc,'2026-06-21T04:00:13.000Z');assert.equal(r.pointwiseCourse[1].utc,'2026-06-21T04:13:13.000Z');
  assert.equal(r.pointwiseCourse.at(-1).utc,'2026-06-21T06:07:37.000Z');
  assert.equal(r.pointwiseCourse.at(-1).minute,127.4);assert.equal(r.pointwiseCourse.at(-1).thermalMinute,127.4);
 });

 test('Zero effects retain exact ties while malformed sources, boundaries and unsupported requests refuse whole',()=>{
  const source=example();source.readings.forEach(r=>{r.source.declaration.diffuseHorizontalWm2=0;r.source.declaration.directNormalWm2=0;r.query.reading.temperatureC=20;r.query.reading.halfWidthC=0;});
  const r=run(source).report;assert.equal(r.compatibility,'compatible');assert.deepEqual(r.witnesses.map(w=>w.id),[0]);
  for(const point of r.pointwiseCourse)for(const store of ['surfaceC','subsurfaceC'])for(const bound of ['lower','upper']){assert.equal(point.ranges[store][bound].witnessId,0);assert.equal(cmp(fraction(point.ranges[store][bound].differenceC),q(0)),0);}
  for(const splitAfterInterval of [0,16,24,-1,1.5,'8'])assert.throws(()=>prepareSkyCourseSource(input.readings,{...input.query,splitAfterInterval}));
  for(const readings of [Array(3),[input.readings[0],,input.readings[2]],input.readings.slice(0,2),[input.readings[0],input.readings[1],input.readings[1]]])assert.throws(()=>prepareSkyCourseSource(readings,input.query));
  const mismatch=example();mismatch.readings[2].source.declaration.reservoirC+=1;assert.throws(()=>run(mismatch),/agree exactly/);
  assert.throws(()=>prepareSkyCourseSource(input.readings,{...input.query,bins:8}));
  assert.throws(()=>prepareSkyCourseSource(input.readings,{...input.query,inspectMinute:1}));
 });
