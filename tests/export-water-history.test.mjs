import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {compare,makeExample} from '../core.js';
import {parsePortableProject} from '../project-portability.js';
import {serializeWaterHistoryCsv} from '../water-history-csv.js';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const retained=process.env.EARTH_WATER_CSV_RECEIVING;
const OUT=retained?path.resolve(retained):fs.mkdtempSync(path.join(os.tmpdir(),'earth-water-csv-'));
if(retained)fs.mkdirSync(OUT,{mode:0o700});
const sha=b=>createHash('sha256').update(b).digest('hex');
const save=(name,bytes)=>fs.writeFileSync(path.join(OUT,name),bytes,{flag:'wx',mode:0o600});
const calls=[];
function run(label,input,out,expected=0){
 const args=['export-water-history.mjs',input,out];
 const r=spawnSync(process.execPath,args,{cwd:ROOT,encoding:'utf8',timeout:10000,maxBuffer:1048576,env:{...process.env,NODE_OPTIONS:'',NODE_PATH:''}});
 const row={label,args,status:r.status,signal:r.signal,error:r.error?String(r.error):null};
 for(const stream of ['stdout','stderr']){
  const value=r[stream]??'';save(label+'.'+stream,value);row[stream]={bytes:Buffer.byteLength(value),sha256:sha(value)};
 }
 calls.push(row);
 assert.equal(r.error,undefined,label);assert.equal(r.signal,null,label);assert.equal(r.status,expected,label+': '+r.stderr);
 if(expected===0)assert.equal(r.stderr,'');
 else{assert.equal(r.stdout,'');assert.match(r.stderr,/^WATER HISTORY REFUSAL:/);}
 return r;
}
// Independent CSV state machine; embedded title newlines are not row separators.
function rows(csv){
 const result=[];let row=[],value='',quoted=false;
 for(let i=0;i<csv.length;i++){
  const c=csv[i];
  if(quoted){
   if(c==='"'&&csv[i+1]==='"'){value+='"';i++;}
   else if(c==='"')quoted=false;
   else value+=c;
  }else if(c==='"'){assert.equal(value,'');quoted=true;}
  else if(c===','){row.push(value);value='';}
  else if(c==='\r'&&csv[i+1]==='\n'){row.push(value);result.push(row);row=[];value='';i++;}
  else value+=c;
 }
 assert.equal(quoted,false);assert.equal(value,'');assert.deepEqual(row,[]);return result;
}
async function receive(directory,original){
 assert.deepEqual(fs.readdirSync(directory).sort(),['project.original.json','receipt.json','water-history.csv']);
 assert.deepEqual(fs.readFileSync(path.join(directory,'project.original.json')),original);
 const text=original.toString('utf8'),project=parsePortableProject(text),native=compare(project);
 const csv=fs.readFileSync(path.join(directory,'water-history.csv')),receipt=JSON.parse(fs.readFileSync(path.join(directory,'receipt.json'),'utf8'));
 assert.equal(csv.toString('utf8'),await serializeWaterHistoryCsv(native,text));
 const parsed=rows(csv.toString('utf8'));
 assert.deepEqual(parsed[0],['project_title_json','project_input_digest','model_minute','existing_stored_litres','proposed_stored_litres','proposed_minus_existing_litres']);
 assert.equal(parsed.length,native.existing.snapshots.length+1);
 for(let i=0;i<native.existing.snapshots.length;i++){
  const a=native.existing.snapshots[i],b=native.proposal.snapshots[i],r=parsed[i+1];
  assert.equal(JSON.parse(r[0]),project.title);assert.equal(r[1],'sha256:'+sha(original));
  for(const [j,expected]of [a.minute,a.storedLiters,b.storedLiters,b.storedLiters-a.storedLiters].entries())assert.ok(Object.is(Number(r[j+2]),expected));
 }
 assert.equal(receipt.format,'experimental-earth-water-history-native/v1');assert.equal(receipt.model,'base-rain');
 assert.deepEqual(receipt.input,{bytes:original.length,sha256:sha(original)});
 assert.deepEqual(receipt.files,[{path:'project.original.json',bytes:original.length,sha256:sha(original)},{path:'water-history.csv',bytes:csv.length,sha256:sha(csv)}]);
 assert.equal(receipt.snapshots,parsed.length-1);assert.equal(receipt.firstMinute,0);assert.equal(receipt.lastMinute,project.weather.durationMinutes);
 return {parsed,csv,receipt};
}
function small(){
 const p=makeExample();p.width=2;p.height=2;p.selectedIndex=0;
 p.existing=Array.from({length:4},()=>({elevationM:0,surface:'sealed',provenance:'Authored analytic control'}));
 p.proposal=p.existing.map(c=>({...c,surface:'turf'}));
 Object.assign(p.weather,{rainMmHr:61,stormMinutes:2.5,durationMinutes:5.5,stepMinutes:2,cellSizeM:1,mobilityPerHour:0,boundaryExitPerHour:0});
 return p;
}
let ordinary;
test('original committed tradeoff project creates a complete CSV and reopens byte exactly',async()=>{
 const input=path.join(ROOT,'tests/fixtures/water-history-tradeoff.json'),original=fs.readFileSync(input);
 const first=path.join(OUT,'ordinary'),again=path.join(OUT,'reopened');
 const summary=JSON.parse(run('create',input,first).stdout);
 ordinary=await receive(first,original);assert.equal(summary.snapshots,ordinary.receipt.snapshots);
 const changes=ordinary.parsed.slice(1).map(r=>Number(r[5]));assert.ok(changes.some(n=>n>0)&&changes.some(n=>n<0));
 run('reopen',path.join(first,'project.original.json'),again);await receive(again,original);
 for(const name of ['project.original.json','water-history.csv','receipt.json'])assert.deepEqual(fs.readFileSync(path.join(first,name)),fs.readFileSync(path.join(again,name)));
 assert.deepEqual(fs.readFileSync(input),original);
});
test('fractional endpoint and literal title retain independent no-flow water accounting',async()=>{
 const p=small();p.title='=SUM(A1), "雨"\r\n🌱';p.consumerNote={meaning:'Preserve this original declaration',value:[1,2,3]};
 const original=Buffer.from(' \n'+JSON.stringify(p,null,1)+'\n\t');save('fractional.json',original);
 const input=path.join(OUT,'fractional.json'),out=path.join(OUT,'fractional');
 run('fractional',input,out);const got=await receive(out,original);
 assert.deepEqual(got.parsed.slice(1).map(r=>Number(r[2])),[0,2,4,5.5]);
 for(const r of got.parsed.slice(1)){
  const t=Number(r[2]);
  for(const [j,rate]of [[3,1],[4,9]])assert.ok(Math.abs(Number(r[j])-4*(61*Math.min(t,2.5)-rate*t)/60)<1e-12);
  assert.equal(r[0][0],'"');
 }
 assert.deepEqual(fs.readFileSync(input),original);
});
test('complete maximum-length dry course keeps all721 original snapshots',async()=>{
 const p=small();Object.assign(p.weather,{rainMmHr:0,stormMinutes:0,durationMinutes:720,stepMinutes:1});
 const original=Buffer.from(JSON.stringify(p));save('dry.json',original);
 const input=path.join(OUT,'dry.json'),out=path.join(OUT,'dry');run('dry',input,out);
 const got=await receive(out,original);assert.equal(got.parsed.length,722);
 for(let i=0;i<=720;i++)assert.deepEqual(got.parsed[i+1].slice(2),[String(i),'0','0','0']);
 assert.deepEqual(fs.readFileSync(input),original);
});
test('equivalent project formatting keeps numbers but intentionally changes the exact input digest',async()=>{
 const input=path.join(ROOT,'tests/fixtures/water-history-tradeoff.json'),original=fs.readFileSync(input),changed=Buffer.from(original.toString('utf8')+' \n');
 save('spelling.json',changed);const out=path.join(OUT,'spelling');run('spelling',path.join(OUT,'spelling.json'),out);
 const got=await receive(out,changed);assert.notEqual(got.receipt.input.sha256,ordinary.receipt.input.sha256);
 assert.deepEqual(got.parsed.slice(1).map(r=>r.slice(2)),ordinary.parsed.slice(1).map(r=>r.slice(2)));
 assert.deepEqual(fs.readFileSync(input),original);
});
test('malformed, oversized and nonregular originals refuse and existing output stays untouched',()=>{
 save('invalid.json','{}');save('invalid-utf8.json',Buffer.from([255,123,125]));save('bom.json',Buffer.from([239,187,191,123,125]));
 save('oversized.json','');fs.truncateSync(path.join(OUT,'oversized.json'),4*1024*1024+1);
 const input=path.join(ROOT,'tests/fixtures/water-history-tradeoff.json');fs.symlinkSync(input,path.join(OUT,'linked.json'));
 const cases=[['invalid','invalid.json'],['utf8','invalid-utf8.json'],['bom','bom.json'],['limit','oversized.json'],['directory','.'],['symlink','linked.json']];
 for(const [label,name]of cases){const out=path.join(OUT,'refused-'+label);run(label,path.join(OUT,name),out,1);assert.equal(fs.existsSync(out),false);}
 const out=path.join(OUT,'existing');fs.mkdirSync(out);fs.writeFileSync(path.join(out,'keep'),'preserve');
 run('existing',input,out,1);assert.deepEqual(fs.readdirSync(out),['keep']);assert.equal(fs.readFileSync(path.join(out,'keep'),'utf8'),'preserve');
 save('admission-fixtures.json',JSON.stringify({oversizedBytes:4*1024*1024+1,symlinkTarget:input,retainedReceiving:!!retained,fixturesRemainUntilOrdinaryTempCleanup:true})+'\n');
});
test.after(()=>{
 if(retained)save('cli-receipt.json',JSON.stringify({format:'earth-water-csv-cli-receiving/v1',calls},null,2)+'\n');
 else fs.rmSync(OUT,{recursive:true,force:true});
});
