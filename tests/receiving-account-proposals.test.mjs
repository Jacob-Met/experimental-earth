import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {runRain,SURFACES} from '../core.js';
import {hypothesisLayer} from '../draining-layer-evidence.js';
import {inferReceivingAccountCentral} from '../receiving-account-inverse.js';
import {inferPostDryRetainedReceivers,inferPostDryDrainedReceivers} from '../post-dry-receiving-inverse.js';
import {chooseReceivingAccountQuestion} from '../receiving-account-evidence.js';
import {makeReceivingAccountProposalExample,makePostDryReceivingAccountProposalExample,makePostDryDrainageAccountProposalExample,proposeReceivingAccountLayers,serializeReceivingAccountProposals,parseReceivingAccountProposals} from '../receiving-account-proposals.js';
import {wetCourse,matchesTruth,postDryGridInputs,relativeError} from './receiving-inverse-fixtures.mjs';

const clone=x=>structuredClone(x),run=x=>proposeReceivingAccountLayers(x.project,x.selection,x.account);
const close=(a,b,tolerance=1e-7)=>assert.ok(relativeError(a,b)<=tolerance,JSON.stringify({a,b,tolerance}));
const hypotheses=r=>r.candidates.map(c=>c.hypothesis);
const proof={schema:'experimental-earth-receiving-inverse-native/1',checks:[],sourceKind:'Authored controls through the maintained forward model; not measured field validation',prequalificationFailures:['The first fixture requested minute 78.75 on a 1.5-minute endpoint grid; it was refused before inverse execution. The fixture now supplies the original exact minute 82.5.','A fractional-minute fixture generated a disallowed dot in its reading ID; source validation refused it. The ID now uses an underscore without changing the measurement time.']};
let expectedGroups=0;
const group=(name,fn)=>{expectedGroups++;test(name,async()=>{await fn();proof.checks.push(name);});};
const postDryInput=(e,channel)=>({rainMmHr:e.project.weather.rainMmHr,infiltrationMmHr:SURFACES[e.selection.surface].infiltrationMmHr,stormMinutes:e.project.weather.stormMinutes,stormEndDepthMm:e.project.observations[0].depthMm,areaM2:4,...Object.fromEntries((channel==='retained'?['earlier','later']:['earlier','middle','later']).map((key,index)=>[key,e.account.readings[index]]))});

group('wet receiver accounts recover unknown initial water on unfamiliar courses and retain true non-identification',()=>{
  const rows=[[36,7.3,3,.63,60],[17,9.19,9.19,.271,63],[47,11.1,2.3,.4,60],[29.7,4.6,.7,1.1,60],[19,6.7,2.1,.15,60],[36,7.3,3,0,60]],results=[];
  for(const [rainMmHr,capacityMm,initialStoredMm,drainagePerHour,stormMinutes]of rows)for(const channel of ['retained','drained']){
    const c=wetCourse({rainMmHr,capacityMm,initialStoredMm,drainagePerHour,stormMinutes,accountMinute:stormMinutes===63?82.5:75},channel);
    const originals=clone({project:c.project,selection:c.selection,account:c.account}),r=run(c);
    const recovered=r.candidates.some(candidate=>candidate.calibration.compatible&&candidate.challenge.compatible&&matchesTruth(candidate,c.truth));
    const expected=channel==='retained'||(initialStoredMm!==capacityMm&&drainagePerHour!==0);
    assert.equal(recovered,expected);assert.deepEqual({project:c.project,selection:c.selection,account:c.account},originals);
    if(!expected)assert.equal(r.compatibleIds.length,0);
    if(channel==='retained'&&initialStoredMm===capacityMm){
      assert.ok(r.refusedTrials.some(row=>row.branch==='wet-full-central'&&row.reason==='no-resolved-full-receiver-by-storm-end'));
      assert.ok(r.candidates.some(row=>row.phase==='initially-full-boundary'&&row.calibration.compatible&&row.challenge.compatible));
    }
    results.push({channel,truth:c.truth,status:r.status,recovered,refused:r.refusedTrials,nonIdentifying:r.nonIdentifyingTrials});
  }
  assert.equal(results.filter(r=>r.recovered).length,10);proof.wetCourses=results;
});

