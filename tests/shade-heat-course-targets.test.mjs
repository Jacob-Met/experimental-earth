import test from 'node:test';
import assert from 'node:assert/strict';
import {minimizeThreeEpochTargetExcess} from '../shade-heat-target-margin.js';
import {prepareSkyCourseTargetSource,prepareSkyCourseTargetEvidence,parseSkyCourseTargetSource,parseSkyCourseTargetEvidence,serializeSkyCourseTargetSource,SKY_COURSE_TARGET_LIMITS} from '../shade-heat-course-targets.js';
import {makeSkyCourseTargetExample} from '../shade-heat-course-target-example.js';
import {prepareTimedSkyReadingSource,originalSkyReadingTimes} from '../shade-heat-timed-reading-source.js';
import {solveRationalLinearObjectives,solveThreeEpochLinearObjectives,verifyThreeEpochTargetLinearCertificate} from '../shade-heat-exact-linear.js';
import {rational as q,add,sub,neg,cmp} from '../vendor/chronos/exact-halfplanes.mjs';
import {prepareSolarStudy} from '../solar-occlusion.js';
import {prepareSurfaceHeatStudy} from '../surface-heat.js';
import {prepareHeatColumnStudy} from '../heat-column.js';

const ZERO=q(0),ONE=q(1),decode=v=>[BigInt(v[0]),BigInt(v[1])];
const exact=v=>[BigInt(v.exact.numerator),BigInt(v.exact.denominator)];
const simplex=()=>({rows:Array.from({length:3},(_,k)=>Array.from({length:9},(_,j)=>q(Math.floor(j/3)===k?1:0))),bounds:[ONE,ONE,ONE]});
const rising=()=>Array.from({length:64},(_,i)=>q(Math.floor(i/16)===1?1:0));
const run=raw=>prepareSkyCourseTargetEvidence(raw.readings,raw.query);
let retained;
const authored=()=>retained??=(run(makeSkyCourseTargetExample()));

test('one common epigraph retains constants, negative anchors, tied targets, redundancy and the original simplex domain',()=>{
  const a=rising(),b=a.map(v=>sub(ONE,v)),model=simplex(),before=structuredClone({a,b,model});
  const r=minimizeThreeEpochTargetExcess(model,[a,b,a],[ZERO,ZERO,ONE]);
  assert.equal(cmp(r.minimumWorstExcessC,q(.5)),0);assert.deepEqual(r.activeTargetIndices,[0,1]);
  assert.equal(cmp(r.witness.coordinates[0],q(.5)),0);assert.equal(r.targetCompatibility,'incompatible');
  assert(verifyThreeEpochTargetLinearCertificate(r.linearModel.rows,r.linearModel.bounds,r.linearModel.objective,r.linearCertificate));
  const shifted=minimizeThreeEpochTargetExcess(model,[a.map(v=>sub(v,q(1000))),b.map(v=>sub(v,q(1000)))],[ZERO,ZERO]);
  assert.equal(cmp(shifted.lowerAnchorC,q(-1000)),0);assert.equal(cmp(shifted.minimumWorstExcessC,q(-999.5)),0);
  const constant=minimizeThreeEpochTargetExcess(model,[a.map(v=>add(q(4),v)),b.map(v=>add(q(4),v))],[q(10),q(10)]);
  assert.equal(cmp(constant.minimumWorstExcessC,q(-5.5)),0);
  const single=minimizeThreeEpochTargetExcess(model,[a],[ZERO]);assert.equal(cmp(single.minimumWorstExcessC,ZERO),0);
  const bad=structuredClone(r.linearCertificate);bad.dual[0]=q(-1);
  assert.throws(()=>verifyThreeEpochTargetLinearCertificate(r.linearModel.rows,r.linearModel.bounds,r.linearModel.objective,bad),/Invalid exact optimality multipliers/);
  const falseDomain=simplex();falseDomain.bounds[0]=q(2);
  assert.throws(()=>minimizeThreeEpochTargetExcess(falseDomain,[a],[ZERO]),/simplex constraints/);
  assert.deepEqual({a,b,model},before);
});

