import test from 'node:test';
import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
import {makeSkyRelaxationExample} from '../shade-heat-sky-relaxation-example.js';
import {prepareSkyRelaxationEvidence,prepareSkyRelaxationSource,parseSkyRelaxationSource,serializeSkyRelaxationSource,inspectSkyRelaxationWork,SKY_RELAXATION_LIMITS} from '../shade-heat-sky-relaxation-course.js';
import {parseSkyRelaxationOriginals} from '../shade-heat-sky-relaxation-inputs.js';
import {prepareSkyJointSource} from '../shade-heat-sky-joint-course.js';
import {prepareSkyConsequenceSource} from '../shade-heat-sky-consequence-course.js';
import {prepareSkyChangeSource} from '../shade-heat-sky-change-course.js';
import {prepareThreeEpochSkySource} from '../shade-heat-three-epoch-course.js';
import {makeThreeEpochSkyExample} from '../shade-heat-three-epoch-example.js';
import {originalSkyReadingTimes,prepareTimedSkyReadingSource} from '../shade-heat-timed-reading-source.js';
import {verifyMinimumSkyRelaxation} from '../shade-heat-sky-relaxation.js';
import {createShadeHeatComputation} from '../shade-heat-computation.js';
import {rational as q,add,sub,cmp} from '../vendor/chronos/exact-halfplanes.mjs';
const fraction=value=>[BigInt(value.exact.numerator),BigInt(value.exact.denominator)];
function revive(value){if(Array.isArray(value)){if(value.length===2&&value.every(x=>typeof x==='string'&&/^-?\d+$/.test(x)))return value.map(BigInt);return value.map(revive);}if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,revive(item)]));return value;}
async function save(name,value){if(!process.env.EARTH_RELAXATION_TEST_REPORT_DIR)return;await mkdir(process.env.EARTH_RELAXATION_TEST_REPORT_DIR,{recursive:true});await writeFile(process.env.EARTH_RELAXATION_TEST_REPORT_DIR+'/'+name+'.json',JSON.stringify(value,null,2)+'\n');}
function inspect(output){
 const {investigation,report:r}=output,e=revive(r.exactEvidence);
 assert(verifyMinimumSkyRelaxation(e.observedIntervalRows,e.bands,e.requirementIntervalRows,e.result));
 assert.deepEqual(r.attainingPatternIndices,e.result.attainingPatternIndices);assert.deepEqual(r.zeroCompatiblePatternIndices,e.result.zeroCompatiblePatternIndices);
 assert.equal(r.originalRequirementsCompatible,e.result.originalRequirementsCompatible);
 if(r.minimumRelaxationC===null)assert.equal(e.result.minimumRelaxation,null);else assert.equal(cmp(fraction(r.minimumRelaxationC),e.result.minimumRelaxation),0);
 for(const pattern of r.alternatives){
  assert(pattern.maximumLowerMinusUpperC.every(value=>cmp(fraction(value),q(0))<=0));
  const w=pattern.witness,delta=fraction(pattern.minimumRelaxationC),exact=e.result.cases.find(x=>x.patternIndex===pattern.patternIndex);
  assert.equal(cmp(delta,exact.relaxation.value),0);assert.equal(cmp(fraction(w.relaxationC),delta),0);
  assert.equal(pattern.attainsGlobalMinimum,r.attainingPatternIndices.includes(pattern.patternIndex));
  assert.equal(w.patternIndex,pattern.patternIndex);assert.equal(w.originalReplays.length,r.work.uniqueSources);assert.equal(w.originalObservations.length,r.readings.length);
  for(const profile of w.phaseProfiles)assert.equal(cmp(profile.map(fraction).reduce(add,q(0)),q(1)),0);
  for(const row of w.originalObservations){const original=r.readings[row.recordIndex];
   assert.equal(row.utc,original.utc);assert.equal(row.store,original.store);assert.equal(row.cellIndex,original.cellIndex);
   assert(cmp(fraction(row.additiveC),fraction(original.bandC.lower))>=0&&cmp(fraction(row.additiveC),fraction(original.bandC.upper))<=0);
   for(const side of ['lower','upper'])assert.equal(row.endpointStatus[side],cmp(q(row.originalC[side]),fraction(original.bandC.lower))>=0&&cmp(q(row.originalC[side]),fraction(original.bandC.upper))<=0?'within-original-band':'outside-original-band');
  }
  for(const replay of w.originalReplays){assert.deepEqual(replay.originalCourse.map(({index,utc,minute,thermalMinute})=>({index,utc,minute,thermalMinute})),r.originalTimes);assert(replay.maximumReplayResidualC.upper<=1e-9);}
  for(const target of r.requirements){const value=w.requirements[target.requirementIndex],row=w.originalReplays[target.sourceIndex].originalCourse[target.originalIndex];
   const represented={lower:sub(fraction(row.additiveC.proposal.lower[target.store]),fraction(row.additiveC.existing.upper[target.store])),upper:sub(fraction(row.additiveC.proposal.upper[target.store]),fraction(row.additiveC.existing.lower[target.store]))};
   const numerical={lower:sub(q(row.originalC.proposal.lower[target.store]),q(row.originalC.existing.upper[target.store])),upper:sub(q(row.originalC.proposal.upper[target.store]),q(row.originalC.existing.lower[target.store]))};
   for(const side of ['lower','upper']){assert.equal(cmp(fraction(value.representedPairC[side]),represented[side]),0);assert.equal(cmp(fraction(value.originalNumericalPairC[side]),numerical[side]),0);}
   const original=q(target.differenceC),relaxed=target.relation==='at-most'?add(original,delta):sub(original,delta);
   assert.equal(cmp(fraction(value.originalLimitC),original),0);assert.equal(cmp(fraction(value.relaxedLimitC),relaxed),0);
   const status=(pair,limit)=>(target.relation==='at-most'?cmp(pair.upper,limit)<=0:cmp(pair.lower,limit)>=0)?'met':'not-met';
   assert.equal(value.representedStatus,status(represented,original));assert.equal(value.originalNumericalStatus,status(numerical,original));
   assert.equal(value.relaxedRepresentedStatus,status(represented,relaxed));assert.equal(value.relaxedRepresentedStatus,'met');
   assert.equal(value.relaxedOriginalNumericalStatus,status(numerical,relaxed));
  }
 }
 const witnesses=r.alternatives.length;
 assert.equal(r.work.actualWitnessProfiles,witnesses);assert.equal(r.work.executedWitnessCourses,witnesses*r.work.uniqueSources*4);
 assert.equal(r.work.actualReplayEndpointRows,witnesses*r.work.uniqueSources*r.originalTimes.length);assert.equal(r.work.actualObservationReplayRows,witnesses*r.readings.length);
 assert.equal(r.work.exactObjectives,3*witnesses);assert.equal(r.work.exactSolves,r.patterns.length+2*witnesses);
 assert.equal(r.work.exactRelaxationSolves,witnesses);assert.equal(r.work.exactOrderSolves,witnesses);
 assert(r.work.linearPivots<=8192&&r.work.linearRationalOperations<=24000000);assert.deepEqual(r.query,investigation.query);return true;
}
function shortOriginals(){
 const original=makeThreeEpochSkyExample().readings[0],source=structuredClone(original.source);
 Object.assign(source.declaration.path,{startUtc:'2026-06-21T04:00:13.000Z',endUtc:'2026-06-21T04:19:37.000Z',stepMinutes:13});
 return [[0,'surfaceC'],[1,'subsurfaceC'],[2,'surfaceC']].map(([index,store])=>prepareTimedSkyReadingSource(source.project,source.declaration,{bins:4,reading:{...original.query.reading,utc:originalSkyReadingTimes(source)[index].utc,store,temperatureC:25,halfWidthC:100,source:'Authored broad bands on an unfamiliar short original clock'}}));
}
function broadQuery(readings){
 const times=originalSkyReadingTimes(readings[0].source);
 return {bins:4,maximumChanges:2,sharingSource:'Authored unchanged shared receiver conditions',searchSource:'Complete original-class search before two whole-interval requirements',
  requirements:[{receiverReadingIndex:0,utc:times.at(-1).utc,store:'surfaceC',relation:'at-most',differenceC:100,source:'Authored broad upper requirement'},
   {receiverReadingIndex:1,utc:times[1].utc,store:'subsurfaceC',relation:'at-least',differenceC:-100,source:'Authored broad lower requirement'}]};
}

