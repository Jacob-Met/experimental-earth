import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {planMechanismConditionalAcquisition as plan,classifyConditionalDecisionBands as geometry} from '../mechanism-acquisition-conditional.js';
import {planMechanismAcquisitionCollections as collectionPlan,estimateMechanismAcquisitionCollectionsWork} from '../mechanism-acquisition-collections.js';
const read=n=>readFile(new URL('../examples/'+n,import.meta.url),'utf8');
const original=await read('mechanism-collection-original.json'),menuText=await read('mechanism-collection-menu.json'),collectionText=await read('mechanism-collection-choices.json'),sequenceText=await read('mechanism-conditional-sequences.json');
const menu=JSON.parse(menuText),collections=JSON.parse(collectionText),sequences=JSON.parse(sequenceText),clone=structuredClone;
const band=(lowerMm,upperMm)=>({lowerMm,upperMm}),at=(r,x)=>r.regions.find(z=>z.kind==='point'&&z.lowerMm===x),open=(r,a,b)=>r.regions.find(z=>z.kind==='open-interval'&&z.lowerMm===a&&z.upperMm===b);
const run=(o=original,m=menu,c=collections,s=sequences)=>plan(o,m,c,s);

test('exact authored ten-region policy preserves full original collection report and pair identities',()=>{
 const frozen=JSON.stringify([menu,collections,sequences]),r=run(),old=collectionPlan(original,menu,collections),s=r.sequences[0];assert.deepEqual(r.collectionReport,old);assert.equal(old.singleReadoutReport.proposal.rows.length,20);assert.equal(old.singleReadoutReport.proposal.meetingCount,6);assert.equal(s.regions.length,10);
 assert.deepEqual(s.summary,{consistentRegionCount:6,stopAfterFirstRegionCount:3,continueRegionCount:3,outsideFamilyRegionCount:4,decisionComplete:true,maximumReadoutCount:2});
 const low=[0,1,2,3,4,5,6,7,8,18],high=[9,10,11,12,13,14,15,16,17,19];
 for(const region of s.regions){
  if(region.action==='outside-family'){assert.deepEqual(region.compatibleCandidateIndices,[]);continue;}
  if(region.action==='stop-miss'){assert.deepEqual(region.compatibleCandidateIndices,high);assert.equal(region.meetingCount,0);assert.equal(region.missingCount,10);continue;}
  assert.equal(region.action,'take-second');assert.deepEqual(region.compatibleCandidateIndices,low);assert.equal(region.meetingCount,6);assert.equal(region.missingCount,4);assert.equal(region.oppositePairIndices.length,24);assert.deepEqual(region.secondSeparation.unresolvedPairIndices,[]);assert.deepEqual(region.secondSeparation.separatedPairIndices,region.oppositePairIndices);
  for(const i of region.oppositePairIndices)assert.ok(old.singleReadoutReport.crossTargetPairs[i].every(j=>low.includes(j)));
 }
 assert.equal(at(s,8.999999999999687).action,'take-second');assert.equal(at(s,11.000000000000313).action,'take-second');assert.equal(at(s,12.333333333332927).action,'stop-miss');assert.equal(at(s,14.33333333333374).action,'stop-miss');assert.equal(open(s,11.000000000000313,12.333333333332927).action,'outside-family');assert.equal(JSON.stringify([menu,collections,sequences]),frozen);
});

test('symbolic endpoint atoms, touching, zero-width, nested and adjacent-number intervals',()=>{
 const second=[band(0,1),band(3,4)];let g=geometry([true,false],[band(0,1),band(1,2)],second);assert.deepEqual(at(g,1).compatibleCandidateIndices,[0,1]);assert.equal(at(g,1).action,'take-second');assert.equal(open(g,0,1).action,'stop-meet');assert.equal(open(g,1,2).action,'stop-miss');
 g=geometry([true,false],[band(1,1),band(0,2)],second);assert.deepEqual(at(g,1).compatibleCandidateIndices,[0,1]);assert.deepEqual(open(g,0,1).compatibleCandidateIndices,[1]);assert.deepEqual(open(g,1,2).compatibleCandidateIndices,[1]);
 g=geometry([true,false],[band(0,3),band(1,2)],second);assert.deepEqual(open(g,1,2).compatibleCandidateIndices,[0,1]);assert.deepEqual(open(g,2,3).compatibleCandidateIndices,[0]);
 const b=1+Number.EPSILON;g=geometry([true,false],[band(1,b),band(b,2)],second);assert.deepEqual(open(g,1,b).compatibleCandidateIndices,[0]);assert.deepEqual(at(g,b).compatibleCandidateIndices,[0,1]);assert.equal(open(g,2,null).action,'outside-family');assert.throws(()=>geometry([],[],[]));
});

