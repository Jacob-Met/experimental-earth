import {compare,SURFACES,validateProject} from './core.js';

function selectedSeries(result,cellIndex,cellCount,duration){
  if(!Array.isArray(result.snapshots)||result.snapshots.length<2)throw Error('No complete retained model course was produced');
  const minutes=[],depthsMm=[];
  for(const snapshot of result.snapshots){
    if(!Number.isFinite(snapshot.minute)||snapshot.minute<0||
       (minutes.length&&snapshot.minute<=minutes.at(-1))||
       !Array.isArray(snapshot.depthsMm)||snapshot.depthsMm.length!==cellCount)
      throw Error('The retained model course has inconsistent times or cells');
    const depth=snapshot.depthsMm[cellIndex];
    if(!Number.isFinite(depth)||depth<0)throw Error('The selected cell produced an invalid modeled depth');
    minutes.push(snapshot.minute);depthsMm.push(depth);
  }
  if(minutes[0]!==0||minutes.at(-1)!==duration)throw Error('The retained model course does not cover the complete event');
  return {minutes,depthsMm};
}

const equalArray=(a,b)=>a.length===b.length&&a.every((value,index)=>value===b[index]);

/**
 * Supplement the already-qualified aggregate comparison with one cell's exact
 * native snapshot course. No interpolation, model override or source adoption.
 * Adapters provide the same original-byte intake and context hash as the report.
 */
export async function compareProposalCellSources(sources,{cellIndex,comparisonReport,readSource,hashIdentity}){
  if(!Array.isArray(sources)||sources.length<2||sources.length>16)
    throw Error('Provide between 2 and 16 separately exported project files');
  const site=comparisonReport?.originalSite,expected=comparisonReport?.candidates;
  if(comparisonReport?.schema!=='experimental-earth-rain-proposal-comparison/1'||
     !site||!Array.isArray(expected)||expected.length!==sources.length||
     typeof site.sha256OfCanonicalUnchangedFields!=='string')
    throw Error('Compare the original files before inspecting a cell');
  if(!Number.isInteger(cellIndex)||cellIndex<0)throw Error('Choose a cell inside the shared original grid');
  const candidates=[];
  let snapshotMinutes=null,existing=null,geometry=null;
  for(const [index,source] of sources.entries()){
    const {project,sourceSHA256,sourceBytes}=await readSource(source);
    validateProject(project);
    if(project.width!==site.width||project.height!==site.height||project.weather.cellSizeM!==site.cellSizeM||
       cellIndex>=project.width*project.height)
      throw Error('Choose a cell inside the unchanged original comparison grid');
    const original=expected[index];
    if(original?.inputOrdinal!==index+1||original?.originalFile?.sha256!==sourceSHA256||
       original?.originalFile?.bytes!==sourceBytes||original.title!==project.title)
      throw Error('Input '+(index+1)+' no longer matches the original file used for this comparison; compare the files again');
    const identity=await hashIdentity(project);
    if(identity!==site.sha256OfCanonicalUnchangedFields)
      throw Error('Input '+(index+1)+' is not the same original site, source evidence, model and storm');
    const worlds=compare(project);
    const reference=selectedSeries(worlds.existing,cellIndex,project.width*project.height,project.weather.durationMinutes);
    const proposed=selectedSeries(worlds.proposal,cellIndex,project.width*project.height,project.weather.durationMinutes);
    if(!equalArray(reference.minutes,proposed.minutes))throw Error('Existing and proposed results do not share the same retained model times');
    if(snapshotMinutes===null){
      snapshotMinutes=reference.minutes;
      existing={surfaceName:SURFACES[project.existing[cellIndex].surface].label,depthsMm:reference.depthsMm};
      geometry={width:project.width,height:project.height,cellSizeM:project.weather.cellSizeM};
    }else if(!equalArray(snapshotMinutes,reference.minutes)||!equalArray(existing.depthsMm,reference.depthsMm)){
      throw Error('Identical original input unexpectedly produced different existing-site local results');
    }
    candidates.push({inputOrdinal:index+1,title:project.title,
      originalFile:{sha256:sourceSHA256,bytes:sourceBytes},
      surfaceName:SURFACES[project.proposal[cellIndex].surface].label,
      depthsMm:proposed.depthsMm,
      proposalMinusExistingMm:proposed.depthsMm.map((depth,i)=>depth-existing.depthsMm[i])});
    // Only this cell's series survives the iteration; complete grids stay local.
  }
  const column=cellIndex%geometry.width,row=Math.floor(cellIndex/geometry.width);
  return {schema:'experimental-earth-rain-proposal-local-depth/1',
    cell:{index:cellIndex,label:String.fromCharCode(65+column)+(row+1),row:row+1,column:column+1},
    originalSite:{sha256OfCanonicalUnchangedFields:site.sha256OfCanonicalUnchangedFields,...geometry},
    snapshotMinutes,existing,candidates};
}
