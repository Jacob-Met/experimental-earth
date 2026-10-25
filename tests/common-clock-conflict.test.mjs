import test from 'node:test';import assert from 'node:assert/strict';
import{explainCommonClockConflict}from'../common-clock-conflict.js';
const report=sets=>({status:'compared',declaredDomain:[0,10],candidates:[{rateMmHr:9,readings:sets.map((offsetIntervals,index)=>({index,reading:{use:'calibration',source:'authored '+index},status:'compared',admittedOffsetDomain:[0,10],offsetIntervals}))}]});
test('nonconvex three-way conflict preserves every pairwise possibility',()=>{
 const original=report([[[0,2],[4,6]],[[0,2],[8,10]],[[4,6],[8,10]]]),copy=structuredClone(original),r=explainCommonClockConflict(original);
 assert.deepEqual(r.witnessReadingIndices,[0,1,2]);assert.ok(r.witness.every(w=>w.removalReopens.interval.length===2));assert.deepEqual(original,copy);
 assert.equal(r.independentPossibilities[0].everyReadingIndividuallyPossible,true);
});
test('redundant evidence is retained in considered indices but not the irreducible witness',()=>{
 const r=explainCommonClockConflict(report([[[0,2]],[[8,10]],[[0,10]]]));assert.deepEqual(r.consideredReadingIndices,[0,1,2]);assert.deepEqual(r.witnessReadingIndices,[0,1]);
});
test('compatible and single unsupported records do not invent pairwise clock conflict',()=>{
 assert.equal(explainCommonClockConflict(report([[[0,4]],[[3,8]]])).status,'compatible');
 const r=explainCommonClockConflict(report([[],[[0,10]]]));assert.deepEqual(r.witnessReadingIndices,[0]);assert.equal(r.classification,'single-reading-excludes-offered-models');
});
test('calibration witness never uses held-aside values',()=>{
 const p=report([[[0,4]],[[8,10]]]);p.candidates[0].readings[1].reading.use='challenge';assert.equal(explainCommonClockConflict(p,{phase:'calibration'}).status,'compatible');assert.equal(explainCommonClockConflict(p).status,'conflict');
});

test('different readings exclude different offered hydraulic hypotheses',()=>{
 const p=report([[],[[0,10]]]);p.candidates.push({...structuredClone(p.candidates[0]),rateMmHr:22});p.candidates[1].readings[0].offsetIntervals=[[0,10]];p.candidates[1].readings[1].offsetIntervals=[];
 const r=explainCommonClockConflict(p);assert.deepEqual(r.witnessReadingIndices,[0,1]);assert.deepEqual(r.witness.map(w=>w.removalReopens.rateMmHr),[9,22]);
});
test('event exclusion is not labeled a hydraulic depth contradiction',()=>{
 const p=report([[]]);p.candidates[0].readings[0].status='outside-modeled-window';p.candidates[0].readings[0].admittedOffsetDomain=null;
 assert.equal(explainCommonClockConflict(p).classification,'reading-outside-declared-event-support');
});
test('large disconnected ledgers refuse before subset search',()=>{
 const p=report(Array.from({length:100},()=>Array.from({length:100},(_,i)=>[i/10,i/10+.01])));
 const r=explainCommonClockConflict(p);assert.equal(r.status,'work-limit');assert.ok(r.estimatedIntervalScans>r.maxIntervalScans);assert.deepEqual(r.witness,[]);
});
test('retained solver original readings reopen at explicit offsets without mutating source or ranking',async()=>{
 const {makeExample}=await import('../core.js');const {compareCommonClock}=await import('../common-clock-feasibility.js');
 const p=makeExample();p.width=p.height=2;p.selectedIndex=0;p.existing=Array.from({length:4},()=>({elevationM:0,surface:'turf',provenance:'authored'}));p.proposal=structuredClone(p.existing);Object.assign(p.weather,{rainMmHr:30,stormMinutes:60,durationMinutes:180,mobilityPerHour:0,boundaryExitPerHour:0});p.infiltrationStudy={target:'existing',surface:'turf',ratesMmHr:[3,9,22]};p.observations=[{cellIndex:0,minute:60,depthMm:21,uncertaintyMm:.01,source:'authored first',scenario:'existing',use:'calibration'},{cellIndex:0,minute:120,depthMm:15,uncertaintyMm:.01,source:'authored held aside',scenario:'existing',use:'challenge'}];
 const before=structuredClone(p),comparison=compareCommonClock(p,{minimumOffsetMinutes:-30,maximumOffsetMinutes:30,source:'authored clock hypothesis'}),original=structuredClone(comparison);
 assert.equal(explainCommonClockConflict(comparison,{phase:'calibration'}).status,'compatible');const r=explainCommonClockConflict(comparison);assert.deepEqual(r.witnessReadingIndices,[0,1]);
 for(const row of r.witness){const candidate=comparison.candidates.find(c=>c.rateMmHr===row.removalReopens.rateMmHr),offset=row.removalReopens.offsetMinutes;for(const other of r.witnessReadingIndices.filter(i=>i!==row.index))assert.ok(candidate.readings.find(r=>r.index===other).offsetIntervals.some(([a,b])=>offset>=a&&offset<=b));}
 assert.deepEqual(comparison,original);assert.deepEqual(p,before);
});

test('returned singleton witnesses own domains and empty-subset removal support',()=>{
 const source=report([[]]),before=structuredClone(source),result=explainCommonClockConflict(source);
 assert.equal(result.status,'conflict');result.witness[0].individual[0].admittedOffsetDomain[0]=-999;
 result.witness[0].removalSupport[0].intervals[0][0]=-888;
 result.witness[0].removalReopens.interval[1]=777;
 result.witness[0].reading.source='changed output';
 assert.deepEqual(source,before);
 const outside=report([[]]);outside.candidates[0].readings[0].admittedOffsetDomain=null;
 assert.equal(explainCommonClockConflict(outside).witness[0].individual[0].admittedOffsetDomain,null);
});