test('all32 desired endpoints are individually attainable while one full24-record profile cannot attain them together',()=>{
  const raw=makeSkyCourseTargetExample(),before=JSON.stringify(raw),value=run(raw);retained=value;
  const r=value.report;assert.equal(JSON.stringify(raw),before);
  assert.equal(r.observationCompatibility,'compatible');assert.equal(r.targetCompatibility,'incompatible');
  assert.equal(r.targets.length,32);assert.equal(r.margin.individuallyPossibleTargets,32);
  assert(r.margin.minimumWorstExcessC.lower>0.00015&&r.margin.minimumWorstExcessC.upper<0.00016);
  assert.deepEqual(r.margin.activeTargetIndices,[10,13,30]);assert.equal(r.witness.phaseProfiles.length,3);
  assert.equal(r.witness.originalObservations.length,24);assert.equal(r.witness.originalReplays.length,3);
  assert(r.witness.originalReplays.every(p=>p.originalCourse.length===17));
  assert.equal(r.work.executedBasisCourses,768);assert.equal(r.work.executedTargetWitnessCourses,12);
  assert.equal(r.work.executedThermalCourses,840);assert.equal(r.work.executedCourseIntervals,13440);
  const e=r.exactEvidence,proof={...e.certificate,point:e.certificate.point.map(decode),dual:e.certificate.dual.map(decode),value:decode(e.certificate.value)};
  assert(verifyThreeEpochTargetLinearCertificate(e.linearModel.rows.map(row=>row.map(decode)),e.linearModel.bounds.map(decode),e.linearModel.objective.map(decode),proof));
  r.targets.forEach((target,i)=>{
    assert.equal(target.originalIndex,value.investigation.query.targets[i].originalIndex);assert.equal(target.utc,r.originalTimes[target.originalIndex].utc);
    assert.equal(target.originalReplay.utc,target.utc);assert.equal(target.originalReplay.store,target.store);
    const point=r.witness.originalReplays[0].originalCourse[target.originalIndex];
    assert.equal(cmp(exact(target.differenceC),sub(exact(point.additiveC.proposal.lower[target.store]),exact(point.additiveC.existing.lower[target.store]))),0);
    assert.equal(cmp(exact(target.excessC),sub(exact(target.differenceC),exact(target.ceilingC))),0);
  });
});

test('relaxing only the desired ceilings yields one common complete-record profile without changing any observation',()=>{
  const old=authored(),input=makeSkyCourseTargetExample();input.query.targets.forEach(t=>{t.maximumDifferenceC+=.0002;});
  const value=run(input),r=value.report;assert.equal(r.targetCompatibility,'compatible');
  assert(r.margin.minimumWorstExcessC.upper<0);assert(r.targets.every(t=>t.withinDeclaredCeiling));
  assert.deepEqual(value.investigation.readings,old.investigation.readings);assert.deepEqual(r.original,old.report.original);
  assert(r.targets.every(t=>Object.values(t.originalReplay.endpointStatus).every(x=>x==='within-authored-ceiling')));
});

test('a contradictory final original band cannot be rescued by target optimization or a fallback profile',()=>{
  const input=makeSkyCourseTargetExample();input.readings[23].query.reading.temperatureC=400;const r=run(input).report;
  assert.equal(r.observationCompatibility,'incompatible');assert.equal(r.original.firstThree.compatibility,'compatible');
  assert.equal(r.targetCompatibility,'not-evaluated-original-incompatible');assert.equal(r.margin,null);assert.equal(r.witness,null);
  assert.equal(r.exactEvidence,null);assert.equal(r.work.executedTargetWitnessCourses,0);assert.equal(r.targets.length,32);
  assert(r.targets.every(t=>t.differenceC===null&&t.individuallyPossible===null));
});

