import {searchHeatColumnParameters as baseline,validateHeatSearch} from './heat-column-search.js';
import {evaluateHeatColumnHypothesis} from './heat-column-evidence.js';
export const HEAT_BAND_SEARCH_METHOD='bounded-heat-band-brackets/1';
export function searchHeatColumnBands(project,query){
 const {evidence}=validateHeatSearch(project,query),report=baseline(project,query,{refine:false}),candidates=report.candidates;
 const anchor=evidence.readings.map((r,i)=>({r,i})).filter(x=>x.r.use==='calibration').sort((a,b)=>a.r.halfWidthC-b.r.halfWidthC||a.i-b.i)[0];if(!anchor)return {...report,method:HEAT_BAND_SEARCH_METHOD};
 const cache=new Map(candidates.map(c=>[c.x.toPrecision(15)+','+c.y.toPrecision(15),c]));
 function evaluate(x,y){
  const key=x.toPrecision(15)+','+y.toPrecision(15);if(cache.has(key))return cache.get(key);if(candidates.length>=400)return null;
  const h={label:'Bracket '+(candidates.length+1),capacityJm2K:Math.max(query.capacity.minimum,Math.min(query.capacity.maximum,Math.exp(Math.log(query.capacity.minimum)+x*Math.log(query.capacity.maximum/query.capacity.minimum)))),conductanceWm2K:Math.max(query.conductance.minimum,Math.min(query.conductance.maximum,query.conductance.minimum+y*(query.conductance.maximum-query.conductance.minimum))),source:query.source};
  const c={...evaluateHeatColumnHypothesis(evidence,h),id:candidates.length+1,x,y,hypothesis:h,origin:'calibration-band-bracket'};c.objective=Math.max(...c.calibration.rows.map(r=>Math.abs(r.residualC)/Math.max(evidence.readings[r.index].halfWidthC,1e-6)));candidates.push(c);cache.set(key,c);return c;
 }
 const residual=c=>c.calibration.rows.find(r=>r.index===anchor.i).residualC;
 function rootAt(x){
  let previous=evaluate(x,0),best=previous;
  for(const y of [1/64,1/16,.25,.5,.75,1]){
   if(!previous)break;
   const next=evaluate(x,y);if(!next)break;
   let a=previous,b=next;previous=next;if(next.objective<best.objective)best=next;
   if(residual(a)*residual(b)>0)continue;
   for(let iteration=0;iteration<28;iteration++){
    const c=evaluate(x,(a.y+b.y)/2);if(!c)break;if(c.objective<best.objective)best=c;
    if(Math.abs(residual(c))<Math.max(1e-10,anchor.r.halfWidthC*.01))break;
    if(residual(a)*residual(c)<=0)b=c;else a=c;
   }
  }
  return best;
 }
 for(let xi=0;xi<=8;xi++)rootAt(xi/8);
 const best=[...candidates].sort((a,b)=>a.objective-b.objective)[0];let left=Math.max(0,best.x-.125),right=Math.min(1,best.x+.125);
 for(let iteration=0;iteration<8&&candidates.length<400;iteration++){
  const a=rootAt(left+(right-left)/3),b=rootAt(right-(right-left)/3);if(!a||!b)break;
  if(a.objective<b.objective)right=right-(right-left)/3;else left=left+(right-left)/3;
 }

 const compatibleIds=candidates.filter(c=>c.calibration.compatible).map(c=>c.id);
 return {...report,method:HEAT_BAND_SEARCH_METHOD,anchorReadingIndex:anchor.i,stopReason:candidates.length>=400?'evaluation-budget':'finite-samples-completed',semantics:'Bounded original-band search, not a continuous feasible enclosure or global impossibility proof. A sampled narrow-reading center crossing proposes a pair; every original calibration band still decides compatibility. Finite brackets may miss tangencies, multiple crossings within one interval or unsampled capacity regions. Held-aside readings never steer samples or ranking. No physical parameter is adopted.',status:compatibleIds.length?'compatible-proposals':'no-compatible-proposal-found',candidates,compatibleIds,evaluations:candidates.length};
}

export function serializeHeatBandSearch(project,query){validateHeatSearch(project,query);return JSON.stringify({method:HEAT_BAND_SEARCH_METHOD,project,query},null,2);}
export function parseHeatBandSearch(text){
 if(typeof text!=='string'||new TextEncoder().encode(text).length>6*1024*1024)throw Error('Heat band search source file exceeds 6 MiB');
 const v=JSON.parse(text);if(!v||v.method!==HEAT_BAND_SEARCH_METHOD||Object.keys(v).sort().join(',')!=='method,project,query')throw Error('Expected original heat band search source and method');
 validateHeatSearch(v.project,v.query);return v;
}
