import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareThreeEpochSkySource,prepareThreeEpochSkyEvidence,parseThreeEpochSkySource,parseThreeEpochSkyEvidence,THREE_EPOCH_SKY_LIMITS} from '../shade-heat-three-epoch-course.js';
import {makeThreeEpochSkyExample} from '../shade-heat-three-epoch-example.js';
import {makeManySkyExample} from '../shade-heat-many-example.js';
import {buildThreeEpochBasis} from '../shade-heat-three-epoch-kernel.js';
import {prepareTimedSkyReadingSource} from '../shade-heat-timed-reading-source.js';
import {projectThreeEpochSkyRow,embeddedTwoEpochRows} from '../shade-heat-three-epoch-marginals.js';
import {solveRationalLinearObjectives,solveThreeEpochLinearObjectives,verifyThreeEpochLinearCertificate,SKY_LINEAR_LIMITS,THREE_EPOCH_LINEAR_LIMITS} from '../shade-heat-exact-linear.js';
import {rational as q,add,sub,mul,neg,cmp} from '../vendor/chronos/exact-halfplanes.mjs';

const restored=v=>v.map(x=>Array.isArray(x)?restored(x):BigInt(x));
const exact=v=>[BigInt(v.exact.numerator),BigInt(v.exact.denominator)];
const run=input=>prepareThreeEpochSkyEvidence(input.readings,input.query);
let cached;
const authored=()=>cached??=run(makeThreeEpochSkyExample());

test('separate nine-coordinate admission preserves the legacy six-variable boundary and exact objective certificates',()=>{
  const rows=Array.from({length:3},(_,e)=>Array.from({length:9},(_,j)=>q(Math.floor(j/3)===e?1:0))),bounds=[q(1),q(1),q(1)];
  const objectives=Array.from({length:24},(_,i)=>Array.from({length:9},(_,j)=>q(((17*i+11*j+3)%31)-15)));
  assert.equal(SKY_LINEAR_LIMITS.variables,6);assert.equal(SKY_LINEAR_LIMITS.constraints,50);
  assert.equal(THREE_EPOCH_LINEAR_LIMITS.variables,9);assert.equal(THREE_EPOCH_LINEAR_LIMITS.constraints,51);
  assert.throws(()=>solveRationalLinearObjectives(rows,bounds,objectives),/complete bounded/);
  const solved=solveThreeEpochLinearObjectives(rows,bounds,objectives);
  solved.results.forEach((proof,i)=>{
    const expected=[0,3,6].reduce((sum,offset)=>add(sum,objectives[i].slice(offset,offset+3).reduce((best,v)=>cmp(v,best)>0?v:best,q(0))),q(0));
    assert.equal(cmp(proof.value,expected),0);assert(verifyThreeEpochLinearCertificate(rows,bounds,objectives[i],proof));
  });
  assert.throws(()=>solveThreeEpochLinearObjectives(rows,bounds,objectives,{maxPivots:0}),/pivot allowance/);
  assert.throws(()=>solveThreeEpochLinearObjectives(rows,bounds,objectives,{maxRationalOperations:0}),/arithmetic allowance/);
  assert.throws(()=>solveThreeEpochLinearObjectives([Array.from({length:10},()=>q(1))],[q(1)],[]),/complete bounded/);
  const smallRows=[[q(1),q(2)],[q(-1),q(0)]],smallBounds=[q(4),q(-1)],smallObjectives=[[q(1),q(1)],[q(-1),q(2)]];
  assert.deepEqual(solveThreeEpochLinearObjectives(smallRows,smallBounds,smallObjectives),solveRationalLinearObjectives(smallRows,smallBounds,smallObjectives));
});

