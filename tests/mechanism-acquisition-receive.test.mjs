import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {receiveMechanismAcquisition as receive} from '../mechanism-acquisition-receive.js';
import {planMechanismAcquisition as plan,estimateMechanismAcquisitionWork} from '../mechanism-acquisition.js';
import {planMechanismAcquisitionCollections as collections} from '../mechanism-acquisition-collections.js';
import {importMechanismProposal} from '../rain-mechanism-proposal.js';
const read=n=>readFile(new URL('../examples/'+n,import.meta.url),'utf8');
const original=await read('mechanism-collection-original.json'),menu=await read('mechanism-collection-menu.json'),choices=await read('mechanism-collection-choices.json');
const fixtures=Object.fromEntries(await Promise.all(['meet','miss','wide','challenged'].map(async n=>[n,JSON.parse(await read('mechanism-acquisition-receipt-'+n+'.json'))])));
const clone=structuredClone,sha=x=>createHash('sha256').update(x).digest('hex');
const bind=(r,o=original,m=menu,c=choices)=>({...clone(r),inputs:{originalProposalSha256:sha(o),acquisitionMenuSha256:sha(m),acquisitionCollectionsSha256:c===null?null:sha(c)}});
const invoke=r=>receive(original,menu,r,choices);
const depth=r=>r.readings.find(x=>x.optionId==='depth60').reading;
const rain=r=>r.readings.find(x=>x.optionId==='rain10to30').reading;