group('wet degeneracies and unsupported original roles cannot produce an identified drainage model',()=>{
  const base={rainMmHr:30,infiltrationMmHr:24,stormMinutes:60,laterMinute:120,stormEndDepthMm:24,laterDepthMm:18,account:{areaM2:4,channel:'drained',minute:90,valueLiters:36,use:'calibration'}};
  assert.equal(inferReceivingAccountCentral(base).status,'non-identifying');
  const zero={...base,stormEndDepthMm:25,laterDepthMm:25,account:{...base.account,valueLiters:0}};
  assert.equal(inferReceivingAccountCentral(zero).status,'non-identifying');
  zero.account.valueLiters=1e-12;assert.equal(inferReceivingAccountCentral(zero).status,'refused');
  for(const mutate of [x=>x.account.use='challenge',x=>x.account.minute=121,x=>x.account.areaM2=0,x=>x.laterDepthMm=0,x=>x.laterDepthMm=26,x=>x.account.channel='surface-outlet']){
    const x=clone(base);mutate(x);assert.equal(inferReceivingAccountCentral(x).status,'refused');
  }
});

group('both late-retained capacity branches survive and an independent mass account explains the separating question',()=>{
  const e=makePostDryReceivingAccountProposalExample(),before=clone(e),r=run(e);
  assert.equal(r.status,'several-surviving-proposals');assert.equal(r.compatibleIds.length,2);assert.equal(r.question.best.id,'drained-360');
  const supported=r.candidates.filter(c=>c.calibration.compatible);
  close(supported[0].hypothesis.capacityMm,12);close(supported[1].hypothesis.capacityMm,19.089136510662172);
  const retained=r.question.offers.find(x=>x.channel==='retained'),drained=r.question.offers.find(x=>x.channel==='drained');
  assert.equal(retained.separatedCount,0);assert.equal(drained.separatedCount,1);close(drained.pairs[0].gapLiters,49.9161236015644);
  for(const c of supported){
    const h=c.hypothesis,T=1,H=e.project.observations[0].depthMm,q=h.drainagePerHour*h.capacityMm;
    const I=4*h.capacityMm*Math.exp(-h.drainagePerHour*(6-T-H/q)),D=4*(h.initialStoredMm+30*T)-I;
    close(retained.predictions.find(p=>p.id===h.id).modeledLiters,I);close(drained.predictions.find(p=>p.id===h.id).modeledLiters,D);
  }
  assert.deepEqual(e,before);proof.ambiguity={parameters:supported.map(c=>c.hypothesis),question:r.question};
});

group('held receiver values change only challenge support, never generation or the prospective measurement',()=>{
  const e=makePostDryReceivingAccountProposalExample(),r=run(e),supported=r.candidates.filter(c=>c.calibration.compatible);
  const value=c=>runRain(e.project.proposal,2,2,e.project.weather,{drainingLayer:hypothesisLayer(e.selection,c.hypothesis)}).drainingLayer.snapshots.find(row=>row.minute===540).drainedLiters;
  e.account.readings.push({id:'held-drain-540',channel:'drained',minute:540,valueLiters:value(supported[0]),uncertaintyLiters:.001,use:'challenge',source:'Authored independent held drainage control'});
  const first=run(e);e.account.readings.at(-1).valueLiters=value(supported[1]);const second=run(e);
  assert.equal(first.survivingIds.length,1);assert.equal(second.survivingIds.length,1);assert.notDeepEqual(first.survivingIds,second.survivingIds);
  assert.deepEqual(hypotheses(first),hypotheses(second));assert.deepEqual(first.compatibleIds,second.compatibleIds);assert.deepEqual(first.question,second.question);
  assert.deepEqual(hypotheses(first),hypotheses(r));
});

group('all original bands remain binding, including duplicate-time contradictory readings and excluded held inputs',()=>{
  const e=makePostDryReceivingAccountProposalExample();
  e.account.readings.push({...e.account.readings[0],id:'independent-contradiction',valueLiters:e.account.readings[0].valueLiters+100});
  const rejected=run(e);assert.equal(rejected.compatibleIds.length,0);assert.equal(rejected.survivingIds.length,0);assert.equal(rejected.question.best,null);
  const held=makePostDryReceivingAccountProposalExample();held.account.readings[1].use='challenge';
  const unsupported=run(held);assert.equal(unsupported.retainedPairCount,0);assert.equal(unsupported.candidates.length,0);
  const allHeld=makeReceivingAccountProposalExample();allHeld.account.readings.forEach(row=>row.use='challenge');
  assert.equal(run(allHeld).status,'need-calibration-account');
});

