// Original comparison sources -> same offline field-sheet readings as the native CLI.
// This intentionally runs only after the stricter browser source-context validation.
import {compare} from './core.js';
import {canonicalSiteSource} from './rain-proposal-comparison.js';
import {buildPairedWaterPayload} from './paired-water-payload.js';

export function pairedWaterPayloadFromSources(sources){
  if(!Array.isArray(sources)||sources.length!==2)throw Error('The field sheet requires exactly two saved projects.');
  const [a,b]=sources;
  if(canonicalSiteSource(a.project)!==canonicalSiteSource(b.project))
    throw Error('Projects must share their complete unchanged source context.');
  for(const source of sources)
    if(!/^[0-9a-f]{64}$/.test(source.sourceSHA256))
      throw Error('The original file identity is missing.');
  const x=compare(a.project),y=compare(b.project);
  const ea=x.existing.snapshots,eb=y.existing.snapshots;
  const pa=x.proposal.snapshots,pb=y.proposal.snapshots;
  if(!ea.length||ea.length!==eb.length||ea.length!==pa.length||ea.length!==pb.length)
    throw Error('Paired histories have incompatible snapshot counts.');
  const values=[];
  let last=-Infinity;
  for(let i=0;i<ea.length;i++){
    if(!Number.isFinite(ea[i].minute)||ea[i].minute<=last||
       ea[i].minute!==eb[i].minute||ea[i].minute!==pa[i].minute||
       ea[i].minute!==pb[i].minute||
       !Object.is(ea[i].storedLiters,eb[i].storedLiters)||
       ![ea[i].storedLiters,pa[i].storedLiters,pb[i].storedLiters].every(Number.isFinite))
      throw Error('The retained modeled baselines or snapshot timestamps disagree.');
    const delta=pb[i].storedLiters-pa[i].storedLiters;
    if(!Number.isFinite(delta))throw Error('Nonfinite modeled difference.');
    values.push({minute:ea[i].minute,delta});
    last=ea[i].minute;
  }
  const deltas=values.map(value=>value.delta);
  const min=Math.min(...deltas),max=Math.max(...deltas);
  const stats={
    bAboveA:deltas.filter(value=>value>0).length,
    bBelowA:deltas.filter(value=>value<0).length,
    equal:deltas.filter(value=>value===0).length,
    minimumLitres:min,minimumAtMinutes:values.filter(value=>value.delta===min).map(value=>value.minute),
    maximumLitres:max,maximumAtMinutes:values.filter(value=>value.delta===max).map(value=>value.minute),
    bothSignsPresent:min<0&&max>0,
  };
  return buildPairedWaterPayload(
    {project:a.project,digest:a.sourceSHA256},
    {project:b.project,digest:b.sourceSHA256},ea,pa,pb,stats);
}
