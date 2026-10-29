import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {runRain} from '../core.js';
import {hypothesisLayer} from '../draining-layer-evidence.js';
import {proposeUnfilledReceivingBandWitnesses,UNFILLED_DRAIN_RATE_EVALUATIONS,UNFILLED_DRAIN_MAXIMUM_PROPOSALS} from '../post-dry-receiving-inverse.js';
import {fitReceivingAccountBands} from '../receiving-account-band-fit.js';
import {fitReceivingAccountPhases,reserveReceivingAccountPhaseWork,makeUnfilledReceivingPhaseExample,serializeReceivingAccountPhases,parseReceivingAccountPhases} from '../receiving-account-phase-fit.js';
import {compareReceivingAccountConsequences} from '../receiving-account-consequences.js';
import {phaseIndependentCourses} from './receiving-phase-independent-fixtures.mjs';
import {predecessor} from './receiving-drain-predecessor.mjs';

const clone=x=>structuredClone(x),fit=e=>fitReceivingAccountPhases(e.project,e.selection,e.account);
const receipt={schema:'experimental-earth-drain-conditioning-native/1',checks:[],sourceHashes:{},meaning:'Independent ODE controls and consumed authored-case comparison; no field or fresh-input qualification claim.'};
for(const p of ['post-dry-receiving-inverse.js','receiving-account-phase-fit.js','receiving-account-consequences.js','tests/receiving-drain-conditioning.test.mjs'])receipt.sourceHashes[p]=createHash('sha256').update(readFileSync(new URL('../'+p,import.meta.url))).digest('hex');
let groups=0;function group(name,fn){groups++;test(name,async()=>{await fn();receipt.checks.push(name);if(process.env.RECEIVING_DRAIN_RECEIPT)writeFileSync(process.env.RECEIVING_DRAIN_RECEIPT,JSON.stringify(receipt,null,2)+'\n');});}

// Independently integrate the inventory and drained-water differential
// equations with RK4, splitting each step at the physical input switches.
function odeOriginal(R,F,T,k,S0,times){
  const U=T+Math.max(0,R-F)*T/F;let t=0,S=S0,D=0;const records=new Map();
  for(const goal of times){while(t<goal-1e-14){const edge=[T,U,goal].filter(x=>x>t+1e-14).sort((a,b)=>a-b)[0],dt=Math.min(.001,edge-t),I=t<T?Math.min(R,F):t<U?F:0;
      const a=I-k*S,b=I-k*(S+a*dt/2),c=I-k*(S+b*dt/2),d=I-k*(S+c*dt);
      D+=dt*k*(S+2*(S+a*dt/2)+2*(S+b*dt/2)+(S+c*dt))/6;S+=dt*(a+2*b+2*c+d)/6;t+=dt;
    }records.set(goal,{stored:S,drained:D});}return records;
}

group('independent ODE originals constrain cumulative drainage before during and after the storm and ponded phase',()=>{
  const records=[];
  for(const R of [12,24,39,72])for(const S0 of [0,7]){
    const F=24,T=.5,k=.7,area=4,times=[0,.25,.75,1.5,3,4,5],original=odeOriginal(R,F,T,k,S0,times);
    const row=(channel,t)=>({channel,use:'calibration',minute:t*60,valueLiters:area*original.get(t)[channel==='retained'?'stored':'drained'],uncertaintyLiters:1e-4});
    const input={rainMmHr:R,infiltrationMmHr:F,stormMinutes:T*60,stormEndDepthMm:Math.max(0,R-F)*T,stormUncertaintyMm:1e-6,areaM2:area,readings:[3,4].map(t=>row('retained',t)),drainedReadings:[0,.25,.75,1.5,4].map(t=>row('drained',t))},before=clone(input);
    const r=proposeUnfilledReceivingBandWitnesses(input);assert.deepEqual(input,before);assert.ok(r.proposals.length>0);assert.ok(r.proposals.length<=UNFILLED_DRAIN_MAXIMUM_PROPOSALS);assert.equal(r.rateEvaluations,UNFILLED_DRAIN_RATE_EVALUATIONS);assert.equal(r.bandIntersections,409*7);
    const e=makeUnfilledReceivingPhaseExample(),weather={...e.project.weather,rainMmHr:R,stormMinutes:30,durationMinutes:300,stepMinutes:15};
    for(const h of r.proposals){const result=runRain(e.project.proposal,2,2,weather,{drainingLayer:hypothesisLayer(e.selection,{...h,source:'Independent ODE-generated calibration control'})});
      for(const source of [...input.readings,...input.drainedReadings]){const snapshot=result.drainingLayer.snapshots.find(s=>s.minute===source.minute),actual=snapshot[source.channel==='retained'?'retainedLiters':'drainedLiters'];assert.ok(Math.abs(actual-source.valueLiters)<=source.uncertaintyLiters+1e-7);}
    }
    records.push({rainMmHr:R,initialMm:S0,proposals:r.proposals.length,rateEvaluations:r.rateEvaluations,bandIntersections:r.bandIntersections});
  }
  receipt.odeOriginals=records;
});

