import test from 'node:test';
import assert from 'node:assert/strict';
import {makeManySkyExample} from '../shade-heat-many-example.js';
import {prepareManySkyCourseEvidence,inspectManySkyCourseWork} from '../shade-heat-many-course.js';
import {prepareTimedSkyReadingSource,originalSkyReadingTimes} from '../shade-heat-timed-reading-source.js';
import {buildOriginalBoundaryBasis} from '../shade-heat-epoch-kernel.js';
import {prepareRecordBoundarySource,prepareRecordBoundaryEvidence,parseRecordBoundarySource,
  parseRecordBoundaryEvidence,RECORD_BOUNDARY_LIMITS} from '../shade-heat-record-boundaries.js';
import {parseRecordBoundaryOriginals} from '../shade-heat-record-boundaries-inputs.js';

const query=(input,splits)=>({bins:4,splitAfterIntervals:splits,sharingSource:input.query.sharingSource});
const value=x=>[BigInt(x.exact.numerator),BigInt(x.exact.denominator)];
const compare=(a,b)=>{const [an,ad]=value(a),[bn,bd]=value(b),x=an*bd-bn*ad;return x<0n?-1:x>0n?1:0;};

test('Complete24-record comparison retains every offered alternative and narrows15 compatible reference times to8',()=>{
  const input=makeManySkyExample(),before=JSON.stringify(input);
  const {investigation,report:r}=prepareRecordBoundaryEvidence(input.readings,query(input,Array.from({length:15},(_,i)=>i+1)));
  assert.equal(JSON.stringify(input),before);assert.equal(investigation.readings.length,24);
  assert.deepEqual(r.boundaryComparison.firstThreeCompatible,Array.from({length:15},(_,i)=>i));
  assert.deepEqual(r.boundaryComparison.allRecordsCompatible,[7]);
  assert.equal(r.boundaries.length,15);assert.equal(r.boundaryComparison.rejectedByAdditionalRecords.length,14);
  assert.equal(r.work.executedBasisCourses,15*192);assert.equal(r.originalTimes.length,17);
  assert.equal(r.work.executedThermalCourses,r.boundaries.reduce((n,b)=>n+b.report.work.executedThermalCourses,0));
  for(const b of r.boundaries){
    assert.equal(b.report.readings.length,24);
    if(b.splitAfterInterval!==8){assert.equal(b.report.exactEvidence.all.status,'incompatible');assert.equal(b.report.witnesses.length,0);}
  }
  for(const row of r.pointwiseCourse)for(const store of ['surfaceC','subsurfaceC'])for(const side of ['lower','upper']){
    const end=row.ranges[store][side];assert.deepEqual(end.attainments.map(a=>a.splitAfterInterval),[8]);
    const origin=end.attainments[0],original=r.boundaries[origin.offeredIndex].report.pointwiseCourse[row.index].ranges[store][side];
    assert.deepEqual(end.differenceC,original.differenceC);assert.equal(origin.witnessId,original.witnessId);
    assert.equal(origin.proofIndex,original.proofIndex);
  }
});

test('One offered boundary is the unchanged maintained evaluator with an exact source reservation',()=>{
  const input=makeManySkyExample(),q=query(input,[8]);
  const r=prepareRecordBoundaryEvidence(input.readings,q).report;
  const direct=prepareManySkyCourseEvidence(input.readings,input.query).report;
  assert.deepEqual(r.boundaries[0].report,direct);
  assert.deepEqual(r.work.perBoundary,inspectManySkyCourseWork(input.readings,input.query));
  assert.equal(r.work.reservedCourseIntervals,direct.work.courseIntervals);
});

test('Unsorted offers preserve their identities; union bounds equal independent ordered exact extrema',()=>{
  const input=makeManySkyExample();
  const readings=input.readings.map(r=>{r=structuredClone(r);r.query.reading.halfWidthC=100;return r;});
  const {report:r}=prepareRecordBoundaryEvidence(readings,query(input,[12,3,8]));
  assert.deepEqual(r.boundaries.map(b=>b.splitAfterInterval),[12,3,8]);
  assert.equal(r.boundaryComparison.allRecordsCompatible.length,3);
  for(const row of r.pointwiseCourse)for(const store of ['surfaceC','subsurfaceC'])for(const side of ['lower','upper']){
    const candidates=r.boundaries.map(b=>({offeredIndex:b.offeredIndex,split:b.splitAfterInterval,
      endpoint:b.report.pointwiseCourse[row.index].ranges[store][side]}));
    candidates.sort((a,b)=>compare(a.endpoint.differenceC,b.endpoint.differenceC));
    const extreme=(side==='lower'?candidates[0]:candidates.at(-1)).endpoint.differenceC;
    assert.equal(compare(row.ranges[store][side].differenceC,extreme),0);
    const tied=candidates.filter(c=>compare(c.endpoint.differenceC,extreme)===0).map(c=>c.offeredIndex).sort((a,b)=>a-b);
    assert.deepEqual(row.ranges[store][side].attainments.map(a=>a.offeredIndex).sort((a,b)=>a-b),tied);
  }
  assert.equal(r.pointwiseCourse[0].ranges.surfaceC.lower.attainments.length,3);
});

test('A three-record inquiry makes no false information gain and retains all exact boundary ties',()=>{
  const input=makeManySkyExample(),readings=input.readings.slice(0,3);
  const r=prepareRecordBoundaryEvidence(readings,query(input,[2,8,13])).report;
  assert.deepEqual(r.boundaryComparison.firstThreeCompatible,r.boundaryComparison.allRecordsCompatible);
  assert.equal(r.rangeChanges.narrowed,0);assert.equal(r.rangeChanges.unchanged,34);
  for(const row of r.pointwiseCourse)for(const store of ['surfaceC','subsurfaceC'])for(const side of ['lower','upper'])
    assert.deepEqual(row.ranges[store][side].differenceC,r.firstThree.pointwiseCourse[row.index].ranges[store][side].differenceC);
});