group('unequally spaced original drainage triples recover the receiver and do not turn derived inventories into observations',()=>{
  const e=makePostDryDrainageAccountProposalExample(),before=clone(e),r=run(e);
  assert.equal(r.status,'one-surviving-proposal');assert.equal(r.drainedTripletCount,1);assert.equal(r.trialCount,9);
  const supported=r.candidates.filter(c=>c.calibration.compatible);assert.equal(supported.length,1);
  close(supported[0].hypothesis.capacityMm,12);close(supported[0].hypothesis.initialStoredMm,3.390981833321632);close(supported[0].hypothesis.drainagePerHour,.63);
  assert.equal(supported[0].accountReadings.length,4);
  assert.deepEqual(supported[0].accountReadings.map(x=>x.id),e.account.readings.map(x=>x.id));
  assert.ok(supported[0].originalTrials.every(t=>t.inverseSource==='post-dry-drained-triplet'&&t.accountIndices.join(',')==='0,1,2'));
  const derived=supported[0].originalTrials[0].derivedCourse;close(derived.firstRetainedLiters,25.31003635406631);close(derived.derivedInitialStoredMm,3.390981833321632);
  const alternate=r.candidates.find(c=>Math.abs(c.hypothesis.capacityMm-19.089136510662172)<1e-6&&c.phase==='post-dry-filled-during-rain');
  assert.equal(alternate.calibration.compatible,false);assert.equal(alternate.challenge.compatible,true);
  assert.deepEqual(e,before);proof.drainage={hypothesis:supported[0].hypothesis,derivedCourse:derived,alternateRejectedByCalibration:true};
});

group('drainage role boundaries, repeated-time provenance and wrong held values cannot alter inverse generation',()=>{
  const e=makePostDryDrainageAccountProposalExample(),first=run(e);
  e.account.readings.at(-1).valueLiters=100;const wrongHeld=run(e);
  assert.equal(wrongHeld.status,'challenged');assert.deepEqual(hypotheses(wrongHeld),hypotheses(first));assert.deepEqual(wrongHeld.question,first.question);
  const held=makePostDryDrainageAccountProposalExample();held.account.readings[1].use='challenge';
  const unsupported=run(held);assert.equal(unsupported.drainedTripletCount,0);assert.equal(unsupported.candidates.length,0);
  const repeated=makePostDryDrainageAccountProposalExample();repeated.account.readings.push({...repeated.account.readings[1],id:'independent-same-minute'});
  const report=run(repeated);assert.equal(report.drainedTripletCount,2);
  const survivor=report.candidates.find(c=>c.calibration.compatible&&c.challenge.compatible);
  assert.equal(survivor.accountReadings.length,5);
  assert.ok(survivor.originalTrials.some(t=>t.accountIndices.includes(1)));assert.ok(survivor.originalTrials.some(t=>t.accountIndices.includes(4)));
});

group('post-dry domain controls preserve refusal and non-identification without clamping readings or roots',()=>{
  const retained=postDryInput(makePostDryReceivingAccountProposalExample(),'retained');
  for(const mutate of [x=>x.earlier.use='challenge',x=>x.later.minute=x.earlier.minute,x=>x.later.valueLiters=x.earlier.valueLiters,x=>x.later.valueLiters=0,x=>x.areaM2=0]){
    const x=clone(retained);mutate(x);assert.equal(inferPostDryRetainedReceivers(x).status,'refused');
  }
  const drained=postDryInput(makePostDryDrainageAccountProposalExample(),'drained');
  for(const mutate of [x=>x.middle.use='challenge',x=>x.middle.channel='retained',x=>x.middle.minute=x.earlier.minute,x=>x.earlier.valueLiters=-1,x=>x.later.valueLiters=x.middle.valueLiters,x=>x.areaM2=0,x=>x.stormEndDepthMm=0,x=>x.later.valueLiters=1e12]){
    const x=clone(drained);mutate(x);assert.equal(inferPostDryDrainedReceivers(x).status,'refused');
  }
  const constant=clone(drained);constant.earlier={...constant.earlier,minute:240,valueLiters:4};constant.middle={...constant.middle,minute:300,valueLiters:5};constant.later={...constant.later,minute:420,valueLiters:7};
  assert.equal(inferPostDryDrainedReceivers(constant).status,'non-identifying');
});

