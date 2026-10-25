import test from 'node:test';
import assert from 'node:assert/strict';
import {makeExample,runRain} from '../core.js';
import {compareIntervention} from '../intervention-study.js';
import {pondingExposure} from '../ponding-exposure.js';
import {selectPondingExposure,validateExposureRequest} from '../ponding-exposure-request.js';
import {comparePlacements,adoptPlacement,placementSignature} from '../placement-search.js';
import {comparePlacementResolution} from '../placement-resolution.js';
import {validateDurationGoal} from '../placement-duration.js';
const fixture=()=>{const p=makeExample();p.proposal=structuredClone(p.existing);return p;};
const study={target:'existing',surface:'sealed',ratesMmHr:[.2,1,4]};
const goal={cellIndices:[10],thresholdMm:5,maxAdditionalMinutes:-50,basis:'Authored software duration control, not a safety threshold'};
const query=(extra={})=>({eligibleCells:[18,19,27,36],maxEdits:2,surface:'garden',metric:'unabsorbedLiters',subset:'all',study,durationGoal:goal,...extra});
test('optional exposure projects maintained raw snapshots exactly and default comparison remains exposure-free',()=>{
 const p=fixture(),plain=compareIntervention(p,{study}),r=compareIntervention(p,{study,exposureRequest:{cellIndices:[10],thresholdMm:5}});
 assert.deepEqual(r.metrics,plain.metrics);assert.ok(plain.candidates.every(c=>!Object.hasOwn(c,'pondingExposure')));
 for(const c of r.candidates){const model=runRain(p.proposal,p.width,p.height,p.weather,{surfaceInfiltrationOverride:{surface:'sealed',rateMmHr:c.rateMmHr}});assert.deepEqual(c.pondingExposure.proposal,[pondingExposure(model,5)[10]]);}
 assert.equal(r.cellStepUpperBound/plain.cellStepUpperBound,5/3);
});
test('full-family duration goals reject the global winner and preserve censored endpoints and intervals',()=>{
 const p=fixture(),q=query(),before=JSON.stringify({p,q}),r=comparePlacements(p,q),unconstrained=comparePlacements(p,query({durationGoal:null}));
 assert.deepEqual(unconstrained.best,[[27,36]]);assert.deepEqual(r.best,[[18,27]]);assert.equal(r.qualifyingCount,2);
 const rejected=r.plans.find(p=>p.cells.join(',')==='27,36'),check=rejected.durationTargets.checks[0];
 assert.equal(check.worstChangeMinutes,0);assert.equal(rejected.meetsAllTargets,false);assert.deepEqual(check.witnesses.map(w=>w.rateMmHr),[.2,1,4]);
 for(const w of check.witnesses.slice(0,2)){assert.equal(w.current.aboveAtEnd,true);assert.equal(w.proposed.aboveAtEnd,true);assert.equal(w.proposed.intervals.at(-1).endMinute,240);assert.equal(w.minutesChange,0);}
 assert.throws(()=>adoptPlacement(p,q,[27,36],placementSignature(p)),/every declared/);
 const adopted=adoptPlacement(p,q,[18,27],placementSignature(p));assert.equal(adopted.proposal[18].surface,'garden');assert.equal(JSON.stringify({p,q}),before);
 const impossible=comparePlacements(p,query({durationGoal:{...goal,maxAdditionalMinutes:-240}}));assert.deepEqual(impossible.best,[]);assert.equal(impossible.qualifyingCount,0);
});
test('duration sensitivity freezes layouts and original rates, and exposes qualification change without adopting a calculation',()=>{
 const p=fixture(),stable=comparePlacementResolution(p,query());assert.equal(stable.estimatedCellSteps,2661120);assert.equal(stable.workDetail.exposureCellSegments,1064448);
 assert.deepEqual(stable.runs.map(r=>r.best),[[[18,27]],[[18,27]],[[18,27]]]);
 const q=query({durationGoal:{...goal,maxAdditionalMinutes:-50.75}}),r=comparePlacementResolution(p,q),plan=r.plans.find(p=>p.cells.join(',')==='18,27');
 assert.deepEqual(plan.atSteps.map(s=>s.meets),[true,false,false]);assert.equal(r.qualificationChanged,true);
 assert.deepEqual(r.runs.map(r=>r.ratesMmHr),[[.2,1,4],[.2,1,4],[.2,1,4]]);
 for(const s of plan.atSteps)assert.equal(s.durationChecks[0].witnesses.length,3);
 const larger=query({eligibleCells:[18,19,20,27,36]});const refused=comparePlacementResolution(p,larger);assert.equal(refused.status,'work-limit');assert.deepEqual(refused.runs,[]);assert.deepEqual(refused.plans,[]);
});
test('peak and duration goals jointly qualify; every declared cell participates',()=>{
 const p=fixture(),r=comparePlacements(p,query({targets:[{cellIndex:10,maxPeakChangeMm:-1.8,basis:'Joint software control'}]}));
 for(const plan of r.plans)assert.equal(plan.meetsAllTargets,plan.localTargets.meets&&plan.durationTargets.meets);
 const multi=comparePlacements(p,query({durationGoal:{...goal,cellIndices:[10,0]}}));assert.equal(multi.qualifyingCount,0);assert.deepEqual(multi.best,[]);
 assert.ok(multi.plans.every(p=>p.durationTargets.checks.length===2));
});
test('selection admission rejects malformed/sparse/unbounded requests and duration basis omissions',()=>{
 const p=fixture();for(const request of [{cellIndices:[10],thresholdMm:0},{cellIndices:[10,10],thresholdMm:5},{cellIndices:[,10],thresholdMm:5},{cellIndices:[99],thresholdMm:5},{cellIndices:[10],thresholdMm:5,unknown:true}])assert.throws(()=>validateExposureRequest(81,request));
 for(const g of [{...goal,maxAdditionalMinutes:241},{...goal,maxAdditionalMinutes:NaN},{...goal,basis:' '},{...goal,unknown:true}])assert.throws(()=>validateDurationGoal(p,g));
 assert.deepEqual(validateDurationGoal(p,{...goal,cellIndices:[10,0]}).cellIndices,[0,10]);
 const synthetic={snapshots:[{minute:0,depthsMm:[10]},{minute:10,depthsMm:[0]},{minute:20,depthsMm:[10]}]};
 assert.deepEqual(selectPondingExposure(synthetic,{cellIndices:[0],thresholdMm:5}),pondingExposure(synthetic,5));
 const x=selectPondingExposure(synthetic,{cellIndices:[0],thresholdMm:5})[0];assert.equal(x.minutesAbove,10);assert.equal(x.aboveAtStart,true);assert.equal(x.aboveAtEnd,true);assert.equal(x.intervals.length,2);
});
test('single original evidence-supported rate stays fixed for duration goals at every interval',async()=>{
 const {interpolateDepth}=await import('../infiltration-study.js');
 const p=fixture(),model=runRain(p.existing,p.width,p.height,p.weather,{surfaceInfiltrationOverride:{surface:'sealed',rateMmHr:1}});
 p.observations=[{cellIndex:27,minute:60,depthMm:interpolateDepth(model,27,60).depthMm,uncertaintyMm:0,source:'Synthetic exact-rate software witness',scenario:'existing',use:'calibration'}];
 const r=comparePlacementResolution(p,query({subset:'calibration'}));assert.equal(r.status,'compared');assert.deepEqual(r.ratesMmHr,[1]);
 for(const run of r.runs)for(const plan of run.plans){assert.deepEqual(plan.candidates.map(c=>c.rateMmHr),[1]);assert.deepEqual(plan.durationTargets.checks[0].witnesses.map(w=>w.rateMmHr),[1]);}
 assert.equal(comparePlacements({...p,weather:{...p.weather,stepMinutes:2.5}},query({subset:'calibration'})).status,'no-compatible-rates');
});
