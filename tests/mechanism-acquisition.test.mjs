import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {planMechanismAcquisition as plan,classifyDecisionBands as bands} from '../mechanism-acquisition.js';
import {importMechanismProposal} from '../rain-mechanism-proposal.js';
const original=await readFile(new URL('../examples/mechanism-acquisition-original.json',import.meta.url),'utf8');
const menu=JSON.parse(await readFile(new URL('../examples/mechanism-acquisition-menu.json',import.meta.url),'utf8'));
const clone=x=>structuredClone(x), sha=x=>createHash('sha256').update(x).digest('hex');
const option=(r,id)=>r.options.find(o=>o.offer.id===id);
const closed=(lo,hi)=>({lowerMm:lo,upperMm:hi});

test('closed-band oracle: all cross-target pairs, touching, unequal width, same-label ambiguity',()=>{
 assert.deepEqual(bands([true,true,false],[closed(0,1),closed(99,101),closed(99,101)]),{crossTargetPairs:[[0,2],[1,2]],separatedPairIndices:[0],unresolvedPairIndices:[1],allPairsSeparated:false});
 assert.equal(bands([true,false],[closed(0,1),closed(1,5)]).allPairsSeparated,false);
 assert.equal(bands([true,false],[closed(0,1),closed(2,6)]).allPairsSeparated,true);
 assert.equal(bands([true,true,false],[closed(0,1),closed(0,1),closed(9,11)]).allPairsSeparated,true);
 assert.equal(bands([],[]).allPairsSeparated,false);
 assert.equal(bands([true,true],[closed(0,1),closed(9,11)]).allPairsSeparated,false);
 for(const b of [closed(2,1),closed(0,Infinity),closed(-1,1)])assert.throws(()=>bands([true],[b]));
});

test('complete maintained family and target preserved; analytic depth and gauge decisions',()=>{
 const before=JSON.stringify(menu),r=plan(original,menu),maintained=importMechanismProposal(original).result;
 assert.deepEqual(r.proposal,maintained);assert.equal(r.proposal.rows.length,7);assert.equal(r.proposal.meetingCount,4);assert.equal(r.crossTargetPairs.length,12);
 assert.deepEqual(r.options.map(o=>o.offer.id),menu.options.map(o=>o.id));
 assert.deepEqual(r.decisionSeparatingOptionIds,['depth-90','separate-existing-logger']);
 for(const [id,expected] of [['depth-75',[15,17.5]],['depth-90',[10,15]],['future-rain',[0]]]){
  const o=option(r,id);assert.deepEqual([...new Set(o.predictions.map(p=>p.predictedMm))].sort((a,b)=>a-b),expected);
  assert.equal(o.predictions.length,7);assert.equal(o.separatedPairIndices.length+o.unresolvedPairIndices.length,12);
  for(const p of o.predictions){assert.ok(p.numericalGuardMm>0);assert.ok(p.lowerMm<=Math.max(0,p.predictedMm-2));assert.ok(p.upperMm>=p.predictedMm+2);}
 }
 assert.equal(option(r,'depth-75').allPairsSeparated,false);assert.equal(option(r,'future-rain').allPairsSeparated,false);
 assert.equal(JSON.stringify(menu),before);
});

test('availability retains exclusions and cannot manufacture a past gauge',()=>{
 const r=plan(original,menu);
 for(const [id,reason] of [['cannot-install-in-past','prospective-measurement-starts-in-past'],['consumed-original','original-record-already-consumed'],['too-late','available-after-decision']]){
  const o=option(r,id);assert.equal(o.status,'excluded');assert.ok(o.exclusionReasons.includes(reason));assert.equal(o.predictions,undefined);
 }
 const m=clone(menu);m.planningMinute=59;assert.throws(()=>plan(original,m),/planning/i);
 const n=clone(menu);n.options[0].availableMinute=74;assert.ok(option(plan(original,n),'depth-75').exclusionReasons.includes('available-before-measurement'));
 const z=clone(menu);z.options[0].minute=91;z.options[0].availableMinute=91;assert.ok(option(plan(original,z),'depth-75').exclusionReasons.includes('outside-original-event-horizon'));
});

test('archived depth identity permits separate record at consumed coordinates but excludes original',()=>{
 const m=clone(menu),template={...m.options[5],kind:'depth',cellIndex:0,minute:60};delete template.startMinute;delete template.endMinute;
 m.options=[{...template,id:'same-original',recordRef:'depth:0'},{...template,id:'separate-depth',recordRef:'external:second-depth'}];
 const r=plan(original,m);assert.equal(option(r,'same-original').status,'excluded');assert.equal(option(r,'separate-depth').status,'unresolved');assert.equal(option(r,'separate-depth').predictions.length,7);
 const invalid=clone(m);invalid.options[1].depthMm=20;assert.throws(()=>plan(original,invalid));
 const future=clone(m);future.options[1].minute=75;future.options[1].availableMinute=75;assert.ok(option(plan(original,future),'separate-depth').exclusionReasons.includes('record-does-not-yet-exist'));
 const duplicate=clone(m);duplicate.options[0].recordRef=duplicate.options[1].recordRef;assert.throws(()=>plan(original,duplicate));
});

