import test from 'node:test';
import assert from 'node:assert/strict';
import {makeExample} from '../core.js';
import {prepareThresholdEvidence} from '../threshold-evidence.js';
import {prepareThresholdTransfer} from '../threshold-event-transfer.js';
import {compareStormConsequences as compare} from '../storm-consequences.js';
import {compareIntervention} from '../intervention-study.js';
function fixture(){
 const a=makeExample();a.width=a.height=2;a.selectedIndex=0;a.existing=Array.from({length:4},()=>({surface:'turf',elevationM:0,provenance:'Authored storm-sign control'}));a.proposal=structuredClone(a.existing);a.proposal[0].surface='garden';a.proposal[1].surface='sealed';
 Object.assign(a.weather,{rainMmHr:30,stormMinutes:60,durationMinutes:60,stepMinutes:5,mobilityPerHour:0,boundaryExitPerHour:0,cellSizeM:1});a.infiltrationStudy={target:'existing',surface:'turf',ratesMmHr:[10,24,28]};
 const row={cellIndex:0,minute:60,relation:'at-least',thresholdMm:15,uncertaintyMm:0,source:'Authored source bound',use:'calibration'};
 a.thresholdEvidence=prepareThresholdEvidence(a,'existing','high-storm',[row]);
 const b=structuredClone(a);b.weather.rainMmHr=6;b.thresholdEvidence=prepareThresholdEvidence(b,'existing','low-storm',[{...row,relation:'at-most',thresholdMm:0,use:'challenge'}]);
 return prepareThresholdTransfer(a,b,{independence:'Separately declared authored storms'}).bundle;
}
test('same supported rate reverses the same plan effect across original forcings',()=>{
 const b=fixture(),before=JSON.stringify(b),r=compare(b);assert.equal(r.status,'compared');assert.deepEqual(r.candidates.map(c=>c.rateMmHr),[10]);
 assert.ok(Math.abs(r.metrics.storedLiters.first.min+5)<1e-8);assert.ok(Math.abs(r.metrics.storedLiters.second.min-5)<1e-8);assert.deepEqual(r.metrics.storedLiters.ratesWithStormSignReversal,[10]);
 assert.deepEqual(r.candidates[0].second,compareIntervention(b.challengeProject).candidates.find(c=>c.rateMmHr===10));
 for(const c of r.candidates)for(const side of ['first','second'])for(const e of Object.values(c[side].massErrorLiters))assert.ok(Math.abs(e)<1e-8);
 assert.equal(JSON.stringify(b),before);assert.deepEqual(compare(JSON.parse(before)),r);
});
test('different-rate ambiguity is not falsely attributed to changing storms',()=>{
 const b=fixture();for(const [p,role,event] of [[b.calibrationProject,'calibration','first'],[b.challengeProject,'challenge','second']]){
  p.weather.rainMmHr=30;p.proposal=p.existing.map(c=>({...c,surface:'garden'}));
  p.thresholdEvidence=prepareThresholdEvidence(p,'existing',event,[{cellIndex:0,minute:60,relation:'at-least',thresholdMm:1,uncertaintyMm:0,source:'Authored ambiguous bound',use:role}]);
 }
 const r=compare(b);assert.equal(r.metrics.storedLiters.across.direction,'reverses');assert.deepEqual(r.metrics.storedLiters.ratesWithStormSignReversal,[]);
 assert.deepEqual(r.metrics.storedLiters.first,r.metrics.storedLiters.second);
});
test('both original plans must match; no plan is copied into a second source',()=>{
 for(const target of ['existing','proposal']){const b=fixture();b.challengeProject[target][0].elevationM=.1;assert.throws(()=>compare(b),/must match/);}
 const b=fixture();b.challengeProject.proposal[1].surface='turf';assert.throws(()=>compare(b),/must match/);
});
test('rejected original support cannot produce a multi-storm consequence',()=>{
 const b=fixture();b.challengeProject.thresholdEvidence.readings[0].relation='at-least';b.challengeProject.thresholdEvidence.readings[0].thresholdMm=30;
 const r=compare(b);assert.equal(r.status,'no-transferred-support');assert.deepEqual(r.candidates,[]);assert.deepEqual(r.metrics,{});
});
test('complete work is refused before pairing and saved verdicts never replace sources',()=>{
 const b=fixture();assert.deepEqual(compare({...b,metrics:{forged:true}}),compare(b));
 for(const [p,role,event] of [[b.calibrationProject,'calibration','first'],[b.challengeProject,'challenge','second']]){
  p.width=p.height=24;p.existing=Array.from({length:576},()=>({...p.existing[0]}));p.proposal=structuredClone(p.existing);p.weather.durationMinutes=720;p.weather.stepMinutes=1;
  p.thresholdEvidence=prepareThresholdEvidence(p,'existing',event,[{cellIndex:0,minute:60,relation:'at-least',thresholdMm:0,uncertaintyMm:0,source:'Authored work control',use:role}]);
 }
 const r=compare(b);assert.equal(r.status,'work-limit');assert.deepEqual(r.metrics,{});
});
