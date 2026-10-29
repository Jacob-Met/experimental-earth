import test from 'node:test';
import assert from 'node:assert/strict';
import {makeThreeEpochSkyExample} from '../shade-heat-three-epoch-example.js';
import {prepareSkyConsequenceEvidence,prepareSkyConsequenceSource,parseSkyConsequenceSource,serializeSkyConsequenceSource,inspectSkyConsequenceWork,SKY_CONSEQUENCE_LIMITS} from '../shade-heat-sky-consequence-course.js';
import {parseSkyConsequenceOriginals} from '../shade-heat-sky-consequence-inputs.js';
import {prepareSkyChangeSource} from '../shade-heat-sky-change-course.js';
import {prepareThreeEpochSkySource} from '../shade-heat-three-epoch-course.js';
import {originalSkyReadingTimes,prepareTimedSkyReadingSource} from '../shade-heat-timed-reading-source.js';
import {verifyMinimumSkyChangeRange} from '../shade-heat-sky-change-range.js';
import {createShadeHeatComputation} from '../shade-heat-computation.js';
import {rational as q,add,cmp} from '../vendor/chronos/exact-halfplanes.mjs';
const baseQuery={bins:4,maximumChanges:2,sharingSource:'Authored common conditions across every original receiver',searchSource:'Explicit original-clock zero/one/two-change comparison before bounding the complete minimum class'};
const targetFor=(readings,index=0,store='surfaceC')=>({receiverReadingIndex:index,utc:originalSkyReadingTimes(readings[index].source).at(-1).utc,store});
const fraction=v=>[BigInt(v.exact.numerator),BigInt(v.exact.denominator)];
function revive(value){if(Array.isArray(value)){if(value.length===2&&value.every(x=>typeof x==='string'&&/^-?\d+$/.test(x)))return value.map(BigInt);return value.map(revive);}if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,revive(v)]));return value;}
function shortOriginals(){
 const original=makeThreeEpochSkyExample().readings[0],source=structuredClone(original.source);
 Object.assign(source.declaration.path,{startUtc:'2026-06-21T04:00:13.000Z',endUtc:'2026-06-21T04:19:37.000Z',stepMinutes:13});
 return [[0,'surfaceC'],[1,'subsurfaceC'],[2,'surfaceC']].map(([index,store])=>prepareTimedSkyReadingSource(source.project,source.declaration,{bins:4,reading:{...original.query.reading,utc:originalSkyReadingTimes(source)[index].utc,store,temperatureC:25,halfWidthC:100,source:'Authored broad bands on an unfamiliar short original clock'}}));
}
let baseline;
test('all compatible profiles can reverse the conclusion suggested by one example profile; both exact extrema retain every original observation',()=>{
 const raw=makeThreeEpochSkyExample(),before=JSON.stringify(raw),query={...baseQuery,target:targetFor(raw.readings,5)};
 const output=prepareSkyConsequenceEvidence(raw.readings,query);baseline=output;const r=output.report;
 assert.equal(JSON.stringify(raw),before);assert.deepEqual(output.investigation.readings,raw.readings);
 assert.equal(r.minimumChanges,2);assert.equal(r.patterns.length,121);assert.deepEqual(r.alternatives.map(a=>a.splitAfterIntervals),[[6,10]]);
 assert.equal(r.target.sourceIndex,2);assert.equal(r.target.originalIndex,16);assert.equal(r.readings.length,24);assert.equal(r.work.uniqueSources,3);
 assert(r.consequence.lower.lower < -2.4&&r.consequence.upper.upper > .02);assert.equal(r.consequence.direction,'direction-not-established');
 assert.deepEqual(r.consequence.lowerPatternIndices,[79]);assert.deepEqual(r.consequence.upperPatternIndices,[79]);assert.equal(r.consequence.components.length,1);assert.deepEqual(r.consequence.gaps,[]);
 assert.equal(r.work.actualWitnessProfiles,2);assert.equal(r.work.executedWitnessCourses,24);assert.equal(r.work.actualReplayEndpointRows,102);assert.equal(r.work.actualObservationReplayRows,48);
 assert.equal(r.work.exactObjectives,3);assert.equal(r.work.exactSolves,122);assert(r.work.linearRationalOperations>0&&r.work.linearRationalOperations<=SKY_CONSEQUENCE_LIMITS.maxLinearRationalOperations);
 const exact=revive(r.exactEvidence);assert(verifyMinimumSkyChangeRange(exact.observedIntervalRows,exact.bands,exact.targetIntervalRows,exact.result));
 for(const a of r.alternatives){
  assert(cmp(fraction(a.maximumLowerMinusUpperC),q(0))<=0);
  for(const side of ['lower','upper']){
   const endpoint=a.extremes[side];assert.equal(endpoint.patternIndex,a.patternIndex);assert.equal(endpoint.endpoint,side);
   assert.deepEqual(endpoint.valueC,a.rangeC[side]);assert.deepEqual(endpoint.valueC,endpoint.targetRepresentedPairC[side]);
   assert.equal(endpoint.originalObservations.length,24);assert.equal(endpoint.originalReplays.length,3);
   for(const profile of endpoint.phaseProfiles)assert.equal(cmp(profile.map(fraction).reduce(add,q(0)),q(1)),0);
   for(const row of endpoint.originalObservations){const original=r.readings[row.recordIndex];assert.equal(row.utc,original.utc);assert.equal(row.store,original.store);assert.equal(row.cellIndex,original.cellIndex);
    assert(cmp(fraction(row.additiveC),fraction(original.bandC.lower))>=0&&cmp(fraction(row.additiveC),fraction(original.bandC.upper))<=0);
    for(const key of ['lower','upper'])assert.equal(row.endpointStatus[key],cmp(q(row.originalC[key]),fraction(original.bandC.lower))>=0&&cmp(q(row.originalC[key]),fraction(original.bandC.upper))<=0?'within-original-band':'outside-original-band');
   }
   for(const replay of endpoint.originalReplays){assert.equal(replay.originalCourse.length,17);assert(replay.maximumReplayResidualC.upper<=1e-9);assert.deepEqual(replay.originalCourse.map(({index,utc,minute,thermalMinute})=>({index,utc,minute,thermalMinute})),r.originalTimes);}
  }
 }
});
test('a changed original target recomputes a complete static family; impossible observations return no ranges or extreme histories',()=>{
 const readings=shortOriginals(),query={...baseQuery,target:targetFor(readings)};
 const source=prepareSkyConsequenceSource(readings,query),before=JSON.stringify(readings),good=prepareSkyConsequenceEvidence(readings,query);
 assert.equal(good.report.minimumChanges,0);assert.equal(good.report.patterns.length,1);assert.equal(good.report.unexaminedHigherChangePatterns,1);
 assert.equal(good.report.originalTimes.at(-1).utc,'2026-06-21T04:19:37.000Z');assert.equal(good.report.originalTimes.at(-1).minute,19.4);
 const initialQuery={...query,target:{receiverReadingIndex:1,utc:originalSkyReadingTimes(readings[0].source)[0].utc,store:'subsurfaceC'}};
 const initial=prepareSkyConsequenceEvidence(readings,initialQuery);assert.deepEqual(initial.investigation.readings,readings);assert.equal(initial.report.target.originalIndex,0);
 assert.equal(initial.report.consequence.lower.exact.numerator,'0');assert.equal(initial.report.consequence.upper.exact.numerator,'0');assert.equal(initial.report.consequence.direction,'same-represented-temperature');
 assert.deepEqual(prepareSkyConsequenceEvidence(parseSkyConsequenceSource(serializeSkyConsequenceSource(source)).readings,query),good);
 assert.equal(JSON.stringify(readings),before);
 readings[2].query.reading.temperatureC=400;readings[2].query.reading.halfWidthC=0;
 const bad=prepareSkyConsequenceEvidence(readings,query).report;assert.equal(bad.compatibility,'incompatible');assert.equal(bad.minimumChanges,null);assert.equal(bad.consequence,null);
 assert.equal(bad.patterns.length,2);assert.deepEqual(bad.alternatives,[]);assert.equal(bad.work.executedWitnessCourses,0);assert.equal(bad.work.exactObjectives,0);
});
test('own source-only reopening preserves the precise target; earlier inquiries preserve every observation and only applicable model declarations',()=>{
 assert(baseline);const own=baseline.investigation,text=serializeSkyConsequenceSource(own);assert.deepEqual(parseSkyConsequenceSource(text),own);
 assert.deepEqual(Object.keys(JSON.parse(text)),['kind','model','readings','query']);
 assert.deepEqual(parseSkyConsequenceOriginals([text]),{readings:own.readings,sharingSource:own.query.sharingSource,ownQuery:own.query,modelQuery:null});
 const previous=prepareSkyChangeSource(own.readings,baseQuery),loaded=parseSkyConsequenceOriginals([JSON.stringify(previous)]);
 assert.deepEqual(loaded.readings,own.readings);assert.deepEqual(loaded.modelQuery,baseQuery);assert.equal(loaded.ownQuery,null);
 const three=makeThreeEpochSkyExample(),fixed=prepareThreeEpochSkySource(three.readings,three.query),prior=parseSkyConsequenceOriginals([JSON.stringify(fixed)]);
 assert.deepEqual(prior.readings,fixed.readings);assert.equal(prior.modelQuery,null);assert.equal(prior.ownQuery,null);
 assert.deepEqual(parseSkyConsequenceOriginals(three.readings.map(JSON.stringify)).readings,three.readings);
 for(const mutate of [s=>s.report={},s=>s.query.knownCuts=[6,10],s=>s.query.targets=[],s=>s.model.version=2,s=>s.query.target.utc='2026-06-21T12:00:00.001Z',s=>s.query.target.receiverReadingIndex=24,s=>s.query.target.receiverReadingIndex=1.5,s=>s.query.target.store='airC',s=>s.query.target.interpolated=true,s=>s.readings[0].query.reading.witness={}]){
  const source=structuredClone(own);mutate(source);assert.throws(()=>parseSkyConsequenceSource(JSON.stringify(source)));
 }
 assert.throws(()=>serializeSkyConsequenceSource({...own,report:{}}));assert.throws(()=>parseSkyConsequenceSource('['));
 assert.throws(()=>parseSkyConsequenceOriginals([text+' '.repeat(5*1024*1024)]),/5 MiB/);
});
test('the maximum complete inquiry reserves every extreme profile and all three objectives before work',()=>{
 const raw=makeThreeEpochSkyExample();for(const input of raw.readings)input.source.declaration.path.endUtc='2026-06-21T16:00:00.000Z';
 const query={...baseQuery,target:targetFor(raw.readings,5)},work=inspectSkyConsequenceWork(raw.readings,query);
 assert.equal(work.intervals,24);assert.equal(work.declaredPatterns,277);assert.equal(work.reservedWitnessProfiles,506);
 assert.equal(work.reservedDistinctBasisCourses,112656);assert.equal(work.reservedWitnessCourses,6072);assert.equal(work.reservedThermalCourses,118728);
 assert.equal(work.reservedCourseIntervals,2849472);assert.equal(work.reservedReplayEndpointRows,37950);assert.equal(work.reservedObservationReplayRows,12144);
 assert.equal(work.reservedObjectivesPerCompatiblePattern,3);assert.equal(work.reservedLinearRationalOperations,24000000);assert.equal(work.reservedLinearPivots,8192);
 assert.equal(work.maximumCompleteReportBytes,64*1024*1024);assert.equal(work.reservedThermalCourses,SKY_CONSEQUENCE_LIMITS.maxThermalCourses);
 const fixed=inspectSkyConsequenceWork(raw.readings,{...query,maximumChanges:0});assert.equal(fixed.declaredPatterns,1);assert.equal(fixed.reservedWitnessProfiles,2);
});
test('maintained worker ownership accepts a complete consequence and retires a held older completion',async()=>{
 assert(baseline);const workers=[];let terminated=0;
 const computation=createShadeHeatComputation(()=>{const worker={terminate(){terminated++;},postMessage(){}};workers.push(worker);return worker;});
 const first=computation.compute({operation:'prepare'});const firstOutcome=first.then(()=>null,error=>error.code);
 const oldHandler=workers[0].onmessage,second=computation.compute({operation:'prepare'});
 oldHandler({data:{ok:true,result:baseline}});assert.equal(computation.pending,true);
 workers[1].onmessage({data:{ok:true,result:baseline}});assert.deepEqual(await second,baseline);assert.equal(await firstOutcome,'superseded');
 assert.equal(computation.pending,false);assert.equal(terminated,2);
});
