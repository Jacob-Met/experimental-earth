import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {receiveMechanismConditionalAcquisition as receive} from '../mechanism-acquisition-conditional-receive.js';
import {receiveMechanismAcquisition as originalReceive} from '../mechanism-acquisition-receive.js';
import {importMechanismProposal} from '../rain-mechanism-proposal.js';
import {estimateMechanismAcquisitionWork} from '../mechanism-acquisition.js';
import {prepareMechanismConditionalAcquisition} from '../mechanism-acquisition-conditional.js';
import {estimateMechanismAcquisitionReceiptWork} from '../mechanism-acquisition-receive.js';
const read=n=>readFile(new URL('../examples/'+n,import.meta.url),'utf8');
const original=await read('mechanism-collection-original.json'),menu=await read('mechanism-collection-menu.json'),collections=await read('mechanism-collection-choices.json'),sequences=await read('mechanism-conditional-sequences.json');
const template=JSON.parse(await read('mechanism-acquisition-receipt-meet.json')),clone=structuredClone,sha=x=>createHash('sha256').update(x).digest('hex');
function receipt(y=13,u=1,t=30,o=original,m=menu,c=collections,s=sequences){
 const first=clone(template);first.choice={kind:'single',id:'rain10to30'};first.receivedMinute=t;first.readings=first.readings.filter(x=>x.optionId==='rain10to30');Object.assign(first.readings[0].reading,{id:'authored-first-control',depth:y,uncertainty:u});first.inputs={originalProposalSha256:sha(o),acquisitionMenuSha256:sha(m),acquisitionCollectionsSha256:sha(c)};
 return {schema:'experimental-earth-mechanism-conditional-acquisition-receipt/1',conditionalSequencesSha256:sha(s),sequenceId:JSON.parse(s).sequences[0].id,firstReceipt:first};
}
const run=(r,o=original,m=menu,c=collections,s=sequences)=>receive(o,m,r,c,s);
const high=[9,10,11,12,13,14,15,16,17,19],low=[0,1,2,3,4,5,6,7,8,18],all=Array.from({length:20},(_,i)=>i);

test('seven unchanged-receiver controls yield actual actions distinct from planned scalar lookup',()=>{
 const cases=[[13,1,30,high,'stop-miss',0,0],[13,4,30,all,'continuation-unresolved',84,9],[10,1,56,low,'not-ready-by-deadline',24,0],[10,1,55,low,'take-second',24,0],[35/3,2,30,all,'continuation-unresolved',84,9],[100,1,30,[],'family-challenged',0,0],[13,1,61,high,'not-ready-by-deadline',0,0]];
 for(const [y,u,t,indices,action,pairs,unresolved] of cases){
  const input=receipt(y,u,t),before=JSON.stringify(input),out=run(input),r=out.report,old=originalReceive(original,menu,input.firstReceipt,collections);
  assert.deepEqual(r.receiptReport,old.report);assert.equal(out.receivedOriginalText,old.receivedOriginalText);assert.deepEqual(r.receiptReport.receivedOutcome.survivingIndices,indices);assert.equal(r.receiptReport.receivedProposal.rows.length,20);assert.equal(r.receiptReport.receivedProposal.meetingCount,6);assert.equal(r.receiptReport.receivedProposal.targetStatus,'conditional');assert.equal(r.actualDecision.action,action);assert.equal(r.actualDecision.timing.decisionReadyMinute,t+5);
  if(pairs){assert.equal(r.actualDecision.secondSeparation.oppositePairIndices.length,pairs);assert.equal(r.actualDecision.secondSeparation.unresolvedPairIndices.length,unresolved);const global=r.receiptReport.forecast.singleReadoutReport.crossTargetPairs;assert.deepEqual(r.actualDecision.secondSeparation.oppositePairIndices,global.flatMap(([a,b],i)=>indices.includes(a)&&indices.includes(b)?[i]:[]));}
  else assert.equal(r.actualDecision.secondSeparation,null);
  if(y===13)assert.equal(r.plannedPolicy.action,'stop-miss');if(y===35/3)assert.equal(r.plannedPolicy.action,'outside-family');assert.equal(JSON.stringify(input),before);
 }
});

