import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {compareReceivingAccountConsequences,reserveReceivingAccountConsequenceWork,serializeReceivingAccountConsequences,parseReceivingAccountConsequences} from '../receiving-account-consequences.js';
import {makeNoisyReceivingAccountBandExample,reserveReceivingAccountBandWork} from '../receiving-account-band-fit.js';
import {makePostDryReceivingAccountProposalExample} from '../receiving-account-proposals.js';
import {runRain} from '../core.js';
import {hypothesisLayer} from '../draining-layer-evidence.js';

const clone=x=>structuredClone(x),options={mode:'bands',transferBasis:'Authored common receiver per selected garden cell in both original layouts; no physical material identity is claimed.'};
const run=(e,o=options)=>compareReceivingAccountConsequences(e.project,e.selection,e.account,o);
const frozen=r=>r.candidates.map(({hypothesis,origins,existing,proposal,change,receiverChange})=>({hypothesis,origins,existing,proposal,change,receiverChange}));
const receipt={schema:'experimental-earth-receiving-consequence-native/1',checks:[],sourceKind:'Authored maintained-consumer controls; not field validation',sourceHashes:{}};
for(const p of ['receiving-account-consequences.js','draining-layer-study.js','draining-layer-evidence.js','draining-infiltration.js','core.js','receiving-account-band-fit.js'])receipt.sourceHashes[p]=createHash('sha256').update(readFileSync(new URL('../'+p,import.meta.url))).digest('hex');
function group(name,fn){test(name,async()=>{await fn();receipt.checks.push(name);if(process.env.RECEIVING_CONSEQUENCE_RECEIPT)writeFileSync(process.env.RECEIVING_CONSEQUENCE_RECEIPT,JSON.stringify(receipt,null,2)+'\n');});}
function close(a,b,tolerance=1e-8){assert.ok(Math.abs(a-b)<=tolerance,`${a} != ${b}`);}

group('inferred original-band family reaches both maintained layouts with original evidence and separate initial-water balances',()=>{
  const e=makeNoisyReceivingAccountBandExample(),before=clone(e),r=run(e);
  assert.equal(r.status,'compared');assert.equal(r.inference.baseline.compatibleIds.length,0);assert.equal(r.candidates.length,3);assert.equal(r.counts.comparisonRuns,18);assert.deepEqual(e,before);
  // Independently calculated sealed surface: rain30 for1h, infiltration1 for12h,
  // four cells:72L remains and the peak is29mm. Gardens absorb all120L by12h.
  for(const c of r.candidates){
    close(c.existing.storedLiters,72);close(c.existing.maxDepthMm,29);close(c.proposal.storedLiters,0);close(c.proposal.absorbedLiters,120);close(c.change.storedLiters,-72);
    assert.equal(c.calibration.compatible,true);assert.equal(c.challenge.compatible,true);assert.equal(c.accountReadings.length,e.account.readings.length);
    assert.equal(c.existing.receiver.initialLiters,0);assert.ok(c.proposal.receiver.initialLiters>0);assert.ok(c.proposal.receiver.drainedLiters>c.proposal.rainLiters);
    for(const side of ['existing','proposal']){
      const x=c[side],v=x.receiver;close(v.initialLiters+v.infiltratedLiters,v.retainedLiters+v.drainedLiters);close(x.massErrorLiters,0);close(v.balanceErrorLiters,0);
      const independent=runRain(e.project[side],e.project.width,e.project.height,e.project.weather,{drainingLayer:hypothesisLayer(e.selection,c.hypothesis)});
      for(const key of ['absorbedLiters','storedLiters','exitLiters','maxDepthMm'])close(x[key],independent[key]);
    }
  }
  assert.ok(r.reservation.totalCellEquivalentSteps<=r.reservation.limit);
  receipt.example={status:r.status,counts:r.counts,reservation:r.reservation,effects:r.effects};
});

