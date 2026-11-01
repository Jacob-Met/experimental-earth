#!/usr/bin/env node
// Compare two original saved investigations only when their modeled baseline agrees.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {fileURLToPath} from 'node:url';
import {compare} from './core.js';
import {parsePortableProject, MAX_PROJECT_FILE_BYTES} from './project-portability.js';
import {readOriginal, writeNew} from './export-water-history.mjs';
import {exactWaterNumber} from './water-history-values.js';

const MAX_CSV_BYTES = 2 * 1024 * 1024;
const usage = 'Usage: node compare-saved-water-histories.mjs ORIGINAL_A.json ORIGINAL_B.json NEW_OUTPUT_DIRECTORY [--report]';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const cell = value => '"' + String(value).replaceAll('"','""') + '"';
function load(filename) {
  const result = readOriginal(filename,MAX_PROJECT_FILE_BYTES);
  const text = new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(result.bytes);
  if (text.charCodeAt(0) === 0xfeff || !Buffer.from(text,'utf8').equals(result.bytes)) {
    throw Error('Original input requires exact UTF-8 without a BOM.');
  }
  return {...result, project:parsePortableProject(text), digest:sha(result.bytes), filename};
}
function assertComparable(a,b,x,y) {
  // Matching solver inputs matter more than matching chart labels or notes.
  for (const key of ['width','height','weather','existing']) {
    if (!isDeepStrictEqual(a.project[key],b.project[key])) {
      throw Error('Projects do not share the same modeled baseline (' + key + ' differs).');
    }
  }
  const ea = x.existing.snapshots, eb = y.existing.snapshots;
  const pa = x.proposal.snapshots, pb = y.proposal.snapshots;
  if (!ea.length || ea.length !== eb.length || ea.length !== pa.length || ea.length !== pb.length) {
    throw Error('Paired histories have incompatible snapshot counts.');
  }
  let last = -Infinity;
  for (let i=0;i<ea.length;i++) {
    if (!Number.isFinite(ea[i].minute) || ea[i].minute <= last || ea[i].minute !== eb[i].minute ||
        ea[i].minute !== pa[i].minute || ea[i].minute !== pb[i].minute ||
        !Object.is(ea[i].storedLiters,eb[i].storedLiters) ||
        ![ea[i].storedLiters,pa[i].storedLiters,pb[i].storedLiters].every(Number.isFinite)) {
      throw Error('The retained modeled baselines or snapshot timestamps disagree.');
    }
    last=ea[i].minute;
  }
  return {ea,pa,pb};
}
function outputFiles(a,b,x,y,reportBuilder=null) {
  const {ea,pa,pb}=assertComparable(a,b,x,y);
  const lines=[[
    'project_a_input_sha256','project_b_input_sha256','model_minute',
    'existing_stored_litres','proposal_a_stored_litres',
    'proposal_b_stored_litres','proposal_b_minus_a_litres'
  ].join(',')];
  const changes=[];
  for(let i=0;i<ea.length;i++) {
    const delta=pb[i].storedLiters-pa[i].storedLiters;
    if(!Number.isFinite(delta))throw Error('Nonfinite modeled difference.');
    changes.push({minute:ea[i].minute,delta});
    lines.push([a.digest,b.digest,ea[i].minute,ea[i].storedLiters,
      pa[i].storedLiters,pb[i].storedLiters,delta].map((v,j)=>
      cell(j>=2 ? exactWaterNumber(v) : 'sha256:'+v)).join(','));
  }
  const csv=Buffer.from(lines.join('\r\n')+'\r\n','utf8');
  if(csv.length>MAX_CSV_BYTES)throw Error('Complete paired CSV exceeds the 2 MiB bound.');
  const files=[['project-a.original.json',a.bytes],['project-b.original.json',b.bytes],['paired-water-history.csv',csv]];
  const vals=changes.map(c=>c.delta);
  const min=Math.min(...vals),max=Math.max(...vals);
  const stats={
    bAboveA:vals.filter(v=>v>0).length,bBelowA:vals.filter(v=>v<0).length,
    equal:vals.filter(v=>v===0).length,
    minimumLitres:min,minimumAtMinutes:changes.filter(c=>c.delta===min).map(c=>c.minute),
    maximumLitres:max,maximumAtMinutes:changes.filter(c=>c.delta===max).map(c=>c.minute),
    bothSignsPresent:min<0&&max>0,
  };
  if(reportBuilder)files.push(['paired-water-report.html',reportBuilder(a,b,ea,pa,pb,stats)]);
  const receipt={
    format:'experimental-earth-two-project-water-comparison/v1',
    model:'base-rain',
    method:'Two unchanged project-portability parses and two unchanged core.compare evaluations; original retained snapshot values compared at identical model times.',
    inputs:[{role:'a',bytes:a.bytes.length,sha256:a.digest},{role:'b',bytes:b.bytes.length,sha256:b.digest}],
    files:files.map(([name,bytes])=>({path:name,bytes:bytes.length,sha256:sha(bytes)})),
    snapshots:ea.length,firstMinute:ea[0].minute,lastMinute:ea.at(-1).minute,
    changesAtRetainedSamples:stats,
    scope:'Compare modeled proposal stored-water histories only when original baseline geometry, surfaces and weather agree. Both complete original project inputs are preserved. Non-solver declarations are not separately analyzed.',
    limitations:'Retained modeled instants, not interpolated durations, observed rainfall or calibrated flood risk. A larger stored-water total is not necessarily a worse outcome for every purpose.',
    reopen:'Run again on the two preserved project originals with a fresh directory. No previous outputs are consumed.'
  };
  if(reportBuilder)receipt.presentation='Optional offline HTML field sheet. Static graph lines connect retained points for orientation; exact readings are selected only at original snapshot indexes. No external assets.';
  files.push(['receipt.json',Buffer.from(JSON.stringify(receipt,null,2)+'\n','utf8')]);
  return {files,receipt};
}
export async function main(args) {
  if(args.length===1&&args[0]==='--help'){console.log(usage);return 0;}
  if(process.platform!=='linux')throw Error('Original-file comparison currently requires Linux.');
  const renderReport=args.length===4&&args[3]==='--report';
  if((args.length!==3&&!renderReport) || args.slice(0,3).some(x=>!x||x.startsWith('--')))throw Error(usage);
  const [ap,bp,out]=args.slice(0,3).map(x=>path.resolve(x));
  try{fs.lstatSync(out);throw Error('Output exists; choose a fresh directory.');}
  catch(e){if(e.code!=='ENOENT')throw e;}
  const a=load(ap),b=load(bp);
  const reportBuilder=renderReport?(await import('./paired-water-report.js')).pairedWaterReport:null;
  const result=outputFiles(a,b,compare(a.project),compare(b.project),reportBuilder);
  for(const input of [a,b]){
    const now=readOriginal(input.filename,MAX_PROJECT_FILE_BYTES);
    if(now.identity!==input.identity || !now.bytes.equals(input.bytes))throw Error('Original changed before writing output.');
  }
  let created=false;
  try{
    fs.mkdirSync(out,{mode:0o700});created=true;
    for(const [name,bytes] of result.files)writeNew(path.join(out,name),bytes);
    console.log(JSON.stringify({output:out,snapshots:result.receipt.snapshots,
      signs:result.receipt.changesAtRetainedSamples,files:result.files.map(([name,bytes])=>({path:name,bytes:bytes.length,sha256:sha(bytes)}))}));
    return 0;
  }catch(e){
    if(created)e.message+=' A partial fresh directory may remain; retain it for inspection.';
    throw e;
  }
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{process.exitCode=await main(process.argv.slice(2));}
  catch(e){console.error('WATER COMPARISON REFUSAL: '+e.message);process.exitCode=1;}
}