test('complete authored record supports three profiles while both same-coefficient one-change families are incompatible',()=>{
  const input=makeThreeEpochSkyExample(),saved=structuredClone(input),result=authored(),r=result.report;
  assert.deepEqual(input,saved);assert.equal(r.compatibility,'compatible');assert.equal(r.firstThree.compatibility,'compatible');
  assert.deepEqual(r.splitUtcs,['2026-06-21T07:00:00.000Z','2026-06-21T09:00:00.000Z']);
  assert.deepEqual(r.embeddedOneChange.map(x=>x.compatibility),['incompatible','incompatible']);
  assert.equal(r.readings.length,24);assert.equal(r.work.uniqueSources,3);assert.equal(r.work.executedBasisCourses,768);
  assert.equal(r.work.allRecordOptimization.variables,9);assert.equal(r.work.allRecordOptimization.constraints,51);
  assert.equal(r.exactEvidence.all.objectives.length,68);assert.equal(r.originalTimes.length,17);
  assert(r.rangeChanges.narrowed>0);assert(r.work.executedThermalCourses<=r.work.reservedThermalCourses);
  const matrix=r.exactEvidence.all.linearModel,rows=restored(matrix.rows),rhs=restored(matrix.bounds);
  for(const proof of r.exactEvidence.all.objectives){
    const certificate=JSON.parse(JSON.stringify(proof.certificate));
    for(const key of ['point','dual'])certificate[key]=restored(certificate[key]);certificate.value=restored(certificate.value);
    assert(verifyThreeEpochLinearCertificate(rows,rhs,restored(proof.projection.coefficients),certificate));
  }
  for(const w of r.witnesses){
    assert.equal(w.phaseProfiles.length,3);assert.equal(w.masses.length,64);assert.equal(w.originalObservations.length,24);
    for(const phase of w.phaseProfiles)assert.equal(cmp(phase.map(exact).reduce(add,q(0)),q(1)),0);
    assert.equal(cmp(w.masses.map(exact).reduce(add,q(0)),q(1)),0);
    assert.equal(w.originalReplays.length,3);assert(w.originalReplays.every(v=>v.originalCourse.length===17));
    assert.equal(w.exactMarginalEqualities,17*8*3);
  }
});

test('three original broad bands retain no-gain equality and both embedded one-change ranges',()=>{
  const input=makeThreeEpochSkyExample();input.readings=input.readings.slice(0,3);
  for(const r of input.readings){r.query.reading.temperatureC=20;r.query.reading.halfWidthC=100;}
  const r=run(input).report;
  assert.equal(r.compatibility,'compatible');assert.equal(r.rangeChanges.narrowed,0);assert.equal(r.rangeChanges.unchanged,34);
  assert.deepEqual(r.embeddedOneChange.map(x=>x.compatibility),['compatible','compatible']);
  for(let i=0;i<17;i++)for(const store of ['surfaceC','subsurfaceC'])for(const side of ['lower','upper'])
    assert.deepEqual(r.pointwiseCourse[i].ranges[store][side].differenceC,r.firstThree.pointwiseCourse[i].ranges[store][side].differenceC);
});

test('a contradictory final original record cannot fall back to a reference or a substituted profile',()=>{
  const input=makeThreeEpochSkyExample();input.readings.at(-1).query.reading.temperatureC=400;
  const r=run(input).report;
  assert.equal(r.compatibility,'incompatible');assert.equal(r.firstThree.compatibility,'compatible');
  assert.equal(r.readings.at(-1).temperatureC,400);assert.deepEqual(r.witnesses,[]);
  assert(r.pointwiseCourse.every(x=>x.ranges===null));assert.equal(r.exactEvidence.all.certificate.status,'incompatible');
  assert(r.embeddedOneChange.every(x=>x.compatibility==='incompatible'));
});

test('unfamiliar partial original clock and mixed stores preserve receiver order, initial observation and full fixed-profile replay',()=>{
  const prior=makeManySkyExample(),unique=[prior.readings[0],prior.readings[3],prior.readings[5]],splits=[4,7];
  const originals=unique.map(input=>{
    const source=structuredClone(input.source);
    Object.assign(source.declaration.path,{startUtc:'2026-06-21T04:00:13.000Z',endUtc:'2026-06-21T06:07:37.000Z',stepMinutes:13});
    return {...input,source};
  });
  const bases=originals.map(input=>buildThreeEpochBasis(input,splits)),choices=[[2,0,'subsurfaceC'],[0,5,'surfaceC'],[1,8,'subsurfaceC'],[2,10,'surfaceC'],[0,10,'subsurfaceC']];
  const readings=choices.map(([sourceIndex,index,store])=>{
    const input=originals[sourceIndex],trace=bases[sourceIndex].triples[49].trace;
    return prepareTimedSkyReadingSource(input.source.project,input.source.declaration,{bins:input.query.bins,reading:{...input.query.reading,
      utc:trace.originalBoundaries[index].utc,store,temperatureC:trace.states.existing.lower[index][store],halfWidthC:.00001}});
  });
  const r=prepareThreeEpochSkyEvidence(readings,{bins:4,splitAfterIntervals:splits,sharingSource:'Authored unfamiliar partial-clock control, no physical history claim'}).report;
  assert.equal(r.compatibility,'compatible');assert.equal(r.originalTimes.length,11);
  assert.equal(r.originalTimes.at(-1).utc,'2026-06-21T06:07:37.000Z');assert.equal(r.originalTimes.at(-1).minute,127.4);
  assert.equal(r.originalTimes.at(-1).thermalMinute,127.4);assert.equal(r.readings[0].originalIndex,0);
  assert.deepEqual(r.readings.map(x=>[x.cellIndex,x.originalIndex,x.store]),choices.map(([s,i,t])=>[originals[s].query.reading.cellIndex,i,t]));
  assert(r.witnesses.every(w=>w.originalObservations.length===5&&w.originalReplays.length===3&&w.phaseProfiles.length===3));
});

