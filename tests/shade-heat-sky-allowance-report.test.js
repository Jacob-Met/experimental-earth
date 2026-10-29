import test from 'node:test';
import assert from 'node:assert/strict';
import {createSkyAllowanceReport,inspectSkyAllowanceReport} from '../shade-heat-sky-allowance-report.js';
import {parseSkyAllowanceText} from '../shade-heat-sky-allowance.js';
import {prepareSkyCoverageEvidence,serializeSkyCoverageSource} from '../shade-heat-sky-coverage-course.js';
import {makeThreeEpochSkyExample} from '../shade-heat-three-epoch-example.js';
import {originalSkyReadingTimes,prepareTimedSkyReadingSource} from '../shade-heat-timed-reading-source.js';
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

const encode=value=>JSON.stringify(value,(_k,v)=>typeof v==='bigint'?String(v):v);
let fixture;
function original(){
 if(fixture)return structuredClone(fixture);
 const readings=shortOriginals(),query=broadQuery(readings),time=originalSkyReadingTimes(readings[0].source)[0].utc;
 query.requirements.forEach((r,i)=>Object.assign(r,{receiverReadingIndex:0,utc:time,store:'surfaceC',relation:i?'at-least':'at-most',differenceC:i?1:0}));
 fixture=prepareSkyCoverageEvidence(readings,query);return structuredClone(fixture);
}
test('selected report statuses use the same retained profile and exact allowance while source-only output stays unchanged',()=>{
 const output=original(),before=JSON.stringify(output),saved=serializeSkyCoverageSource(output.investigation),binding=createSkyAllowanceReport(output);
 const zero=inspectSkyAllowanceReport(binding,[0n,1n]),half=inspectSkyAllowanceReport(binding,[1n,2n]),contact=inspectSkyAllowanceReport(binding,[1n,1n]),large=inspectSkyAllowanceReport(binding,[2n**4095n,1n]);
 assert.equal(zero.result.globalStatus,'none');assert.equal(half.result.globalStatus,'none');assert.equal(contact.result.globalStatus,'every');assert.equal(large.result.globalStatus,'every');
 assert.deepEqual(binding.events.map(e=>e.value),[[0n,1n],[1n,1n]]);
 assert.deepEqual(binding.events[1].existencePatternIndices,[0]);assert.deepEqual(binding.events[1].universalPatternIndices,[0]);
 for(const view of [zero,half,contact,large]){
  assert.equal(view.numerical.length,3);assert.deepEqual(view.result.patterns[0].witnesses.map(w=>[w.role,w.requirementIndex]),[['some-profile',null],['requirement-maximum',0],['requirement-maximum',1]]);
  for(const [i,w]of view.result.patterns[0].witnesses.entries()){
   assert.deepEqual(w.originalStatuses,['met','not-met']);assert.deepEqual(w.selectedStatuses,view.result.globalStatus==='every'?['met','met']:['met','not-met']);
   assert.deepEqual(view.numerical[i].selectedStatuses,w.selectedStatuses);assert.deepEqual(view.numerical[i].originalStatuses,w.originalStatuses);
  }
 }
 assert.equal(zero.result.counterexamples.length,1);assert.equal(contact.result.counterexamples.length,0);
 assert.equal(JSON.stringify(output),before);assert.equal(serializeSkyCoverageSource(output.investigation),saved);
 assert.deepEqual(Object.keys(JSON.parse(saved)),['kind','model','readings','query']);
 const exacts=['0.09999999999999999999999999999999999','0.1','0.10000000000000000000000000000000001'].map(parseSkyAllowanceText);
 assert(exacts[0][0]*exacts[1][1]<exacts[1][0]*exacts[0][1]);assert(exacts[2][0]*exacts[1][1]>exacts[1][0]*exacts[2][1]);
});
test('report admission refuses reassigned profiles, altered original endpoints, invented statuses and damaged parent proof',()=>{
 const changes=[
  x=>x.investigation.query.requirements[0].differenceC=5,
  x=>x.report.requirements[0].utc='changed',
  x=>x.report.requirements[0].sourceIndex=99,
  x=>x.report.requirements[1].limitC.exact.numerator='2',
  x=>x.report.alternatives.pop(),
  x=>x.report.alternatives[0].patternIndex=99,
  x=>x.report.alternatives[0].splitAfterIntervals=[1],
  x=>x.report.alternatives[0].someProfile.role='requirement-maximum',
  x=>x.report.alternatives[0].maxima.reverse(),
  x=>x.report.alternatives[0].someProfile.phaseProfiles[0][0].exact.numerator='2',
  x=>x.report.alternatives[0].someProfile.productMasses[0].exact.numerator='2',
  x=>x.report.alternatives[0].someProfile.observedC[0].exact.numerator='999',
  x=>x.report.alternatives[0].someProfile.requiredRelaxationC.exact.numerator='3',
  x=>x.report.alternatives[0].someProfile.originalReplays[0].originalCourse[0].utc='changed',
  x=>x.report.alternatives[0].someProfile.originalReplays[0].originalCourse[0].originalC.proposal.lower.surfaceC+=1,
  x=>x.report.alternatives[0].someProfile.requirements[0].originalNumericalPairC.upper.exact.numerator='1',
  x=>x.report.alternatives[0].someProfile.requirements[0].representedStatus='not-met',
  x=>x.report.alternatives[0].someProfile.requirements[0].originalNumericalStatus='not-met',
  x=>x.report.exactEvidence.result.cases[0].tests[0].maximumViolation=['99','1'],
  x=>x.report.exactEvidence.bands[0].upper=['0','1']
 ];
 for(const change of changes){const output=original();change(output);assert.throws(()=>createSkyAllowanceReport(output));}
});
test('prepared report bindings are immutable and private, and old role-specific relaxed statuses do not control selection',()=>{
 const output=original(),binding=createSkyAllowanceReport(output),baseline=encode(inspectSkyAllowanceReport(binding,[0n,1n]));
 assert.throws(()=>inspectSkyAllowanceReport({},[0n,1n]));assert.throws(()=>inspectSkyAllowanceReport(structuredClone(binding),[0n,1n]));
 assert.throws(()=>{binding.patterns[0].numerical[0].originalPairs[0].upper[0]=999n;});
 for(const w of [output.report.alternatives[0].someProfile,...output.report.alternatives[0].maxima.map(m=>m.witness)])
  for(const r of w.requirements){r.relaxedRepresentedStatus='invented';r.relaxedOriginalNumericalStatus='invented';}
 const rebound=createSkyAllowanceReport(output);assert.equal(encode(inspectSkyAllowanceReport(rebound,[0n,1n])),baseline);
 output.report.alternatives[0].someProfile.originalReplays[0].originalCourse[0].originalC.proposal.lower.surfaceC=999;
 assert.equal(encode(inspectSkyAllowanceReport(binding,[0n,1n])),baseline);
 const first=inspectSkyAllowanceReport(binding,[0n,1n]);first.numerical[0].selectedStatuses[0]='invented';first.numerical[0].originalPairs[0].upper[0]=999n;
 assert.equal(encode(inspectSkyAllowanceReport(binding,[0n,1n])),baseline);
});
test('an originally empty family remains unevaluated at every selected allowance',()=>{
 const readings=shortOriginals(),query=broadQuery(readings);readings[2].query.reading.temperatureC=400;readings[2].query.reading.halfWidthC=0;
 const output=prepareSkyCoverageEvidence(readings,query),binding=createSkyAllowanceReport(output);assert.deepEqual(binding.events,[]);
 for(const delta of [[0n,1n],[1n,2n],[2n**4095n,1n]]){
  const view=inspectSkyAllowanceReport(binding,delta);assert.equal(view.result.globalStatus,null);assert.equal(view.result.interval,null);assert.deepEqual(view.result.counterexamples,[]);assert.deepEqual(view.numerical,[]);
 }
});
