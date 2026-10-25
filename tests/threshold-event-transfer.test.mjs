import test from 'node:test';
import assert from 'node:assert/strict';
import {makeExample} from '../core.js';
import {prepareThresholdEvidence} from '../threshold-evidence.js';
import {compareThresholdEvents as compare,prepareThresholdTransfer,serializeThresholdTransfer,parseThresholdTransfer} from '../threshold-event-transfer.js';
const options={independence:'Separate authored storms; no physical independence claimed.'};
const row={cellIndex:0,minute:60,relation:'at-least',thresholdMm:1,uncertaintyMm:0,source:'Authored bound',use:'calibration'};
function fixtures(){
 const a=makeExample();a.width=a.height=2;a.selectedIndex=0;
 a.existing=Array.from({length:4},()=>({surface:'turf',elevationM:0,provenance:'Authored reversal'}));
 a.proposal=a.existing.map(c=>({...c,surface:'garden'}));
 Object.assign(a.weather,{rainMmHr:30,stormMinutes:60,durationMinutes:60,stepMinutes:5,mobilityPerHour:0,boundaryExitPerHour:0,cellSizeM:1});
 a.infiltrationStudy={target:'existing',surface:'turf',ratesMmHr:[10,24,28]};
 a.thresholdEvidence=prepareThresholdEvidence(a,'existing','first',[row]);
 const b=structuredClone(a);b.weather.rainMmHr=12;
 b.thresholdEvidence=prepareThresholdEvidence(b,'existing','second',[{...row,use:'challenge'}]);return [a,b];
}
test('separate forcing changes an unresolved consequence direction without retuning first evidence',()=>{
 const [a,b]=fixtures(),before=JSON.stringify([a,b]),wet=compare(a,b,options);
 assert.equal(wet.firstEffects.metrics.storedLiters.direction,'reverses');
 assert.ok(Math.abs(wet.firstEffects.metrics.storedLiters.min+56)<1e-8);
 assert.ok(Math.abs(wet.firstEffects.metrics.storedLiters.max-16)<1e-8);
 assert.deepEqual(wet.survivingRatesMmHr,[10]);assert.ok(Math.abs(wet.metrics.storedLiters.min+56)<1e-8);
 assert.equal(JSON.stringify([a,b]),before);
 b.thresholdEvidence.readings[0].relation='at-most';b.thresholdEvidence.readings[0].thresholdMm=0;
 const dry=compare(a,b,options);assert.deepEqual(dry.survivingRatesMmHr,[24,28]);
 assert.equal(dry.metrics.storedLiters.direction,'higher-or-equal');assert.deepEqual(dry.firstEffects,wet.firstEffects);
 for(const c of dry.consequences)for(const error of Object.values(c.massErrorLiters))assert.ok(Math.abs(error)<1e-8);
});
test('rejected separate evidence cannot substitute an effect; original same-event holdouts survive',()=>{
 const [a,b]=fixtures(),original=compare(a,b,options);b.thresholdEvidence.readings[0].thresholdMm=30;
 const rejected=compare(a,b,options);assert.equal(rejected.status,'challenged');assert.deepEqual(rejected.metrics,{});
 assert.deepEqual(rejected.firstEffects,original.firstEffects);
 const [c,d]=fixtures();c.thresholdEvidence.readings.push({...row,thresholdMm:100,use:'challenge'});
 assert.equal(compare(c,d,options).status,'challenged');
});
test('site, observed source, separate identity and explicit roles remain admission requirements',()=>{
 const [a,b]=fixtures();assert.throws(()=>compare(a,b,{}),/independently/);
 for(const change of [q=>q.existing[0].surface='sealed',q=>q.existing[0].elevationM=.1,q=>q.weather.stepMinutes=2.5]){
  const c=structuredClone(b);change(c);assert.throws(()=>compare(a,c,options),/match/);
 }
 const same=structuredClone(b);same.thresholdEvidence.eventRef='first';assert.throws(()=>compare(a,same,options),/distinct event/);
 const fitted=structuredClone(b);fitted.thresholdEvidence.readings[0].use='calibration';assert.throws(()=>compare(a,fitted,options),/silently relabeled/);
 const stale=structuredClone(b);stale.weather.rainMmHr=13;assert.equal(compare(a,stale,options).status,'second-context-changed');
 const first=structuredClone(a);first.weather.rainMmHr=31;assert.equal(compare(first,b,options).status,'first-context-changed');
});
test('complete combined work refuses and numeric notebook does not select threshold support',()=>{
 const [a,b]=fixtures(),baseline=compare(a,b,options);
 b.observations=[{cellIndex:0,minute:60,depthMm:999,uncertaintyMm:0,scenario:'existing',use:'calibration',source:'Separate numeric notebook'}];
 assert.deepEqual(compare(a,b,options),baseline);
 for(const [p,role,event] of [[a,'calibration','first'],[b,'challenge','second']]){
  p.width=p.height=24;p.existing=Array.from({length:576},()=>({...p.existing[0]}));p.proposal=p.existing.map(c=>({...c,surface:'garden'}));p.weather.durationMinutes=720;p.weather.stepMinutes=1;
  p.thresholdEvidence=prepareThresholdEvidence(p,'existing',event,[{...row,use:role}]);
 }
 const limited=compare(a,b,options);assert.equal(limited.status,'work-limit');assert.deepEqual(limited.candidates,[]);
});
test('portable source-only reopening recomputes and ignores forged output',()=>{
 const [a,b]=fixtures(),prepared=prepareThresholdTransfer(a,b,options);
 const raw=JSON.parse(serializeThresholdTransfer({...prepared.bundle,metrics:{forged:true},survivingRatesMmHr:[28]}));
 assert.deepEqual(raw.options.study,a.infiltrationStudy);
 const missingStudy=structuredClone(raw);delete missingStudy.options.study;assert.throws(()=>parseThresholdTransfer(JSON.stringify(missingStudy)));
 assert.equal(raw.metrics,undefined);assert.equal(raw.survivingRatesMmHr,undefined);
 const reopened=parseThresholdTransfer(JSON.stringify({...raw,metrics:{forged:true}}));assert.deepEqual(reopened.report,prepared.report);
 assert.throws(()=>parseThresholdTransfer(' '.repeat(8*1024*1024+1)),/8 MiB/);
});