group('the retained analytic family and searched family both contribute; exact duplicate parameters retain every origin',()=>{
  const e=makePostDryReceivingAccountProposalExample();
  const r=run(e);const expected=[...r.inference.baseline.candidates,...r.inference.candidates].filter(c=>c.calibration.compatible===true);
  assert.ok(r.inference.baseline.compatibleIds.length>0);assert.ok(r.inference.compatibleIds.length>0);
  const parameters=c=>JSON.stringify([c.hypothesis.capacityMm,c.hypothesis.initialStoredMm,c.hypothesis.drainagePerHour]);
  assert.equal(r.candidates.length,new Set(expected.map(parameters)).size);
  assert.equal(r.candidates.reduce((n,c)=>n+c.origins.length,0),expected.length);
  assert.ok(r.candidates.some(c=>c.origins.some(o=>o.family==='analytic')));assert.ok(r.candidates.some(c=>c.origins.some(o=>o.family==='bands')));
  const analytic=run(e,{...options,mode:'central'});assert.equal(analytic.candidates.length,r.inference.baseline.compatibleIds.length);
  receipt.mixedFamily={analytic:r.inference.baseline.compatibleIds.length,searched:r.inference.compatibleIds.length,distinct:r.candidates.length,origins:expected.length};
});

group('wrong held values change challenge results while all fitted parameters, compared family and consequences stay identical',()=>{
  const e=makeNoisyReceivingAccountBandExample(),first=run(e);
  for(const row of e.account.readings.filter(r=>r.use==='challenge'))row.valueLiters=100000;
  for(const row of e.project.observations.filter(r=>r.use==='challenge'))row.depthMm=500;
  const wrong=run(e);assert.equal(wrong.status,'challenged');assert.deepEqual(frozen(wrong),frozen(first));assert.deepEqual(wrong.effects.calibration,first.effects.calibration);
  assert.equal(wrong.survivingIds.length,0);assert.equal(wrong.effects.surviving.count,0);assert.equal(wrong.effects.surviving.metrics.storedLiters,null);assert.ok(wrong.candidates.every(c=>c.challenge.compatible===false));
  receipt.wrongHeld={status:wrong.status,compared:wrong.candidates.length,survivors:wrong.survivingIds.length};
});

group('source scenarios remain distinct; identical layouts have zero change and swapping layouts reverses every consequence',()=>{
  const e=makeNoisyReceivingAccountBandExample(),original=run(e),same=clone(e);same.project.existing=clone(same.project.proposal);
  const identical=run(same);for(const c of identical.candidates)for(const v of [...Object.values(c.change),...Object.values(c.receiverChange)])assert.equal(v,0);
  const swapped=clone(e);[swapped.project.existing,swapped.project.proposal]=[swapped.project.proposal,swapped.project.existing];swapped.selection.target='existing';
  for(const reading of swapped.project.observations)reading.scenario=reading.scenario==='proposal'?'existing':'proposal';
  const reversed=run(swapped);assert.equal(reversed.candidates.length,original.candidates.length);
  reversed.candidates.forEach((c,i)=>{const before=original.candidates[i];for(const k of Object.keys(c.change))close(c.change[k],-before.change[k]);for(const k of Object.keys(c.receiverChange))close(c.receiverChange[k],-before.receiverChange[k]);});
  const other=clone(e);other.project.observations.push({...other.project.observations[0],scenario:'existing',depthMm:500,source:'Authored contradictory other-scenario reading; not calibration of the selected proposal footprint'});
  assert.deepEqual(frozen(run(other)),frozen(original));
});

group('contradictory original calibration has no consequence range and no default receiver',()=>{
  const e=makeNoisyReceivingAccountBandExample();e.account.readings.push({...e.account.readings[0],id:'contradiction',valueLiters:e.account.readings[0].valueLiters+10});
  const r=run(e);assert.equal(r.status,'no-compatible-receivers');assert.equal(r.counts.comparisonRuns,0);assert.equal(r.candidates.length,0);assert.equal(r.effects.calibration.metrics.storedLiters,null);
});