test('A final-record contradiction rejects the entire offered family while retaining the reference and every original time',()=>{
  const input=makeManySkyExample();input.readings.at(-1).query.reading.temperatureC=400;
  const r=prepareRecordBoundaryEvidence(input.readings,query(input,[8,2])).report;
  assert.equal(r.compatibility,'incompatible');assert.equal(r.firstThree.compatibility,'compatible');
  assert.deepEqual(r.boundaryComparison.allRecordsCompatible,[]);assert.equal(r.originalTimes.length,17);
  assert.ok(r.pointwiseCourse.every(t=>t.ranges===null));
  assert.ok(r.boundaries.every(b=>b.report.readings.length===24&&b.report.readings.at(-1).temperatureC===400));
});

test('Unfamiliar mixed-store record preserves a partial final original interval and its fixed-profile source courses',()=>{
  const authored=makeManySkyExample(),unique=[authored.readings[0],authored.readings[3],authored.readings[5]];
  const originals=unique.map(input=>{
    const source=structuredClone(input.source);source.declaration.path.endUtc='2026-06-21T11:45:00.000Z';
    source.declaration.path.stepMinutes=45;
    return prepareTimedSkyReadingSource(source.project,source.declaration,{bins:input.query.bins,
      reading:{...input.query.reading,utc:source.declaration.path.endUtc,temperatureC:0,halfWidthC:.00001}});
  });
  const bases=originals.map(input=>buildOriginalBoundaryBasis(input,4));
  const choices=[[0,2,'surfaceC'],[1,5,'subsurfaceC'],[2,8,'surfaceC'],[0,11,'subsurfaceC']];
  const readings=choices.map(([sourceIndex,index,store])=>{
    const input=originals[sourceIndex],basis=bases[sourceIndex];
    return prepareTimedSkyReadingSource(input.source.project,input.source.declaration,{bins:input.query.bins,
      reading:{...input.query.reading,utc:basis.originalBoundaries[index].utc,store,
        temperatureC:basis.pairs[12].trace.states.existing.lower[index][store]}});
  });
  const r=prepareRecordBoundaryEvidence(readings,query(authored,[7,4])).report;
  assert.equal(r.boundaries[1].report.compatibility,'compatible');assert.equal(r.originalTimes.length,12);
  assert.equal(r.originalTimes.at(-1).utc,'2026-06-21T11:45:00.000Z');
  assert.equal(r.originalTimes.at(-1).minute-r.originalTimes.at(-2).minute,15);
  assert.deepEqual(r.boundaries[1].report.readings.map(x=>[x.sourceIndex,x.originalIndex,x.store]),choices);
  assert.ok(r.boundaries[1].report.witnesses.every(w=>w.originalObservations.length===4&&w.originalReplays.length===3));
});

test('Whole-list source and aggregate reservation refuse malformed or excessive alternatives before returning a result',()=>{
  const input=makeManySkyExample();
  for(const splits of [[],[0],[16],[8,8],[1.5],[1,,8],[1,Infinity]])
    assert.throws(()=>prepareRecordBoundarySource(input.readings,query(input,splits)));
  assert.throws(()=>prepareRecordBoundarySource(input.readings,{...query(input,[8]),automatic:true}));
  const finer=structuredClone(input.readings);
  for(const reading of finer)reading.source.declaration.path.stepMinutes=20;
  assert.equal(originalSkyReadingTimes(finer[0].source).length,25);
  const eight=prepareRecordBoundarySource(finer,query(input,[1,2,3,4,5,6,7,8]));
  assert.equal(eight.query.splitAfterIntervals.length,8);
  assert.throws(()=>prepareRecordBoundarySource(finer,query(input,[1,2,3,4,5,6,7,8,9])),/aggregate allowance/);
  assert.equal(RECORD_BOUNDARY_LIMITS.maxCourseIntervals,300000);
  assert.throws(()=>prepareRecordBoundarySource([...input.readings.slice(0,3),input.readings[0]],query(input,[8])),/distinct/);
});

test('Source-only save and new/legacy evidence intake retain records, reject forged outputs and do not adopt saved boundary choices',()=>{
  const input=makeManySkyExample(),readings=input.readings.slice(0,3),q=query(input,[8,2]);
  const original=prepareRecordBoundaryEvidence(readings,q),text=JSON.stringify(original.investigation);
  assert.deepEqual(parseRecordBoundarySource(text),original.investigation);
  assert.deepEqual(parseRecordBoundaryEvidence(text),original);
  const intake=parseRecordBoundaryOriginals([text]);assert.deepEqual(intake.readings,readings);
  assert.equal(intake.sharingSource,q.sharingSource);assert.equal('splitAfterIntervals' in intake,false);
  assert.deepEqual(parseRecordBoundaryOriginals(readings.map(r=>JSON.stringify(r))).readings,readings);
  assert.throws(()=>parseRecordBoundarySource(JSON.stringify({...original.investigation,report:original.report})),/calculated/);
  assert.throws(()=>parseRecordBoundaryOriginals([JSON.stringify({...original.investigation,derived:'forged'})]),/calculated/);
  assert.throws(()=>parseRecordBoundaryOriginals([' '.repeat(5*1024*1024+1)]),/large|limit|bytes/i);
});