test('response delay applies to stopping too; equality is timely and late evidence remains',()=>{
 const ready=run(receipt(13,1,55)).report,late=run(receipt(13,1,56)).report;assert.equal(ready.actualDecision.action,'stop-miss');assert.equal(ready.actualDecision.timing.readyByDecision,true);assert.equal(late.actualDecision.action,'not-ready-by-deadline');assert.equal(late.actualDecision.timing.receivedByDecision,true);assert.equal(late.actualDecision.timing.readyByDecision,false);assert.equal(late.actualDecision.outcome,'all-uncontradicted-miss');assert.deepEqual(late.receiptReport.receivedOutcome.survivingIndices,high);
});

test('actual units and precision retained; original explanations and prior contradictions remain',()=>{
 const cm=receipt();Object.assign(cm.firstReceipt.readings[0].reading,{unit:'cm',depth:1.3,uncertainty:.1});const result=run(cm);assert.equal(result.report.actualDecision.action,'stop-miss');assert.equal(result.report.plannedPolicy.firstValueMm,13);assert.equal(JSON.parse(result.receivedOriginalText).source.gauge.readings.at(-1).unit,'cm');assert.equal(run(receipt(13,4)).report.receiptReport.precision[0].exceedsPlanned,true);
 const a=JSON.parse(original);a.source.project.observations.push({scenario:'existing',use:'challenge',cellIndex:3,minute:0,depthMm:999,uncertaintyMm:0,source:'Authored prior contradiction'});const text=JSON.stringify(a),r=run(receipt(13,1,30,text),text).report;assert.equal(r.actualDecision.action,'family-challenged');assert.equal(r.receiptReport.baselineOutcome.status,'family-challenged');assert.deepEqual(r.receiptReport.newlyContradictedCandidateIndices,[]);assert.equal(r.receiptReport.receivedProposal.rows.length,20);
});

test('exact source and sequence bindings, selected first choice and no cached intake',()=>{
 const r=receipt();for(const args of [[original+' ',menu,r,collections,sequences],[original,menu+' ',r,collections,sequences],[original,menu,r,collections+' ',sequences],[original,menu,r,collections,sequences+' ']])assert.throws(()=>receive(...args));
 for(const mutate of [x=>{x.sequenceId='unknown';},x=>{x.firstReceipt.choice.id='depth60';},x=>{x.firstReceipt.choice.kind='collection';x.firstReceipt.choice.id='rain-then-depth';},x=>{x.firstReceipt.readings[0].reading.startMinute=11;},x=>{x.report={};}]){const x=receipt();mutate(x);assert.throws(()=>run(x));}
 const s=JSON.parse(sequences);s.sequences[0].minimumDecisionMinutes=31;const text=JSON.stringify(s);assert.throws(()=>run(receipt(13,1,30,original,menu,collections,text),original,menu,collections,text));
});

test('no compatible family and unanimous original have no manufactured forecast success',()=>{
 for(const empty of [true,false]){const a=JSON.parse(original);if(empty)a.source.project.observations[0].depthMm=999;else a.goal.maximum=1e6;const text=JSON.stringify(a),r=run(receipt(13,1,30,text),text).report;assert.equal(r.plannedPolicy.status,'not-needed');assert.equal(r.plannedPolicy.regionIndex,null);assert.equal(r.plannedPolicy.action,null);assert.equal(r.actualDecision.action,empty?'no-compatible-explanations':'stop-meet');assert.equal(r.actualDecision.secondSeparation,null);}
});

test('complete offered sequence work rejects before partial selection',()=>{
 const s=JSON.parse(sequences);s.sequences=Array.from({length:3},(_,i)=>({...clone(s.sequences[0]),id:'authored-response-'+i,minimumDecisionMinutes:i}));const text=JSON.stringify(s);assert.doesNotThrow(()=>estimateMechanismAcquisitionWork(original,JSON.parse(menu)));assert.throws(()=>run(receipt(13,1,30,original,menu,collections,text),original,menu,collections,text),/budget|work|limit/i);
});

