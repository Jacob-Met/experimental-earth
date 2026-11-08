// Self-contained maintained regressions; authored analytic expectations.
// Exact cross-version byte/output parity is separately qualified by the frozen
// external independent suite. This suite asserts explicit legacy contracts.
// No field efficacy, browser, or physical validation claim.
import test from 'node:test';
import assert from 'node:assert/strict';
import {makeExample} from '../core.js';
import {chooseDecisionQuestion as question} from '../decision-question.js';
import {compareDecisionObservations as observations} from '../decision-observation.js';
import {planDecisionDepths as plan,exportDecisionDepthPlan as encode,reopenDecisionDepthPlan as reopen} from '../decision-depth-pair.js';
import {normalizeDecisionCriterion as normalize,meetsDecisionCriterion as meets} from '../decision-criterion.js';
function fixture(rates=[10,20]) {
 const p=makeExample();p.width=p.height=2;p.selectedIndex=0;
 p.existing=Array.from({length:4},()=>({elevationM:0,surface:'turf',provenance:'authored flat water-budget control'}));
 p.proposal=p.existing.map(c=>({...c,surface:'garden'}));
 Object.assign(p.weather,{rainMmHr:30,stormMinutes:60,durationMinutes:60,stepMinutes:30,cellSizeM:2,mobilityPerHour:0,boundaryExitPerHour:0});
 p.infiltrationStudy={target:'existing',surface:'turf',ratesMmHr:rates};
 p.observations=[{cellIndex:0,minute:0,depthMm:0,uncertaintyMm:0,source:'authored uninformative calibration',scenario:'existing',use:'calibration'}];return p;
}
const goal={operator:'at-most',value:-128};
const options={metric:'storedLiters',uncertaintyMm:2,depthToleranceMm:2,criterion:goal};
const consumers=[question,observations,plan];
function cohorts(r,yes,no){assert.deepEqual(r.meetsCriterionRatesMmHr,yes);assert.deepEqual(r.missesCriterionRatesMmHr,no);}
test('frozen independent predicate cases: inclusive equality, no epsilon and explicit zero',()=>{
 const cases=[
 [[-4,-12],'at-most',-8,[false,true]],
 [[-1,1],'at-most',2,[true,true]],
 [[-4,-12],'at-most',-15,[false,false]],
 [[-8,-7.9999999999,-8.0000000001],'at-most',-8,[true,false,true]],
 [[8,7.9999999999,8.0000000001],'at-least',8,[true,false,true]],
 [[-1e-9,0,1e-9],'at-most',0,[true,true,false]],
 [[-12,-10,-4,-2],'at-most',-8,[true,true,false,false]]];
 for(const [ds,operator,value,want] of cases){const c={operator,value};assert.deepEqual(normalize(c),c);assert.deepEqual(ds.map(d=>meets(d,c)),want);}
});
test('analytic same-sign goal propagates through all three real consumers',()=>{
 const p=fixture(),before=structuredClone(p),q=question(p,options);
 // 16 square meters: existing volumes320/160, proposal96 L; independent deltas -224/-64.
 assert.equal(q.status,'question');assert.equal(q.minute,60);assert.equal(q.cellIndex,0);assert.equal(q.separationMm,10);assert.equal(q.bandsDisjoint,true);assert.equal(q.opposingPairCount,1);
 assert.deepEqual(q.lowerRatesMmHr,[10,20]);assert.deepEqual(q.higherRatesMmHr,[]);assert.deepEqual(q.neutralRatesMmHr,[]);cohorts(q,[10],[20]);assert.deepEqual(q.criterion,goal);
 assert.deepEqual(q.predictions.map(x=>[x.rateMmHr,x.depthMm,x.effect,x.meetsCriterion]),[[10,20,-224,true],[20,10,-64,false]]);
 const o=observations(p,{...options,collectionEnabled:true,collectionMinutes:30,volumeToleranceLiters:2});
 assert.equal(o.status,'options');cohorts(o.depth,[10],[20]);assert.equal(o.volume.status,'indistinguishable');assert.equal(o.volume.opposingPairCount,1);assert.deepEqual(o.options.map(x=>x.type),['depth']);
 const d=plan(p,options);assert.equal(d.status,'planned');cohorts(d,[10],[20]);assert.deepEqual(d.criterion,goal);assert.equal(d.candidates.length,2);assert.deepEqual(d.plan.pairs,[{first:0,second:1}]);assert.equal(d.plan.separatedPairCount,1);assert.equal(d.plan.complete,true);assert.deepEqual(p,before);
});
test('opposite signs can agree on a criterion; distinguish all-meet from all-miss',()=>{
 const p=fixture([10,28]); // Stored deltas -224,+64 L.
 for(const f of consumers){for(const [value,agreement] of [[100,'all-meet'],[-300,'all-miss']]){const r=f(p,{...options,criterion:{operator:'at-most',value}});assert.equal(r.status,'no-decision-disagreement');assert.equal(r.criterionAgreement,agreement);}}
 const q=question(p,{...options,criterion:{operator:'at-most',value:100}});assert.deepEqual(q.lowerRatesMmHr,[10]);assert.deepEqual(q.higherRatesMmHr,[28]);cohorts(q,[10,28],[]);
});
test('all alternatives and every cross-criterion pair survive nontrivial cohorts',()=>{
 const p=fixture([10,16,20,28]),o={...options,uncertaintyMm:1};
 const q=question(p,o);cohorts(q,[10,16],[20,28]);assert.equal(q.opposingPairCount,4);
 assert.deepEqual(q.predictions.map(x=>[x.rateMmHr,x.effect,x.meetsCriterion]),[[10,-224,true],[16,-128,true],[20,-64,false],[28,64,false]]);
 const d=plan(p,o);assert.equal(d.candidates.length,4);cohorts(d,[10,16],[20,28]);
 assert.deepEqual(d.plan.pairs,[{first:0,second:2},{first:0,second:3},{first:1,second:2},{first:1,second:3}]);
});
test('actual consumer exact boundary is not discounted by observation tolerance',()=>{
 const p=fixture();for(const f of consumers){assert.notEqual(f(p,{...options,criterion:{operator:'at-most',value:-224}}).status,'no-decision-disagreement');const r=f(p,{...options,criterion:{operator:'at-most',value:-224-1e-10}});assert.equal(r.status,'no-decision-disagreement');assert.equal(r.criterionAgreement,'all-miss');}
 const q=question(p,{...options,uncertaintyMm:100});cohorts(q,[10],[20]);assert.equal(q.bandsDisjoint,false);
});
test('omission preserves declared legacy sign cohorts and version1 schema',()=>{
 const p=fixture(),o={metric:'storedLiters',uncertaintyMm:2,depthToleranceMm:2};
 for(const f of consumers){const r=f(p,o);assert.equal(r.status,'no-reversal');assert.equal(Object.hasOwn(r,'criterion'),false);assert.equal(Object.hasOwn(r,'meetsCriterionRatesMmHr'),false);assert.deepEqual(f(p,{...o,criterion:undefined}),r);}
 const q=question(fixture([10,24,28]),o);assert.equal(q.status,'question');assert.deepEqual(q.lowerRatesMmHr,[10]);assert.deepEqual(q.neutralRatesMmHr,[24]);assert.deepEqual(q.higherRatesMmHr,[28]);assert.equal(q.opposingPairCount,1);assert.equal(q.separationMm,18);assert.equal(q.predictions.length,3);assert.ok(q.predictions.every(x=>!Object.hasOwn(x,'meetsCriterion')));
 const doc=JSON.parse(encode(p,o));assert.equal(doc.schema,'experimental-earth-decision-depth-pair/1');assert.equal(Object.hasOwn(doc.options,'criterion'),false);
});
test('invalid explicit criteria refuse even before calibration is available',()=>{
 const invalid=[null,{},[],{operator:'below',value:0},{operator:'at-most'},{operator:'at-most',value:'0'},{operator:'at-most',value:NaN},{operator:'at-least',value:Infinity},{operator:'at-most',value:-Infinity}];
 for(const criterion of invalid){assert.throws(()=>normalize(criterion));for(const f of consumers){const p=fixture();p.observations=[];assert.throws(()=>f(p,{...options,criterion}));}}
});
test('version2 roundtrip retains criterion and refuses missing criterion or downgrade',()=>{
 const p=fixture(),text=encode(p,options),doc=JSON.parse(text);assert.equal(doc.schema,'experimental-earth-decision-depth-pair/2');assert.deepEqual(doc.options.criterion,goal);assert.deepEqual(reopen(text).report,plan(p,options));
 const missing=structuredClone(doc);delete missing.options.criterion;assert.throws(()=>reopen(JSON.stringify(missing)));
 const downgrade=structuredClone(doc);downgrade.schema='experimental-earth-decision-depth-pair/1';assert.throws(()=>reopen(JSON.stringify(downgrade)));
 const o={metric:'storedLiters',uncertaintyMm:2};const legacy=encode(p,o);assert.equal(JSON.parse(legacy).schema,'experimental-earth-decision-depth-pair/1');assert.deepEqual(reopen(legacy).report,plan(p,o));
});
test('held-aside values never tune any goal consumer',()=>{
 const p=fixture();p.observations.push({...p.observations[0],cellIndex:3,minute:30,depthMm:0,use:'challenge'});const before=consumers.map(f=>f(p,options));p.observations[1].depthMm=1000;consumers.forEach((f,i)=>assert.deepEqual(f(p,options),before[i]));
});
test('record exclusions, calibration, acquisition availability and work limits survive',()=>{
 const p=fixture();for(const minute of [30,60])for(let cellIndex=0;cellIndex<4;cellIndex++)p.observations.push({...p.observations[0],minute,cellIndex,use:'unassigned'});
 assert.equal(question(p,options).status,'all-recorded');assert.equal(plan(p,options).status,'all-recorded');assert.equal(observations(p,options).status,'no-distinguishing-option');
 const empty=fixture();empty.observations=[];for(const f of consumers)assert.equal(f(empty,options).status,'need-calibration');
 assert.equal(plan(fixture(),{...options,availability:{cellIndices:[],startMinute:0,endMinute:60,basis:'authored unavailable acquisition'}}).status,'unavailable');
 const large=fixture([10,20,28]);large.width=large.height=24;large.existing=Array.from({length:576},()=>({...large.existing[0]}));large.proposal=large.existing.map(c=>({...c,surface:'garden'}));large.weather.durationMinutes=500;large.weather.stepMinutes=1;
 for(const f of consumers)assert.throws(()=>f(large,options),/budget|million|cell-step/i);
});
