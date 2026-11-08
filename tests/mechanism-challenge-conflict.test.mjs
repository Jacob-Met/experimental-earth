import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {findMinimumChallengeConflict as solve} from '../challenge-support-conflict.js';
import {estimateMechanismChallengeConflictWork as estimate,explainMechanismChallengeConflict as explain} from '../mechanism-challenge-conflict.js';
const original=()=>readFileSync(new URL('../examples/mechanism-challenge-conflict-original.json',import.meta.url),'utf8');
const raw=()=>JSON.parse(original());
const all=n=>Array.from({length:n},(_,i)=>i);
test('lex tie uses canonical ordinals rather than numeric mask order',()=>{
 const r=solve(4,[[0,1],[0,2],[1,3],[2,3]]);assert.deepEqual(r.witness.recordOrdinals,[0,3]);assert.equal(r.witness.cardinality,2);assert.deepEqual(r.witness.omissions,[{omittedOrdinal:0,survivorCandidateIds:[2,3]},{omittedOrdinal:3,survivorCandidateIds:[0,1]}]);
});
test('minimum beats larger irreducible conflict; singleton and duplicate identities',()=>{
 assert.deepEqual(solve(3,[[0,1],[1,2],[0,2],[0],[1,2]]).witness.recordOrdinals,[1,3]);const r=solve(3,[[0,1],[1,2],[],[]]);assert.deepEqual(r.witness.recordOrdinals,[2]);assert.deepEqual(r.witness.omissions[0].survivorCandidateIds,[0,1,2]);assert.deepEqual(solve(3,[[0],[0],[1,2]]).witness.recordOrdinals,[0,2]);
});
test('candidate IDs above32 and explicit empty/nonconflict cases',()=>{
 assert.deepEqual(solve(40,[all(40).filter(i=>i!==39),[39]]).witness.recordOrdinals,[0,1]);assert.deepEqual(solve(0,[[]]),{jointSurvivorIds:[],witness:null});assert.deepEqual(solve(3,[]),{jointSurvivorIds:[0,1,2],witness:null});assert.deepEqual(solve(40,[[0,32,39],[32,39]]),{jointSurvivorIds:[32,39],witness:null});for(const s of [[[1,0]],[[0,0]],[[40]]])assert.throws(()=>solve(40,s));
});
test('authored20-row oracle retains complete original and score authority',()=>{
 const text=original(),x=JSON.parse(text),r=explain(text),p=r.originalProposal;assert.equal(r.status,'challenge-conflict');for(const k of ['schema','source','fronts','goal'])assert.deepEqual(p[k],x[k]);assert.equal(p.result.rows.length,20);assert.equal(p.result.rows.filter(x=>x.meets).length,6);assert.equal(p.result.targetStatus,'conditional');assert.deepEqual(r.records.map(x=>x.supportedCandidateIds),[all(20),[0,1,2,3,4,5,6,7,8,18],[9,10,11,12,13,14,15,16,17,19]]);assert.deepEqual(r.witness.recordOrdinals,[1,2]);assert.deepEqual(r.witness.recordRefs,['rain-gauge:authored-conflict-A','rain-gauge:authored-conflict-B']);assert.deepEqual(r.witness.omissions.map(x=>x.survivorCandidateIds.length),[10,10]);assert.deepEqual(r.records.map(x=>x.reading),x.source.gauge.readings.filter(x=>x.use==='challenge'));assert.equal(original(),text);
});
test('mixed depth/gauge and excluded other-scenario evidence preserve original roles',()=>{
 const x=raw();x.source.project.observations.push({scenario:'existing',use:'challenge',cellIndex:0,minute:0,depthMm:0,uncertaintyMm:0,source:'Authored initial challenge'},{scenario:'proposal',use:'challenge',cellIndex:0,minute:0,depthMm:999,uncertaintyMm:0,source:'Authored other-scenario challenge'});const text=JSON.stringify(x),r=explain(text);assert.deepEqual(r.originalProposal.source,x.source);assert.equal(r.records[0].ref,'depth:1');assert.deepEqual(r.records[0].supportedCandidateIds,all(20));assert.equal(r.scope.excludedDepthChallenges.length,1);assert.equal(r.scope.applicableChallengeCount,4);assert.deepEqual(r.witness.recordRefs,['rain-gauge:authored-conflict-A','rain-gauge:authored-conflict-B']);assert.equal(r.originalProposal.result.rows.filter(z=>z.meets).length,6);assert.equal(JSON.stringify(x),text);
});
test('empty calibration, no challenges and surviving subset remain distinct',()=>{
 const empty=raw();empty.source.project.observations[0].depthMm=999;const e=explain(JSON.stringify(empty));assert.equal(e.status,'no-calibration-family');assert.equal(e.witness,null);
 const none=raw();none.source.gauge.readings=none.source.gauge.readings.filter(r=>r.use==='calibration');const n=explain(JSON.stringify(none));assert.equal(n.status,'no-challenges');assert.deepEqual(n.jointSurvivorIds,all(20));assert.equal(n.witness,null);
 const one=raw();one.source.gauge.readings=one.source.gauge.readings.filter(r=>r.id!=='authored-conflict-B');const c=explain(JSON.stringify(one));assert.equal(c.status,'compatible-survivors');assert.deepEqual(c.jointSurvivorIds,[0,1,2,3,4,5,6,7,8,18]);assert.equal(c.witness,null);
});
// Instrument only the retained importer entry, without changing production files.
import {spawnSync} from 'node:child_process';
function counted(text){
 const loader=`export async function load(url,context,next){const r=await next(url,context);if(url.endsWith('/rain-mechanism-proposal.js')){const s=String(r.source),needle='export function importMechanismProposal(text){';if(s.split(needle).length!==2)throw Error('instrumentation signature');return {...r,source:s.replace(needle,needle+'globalThis.__calls=(globalThis.__calls??0)+1;')};}return r;}`;
 const url='data:text/javascript;base64,'+Buffer.from(loader).toString('base64');
 const consumer=new URL('../mechanism-challenge-conflict.js',import.meta.url).href;
 const code=`import {register} from 'node:module';register(${JSON.stringify(url)},import.meta.url);const {explainMechanismChallengeConflict}=await import(${JSON.stringify(consumer)});let refused=false;try{explainMechanismChallengeConflict(${JSON.stringify(text)});}catch(e){refused=true;}console.log(JSON.stringify({refused,calls:globalThis.__calls??0}));`;
 const p=spawnSync(process.execPath,['--max-old-space-size=128','--input-type=module','-e',code],{encoding:'utf8',timeout:5000,maxBuffer:1048576});assert.equal(p.status,0,p.stderr);return JSON.parse(p.stdout);
}
test('valid whole-offer refusals precede importer; successful result imports exactly once',()=>{
 const source=raw(),w=estimate(JSON.stringify(source));assert.equal(w.offeredHypotheses,20);assert.equal(w.applicableChallengeCount,3);assert.equal(w.originalReadingCount,5);assert.equal(w.subsetCount,7);assert.equal(w.reportItems,344);assert.deepEqual(counted(JSON.stringify(source)),{refused:false,calls:1});
 const c13=raw();for(let i=3;i<13;i++)c13.source.gauge.readings.push({...c13.source.gauge.readings[1],id:'additional-'+i});
 const search=raw();search.source.request.ratesMmHr=all(9).map(i=>i*10);search.source.request.rainRatesMmHr=all(9).map(i=>20+i*5);for(let i=3;i<12;i++)search.source.gauge.readings.push({...search.source.gauge.readings[1],id:'search-'+i});
 const model=structuredClone(search);model.source.gauge.readings=model.source.gauge.readings.slice(0,4);model.source.project.width=4;model.source.project.height=4;for(const key of ['existing','proposal'])model.source.project[key]=Array.from({length:16},()=>({...model.source.project[key][0]}));model.source.project.weather.durationMinutes=720;model.source.project.weather.stepMinutes=1;
 for(const x of [c13,search,model]){const text=JSON.stringify(x);assert.throws(()=>estimate(text));assert.deepEqual(counted(text),{refused:true,calls:0});}
 // Current maintained O/H/C caps preclude a standalone report-cap refusal.
 assert.equal(512*(164+4)+2*512*12+12*12+12+32,98492);
});
