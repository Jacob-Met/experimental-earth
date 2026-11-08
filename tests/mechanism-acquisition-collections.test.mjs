import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {planMechanismAcquisition as single,estimateMechanismAcquisitionWork} from '../mechanism-acquisition.js';
import {planMechanismAcquisitionCollections as plan} from '../mechanism-acquisition-collections.js';
const read=async n=>readFile(new URL('../examples/'+n,import.meta.url),'utf8');
const original=await read('mechanism-collection-original.json'),menu=JSON.parse(await read('mechanism-collection-menu.json')),choices=JSON.parse(await read('mechanism-collection-choices.json'));
const clone=structuredClone,sha=x=>createHash('sha256').update(x).digest('hex');
const pair=(ids,id='pair')=>({id,optionIds:ids,jointAvailabilityBasis:'Authored simultaneous availability declaration; not verified access or independent error.'});
const collectionMenu=(m,cs)=>({schema:choices.schema,eventRef:m.eventRef,collections:cs});

test('causal full family: neither single resolves; explicit mixed pair resolves every original pair',()=>{
 const frozen=JSON.stringify([menu,choices]),r=plan(original,menu,choices),v1=single(original,menu);
 assert.deepEqual(r.singleReadoutReport,v1);assert.equal(v1.proposal.rows.length,20);assert.equal(v1.proposal.meetingCount,6);assert.equal(v1.crossTargetPairs.length,84);
 assert.deepEqual(v1.options.map(o=>o.separatedPairIndices.length),[75,60]);assert.deepEqual(v1.decisionSeparatingOptionIds,[]);
 assert.deepEqual(r.collections[0].separatedPairIndices,Array.from({length:84},(_,i)=>i));assert.deepEqual(r.collections[0].unresolvedPairIndices,[]);assert.equal(r.collections[0].allPairsSeparated,true);
 assert.deepEqual(r.decisionSeparatingCollectionIds,['rain-then-depth']);assert.equal(r.minimumOfferedReadoutCount,2);assert.deepEqual(r.minimumOfferedChoices,[{kind:'collection',id:'rain-then-depth',optionIds:['rain10to30','depth60']}]);assert.equal(JSON.stringify([menu,choices]),frozen);
});

test('shared unresolved pairs persist; closed touching bands cannot become joint success',()=>{
 const m=clone(menu);m.options.push({...m.options[0],id:'second-depth'});const r=plan(original,m,collectionMenu(m,[pair(['depth60','second-depth'])]));
 assert.deepEqual(r.collections[0].unresolvedPairIndices,r.singleReadoutReport.options[0].unresolvedPairIndices);assert.equal(r.collections[0].allPairsSeparated,false);assert.equal(r.minimumOfferedReadoutCount,null);
 // The depth readout is noninformative; gauge bands at30/3 and40/3 touch
 // at their midpoint before the conservative numerical expansion.
 const wide=clone(menu);wide.options[0].uncertaintyMm=1000;wide.options[1].uncertaintyMm=5/3;
 const t=plan(original,wide,choices);assert.equal(t.collections[0].allPairsSeparated,false);assert.ok(t.collections[0].unresolvedPairIndices.length>0);
});

test('singleton-first summary preserves offered pair and original-order singleton ties',async()=>{
 const text=await read('mechanism-acquisition-original.json'),m=JSON.parse(await read('mechanism-acquisition-menu.json'));
 const r=plan(text,m,collectionMenu(m,[pair(['depth-90','separate-existing-logger'])]));
 assert.equal(r.minimumOfferedReadoutCount,1);assert.deepEqual(r.minimumOfferedChoices,[{kind:'single',id:'depth-90',optionIds:['depth-90']},{kind:'single',id:'separate-existing-logger',optionIds:['separate-existing-logger']}]);assert.equal(r.collections.length,1);assert.equal(r.collections[0].allPairsSeparated,true);
});

test('infeasible member excludes whole collection; unknown, duplicate or undeclared collections refuse',()=>{
 const m=clone(menu);m.options[0].availableMinute=61;const r=plan(original,m,choices);assert.equal(r.collections[0].status,'excluded');assert.ok(r.collections[0].exclusionReasons.length);assert.deepEqual(r.decisionSeparatingCollectionIds,[]);assert.equal(r.minimumOfferedReadoutCount,null);
 for(const mutate of [c=>{c.collections[0].optionIds[0]='unknown';},c=>{c.collections[0].optionIds=['depth60','depth60'];},c=>{c.collections[0].jointAvailabilityBasis='';},c=>{delete c.collections[0].jointAvailabilityBasis;},c=>{c.collections.push({...c.collections[0],id:'reverse',optionIds:[...c.collections[0].optionIds].reverse()});},c=>{c.collections[0].id='depth60';}]){const c=clone(choices);mutate(c);assert.throws(()=>plan(original,menu,c));}
});

