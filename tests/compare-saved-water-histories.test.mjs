import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {compare} from '../core.js';
import {parsePortableProject} from '../project-portability.js';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const TMP=fs.mkdtempSync(path.join(os.tmpdir(),'earth-two-projects-'));
const sha=x=>createHash('sha256').update(x).digest('hex');
const source=path.join(ROOT,'tests/fixtures/water-history-tradeoff.json');
const aBytes=fs.readFileSync(source);
const bProject=JSON.parse(aBytes.toString('utf8'));
bProject.proposal=bProject.existing.map(v=>({...v}));
bProject.title='No intervention, =SUM(A1), "water"';
bProject.optionalNote={source:'A separate retained investigation',choice:'Control only'};
const bBytes=Buffer.from(' \n'+JSON.stringify(bProject,null,2)+'\n');
const aFile=path.join(TMP,'A.json'),bFile=path.join(TMP,'B.json');
fs.writeFileSync(aFile,aBytes);fs.writeFileSync(bFile,bBytes);
const files=['project-a.original.json','project-b.original.json','paired-water-history.csv','receipt.json'];
function run(label,inputA=aFile,inputB=bFile,expected=0){
  const out=path.join(TMP,label);
  const r=spawnSync(process.execPath,['compare-saved-water-histories.mjs',inputA,inputB,out],
    {cwd:ROOT,encoding:'utf8',timeout:15000,maxBuffer:1000000,env:{...process.env,NODE_OPTIONS:'',NODE_PATH:''}});
  assert.equal(r.error,undefined);assert.equal(r.status,expected,r.stderr);assert.equal(r.signal,null);
  if(expected===0)assert.equal(r.stderr,'');
  else{assert.equal(r.stdout,'');assert.match(r.stderr,/^WATER COMPARISON REFUSAL:/);}
  return {out,r};
}
function csvRows(text){
  const out=[];let row=[],v='',quoted=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(quoted){if(c==='"'&&text[i+1]==='"'){v+='"';i++;}else if(c==='"')quoted=false;else v+=c;}
    else if(c==='"'){assert.equal(v,'');quoted=true;}
    else if(c===','){row.push(v);v='';}
    else if(c==='\r'&&text[i+1]==='\n'){row.push(v);out.push(row);row=[];v='';i++;}
    else v+=c;
  }
  assert.equal(quoted,false);assert.deepEqual(row,[]);assert.equal(v,'');return out;
}
test('actual paired intervention comparison retains exact projects, all model times and both-sign changes',()=>{
  const {out}=run('actual');assert.deepEqual(fs.readdirSync(out).sort(),files.slice().sort());
  assert.deepEqual(fs.readFileSync(path.join(out,files[0])),aBytes);
  assert.deepEqual(fs.readFileSync(path.join(out,files[1])),bBytes);
  const rows=csvRows(fs.readFileSync(path.join(out,files[2]),'utf8'));
  const a=compare(parsePortableProject(aBytes.toString('utf8')));
  const b=compare(parsePortableProject(bBytes.toString('utf8')));
  assert.equal(rows.length,a.existing.snapshots.length+1);
  assert.deepEqual(rows[0],['project_a_input_sha256','project_b_input_sha256','model_minute','existing_stored_litres','proposal_a_stored_litres','proposal_b_stored_litres','proposal_b_minus_a_litres']);
  let above=0,below=0;
  for(let i=0;i<a.existing.snapshots.length;i++){
    const row=rows[i+1],e=a.existing.snapshots[i],p=a.proposal.snapshots[i],q=b.proposal.snapshots[i];
    assert.equal(row[0],'sha256:'+sha(aBytes));assert.equal(row[1],'sha256:'+sha(bBytes));
    for(const [j,v]of [e.minute,e.storedLiters,p.storedLiters,q.storedLiters,q.storedLiters-p.storedLiters].entries())
      assert.ok(Object.is(Number(row[j+2]),v),'row '+i+' col '+j);
    if(q.storedLiters-p.storedLiters>0)above++;
    if(q.storedLiters-p.storedLiters<0)below++;
  }
  assert.ok(above>0 && below>0,'A real intervention should have mixed model-time tradeoffs');
  const receipt=JSON.parse(fs.readFileSync(path.join(out,'receipt.json'),'utf8'));
  assert.equal(receipt.snapshots,a.existing.snapshots.length);
  assert.equal(receipt.changesAtRetainedSamples.bAboveA,above);
  assert.equal(receipt.changesAtRetainedSamples.bBelowA,below);
  assert.equal(receipt.changesAtRetainedSamples.bothSignsPresent,true);
  assert.deepEqual(receipt.inputs,[{role:'a',bytes:aBytes.length,sha256:sha(aBytes)},{role:'b',bytes:bBytes.length,sha256:sha(bBytes)}]);
  for(const file of receipt.files)assert.equal(sha(fs.readFileSync(path.join(out,file.path))),file.sha256);
  const reopened=run('reopen',path.join(out,files[0]),path.join(out,files[1])).out;
  for(const name of files)assert.deepEqual(fs.readFileSync(path.join(out,name)),fs.readFileSync(path.join(reopened,name)));
});
test('same original against itself gives exactly zero change without a misleading win',()=>{
  const {out}=run('same',aFile,aFile);
  const receipt=JSON.parse(fs.readFileSync(path.join(out,'receipt.json'),'utf8'));
  assert.equal(receipt.changesAtRetainedSamples.bAboveA,0);
  assert.equal(receipt.changesAtRetainedSamples.bBelowA,0);
  assert.equal(receipt.changesAtRetainedSamples.equal,receipt.snapshots);
  const rows=csvRows(fs.readFileSync(path.join(out,'paired-water-history.csv'),'utf8'));
  for(const row of rows.slice(1))assert.equal(Number(row[6]),0);
});
test('different weather or original base surface must refuse even if proposals are interesting',()=>{
  for(const [label,edit]of [
    ['different-weather',p=>{p.weather.rainMmHr+=1;}],
    ['different-existing',p=>{p.existing[0].surface='sealed';}],
    ['different-geometry',p=>{p.width-=1;}],
  ]){
    const p=JSON.parse(bBytes.toString('utf8'));edit(p);
    const filename=path.join(TMP,label+'.json');fs.writeFileSync(filename,JSON.stringify(p));
    const {out}=run(label,aFile,filename,1);assert.equal(fs.existsSync(out),false);
  }
});
test('malformed, BOM, nonregular and symlink originals refuse before output creation',()=>{
  const invalid=path.join(TMP,'invalid.json');fs.writeFileSync(invalid,'{}');
  const bom=path.join(TMP,'bom.json');fs.writeFileSync(bom,Buffer.concat([Buffer.from([239,187,191]),aBytes]));
  const symlink=path.join(TMP,'linked.json');fs.symlinkSync(aFile,symlink);
  for(const [label,file]of [['malformed',invalid],['bom',bom],['symlink',symlink],['directory',TMP]]){
    const {out}=run(label,file,bFile,1);assert.equal(fs.existsSync(out),false);
  }
  const preexisting=path.join(TMP,'preexisting');fs.mkdirSync(preexisting);
  fs.writeFileSync(path.join(preexisting,'sentinel'),'preserve');
  const {out}=run('preexisting',aFile,bFile,1);assert.equal(out,preexisting);
  assert.deepEqual(fs.readdirSync(out),['sentinel']);
  assert.equal(fs.readFileSync(path.join(out,'sentinel'),'utf8'),'preserve');
  assert.deepEqual(fs.readFileSync(aFile),aBytes);assert.deepEqual(fs.readFileSync(bFile),bBytes);
});
test.after(()=>{fs.rmSync(TMP,{recursive:true,force:true});});

test('maximum 721-snapshot dry course retains every model instant and zero-delta receipt',()=>{
  const p=JSON.parse(aBytes.toString('utf8'));
  Object.assign(p.weather,{rainMmHr:0,stormMinutes:0,durationMinutes:720,stepMinutes:1});
  p.proposal=p.existing.map(v=>({...v}));
  const fp=path.join(TMP,'long-dry.json');fs.writeFileSync(fp,JSON.stringify(p));
  const {out}=run('long-dry',fp,fp);
  const rows=csvRows(fs.readFileSync(path.join(out,'paired-water-history.csv'),'utf8'));
  const receipt=JSON.parse(fs.readFileSync(path.join(out,'receipt.json'),'utf8'));
  assert.equal(receipt.snapshots,721);assert.equal(rows.length,722);
  assert.equal(receipt.firstMinute,0);assert.equal(receipt.lastMinute,720);
  for(let i=0;i<721;i++){assert.equal(Number(rows[i+1][2]),i);assert.equal(Number(rows[i+1][6]),0);}
});
