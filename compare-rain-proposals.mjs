#!/usr/bin/env node
/**
 * Source-qualified comparison of separate, locally exported rain proposals.
 * Does not edit original files or substitute inferred observations.
 */
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {readOriginalProject,computeReceipt} from './inspect-rain-project.mjs';
import {changedBarrierCells} from './internal-barriers.js';

const MIN_FILES=2;
const MAX_FILES=16;
const CANDIDATE_ONLY=new Set(['proposal','title','selectedIndex']);
const OBJECTIVES=Object.freeze([
  {field:'absorbedLiters',direction:'maximize',unit:'L'},
  {field:'maxDepthMm',direction:'minimize',unit:'mm'},
]);
const FOOTPRINT_OBJECTIVES=Object.freeze([
  ...OBJECTIVES,
  {field:'changedCellCount',direction:'minimize',unit:'modeled grid cells'},
]);

function sortedJson(value){
  if(Array.isArray(value))return '['+value.map(sortedJson).join(',')+']';
  if(value&&typeof value==='object'){
    return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+sortedJson(value[key])).join(',')+'}';
  }
  return JSON.stringify(value);
}
export function siteIdentity(project){
  // Every retained source, observation, study and base-model input must agree.
  // The prospective intervention and two display-only fields are intentionally
  // excluded. Unknown/extension fields are NOT silently discarded.
  const stable=Object.fromEntries(Object.entries(project).filter(([key])=>!CANDIDATE_ONLY.has(key)));
  return createHash('sha256').update(sortedJson(stable),'utf8').digest('hex');
}
function finiteObjectives(row){
  for(const {field} of OBJECTIVES)
    if(typeof row[field]!=='number'||!Number.isFinite(row[field]))
      throw Error('Comparison produced an invalid numerical result');
}
const tolerance=(a,b)=>1e-9*Math.max(1,Math.abs(a),Math.abs(b));
const lessOrClose=(a,b)=>a<=b+tolerance(a,b);
const greaterOrClose=(a,b)=>a>=b-tolerance(a,b);
const strictlyLess=(a,b)=>a<b-tolerance(a,b);
const strictlyGreater=(a,b)=>a>b+tolerance(a,b);
export function dominates(a,b){
  finiteObjectives(a);
  finiteObjectives(b);
  return greaterOrClose(a.absorbedLiters,b.absorbedLiters)
    &&lessOrClose(a.maxDepthMm,b.maxDepthMm)
    &&(strictlyGreater(a.absorbedLiters,b.absorbedLiters)
      ||strictlyLess(a.maxDepthMm,b.maxDepthMm));
}

/**
 * Counts only changes that the existing base-rain calculation actually reads.
 * This is grid involvement, not physical area, construction effort or costs.
 * A changed hydraulic edge conservatively involves its two adjoining cells.
 */
export function modeledFootprint(project){
  const changed=new Set(changedBarrierCells(project.existing,project.proposal,project.width,project.height));
  for(let i=0;i<project.existing.length;i++){
    const before=project.existing[i],after=project.proposal[i];
    if(before.surface!==after.surface||before.elevationM!==after.elevationM)changed.add(i);
  }
  const changedCellIndices=[...changed].sort((a,b)=>a-b);
  return {changedCellCount:changedCellIndices.length,changedCellIndices};
}

export function footprintDominates(a,b){
  const ac=a.proposal,bc=b.proposal;
  const af=a.modeledFootprint.changedCellCount,bf=b.modeledFootprint.changedCellCount;
  finiteObjectives(ac);finiteObjectives(bc);
  if(!Number.isInteger(af)||!Number.isInteger(bf)||af<0||bf<0)
    throw Error('Comparison produced an invalid modeled footprint');
  return greaterOrClose(ac.absorbedLiters,bc.absorbedLiters)
    &&lessOrClose(ac.maxDepthMm,bc.maxDepthMm)
    &&af<=bf
    &&(strictlyGreater(ac.absorbedLiters,bc.absorbedLiters)
      ||strictlyLess(ac.maxDepthMm,bc.maxDepthMm)
      ||af<bf);
}

export async function compareProposalFiles(paths){
  if(!Array.isArray(paths)||paths.length<MIN_FILES||paths.length>MAX_FILES)
    throw Error('Provide between 2 and 16 separately exported project files');
  const candidates=[];
  let referenceIdentity=null;
  let referenceExisting=null;
  let referenceReceipt=null;
  for(const [index,path] of paths.entries()){
    const {project,sourceSHA256,sourceBytes}=await readOriginalProject(path);
    const identity=siteIdentity(project);
    if(referenceIdentity===null)referenceIdentity=identity;
    else if(identity!==referenceIdentity)
      throw Error('Input '+(index+1)+' is not the same original site, source evidence, model and storm; only proposed cells, display title and selected cell may differ');
    const receipt=computeReceipt(project,sourceSHA256,sourceBytes);
    if(referenceExisting===null){
      referenceExisting=receipt.existing;
      referenceReceipt=receipt;
    }else if(sortedJson(receipt.existing)!==sortedJson(referenceExisting)){
      throw Error('Identical original input unexpectedly produced different existing-scenario results');
    }
    finiteObjectives(receipt.proposal);
    candidates.push({
      inputOrdinal:index+1,
      title:project.title,
      originalFile:{sha256:sourceSHA256,bytes:sourceBytes},
      proposal:receipt.proposal,
      proposalMinusExisting:receipt.proposalMinusExisting,
      modeledFootprint:modeledFootprint(project),
    });
  }
  const comparison=candidates.map((entry,i)=>{
    const dominatedBy=[],dominatesOrdinals=[];
    for(let j=0;j<candidates.length;j++){
      if(i===j)continue;
      if(dominates(candidates[j].proposal,entry.proposal))dominatedBy.push(j+1);
      if(dominates(entry.proposal,candidates[j].proposal))dominatesOrdinals.push(j+1);
    }
    const footprintAwareDominatedBy=[];
    for(let j=0;j<candidates.length;j++){
      if(i!==j&&footprintDominates(candidates[j],entry))
        footprintAwareDominatedBy.push(j+1);
    }
    return {
      ...entry,dominatedBy,dominates:dominatesOrdinals,
      onNamedObjectiveFrontier:dominatedBy.length===0,
      footprintAwareDominatedBy,
      onFootprintAwareFrontier:footprintAwareDominatedBy.length===0,
    };
  });
  return {
    schema:'experimental-earth-rain-proposal-comparison/1',
    claim:'Conceptual model comparisons of explicitly saved proposals for one unchanged original site; not physical performance, cost, safety or a universal best choice.',
    originalSite:{sha256OfCanonicalUnchangedFields:referenceIdentity,
      includes:'All validated original-site, storm, observation, source and optional study fields; excludes only proposal, display title and selected cell.',
      ...referenceReceipt.geometry,
      event:referenceReceipt.event,
      existing:referenceExisting},
    objectives:OBJECTIVES,
    nearEqualRelativeTolerance:1e-9,
    candidates:comparison,
    namedObjectiveFrontier:comparison.filter(c=>c.onNamedObjectiveFrontier).map(c=>c.inputOrdinal),
    footprintAwareObjectives:FOOTPRINT_OBJECTIVES,
    footprintInterpretation:'Counts source-declared modeled grid cells whose surface, elevation or adjoining hydraulic edge changed; not actual area, cost, construction, ecology or physical safety.',
    footprintAwareFrontier:comparison.filter(c=>c.onFootprintAwareFrontier).map(c=>c.inputOrdinal),
  };
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
