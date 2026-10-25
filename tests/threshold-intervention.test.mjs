import test from 'node:test';
import assert from 'node:assert/strict';
import {makeExample} from '../core.js';
import {prepareThresholdEvidence} from '../threshold-evidence.js';
import {compareThresholdIntervention as compare} from '../threshold-intervention.js';
import {compareIntervention} from '../intervention-study.js';
function fixture(){
 const p=makeExample();p.width=p.height=2;p.selectedIndex=0;
 p.existing=Array.from({length:4},()=>({surface:'turf',elevationM:0,provenance:'Authored control'}));
 p.proposal=structuredClone(p.existing);p.proposal[0].surface='sealed';
 Object.assign(p.weather,{rainMmHr:30,stormMinutes:60,durationMinutes:240,stepMinutes:5,mobilityPerHour:0,boundaryExitPerHour:0,cellSizeM:1});
 p.infiltrationStudy={target:'existing',surface:'turf',ratesMmHr:[3,9,22]};return p;
}
const lower={cellIndex:0,minute:120,relation:'at-least',thresholdMm:5,uncertaintyMm:0,source:'Authored lower bound',use:'calibration'};
const upper={...lower,minute:180,relation:'at-most',use:'challenge'};
function attach(p,rows=[lower,upper]){p.thresholdEvidence=prepareThresholdEvidence(p,p.infiltrationStudy.target,'authored-event',rows);return p;}
test('all supported original rates reach paired worlds with independent closed-cell arithmetic',()=>{
 const p=attach(fixture()),before=structuredClone(p),r=compare(p),direct=compareIntervention(p);
 assert.equal(r.status,'compared');assert.deepEqual(r.candidates.map(c=>c.rateMmHr),[3,9]);
 assert.deepEqual(r.candidates,direct.candidates.filter(c=>[3,9].includes(c.rateMmHr)));
 // No flow/outlet: four cells store max(0,30-4K) mm each after four hours.
 for(const c of r.candidates){
  assert.ok(Math.abs(c.massErrorLiters.existing)<1e-8);assert.ok(Math.abs(c.massErrorLiters.proposal)<1e-8);
  assert.ok(Math.abs(c.metrics.storedLiters.existing-4*Math.max(0,30-4*c.rateMmHr))<1e-8);
  assert.equal(c.peakDeltaMm.slice(1).every(v=>Math.abs(v)<1e-8),true);
 }
 assert.ok(Math.abs(r.metrics.storedLiters.min-8)<1e-8);assert.ok(Math.abs(r.metrics.storedLiters.max-26)<1e-8);
 assert.equal(r.cells.length,4);assert.deepEqual(p,before);assert.deepEqual(compare(JSON.parse(JSON.stringify(p))),r);
});
test('held-aside changes cannot change calibration consequences; singleton support retained',()=>{
 const p=attach(fixture()),r=compare(p),single=compare(p,{subset:'surviving'});
 assert.deepEqual(single.candidates.map(c=>c.rateMmHr),[9]);p.thresholdEvidence.readings[1].thresholdMm=0;
 const changed=compare(p);assert.deepEqual(changed.candidates,r.candidates);assert.deepEqual(changed.metrics,r.metrics);
 const rejected=compare(p,{subset:'surviving'});assert.equal(rejected.status,'no-compatible-rates');assert.deepEqual(rejected.candidates,[]);
});
test('numeric notebook cannot silently select or rescue threshold consequences',()=>{
 const p=attach(fixture()),before=compare(p);
 p.observations=[{cellIndex:0,minute:120,depthMm:999,uncertaintyMm:0,scenario:'existing',use:'calibration',source:'Conflicting separate numeric control'}];assert.deepEqual(compare(p),before);
 attach(p,[{...lower,thresholdMm:999}]);assert.equal(compare(p).status,'no-compatible-rates');
});
test('missing evidence, roles, stale source, absent surface and complete work refuse',()=>{
 assert.equal(compare(fixture()).status,'no-record');const p=attach(fixture(),[lower]);assert.equal(compare(p,{subset:'surviving'}).status,'need-challenge');
 attach(p,[{...lower,use:'challenge'}]);assert.equal(compare(p).status,'need-calibration');attach(p);p.existing[0].elevationM=.1;assert.equal(compare(p).status,'context-changed');
 const absent=attach(fixture());absent.infiltrationStudy.surface='garden';assert.equal(compare(absent).status,'surface-absent');
 const q=fixture();q.width=q.height=24;q.existing=Array.from({length:576},()=>({...q.existing[0]}));q.proposal=structuredClone(q.existing);q.weather.durationMinutes=720;q.weather.stepMinutes=1;attach(q);
 const r=compare(q);assert.equal(r.status,'work-limit');assert.deepEqual(r.candidates,[]);assert.throws(()=>compare(fixture(),{subset:'all'}));
});
test('proposal evidence stays on original observed world before counterfactual comparison',()=>{
 const p=fixture();p.infiltrationStudy.target='proposal';attach(p,[{...lower,cellIndex:1},{...upper,cellIndex:1}]);
 const r=compare(p);assert.equal(r.evidenceTarget,'proposal');assert.deepEqual(r.candidates.map(c=>c.rateMmHr),[3,9]);
 const q=structuredClone(p);q.existing[0].surface='garden';assert.equal(compare(q).status,'compared');assert.deepEqual(compare(q).evidence,r.evidence);
 q.proposal[1].elevationM=.1;assert.equal(compare(q).status,'context-changed');
});