function example(){const e=makeUnfilledReceivingPhaseExample(),truth=runRain(e.project.proposal,2,2,e.project.weather,{drainingLayer:hypothesisLayer(e.selection,{capacityMm:50,initialStoredMm:12.5,drainagePerHour:.25,source:'Authored model solely for original input creation'})});
  e.account.readings.push({id:'new-drained-540',channel:'drained',minute:540,valueLiters:truth.drainingLayer.snapshots.find(r=>r.minute===540).drainedLiters,uncertaintyLiters:.02,use:'calibration',source:'Authored additional original cumulative drainage; not field measurement or a derived retained observation'});return e;}

group('new original drainage constrains generated initial water and reaches the actual original-map consumer',()=>{
  const e=example(),before=clone(e),old=fitReceivingAccountBands(e.project,e.selection,e.account),r=fit(e);
  assert.equal(old.compatibleIds.length,0);assert.equal(r.compatibleIds.length,12);assert.equal(r.survivingIds.length,10);assert.deepEqual(e,before);
  const refined=r.candidates.filter(c=>c.phaseOrigins?.some(o=>o.rateMethod==='original-retained-and-drained-band-refinement'));assert.equal(refined.length,6);assert.ok(refined.every(c=>c.calibration.compatible));
  assert.ok(refined.every(c=>c.phaseOrigins.every(o=>o.accountIndices.includes(e.account.readings.length-1))));
  assert.equal(r.counts.phaseRateEvaluations,409);assert.equal(r.counts.phaseBandIntersections,1227);assert.equal(r.reservation.maximumPhaseProposals,90);assert.ok(r.counts.phaseUniqueParameters<=90);
  receipt.example={status:r.status,oldCalibration:0,calibration:12,held:10,counts:r.counts,reservation:r.reservation};
});

group('held observations cannot change original-drainage constraints rate searches or candidate parameters',()=>{
  const e=example(),r=fit(e);e.account.readings.filter(x=>x.use==='challenge').forEach(x=>x.valueLiters=100000);e.project.observations.filter(x=>x.use==='challenge').forEach(x=>x.depthMm=500);const wrong=fit(e);
  assert.equal(wrong.survivingIds.length,0);assert.deepEqual(wrong.unfilled,r.unfilled);assert.deepEqual(wrong.candidates.map(x=>x.hypothesis),r.candidates.map(x=>x.hypothesis));assert.deepEqual(wrong.compatibleIds,r.compatibleIds);assert.deepEqual(wrong.question,r.question);assert.deepEqual(wrong.counts,r.counts);
  receipt.wrongHeld={status:wrong.status,calibration:wrong.compatibleIds.length,held:0,parametersAndSearchUnchanged:true};
});

group('conflicting drainage original and impossible timezero drainage cannot report success or silently become retained evidence',()=>{
  const e=example();e.account.readings.push({...e.account.readings.at(-1),id:'conflicting-drain',valueLiters:100000});const conflict=fit(e);assert.equal(conflict.compatibleIds.length,0);assert.equal(conflict.survivingIds.length,0);
  const zero=example();zero.account.readings.push({...zero.account.readings.at(-1),id:'bad-timezero',minute:0,valueLiters:1,uncertaintyLiters:0});const atZero=fit(zero);assert.equal(atZero.compatibleIds.length,0);assert.equal(atZero.survivingIds.length,0);
  const retained=example().account.readings.filter(r=>r.channel==='retained'&&r.use==='calibration');const badRole=proposeUnfilledReceivingBandWitnesses({rainMmHr:48,infiltrationMmHr:24,stormMinutes:60,stormEndDepthMm:24,stormUncertaintyMm:1e-5,areaM2:4,readings:retained,drainedReadings:[{...example().account.readings.at(-1),use:'challenge'}]});assert.equal(badRole.status,'refused');assert.equal(badRole.proposals.length,0);
  receipt.refusals={conflictingOriginal:conflict.status,timezeroOriginal:atZero.status,heldRole:badRole.reason};
});