test('individually admitted conditional and receipt courses exceed combined admission',()=>{
 const m=JSON.parse(menu),c=JSON.parse(collections),s=JSON.parse(sequences);
 for(let i=2;i<11;i++)m.options.push({...clone(m.options[0]),id:'authored-extra-'+i});
 const first=c.collections[0];c.collections=[];
 for(let i=0;i<11;i++)for(let j=i+1;j<11;j++)if(c.collections.length<42)c.collections.push({...clone(first),id:c.collections.length===0?first.id:'pair-'+i+'-'+j,optionIds:[m.options[i].id,m.options[j].id]});
 s.sequences=[s.sequences[0],{...clone(s.sequences[0]),id:'second-response',minimumDecisionMinutes:6}];
 const mt=JSON.stringify(m),ct=JSON.stringify(c),st=JSON.stringify(s),r=receipt(13,1,30,original,mt,ct,st);
 // This fixture was independently admitted by the two no-inference estimators
 // before consumer execution. Neither constituent exceeds its own limits.
 const prepared=prepareMechanismConditionalAcquisition(original,m,c,s),estimated=estimateMechanismAcquisitionReceiptWork(original,mt,r.firstReceipt,ct);
 assert.equal(prepared.work.combinedPolicyWork,99126);assert.ok(prepared.work.combinedOutputItems<150000);assert.ok(estimated.combinedCellSteps<3000000);assert.ok(estimated.combinedOutputItems<150000);
 assert.throws(()=>run(r,original,mt,ct,st),/budget|work|limit/i);
});

test('actual six-argument CLI saves exclusive original, verifies hashes and refuses without output',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'earth-first-receipt-'));t.after(()=>rm(dir,{recursive:true,force:true}));const paths=['original','menu','receipt','output','collections','sequences'].map(n=>join(dir,n+'.json')),texts=[original,menu,JSON.stringify(receipt()),null,collections,sequences];await Promise.all(paths.map((p,i)=>texts[i]===null?null:writeFile(p,texts[i],{flag:'wx'})));const env={...process.env};delete env.NODE_OPTIONS;delete env.NODE_PATH;
 const invoke=p=>spawnSync(process.execPath,['--max-old-space-size=128',fileURLToPath(new URL('../receive-mechanism-acquisition.mjs',import.meta.url)),...p],{encoding:'utf8',env,timeout:5000,maxBuffer:12*1024*1024});const ok=invoke(paths);assert.equal(ok.error,undefined);assert.equal(ok.signal,null);assert.equal(ok.status,0,ok.stderr);assert.equal(ok.stderr,'');const out=JSON.parse(ok.stdout),written=await readFile(paths[3]);assert.equal(out.inputs.conditionalSequences.sha256,sha(sequences));assert.equal(out.outputOriginal.sha256,sha(written));assert.equal(out.outputOriginal.bytes,written.length);assert.deepEqual(out.report,run(receipt()).report);assert.deepEqual(importMechanismProposal(written.toString()).result,out.report.receiptReport.receivedProposal);
 for(let i=0;i<paths.length;i++)if(texts[i]!==null)assert.equal(await readFile(paths[i],'utf8'),texts[i]);const exists=invoke(paths);assert.equal(exists.status,1);assert.equal(exists.stdout,'');assert.deepEqual(await readFile(paths[3]),written);
 const bad=receipt();bad.conditionalSequencesSha256='0'.repeat(64);await writeFile(paths[2],JSON.stringify(bad));const fresh=[...paths];fresh[3]=join(dir,'refused-output.json');const no=invoke(fresh);assert.equal(no.error,undefined);assert.equal(no.status,1);assert.equal(no.stdout,'');assert.ok(no.stderr.length>0);await assert.rejects(()=>access(fresh[3]));
});
