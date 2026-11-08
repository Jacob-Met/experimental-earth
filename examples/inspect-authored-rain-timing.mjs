#!/usr/bin/env node
/** Fixed authored timing experiment; no general forcing or project API. */
import {open, lstat} from 'node:fs/promises';
import {constants} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
const USAGE='Usage: node examples/inspect-authored-rain-timing.mjs examples/authored-rain-timing.json';
const SOURCE_SHA='8bc57f051eb7c505aa569e05abd78c1b81d4acca689a9e5dffd8a57c61186694';
const identity = stat => ['dev', 'ino', 'size', 'mtimeNs', 'ctimeNs', 'mode', 'uid', 'gid'].map(key => String(stat[key])).join(':');
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const need=(ok,message)=>{if(!ok)throw Error(message);};
const exact=(o,keys)=>o!==null&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).length===keys.length&&keys.every(k=>Object.hasOwn(o,k));

async function readInput(filename, label, limit) {
  const path = resolve(filename);
  const named = await lstat(path, {bigint: true});
  if (!named.isFile() || named.size < 1n || named.size > BigInt(limit)) {
    throw Error(`${label} must be a nonempty regular file of at most ${limit} bytes; symlinks and devices are not admitted`);
  }
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  let bytes, opened;
  try {
    opened = await handle.stat({bigint: true});
    if (!opened.isFile() || identity(named) !== identity(opened)) throw Error(label + ' changed before opening');
    const buffer = Buffer.alloc(Number(opened.size) + 1);
    let count = 0;
    while (count < buffer.length) {
      const {bytesRead} = await handle.read(buffer, count, buffer.length - count, null);
      if (!bytesRead) break;
      count += bytesRead;
    }
    const after = await handle.stat({bigint: true});
    if (count !== Number(opened.size) || identity(opened) !== identity(after)) throw Error(label + ' changed during reading');
    bytes = buffer.subarray(0, count);
  } finally {
    await handle.close();
  }
  if (identity(opened) !== identity(await lstat(path, {bigint: true}))) throw Error(label + ' changed during reading');
  const text = new TextDecoder('utf-8', {fatal: true, ignoreBOM: true}).decode(bytes);
  if (text.charCodeAt(0) === 0xfeff || !Buffer.from(text, 'utf8').equals(bytes)) throw Error(label + ' requires exact UTF-8 without a BOM');
  return {path, text, bytes, identity: identity(opened), sha256: digest(bytes)};
}

