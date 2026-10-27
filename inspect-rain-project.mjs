#!/usr/bin/env node
import {open,lstat} from 'node:fs/promises';
import {constants as flags} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {compare} from './core.js';
import {MAX_PROJECT_FILE_BYTES,checkProjectFileBytes,parsePortableProject} from './project-portability.js';

const FIELDS=['rainLiters','absorbedLiters','exitLiters','storedLiters','massErrorLiters','peakPondingLiters','maxDepthMm','cellsOver10Mm'];
const same=(a,b)=>a.dev===b.dev&&a.ino===b.ino&&a.size===b.size&&a.mtimeNs===b.mtimeNs&&a.ctimeNs===b.ctimeNs;
export async function readOriginalProject(path){
  const filename=resolve(path), before=await lstat(filename,{bigint:true});
  if(!before.isFile())throw Error('Original project must be a regular file, not a symlink or device');
  checkProjectFileBytes(Number(before.size));
  const handle=await open(filename,flags.O_RDONLY|flags.O_NOFOLLOW|flags.O_NONBLOCK);
  let bytes;
  try{
    const opened=await handle.stat({bigint:true});
    if(!opened.isFile()||!same(before,opened))throw Error('Original project changed before opening');
    let length=0;const pieces=[];
    for(;;){
      const part=Buffer.allocUnsafe(65536),{bytesRead}=await handle.read(part,0,part.length,null);
      if(bytesRead===0)break;
      length+=bytesRead;
      if(length>MAX_PROJECT_FILE_BYTES)throw Error('Project file exceeds 4 MiB limit');
      pieces.push(part.subarray(0,bytesRead));
    }
    const after=await handle.stat({bigint:true});
    if(!same(opened,after)||length!==Number(after.size))throw Error('Original project changed during reading');
    bytes=Buffer.concat(pieces,length);
  }finally{await handle.close();}
  if(!same(before,await lstat(filename,{bigint:true})))throw Error('Original project changed during reading');
  const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
  return {project:parsePortableProject(text),sourceSHA256:createHash('sha256').update(bytes).digest('hex'),sourceBytes:bytes.length};
}
const summary=run=>Object.fromEntries(FIELDS.map(field=>[field,run[field]]));
export function computeReceipt(project,sourceSHA256,sourceBytes){
  const result=compare(project),existing=summary(result.existing),proposal=summary(result.proposal);
  return {
    schema:'experimental-earth-rain-comparison/1',
    claim:'Conceptual finite-volume grid calculation from declared original project inputs; not measured site performance.',
    source:{sha256:sourceSHA256,bytes:sourceBytes,projectSchema:project.schema,title:project.title,description:project.source??null,observationsRetainedInOriginal:project.observations.length},
    geometry:{width:project.width,height:project.height,cellSizeM:project.weather.cellSizeM},
    event:{rainMmHr:project.weather.rainMmHr,stormMinutes:project.weather.stormMinutes,durationMinutes:project.weather.durationMinutes,stepMinutes:project.weather.stepMinutes},
    units:{rainLiters:'L',absorbedLiters:'L',exitLiters:'L',storedLiters:'L',massErrorLiters:'L',peakPondingLiters:'L',maxDepthMm:'mm',cellsOver10Mm:'cells'},
    existing,proposal,
    proposalMinusExisting:Object.fromEntries(FIELDS.map(field=>[field,proposal[field]-existing[field]])),
  };
}
async function main(args){
  if(args.length!==1||args[0]==='--help'||args[0]==='-h'){
    const usage='Usage: node inspect-rain-project.mjs /path/to/exported-project.json\n';
    if(args.length===1&&(args[0]==='--help'||args[0]==='-h')){process.stdout.write(usage);return;}
    throw Error(usage.trim());
  }
  const {project,sourceSHA256,sourceBytes}=await readOriginalProject(args[0]);
  process.stdout.write(JSON.stringify(computeReceipt(project,sourceSHA256,sourceBytes),null,2)+'\n');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)
  main(process.argv.slice(2)).catch(error=>{process.stderr.write('Unable to inspect original project: '+error.message+'\n');process.exitCode=1;});