test('unfamiliar partial original clock, mixed stores and an initial target keep one profile and every source identity',()=>{
  const raw=makeSkyCourseTargetExample(),originals=[raw.readings[0],raw.readings[3],raw.readings[5]].map(input=>{
    const source=structuredClone(input.source);Object.assign(source.declaration.path,{startUtc:'2026-06-21T04:00:13.000Z',endUtc:'2026-06-21T06:07:37.000Z',stepMinutes:13});return {...input,source};
  });
  const choices=[[2,0,'subsurfaceC'],[0,5,'surfaceC'],[1,8,'subsurfaceC'],[2,10,'surfaceC'],[0,10,'subsurfaceC']];
  const readings=choices.map(([index,time,store])=>{const input=originals[index];return prepareTimedSkyReadingSource(input.source.project,input.source.declaration,{bins:input.query.bins,
    reading:{...input.query.reading,utc:originalSkyReadingTimes(input.source)[time].utc,store,temperatureC:25,halfWidthC:100,source:'Authored broad original bands on an unfamiliar partial clock'}});});
  const targets=[{originalIndex:0,store:'surfaceC',maximumDifferenceC:0},{originalIndex:3,store:'subsurfaceC',maximumDifferenceC:0},{originalIndex:7,store:'surfaceC',maximumDifferenceC:0},{originalIndex:10,store:'subsurfaceC',maximumDifferenceC:0}];
  const r=prepareSkyCourseTargetEvidence(readings,{bins:4,splitAfterIntervals:[4,7],sharingSource:'Authored shared partial-clock conditions',targets,targetSource:'Explicit original sampled no-warming objectives'}).report;
  assert.equal(r.observationCompatibility,'compatible');assert.equal(r.originalTimes.length,11);
  assert.equal(r.originalTimes.at(-1).minute,127.4);assert.equal(r.originalTimes.at(-1).utc,'2026-06-21T06:07:37.000Z');
  assert.deepEqual(r.original.readings.map(x=>[x.cellIndex,x.originalIndex,x.store]),choices.map(([s,i,t])=>[originals[s].query.reading.cellIndex,i,t]));
  assert.equal(r.witness.originalObservations.length,5);assert.equal(r.witness.originalReplays.length,3);
  assert(r.witness.originalReplays.every(p=>p.originalCourse.length===11));assert.equal(r.targets[0].originalReplay.utc,'2026-06-21T04:00:13.000Z');
});

test('complete target source admission rejects sparse, duplicate, unoffered, forged and unresolved endpoints',()=>{
  for(const change of [s=>{s.query.targets=[];},s=>{delete s.query.targets[7];},s=>{s.query.targets.push(s.query.targets[0]);},s=>{s.query.targets[0].originalIndex=17;},
    s=>{s.query.targets[0].store='airC';},s=>{s.query.targets[0].maximumDifferenceC=Infinity;},s=>{s.query.targets[0].derived={};},s=>{s.query.targetSource=' ';},s=>{s.query.optimized=true;}]){
    const s=makeSkyCourseTargetExample();change(s);assert.throws(()=>prepareSkyCourseTargetSource(s.readings,s.query));
  }
  const source=authored().investigation;assert.deepEqual(parseSkyCourseTargetSource(JSON.stringify(source)),source);
  for(const value of [{...source,report:{}},{...source,model:{...source.model,version:2}},{...source,query:{...source.query,limits:[]}}])assert.throws(()=>parseSkyCourseTargetSource(JSON.stringify(value)));
  const uncertain=makeSkyCourseTargetExample();for(const input of uncertain.readings)input.source.project.solarStudy.proposal[0].heightMaxM=4;
  assert.throws(()=>run(uncertain),/resolved existing and proposal geometry endpoints/);
});

