// Authored before candidate finite-number admission. No external baseline imports.
// Semantic identity is parsed finite-number identity, not exact decimal/JSON text.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {makeExample} from '../core.js';
import {readOriginalProject} from '../inspect-rain-project.mjs';
import {siteIdentity} from '../compare-rain-proposals.mjs';

const sha=b=>createHash('sha256').update(b).digest('hex');
function fixture(){
 const p=makeExample();p.width=p.height=2;p.selectedIndex=0;
 p.existing=Array.from({length:4},()=>({surface:'turf',elevationM:0,provenance:'authored numeric-admission control'}));
 p.proposal=p.existing.map(c=>({...c,surface:'garden'}));
 Object.assign(p.weather,{rainMmHr:30,stormMinutes:60,durationMinutes:60,stepMinutes:30,cellSizeM:2,mobilityPerHour:0,boundaryExitPerHour:0});return p;
}
function original(token,where='retained'){
 const p=fixture();
 if(where==='retained')p.optionalIndependentEvidence={declaredMagnitude:'__RAW_NUMBER__'};
 else p.proposal[0].unusedEvidence='__RAW_NUMBER__';
 return JSON.stringify(p).replace('"__RAW_NUMBER__"',token)+'\n';
}
async function workspace(t){const dir=await mkdtemp(join(tmpdir(),'earth-number-admission-'));t.after(()=>rm(dir,{recursive:true,force:true}));return dir;}
async function save(dir,name,text){const p=join(dir,name);await writeFile(p,text,{flag:'wx',mode:0o600});return p;}
function cli(name,paths){
 const env={...process.env};delete env.NODE_OPTIONS;delete env.NODE_PATH;
 const r=spawnSync(process.execPath,['--max-old-space-size=128',fileURLToPath(new URL('../'+name,import.meta.url)),...paths],{encoding:'utf8',timeout:5000,maxBuffer:2*1024*1024,env});
 assert.equal(r.error,undefined);assert.equal(r.signal,null);return r;
}
function refused(r){assert.equal(r.status,1);assert.equal(r.stdout,'');assert.ok(r.stderr.trim().length>0);}
function success(r){assert.equal(r.status,0,r.stderr);assert.equal(r.stderr,'');return JSON.parse(r.stdout);}

test('actual inspect and compare refuse positive/negative/nested/candidate-only overflow',async t=>{
 const dir=await workspace(t),aText=original('null'),a=await save(dir,'a.json',aText);
 const cases=[['positive','1e400','retained'],['negative','-1e400','retained'],['nested','[1,{"v":1e400}]','retained'],['excluded-proposal','1e400','proposal']];
 for(const [name,token,where] of cases){
  const text=original(token,where),b=await save(dir,name+'.json',text);
  await assert.rejects(()=>readOriginalProject(b));
  refused(cli('inspect-rain-project.mjs',[b]));
  refused(cli('compare-rain-proposals.mjs',[a,b]));
  assert.equal(await readFile(b,'utf8'),text,'refusal must not alter original');
 }
 assert.equal(await readFile(a,'utf8'),aText);
});

test('finite original receipts retain exact raw hashes and do not alter files',async t=>{
 const dir=await workspace(t),text=original('8'),a=await save(dir,'a.json',text),b=await save(dir,'b.json',text);
 const read=await readOriginalProject(a);assert.equal(read.sourceSHA256,sha(Buffer.from(text)));assert.equal(read.sourceBytes,Buffer.byteLength(text));
 const inspected=success(cli('inspect-rain-project.mjs',[a]));assert.equal(inspected.source.sha256,read.sourceSHA256);assert.equal(inspected.source.bytes,read.sourceBytes);
 const compared=success(cli('compare-rain-proposals.mjs',[a,b]));assert.equal(compared.candidates.length,2);assert.ok(compared.candidates.every(c=>c.originalFile.sha256===read.sourceSHA256));
 assert.equal(compared.originalSite.sha256OfCanonicalUnchangedFields,siteIdentity(read.project));
 assert.equal(await readFile(a,'utf8'),text);assert.equal(await readFile(b,'utf8'),text);
});