group('strict original-input round-trip rejects forged conclusions and keeps declared original sources',()=>{
  for(const factory of [makeReceivingAccountProposalExample,makePostDryReceivingAccountProposalExample,makePostDryDrainageAccountProposalExample]){
    const e=factory(),saved=serializeReceivingAccountProposals(e.project,e.selection,e.account),raw=JSON.parse(saved),opened=parseReceivingAccountProposals(saved);
    assert.deepEqual(Object.keys(raw),['schema','project','selection','account']);assert.deepEqual(run(opened),run(e));
    for(const key of ['candidates','result','derivedCourse'])assert.throws(()=>parseReceivingAccountProposals(JSON.stringify({...raw,[key]:{status:'one-surviving-proposal'}})),/saved conclusions/);
  }
  const x=makePostDryReceivingAccountProposalExample();x.selection.uniformReceiverBasis='';assert.throws(()=>run(x),/uniform receiving layer/);
  for(const mutate of [x=>x.project.weather.mobilityPerHour=.1,x=>x.project.weather.boundaryExitPerHour=.1,x=>x.account.readings[0].minute=241,x=>x.account.footprintBasis='']){
    const e=makePostDryReceivingAccountProposalExample();mutate(e);assert.throws(()=>run(e));
  }
});

async function instrumentedProducer(){
  // Instrument the exact producer body using ordinary ESM. Only dependency
  // aliases and forwarding counters differ; all calculations use real modules.
  const url=new URL('../receiving-account-proposals.js',import.meta.url);
  let source=readFileSync(url,'utf8');
  const aliases=[
    ["{validateProject,runRain,SURFACES}","{validateProject,runRain as observedRunRain,SURFACES}"],
    ["{inferReceivingAccountCentral,proposeInitiallyFullReceivingAccount}","{inferReceivingAccountCentral as observedWet,proposeInitiallyFullReceivingAccount as observedFull}"],
    ["{inferPostDryRetainedReceivers,inferPostDryDrainedReceivers}","{inferPostDryRetainedReceivers as observedRetained,inferPostDryDrainedReceivers as observedDrained}"]
  ];
  for(const [before,after]of aliases){assert.equal(source.split(before).length,2);source=source.replace(before,after);}
  source=source.replace(/from '(\.[^']+)';/g,(_,path)=>"from '"+new URL(path,url).href+"';");
  source+='\nexport const observedCalls={forward:0,wet:0,full:0,retained:0,drained:0};\n'+
    'const runRain=(...args)=>{observedCalls.forward++;return observedRunRain(...args);};\n'+
    'const inferReceivingAccountCentral=(...args)=>{observedCalls.wet++;return observedWet(...args);};\n'+
    'const proposeInitiallyFullReceivingAccount=(...args)=>{observedCalls.full++;return observedFull(...args);};\n'+
    'const inferPostDryRetainedReceivers=(...args)=>{observedCalls.retained++;return observedRetained(...args);};\n'+
    'const inferPostDryDrainedReceivers=(...args)=>{observedCalls.drained++;return observedDrained(...args);};\n';
  const module=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
  return {run:e=>module.proposeReceivingAccountLayers(e.project,e.selection,e.account),calls:module.observedCalls};
}
group('combined inverse and forward budgets reserve every trial before any model calculation',async()=>{
  const measured=await instrumentedProducer(),e=makePostDryDrainageAccountProposalExample();
  const large=clone(e);large.account.readings=Array.from({length:7},(_,i)=>({...e.account.readings[0],id:'drain-'+i,minute:240+60*i,valueLiters:100+i}));
  assert.throws(()=>measured.run(large),/complete original wet and post-dry calibration family/);
  assert.deepEqual(measured.calls,{forward:0,wet:0,full:0,retained:0,drained:0});
  const valid=measured.run(e);assert.equal(valid.trialCount,9);assert.equal(valid.reservedCellSteps,5184);
  assert.deepEqual(measured.calls,{forward:5,wet:3,full:0,retained:0,drained:1});proof.work={refusedTrials:217,refusedCalls:0,validReserved:valid.reservedCellSteps,validCalls:clone(measured.calls)};
  const account={readings:[],offers:Array.from({length:128},(_,i)=>({id:'offer-'+i,channel:'retained',minute:360,uncertaintyLiters:0,basis:'Explicit authored offer'}))};
  const courses=Array.from({length:128},(_,i)=>({row:{hypothesis:{id:'p-'+i},calibration:{compatible:true}},get offers(){throw Error('Partial ranking must not inspect a course');}}));
  const q=chooseReceivingAccountQuestion(account,courses);assert.equal(q.status,'unsupported');assert.equal(q.requiredPairComparisons,1040384);assert.equal(q.best,null);assert.deepEqual(q.offers,[]);
});

