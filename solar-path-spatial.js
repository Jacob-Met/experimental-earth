import {SUN_PATH_LIMITS,sunPathCellCourse} from './solar-path.js';

export const SUN_PAIR_CATEGORIES=Object.freeze({
  additional:'Additional mapped obstruction',
  removed:'Removed mapped obstruction',
  'unchanged-blocked':'Blocked in both scenarios',
  'unchanged-no-blocker':'No mapped blocker in either scenario',
  unresolved:'Height-dependent or grazing comparison',
  footprint:'At least one declared obstruction footprint',
  'low-elevation':'Calculated sun below the obstruction model limit',
  'below-horizon':'Calculated sun centre at or below the horizon',
});
const statuses=['blocked','no-mapped-blocker','height-dependent','grazing','footprint','low-elevation','below-horizon'];
const counts=keys=>Object.fromEntries(keys.map(key=>[key,0]));
const categoryKeys=Object.keys(SUN_PAIR_CATEGORIES);
const courseKey=report=>JSON.stringify([report.model??null,report.declaration??null,report.samples.map(s=>s.utc)]);
export const SUN_SPATIAL_SEMANTICS='Each tile represents one retained ground centre. Counts are discrete sampled instants, not whole-cell coverage, shaded area or duration. Additional and removed mapped obstruction are separate; uncertainty, footprints and low/below-horizon samples are never counted as clear. No mapped blocker still leaves off-map objects, cloud and foliage unknown.';

export function sunPathPairCategory(existing,proposal){
  if(!statuses.includes(existing)||!statuses.includes(proposal))throw Error('Unknown sun-path classification.');
  if(existing==='below-horizon'||proposal==='below-horizon')return 'below-horizon';
  if(existing==='low-elevation'||proposal==='low-elevation')return 'low-elevation';
  if(existing==='footprint'||proposal==='footprint')return 'footprint';
  if([existing,proposal].some(s=>s==='height-dependent'||s==='grazing'))return 'unresolved';
  if(existing===proposal)return existing==='blocked'?'unchanged-blocked':'unchanged-no-blocker';
  return proposal==='blocked'?'additional':'removed';
}

/** Summarize a complete maintained report without running or approximating its physics. */
export function summarizeSunPathSpatial(report){
  if(report?.schema!=='experimental-earth-sun-path/1'||!Number.isSafeInteger(report.width)
    ||!Number.isSafeInteger(report.height)||report.width<1||report.height<1
    ||!Array.isArray(report.samples)||report.samples.length<2||report.samples.length>SUN_PATH_LIMITS.maxSamples){
    throw Error('Use a complete maintained sun-path report.');
  }
  const cellCount=report.width*report.height,sampleCount=report.samples.length;
  if(!Number.isSafeInteger(cellCount)||6*cellCount*(cellCount-1)*sampleCount>SUN_PATH_LIMITS.maxRayTests){
    throw Error('The complete spatial course exceeds the maintained work bound.');
  }
  const times=report.samples.map((sample,index)=>{
    if(typeof sample.utc!=='string'||!Number.isFinite(Date.parse(sample.utc))
      ||index>0&&Date.parse(sample.utc)<=Date.parse(report.samples[index-1].utc))throw Error('Retain strictly increasing original UTC samples.');
    if(!['modeled','low-elevation','below-horizon'].includes(sample.condition))throw Error('Unknown sun-path sample condition.');
    if(sample.condition==='modeled'&&(!Array.isArray(sample.existing)||!Array.isArray(sample.proposal)
      ||sample.existing.length!==cellCount||sample.proposal.length!==cellCount))throw Error('Every modeled time must retain the complete paired grid.');
    return {index,utc:sample.utc,categories:[],counts:counts(categoryKeys)};
  });
  const cells=Array.from({length:cellCount},(_,cellIndex)=>{
    const byCategory=counts(categoryKeys),existingCounts=counts(statuses),proposalCounts=counts(statuses);
    for(const [index,row]of sunPathCellCourse(report,cellIndex).entries()){
      const a=row.existing?.status,b=row.proposal?.status,category=sunPathPairCategory(a,b);
      byCategory[category]++;existingCounts[a]++;proposalCounts[b]++;
      times[index].categories.push(category);times[index].counts[category]++;
    }
    const limitedSamples=byCategory.unresolved+byCategory.footprint+byCategory['low-elevation']+byCategory['below-horizon'];
    const pattern=byCategory.additional&&byCategory.removed?'mixed':byCategory.additional?'additional':byCategory.removed?'removed':limitedSamples?'limited':'unchanged';
    return {cellIndex,counts:byCategory,existingCounts,proposalCounts,limitedSamples,pattern};
  });
  return {schema:'experimental-earth-sun-spatial/1',sourceContext:report.sourceContext,courseKey:courseKey(report),
    width:report.width,height:report.height,sampleCount,cells,times,semantics:SUN_SPATIAL_SEMANTICS};
}

/** Select an original pair, including its original witness; never replace it with a map score. */
export function inspectSunPathSpatial(report,summary,cellIndex,sampleIndex){
  if(summary?.schema!=='experimental-earth-sun-spatial/1'||summary.sourceContext!==report?.sourceContext
    ||summary.width!==report.width||summary.height!==report.height||summary.sampleCount!==report.samples.length||summary.courseKey!==courseKey(report)){
    throw Error('The spatial summary belongs to a different source course.');
  }
  if(!Number.isInteger(sampleIndex)||sampleIndex<0||sampleIndex>=summary.sampleCount)throw Error('Choose an original sampled UTC instant.');
  const row=sunPathCellCourse(report,cellIndex)[sampleIndex];
  if(row.utc!==summary.times[sampleIndex].utc||sunPathPairCategory(row.existing.status,row.proposal.status)!==summary.times[sampleIndex].categories[cellIndex]){
    throw Error('The original sampled course changed; rebuild its map.');
  }
  return {...row,cellIndex,sampleIndex,category:summary.times[sampleIndex].categories[cellIndex],counts:{...summary.cells[cellIndex].counts}};
}