test('held-aside changes do not score collections; empty and unanimous remain not-needed',()=>{
 const a=JSON.parse(original);a.source.project.observations.push({scenario:'existing',use:'challenge',cellIndex:3,minute:0,depthMm:0,uncertaintyMm:0,source:'Authored held-aside control'});const b=clone(a);b.source.project.observations.at(-1).depthMm=999;
 const x=plan(JSON.stringify(a),menu,choices),y=plan(JSON.stringify(b),menu,choices);assert.deepEqual(x.collections,y.collections);assert.deepEqual(x.minimumOfferedChoices,y.minimumOfferedChoices);assert.equal(y.status,'evidence-challenged');assert.equal(y.singleReadoutReport.proposal.rows.length,20);
 for(const empty of [false,true]){const z=JSON.parse(original);if(empty)z.source.project.observations[0].depthMm=999;else z.goal.maximum=1e6;const r=plan(JSON.stringify(z),menu,choices);assert.equal(r.minimumOfferedReadoutCount,null);assert.deepEqual(r.minimumOfferedChoices,[]);assert.deepEqual(r.decisionSeparatingCollectionIds,[]);assert.equal(r.collections[0].status,'not-needed');}
});

test('legitimate bounded offers pass v1 reservation but complete combined pair work refuses',()=>{
 const a=JSON.parse(original);a.source.request.ratesMmHr=Array.from({length:9},(_,i)=>10+i*5);
 const m=clone(menu);for(let i=2;i<9;i++)m.options.push({...m.options[0],id:'authored-depth-'+i});
 const c=collectionMenu(m,[]);for(let i=0;i<9;i++)for(let j=i+1;j<9;j++)if(c.collections.length<32)c.collections.push(pair([m.options[i].id,m.options[j].id],'pair-'+i+'-'+j));
 assert.doesNotThrow(()=>estimateMechanismAcquisitionWork(JSON.stringify(a),m));assert.throws(()=>plan(JSON.stringify(a),m,c),/budget|limit|work/i);
});

test('actual optional-three-file CLI preserves hashes, two-file v1 compatibility, and refusal originals',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'earth-collections-'));t.after(()=>rm(dir,{recursive:true,force:true}));const a=join(dir,'original.json'),b=join(dir,'menu.json'),c=join(dir,'collections.json'),mt=JSON.stringify(menu),ct=JSON.stringify(choices);
 await Promise.all([writeFile(a,original,{flag:'wx'}),writeFile(b,mt,{flag:'wx'}),writeFile(c,ct,{flag:'wx'})]);const env={...process.env};delete env.NODE_OPTIONS;delete env.NODE_PATH;
 const run=paths=>spawnSync(process.execPath,['--max-old-space-size=128',fileURLToPath(new URL('../plan-mechanism-acquisition.mjs',import.meta.url)),...paths],{encoding:'utf8',env,timeout:5000,maxBuffer:4*1024*1024});
 for(const paths of [[a,b],[a,b,c]]){const p=run(paths);assert.equal(p.error,undefined);assert.equal(p.signal,null);assert.equal(p.status,0,p.stderr);assert.equal(p.stderr,'');const r=JSON.parse(p.stdout);assert.deepEqual(r.report,paths.length===2?single(original,menu):plan(original,menu,choices));assert.equal(r.inputs.originalProposal.sha256,sha(original));assert.equal(r.inputs.acquisitionMenu.sha256,sha(mt));if(paths.length===3)assert.equal(r.inputs.acquisitionCollections.sha256,sha(ct));else assert.equal(r.inputs.acquisitionCollections,undefined);}
 assert.equal(await readFile(c,'utf8'),ct);const bad=clone(choices);bad.collections[0].jointAvailabilityBasis='';const bt=JSON.stringify(bad);await writeFile(c,bt);const p=run([a,b,c]);assert.equal(p.error,undefined);assert.equal(p.status,1);assert.equal(p.stdout,'');assert.ok(p.stderr.length>0);assert.equal(await readFile(a,'utf8'),original);assert.equal(await readFile(b,'utf8'),mt);assert.equal(await readFile(c,'utf8'),bt);
});