async function instrumented(corrupt=false){
  const url=new URL('../receiving-account-consequences.js',import.meta.url);let text=readFileSync(url,'utf8');
  for(const [a,b] of [['{proposeReceivingAccountLayers,','{proposeReceivingAccountLayers as actualCentral,'],['{fitReceivingAccountBands,','{fitReceivingAccountBands as actualBands,'],['{compareDrainingLayer,','{compareDrainingLayer as actualCompare,']]){assert.equal(text.split(a).length,2);text=text.replace(a,b);}
  text=text.replace(/from '(\.[^']+)';/g,(_,p)=>"from '"+new URL(p,url).href+"';");
  text+='\nexport const calls={central:0,bands:0,comparison:0};\nconst proposeReceivingAccountLayers=(...a)=>{calls.central++;return actualCentral(...a);};\nconst fitReceivingAccountBands=(...a)=>{calls.bands++;return actualBands(...a);};\n'+
    `const compareDrainingLayer=(...a)=>{calls.comparison++;const r=actualCompare(...a);if(${corrupt})for(const s of r.proposal.draining.drainingLayer.snapshots)s.drainedLiters+=50;return r;};\n`;
  return import('data:text/javascript;base64,'+Buffer.from(text).toString('base64'));
}

group('combined full-family reservation refuses before inference even when the inverse and each consumer fit their individual budgets',async()=>{
  const e=makeNoisyReceivingAccountBandExample();e.project.width=e.project.height=8;e.project.existing=Array.from({length:64},()=>clone(e.project.existing[0]));e.project.proposal=Array.from({length:64},()=>clone(e.project.proposal[0]));
  for(const row of e.account.readings){row.valueLiters*=16;row.uncertaintyLiters*=16;}for(const row of e.account.offers)row.uncertaintyLiters*=16;
  assert.ok(reserveReceivingAccountBandWork(e.project,e.selection,e.account).totalCellEquivalentSteps<1000000);
  const m=await instrumented();assert.throws(()=>m.compareReceivingAccountConsequences(e.project,e.selection,e.account,options),/complete inverse and every possible/);assert.deepEqual(m.calls,{central:0,bands:0,comparison:0});
  const good=makeNoisyReceivingAccountBandExample();assert.throws(()=>m.compareReceivingAccountConsequences(good.project,good.selection,good.account,{...options,transferBasis:''}),/same receiver parameters/);assert.deepEqual(m.calls,{central:0,bands:0,comparison:0});
  receipt.combinedBudget={inverseIndividuallyAdmitted:true,consumerIndividuallyAdmitted:true,refusedCalls:m.calls};
});

group('a corrupt paired receiving run cannot report successful consequences from the earlier fit',async()=>{
  const e=makeNoisyReceivingAccountBandExample(),m=await instrumented(true);
  assert.throws(()=>m.compareReceivingAccountConsequences(e.project,e.selection,e.account,options),/paired consumer contradicted/);assert.equal(m.calls.bands,1);assert.equal(m.calls.comparison,1);
});

group('source-only replay recomputes exact consequences and refuses saved parameters, verdicts or altered option contracts',()=>{
  const e=makeNoisyReceivingAccountBandExample(),saved=serializeReceivingAccountConsequences(e.project,e.selection,e.account,options),raw=JSON.parse(saved),opened=parseReceivingAccountConsequences(saved);
  assert.deepEqual(Object.keys(raw).sort(),['schema','project','selection','account','options'].sort());assert.deepEqual(run(opened,opened.options),run(e));
  for(const key of ['result','hypotheses','candidates','effects'])assert.throws(()=>parseReceivingAccountConsequences(JSON.stringify({...raw,[key]:{status:'compared'}})),/saved parameters/);
  assert.throws(()=>parseReceivingAccountConsequences(JSON.stringify({...raw,options:{...options,chosenModel:'consequence-1'}})),/same receiver parameters/);
  assert.throws(()=>reserveReceivingAccountConsequenceWork(e.project,e.selection,e.account,{...options,mode:'held-best'}),/same receiver parameters/);
});
