import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,symlink,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {makeExample,compare} from '../core.js';
import {serializePortableProject,MAX_PROJECT_FILE_BYTES} from '../project-portability.js';

const bin=fileURLToPath(new URL('../inspect-rain-project.mjs',import.meta.url));
const exec=path=>spawnSync(process.execPath,[bin,path],{encoding:'utf8',timeout:25000,maxBuffer:2*1024*1024});
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,String(a)+' != '+String(b));
async function fixture(project=makeExample()){
  const dir=await mkdtemp(join(tmpdir(),'earth-rain-headless-'));
  const path=join(dir,'site.json'),contents=serializePortableProject(project);
  await writeFile(path,contents);
  return {dir,path,cleanup:()=>rm(dir,{recursive:true,force:true})};
}

test('original portable 8x6 source yields complete independently recomputed totals without mutation',async()=>{
  const p=makeExample();
  p.observations.push({cellIndex:9,minute:20,depthMm:8,uncertaintyMm:1,source:'original reading'});
  const f=await fixture(p);
  try{
    const before=await readFile(f.path),r=exec(f.path);
    assert.equal(r.status,0,r.stderr);assert.equal(r.stderr,'');
    const out=JSON.parse(r.stdout),model=compare(p);
    assert.equal(out.schema,'experimental-earth-rain-comparison/1');
    assert.equal(out.source.sha256,createHash('sha256').update(before).digest('hex'));
    assert.equal(out.source.bytes,before.length);
    assert.equal(out.source.observationsRetainedInOriginal,1);
    assert.deepEqual(out.geometry,{width:8,height:6,cellSizeM:p.weather.cellSizeM});
    for(const group of ['existing','proposal'])for(const key of Object.keys(out[group]))close(out[group][key],model[group][key]);
    for(const key of Object.keys(out.existing))close(out.proposalMinusExisting[key],out.proposal[key]-out.existing[key]);
    assert.ok(out.proposal.absorbedLiters>out.existing.absorbedLiters);
    assert.deepEqual(await readFile(f.path),before);
  }finally{await f.cleanup();}
});

test('selection-free 2x2 model and no-change proposal remain valid',async()=>{
  const p=makeExample();p.width=2;p.height=2;p.existing=p.existing.slice(0,4);p.proposal=structuredClone(p.existing);delete p.selectedIndex;
  const f=await fixture(p);
  try{
    const r=exec(f.path);assert.equal(r.status,0,r.stderr);
    const out=JSON.parse(r.stdout);
    assert.equal(out.geometry.width,2);
    for(const value of Object.values(out.proposalMinusExisting))close(value,0);
  }finally{await f.cleanup();}
});

test('24x24 source runs without requiring an editor selection',async()=>{
  const p=makeExample();p.width=24;p.height=24;
  p.existing=Array.from({length:576},()=>({...p.existing[0]}));p.proposal=p.existing.map(c=>({...c}));
  delete p.selectedIndex;
  const f=await fixture(p);
  try{const r=exec(f.path);assert.equal(r.status,0,r.stderr);assert.deepEqual([JSON.parse(r.stdout).geometry.width,JSON.parse(r.stdout).geometry.height],[24,24]);}
  finally{await f.cleanup();}
});

test('invalid JSON, invalid schema, oversize and malformed UTF8 refuse with empty stdout and untouched bytes',async()=>{
  const f=await fixture();
  try{
    const examples=[['bad','{'],['schema',JSON.stringify({...makeExample(),schema:'other'})],['oversize','x'.repeat(MAX_PROJECT_FILE_BYTES+1)],['utf8',Buffer.from([0xc3,0x28])]];
    for(const [name,data] of examples){
      const path=join(f.dir,name);await writeFile(path,data);
      const r=exec(path);
      assert.notEqual(r.status,0,name);assert.equal(r.stdout,'',name);
      assert.match(r.stderr,/Unable to inspect original project:/);
      assert.deepEqual(await readFile(path),Buffer.isBuffer(data)?data:Buffer.from(data));
    }
  }finally{await f.cleanup();}
});

test('symlink, directory, absent file and missing argv refuse without hanging or partial stdout',async()=>{
  const f=await fixture();
  try{
    const link=join(f.dir,'linked.json'),directory=join(f.dir,'directory');
    await symlink(f.path,link);await mkdir(directory);
    for(const path of [link,directory,join(f.dir,'missing')]){
      const r=exec(path);assert.notEqual(r.status,0);assert.equal(r.stdout,'');
    }
    const missing=spawnSync(process.execPath,[bin],{encoding:'utf8',timeout:25000});
    assert.notEqual(missing.status,0);assert.equal(missing.stdout,'');
  }finally{await f.cleanup();}
});

test('forged precomputed results in original extra fields cannot influence recomputation',async()=>{
  const p=makeExample();p.derived={existing:{rainLiters:-123},proposal:{rainLiters:99999}};
  const f=await fixture(p);
  try{
    const r=exec(f.path);assert.equal(r.status,0,r.stderr);
    const out=JSON.parse(r.stdout);
    close(out.existing.rainLiters,compare(p).existing.rainLiters);
    assert.notEqual(out.proposal.rainLiters,99999);
  }finally{await f.cleanup();}
});
