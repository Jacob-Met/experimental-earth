import test from 'node:test';
import assert from 'node:assert/strict';
import {makeExample,runRain} from '../core.js';
import {interpolateDepth} from '../infiltration-study.js';
import {comparePlacements,adoptPlacement,placementSignature} from '../placement-search.js';
const study={target:'existing',surface:'sealed',ratesMmHr:[.2,1,4]};
const query=(extra={})=>({eligibleCells:[0,1,2],maxEdits:2,surface:'garden',metric:'unabsorbedLiters',subset:'all',study,...extra});
function fixture(){const p=makeExample();p.width=p.height=2;p.selectedIndex=0;p.existing=Array.from({length:4},()=>({surface:'sealed',elevationM:0,provenance:'authored software control'}));p.proposal=structuredClone(p.existing);p.weather={...p.weather,rainMmHr:61,stormMinutes:10,durationMinutes:10,stepMinutes:5,mobilityPerHour:0,boundaryExitPerHour:0,cellSizeM:1};return p;}
function observedProposal(){const p=makeExample();p.proposal=structuredClone(p.existing);const s={...study,target:'proposal'};const model=runRain(p.proposal,p.width,p.height,p.weather,{surfaceInfiltrationOverride:{surface:'sealed',rateMmHr:1}});p.observations=[{cellIndex:27,minute:60,depthMm:interpolateDepth(model,27,60).depthMm,uncertaintyMm:0,source:'Authored original-site control, not field evidence',scenario:'proposal',use:'calibration'}];return {p,s};}

