import assert from 'node:assert/strict';
import {makeExample,interpolateDepth} from '../core.js';
import {runProfile,PROFILE_MODEL} from '../profile-model.js';
import {compareMixed,compareMixedResolution} from '../mixed-placement.js';
import {pathToFileURL} from 'node:url';import {resolve} from 'node:path';
if(!process.env.FIXED_REFINEMENT_BASELINE_ROOT)throw Error('Declare exact prior-source baseline root');const {compareMixed:prior,compareMixedResolution:priorFine}=await import(pathToFileURL(resolve(process.env.FIXED_REFINEMENT_BASELINE_ROOT,'mixed-placement.js')));
import {writeFileSync} from 'node:fs';
const rows=[];
for(const stepMinutes of [2,4]){
 const p=makeExample();p.proposal=structuredClone(p.existing);p.weather.stepMinutes=stepMinutes;
 const cells=p.proposal.flatMap((c,i)=>c.surface==='sealed'?[i]:[]).slice(0,stepMinutes===2?2:3);
 const q={model:PROFILE_MODEL,offers:cells.map(cellIndex=>({cellIndex,options:[{surface:'garden',cost:4,source:'Authored'},{surface:'turf',cost:1,source:'Authored'}]})),maxEdits:2,budget:5,costUnit:'units',metric:'unabsorbedLiters',subset:'calibration',study:{target:'proposal',surface:'sealed',ratesMmHr:[.2,.5,1,2,4,8,16,32,64]}};
 const model=runProfile(p.proposal,p.width,p.height,p.weather,{surfaceInfiltrationOverride:{surface:'sealed',rateMmHr:1}},{used:0,limit:3000000});
 p.observations=[{cellIndex:cells[0],minute:60,depthMm:interpolateDepth(model,cells[0],60).depthMm,uncertaintyMm:0,source:'Authored original model control',scenario:'proposal',use:'calibration'}];
 const baseline=compareMixed(p,q),old=prior(p,q);assert.deepEqual(baseline,old);assert.deepEqual(baseline.ratesMmHr,[1]);
 let oldResult;try{const r=priorFine(p,q,old,stepMinutes/2);oldResult={status:r.fine.status,work:r.combinedActualEventWork};}catch(e){oldResult={refusal:e.message};}
 const fine=compareMixedResolution(p,q,baseline,stepMinutes/2);assert.equal(fine.fine.status,'compared');assert.deepEqual(fine.fine.ratesMmHr,[1]);
 const changed={...p,weather:{...p.weather,stepMinutes:stepMinutes/2}};
 const reduced={...q,study:{...q.study,ratesMmHr:[.2,1]}};const direct=priorFine(p,reduced,prior(p,reduced),stepMinutes/2);assert.deepEqual(fine.fine.plans,direct.fine.plans);
 baseline.actualEventWork=0;baseline.work=0;assert.equal(compareMixedResolution(p,q,baseline,stepMinutes/2).combinedActualEventWork,fine.combinedActualEventWork);
 baseline.ratesMmHr.push(64);assert.throws(()=>compareMixedResolution(p,q,baseline,stepMinutes/2),/support was altered/);
 rows.push({stepMinutes,layouts:fine.fine.plans.length,prior:oldResult,candidate:{work:fine.combinedActualEventWork,estimated:fine.combinedEstimatedWork,best:fine.fine.bestKeys}});
}
writeFileSync(process.env.FIXED_REFINEMENT_RECEIPT||'fixed-refinement-receipt.json',JSON.stringify({passed:true,rows},null,2));console.log(rows);