group('unfamiliar 162-course grid reports eligible coverage, surviving ambiguity and explicit empty-boundary gain',()=>{
  const grid=postDryGridInputs(),eligible=grid.filter(c=>c.eligible),records=[];
  assert.equal(grid.length,162);assert.equal(eligible.length,53);
  let recovered=0,withoutEmpty=0,forwardModels=0,maximumRateIterations=0,worstRelativeError=0,oneSurvivor=0,severalSurvivors=0;
  for(const course of eligible){
    const r=run(course),survivors=r.candidates.filter(c=>c.calibration.compatible&&c.challenge.compatible),matches=survivors.filter(c=>matchesTruth(c,course.truth));
    const baseline=matches.some(c=>c.originalTrials.some(t=>t.branch!=='post-dry-initially-empty-boundary'));
    if(matches.length)recovered++;if(baseline)withoutEmpty++;
    assert.ok(matches.length,JSON.stringify({truth:course.truth,weather:course.project.weather,status:r.status,refused:r.refusedTrials}));
    const best=matches.reduce((best,c)=>Math.max(...['capacityMm','initialStoredMm','drainagePerHour'].map(key=>relativeError(c.hypothesis[key],course.truth[key])))<Math.max(...['capacityMm','initialStoredMm','drainagePerHour'].map(key=>relativeError(best.hypothesis[key],course.truth[key])))?c:best);
    worstRelativeError=Math.max(worstRelativeError,...['capacityMm','initialStoredMm','drainagePerHour'].map(key=>relativeError(best.hypothesis[key],course.truth[key])));
    if(!baseline){assert.equal(course.truth.initialStoredMm,0);assert.ok(r.refusedTrials.some(t=>t.reason==='post-dry-derived-initial-water-outside-domain'));}
    forwardModels+=r.candidates.length;
    for(const c of r.candidates)for(const t of c.originalTrials)maximumRateIterations=Math.max(maximumRateIterations,t.drainageRateIterations??0);
    if(r.status==='one-surviving-proposal')oneSurvivor++;if(r.status==='several-surviving-proposals')severalSurvivors++;
    records.push({weather:course.project.weather,truth:course.truth,status:r.status,candidates:r.candidates.length,survivorCount:survivors.length,recovered:true,withoutExplicitEmptyBoundary:baseline,matchingProposals:matches.map(c=>c.hypothesis),centralRefusals:r.refusedTrials.filter(t=>t.reason==='post-dry-derived-initial-water-outside-domain')});
  }
  assert.equal(recovered,53);assert.equal(withoutEmpty,44);assert.ok(maximumRateIterations<=128);
  proof.grid={total:grid.length,eligible:eligible.length,excluded:grid.filter(c=>!c.eligible).map(c=>({weather:c.project.weather,truth:c.truth,reasons:c.reasons})),recovered,withoutExplicitEmptyBoundary:withoutEmpty,forwardModels,maximumRateIterations,worstRelativeError,oneSurvivor,severalSurvivors,records,limits:'Independent selection from the maintained forward regime; truth recovery within tolerance does not mean unique identification. The no-empty comparison omits only separately enumerated empty-boundary proposals, retaining central trials where exactly duplicated.'};
});

test('receipt contains every executed group and exact sources',()=>{
  assert.equal(proof.checks.length,expectedGroups);proof.passed=true;proof.sourceHashes={};
  for(const path of ['receiving-account-inverse.js','post-dry-receiving-inverse.js','receiving-account-proposals.js','receiving-account-evidence.js','receiving-account-proposals-panel.js','receiving-account-panel.js','draining-infiltration.js','draining-layer-evidence.js','core.js','tests/receiving-inverse-fixtures.mjs','tests/receiving-account-proposals.test.mjs'])proof.sourceHashes[path]=createHash('sha256').update(readFileSync(new URL('../'+path,import.meta.url))).digest('hex');
  if(process.env.RECEIVING_INVERSE_RECEIPT)writeFileSync(process.env.RECEIVING_INVERSE_RECEIPT,JSON.stringify(proof,null,2)+'\n');
});