test('retained null and ordinary differing finite numbers remain distinct site contexts',async t=>{
 const dir=await workspace(t);
 for(const [name,left,right] of [['null-zero','null','0'],['finite-change','8','9']]){
  const a=await save(dir,name+'-a.json',original(left)),b=await save(dir,name+'-b.json',original(right));
  const aa=await readOriginalProject(a),bb=await readOriginalProject(b);assert.notEqual(siteIdentity(aa.project),siteIdentity(bb.project));
  success(cli('inspect-rain-project.mjs',[a]));success(cli('inspect-rain-project.mjs',[b]));refused(cli('compare-rain-proposals.mjs',[a,b]));
 }
});

test('preserve parsed finite, null, underflow, precision and negative-zero semantics explicitly',async t=>{
 const dir=await workspace(t);
 const cases=[['null','null','null',false],['spelling','1.0','1e0',true],['large-finite','1e308','1e308',false],['underflow','0','1e-400',true],['precision','9007199254740992','9007199254740993',true],['negative-zero','0','-0',true]];
 for(const [name,left,right,differentBytes] of cases){
  const a=await save(dir,name+'-a.json',original(left)),b=await save(dir,name+'-b.json',original(right));
  const aa=await readOriginalProject(a),bb=await readOriginalProject(b);
  assert.equal(siteIdentity(aa.project),siteIdentity(bb.project),name+' should retain parsed semantic identity');
  assert.equal(aa.sourceSHA256!==bb.sourceSHA256,differentBytes);
  const report=success(cli('compare-rain-proposals.mjs',[a,b]));assert.equal(report.candidates[0].originalFile.sha256,aa.sourceSHA256);assert.equal(report.candidates[1].originalFile.sha256,bb.sourceSHA256);
  if(name==='negative-zero')assert.equal(Object.is(bb.project.optionalIndependentEvidence.declaredMagnitude,-0),true);
 }
});

test('finite display/proposal differences stay excluded, while overflow-looking strings are data',async t=>{
 const dir=await workspace(t),p=fixture();p.optionalIndependentEvidence={declaredMagnitude:'1e400'};
 const q=structuredClone(p);q.title='A different finite proposal';q.selectedIndex=1;q.proposal[0].surface='sealed';
 const aText=JSON.stringify(p),bText=JSON.stringify(q),a=await save(dir,'a.json',aText),b=await save(dir,'b.json',bText);
 const aa=await readOriginalProject(a),bb=await readOriginalProject(b);assert.equal(siteIdentity(aa.project),siteIdentity(bb.project));assert.notEqual(aa.sourceSHA256,bb.sourceSHA256);
 success(cli('compare-rain-proposals.mjs',[a,b]));assert.equal(await readFile(a,'utf8'),aText);assert.equal(await readFile(b,'utf8'),bText);
});

test('new admission does not introduce recursive-stack failure on a deep finite extension',async t=>{
 const dir=await workspace(t),depth=12000;
 const finiteText=original('['.repeat(depth)+'1'+']'.repeat(depth));
 const p=await save(dir,'deep-finite.json',finiteText),received=await readOriginalProject(p);
 let value=received.project.optionalIndependentEvidence.declaredMagnitude;
 for(let i=0;i<depth;i++){assert.equal(Array.isArray(value),true);assert.equal(value.length,1);value=value[0];}
 assert.equal(value,1);assert.equal(received.sourceSHA256,sha(Buffer.from(finiteText)));
 // Deliberately reader-only: the existing recursive comparison canonicalizer
 // is not made stack-safe by this Node intake correction.
 const bad=await save(dir,'deep-overflow.json',original('['.repeat(depth)+'1e400'+']'.repeat(depth)));
 await assert.rejects(()=>readOriginalProject(bad),e=>e instanceof Error && !(e instanceof RangeError));
 assert.equal(await readFile(p,'utf8'),finiteText);
});
