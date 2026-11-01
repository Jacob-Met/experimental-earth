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
const TMP=fs.mkdtempSync(path.join(os.tmpdir(),'earth-paired-field-'));
const sha=b=>createHash('sha256').update(b).digest('hex');
const aBytes=fs.readFileSync(path.join(ROOT,'tests/fixtures/water-history-tradeoff.json'));
const original=JSON.parse(aBytes.toString('utf8'));
const b=structuredClone(original);
b.title='</script><img src=x onerror=alert(42)> & =SUM(A1) 夜';
b.proposal=b.existing.map(v=>({...v}));
const bBytes=Buffer.from(JSON.stringify(b,null,2)+'\n');
const A=path.join(TMP,'a.json'), B=path.join(TMP,'b.json');
fs.writeFileSync(A,aBytes);fs.writeFileSync(B,bBytes);
function run(label,mode='--report',fileA=A,fileB=B,success=true){
  const dir=path.join(TMP,label);
  const args=['compare-saved-water-histories.mjs',fileA,fileB,dir];
  if(mode)args.push(mode);
  const p=spawnSync(process.execPath,args,{cwd:ROOT,encoding:'utf8',timeout:30000,maxBuffer:1024*1024});
  assert.equal(p.error,undefined);
  assert.equal(p.status,success?0:1,p.stderr);
  return {dir,p};
}
function parseData(html){
  const line=html.split('\n').find(l=>l.startsWith('const DATA = '));
  assert.ok(line);
  assert.ok(line.endsWith(';'));
  return JSON.parse(line.slice('const DATA = '.length,-1));
}
test('opt-in visual report is an offline source-grounded fifth artifact with both originals',()=>{
  const {dir,p}=run('actual');
  assert.equal(p.stderr,'');
  const names=fs.readdirSync(dir);
  assert.deepEqual(names.sort(),['paired-water-history.csv','paired-water-report.html',
    'project-a.original.json','project-b.original.json','receipt.json'].sort());
  assert.deepEqual(fs.readFileSync(path.join(dir,'project-a.original.json')),aBytes);
  assert.deepEqual(fs.readFileSync(path.join(dir,'project-b.original.json')),bBytes);
  const html=fs.readFileSync(path.join(dir,'paired-water-report.html'),'utf8');
  const data=parseData(html);
  const aCourse=compare(parsePortableProject(aBytes.toString('utf8')));
  const bCourse=compare(parsePortableProject(bBytes.toString('utf8')));
  assert.equal(data.samples.length,aCourse.existing.snapshots.length);
  assert.equal(data.titleB,b.title);
  assert.equal(data.shaA,sha(aBytes));assert.equal(data.shaB,sha(bBytes));
  assert.ok(!html.includes('</script><img'),'embedded original title must not close the script');
  assert.ok(html.includes('\\u003c/script\\u003e'),'untrusted title must use escaped codepoints');
  for(let i=0;i<data.samples.length;i++){
    const [min,e,a,bp,d]=data.samples[i].map(Number);
    const snapshots=[aCourse.existing.snapshots[i],aCourse.proposal.snapshots[i],bCourse.proposal.snapshots[i]];
    assert.ok(Object.is(min,snapshots[0].minute));
    assert.ok(Object.is(e,snapshots[0].storedLiters));
    assert.ok(Object.is(a,snapshots[1].storedLiters));
    assert.ok(Object.is(bp,snapshots[2].storedLiters));
    assert.ok(Object.is(d,bp-a));
    for(const field of data.samples[i].slice(1,4))assert.ok(!field.startsWith('+'),'stored totals are unsigned');
    if(d>0)assert.ok(data.samples[i][4].startsWith('+'),'positive signed difference is explicit');
  }
  const receipt=JSON.parse(fs.readFileSync(path.join(dir,'receipt.json'),'utf8'));
  assert.equal(receipt.snapshots,data.samples.length);
  assert.deepEqual(data.stats,receipt.changesAtRetainedSamples);
  assert.equal(receipt.files.length,4);
  for(const f of receipt.files)assert.equal(sha(fs.readFileSync(path.join(dir,f.path))),f.sha256);
});
test('A4 print layout is present without changing offline interactive behavior',()=>{
  const {dir}=run('print-contract');
  const html=fs.readFileSync(path.join(dir,'paired-water-report.html'),'utf8');
  assert.match(html, /@page\s*\{size:A4 portrait/);
  assert.match(html, /@media print\s*\{/);
  assert.ok(html.indexOf('@media print')>html.indexOf('@media(max-width:740px)'),'print overrides narrow-screen mobile columns');
  assert.match(html, /\.interact\{display:none!important\}/);
  assert.match(html, /\.print-only\{display:block/);
  assert.match(html, /footer\{display:none!important\}/);
  assert.match(html, /The paper view retains the currently selected original sample/);
  assert.match(html, /Exact readings for all original sample instants/);
  assert.match(html, /print-color-adjust:exact/);
  assert.doesNotMatch(html, /<link\s+[^>]*href=/);
});
test('existing default CLI artifact bytes remain unchanged with opt-in HTML mode',()=>{
  const {dir}=run('default',null);
  const {dir:withReport}=run('with-report');
  assert.equal(fs.readdirSync(dir).length,4);
  for(const name of ['paired-water-history.csv','project-a.original.json','project-b.original.json']){
    assert.deepEqual(fs.readFileSync(path.join(dir,name)),fs.readFileSync(path.join(withReport,name)));
  }
  const again=run('reopen','--report',
    path.join(withReport,'project-a.original.json'),path.join(withReport,'project-b.original.json')).dir;
  for(const name of fs.readdirSync(withReport)){
    assert.deepEqual(fs.readFileSync(path.join(withReport,name)),fs.readFileSync(path.join(again,name)),name);
  }
});
test('one identical comparison gives 721 real readings, no false delta direction',()=>{
  const p=structuredClone(original);
  Object.assign(p.weather,{rainMmHr:0,stormMinutes:0,durationMinutes:720,stepMinutes:1});
  p.proposal=p.existing.map(v=>({...v}));
  const f=path.join(TMP,'long.json');fs.writeFileSync(f,JSON.stringify(p));
  const {dir}=run('long','--report',f,f);
  const report=fs.readFileSync(path.join(dir,'paired-water-report.html'),'utf8');
  const data=parseData(report);
  assert.equal(data.samples.length,721);
  assert.equal(data.stats.equal,721);
  assert.equal(data.stats.bAboveA,0);
  assert.equal(data.stats.bBelowA,0);
  for(const row of data.samples)assert.equal(Number(row[4]),0);
  assert.ok(Buffer.byteLength(report)<512*1024);
});
test('the optional flag refuses typos and baseline changes before creating outputs',()=>{
  const typo=run('bad-flag','--other',A,B,false);
  assert.ok(!fs.existsSync(typo.dir));
  const p=structuredClone(b);p.weather.rainMmHr+=1;
  const mismatch=path.join(TMP,'different.json');fs.writeFileSync(mismatch,JSON.stringify(p));
  const wrong=run('incompatible','--report',A,mismatch,false);
  assert.ok(!fs.existsSync(wrong.dir));
});
test.after(()=>fs.rmSync(TMP,{recursive:true,force:true}));
