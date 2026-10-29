import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {makeSkyConditionalExample} from '../shade-heat-sky-conditional-example.js';
import {prepareSkyConditionalEvidence,prepareSkyConditionalSource,parseSkyConditionalSource,serializeSkyConditionalSource,inspectSkyConditionalWork,SKY_CONDITIONAL_COURSE_LIMITS} from '../shade-heat-sky-conditional-course.js';
import {parseSkyConditionalOriginals} from '../shade-heat-sky-conditional-inputs.js';
import {prepareSkyCoverageSource} from '../shade-heat-sky-coverage-course.js';
import {prepareSkyChangeSource} from '../shade-heat-sky-change-course.js';
import {makeThreeEpochSkyExample} from '../shade-heat-three-epoch-example.js';
import {prepareTimedSkyReadingSource,originalSkyReadingTimes} from '../shade-heat-timed-reading-source.js';
import {verifyMinimumSkyConditionalConsequence} from '../shade-heat-sky-conditional.js';
import {parseSkyAllowanceText} from '../shade-heat-sky-allowance.js';
import {createShadeHeatComputation} from '../shade-heat-computation.js';
import {rational as q,add,sub,cmp} from '../vendor/chronos/exact-halfplanes.mjs';
const fraction=v=>[BigInt(v.exact.numerator),BigInt(v.exact.denominator)],eq=(a,b)=>assert.equal(cmp(a,b),0);
function revive(v){if(Array.isArray(v)){if(v.length===2&&v.every(x=>typeof x==='string'&&/^-?\d+$/.test(x)))return v.map(BigInt);return v.map(revive);}if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,revive(x)]));return v;}
async function save(name,value){if(!process.env.EARTH_CONDITIONAL_TEST_REPORT_DIR)return;await mkdir(process.env.EARTH_CONDITIONAL_TEST_REPORT_DIR,{recursive:true});await writeFile(process.env.EARTH_CONDITIONAL_TEST_REPORT_DIR+'/'+name+'.json',JSON.stringify(value,null,2)+'\n');await writeFile(process.env.EARTH_CONDITIONAL_TEST_REPORT_DIR+'/'+name+'-inputs.json',serializeSkyConditionalSource(value.investigation));}
function inspect(output){
 const {investigation,report:r}=output,e=revive(r.exactEvidence),v=e.result,delta=parseSkyAllowanceText(investigation.query.allowanceC);
 assert(verifyMinimumSkyConditionalConsequence(e.observedIntervalRows,e.bands,e.requirementIntervalRows,delta,e.consequenceIntervalRows,v));
 assert.equal(r.conditionalStatus,v.status);assert.equal(r.minimumChanges,v.analysis.minimumChanges);assert.equal(r.compatibility,v.analysis.status);assert.deepEqual(r.query,investigation.query);
 for(const key of ['conditionalPatternIndices','conditionalExcludedPatternIndices','lowerAttainingPatternIndices','upperAttainingPatternIndices'])assert.deepEqual(r[key],v[key]);
 eq(fraction(r.allowanceC),delta);assert.equal(r.alternatives.length,v.cases.length);
 const location=r.consequence;assert.deepEqual(Object.fromEntries(['receiverReadingIndex','utc','store','source'].map(k=>[k,location[k]])),investigation.query.consequence);
 assert.equal(location.sourceIndex,r.work.recordSourceIndices[location.receiverReadingIndex]);assert.equal(r.originalTimes[location.originalIndex].utc,location.utc);
 for(const p of r.alternatives){
  const proof=v.cases.find(x=>x.patternIndex===p.patternIndex);assert.deepEqual(p.splitAfterIntervals,proof.splits);
  if(proof.status==='incompatible'){assert.equal(p.conditionalStatus,'incompatible');for(const key of ['rangeC','extremes','conditionedMaximumLowerMinusUpperC'])assert.equal(p[key],null);continue;}
  assert.equal(p.conditionalStatus,'compatible');eq(fraction(p.rangeC.lower),proof.range.lower);eq(fraction(p.rangeC.upper),proof.range.upper);
  for(const role of ['lower','upper']){
   const w=p.extremes[role];assert.equal(w.role,role);assert.equal(w.patternIndex,p.patternIndex);eq(fraction(w.valueC),proof[role].value);eq(fraction(w.requiredRelaxationC),proof[role].witness.requiredRelaxation);
   eq(fraction(w.allowanceC),delta);assert.equal(w.originalReplays.length,r.work.uniqueSources);assert.equal(w.originalObservations.length,r.readings.length);
   for(const replay of w.originalReplays){assert.deepEqual(replay.originalCourse.map(({index,utc,minute,thermalMinute})=>({index,utc,minute,thermalMinute})),r.originalTimes);assert(replay.maximumReplayResidualC.upper<=1e-9);}
   for(const observation of w.originalObservations){
    const input=r.readings[observation.recordIndex],band=input.bandC;assert.equal(observation.utc,input.utc);assert.equal(observation.store,input.store);
    assert(cmp(fraction(observation.additiveC),fraction(band.lower))>=0&&cmp(fraction(observation.additiveC),fraction(band.upper))<=0);
    for(const side of ['lower','upper'])assert.equal(observation.endpointStatus[side],cmp(q(observation.originalC[side]),fraction(band.lower))>=0&&cmp(q(observation.originalC[side]),fraction(band.upper))<=0?'within-original-band':'outside-original-band');
   }
   const checkPair=(at,represented,numerical)=>{
    const row=w.originalReplays[at.sourceIndex].originalCourse[at.originalIndex],store=at.store;assert.equal(row.utc,at.utc);
    eq(fraction(represented.lower),sub(fraction(row.additiveC.proposal.lower[store]),fraction(row.additiveC.existing.upper[store])));
    eq(fraction(represented.upper),sub(fraction(row.additiveC.proposal.upper[store]),fraction(row.additiveC.existing.lower[store])));
    eq(fraction(numerical.lower),sub(q(row.originalC.proposal.lower[store]),q(row.originalC.existing.upper[store])));
    eq(fraction(numerical.upper),sub(q(row.originalC.proposal.upper[store]),q(row.originalC.existing.lower[store])));
   };
   for(const at of r.requirements){
    const value=w.requirements[at.requirementIndex];checkPair(at,value.representedPairC,value.originalNumericalPairC);
    const selected=at.relation==='at-most'?add(q(at.differenceC),delta):sub(q(at.differenceC),delta);eq(fraction(value.selectedLimitC),selected);eq(fraction(at.selectedLimitC),selected);
    for(const [pair,status,limit]of [[value.representedPairC,'representedStatus',q(at.differenceC)],[value.representedPairC,'selectedRepresentedStatus',selected],[value.originalNumericalPairC,'originalNumericalStatus',q(at.differenceC)],[value.originalNumericalPairC,'selectedOriginalNumericalStatus',selected]]){
     assert.equal(value[status],(at.relation==='at-most'?cmp(fraction(pair.upper),limit)<=0:cmp(fraction(pair.lower),limit)>=0)?'met':'not-met');
    }
    assert.equal(value.selectedRepresentedStatus,'met');
   }
   checkPair(location,w.consequenceRepresentedPairC,w.consequenceOriginalNumericalPairC);eq(fraction(w.consequenceRepresentedPairC[role]),fraction(w.valueC));
  }
 }
 const all=r.alternatives.length,good=r.conditionalPatternIndices.length,profiles=2*good;
 assert.equal(r.work.actualWitnessProfiles,profiles);assert.equal(r.work.executedWitnessCourses,profiles*r.work.uniqueSources*4);
 assert.equal(r.work.actualReplayEndpointRows,profiles*r.work.uniqueSources*r.originalTimes.length);assert.equal(r.work.actualObservationReplayRows,profiles*r.readings.length);
 assert.equal(r.work.actualRequirementReplayRows,2*profiles);assert.equal(r.work.actualConsequenceReplayRows,profiles);
 assert.equal(r.work.exactSolves,r.patterns.length+2*all+2*good);assert.equal(r.work.exactObjectives,3*all+2*good);
 assert.equal(r.work.exactRequirementOrderSolves,all);assert.equal(r.work.exactConditionalOrderSolves,all);assert.equal(r.work.exactLowerSolves,good);assert.equal(r.work.exactUpperSolves,good);
 assert(r.work.linearPivots<=8192&&r.work.linearRationalOperations<=24000000);
 return true;
}
function shortOriginals(){
 const original=makeThreeEpochSkyExample().readings[0],source=structuredClone(original.source);
 Object.assign(source.declaration.path,{startUtc:'2026-06-21T04:00:13.000Z',endUtc:'2026-06-21T04:19:37.000Z',stepMinutes:13});
 return [[0,'surfaceC'],[1,'subsurfaceC'],[2,'surfaceC']].map(([index,store])=>prepareTimedSkyReadingSource(source.project,source.declaration,{bins:4,reading:{...original.query.reading,utc:originalSkyReadingTimes(source)[index].utc,store,temperatureC:25,halfWidthC:100,source:'Authored broad bands on an unfamiliar short original clock'}}));
}
function broadQuery(readings){
 const times=originalSkyReadingTimes(readings[0].source);
 return {bins:4,maximumChanges:2,sharingSource:'Authored unchanged shared receiver conditions',searchSource:'Original minimum before applying both conditions',
  requirements:[{receiverReadingIndex:0,utc:times.at(-1).utc,store:'surfaceC',relation:'at-most',differenceC:100,source:'Authored upper requirement'},
   {receiverReadingIndex:1,utc:times[1].utc,store:'subsurfaceC',relation:'at-least',differenceC:-100,source:'Authored lower requirement'}],
  allowanceC:'0',consequence:{receiverReadingIndex:2,utc:times.at(-1).utc,store:'subsurfaceC',source:'Authored third original endpoint'}};
}
let baseline;
test('24 original records bind both requirements and the third consequence to two distinct same-profile replays',async()=>{
 const example=makeSkyConditionalExample(),before=JSON.stringify(example);
 baseline=process.env.EARTH_CONDITIONAL_TEST_REPORT_DIR?JSON.parse(await readFile(process.env.EARTH_CONDITIONAL_TEST_REPORT_DIR+'/main.json','utf8')):prepareSkyConditionalEvidence(example.readings,example.query);
 const r=baseline.report;inspect(baseline);assert.equal(JSON.stringify(example),before);assert.deepEqual(baseline.investigation.readings,example.readings);
 assert.equal(r.minimumChanges,2);assert.equal(r.patterns.length,121);assert.deepEqual(r.alternatives.map(a=>a.splitAfterIntervals),[[6,10]]);
 assert.deepEqual(r.conditionalPatternIndices,[79]);assert.equal(r.conditionalStatus,'conditional-range');assert.equal(r.work.actualWitnessProfiles,2);assert.equal(r.work.actualReplayEndpointRows,102);
 assert.deepEqual([r.consequence.sourceIndex,r.consequence.originalIndex,r.consequence.store],[1,12,'subsurfaceC']);
 assert.equal(r.work.exactSolves,125);assert.equal(r.work.exactObjectives,5);await save('native-conditional-original',baseline);
});
test('unfamiliar original clocks retain broad ranges, conditional emptiness, exact contact and positive subnormal allowance',async()=>{
 const readings=shortOriginals(),query=broadQuery(readings),before=JSON.stringify(readings);
 const broad=prepareSkyConditionalEvidence(readings,query);inspect(broad);assert.equal(broad.report.minimumChanges,0);assert.equal(broad.report.conditionalStatus,'conditional-range');
 assert.equal(broad.report.originalTimes.at(-1).utc,'2026-06-21T04:19:37.000Z');assert.equal(broad.report.originalTimes.at(-1).minute,19.4);await save('native-conditional-short',broad);
 const impossible=structuredClone(query);for(const t of impossible.requirements)Object.assign(t,{receiverReadingIndex:0,utc:broad.report.originalTimes[0].utc,store:'surfaceC'});
 impossible.requirements[0].differenceC=0;impossible.requirements[1].differenceC=1;
 const empty=prepareSkyConditionalEvidence(readings,impossible);inspect(empty);assert.equal(empty.report.conditionalStatus,'conditional-empty');assert.equal(empty.report.minimumChanges,0);assert.equal(empty.report.alternatives.length,1);assert.equal(empty.report.work.actualWitnessProfiles,0);await save('native-conditional-empty',empty);
 const contact=prepareSkyConditionalEvidence(readings,{...impossible,allowanceC:'1'});inspect(contact);assert.equal(contact.report.conditionalStatus,'conditional-range');assert(contact.report.alternatives[0].extremes.lower.requirements.some(x=>x.representedStatus==='not-met'));await save('native-conditional-contact',contact);
 const initial=prepareSkyConditionalEvidence(readings,{...query,consequence:{...query.consequence,utc:broad.report.originalTimes[0].utc}});inspect(initial);eq(fraction(initial.report.hullC.lower),q(0));eq(fraction(initial.report.hullC.upper),q(0));await save('native-conditional-initial',initial);
 const tiny=prepareSkyConditionalEvidence(readings,{...query,allowanceC:'1 / '+String(2n**1075n)});inspect(tiny);assert.equal(fraction(tiny.report.allowanceC)[0],1n);assert.equal(fraction(tiny.report.allowanceC)[1],2n**1075n);await save('native-conditional-tiny',tiny);
 assert.equal(JSON.stringify(readings),before);
});
test('original-incompatible stays separate from a conditionally empty minimum family',async()=>{
 const readings=shortOriginals(),query=broadQuery(readings);readings[2].query.reading.temperatureC=400;readings[2].query.reading.halfWidthC=0;
 const output=prepareSkyConditionalEvidence(readings,query);inspect(output);const r=output.report;
 assert.equal(r.conditionalStatus,'original-incompatible');assert.equal(r.minimumChanges,null);assert.equal(r.hullC,null);assert.deepEqual(r.alternatives,[]);assert.equal(r.patterns.length,2);assert.equal(r.work.actualWitnessProfiles,0);await save('native-conditional-original-empty',output);
});
test('source-only reopening preserves exact allowance, original requirements and third target and rejects calculated or malformed declarations',()=>{
 assert(baseline);const own=baseline.investigation,text=serializeSkyConditionalSource(own);assert.deepEqual(parseSkyConditionalSource(text),own);assert.deepEqual(Object.keys(JSON.parse(text)),['kind','model','readings','query']);
 assert.deepEqual(parseSkyConditionalOriginals([text]).ownQuery,own.query);
 const {allowanceC,consequence,...priorQuery}=own.query,prior=prepareSkyCoverageSource(own.readings,priorQuery),loaded=parseSkyConditionalOriginals([JSON.stringify(prior)]);
 assert.deepEqual(loaded.readings,own.readings);assert.deepEqual(loaded.modelQuery,priorQuery);assert.equal(loaded.ownQuery,null);
 const {requirements,...base}=priorQuery;assert.deepEqual(parseSkyConditionalOriginals([JSON.stringify(prepareSkyChangeSource(own.readings,base))]).modelQuery,base);
 assert.deepEqual(parseSkyConditionalOriginals(own.readings.map(JSON.stringify)).readings,own.readings);
 const mutations=[s=>s.report={},s=>s.query.range={},s=>s.model.version=2,s=>s.query.requirements.pop(),s=>s.query.requirements.push(s.query.requirements[0]),s=>s.query.allowanceC=0,
  ...['','-1','NaN','Infinity','1/0','1e1234','1/'+String(2n**4096n)].map(v=>s=>s.query.allowanceC=v),
  ...[t=>t.receiverReadingIndex=24,t=>t.receiverReadingIndex=.5,t=>t.utc='2026-06-21T10:00:00.001Z',t=>t.store='airC',t=>t.source='',t=>t.source='x'.repeat(401),t=>t.range={}].map(f=>s=>f(s.query.consequence)),
  s=>s.query.requirements[0].relation='some-at-most',s=>s.query.requirements[0].differenceC=null,s=>s.readings[0].query.reading.witness={}];
 for(const mutate of mutations){const source=structuredClone(own);mutate(source);assert.throws(()=>parseSkyConditionalSource(JSON.stringify(source)));}
 const capacity=structuredClone(own.query);capacity.allowanceC=String(2n**4096n-1n);capacity.requirements[0].differenceC=2;assert.throws(()=>prepareSkyConditionalSource(own.readings,capacity),/allowance|capacity/);
 const sparse=structuredClone(own.query);delete sparse.requirements[0];assert.throws(()=>prepareSkyConditionalSource(own.readings,sparse));
 assert.throws(()=>serializeSkyConditionalSource({...own,report:{}}));assert.throws(()=>parseSkyConditionalSource('['));assert.throws(()=>parseSkyConditionalOriginals([text+' '.repeat(5*1024*1024)]),/5 MiB/);
 const decimal=prepareSkyConditionalSource(own.readings,{...own.query,allowanceC:'0.001'});assert.equal(decimal.query.allowanceC,'1 / 1000');
});
test('maximum admission reserves the complete original family plus both conditional extreme roles before thermal work',()=>{
 const raw=makeSkyConditionalExample();for(const input of raw.readings)input.source.declaration.path.endUtc='2026-06-21T16:00:00.000Z';
 const work=inspectSkyConditionalWork(raw.readings,raw.query);assert.equal(work.intervals,24);assert.equal(work.declaredPatterns,277);assert.equal(work.reservedWitnessProfiles,506);
 assert.equal(work.reservedDistinctBasisCourses,112656);assert.equal(work.reservedWitnessCourses,6072);assert.equal(work.reservedThermalCourses,118728);assert.equal(work.reservedCourseIntervals,2849472);
 assert.equal(work.reservedReplayEndpointRows,37950);assert.equal(work.reservedObservationReplayRows,12144);assert.equal(work.reservedRequirementReplayRows,1012);assert.equal(work.reservedConsequenceReplayRows,506);
 assert.equal(work.reservedAdditionalSolvesPerCompatiblePattern,4);assert.equal(work.reservedAdditionalObjectivesPerCompatiblePattern,5);assert.equal(work.reservedConditionalOrderSolves,253);
 assert.equal(work.reservedLinearRationalOperations,24000000);assert.equal(work.reservedLinearPivots,8192);assert.equal(work.maximumCompleteReportBytes,64*1024*1024);
 assert.equal(work.reservedThermalCourses,SKY_CONDITIONAL_COURSE_LIMITS.maxThermalCourses);assert.equal(inspectSkyConditionalWork(raw.readings,{...raw.query,maximumChanges:0}).reservedWitnessProfiles,2);
});
test('maintained worker ownership retires stale conditional completions',async()=>{
 assert(baseline);const workers=[];let terminated=0;
 const computation=createShadeHeatComputation(()=>{const worker={terminate(){terminated++;},postMessage(){}};workers.push(worker);return worker;});
 const first=computation.compute({operation:'prepare'}),firstOutcome=first.then(()=>null,error=>error.code),oldHandler=workers[0].onmessage,second=computation.compute({operation:'prepare'});
 oldHandler({data:{ok:true,result:baseline}});assert.equal(computation.pending,true);workers[1].onmessage({data:{ok:true,result:baseline}});
 assert.deepEqual(await second,baseline);assert.equal(await firstOutcome,'superseded');assert.equal(computation.pending,false);assert.equal(terminated,2);
});