test('held-aside values change challenge labels but not family, pairs or menu decisions',()=>{
 const a=JSON.parse(original);a.source.project.observations.push({scenario:'existing',use:'challenge',cellIndex:3,minute:60,depthMm:20,uncertaintyMm:0,source:'Authored held-aside control'});
 const b=clone(a);b.source.project.observations.at(-1).depthMm=999;
 const x=plan(JSON.stringify(a),menu),y=plan(JSON.stringify(b),menu);
 assert.equal(x.proposal.rows.length,7);assert.equal(y.proposal.rows.length,7);assert.deepEqual(x.proposal.rows.map(r=>r.meets),y.proposal.rows.map(r=>r.meets));assert.deepEqual(x.crossTargetPairs,y.crossTargetPairs);assert.deepEqual(x.options,y.options);assert.deepEqual(x.decisionSeparatingOptionIds,y.decisionSeparatingOptionIds);
 assert.ok(x.proposal.unchallengedCount>0);assert.equal(y.proposal.unchallengedCount,0);assert.equal(y.status,'evidence-challenged');
});

test('empty and unanimous families are not acquisition successes',()=>{
 const a=JSON.parse(original);a.goal.maximum=1e6;const all=plan(JSON.stringify(a),menu);assert.equal(all.decisionStatus,'no-target-disagreement');assert.deepEqual(all.decisionSeparatingOptionIds,[]);assert.ok(all.options.filter(o=>o.status!=='excluded').every(o=>o.status==='not-needed'));
 const b=JSON.parse(original);b.source.project.observations[0].depthMm=999;const empty=plan(JSON.stringify(b),menu);assert.equal(empty.decisionStatus,'no-compatible-explanations');assert.equal(empty.proposal.rows.length,0);assert.deepEqual(empty.decisionSeparatingOptionIds,[]);
});

test('complete offered-family budget and malformed menus refuse rather than truncate',()=>{
 const a=JSON.parse(original);a.fronts=Array.from({length:600},(_,i)=>({conductivityMmHr:10,capillaryDriveMm:i,source:'Authored preflight budget control'}));assert.throws(()=>plan(JSON.stringify(a),menu),/budget/i);
 for(const change of [m=>{m.options[0].uncertaintyMm=Infinity;},m=>{m.eventRef='different-event';},m=>{m.options[0].id=m.options[1].id;},m=>{m.options[5].distinctRecordBasis='';}]){const m=clone(menu);change(m);assert.throws(()=>plan(original,m));}
});

test('actual CLI complete success and refusal preserve original bytes and SHA receipts',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'earth-acquisition-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const a=join(dir,'original.json'),b=join(dir,'menu.json'),text=JSON.stringify(menu)+'\n';await writeFile(a,original,{flag:'wx'});await writeFile(b,text,{flag:'wx'});
 const env={...process.env};delete env.NODE_OPTIONS;delete env.NODE_PATH;
 const run=()=>spawnSync(process.execPath,['--max-old-space-size=128',fileURLToPath(new URL('../plan-mechanism-acquisition.mjs',import.meta.url)),a,b],{encoding:'utf8',timeout:5000,maxBuffer:4*1024*1024,env});
 const ok=run();assert.equal(ok.error,undefined);assert.equal(ok.signal,null);assert.equal(ok.status,0,ok.stderr);assert.equal(ok.stderr,'');const result=JSON.parse(ok.stdout);
 assert.deepEqual(result.report,plan(original,menu));assert.equal(result.inputs.originalProposal.sha256,sha(original));assert.equal(result.inputs.acquisitionMenu.sha256,sha(text));assert.equal(await readFile(a,'utf8'),original);assert.equal(await readFile(b,'utf8'),text);
 const bad=clone(menu);bad.eventRef='different-event';const invalid=JSON.stringify(bad);await writeFile(b,invalid);const refused=run();assert.equal(refused.error,undefined);assert.equal(refused.signal,null);assert.equal(refused.status,1);assert.equal(refused.stdout,'');assert.match(refused.stderr,/REFUSAL/);assert.equal(await readFile(a,'utf8'),original);assert.equal(await readFile(b,'utf8'),invalid);
});