test('source-only reopening recomputes the complete target and parent reports with every original numerical binding',()=>{
  const value=authored();assert.deepEqual(parseSkyCourseTargetEvidence(JSON.stringify(value.investigation)),value);
});

test('every admitted source remains downloadable and reopenable when pretty JSON would exceed the file allowance',()=>{
  const small=authored().investigation;assert.deepEqual(parseSkyCourseTargetSource(serializeSkyCourseTargetSource(small)),small);
  assert.throws(()=>serializeSkyCourseTargetSource({...small,report:{}}));
  const big=makeSkyCourseTargetExample();
  for(const input of big.readings){
    const p=input.source.project,heat=p.surfaceHeatStudy,lower=p.heatColumnStudy.lowerLayers,solar=p.solarStudy;p.width=p.height=20;
    for(const kind of ['existing','proposal'])p[kind]=Array.from({length:400},(_,i)=>({...p[kind][i%16],provenance:'Authored original grid cell with unchanged geometry.'}));
    p.solarStudy=prepareSolarStudy(p,solar);delete p.heatColumnStudy;p.surfaceHeatStudy=prepareSurfaceHeatStudy(p,heat);p.heatColumnStudy=prepareHeatColumnStudy(p,lower);
  }
  const admitted=prepareSkyCourseTargetSource(big.readings,big.query),before=JSON.stringify(admitted),pretty=JSON.stringify(admitted,null,2)+'\n';
  assert.equal(new Blob([before]).size,4315084);assert.equal(new Blob([pretty]).size,5793779);
  assert.throws(()=>parseSkyCourseTargetSource(pretty),/5 MiB/);
  const text=serializeSkyCourseTargetSource(admitted);assert.equal(text,before);assert.deepEqual(parseSkyCourseTargetSource(text),admitted);assert.equal(JSON.stringify(admitted),before);
});

test('maximum original clock and target matrix retain whole-inquiry allowances; exhausted work refuses atomically',()=>{
  const input=makeSkyCourseTargetExample();for(const r of input.readings){r.source.declaration.path.endUtc='2026-06-21T16:00:00.000Z';r.query.reading.temperatureC=400;}
  input.query.targets=Array.from({length:25},(_,originalIndex)=>['surfaceC','subsurfaceC'].map(store=>({originalIndex,store,maximumDifferenceC:0}))).flat();
  const r=run(input).report;assert.equal(r.targets.length,50);assert.equal(r.originalTimes.length,25);
  assert.equal(r.work.reservedThermalCourses,1980);assert.equal(r.work.courseIntervals,SKY_COURSE_TARGET_LIMITS.maxCourseIntervals);
  assert.equal(r.work.reservedWitnessProfiles,101);assert.equal(r.observationCompatibility,'incompatible');
  const model=simplex();while(model.rows.length<51){model.rows.push(Array.from({length:9},()=>ZERO));model.bounds.push(ONE);}
  const a=rising(),b=a.map(v=>sub(ONE,v)),rows=Array.from({length:50},(_,i)=>i%2?a:b),ceilings=Array.from({length:50},()=>ZERO);
  const solved=minimizeThreeEpochTargetExcess(model,rows,ceilings);assert.equal(solved.work.constraints,101);assert.equal(cmp(solved.minimumWorstExcessC,q(.5)),0);
  assert.throws(()=>minimizeThreeEpochTargetExcess(model,[...rows,a],[...ceilings,ZERO]));
  assert.throws(()=>minimizeThreeEpochTargetExcess(model,rows,ceilings,{maxRationalOperations:0}));
  assert.throws(()=>minimizeThreeEpochTargetExcess(model,rows,ceilings,{maxPivots:0}));
  assert.throws(()=>solveRationalLinearObjectives(solved.linearModel.rows,solved.linearModel.bounds,[solved.linearModel.objective]));
  assert.throws(()=>solveThreeEpochLinearObjectives(solved.linearModel.rows,solved.linearModel.bounds,[solved.linearModel.objective]));
});