test('enumerates exact zero/single/pair set and conserves each matched comparison',()=>{
 const p=fixture(),before=structuredClone(p),r=comparePlacements(p,query());assert.equal(r.variantCount,7);assert.equal(r.plans.length,7);
 assert.equal(new Set(r.plans.map(x=>x.cells.join(','))).size,7);assert.deepEqual(r.plans.find(x=>!x.cells.length).metrics.unabsorbedLiters,{min:0,max:0,direction:'unchanged'});
 for(const plan of r.plans)for(const c of plan.candidates){assert.ok(Math.abs(c.massErrorLiters.proposal)<1e-8);assert.equal(c.metrics.unabsorbedLiters.delta, c.metrics.exitLiters.delta+c.metrics.storedLiters.delta);}
 assert.deepEqual(p,before);assert.equal(r.ratesMmHr.length,3);
});
test('actual courtyard pair choice differs from the two individually best locations',()=>{
 const p=makeExample();p.proposal=structuredClone(p.existing);const eligible=p.existing.flatMap((c,i)=>c.surface==='sealed'?[i]:[]);
 const r=comparePlacements(p,query({eligibleCells:eligible}));assert.equal(r.variantCount,79);assert.deepEqual(r.best[0],[27,36]);
 const singles=r.plans.filter(x=>x.cells.length===1).slice(0,2).flatMap(x=>x.cells).sort((a,b)=>a-b);assert.notDeepEqual(r.best[0],singles);
 const exits=comparePlacements(p,query({eligibleCells:eligible,metric:'exitLiters'}));assert.deepEqual(exits.best[0],[34,35]);
 const excluded=comparePlacements(p,query({eligibleCells:eligible.filter(i=>i!==36)}));assert.deepEqual(excluded.best[0],[28,35]);
});
test('original proposal evidence support is frozen before hypothetical geometry changes',()=>{
 const {p,s}=observedProposal(),before=structuredClone(p);
 const r=comparePlacements(p,query({eligibleCells:[27],study:s,subset:'calibration'}));assert.equal(r.status,'compared');assert.deepEqual(r.ratesMmHr,[1]);assert.equal(r.plans.length,2);
 assert.ok(r.plans.every(x=>x.candidates.length===1&&x.candidates[0].rateMmHr===1));assert.deepEqual(r.best[0],[27]);assert.ok(r.plans[0].score<0);assert.deepEqual(p,before);
});
test('held-aside values do not tune calibration subset; rejected evidence never falls back',()=>{
 const {p,s}=observedProposal();p.observations.push({...p.observations[0],use:'challenge',depthMm:1000});
 const q=query({eligibleCells:[27],study:s,subset:'calibration'}),a=comparePlacements(p,q);
 p.observations[1].depthMm=0;const b=comparePlacements(p,q);assert.deepEqual(a.plans,b.plans);
 assert.equal(comparePlacements(p,{...q,subset:'surviving'}).status,'no-compatible-rates');
 p.observations[0].depthMm=1000;assert.equal(comparePlacements(p,q).status,'no-compatible-rates');
 p.observations=[];assert.equal(comparePlacements(p,q).status,'need-calibration');
});
test('no change remains best when edits worsen the chosen outcome; dry ties stay explicit',()=>{
 const p=fixture();for(const c of [...p.existing,...p.proposal])c.surface='turf';
 const r=comparePlacements(p,query({surface:'sealed',study:{...study,surface:'turf',ratesMmHr:[3,9,22]}}));assert.deepEqual(r.best,[[]]);
 const dry=fixture();dry.weather.rainMmHr=0;const d=comparePlacements(dry,query());assert.equal(d.best.length,7);assert.deepEqual(d.best[0],[]);
});
test('existing authored proposal edits are preserved and deltas reference that proposal',()=>{
 const p=fixture();p.proposal[3].surface='garden';const r=comparePlacements(p,query());
 assert.equal(r.plans.find(x=>!x.cells.length).score,0);const next=adoptPlacement(p,r.query,[0],r.sourceSignature);
 assert.equal(next.proposal[3].surface,'garden');assert.equal(next.proposal[0].surface,'garden');assert.equal(next.existing[0].surface,'sealed');assert.equal(p.proposal[0].surface,'sealed');
});
test('adoption refuses stale/foreign selections and preserves observed-proposal provenance',()=>{
 const p=fixture(),q=query(),r=comparePlacements(p,q);assert.throws(()=>adoptPlacement(p,q,[3],r.sourceSignature),/eligible/);
 const changed=structuredClone(p);changed.weather.rainMmHr=62;assert.throws(()=>adoptPlacement(changed,q,[0],r.sourceSignature),/changed/);
 const {p:observed,s}=observedProposal(),rq=query({eligibleCells:[27],study:s,subset:'calibration'});const result=comparePlacements(observed,rq);
 assert.throws(()=>adoptPlacement(observed,rq,[27],result.sourceSignature),/observed geometry/);
 assert.deepEqual(adoptPlacement(observed,rq,[],result.sourceSignature),observed);
 const ordinary=fixture();ordinary.observations=[{cellIndex:0,minute:5,depthMm:5,uncertaintyMm:1,source:'Retained source',scenario:'existing',use:'calibration'}];
 const next=adoptPlacement(ordinary,q,[0],placementSignature(ordinary));assert.deepEqual(next.observations,ordinary.observations);
});
test('introduced material keeps unconstrained rates and reveals reversal against no change',()=>{
 const p=fixture();Object.assign(p.weather,{rainMmHr:30,stormMinutes:60,durationMinutes:60});
 const q=query({eligibleCells:[0],study:{...study,surface:'garden',ratesMmHr:[0,12,24]}}),before=structuredClone(p);
 const r=comparePlacements(p,q);assert.equal(r.status,'compared');assert.deepEqual(r.sourceAffected,{existing:0,proposal:0});
 assert.deepEqual(r.ratesMmHr,[0,12,24]);assert.deepEqual(r.best,[[]]);
 const added=r.plans.find(x=>x.cells.length);assert.equal(added.metrics.unabsorbedLiters.direction,'reverses');
 added.candidates.forEach((c,i)=>{assert.ok(Math.abs(c.metrics.unabsorbedLiters.current-116)<1e-8);assert.ok(Math.abs(c.metrics.unabsorbedLiters.delta-[1,-11,-23][i])<1e-8);});
 const supported=comparePlacements(p,{...q,study:{...q.study,ratesMmHr:[12,24]}});assert.deepEqual(supported.best,[[0]]);
 assert.deepEqual(p,before);
});
test('removing the final studied material still evaluates every declared variant',()=>{
 const p=fixture();p.proposal[0].surface='garden';const before=structuredClone(p);
 const r=comparePlacements(p,query({eligibleCells:[0],surface:'sealed',study:{...study,surface:'garden',ratesMmHr:[0,12,24]}}));
 assert.equal(r.plans.length,2);assert.deepEqual(r.sourceAffected,{existing:0,proposal:1});
 const removed=r.plans.find(x=>x.cells.length);assert.equal(removed.metrics.unabsorbedLiters.direction,'reverses');
 assert.equal(new Set(removed.candidates.map(c=>Math.round(c.metrics.unabsorbedLiters.proposed*1e8))).size,1);
 assert.deepEqual(p,before);
});
test('absent target material cannot gain calibration support from hypothetical introduction',()=>{
 const p=fixture(),q=query({eligibleCells:[0],study:{...study,surface:'garden',ratesMmHr:[0,12,24]}});
 p.observations=[{cellIndex:0,minute:10,depthMm:10,uncertaintyMm:100,source:'Authored broad band',scenario:'existing',use:'calibration'},
 {cellIndex:0,minute:10,depthMm:10,uncertaintyMm:100,source:'Authored held-aside broad band',scenario:'existing',use:'challenge'}];
 for(const subset of ['calibration','surviving']){const r=comparePlacements(p,{...q,subset});assert.equal(r.status,'no-compatible-rates');assert.deepEqual(r.plans,[]);}
 assert.deepEqual(comparePlacements(p,q).ratesMmHr,[0,12,24]);
});
test('bounds and combined work refusal precede enumeration; original source stays intact',()=>{
 const p=fixture();for(const q of [query({eligibleCells:[]}),query({eligibleCells:[0,0]}),query({maxEdits:3}),query({metric:'score'})])assert.throws(()=>comparePlacements(p,q));
 p.proposal[0].surface='garden';assert.throws(()=>comparePlacements(p,query()),/must differ/);
 const big=makeExample();big.width=big.height=24;big.existing=Array.from({length:576},()=>({surface:'sealed',elevationM:0,provenance:'authored large control'}));big.proposal=structuredClone(big.existing);big.weather.durationMinutes=720;big.weather.stepMinutes=1;
 assert.throws(()=>comparePlacements(big,query({eligibleCells:Array.from({length:12},(_,i)=>i)})),/3 million/);
});