let baseline;
test('the unchanged24-record example has a positive certified shared relaxation in its sole original minimum pattern',async()=>{
 const example=makeSkyRelaxationExample(),before=JSON.stringify(example),output=prepareSkyRelaxationEvidence(example.readings,example.query);baseline=output;const r=output.report;
 assert.equal(JSON.stringify(example),before);assert.deepEqual(output.investigation.readings,example.readings);inspect(output);
 assert.equal(r.minimumChanges,2);assert.equal(r.patterns.length,121);assert.deepEqual(r.alternatives.map(a=>a.splitAfterIntervals),[[6,10]]);
 assert.equal(r.readings.length,24);assert.equal(r.work.uniqueSources,3);assert.equal(r.originalTimes.length,17);
 assert.deepEqual(r.requirements.map(t=>[t.sourceIndex,t.originalIndex,t.store]),[[0,8,'surfaceC'],[0,16,'surfaceC']]);
 assert.equal(r.relaxationStatus,'minimum-common-relaxation');assert(cmp(fraction(r.minimumRelaxationC),q(0))>0);
 assert.deepEqual(r.attainingPatternIndices,[79]);assert.deepEqual(r.zeroCompatiblePatternIndices,[]);assert.equal(r.originalRequirementsCompatible,false);
 assert.equal(r.work.actualWitnessProfiles,1);assert.equal(r.work.actualReplayEndpointRows,51);assert.equal(r.work.actualObservationReplayRows,24);
 assert.equal(r.work.exactSolves,123);assert.equal(r.work.exactObjectives,3);
 assert(r.alternatives[0].witness.requirements.some(x=>x.representedStatus==='not-met'));
 assert(r.alternatives[0].witness.requirements.every(x=>x.relaxedRepresentedStatus==='met'));
 await save('native-relaxation-original',output);
});
test('unfamiliar clocks preserve zero, equality and a constant positive relaxation with separate original statuses',async()=>{
 const readings=shortOriginals(),query=broadQuery(readings),before=JSON.stringify(readings),good=prepareSkyRelaxationEvidence(readings,query);
 inspect(good);assert.equal(good.report.minimumChanges,0);assert.equal(cmp(fraction(good.report.minimumRelaxationC),q(0)),0);assert.equal(good.report.patterns.length,1);
 assert.equal(good.report.unexaminedHigherChangePatterns,1);assert.equal(good.report.work.actualWitnessProfiles,1);
 assert.equal(good.report.originalTimes.at(-1).utc,'2026-06-21T04:19:37.000Z');assert.equal(good.report.originalTimes.at(-1).minute,19.4);
 await save('native-relaxation-short-zero',good);
 const equality=structuredClone(query);for(const [i,target]of equality.requirements.entries())Object.assign(target,{receiverReadingIndex:0,utc:good.report.originalTimes[0].utc,store:'surfaceC',differenceC:0,relation:i?'at-least':'at-most'});
 const contact=prepareSkyRelaxationEvidence(readings,equality);inspect(contact);assert.equal(cmp(fraction(contact.report.minimumRelaxationC),q(0)),0);
 assert(contact.report.alternatives[0].witness.requirements.every(x=>x.representedStatus==='met'));await save('native-relaxation-exact-contact',contact);
 const impossible=structuredClone(equality);impossible.requirements[1].differenceC=1;
 const one=prepareSkyRelaxationEvidence(readings,impossible);inspect(one);assert.equal(cmp(fraction(one.report.minimumRelaxationC),q(1)),0);assert.equal(one.report.work.actualWitnessProfiles,1);
 assert.deepEqual(one.report.alternatives[0].witness.requirements.map(x=>x.representedStatus),['met','not-met']);await save('native-relaxation-constant-positive',one);
 assert.equal(JSON.stringify(readings),before);
});
test('an empty original family has no optimum or vacuous zero-conjunction status',async()=>{
 const readings=shortOriginals(),query=broadQuery(readings);readings[2].query.reading.temperatureC=400;readings[2].query.reading.halfWidthC=0;
 const output=prepareSkyRelaxationEvidence(readings,query),r=output.report;inspect(output);assert.equal(r.compatibility,'incompatible');assert.equal(r.minimumChanges,null);
 assert.equal(r.relaxationStatus,'original-incompatible');assert.equal(r.minimumRelaxationC,null);assert.equal(r.originalRequirementsCompatible,null);
 assert.deepEqual(r.attainingPatternIndices,[]);assert.deepEqual(r.zeroCompatiblePatternIndices,[]);assert.deepEqual(r.alternatives,[]);
 assert.equal(r.patterns.length,2);assert.equal(r.work.executedWitnessCourses,0);assert.equal(r.work.exactObjectives,0);await save('native-relaxation-original-empty',output);
});
test('source-only reopening preserves original thresholds; older inquiries retain observations and omit derived decisions',()=>{
 assert(baseline);const own=baseline.investigation,text=serializeSkyRelaxationSource(own);assert.deepEqual(parseSkyRelaxationSource(text),own);
 assert.deepEqual(Object.keys(JSON.parse(text)),['kind','model','readings','query']);assert.deepEqual(parseSkyRelaxationOriginals([text]),{readings:own.readings,sharingSource:own.query.sharingSource,ownQuery:own.query,modelQuery:null});
 const base={bins:4,maximumChanges:own.query.maximumChanges,sharingSource:own.query.sharingSource,searchSource:own.query.searchSource};
 const target={receiverReadingIndex:0,utc:own.query.requirements[0].utc,store:'surfaceC'};
 for(const previous of [prepareSkyJointSource(own.readings,own.query),prepareSkyConsequenceSource(own.readings,{...base,target}),prepareSkyChangeSource(own.readings,base)]){
  const loaded=parseSkyRelaxationOriginals([JSON.stringify(previous)]);assert.deepEqual(loaded.readings,own.readings);assert.equal(loaded.ownQuery,null);assert.deepEqual(loaded.modelQuery,base);
 }
 const three=makeThreeEpochSkyExample(),prior=parseSkyRelaxationOriginals([JSON.stringify(prepareThreeEpochSkySource(three.readings,three.query))]);
 assert.deepEqual(prior.readings,three.readings);assert.equal(prior.modelQuery,null);assert.equal(prior.ownQuery,null);
 assert.deepEqual(parseSkyRelaxationOriginals(three.readings.map(JSON.stringify)).readings,three.readings);
 const mutations=[s=>s.report={},s=>s.query.knownCuts=[6,10],s=>s.query.relaxationC=0,s=>s.query.requirements.pop(),s=>s.query.requirements.push(s.query.requirements[0]),s=>s.model.version=2,
  ...[t=>t.utc='2026-06-21T12:00:00.001Z',t=>t.receiverReadingIndex=24,t=>t.receiverReadingIndex=.5,t=>t.store='airC',t=>t.relation='some-at-most',t=>t.differenceC=null,t=>t.differenceC='0',t=>t.source='',t=>t.source=' '.repeat(4),t=>t.source='x'.repeat(401),t=>t.relaxedLimit=0].map(f=>s=>f(s.query.requirements[0])),s=>s.readings[0].query.reading.witness={}];
 for(const mutate of mutations){const source=structuredClone(own);mutate(source);assert.throws(()=>parseSkyRelaxationSource(JSON.stringify(source)));}
 const sparse=structuredClone(own.query);delete sparse.requirements[0];assert.throws(()=>prepareSkyRelaxationSource(own.readings,sparse));
 const infinite=structuredClone(own.query);infinite.requirements[0].differenceC=Infinity;assert.throws(()=>prepareSkyRelaxationSource(own.readings,infinite));
 assert.throws(()=>serializeSkyRelaxationSource({...own,report:{}}));assert.throws(()=>parseSkyRelaxationSource('['));assert.throws(()=>parseSkyRelaxationOriginals([text+' '.repeat(5*1024*1024)]),/5 MiB/);
});
test('maximum admission reserves one profile, three objectives and two additional solves per compatible original pattern',()=>{
 const raw=makeSkyRelaxationExample();for(const input of raw.readings)input.source.declaration.path.endUtc='2026-06-21T16:00:00.000Z';
 const work=inspectSkyRelaxationWork(raw.readings,raw.query);assert.equal(work.intervals,24);assert.equal(work.declaredPatterns,277);assert.equal(work.reservedWitnessProfiles,253);
 assert.equal(work.reservedDistinctBasisCourses,112656);assert.equal(work.reservedWitnessCourses,3036);assert.equal(work.reservedThermalCourses,115692);
 assert.equal(work.reservedCourseIntervals,2776608);assert.equal(work.reservedReplayEndpointRows,18975);assert.equal(work.reservedObservationReplayRows,6072);
 assert.equal(work.reservedRequirementSolvesPerCompatiblePattern,2);assert.equal(work.reservedObjectivesPerCompatiblePattern,3);
 assert.equal(work.reservedLinearRationalOperations,24000000);assert.equal(work.reservedLinearPivots,8192);assert.equal(work.maximumCompleteReportBytes,64*1024*1024);
 assert.equal(work.reservedThermalCourses,SKY_RELAXATION_LIMITS.maxThermalCourses);assert.equal(inspectSkyRelaxationWork(raw.readings,{...raw.query,maximumChanges:0}).reservedWitnessProfiles,1);
});
test('maintained worker ownership retires an older relaxation completion before admitting a newer complete result',async()=>{
 assert(baseline);const workers=[];let terminated=0;
 const computation=createShadeHeatComputation(()=>{const worker={terminate(){terminated++;},postMessage(){}};workers.push(worker);return worker;});
 const first=computation.compute({operation:'prepare'}),firstOutcome=first.then(()=>null,error=>error.code),oldHandler=workers[0].onmessage,second=computation.compute({operation:'prepare'});
 oldHandler({data:{ok:true,result:baseline}});assert.equal(computation.pending,true);workers[1].onmessage({data:{ok:true,result:baseline}});
 assert.deepEqual(await second,baseline);assert.equal(await firstOutcome,'superseded');assert.equal(computation.pending,false);assert.equal(terminated,2);
});
