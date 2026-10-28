#!/usr/bin/env node
/**
 * Source-qualified comparison of separate, locally exported rain proposals.
 * Does not edit original files or substitute inferred observations.
 */
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {readOriginalProject} from './inspect-rain-project.mjs';
import {canonicalSiteSource,compareProposalSources} from './rain-proposal-comparison.js';
export {dominates,modeledFootprint,footprintDominates} from './rain-proposal-comparison.js';

const MIN_FILES=2;
const MAX_FILES=16;

export function siteIdentity(project){
  return createHash('sha256').update(canonicalSiteSource(project),'utf8').digest('hex');
}

export async function compareProposalFiles(paths){
  return compareProposalSources(paths,{readSource:readOriginalProject,hashIdentity:siteIdentity});
}

async function main(args){
  const usage='Usage: node compare-rain-proposals.mjs original-proposal-A.json original-proposal-B.json [more proposals ...]\n';
  if(args.length===1&&(args[0]==='--help'||args[0]==='-h')){
    process.stdout.write(usage);return;
  }
  if(args.length<MIN_FILES||args.length>MAX_FILES)throw Error(usage.trim());
  const report=await compareProposalFiles(args);
  process.stdout.write(JSON.stringify(report,null,2)+'\n');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)
  main(process.argv.slice(2)).catch(error=>{
    process.stderr.write('Unable to compare original rain proposals: '+error.message+'\n');
    process.exitCode=1;
  });

