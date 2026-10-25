import {runRain} from './core.js';
import {evaluateReadings} from './infiltration-study.js';
import {searchSoilParameters,validateSoilSearch,serializeSoilSearch,parseSoilSearch} from './wetting-front-search.js';

export const MAX_REFINEMENT_EVALUATIONS = 600;
export const MAX_REFINEMENT_CELL_STEPS = 3_000_000;
const method = 'calibration-simplex-search/1';

/** Bounded local search. All proposals remain visible; no continuous coverage claim. */
export function refineSoilParameters(project,query) {
  const admission=validateSoilSearch(project,query);
  const oneRun=project.width*project.height*Math.ceil(project.weather.durationMinutes/project.weather.stepMinutes);
  if(oneRun*(admission.conductivity.length*admission.drive.length+MAX_REFINEMENT_EVALUATIONS)>MAX_REFINEMENT_CELL_STEPS)
    throw Error(`Soil refinement exceeds ${MAX_REFINEMENT_CELL_STEPS} reserved cell-steps; reduce the source event or grid`);
  const coarse=searchSoilParameters(project,query);
  const report={...coarse,method,coarseCount:coarse.candidates.length,addedCount:0,refinementStatus:'not-run'};
  if(!coarse.candidates.length)return report;
  const calibration=project.observations.map((reading,index)=>({reading,index})).filter(x=>x.reading.scenario===query.target&&x.reading.use==='calibration');
  const challenge=project.observations.map((reading,index)=>({reading,index})).filter(x=>x.reading.scenario===query.target&&x.reading.use==='challenge');
  const candidates=coarse.candidates.map(c=>({...c,origin:'declared-grid'}));
  const scale=(v,a)=>(v-a.min)/(a.max-a.min);
  const physical=(v,a)=>a.min+(a.max-a.min)*v;
  const key=(k,a)=>`${k.toPrecision(15)},${a.toPrecision(15)}`;
  const cache=new Map(candidates.map(c=>[key(c.conductivityMmHr,c.capillaryDriveMm),c]));
  let added=0;
  function evaluate(x,y){
    x=Math.max(0,Math.min(1,x));y=Math.max(0,Math.min(1,y));
    const k=physical(x,query.conductivity),a=physical(y,query.drive),id=key(k,a);
    if(cache.has(id))return cache.get(id);
    if(added>=MAX_REFINEMENT_EVALUATIONS)return null;
    const result=runRain(project[query.target],project.width,project.height,project.weather,{surfaceWettingFront:{surface:query.surface,conductivityMmHr:k,capillaryDriveMm:a}});
    const c={id:coarse.candidates.length+(++added),conductivityMmHr:k,capillaryDriveMm:a,boundary:x===0||x===1||y===0||y===1,origin:'calibration-refinement',calibration:evaluateReadings(result,calibration),challenge:evaluateReadings(result,challenge),massErrorLiters:result.massErrorLiters};
    candidates.push(c);cache.set(id,c);return c;
  }
  // Seed choice, acceptance and stopping never inspect held-aside predictions.
  const seeds=coarse.candidates.slice(0,3);
  let exhausted=false;
  for(const seed of seeds){
    const seedLimit=Math.min(MAX_REFINEMENT_EVALUATIONS,added+200);
    const point=c=>({x:scale(c.conductivityMmHr,query.conductivity),y:scale(c.capillaryDriveMm,query.drive),c});
    const x=scale(seed.conductivityMmHr,query.conductivity),y=scale(seed.capillaryDriveMm,query.drive);
    const dx=.5/(query.conductivity.count-1),dy=.5/(query.drive.count-1);
    const at=(x,y)=>{if(added>=seedLimit)return null;const c=evaluate(x,y);return c?point(c):null;};
    let simplex=[point(seed),at(x+(x>.5?-dx:dx),y),at(x,y+(y>.5?-dy:dy))];
    if(simplex.some(p=>!p)){exhausted=true;break;}
    const loss=p=>p.c.calibration.rmseMm;
    let resolved=false;
    for(let iteration=0;iteration<100&&added<seedLimit;iteration++){
      simplex.sort((a,b)=>loss(a)-loss(b)||a.c.id-b.c.id);
      const [best,middle,worst]=simplex;
      if(Math.max(...simplex.map(p=>Math.hypot(p.x-best.x,p.y-best.y)))<1e-7){resolved=true;break;}
      const cx=(best.x+middle.x)/2,cy=(best.y+middle.y)/2;
      const reflected=at(2*cx-worst.x,2*cy-worst.y);if(!reflected)break;
      if(loss(reflected)<loss(best)){
        const expanded=at(cx+2*(reflected.x-cx),cy+2*(reflected.y-cy));
        simplex[2]=expanded&&loss(expanded)<loss(reflected)?expanded:reflected;
      }else if(loss(reflected)<loss(middle))simplex[2]=reflected;
      else{
        const outside=loss(reflected)<loss(worst);
        const contracted=at(cx+.5*((outside?reflected:worst).x-cx),cy+.5*((outside?reflected:worst).y-cy));
        if(contracted&&loss(contracted)<(outside?loss(reflected):loss(worst)))simplex[2]=contracted;
        else{
          const a=at(best.x+.5*(middle.x-best.x),best.y+.5*(middle.y-best.y));
          const b=at(best.x+.5*(worst.x-best.x),best.y+.5*(worst.y-best.y));
          if(!a||!b)break;simplex=[best,a,b];
        }
      }
    }
    if(!resolved)exhausted=true;
  }
  candidates.sort((a,b)=>a.calibration.rmseMm-b.calibration.rmseMm||a.id-b.id);
  const compatibleIds=candidates.filter(c=>c.calibration.compatible).map(c=>c.id);
  const best=candidates[0].calibration.rmseMm;
  return {...report,candidates,compatibleIds,closestIds:candidates.filter(c=>Math.abs(c.calibration.rmseMm-best)<=1e-9*Math.max(1,best)).map(c=>c.id),status:compatibleIds.length?'computed':'calibration-rejected',addedCount:added,cellSteps:oneRun*candidates.length,refinementStatus:exhausted?'budget-stopped':'local-resolution-stopped'};
}
export function serializeSoilRefinement(project,query){return JSON.stringify({method,source:JSON.parse(serializeSoilSearch(project,query))},null,2);}
export function parseSoilRefinement(text){
  if(typeof text!=='string'||new TextEncoder().encode(text).length>6*1024*1024)throw Error('Refinement file exceeds 6 MiB');
  const value=JSON.parse(text);
  if(!value||value.method!==method||Object.keys(value).some(k=>!['method','source'].includes(k)))throw Error('Expected original refinement inputs and supported method');
  return parseSoilSearch(JSON.stringify(value.source));
}
