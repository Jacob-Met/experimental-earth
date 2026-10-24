import test from 'node:test';
import assert from 'node:assert/strict';
import {makeExample,runRain} from '../core.js';
import {interpolateDepth} from '../infiltration-study.js';
import {comparePlacements,comparePlacementsWithFixedSupport} from '../placement-search.js';
import {comparePlacementResolution} from '../placement-resolution.js';
const fixture=()=>{const p=makeExample();p.proposal=structuredClone(p.existing);return p;};
const query=(extra={})=>({eligibleCells:[18,19,27,36],maxEdits:2,surface:'garden',metric:'unabsorbedLiters',subset:'all',study:{target:'existing',surface:'sealed',ratesMmHr:[.2,1,4]},targets:[{cellIndex:10,maxPeakChangeMm:-1.8,basis:'Authored numerical-sensitivity control'}],...extra});
test('actual target qualification and best-layout reversal retained for identical finite layouts',()=>{
 const p=fixture(),q=query(),before=JSON.stringify({p,q}),r=comparePlacementResolution(p,q);
 assert.equal(r.status,'compared');assert.deepEqual(r.stepsMinutes,[5,2.5,1.25]);assert.equal(r.estimatedCellSteps,1596672);
 assert.deepEqual(r.runs.map(r=>r.best),[[[18,36]],[[18,27]],[[18,27]]]);assert.deepEqual(r.runs.map(r=>r.qualifyingCount),[4,2,2]);
 assert.equal(r.qualificationChanged,true);assert.equal(r.bestChanged,true);assert.equal(r.plans.length,11);
 const plan=r.plans.find(p=>p.cells.join(',')==='18,36');assert.deepEqual(plan.atSteps.map(p=>p.meets),[true,false,false]);
 assert.ok(Math.abs(plan.atSteps[2].checks[0].worstChangeMm+1.7487841812224048)<1e-10);
 for(const run of r.runs){assert.equal(run.plans.length,11);assert.deepEqual(run.ratesMmHr,[.2,1,4]);for(const plan of run.plans)assert.equal(plan.candidates.length,3);}
 assert.equal(JSON.stringify({p,q}),before);
});
test('single original supported rate stays fixed when naive finer-step evidence filtering rejects it',()=>{
 const p=fixture(),model=runRain(p.existing,p.width,p.height,p.weather,{surfaceInfiltrationOverride:{surface:'sealed',rateMmHr:1}});
 p.observations=[{cellIndex:27,minute:60,depthMm:interpolateDepth(model,27,60).depthMm,uncertaintyMm:0,source:'Synthetic exact-rate witness, not field data',scenario:'existing',use:'calibration'}];
 const q=query({subset:'calibration'}),r=comparePlacementResolution(p,q);
 assert.deepEqual(r.ratesMmHr,[1]);assert.equal(r.sourceSupport.subset,'calibration');assert.deepEqual(r.query.study.ratesMmHr,[.2,1,4]);
 for(const run of r.runs){assert.deepEqual(run.ratesMmHr,[1]);for(const plan of run.plans){assert.deepEqual(plan.candidates.map(c=>c.rateMmHr),[1]);assert.deepEqual(plan.localTargets.checks[0].witnesses.map(w=>w.rateMmHr),[1]);}}
 assert.equal(comparePlacements({...p,weather:{...p.weather,stepMinutes:2.5}},q).status,'no-compatible-rates');
 const source=comparePlacements(p,q);assert.throws(()=>comparePlacementsWithFixedSupport(p,q,{...source,ratesMmHr:[.2,1]},2.5),/support/);source.ratesMmHr.push(.2);assert.throws(()=>comparePlacementsWithFixedSupport(p,q,source,2.5),/support/);
 p.observations.push({...p.observations[0],use:'challenge',depthMm:1000});const changed=comparePlacementResolution(p,q);
 assert.deepEqual(changed.runs,r.runs,'held-aside values cannot tune calibration support');
 assert.equal(comparePlacementResolution(p,{...q,subset:'surviving'}).status,'no-compatible-rates');
});
test('fixed-support helper refuses source/query mismatches and unsupported calculation intervals',()=>{
 const p=fixture(),q=query(),baseline=comparePlacements(p,q);
 const fine=comparePlacementsWithFixedSupport(p,q,baseline,2.5);assert.equal(fine.supportMode,'fixed-original-support');
 assert.throws(()=>comparePlacementsWithFixedSupport(p,{...q,metric:'exitLiters'},baseline,2.5),/matching/);
 const changed=structuredClone(p);changed.proposal[0].elevationM+=.01;assert.throws(()=>comparePlacementsWithFixedSupport(changed,q,baseline,2.5),/matching/);
 assert.throws(()=>comparePlacementsWithFixedSupport(p,q,{...baseline,ratesMmHr:[999]},2.5),/support/);
 assert.throws(()=>comparePlacementsWithFixedSupport(p,q,{...baseline,ratesMmHr:[.2,1]},2.5),/support/);
 baseline.ratesMmHr=[.2,1];assert.throws(()=>comparePlacementsWithFixedSupport(p,q,baseline,2.5),/support/);
 baseline.ratesMmHr=[.2,1,4];
 assert.throws(()=>comparePlacementsWithFixedSupport(p,q,baseline,.5));
});
test('joint work refusal and minimum step do not return a truncated comparison',()=>{
 const p=fixture();const all=p.existing.flatMap((c,i)=>c.surface==='sealed'?[i]:[]);
 const large=comparePlacementResolution(p,query({eligibleCells:all}));assert.equal(large.status,'work-limit');assert.deepEqual(large.runs,[]);assert.equal(large.variantCount,79);
 p.weather.stepMinutes=1;const minimum=comparePlacementResolution(p,query());assert.equal(minimum.status,'minimum-step');assert.deepEqual(minimum.runs,[]);
 p.weather.stepMinutes=2;const two=comparePlacementResolution(p,query({eligibleCells:[18]}));assert.deepEqual(two.stepsMinutes,[2,1]);
 const empty=comparePlacementResolution(fixture(),query({subset:'calibration'}));assert.equal(empty.status,'need-calibration');assert.deepEqual(empty.runs,[]);
});
test('stable and dry controls retain all tested ties without convergence claims',()=>{
 const p=fixture(),q=query({targets:[{cellIndex:10,maxPeakChangeMm:-1,basis:'Stable software control'}]}),r=comparePlacementResolution(p,q);
 assert.equal(r.qualificationChanged,false);assert.equal(r.bestChanged,false);
 p.weather.rainMmHr=0;const dry=comparePlacementResolution(p,query({targets:[]}));assert.ok(dry.runs.every(run=>run.best.length===11));assert.equal(dry.bestChanged,false);assert.equal(dry.qualificationChanged,false);
 const impossible=comparePlacementResolution(p,q);assert.ok(impossible.runs.every(run=>run.best.length===0&&run.qualifyingCount===0));
 assert.match(r.semantics,/not convergence/);
});
