import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {runRain,SURFACES} from '../core.js';
import {hypothesisLayer} from '../draining-layer-evidence.js';
import {evaluateReadings} from '../infiltration-study.js';
import {evaluateReceivingAccountRows,receivingAccountVerdict} from '../receiving-account-evidence.js';
import {proposeFilledDrainBandWitnesses,reserveFilledDrainBandWork,unfilledReceivingSurfaceCourse} from '../post-dry-receiving-inverse.js';
import {fitReceivingAccountPhases,reserveReceivingAccountPhaseWork,serializeReceivingAccountPhases,parseReceivingAccountPhases} from '../receiving-account-phase-fit.js';
import {compareReceivingAccountConsequences} from '../receiving-account-consequences.js';
import {predecessor} from './receiving-drain-predecessor.mjs';
const clone=x=>structuredClone(x),fit=e=>fitReceivingAccountPhases(e.project,e.selection,e.account);
const prior=JSON.parse(readFileSync(new URL('../experiments/independent-drain-comparison.json',import.meta.url)));
const source=id=>clone(prior.records.find(c=>c.id===id).source);
const input=e=>{const w=e.project.weather,storm=e.project.observations.find(x=>x.use==='calibration'&&x.minute===w.stormMinutes);return {rainMmHr:w.rainMmHr,infiltrationMmHr:SURFACES[e.selection.surface].infiltrationMmHr,stormMinutes:w.stormMinutes,stormEndDepthMm:storm.depthMm,stormUncertaintyMm:storm.uncertaintyMm,areaM2:e.project[e.selection.target].filter(x=>x.surface===e.selection.surface).length*w.cellSizeM**2,readings:e.account.readings.filter(x=>x.use==='calibration'&&x.channel==='retained'),drainedReadings:e.account.readings.filter(x=>x.use==='calibration'&&x.channel==='drained')};};
const receipt={schema:'experimental-earth-filled-drain-native/1',checks:[],sourceHashes:{},meaning:'Independent mass-conserving differential-equation controls and consumed original-source regression; no fresh-input or measured-field qualification.'};
for(const name of ['post-dry-receiving-inverse.js','receiving-account-phase-fit.js','receiving-account-proposals-panel.js','tests/receiving-filled-drain.test.mjs'])receipt.sourceHashes[name]=createHash('sha256').update(readFileSync(new URL('../'+name,import.meta.url))).digest('hex');
let groups=0;function group(name,fn){groups++;test(name,async()=>{await fn();receipt.checks.push(name);});}
function ode({R,C,k,S0,T},times,subdivisions){
  // Independent conservative Euler flux integration, no inverse or analytical
  // retained/drained expressions. All three water accounts are advanced together.
  const end=Math.max(...times),at=new Set(times.map(t=>t*subdivisions)),result=new Map([[0,{surface:0,stored:S0,drained:0}]]),dt=1/(60*subdivisions);
  let h=0,s=S0,d=0,steps=0;
  for(let i=0;i<end*subdivisions;i++){
    const rain=i<T*subdivisions?R*dt:0,drain=k*s*dt,inflow=Math.min(24*dt,h+rain,C-s+drain);
    s+=inflow-drain;h+=rain-inflow;d+=drain;steps++;
    if(at.has(i+1))result.set((i+1)/subdivisions,{surface:h,stored:s,drained:d});
  }
  const mass=S0+R*T/60;assert.ok(Math.abs(h+s+d-mass)<2e-7,JSON.stringify({h,s,d,mass}));
  return {result,steps};
}
group('independently integrated filled originals constrain retained and drainage values before fill during full storage and after dry',()=>{
 const courses=[
 {R:31,C:14,k:.9,S0:11.2,T:70,u:240,v:420},
 {R:46,C:12,k:.55,S0:0,T:55,u:300,v:480},
 {R:32,C:18,k:.45,S0:18,T:45,u:240,v:420},
 {R:18,C:9,k:.7,S0:0,T:50,u:180,v:360},
 {R:60,C:7,k:1.2,S0:4,T:40,u:360,v:480},
 {R:24,C:26,k:.6,S0:13,T:90,u:240,v:420},
 {R:12,C:8,k:.5,S0:8,T:30,u:180,v:300},
 {R:28,C:35,k:.35,S0:25,T:100,u:300,v:480}];
 const observations=[];
 for(const c of courses){
  const times=[0,5,20,c.T,c.T+5,c.u,c.v],a=ode(c,times,1000),b=ode(c,times,2000);
  let maxDifference=0;for(const t of times)for(const key of ['surface','stored','drained'])maxDifference=Math.max(maxDifference,Math.abs(a.result.get(t)[key]-b.result.get(t)[key]));
  assert.ok(maxDifference<.002,'ODE step refinement exceeds original declared test tolerance');
  const rows=[c.u,c.v].map(minute=>({minute,valueLiters:b.result.get(minute).stored*4,uncertaintyLiters:.02,channel:'retained',use:'calibration'}));
  const drained=[0,5,20,c.T+5,c.u,c.v].map(minute=>({minute,valueLiters:b.result.get(minute).drained*4,uncertaintyLiters:.02,channel:'drained',use:'calibration'}));
  const original={rainMmHr:c.R,infiltrationMmHr:24,stormMinutes:c.T,stormEndDepthMm:b.result.get(c.T).surface,stormUncertaintyMm:.005,areaM2:4,readings:rows,drainedReadings:drained},before=clone(original),r=proposeFilledDrainBandWitnesses(original);
  assert.deepEqual(original,before);assert.ok(r.proposals.length>0,JSON.stringify({c,r}));assert.ok(r.proposals.length<=12);assert.equal(r.counts.qEvaluations,409);assert.ok(r.counts.modelEvaluations<=r.reservation.modelEvaluations);
  const cells=Array.from({length:4},()=>({surface:'garden',elevationM:0,provenance:'Authored uniform garden for independent conservative ODE control; no field observation'}));
  let supported=0;
  for(const h of r.proposals){
    const actual=runRain(cells,2,2,{rainMmHr:c.R,stormMinutes:c.T,durationMinutes:c.v,stepMinutes:5,cellSizeM:1,mobilityPerHour:0,boundaryExitPerHour:0},{drainingLayer:hypothesisLayer({surface:'garden'},{...h,source:'Original calibration-band candidate checked against independent ODE originals'})});
    const observations=[{index:0,reading:{cellIndex:0,minute:c.T,depthMm:original.stormEndDepthMm,uncertaintyMm:.005}}];
    const account=evaluateReceivingAccountRows(actual,[...rows,...drained].map((x,i)=>({...x,id:'ode-'+i,source:'Independent Euler original with fixed tolerance'})));
    const v=receivingAccountVerdict(evaluateReadings(actual,observations),account);if(v.compatible)supported++;
  }
  assert.ok(supported>0,JSON.stringify({c,r}));
  observations.push({course:c,stepRefinementMaximumMm:maxDifference,proposals:r.proposals.length,supported,counts:r.counts,independentSteps:a.steps+b.steps});
 }
 receipt.independentODE=observations;
});
group('filled original drainage improves both unresolved consumed courses while retaining exact predecessor failures',()=>{
 const records=[];
 for(const id of ['drain-new-03','drain-new-08']){
  const e=source(id),before=clone(e),old=predecessor.fitReceivingAccountPhases(e.project,e.selection,e.account),r=fit(e);
  assert.equal(old.compatibleIds.length,0);assert.equal(old.survivingIds.length,0);assert.ok(r.compatibleIds.length>0);assert.ok(r.survivingIds.length>0);assert.deepEqual(e,before);
  assert.equal(r.reservation.unfilledPossible,false);assert.equal(r.counts.phaseRateEvaluations,0);assert.equal(r.counts.filledDrainQEvaluations,409);
  assert.ok(r.candidates.filter(c=>c.phaseOrigins?.some(o=>o.family==='filled-drain')).every(c=>c.phaseOrigins.every(o=>o.accountIndices.includes(2))));
  records.push({id,old:0,calibration:r.compatibleIds.length,held:r.survivingIds.length,reservation:r.reservation,counts:r.counts});
 }
 receipt.development=records;
});
group('held values do not select full-store rates decay intersections parameters questions or complete work',()=>{
 const e=source('drain-new-03'),r=fit(e);e.account.readings.filter(x=>x.use==='challenge').forEach(x=>x.valueLiters=100000);e.project.observations.filter(x=>x.use==='challenge').forEach(x=>x.depthMm=500);const w=fit(e);
 assert.equal(w.survivingIds.length,0);assert.deepEqual(w.filledDrain,r.filledDrain);assert.deepEqual(w.candidates.map(c=>c.hypothesis),r.candidates.map(c=>c.hypothesis));assert.deepEqual(w.compatibleIds,r.compatibleIds);assert.deepEqual(w.question,r.question);assert.deepEqual(w.reservation,r.reservation);assert.deepEqual(w.counts,r.counts);receipt.heldIndependent=true;
});
group('contradictory original drainage timezero contradiction and held-role injection cannot become success',()=>{
 const e=source('drain-new-03');e.account.readings.push({...e.account.readings[2],id:'contradiction',valueLiters:100000});assert.equal(fit(e).compatibleIds.length,0);
 const z=source('drain-new-03');z.account.readings.push({...z.account.readings[2],id:'impossible-zero',minute:0,valueLiters:1,uncertaintyLiters:0});assert.equal(fit(z).compatibleIds.length,0);
 const q=input(source('drain-new-03'));q.drainedReadings[0].use='challenge';assert.equal(proposeFilledDrainBandWitnesses(q).proposals.length,0);assert.equal(reserveFilledDrainBandWork(q).maximumProposals,0);
 receipt.refusals=['contradictory-original','impossible-timezero','held-role'];
});
async function instrumented(){
 const url=new URL('../receiving-account-phase-fit.js',import.meta.url);let s=readFileSync(url,'utf8');
 const aliases=[['{runRain,SURFACES}','{runRain as actualForward,SURFACES}'],['{inferPostDryRetainedReceivers,','{inferPostDryRetainedReceivers as actualOldFilled,'],['proposeUnfilledReceivingBandWitnesses,','proposeUnfilledReceivingBandWitnesses as actualUnfilled,'],['proposeFilledDrainBandWitnesses,','proposeFilledDrainBandWitnesses as actualFilled,'],['{fitReceivingAccountBands,','{fitReceivingAccountBands as actualBand,']];
 for(const [a,b]of aliases){assert.equal(s.split(a).length,2);s=s.replace(a,b);}s=s.replace(/from '(\.[^']+)';/g,(_,p)=>"from '"+new URL(p,url).href+"';");
 s+='\nexport const calls={forward:0,oldFilled:0,unfilled:0,filled:0,band:0};export let corrupt=false;export function setCorrupt(){corrupt=true;}const runRain=(...a)=>{calls.forward++;const r=actualForward(...a);if(corrupt)r.snapshots.forEach(x=>x.depthsMm[0]+=2);return r;};const inferPostDryRetainedReceivers=(...a)=>{calls.oldFilled++;return actualOldFilled(...a);};const proposeUnfilledReceivingBandWitnesses=(...a)=>{calls.unfilled++;return actualUnfilled(...a);};const proposeFilledDrainBandWitnesses=(...a)=>{calls.filled++;return actualFilled(...a);};const fitReceivingAccountBands=(...a)=>{calls.band++;return actualBand(...a);};\n';
 return import('data:text/javascript;base64,'+Buffer.from(s).toString('base64'));
}
group('complete nested filled work refuses before every producer and all final original-grid readings remain authoritative',async()=>{
 const e=source('drain-new-08');e.project.width=12;e.project.height=12;for(const side of ['existing','proposal'])e.project[side]=Array.from({length:144},()=>({...e.project[side][0]}));
 const m=await instrumented();assert.throws(()=>m.fitReceivingAccountPhases(e.project,e.selection,e.account),/complete original-band incumbent/);assert.deepEqual(m.calls,{forward:0,oldFilled:0,unfilled:0,filled:0,band:0});
 m.setCorrupt();const valid=source('drain-new-03'),bad=m.fitReceivingAccountPhases(valid.project,valid.selection,valid.account);assert.ok(bad.filledDrain.proposals.length>0);assert.equal(bad.compatibleIds.length,0);receipt.preflightAndFullGrid={refusedBeforeAllProducers:true,corruptedFinalOriginalSupport:0};
});
group('every admitted filled alternative reaches paired layouts within the unchanged combined limit and source-only replay',()=>{
 const records=[];for(const id of ['drain-new-03','drain-new-08']){const e=source(id),r=fit(e),text=serializeReceivingAccountPhases(e.project,e.selection,e.account);assert.deepEqual(fit(parseReceivingAccountPhases(text)),r);
 const raw=JSON.parse(text);assert.deepEqual(Object.keys(raw).sort(),['schema','project','selection','account'].sort());assert.throws(()=>parseReceivingAccountPhases(JSON.stringify({...raw,filledDrain:r.filledDrain})),/saved conclusions/);
 const q=compareReceivingAccountConsequences(e.project,e.selection,e.account,{mode:'phases',transferBasis:'Authored shared receiver and initial water across original paired layouts.'});assert.equal(q.candidates.length,r.compatibleIds.length);assert.equal(q.survivingIds.length,r.survivingIds.length);assert.equal(q.counts.comparisonRuns,6*q.candidates.length);assert.ok(q.reservation.totalCellEquivalentSteps<=1000000);records.push({id,models:q.candidates.length,held:q.survivingIds.length,reserved:q.reservation.totalCellEquivalentSteps,runs:q.counts.comparisonRuns});}receipt.paired=records;
});
test('write source-bound filled native receipt',()=>{assert.equal(receipt.checks.length,groups);receipt.passed=true;if(process.env.RECEIVING_FILLED_RECEIPT)writeFileSync(process.env.RECEIVING_FILLED_RECEIPT,JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify({passed:true,groups,paired:receipt.paired}));});
