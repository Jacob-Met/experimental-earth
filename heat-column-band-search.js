import {searchHeatColumnParameters as baseline,validateHeatSearch} from './heat-column-search.js';
import {evaluateHeatColumnHypothesis} from './heat-column-evidence.js';
export const HEAT_BAND_SEARCH_METHOD='bounded-heat-band-brackets/1';
export const HEAT_BAND_COVERAGE_METHOD='bounded-heat-distributed-bands/1';
function searchBands(project,query,distributed=false){
 const method=distributed?HEAT_BAND_COVERAGE_METHOD:HEAT_BAND_SEARCH_METHOD;
 const {evidence}=validateHeatSearch(project,query),report=baseline(project,query,{refine:false}),candidates=report.candidates;
 const anchor=evidence.readings.map((r,i)=>({r,i})).filter(x=>x.r.use==='calibration').sort((a,b)=>a.r.halfWidthC-b.r.halfWidthC||a.i-b.i)[0];if(!anchor)return {...report,method,...(distributed?{capacitySampling:{strategy:'breadth-first-log-capacity-midpoints',lines:[]}}:{})};
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
 const lines=[];
 function sampleLine(x,phase){const before=candidates.length;rootAt(x);lines.push({normalizedLogCapacity:x,phase,evaluations:candidates.length-before,status:before>=400?'not-attempted':candidates.length>=400?'budget-limited':'completed'});}
 if(distributed){
  for(let xi=0;xi<=8;xi++)sampleLine(xi/8,'initial-grid');
  const queue=Array.from({length:8},(_,i)=>[i/8,(i+1)/8]);
  while(queue.length&&candidates.length<400){const [left,right]=queue.shift(),middle=(left+right)/2;sampleLine(middle,'interval-midpoint');queue.push([left,middle],[middle,right]);}
 }else{
  for(let xi=0;xi<=8;xi++)rootAt(xi/8);
 const best=[...candidates].sort((a,b)=>a.objective-b.objective)[0];let left=Math.max(0,best.x-.125),right=Math.min(1,best.x+.125);
 for(let iteration=0;iteration<8&&candidates.length<400;iteration++){
  const a=rootAt(left+(right-left)/3),b=rootAt(right-(right-left)/3);if(!a||!b)break;
  if(a.objective<b.objective)right=right-(right-left)/3;else left=left+(right-left)/3;
 }
 }


 const compatibleIds=candidates.filter(c=>c.calibration.compatible).map(c=>c.id);
 return {...report,method,...(distributed?{capacitySampling:{strategy:'breadth-first-log-capacity-midpoints',lines,completeLineCount:lines.filter(x=>x.status==='completed').length,budgetLimitedLineCount:lines.filter(x=>x.status==='budget-limited').length,semantics:'Completed means the maintained finite conductance scan finished before the global budget, not a continuous feasible-capacity enclosure. A final budget-limited line retains all actually evaluated candidates. Distributed sampling can miss narrow feasible regions found by the incumbent local refinement.'}}:{}),anchorReadingIndex:anchor.i,stopReason:candidates.length>=400?'evaluation-budget':'finite-samples-completed',semantics:'Bounded original-band search, not a continuous feasible enclosure or global impossibility proof. A sampled narrow-reading center crossing proposes a pair; every original calibration band still decides compatibility. Finite brackets may miss tangencies, multiple crossings within one interval or unsampled capacity regions. Held-aside readings never steer samples or ranking. No physical parameter is adopted.',status:compatibleIds.length?'compatible-proposals':'no-compatible-proposal-found',candidates,compatibleIds,evaluations:candidates.length};
}

export function searchHeatColumnBands(project,query){return searchBands(project,query,false);}
export function searchHeatColumnCoverage(project,query){return searchBands(project,query,true);}

export function serializeHeatBandSearch(project,query){validateHeatSearch(project,query);return JSON.stringify({method:HEAT_BAND_SEARCH_METHOD,project,query},null,2);}
export function parseHeatBandSearch(text){
 if(typeof text!=='string'||new TextEncoder().encode(text).length>6*1024*1024)throw Error('Heat band search source file exceeds 6 MiB');
 const v=JSON.parse(text);if(!v||v.method!==HEAT_BAND_SEARCH_METHOD||Object.keys(v).sort().join(',')!=='method,project,query')throw Error('Expected original heat band search source and method');
 validateHeatSearch(v.project,v.query);return v;
}

export const HEAT_BAND_COMBINED_METHOD='bounded-heat-combined-bands/1';
export function searchHeatColumnCombined(project,query){
 const {reservedWork}=validateHeatSearch(project,query);
 if(reservedWork*2>2_000_000)throw Error('Combined searches exceed the 2000000 course-sample budget');
 const focused=searchHeatColumnBands(project,query),distributed=searchHeatColumnCoverage(project,query),unique=new Map();
 for(const [method,report]of [[HEAT_BAND_SEARCH_METHOD,focused],[HEAT_BAND_COVERAGE_METHOD,distributed]])for(const candidate of report.candidates){
  const key=JSON.stringify([candidate.hypothesis.capacityJm2K,candidate.hypothesis.conductanceWm2K]);
  if(!unique.has(key))unique.set(key,{...candidate,id:unique.size+1,provenance:[]});
  unique.get(key).provenance.push({method,candidateId:candidate.id,origin:candidate.origin});
 }
 const candidates=[...unique.values()],compatibleIds=candidates.filter(c=>c.calibration.compatible).map(c=>c.id);
 return {...focused,method:HEAT_BAND_COMBINED_METHOD,evaluations:focused.evaluations+distributed.evaluations,candidates,compatibleIds,coarseCompatibleIds:candidates.filter(c=>c.calibration.compatible&&c.provenance.some(p=>p.origin==='coarse-grid')).map(c=>c.id),reservedWork:reservedWork*2,
 status:focused.status==='need-calibration'?'need-calibration':compatibleIds.length?'compatible-proposals':'no-compatible-proposal-found',stopReason:'both-bounded-searches-completed',
 producers:[focused,distributed].map(r=>({method:r.method,evaluations:r.evaluations,compatibleCount:r.compatibleIds.length,stopReason:r.stopReason})),capacitySampling:distributed.capacitySampling,
 semantics:'Union of every actually tested focused and distributed band-search proposal; only exactly identical capacity/conductance pairs are deduplicated and all producer IDs are retained. Every incumbent compatible explanation remains available. Up to 800 actual evaluations, not 400. Broader finite sampling is not continuous-domain coverage or a physical guarantee; held-aside readings do not select producers or drop proposals.'};
}
export function serializeHeatCombinedSearch(project,query){validateHeatSearch(project,query);return JSON.stringify({method:HEAT_BAND_COMBINED_METHOD,project,query},null,2);}
export function parseHeatCombinedSearch(text){
 if(typeof text!=='string'||new TextEncoder().encode(text).length>6*1024*1024)throw Error('Combined heat search source file exceeds 6 MiB');
 const v=JSON.parse(text);if(!v||v.method!==HEAT_BAND_COMBINED_METHOD||Object.keys(v).sort().join(',')!=='method,project,query')throw Error('Expected original combined heat search source and method');
 validateHeatSearch(v.project,v.query);return v;
}
