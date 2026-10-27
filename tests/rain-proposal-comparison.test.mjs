import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {mkdtemp,writeFile,readFile,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {makeExample} from '../core.js';
import {serializePortableProject} from '../project-portability.js';
import {computeReceipt} from '../inspect-rain-project.mjs';
import {compareProposalFiles,siteIdentity,dominates} from '../compare-rain-proposals.mjs';

const cli=fileURLToPath(new URL('../compare-rain-proposals.mjs',import.meta.url));
const exec=paths=>spawnSync(process.execPath,[cli,...paths],{encoding:'utf8',timeout:30000,maxBuffer:4*1024*1024});
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const original=()=>makeExample();
const copy=project=>structuredClone(project);
const reverse=value=>Array.isArray(value)?value.map(reverse):value&&typeof value==='object'?
  Object.fromEntries(Object.keys(value).reverse().map(k=>[k,reverse(value[k])])):value;
async function course(fn){
  const dir=await mkdtemp(join(tmpdir(),'earth-original-proposals-'));
  try{await fn(dir);}finally{await rm(dir,{recursive:true,force:true});}
}
async function save(dir,name,project,serialized=serializePortableProject(project)){
  const path=join(dir,name);await writeFile(path,serialized);return path;
}
function options(){
  const a=original();
  const b=copy(a);b.title='Keep original paving';b.proposal=copy(b.existing);b.selectedIndex=1;
  const c=copy(a);c.title='More rain gardens';c.proposal=c.proposal.map(cell=>({...cell,surface:'garden',provenance:'hypothetical alternative'}));
  return [a,b,c];
}

test('actual CLI compares three distinct source exports, recomputes exact core metrics and preserves every byte',async()=>{
  await course(async dir=>{
    const projects=options(),paths=await Promise.all(projects.map((p,i)=>save(dir,'plan-'+i+'.json',p)));
    const before=await Promise.all(paths.map(p=>readFile(p)));
    const r=exec(paths);
    assert.equal(r.status,0,r.stderr);
    assert.equal(r.stderr,'');
    const out=JSON.parse(r.stdout);
    assert.equal(out.schema,'experimental-earth-rain-proposal-comparison/1');
    assert.equal(out.candidates.length,3);
    assert.equal(out.originalSite.sha256OfCanonicalUnchangedFields,siteIdentity(projects[0]));
    for(let i=0;i<3;i++){
      assert.equal(out.candidates[i].inputOrdinal,i+1);
      assert.deepEqual(out.candidates[i].proposal,computeReceipt(projects[i],sha(before[i]),before[i].length).proposal);
      assert.deepEqual(out.candidates[i].proposalMinusExisting,computeReceipt(projects[i],sha(before[i]),before[i].length).proposalMinusExisting);
      assert.equal(out.candidates[i].originalFile.sha256,sha(before[i]));
      assert.deepEqual(await readFile(paths[i]),before[i]);
    }
    assert.ok(out.candidates.some(c=>c.proposal.absorbedLiters!==out.candidates[0].proposal.absorbedLiters));
    assert.ok(out.namedObjectiveFrontier.length>=1);
    for(const c of out.candidates)
      assert.equal(c.onNamedObjectiveFrontier,c.dominatedBy.length===0);
  });
});

test('semantic source identity tolerates property order, UI selection and display title but not alternative underlying evidence',async()=>{
  await course(async dir=>{
    const [a,b]=options();
    b.proposal=copy(a.proposal);b.title='Re-titled site';b.selectedIndex=22;
    assert.equal(siteIdentity(a),siteIdentity(b));
    const paths=[await save(dir,'a.json',a),await save(dir,'b.json',b,JSON.stringify(reverse(b)))];
    const r=exec(paths);
    assert.equal(r.status,0,r.stderr);
    const out=JSON.parse(r.stdout);
    assert.deepEqual(out.namedObjectiveFrontier,[1,2]);
    assert.equal(out.candidates[0].originalFile.sha256===out.candidates[1].originalFile.sha256,false);
    assert.equal(out.candidates[1].onNamedObjectiveFrontier,true);
  });
});

test('dominance is bounded to named objectives, preserves tradeoffs and treats tiny numerical ties as equal',()=>{
  const betterAbsorb={absorbedLiters:15,maxDepthMm:20};
  const lessDepth={absorbedLiters:5,maxDepthMm:4};
  const worseBoth={absorbedLiters:4,maxDepthMm:30};
  assert.equal(dominates(betterAbsorb,worseBoth),true);
  assert.equal(dominates(lessDepth,worseBoth),true);
  assert.equal(dominates(betterAbsorb,lessDepth),false);
  assert.equal(dominates(lessDepth,betterAbsorb),false);
  assert.equal(dominates(betterAbsorb,{absorbedLiters:15+1e-11,maxDepthMm:20-1e-11}),false);
  assert.throws(()=>dominates({absorbedLiters:NaN,maxDepthMm:1},worseBoth),/invalid numerical/);
});

test('changed weather, site elevation, original source, grid provenance, observation or optional study refuses atomically',async()=>{
  await course(async dir=>{
    const a=original(),first=await save(dir,'a.json',a);
    const mutations=[
      p=>{p.weather.rainMmHr+=1;},
      p=>{p.existing[0].elevationM+=0.01;},
      p=>{p.source='another original source';},
      p=>{p.existing[3].provenance='other field record';},
      p=>{p.observations.push({cellIndex:9,minute:20,depthMm:8,uncertaintyMm:1,source:'test reading'});},
      p=>{p.optionalIndependentEvidence={original:'not interchangeable'};},
    ];
    for(const [i,mutate] of mutations.entries()){
      const candidate=copy(a);mutate(candidate);
      const path=await save(dir,'m'+i+'.json',candidate);
      const r=exec([first,path]);
      assert.notEqual(r.status,0,'mutation '+i);
      assert.equal(r.stdout,'','mutation '+i);
      assert.match(r.stderr,/not the same original site/,'mutation '+i);
    }
  });
});

test('invalid, oversized, symlink, and non-file exports never emit a partial comparison',async()=>{
  await course(async dir=>{
    const a=original(),first=await save(dir,'good.json',a),other=await save(dir,'other.json',a);
    const malformed=join(dir,'bad.json');await writeFile(malformed,Buffer.from([0xff,0xfe,0xfd]));
    const huge=join(dir,'huge.json');await writeFile(huge,' '.repeat(4*1024*1024+1));
    const link=join(dir,'alias.json');await symlink(other,link);
    for(const invalid of [malformed,huge,link,dir,join(dir,'missing.json')]){
      const r=exec([first,invalid]);
      assert.notEqual(r.status,0,invalid);
      assert.equal(r.stdout,'',invalid);
      assert.match(r.stderr,/Unable to compare original rain proposals/);
    }
    for(const bad of [[],[first],Array(17).fill(first)]){
      const r=exec(bad);
      assert.notEqual(r.status,0);
      assert.equal(r.stdout,'');
    }
  });
});

test('independently exported same-site altered proposals always keep baseline comparison identical',async()=>{
  const [a,b,c]=options();
  await course(async dir=>{
    const paths=await Promise.all([a,b,c].map((p,i)=>save(dir,'v'+i+'.json',p)));
    const result=await compareProposalFiles(paths);
    const baseline=computeReceipt(a,'0'.repeat(64),1).existing;
    assert.deepEqual(result.originalSite.existing,baseline);
    for(const candidate of result.candidates){
      for(const field of Object.keys(baseline)){
        assert.equal(typeof candidate.proposal[field],'number');
        assert.ok(Number.isFinite(candidate.proposal[field]));
        assert.ok(Math.abs(candidate.proposalMinusExisting[field]-(candidate.proposal[field]-baseline[field]))<1e-8);
      }
    }
  });
});