function admit(text){
 const d=JSON.parse(text),pending=[d];
 while(pending.length){const v=pending.pop();if(typeof v==='number')need(Number.isFinite(v),'Non-finite authored number');else if(typeof v==='string')need(v.isWellFormed(),'Escaped lone surrogate in authored declaration');else if(v!==null&&typeof v==='object')pending.push(...Object.values(v));}
 need(exact(d,['schema','source','model','target','schedules'])&&d.schema==='experimental-earth-authored-rain-timing/1','Supply the fixed authored timing declaration');
 need(typeof d.source==='string'&&d.source.trim().length>0&&d.source.length<=600,'Supply bounded authored source text');
 const expected={conductivityMmHr:6,capillaryDriveMm:0,initialCumulativeMm:0,initialSurfaceWaterMm:0,durationHours:1,segmentHours:0.25,declaredRateCapMmHr:20};
 need(exact(d.model,Object.keys(expected))&&Object.entries(expected).every(([k,v])=>d.model[k]===v),'This example admits only its fixed authored model');
 need(exact(d.target,['metric','operator','valueMm'])&&d.target.metric==='terminal-surface-water-mm'&&d.target.operator==='at-most'&&d.target.valueMm===5,'This example admits only its fixed authored target');
 const ids=['uniform','earliest','latest'],rates=[[10,10,10,10],[20,0,20,0],[0,20,0,20]];
 need(Array.isArray(d.schedules)&&d.schedules.length===3,'Exactly three fixed schedules required');
 d.schedules.forEach((s,i)=>need(exact(s,['id','ratesMmHr'])&&s.id===ids[i]&&Array.isArray(s.ratesMmHr)&&s.ratesMmHr.length===4&&s.ratesMmHr.every((v,j)=>v===rates[i][j]),'Fixed schedule identity or rates differ'));
 return d;
}
async function main(args){
 if(args.length===1&&['--help','-h'].includes(args[0])){process.stdout.write(USAGE+'\n');return 0;}
 need(args.length===1&&args[0]&&!args[0].startsWith('--'),USAGE);
 need(['linux','darwin'].includes(process.platform),'Original-file admission currently supports Linux and macOS');
 const input=await readInput(args[0],'Authored timing input',16384),declaration=admit(input.text);
 const moduleURL=new URL('../wetting-front.js',import.meta.url),source=await readInput(fileURLToPath(moduleURL),'Reviewed local model source',65536);
 need(source.sha256===SOURCE_SHA,'Reviewed local model source hash mismatch');
 const {advanceWettingFront}=await import(moduleURL.href);
 need(typeof advanceWettingFront==='function','Reviewed local model interface unavailable');
 const m=declaration.model;let modelCalls=0;
 const schedules=declaration.schedules.map(schedule=>{
  let cumulativeMm=m.initialCumulativeMm,surfaceWaterMm=m.initialSurfaceWaterMm,rainTotal=0,earlyRainMm=0,lateRainMm=0;
  const segments=schedule.ratesMmHr.map((rainMmHr,index)=>{
   const before={cumulativeMm,surfaceWaterMm},rainDepthMm=rainMmHr*m.segmentHours;
   modelCalls++;
   const after=advanceWettingFront({cumulativeMm,surfaceWaterMm,rainMmHr,hours:m.segmentHours,conductivityMmHr:m.conductivityMmHr,capillaryDriveMm:m.capillaryDriveMm});
   need(exact(after,['infiltratedMm','cumulativeMm','surfaceWaterMm'])&&Object.values(after).every(v=>Number.isFinite(v)&&v>=0),'Invalid actual model state');
   need(after.cumulativeMm===before.cumulativeMm+after.infiltratedMm,'Model cumulative state does not match actual uptake');
   cumulativeMm=after.cumulativeMm;surfaceWaterMm=after.surfaceWaterMm;rainTotal+=rainDepthMm;
   if(index<2)earlyRainMm+=rainDepthMm;else lateRainMm+=rainDepthMm;
   const massBalanceResidualMm=rainTotal+m.initialCumulativeMm+m.initialSurfaceWaterMm-cumulativeMm-surfaceWaterMm;
   need(massBalanceResidualMm===0,'Authored exact dyadic mass balance failed');
   return {index,startHour:index*m.segmentHours,endHour:(index+1)*m.segmentHours,rainMmHr,rainDepthMm,before,after,massBalanceResidualMm};
  });
  return {id:schedule.id,segments,earlyRainMm,lateRainMm,totalRainMm:rainTotal,terminalSurfaceWaterMm:surfaceWaterMm,terminalCumulativeMm:cumulativeMm,meetsTarget:surfaceWaterMm<=declaration.target.valueMm};
 });
 need(modelCalls===12,'Fixed model call count differs');
 const commonEarlyMm=schedules[0].earlyRainMm,commonLateMm=schedules[0].lateRainMm;
 const sameEarlyRain=schedules.every(s=>s.earlyRainMm===commonEarlyMm),sameLateRain=schedules.every(s=>s.lateRainMm===commonLateMm);
 const meetingScheduleIds=schedules.filter(s=>s.meetsTarget).map(s=>s.id),missingScheduleIds=schedules.filter(s=>!s.meetsTarget).map(s=>s.id);
 const output={schema:'experimental-earth-authored-rain-timing-result/1',input:{sha256:input.sha256,bytes:input.bytes.length},implementation:{module:'wetting-front.js',sha256:source.sha256,interface:'advanceWettingFront'},declaration,
  scope:{authored:true,fieldData:false,isolatedSurface:true,routing:false,outlet:false,capillaryDrive:false,unlimitedReceiving:true,wholeSitePrediction:false},
  work:{schedules:3,segmentsPerSchedule:4,modelCalls},schedules,
  comparison:{sameEarlyRain,sameLateRain,commonEarlyMm,commonLateMm,targetDisagreement:meetingScheduleIds.length>0&&missingScheduleIds.length>0,meetingScheduleIds,missingScheduleIds},
  meaning:'A fixed fictional local-model experiment, not acquired rainfall or a calibrated site. Same early and late rainfall totals can leave a terminal surface-water target unresolved because timing changes uptake opportunity. Conductivity and the 20 mm/hour cap are declared assumptions, not inferred from gauge totals. Both cumulative infiltration and surface storage persist between segments. These exact dyadic controls do not establish general binary64 equivalence, whole-site routing, field validity, a rainfall timeline API or permission for physical action.'};
 const text=JSON.stringify(output,null,2)+'\n';
 const [inputAfter,sourceAfter]=await Promise.all([readInput(input.path,'Authored timing input',16384),readInput(source.path,'Reviewed local model source',65536)]);
 for(const [before,after,label]of [[input,inputAfter,'Authored input'],[source,sourceAfter,'Reviewed model source']])need(before.identity===after.identity&&before.bytes.equals(after.bytes),label+' changed before result publication');
 process.stdout.write(text);return 0;
}
try{process.exitCode=await main(process.argv.slice(2));}catch(error){process.stderr.write('AUTHORED RAIN TIMING REFUSAL: '+error.message+'\n');process.exitCode=1;}
