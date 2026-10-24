import test from 'node:test';import assert from 'node:assert/strict';
import {makeExample,validateProject} from '../core.js';
import {compareInfiltration} from '../infiltration-study.js';
import {prepareThresholdEvidence,compareThresholdEvidence} from '../threshold-evidence.js';
import {assessThreshold} from '../threshold-evidence-contract.js';
function fixture(){const p=makeExample();p.width=p.height=2;p.selectedIndex=0;p.existing=Array.from({length:4},()=>({surface:'turf',elevationM:0,provenance:'Authored analytic software control'}));p.proposal=structuredClone(p.existing);Object.assign(p.weather,{rainMmHr:30,stormMinutes:60,durationMinutes:240,stepMinutes:5,mobilityPerHour:0,boundaryExitPerHour:0,cellSizeM:1});p.infiltrationStudy={target:'existing',surface:'turf',ratesMmHr:[3,9,22]};return p;}
const lower={cellIndex:0,minute:120,relation:'at-least',thresholdMm:5,uncertaintyMm:0,source:'Authored lower-bound control',use:'calibration'};
const upper={...lower,minute:180,relation:'at-most',source:'Authored upper-bound control'};
const attach=(p,rows)=>{p.thresholdEvidence=prepareThresholdEvidence(p,'existing','authored-event',rows);return p;};
test('one-sided endpoint observations constrain rates without fabricating point depths',()=>{
 const p=attach(fixture(),[lower,upper]),original=structuredClone(p),r=compareThresholdEvidence(p);
 assert.deepEqual(r.candidates.map(c=>c.readings.map(x=>x.depthMm)),[[24,21],[12,3],[0,0]]);assert.deepEqual(r.compatibleRatesMmHr,[9]);assert.equal(r.status,'needs-challenge');assert.deepEqual(p,original);
 for(const c of r.candidates)assert.ok(Math.abs(c.massErrorLiters)<1e-10);
});
test('inclusive bounds and declared uncertainty expand only their admissible side',()=>{
 for(const relation of ['at-least','at-most'])assert.equal(assessThreshold(5,{...lower,relation}).compatible,true);
 assert.equal(assessThreshold(4,{...lower,uncertaintyMm:1}).compatible,true);assert.equal(assessThreshold(3.99,{...lower,uncertaintyMm:1}).compatible,false);
 assert.equal(assessThreshold(6,{...upper,uncertaintyMm:1}).compatible,true);assert.equal(assessThreshold(6.01,{...upper,uncertaintyMm:1}).compatible,false);
 assert.equal(assessThreshold(0,{...lower,uncertaintyMm:10}).boundMm,0);
 const p=attach(fixture(),[{...lower,thresholdMm:15},upper]);assert.equal(compareThresholdEvidence(p).status,'calibration-rejected');
});
test('held-aside and unassigned bounds never narrow calibration support or create it',()=>{
 const p=attach(fixture(),[lower,{...upper,use:'challenge'}]);let r=compareThresholdEvidence(p);assert.deepEqual(r.compatibleRatesMmHr,[3,9]);assert.deepEqual(r.survivingRatesMmHr,[9]);
 p.thresholdEvidence.readings[1].thresholdMm=0;r=compareThresholdEvidence(p);assert.deepEqual(r.compatibleRatesMmHr,[3,9]);assert.equal(r.status,'challenged');
 attach(p,[{...lower,use:'unassigned'},{...upper,use:'challenge'}]);r=compareThresholdEvidence(p);assert.equal(r.status,'need-calibration');assert.deepEqual(r.compatibleRatesMmHr,[]);
});
test('retained observed geometry and forcing cannot silently follow a changed project',()=>{
 const p=attach(fixture(),[lower,upper]);for(const change of [q=>q.existing[0].elevationM=.1,q=>q.weather.rainMmHr=31,q=>q.source='different',q=>q.infiltrationStudy.target='proposal']){const q=structuredClone(p);change(q);assert.equal(compareThresholdEvidence(q).status,'context-changed');}
 const q=structuredClone(p);q.weather.stepMinutes=2.5;assert.deepEqual(compareThresholdEvidence(q).compatibleRatesMmHr,[9]);
 q.proposal[0].surface='garden';assert.equal(compareThresholdEvidence(q).status,'needs-challenge');
});
test('numeric-depth behavior is unchanged and evidence records roundtrip without cached verdicts',()=>{
 const p=fixture();p.observations=[{cellIndex:0,minute:120,depthMm:12,uncertaintyMm:0,scenario:'existing',use:'calibration',source:'Authored numeric-depth control'}];const baseline=compareInfiltration(p);
 attach(p,[lower,upper]);assert.deepEqual(compareInfiltration(p),baseline);const saved=JSON.parse(JSON.stringify(p));saved.thresholdEvidence.compatibleRatesMmHr=[22];assert.deepEqual(compareThresholdEvidence(validateProject(saved)).compatibleRatesMmHr,[9]);
});
test('malformed and oversized evidence refuses; absent material and work bounds stay explicit',()=>{
 const p=fixture();for(const r of [{...lower,relation:'above'},{...lower,uncertaintyMm:-1},{...lower,minute:241},{...lower,cellIndex:4},{...lower,source:''}])assert.throws(()=>attach(p,[r]));
 assert.throws(()=>attach(p,Array.from({length:81},()=>lower)));
 attach(p,[lower]);p.infiltrationStudy.surface='garden';assert.equal(compareThresholdEvidence(p).status,'surface-absent');
 const q=fixture();q.width=q.height=24;q.existing=Array.from({length:576},()=>({...q.existing[0]}));q.proposal=structuredClone(q.existing);q.weather.durationMinutes=720;q.weather.stepMinutes=1;q.infiltrationStudy.ratesMmHr=[1,2,3,4,5,6,7,8,9];attach(q,[lower]);assert.equal(compareThresholdEvidence(q).status,'work-limit');
});
