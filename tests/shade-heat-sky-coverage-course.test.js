import test from 'node:test';
import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
import {makeSkyCoverageExample} from '../shade-heat-sky-coverage-example.js';
import {prepareSkyCoverageEvidence,prepareSkyCoverageSource,parseSkyCoverageSource,serializeSkyCoverageSource,inspectSkyCoverageWork,SKY_COVERAGE_LIMITS} from '../shade-heat-sky-coverage-course.js';
import {parseSkyCoverageOriginals} from '../shade-heat-sky-coverage-inputs.js';
import {prepareSkyRelaxationSource} from '../shade-heat-sky-relaxation-course.js';
import {prepareSkyJointSource} from '../shade-heat-sky-joint-course.js';
import {prepareSkyConsequenceSource} from '../shade-heat-sky-consequence-course.js';
import {prepareSkyChangeSource} from '../shade-heat-sky-change-course.js';
import {prepareThreeEpochSkySource} from '../shade-heat-three-epoch-course.js';
import {makeThreeEpochSkyExample} from '../shade-heat-three-epoch-example.js';
import {originalSkyReadingTimes,prepareTimedSkyReadingSource} from '../shade-heat-timed-reading-source.js';
import {verifyMinimumSkyCoverage} from '../shade-heat-sky-coverage.js';
import {createShadeHeatComputation} from '../shade-heat-computation.js';
import {rational as q,add,sub,cmp} from '../vendor/chronos/exact-halfplanes.mjs';
const fraction=value=>[BigInt(value.exact.numerator),BigInt(value.exact.denominator)];
function revive(value){if(Array.isArray(value)){if(value.length===2&&value.every(x=>typeof x==='string'&&/^-?\d+$/.test(x)))return value.map(BigInt);return value.map(revive);}if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,revive(item)]));return value;}
async function save(name,value){if(!process.env.EARTH_COVERAGE_TEST_REPORT_DIR)return;await mkdir(process.env.EARTH_COVERAGE_TEST_REPORT_DIR,{recursive:true});await writeFile(process.env.EARTH_COVERAGE_TEST_REPORT_DIR+'/'+name+'.json',JSON.stringify(value,null,2)+'\n');}
function inspect(output){
 const {investigation,report:r}=output,e=revive(r.exactEvidence),result=e.result,minimum=result.minimum;
 assert(verifyMinimumSkyCoverage(e.observedIntervalRows,e.bands,e.requirementIntervalRows,result));
 assert.deepEqual(r.someProfileAttainingPatternIndices,minimum.attainingPatternIndices);
 assert.deepEqual(r.allProfileAttainingPatternIndices,result.allProfileAttainingPatternIndices);
 for(const key of ['rawMaximumPairs','controllingPairs','zeroCoverPatternIndices'])assert.deepEqual(r[key],result[key]);
 for(const key of ['allProfilesMeetOriginal','floorActive','floorOnly'])assert.equal(r[key],result[key]);
 assert.equal(r.someProfileMeetsOriginal,minimum.originalRequirementsCompatible);
 for(const key of ['someProfileRelaxation','allProfileRelaxation','rawMaximumViolation','coverageGap']){
  if(r[key+'C']===null)assert.equal(result[key],null);else assert.equal(cmp(fraction(r[key+'C']),result[key]),0);
 }
 for(const pattern of r.alternatives){
  assert(pattern.maximumLowerMinusUpperC.every(value=>cmp(fraction(value),q(0))<=0));
  const some=minimum.cases.find(x=>x.patternIndex===pattern.patternIndex),all=result.cases.find(x=>x.patternIndex===pattern.patternIndex);
  assert.equal(cmp(fraction(pattern.someProfileRelaxationC),some.relaxation.value),0);
  assert.equal(cmp(fraction(pattern.allProfileRelaxationC),all.allProfileRelaxation),0);
  assert.equal(cmp(fraction(pattern.rawMaximumViolationC),all.rawMaximumViolation),0);
  assert.equal(pattern.someProfileAttainsGlobalMinimum,r.someProfileAttainingPatternIndices.includes(pattern.patternIndex));
  assert.equal(pattern.allProfileAttainsGlobalMaximum,r.allProfileAttainingPatternIndices.includes(pattern.patternIndex));
  for(const key of ['rawMaximumRequirementIndices','bindingRequirementIndices'])assert.deepEqual(pattern[key],all[key]);
  for(const key of ['floorActive','floorOnly'])assert.equal(pattern[key],all[key]);
  assert.equal(pattern.maxima.length,2);
  const witnesses=[pattern.someProfile,...pattern.maxima.map(m=>m.witness)];
  for(const [i,w]of witnesses.entries()){
   const delta=i===0?some.relaxation.value:result.allProfileRelaxation,profile=i===0?some.relaxation.witness:all.tests[i-1].witness;
   assert.equal(cmp(fraction(w.allowanceC),delta),0);assert.equal(cmp(fraction(w.requiredRelaxationC),profile.requiredRelaxation),0);
   assert.equal(w.role,i===0?'some-profile':'requirement-maximum');assert.equal(w.requirementIndex,i===0?null:i-1);
   if(i===0)assert.equal(w.maximumViolationC,null);else{
    const m=pattern.maxima[i-1],max=all.tests[i-1].maximumViolation;
    assert.equal(m.requirementIndex,i-1);assert.equal(cmp(fraction(m.maximumViolationC),max),0);assert.equal(cmp(fraction(w.maximumViolationC),max),0);
    assert.equal(m.attainsGlobalRawMaximum,r.rawMaximumPairs.some(p=>p.patternIndex===pattern.patternIndex&&p.requirementIndex===i-1));
    assert.equal(m.controlsAllProfileAmount,r.controllingPairs.some(p=>p.patternIndex===pattern.patternIndex&&p.requirementIndex===i-1));
   }
   assert.equal(w.patternIndex,pattern.patternIndex);assert.equal(w.originalReplays.length,r.work.uniqueSources);assert.equal(w.originalObservations.length,r.readings.length);
   for(const p of w.phaseProfiles)assert.equal(cmp(p.map(fraction).reduce(add,q(0)),q(1)),0);
   for(const row of w.originalObservations){const original=r.readings[row.recordIndex];
    assert.equal(row.utc,original.utc);assert.equal(row.store,original.store);assert.equal(row.cellIndex,original.cellIndex);
    assert(cmp(fraction(row.additiveC),fraction(original.bandC.lower))>=0&&cmp(fraction(row.additiveC),fraction(original.bandC.upper))<=0);
    for(const side of ['lower','upper'])assert.equal(row.endpointStatus[side],cmp(q(row.originalC[side]),fraction(original.bandC.lower))>=0&&cmp(q(row.originalC[side]),fraction(original.bandC.upper))<=0?'within-original-band':'outside-original-band');
   }
   for(const replay of w.originalReplays){assert.deepEqual(replay.originalCourse.map(({index,utc,minute,thermalMinute})=>({index,utc,minute,thermalMinute})),r.originalTimes);assert(replay.maximumReplayResidualC.upper<=1e-9);}
   for(const target of r.requirements){const value=w.requirements[target.requirementIndex],row=w.originalReplays[target.sourceIndex].originalCourse[target.originalIndex];
    const represented={lower:sub(fraction(row.additiveC.proposal.lower[target.store]),fraction(row.additiveC.existing.upper[target.store])),
     upper:sub(fraction(row.additiveC.proposal.upper[target.store]),fraction(row.additiveC.existing.lower[target.store]))};
    const numerical={lower:sub(q(row.originalC.proposal.lower[target.store]),q(row.originalC.existing.upper[target.store])),
     upper:sub(q(row.originalC.proposal.upper[target.store]),q(row.originalC.existing.lower[target.store]))};
    for(const side of ['lower','upper']){assert.equal(cmp(fraction(value.representedPairC[side]),represented[side]),0);assert.equal(cmp(fraction(value.originalNumericalPairC[side]),numerical[side]),0);}
    const original=q(target.differenceC),relaxed=target.relation==='at-most'?add(original,delta):sub(original,delta);
    assert.equal(cmp(fraction(value.originalLimitC),original),0);assert.equal(cmp(fraction(value.relaxedLimitC),relaxed),0);
    const status=(pair,limit)=>(target.relation==='at-most'?cmp(pair.upper,limit)<=0:cmp(pair.lower,limit)>=0)?'met':'not-met';
    assert.equal(value.representedStatus,status(represented,original));assert.equal(value.originalNumericalStatus,status(numerical,original));
    assert.equal(value.relaxedRepresentedStatus,status(represented,relaxed));assert.equal(value.relaxedRepresentedStatus,'met');
    assert.equal(value.relaxedOriginalNumericalStatus,status(numerical,relaxed));
    const violation=target.relation==='at-most'?sub(represented.upper,original):sub(original,represented.lower);
    if(i>0&&target.requirementIndex===i-1)assert.equal(cmp(violation,fraction(w.maximumViolationC)),0);
   }
  }
 }
 const patterns=r.alternatives.length,witnesses=3*patterns;
 assert.equal(r.work.actualWitnessProfiles,witnesses);assert.equal(r.work.executedWitnessCourses,witnesses*r.work.uniqueSources*4);
 assert.equal(r.work.actualReplayEndpointRows,witnesses*r.work.uniqueSources*r.originalTimes.length);assert.equal(r.work.actualObservationReplayRows,witnesses*r.readings.length);
 assert.equal(r.work.exactObjectives,5*patterns);assert.equal(r.work.exactSolves,r.patterns.length+3*patterns);
 assert.equal(r.work.exactRelaxationSolves,patterns);assert.equal(r.work.exactOrderSolves,patterns);assert.equal(r.work.exactCoverageSolves,patterns);assert.equal(r.work.exactCoverageObjectives,2*patterns);
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
test('the unchanged24-record example compares one profile and every profile with three distinct replay roles',async()=>{
 const example=makeSkyCoverageExample(),before=JSON.stringify(example),output=prepareSkyCoverageEvidence(example.readings,example.query);baseline=output;const r=output.report;
 assert.equal(JSON.stringify(example),before);assert.deepEqual(output.investigation.readings,example.readings);inspect(output);
 assert.equal(r.minimumChanges,2);assert.equal(r.patterns.length,121);assert.deepEqual(r.alternatives.map(a=>a.splitAfterIntervals),[[6,10]]);
 assert.equal(r.readings.length,24);assert.equal(r.work.uniqueSources,3);assert.equal(r.originalTimes.length,17);
 assert.deepEqual(r.requirements.map(t=>[t.sourceIndex,t.originalIndex,t.store]),[[0,8,'surfaceC'],[0,16,'surfaceC']]);
 assert.equal(r.coverageStatus,'compared-common-relaxations');assert(cmp(fraction(r.someProfileRelaxationC),q(0))>0);
 assert(cmp(fraction(r.allProfileRelaxationC),fraction(r.someProfileRelaxationC))>0);
 assert.deepEqual(r.someProfileAttainingPatternIndices,[79]);assert.deepEqual(r.allProfileAttainingPatternIndices,[79]);
 assert.deepEqual(r.zeroCoverPatternIndices,[]);assert.equal(r.someProfileMeetsOriginal,false);assert.equal(r.allProfilesMeetOriginal,false);assert.equal(r.floorActive,false);assert.equal(r.floorOnly,false);
 assert.equal(r.work.actualWitnessProfiles,3);assert.equal(r.work.actualReplayEndpointRows,153);assert.equal(r.work.actualObservationReplayRows,72);
 assert.equal(r.work.exactSolves,124);assert.equal(r.work.exactObjectives,5);assert.equal(r.work.executedThermalCourses,47604);
 assert(r.alternatives[0].someProfile.requirements.some(x=>x.representedStatus==='not-met'));
 assert(r.alternatives[0].maxima.every(m=>m.witness.requirements.every(x=>x.relaxedRepresentedStatus==='met')));
 await save('native-coverage-original',output);
});
test('unfamiliar clocks distinguish floor-only zero, exact contact and constant positive universal bounds',async()=>{
 const readings=shortOriginals(),query=broadQuery(readings),before=JSON.stringify(readings),good=prepareSkyCoverageEvidence(readings,query);
 inspect(good);assert.equal(good.report.minimumChanges,0);assert.equal(cmp(fraction(good.report.someProfileRelaxationC),q(0)),0);
 assert.equal(cmp(fraction(good.report.allProfileRelaxationC),q(0)),0);assert(cmp(fraction(good.report.rawMaximumViolationC),q(0))<0);
 assert.equal(good.report.floorOnly,true);assert.equal(good.report.floorActive,true);assert.deepEqual(good.report.controllingPairs,[]);
 assert.equal(good.report.patterns.length,1);assert.equal(good.report.unexaminedHigherChangePatterns,1);assert.equal(good.report.work.actualWitnessProfiles,3);
 assert.equal(good.report.originalTimes.at(-1).utc,'2026-06-21T04:19:37.000Z');assert.equal(good.report.originalTimes.at(-1).minute,19.4);
 await save('native-coverage-short-zero',good);
 const equality=structuredClone(query);for(const [i,target]of equality.requirements.entries())Object.assign(target,{receiverReadingIndex:0,utc:good.report.originalTimes[0].utc,store:'surfaceC',differenceC:0,relation:i?'at-least':'at-most'});
 const contact=prepareSkyCoverageEvidence(readings,equality);inspect(contact);assert.equal(cmp(fraction(contact.report.allProfileRelaxationC),q(0)),0);
 assert.equal(contact.report.floorOnly,false);assert.equal(contact.report.floorActive,true);assert.equal(contact.report.controllingPairs.length,2);
 assert(contact.report.alternatives[0].someProfile.requirements.every(x=>x.representedStatus==='met'));await save('native-coverage-exact-contact',contact);
 const impossible=structuredClone(equality);impossible.requirements[1].differenceC=1;
 const one=prepareSkyCoverageEvidence(readings,impossible);inspect(one);assert.equal(cmp(fraction(one.report.someProfileRelaxationC),q(1)),0);
 assert.equal(cmp(fraction(one.report.allProfileRelaxationC),q(1)),0);assert.equal(one.report.work.actualWitnessProfiles,3);
 assert.deepEqual(one.report.controllingPairs,[{patternIndex:0,requirementIndex:1}]);
 assert.deepEqual(one.report.alternatives[0].someProfile.requirements.map(x=>x.representedStatus),['met','not-met']);await save('native-coverage-constant-positive',one);
 assert.equal(JSON.stringify(readings),before);
});
test('an empty original family has no one-profile or every-profile amount and no vacuous guarantee',async()=>{
 const readings=shortOriginals(),query=broadQuery(readings);readings[2].query.reading.temperatureC=400;readings[2].query.reading.halfWidthC=0;
 const output=prepareSkyCoverageEvidence(readings,query),r=output.report;inspect(output);assert.equal(r.compatibility,'incompatible');assert.equal(r.minimumChanges,null);
 assert.equal(r.coverageStatus,'original-incompatible');
 for(const key of ['someProfileRelaxationC','allProfileRelaxationC','rawMaximumViolationC','coverageGapC','someProfileMeetsOriginal','allProfilesMeetOriginal','floorActive','floorOnly'])assert.equal(r[key],null);
 for(const key of ['someProfileAttainingPatternIndices','allProfileAttainingPatternIndices','rawMaximumPairs','controllingPairs','zeroCoverPatternIndices','alternatives'])assert.deepEqual(r[key],[]);
 assert.equal(r.patterns.length,2);assert.equal(r.work.executedWitnessCourses,0);assert.equal(r.work.exactObjectives,0);await save('native-coverage-original-empty',output);
});
test('source-only reopening preserves original thresholds; older inquiries retain observations and omit derived decisions',()=>{
 assert(baseline);const own=baseline.investigation,text=serializeSkyCoverageSource(own);assert.deepEqual(parseSkyCoverageSource(text),own);
 assert.deepEqual(Object.keys(JSON.parse(text)),['kind','model','readings','query']);assert.deepEqual(parseSkyCoverageOriginals([text]),{readings:own.readings,sharingSource:own.query.sharingSource,ownQuery:own.query,modelQuery:null});
 const base={bins:4,maximumChanges:own.query.maximumChanges,sharingSource:own.query.sharingSource,searchSource:own.query.searchSource};
 const target={receiverReadingIndex:0,utc:own.query.requirements[0].utc,store:'surfaceC'};
 for(const previous of [prepareSkyRelaxationSource(own.readings,own.query),prepareSkyJointSource(own.readings,own.query),prepareSkyConsequenceSource(own.readings,{...base,target}),prepareSkyChangeSource(own.readings,base)]){
  const loaded=parseSkyCoverageOriginals([JSON.stringify(previous)]);assert.deepEqual(loaded.readings,own.readings);assert.equal(loaded.ownQuery,null);assert.deepEqual(loaded.modelQuery,base);
 }
 const three=makeThreeEpochSkyExample(),prior=parseSkyCoverageOriginals([JSON.stringify(prepareThreeEpochSkySource(three.readings,three.query))]);
 assert.deepEqual(prior.readings,three.readings);assert.equal(prior.modelQuery,null);assert.equal(prior.ownQuery,null);
 assert.deepEqual(parseSkyCoverageOriginals(three.readings.map(JSON.stringify)).readings,three.readings);
 const mutations=[s=>s.report={},s=>s.query.knownCuts=[6,10],s=>s.query.relaxationC=0,s=>s.query.requirements.pop(),s=>s.query.requirements.push(s.query.requirements[0]),s=>s.model.version=2,
  ...[t=>t.utc='2026-06-21T12:00:00.001Z',t=>t.receiverReadingIndex=24,t=>t.receiverReadingIndex=.5,t=>t.store='airC',t=>t.relation='some-at-most',t=>t.differenceC=null,t=>t.differenceC='0',t=>t.source='',t=>t.source=' '.repeat(4),t=>t.source='x'.repeat(401),t=>t.relaxedLimit=0].map(f=>s=>f(s.query.requirements[0])),s=>s.readings[0].query.reading.witness={}];
 for(const mutate of mutations){const source=structuredClone(own);mutate(source);assert.throws(()=>parseSkyCoverageSource(JSON.stringify(source)));}
 const sparse=structuredClone(own.query);delete sparse.requirements[0];assert.throws(()=>prepareSkyCoverageSource(own.readings,sparse));
 const infinite=structuredClone(own.query);infinite.requirements[0].differenceC=Infinity;assert.throws(()=>prepareSkyCoverageSource(own.readings,infinite));
 assert.throws(()=>serializeSkyCoverageSource({...own,report:{}}));assert.throws(()=>parseSkyCoverageSource('['));assert.throws(()=>parseSkyCoverageOriginals([text+' '.repeat(5*1024*1024)]),/5 MiB/);
});
test('maximum admission reserves three profiles, five objectives and three additional solves per compatible original pattern',()=>{
 const raw=makeSkyCoverageExample();for(const input of raw.readings)input.source.declaration.path.endUtc='2026-06-21T16:00:00.000Z';
 const work=inspectSkyCoverageWork(raw.readings,raw.query);assert.equal(work.intervals,24);assert.equal(work.declaredPatterns,277);assert.equal(work.reservedWitnessProfiles,759);
 assert.equal(work.reservedDistinctBasisCourses,112656);assert.equal(work.reservedWitnessCourses,9108);assert.equal(work.reservedThermalCourses,121764);
 assert.equal(work.reservedCourseIntervals,2922336);assert.equal(work.reservedReplayEndpointRows,56925);assert.equal(work.reservedObservationReplayRows,18216);
 assert.equal(work.reservedRequirementSolvesPerCompatiblePattern,3);assert.equal(work.reservedObjectivesPerCompatiblePattern,5);
 assert.equal(work.reservedLinearRationalOperations,24000000);assert.equal(work.reservedLinearPivots,8192);assert.equal(work.maximumCompleteReportBytes,64*1024*1024);
 assert.equal(work.reservedThermalCourses,SKY_COVERAGE_LIMITS.maxThermalCourses);assert.equal(inspectSkyCoverageWork(raw.readings,{...raw.query,maximumChanges:0}).reservedWitnessProfiles,3);
});
test('maintained worker ownership retires an older relaxation completion before admitting a newer complete result',async()=>{
 assert(baseline);const workers=[];let terminated=0;
 const computation=createShadeHeatComputation(()=>{const worker={terminate(){terminated++;},postMessage(){}};workers.push(worker);return worker;});
 const first=computation.compute({operation:'prepare'}),firstOutcome=first.then(()=>null,error=>error.code),oldHandler=workers[0].onmessage,second=computation.compute({operation:'prepare'});
 oldHandler({data:{ok:true,result:baseline}});assert.equal(computation.pending,true);workers[1].onmessage({data:{ok:true,result:baseline}});
 assert.deepEqual(await second,baseline);assert.equal(await firstOutcome,'superseded');assert.equal(computation.pending,false);assert.equal(terminated,2);
});