test('matched receipts retain20 calibration rows and separate whole-family from survivor outcome',()=>{
 const expected={meet:[[1,4,7],'all-uncontradicted-meet'],miss:[[11,14,17],'all-uncontradicted-miss'],wide:[[1,4,7,11,14,17],'unresolved'],challenged:[[],'family-challenged']};
 const forecast=collections(original,JSON.parse(menu),JSON.parse(choices));
 for(const [name,[indices,status]] of Object.entries(expected)){
  const frozen=JSON.stringify(fixtures[name]),r=invoke(fixtures[name]),p=r.report.receivedProposal;
  assert.deepEqual(r.report.forecast,forecast);assert.equal(p.rows.length,20);assert.equal(p.meetingCount,6);assert.equal(p.targetStatus,'conditional');assert.deepEqual(r.report.receivedOutcome.survivingIndices,indices);assert.equal(r.report.receivedOutcome.status,status);assert.equal(r.report.baselineOutcome.survivingCount,20);
  const stable=rows=>rows.map(x=>({metrics:x.metrics,meets:x.meets,guard:x.guard,calibration:x.candidate.calibration}));assert.deepEqual(stable(p.rows),stable(forecast.singleReadoutReport.proposal.rows));assert.deepEqual(importMechanismProposal(r.receivedOriginalText).result,p);assert.equal(JSON.stringify(fixtures[name]),frozen);
 }
});
test('actual uncertainty remains wider than plan and gauge units are retained',()=>{
 const r=invoke(fixtures.wide),p=r.report.precision.find(x=>x.optionId==='rain10to30');assert.equal(p.plannedUncertaintyMm,1);assert.equal(p.actualUncertaintyMm,2);assert.equal(p.exceedsPlanned,true);assert.equal(JSON.parse(r.receivedOriginalText).source.gauge.readings.at(-1).uncertainty,2);
 const cm=clone(fixtures.meet);Object.assign(rain(cm),{unit:'cm',depth:1,uncertainty:.1});const c=invoke(cm);assert.deepEqual(c.report.receivedOutcome.survivingIndices,[1,4,7]);assert.equal(JSON.parse(c.receivedOriginalText).source.gauge.readings.at(-1).unit,'cm');
});
test('exact source identities and selected coordinates bind receiving',()=>{
 assert.throws(()=>receive(original+' ',menu,fixtures.meet,choices));assert.throws(()=>receive(original,menu+' ',fixtures.meet,choices));assert.throws(()=>receive(original,menu,fixtures.meet,choices+' '));
 for(const mutate of [r=>{depth(r).cellIndex=3;},r=>{depth(r).scenario='proposal';},r=>{depth(r).minute=59;},r=>{rain(r).startMinute=11;},r=>{r.eventRef='different';},r=>{r.choice.id='unknown';}]){const r=clone(fixtures.meet);mutate(r);assert.throws(()=>invoke(r));}
});
test('exact membership, challenge-only roles and non-reuse; input order immaterial',()=>{
 for(const mutate of [r=>{r.readings.pop();},r=>{r.readings.push(clone(r.readings[0]));},r=>{r.readings[0].optionId='extra';},r=>{depth(r).use='calibration';},r=>{rain(r).use='calibration';},r=>{rain(r).id='early-broad';}]){const r=clone(fixtures.meet);mutate(r);assert.throws(()=>invoke(r));}
 const reverse=clone(fixtures.meet);reverse.readings.reverse();assert.deepEqual(invoke(reverse),invoke(fixtures.meet));
});
test('single readout can be received without a separating forecast or collection declaration',()=>{
 const r=bind(fixtures.meet,original,menu,null);r.choice={kind:'single',id:'depth60'};r.readings=r.readings.filter(x=>x.optionId==='depth60');const out=receive(original,menu,r);assert.deepEqual(out.report.forecast,plan(original,JSON.parse(menu)));assert.deepEqual(out.report.selectedChoice,{kind:'single',id:'depth60',optionIds:['depth60']});assert.equal(out.report.receivedRecords.length,1);assert.equal(out.report.receivedProposal.rows.length,20);
});
test('prior contradictions persist and no calibration family differs from all challenged',()=>{
 const a=JSON.parse(original);a.source.project.observations.push({scenario:'existing',use:'challenge',cellIndex:2,minute:0,depthMm:999,uncertaintyMm:0,source:'Authored preexisting contradiction'});let text=JSON.stringify(a),out=receive(text,menu,bind(fixtures.meet,text),choices);assert.equal(out.report.baselineOutcome.status,'family-challenged');assert.equal(out.report.receivedOutcome.status,'family-challenged');assert.deepEqual(out.report.newlyContradictedCandidateIndices,[]);
 const b=JSON.parse(original);b.source.project.observations[0].depthMm=999;text=JSON.stringify(b);out=receive(text,menu,bind(fixtures.meet,text),choices);assert.equal(out.report.baselineOutcome.status,'no-calibration-compatible-explanations');assert.equal(out.report.receivedOutcome.status,'no-calibration-compatible-explanations');assert.equal(out.report.receivedProposal.rows.length,0);
});
test('late receipt retained as late; receiving before measurement completion refused',()=>{
 const late=clone(fixtures.meet);late.receivedMinute=90;assert.deepEqual(invoke(late).report.receiptTiming,{receivedMinute:90,decisionMinute:60,receivedByDecision:false});const early=clone(fixtures.meet);early.receivedMinute=59;assert.throws(()=>invoke(early));
});
test('replay is deterministic and reopened originals cannot reuse prospective readings',()=>{
 const first=invoke(fixtures.meet);assert.deepEqual(invoke(fixtures.meet),first);const a=JSON.parse(original),b=JSON.parse(first.receivedOriginalText);assert.deepEqual(b.source.project.observations.slice(0,a.source.project.observations.length),a.source.project.observations);assert.deepEqual(b.source.gauge.readings.slice(0,a.source.gauge.readings.length),a.source.gauge.readings);assert.equal(b.source.project.observations.length,a.source.project.observations.length+1);assert.equal(b.source.gauge.readings.length,a.source.gauge.readings.length+1);
 const reopened=plan(first.receivedOriginalText,JSON.parse(menu));assert.ok(reopened.options.every(x=>x.status==='excluded'));assert.throws(()=>receive(first.receivedOriginalText,menu,bind(fixtures.meet,first.receivedOriginalText),choices));
});
test('valid per-pass work fits but aggregate forecast plus receipt is over budget',()=>{
 const a=JSON.parse(original),p=a.source.project;p.width=p.height=4;p.existing=Array.from({length:16},()=>clone(p.existing[0]));p.proposal=Array.from({length:16},(_,i)=>clone(p.proposal[i%4]));p.weather.durationMinutes=480;p.weather.stepMinutes=1;a.source.request.ratesMmHr=Array.from({length:9},(_,i)=>10+5*i);const text=JSON.stringify(a),work=estimateMechanismAcquisitionWork(text,JSON.parse(menu));assert.equal(work.reservedCellSteps,1720320);assert.ok(3*56*16*480<3000000);assert.throws(()=>receive(text,menu,bind(fixtures.meet,text),choices),/budget|work|limit/i);
});
test('actual CLI exclusive output, reopen, unchanged inputs and empty refusal stdout',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'earth-receipt-'));t.after(()=>rm(dir,{recursive:true,force:true}));const paths=['original','menu','receipt','output','choices'].map(n=>join(dir,n+'.json')),texts=[original,menu,JSON.stringify(fixtures.meet),null,choices];await Promise.all(texts.map((v,i)=>v===null?null:writeFile(paths[i],v,{flag:'wx'})));
 const env={...process.env};delete env.NODE_OPTIONS;delete env.NODE_PATH;const run=()=>spawnSync(process.execPath,['--max-old-space-size=128',fileURLToPath(new URL('../receive-mechanism-acquisition.mjs',import.meta.url)),...paths],{encoding:'utf8',env,timeout:5000,maxBuffer:8*1024*1024});
 const ok=run();assert.equal(ok.error,undefined);assert.equal(ok.signal,null);assert.equal(ok.status,0,ok.stderr);assert.equal(ok.stderr,'');const report=JSON.parse(ok.stdout),written=await readFile(paths[3]);assert.equal(report.outputOriginal.sha256,sha(written));assert.equal(report.outputOriginal.bytes,written.length);assert.deepEqual(importMechanismProposal(written.toString()).result,report.report.receivedProposal);assert.deepEqual(report.report,invoke(fixtures.meet).report);
 for(const [i,text] of texts.entries())if(text!==null)assert.equal(await readFile(paths[i],'utf8'),text);
 const refused=run();assert.equal(refused.error,undefined);assert.equal(refused.status,1);assert.equal(refused.stdout,'');assert.match(refused.stderr,/RECEIVE REFUSAL/);assert.deepEqual(await readFile(paths[3]),written);
});
