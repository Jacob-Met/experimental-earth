import test from 'node:test';
import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
import {makeSkyJointExample} from '../shade-heat-sky-joint-example.js';
import {prepareSkyJointEvidence,prepareSkyJointSource,parseSkyJointSource,serializeSkyJointSource,inspectSkyJointWork,SKY_JOINT_LIMITS} from '../shade-heat-sky-joint-course.js';
import {parseSkyJointOriginals} from '../shade-heat-sky-joint-inputs.js';
import {prepareSkyConsequenceSource} from '../shade-heat-sky-consequence-course.js';
import {prepareSkyChangeSource} from '../shade-heat-sky-change-course.js';
import {prepareThreeEpochSkySource} from '../shade-heat-three-epoch-course.js';
import {makeThreeEpochSkyExample} from '../shade-heat-three-epoch-example.js';
import {originalSkyReadingTimes,prepareTimedSkyReadingSource} from '../shade-heat-timed-reading-source.js';
import {verifyMinimumSkyRequirements} from '../shade-heat-sky-joint-requirements.js';
import {createShadeHeatComputation} from '../shade-heat-computation.js';
import {rational as q,add,sub,cmp} from '../vendor/chronos/exact-halfplanes.mjs';

const fraction=value=>[BigInt(value.exact.numerator),BigInt(value.exact.denominator)];
function revive(value){if(Array.isArray(value)){if(value.length===2&&value.every(x=>typeof x==='string'&&/^-?\d+$/.test(x)))return value.map(BigInt);return value.map(revive);}if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,revive(item)]));return value;}
async function save(name,value){if(!process.env.EARTH_JOINT_TEST_REPORT_DIR)return;await mkdir(process.env.EARTH_JOINT_TEST_REPORT_DIR,{recursive:true});await writeFile(process.env.EARTH_JOINT_TEST_REPORT_DIR+'/'+name+'.json',JSON.stringify(value,null,2)+'\n');}
function inspect(output){
 const {investigation,report:r}=output,e=revive(r.exactEvidence);assert(verifyMinimumSkyRequirements(e.observedIntervalRows,e.bands,e.requirementIntervalRows,e.result));
 let witnesses=0;
 for(const pattern of r.alternatives){
  assert(pattern.maximumLowerMinusUpperC.every(value=>cmp(fraction(value),q(0))<=0));
  for(const entry of [...pattern.individual,pattern.joint]){
   if(entry.compatibility==='incompatible'){assert.equal(entry.witness,null);continue;}
   const w=entry.witness;witnesses++;assert.equal(w.patternIndex,pattern.patternIndex);assert.deepEqual(w.requirementIndices,entry.requirementIndices);
   assert.equal(w.originalReplays.length,r.work.uniqueSources);assert.equal(w.originalObservations.length,r.readings.length);
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
    const status=pair=>(target.relation==='at-most'?cmp(pair.upper,q(target.differenceC))<=0:cmp(pair.lower,q(target.differenceC))>=0)?'met':'not-met';
    assert.equal(value.representedStatus,status(represented));assert.equal(value.originalNumericalStatus,status(numerical));
    if(entry.requirementIndices.includes(target.requirementIndex))assert.equal(value.representedStatus,'met');
   }
  }
 }
 assert.equal(r.work.actualWitnessProfiles,witnesses);assert.equal(r.work.executedWitnessCourses,witnesses*r.work.uniqueSources*4);
 assert.equal(r.work.actualReplayEndpointRows,witnesses*r.work.uniqueSources*r.originalTimes.length);
 assert.equal(r.work.actualObservationReplayRows,witnesses*r.readings.length);
 assert.equal(r.work.exactObjectives,2*r.alternatives.length);assert.equal(r.work.exactSolves,r.patterns.length+4*r.alternatives.length);
 assert(r.work.linearPivots<=8192&&r.work.linearRationalOperations<=24000000);
 assert.deepEqual(r.query,investigation.query);return true;
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
test('fresh complete original record admits each requirement separately but no common profile in its fixed minimum class',async()=>{
 const example=makeSkyJointExample(),before=JSON.stringify(example),output=prepareSkyJointEvidence(example.readings,example.query);baseline=output;const r=output.report;
 assert.equal(JSON.stringify(example),before);assert.deepEqual(output.investigation.readings,example.readings);inspect(output);
 assert.equal(r.minimumChanges,2);assert.equal(r.patterns.length,121);assert.deepEqual(r.alternatives.map(a=>a.splitAfterIntervals),[[6,10]]);
 assert.equal(r.readings.length,24);assert.equal(r.work.uniqueSources,3);assert.equal(r.originalTimes.length,17);
 assert.deepEqual(r.requirements.map(t=>[t.sourceIndex,t.originalIndex,t.store]),[[0,8,'surfaceC'],[0,16,'surfaceC']]);
 assert.equal(r.jointStatus,'joint-incompatible');assert.deepEqual(r.jointPatternIndices,[]);
 assert.deepEqual(r.individual,[{requirementIndex:0,status:'compatible',patternIndices:[79]},{requirementIndex:1,status:'compatible',patternIndices:[79]}]);
 assert.equal(r.work.actualWitnessProfiles,2);assert.equal(r.work.actualReplayEndpointRows,102);assert.equal(r.work.actualObservationReplayRows,48);
 assert.equal(r.work.exactSolves,125);assert.equal(r.work.exactObjectives,2);
 assert.equal(r.alternatives[0].individual[0].witness.requirements[1].representedStatus,'not-met');
 assert.equal(r.alternatives[0].individual[1].witness.requirements[0].representedStatus,'not-met');
 await save('native-joint-original',output);
});
test('whole-interval upper and lower requirements, exact equality and an impossible individual all retain the unfamiliar original clock',async()=>{
 const readings=shortOriginals(),query=broadQuery(readings),before=JSON.stringify(readings),good=prepareSkyJointEvidence(readings,query);
 inspect(good);assert.equal(good.report.minimumChanges,0);assert.equal(good.report.jointStatus,'joint-compatible');assert.equal(good.report.patterns.length,1);
 assert.equal(good.report.unexaminedHigherChangePatterns,1);assert.equal(good.report.work.actualWitnessProfiles,3);
 assert.equal(good.report.originalTimes.at(-1).utc,'2026-06-21T04:19:37.000Z');assert.equal(good.report.originalTimes.at(-1).minute,19.4);
 await save('native-joint-short-positive',good);
 const equality=structuredClone(query);for(const [i,target]of equality.requirements.entries())Object.assign(target,{receiverReadingIndex:0,utc:good.report.originalTimes[0].utc,store:'surfaceC',differenceC:0,relation:i?'at-least':'at-most'});
 const contact=prepareSkyJointEvidence(readings,equality);inspect(contact);assert.equal(contact.report.jointStatus,'joint-compatible');
 for(const entry of [...contact.report.alternatives[0].individual,contact.report.alternatives[0].joint])for(const item of entry.witness.requirements)assert.equal(item.representedStatus,'met');
 await save('native-joint-exact-contact',contact);
 const impossible=structuredClone(equality);impossible.requirements[1].differenceC=1;
 const one=prepareSkyJointEvidence(readings,impossible);inspect(one);assert.equal(one.report.jointStatus,'joint-incompatible');assert.equal(one.report.work.actualWitnessProfiles,1);
 assert.deepEqual(one.report.individual.map(x=>x.status),['compatible','incompatible']);await save('native-joint-one-impossible',one);
 assert.equal(JSON.stringify(readings),before);
});
test('an empty original family leaves requirements unevaluated and has no vacuous witnesses',async()=>{
 const readings=shortOriginals(),query=broadQuery(readings);readings[2].query.reading.temperatureC=400;readings[2].query.reading.halfWidthC=0;
 const output=prepareSkyJointEvidence(readings,query),r=output.report;inspect(output);assert.equal(r.compatibility,'incompatible');assert.equal(r.minimumChanges,null);
 assert.equal(r.jointStatus,'original-incompatible');assert.equal(r.individual,null);assert.deepEqual(r.jointPatternIndices,[]);assert.deepEqual(r.alternatives,[]);
 assert.equal(r.patterns.length,2);assert.equal(r.work.executedWitnessCourses,0);assert.equal(r.work.exactObjectives,0);await save('native-joint-original-empty',output);
});
test('source-only reopening binds both requirements; prior inquiries retain observations and drop their derived target or cuts',()=>{
 assert(baseline);const own=baseline.investigation,text=serializeSkyJointSource(own);assert.deepEqual(parseSkyJointSource(text),own);
 assert.deepEqual(Object.keys(JSON.parse(text)),['kind','model','readings','query']);assert.deepEqual(parseSkyJointOriginals([text]),{readings:own.readings,sharingSource:own.query.sharingSource,ownQuery:own.query,modelQuery:null});
 const base={bins:4,maximumChanges:own.query.maximumChanges,sharingSource:own.query.sharingSource,searchSource:own.query.searchSource};
 const target={receiverReadingIndex:0,utc:own.query.requirements[0].utc,store:'surfaceC'};
 for(const previous of [prepareSkyConsequenceSource(own.readings,{...base,target}),prepareSkyChangeSource(own.readings,base)]){
  const loaded=parseSkyJointOriginals([JSON.stringify(previous)]);assert.deepEqual(loaded.readings,own.readings);assert.equal(loaded.ownQuery,null);assert.deepEqual(loaded.modelQuery,base);
 }
 const three=makeThreeEpochSkyExample(),prior=parseSkyJointOriginals([JSON.stringify(prepareThreeEpochSkySource(three.readings,three.query))]);
 assert.deepEqual(prior.readings,three.readings);assert.equal(prior.modelQuery,null);assert.equal(prior.ownQuery,null);
 assert.deepEqual(parseSkyJointOriginals(three.readings.map(JSON.stringify)).readings,three.readings);
 const mutations=[s=>s.report={},s=>s.query.knownCuts=[6,10],s=>s.query.target={},s=>s.query.requirements.pop(),s=>s.query.requirements.push(s.query.requirements[0]),s=>s.model.version=2,
  ...[t=>t.utc='2026-06-21T12:00:00.001Z',t=>t.receiverReadingIndex=24,t=>t.receiverReadingIndex=.5,t=>t.store='airC',t=>t.relation='some-at-most',t=>t.differenceC=null,t=>t.differenceC='0',t=>t.source='',t=>t.source=' '.repeat(4),t=>t.source='x'.repeat(401),t=>t.interpolated=true].map(f=>s=>f(s.query.requirements[0])),s=>s.readings[0].query.reading.witness={}];
 for(const mutate of mutations){const source=structuredClone(own);mutate(source);assert.throws(()=>parseSkyJointSource(JSON.stringify(source)));}
 const sparse=structuredClone(own.query);delete sparse.requirements[0];assert.throws(()=>prepareSkyJointSource(own.readings,sparse));
 const infinite=structuredClone(own.query);infinite.requirements[0].differenceC=Infinity;assert.throws(()=>prepareSkyJointSource(own.readings,infinite));
 assert.throws(()=>serializeSkyJointSource({...own,report:{}}));assert.throws(()=>parseSkyJointSource('['));assert.throws(()=>parseSkyJointOriginals([text+' '.repeat(5*1024*1024)]),/5 MiB/);
});
test('complete maximum admission reserves three profiles per original compatible pattern and all four additional solves',()=>{
 const raw=makeSkyJointExample();for(const input of raw.readings)input.source.declaration.path.endUtc='2026-06-21T16:00:00.000Z';
 const work=inspectSkyJointWork(raw.readings,raw.query);assert.equal(work.intervals,24);assert.equal(work.declaredPatterns,277);assert.equal(work.reservedWitnessProfiles,759);
 assert.equal(work.reservedDistinctBasisCourses,112656);assert.equal(work.reservedWitnessCourses,9108);assert.equal(work.reservedThermalCourses,121764);
 assert.equal(work.reservedCourseIntervals,2922336);assert.equal(work.reservedReplayEndpointRows,56925);assert.equal(work.reservedObservationReplayRows,18216);
 assert.equal(work.reservedRequirementSolvesPerCompatiblePattern,4);assert.equal(work.reservedObjectivesPerCompatiblePattern,2);
 assert.equal(work.reservedLinearRationalOperations,24000000);assert.equal(work.reservedLinearPivots,8192);assert.equal(work.maximumCompleteReportBytes,64*1024*1024);
 assert.equal(work.reservedThermalCourses,SKY_JOINT_LIMITS.maxThermalCourses);assert.equal(inspectSkyJointWork(raw.readings,{...raw.query,maximumChanges:0}).reservedWitnessProfiles,3);
});
test('maintained worker ownership retires an older joint completion before admitting a newer complete result',async()=>{
 assert(baseline);const workers=[];let terminated=0;
 const computation=createShadeHeatComputation(()=>{const worker={terminate(){terminated++;},postMessage(){}};workers.push(worker);return worker;});
 const first=computation.compute({operation:'prepare'}),firstOutcome=first.then(()=>null,error=>error.code),oldHandler=workers[0].onmessage,second=computation.compute({operation:'prepare'});
 oldHandler({data:{ok:true,result:baseline}});assert.equal(computation.pending,true);workers[1].onmessage({data:{ok:true,result:baseline}});
 assert.deepEqual(await second,baseline);assert.equal(await firstOutcome,'superseded');assert.equal(computation.pending,false);assert.equal(terminated,2);
});