test('unresolved continuation and all-first-stop have distinct honest summaries',()=>{
 const g=geometry([true,false],[band(0,2),band(1,3)],[band(0,1),band(1,2)]);assert.equal(at(g,1).secondSeparation.allPairsSeparated,false);assert.equal(g.summary.decisionComplete,false);
 const stop=geometry([true,false],[band(0,1),band(2,3)],[band(0,10),band(0,10)]);assert.equal(stop.summary.decisionComplete,true);assert.equal(stop.summary.maximumReadoutCount,1);assert.equal(stop.summary.continueRegionCount,0);
});

test('delay30 inclusive,31 excluded; strictly subsequent support even with zero delay',()=>{
 for(const [delay,excluded] of [[30,false],[31,true]]){const s=clone(sequences);s.sequences[0].minimumDecisionMinutes=delay;const r=run(original,menu,collections,s);assert.equal(r.sequences[0].status==='excluded',excluded);assert.equal(r.sequences[0].timing.decisionReadyMinute,30+delay);}
 const m=clone(menu);m.options.find(o=>o.id==='depth60').minute=30;m.options.find(o=>o.id==='depth60').availableMinute=30;const s=clone(sequences);s.sequences[0].minimumDecisionMinutes=0;assert.equal(run(original,m,collections,s).sequences[0].status,'excluded');
 const late=clone(menu);late.options.find(o=>o.id==='rain10to30').availableMinute=59;assert.equal(run(original,late).sequences[0].status,'excluded');
});

test('challenge labels cannot select regions; empty and unanimous originals are not-needed',()=>{
 const a=JSON.parse(original);a.source.project.observations.push({scenario:'existing',use:'challenge',cellIndex:3,minute:0,depthMm:0,uncertaintyMm:0,source:'Authored held-aside policy control'});const b=clone(a);b.source.project.observations.at(-1).depthMm=999;const x=run(JSON.stringify(a)),y=run(JSON.stringify(b));assert.deepEqual(x.sequences,y.sequences);assert.equal(y.status,'evidence-challenged');assert.equal(y.collectionReport.singleReadoutReport.proposal.rows.length,20);
 for(const empty of [true,false]){const z=JSON.parse(original);if(empty)z.source.project.observations[0].depthMm=999;else z.goal.maximum=1e6;const r=run(JSON.stringify(z));assert.equal(r.sequences[0].status,'not-needed');assert.deepEqual(r.decisionCompleteSequenceIds,[]);assert.equal(r.selectionStatus,empty?'no-compatible-explanations':'no-target-disagreement');}
});

test('complete valid offered-sequence work refuses and malformed declarations do not admit',()=>{
 assert.doesNotThrow(()=>estimateMechanismAcquisitionCollectionsWork(original,menu,collections));const many=clone(sequences);many.sequences=Array.from({length:3},(_,i)=>({...clone(sequences.sequences[0]),id:'response-'+i,minimumDecisionMinutes:i}));assert.throws(()=>run(original,menu,collections,many),/budget|work|limit/i);
 for(const mutate of [s=>{s.sequences[0].firstOptionId='unknown';},s=>{s.sequences[0].secondOptionId=s.sequences[0].firstOptionId;},s=>{s.sequences[0].responseBasis='';},s=>{s.sequences[0].minimumDecisionMinutes=-1;},s=>{s.firstValue=10;}]){const s=clone(sequences);mutate(s);assert.throws(()=>run(original,menu,collections,s));}
});

test('actual four-file CLI hashes and report, immutable inputs and empty refusal stdout',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'earth-conditional-'));t.after(()=>rm(dir,{recursive:true,force:true}));const paths=['original','menu','collections','sequences'].map(n=>join(dir,n+'.json')),texts=[original,menuText,collectionText,sequenceText];await Promise.all(paths.map((p,i)=>writeFile(p,texts[i],{flag:'wx'})));const env={...process.env};delete env.NODE_OPTIONS;delete env.NODE_PATH;
 const invoke=()=>spawnSync(process.execPath,['--max-old-space-size=128',fileURLToPath(new URL('../plan-mechanism-acquisition.mjs',import.meta.url)),...paths],{encoding:'utf8',env,timeout:5000,maxBuffer:8*1024*1024});const ok=invoke();assert.equal(ok.error,undefined);assert.equal(ok.signal,null);assert.equal(ok.status,0,ok.stderr);assert.equal(ok.stderr,'');const r=JSON.parse(ok.stdout);assert.deepEqual(r.report,run());for(const [i,k] of ['originalProposal','acquisitionMenu','acquisitionCollections','conditionalSequences'].entries()){assert.equal(r.inputs[k].sha256,createHash('sha256').update(texts[i]).digest('hex'));assert.equal(await readFile(paths[i],'utf8'),texts[i]);}
 const bad=clone(sequences);bad.eventRef='wrong';const text=JSON.stringify(bad);await writeFile(paths[3],text);const no=invoke();assert.equal(no.error,undefined);assert.equal(no.status,1);assert.equal(no.stdout,'');assert.ok(no.stderr.length>0);assert.equal(await readFile(paths[3],'utf8'),text);for(let i=0;i<3;i++)assert.equal(await readFile(paths[i],'utf8'),texts[i]);
});