async function instrumented(){
  const url=new URL('../receiving-account-phase-fit.js',import.meta.url);let text=readFileSync(url,'utf8');
  for(const [a,b]of [['{runRain,SURFACES}','{runRain as actualRunRain,SURFACES}'],['{inferPostDryRetainedReceivers,proposeUnfilledReceivingBandWitnesses,','{inferPostDryRetainedReceivers as actualFilled,proposeUnfilledReceivingBandWitnesses as actualUnfilled,'],['{fitReceivingAccountBands,','{fitReceivingAccountBands as actualBand,']]){assert.equal(text.split(a).length,2);text=text.replace(a,b);}
  text=text.replace(/from '(\.[^']+)';/g,(_,p)=>"from '"+new URL(p,url).href+"';");
  text+='\nexport const calls={forward:0,filled:0,unfilled:0,incumbent:0};\nconst runRain=(...a)=>{calls.forward++;return actualRunRain(...a);};\nconst inferPostDryRetainedReceivers=(...a)=>{calls.filled++;return actualFilled(...a);};\nconst proposeUnfilledReceivingBandWitnesses=(...a)=>{calls.unfilled++;return actualUnfilled(...a);};\nconst fitReceivingAccountBands=(...a)=>{calls.incumbent++;return actualBand(...a);};\n';return import('data:text/javascript;base64,'+Buffer.from(text).toString('base64'));
}

group('complete positive-time drainage search and extra-model work refuses before any producer when the prior fixed-grid work fits',async()=>{
  const e=example();e.project.width=8;e.project.height=5;for(const side of ['existing','proposal'])e.project[side]=Array.from({length:40},()=>({...e.project[side][0]}));
  const noRateConstraint=clone(e);noRateConstraint.account.readings.at(-1).minute=0;const prior=reserveReceivingAccountPhaseWork(noRateConstraint.project,noRateConstraint.selection,noRateConstraint.account);assert.ok(prior.totalCellEquivalentSteps<1000000);
  const m=await instrumented();assert.throws(()=>m.fitReceivingAccountPhases(e.project,e.selection,e.account),/complete original-band incumbent/);assert.deepEqual(m.calls,{forward:0,filled:0,unfilled:0,incumbent:0});
  receipt.budget={fixedGridReserved:prior.totalCellEquivalentSteps,positiveTimeRefusedBeforeAllProducers:true,calls:m.calls};
});

group('source-only replay and paired layouts retain every admitted drain-conditioned model and original row',()=>{
  const e=example(),r=fit(e),text=serializeReceivingAccountPhases(e.project,e.selection,e.account);assert.deepEqual(fit(parseReceivingAccountPhases(text)),r);
  const raw=JSON.parse(text);assert.deepEqual(raw.account,e.account);assert.throws(()=>parseReceivingAccountPhases(JSON.stringify({...raw,refinedRate:.25})),/saved conclusions/);
  const c=compareReceivingAccountConsequences(e.project,e.selection,e.account,{mode:'phases',transferBasis:'Authored same receiver and per-cell initial inventory in the two original layouts; no physical adoption.'});assert.equal(c.candidates.length,12);assert.equal(c.survivingIds.length,10);assert.equal(c.counts.comparisonRuns,72);assert.ok(c.candidates.every(x=>x.accountReadings.length===e.account.readings.length));
  receipt.paired={models:c.candidates.length,held:c.survivingIds.length,reservation:c.reservation.totalCellEquivalentSteps,runs:c.counts.comparisonRuns};
});

group('frozen predecessor retains14of16 and its two filled failures while current filled mechanism supports16of16',()=>{
  const records=[];let cal=0,held=0,currentCal=0,currentHeld=0;
  for(const e of phaseIndependentCourses().filter(c=>c.eligible)){
    const minute=Math.max(...e.account.readings.filter(x=>x.channel==='retained'&&x.use==='calibration').map(x=>x.minute));e.account.readings.push({id:'additional-drained-'+minute,channel:'drained',minute,valueLiters:e.result.drainingLayer.snapshots.find(x=>x.minute===minute).drainedLiters,uncertaintyLiters:.02,use:'calibration',source:'Authored additional original under predeclared development rule'});
    const r=predecessor.fitReceivingAccountPhases(e.project,e.selection,e.account),current=fit(e);cal+=!!r.compatibleIds.length;held+=!!r.survivingIds.length;currentCal+=!!current.compatibleIds.length;currentHeld+=!!current.survivingIds.length;records.push({id:e.id,calibration:r.compatibleIds.length,held:r.survivingIds.length,rateEvaluations:r.counts.phaseRateEvaluations,currentCalibration:current.compatibleIds.length,currentHeld:current.survivingIds.length});
  }
  assert.equal(cal,14);assert.equal(held,14);assert.deepEqual(records.filter(r=>!r.calibration).map(r=>r.id),['phase-07','phase-14']);assert.equal(currentCal,16);assert.equal(currentHeld,16);receipt.consumed={calibration:cal,held,total:16,currentCalibration:currentCal,currentHeld,records};
});

test('write final source-bound native receipt',()=>{assert.equal(receipt.checks.length,groups);receipt.passed=true;if(process.env.RECEIVING_DRAIN_RECEIPT)writeFileSync(process.env.RECEIVING_DRAIN_RECEIPT,JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify({passed:true,groups,development:receipt.consumed}));});