test('two original changes, dense evidence, source identity and complete work are admitted before a result',()=>{
  const input=makeThreeEpochSkyExample();
  for(const splits of [[],[1],[0,2],[2,2],[3,2],[2,16],[1,,],[1,Infinity],[1.5,2]])
    assert.throws(()=>prepareThreeEpochSkySource(input.readings,{...input.query,splitAfterIntervals:splits}));
  const holes=Array(2);holes[0]=1;assert.throws(()=>buildThreeEpochBasis(input.readings[0],holes),/Two ordered/);
  for(const change of [s=>{delete s.readings[3];},s=>{s.readings.push(s.readings[0]);},s=>{s.readings=s.readings.slice(0,2);},
    s=>{s.readings[23].source.declaration.reservoirC+=1;},s=>{s.query.extra='derived';},s=>{s.query.bins=8;},
    s=>{for(const r of s.readings)r.source.declaration.path.endUtc='2026-06-22T04:00:00.000Z';}]){
    const s=makeThreeEpochSkyExample();change(s);assert.throws(()=>prepareThreeEpochSkySource(s.readings,s.query));
  }
  const unresolved=makeThreeEpochSkyExample();for(const r of unresolved.readings)r.source.project.solarStudy.existing[0].heightMaxM=4;
  assert.throws(()=>run(unresolved),/unresolved existing endpoints/);
});

test('source-only replay recomputes the complete report and rejects calculated outputs and false additive rows',()=>{
  const result=authored(),saved=JSON.stringify(result.investigation);
  assert.deepEqual(parseThreeEpochSkySource(saved),result.investigation);
  assert.deepEqual(parseThreeEpochSkyEvidence(saved),result);
  assert.throws(()=>parseThreeEpochSkySource(JSON.stringify(result)),/Unsupported/);
  const altered=structuredClone(result.investigation);altered.report={compatibility:'compatible'};
  assert.throws(()=>parseThreeEpochSkySource(JSON.stringify(altered)),/Unsupported/);
  const row=restored(result.report.exactEvidence.observedTripleRows[0]);projectThreeEpochSkyRow(row);
  const before=structuredClone(row);embeddedTwoEpochRows([row],0);embeddedTwoEpochRows([row],1);assert.deepEqual(row,before);
  row[63]=add(row[63],q(1));assert.throws(()=>projectThreeEpochSkyRow(row),/additive identity/);
  assert.throws(()=>embeddedTwoEpochRows([before],2),/two declared/);
});

test('maximal original clock retains all25 times and reserves every64-combination course before incompatibility',()=>{
  const input=makeThreeEpochSkyExample();
  for(const r of input.readings){r.source.declaration.path.endUtc='2026-06-21T16:00:00.000Z';r.query.reading.temperatureC=400;}
  const r=run(input).report;
  assert.equal(r.compatibility,'incompatible');assert.equal(r.originalTimes.length,25);
  assert.equal(r.work.basisCourses,768);assert.equal(r.work.reservedThermalCourses,1968);
  assert.equal(r.work.courseIntervals,THREE_EPOCH_SKY_LIMITS.maxCourseIntervals);assert.equal(r.work.objectivesPerFamily,100);
  assert.equal(r.work.allRecordOptimization.constraints,51);assert.equal(r.readings.length,24);
});
