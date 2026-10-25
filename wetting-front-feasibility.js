import {runRain} from './core.js';
import {evaluateReadings} from './infiltration-study.js';
import {validateSoilSearch,serializeSoilSearch,parseSoilSearch} from './wetting-front-search.js';
import {MAX_REFINEMENT_EVALUATIONS,MAX_REFINEMENT_CELL_STEPS,refineSoilParameters} from './wetting-front-refinement.js';

export const SOIL_FEASIBILITY_METHOD='calibration-band-crossings/1';
/** Propose explicit crossings of one original band; never enclose an unsampled region. */
export function seekSoilFeasibility(project,query){
 const admission=validateSoilSearch(project,query);
 const oneRun=project.width*project.height*Math.ceil(project.weather.durationMinutes/project.weather.stepMinutes);
 if(oneRun*(admission.conductivity.length*admission.drive.length+MAX_REFINEMENT_EVALUATIONS)>MAX_REFINEMENT_CELL_STEPS)
   throw Error(`Soil feasibility exceeds ${MAX_REFINEMENT_CELL_STEPS} reserved cell-steps; reduce the source event or grid`);
 const coarse=refineSoilParameters(project,query),candidates=coarse.candidates.map(c=>({...c}));
 const report={...coarse,method:SOIL_FEASIBILITY_METHOD,coarseCount:coarse.coarseCount,simplexCount:candidates.length,simplexCompatibleCount:coarse.compatibleIds.length,addedCount:coarse.addedCount,bandAddedCount:0,refinementStatus:'not-run',anchor:null,driveValues:[],brackets:0,completedBrackets:0};
 if(!candidates.length)return report;
 const all=project.observations.map((reading,index)=>({reading,index}));
 const calibration=all.filter(x=>x.reading.scenario===query.target&&x.reading.use==='calibration');
 const challenge=all.filter(x=>x.reading.scenario===query.target&&x.reading.use==='challenge');
 const anchor=[...calibration].sort((a,b)=>a.reading.uncertaintyMm-b.reading.uncertaintyMm||a.index-b.index)[0];
 const anchorPosition=calibration.findIndex(x=>x.index===anchor.index);
 const targets=[...new Set([anchor.reading.depthMm,Math.max(0,anchor.reading.depthMm-anchor.reading.uncertaintyMm),anchor.reading.depthMm+anchor.reading.uncertaintyMm])];
 const driveValues=[...admission.drive,...admission.drive.slice(1).map((a,i)=>(a+admission.drive[i])/2)];
 const key=(k,a)=>`${k.toPrecision(17)},${a.toPrecision(17)}`;
 const cache=new Map(candidates.map(c=>[key(c.conductivityMmHr,c.capillaryDriveMm),c]));
 let added=coarse.addedCount,brackets=0,completedBrackets=0,budgetStopped=false;
 function evaluate(k,a){
  const id=key(k,a);if(cache.has(id))return cache.get(id);
  if(added>=MAX_REFINEMENT_EVALUATIONS){budgetStopped=true;return null;}
  const result=runRain(project[query.target],project.width,project.height,project.weather,{surfaceWettingFront:{surface:query.surface,conductivityMmHr:k,capillaryDriveMm:a}});
  const c={id:coarse.coarseCount+(++added),conductivityMmHr:k,capillaryDriveMm:a,boundary:k===query.conductivity.min||k===query.conductivity.max||a===query.drive.min||a===query.drive.max,origin:'original-band-crossing',calibration:evaluateReadings(result,calibration),challenge:evaluateReadings(result,challenge),massErrorLiters:result.massErrorLiters};
  candidates.push(c);cache.set(id,c);return c;
 }
 // Each level visits every offered A before the next level. A's original grid
 // comes before midpoints; every adjacent sampled K bracket is considered.
 outer:for(const target of targets)for(const a of driveValues){
  const rows=[];for(const k of admission.conductivity){const row=evaluate(k,a);if(!row)break outer;rows.push(row);}
  for(let i=1;i<rows.length;i++){
   let left=rows[i-1],right=rows[i];
   let fl=left.calibration.errors[anchorPosition].depthMm-target,fr=right.calibration.errors[anchorPosition].depthMm-target;
   if(fl===0||fr===0||Math.sign(fl)===Math.sign(fr))continue;
   brackets++;
   for(let step=0;step<40;step++){
    const k=(left.conductivityMmHr+right.conductivityMmHr)/2;
    if(k===left.conductivityMmHr||k===right.conductivityMmHr){completedBrackets++;break;}
    const middle=evaluate(k,a);if(!middle)break outer;
    const fm=middle.calibration.errors[anchorPosition].depthMm-target;
    // This stops computation near the offered original level, not a rigorous
    // root or parameter interval. Every result is still screened individually.
    if(Math.abs(fm)<=1e-10*Math.max(1,target)){completedBrackets++;break;}
    if(Math.sign(fl)!==Math.sign(fm)){right=middle;fr=fm;}else{left=middle;fl=fm;}
    if(step===39)budgetStopped=true;
   }
  }
 }
 candidates.sort((a,b)=>a.calibration.rmseMm-b.calibration.rmseMm||a.id-b.id);
 const compatibleIds=candidates.filter(c=>c.calibration.compatible).map(c=>c.id),best=candidates[0].calibration.rmseMm;
 return {...report,candidates,compatibleIds,closestIds:candidates.filter(c=>Math.abs(c.calibration.rmseMm-best)<=1e-9*Math.max(1,best)).map(c=>c.id),status:compatibleIds.length?'computed':'calibration-rejected',addedCount:added,bandAddedCount:added-coarse.addedCount,cellSteps:oneRun*candidates.length,anchor:{index:anchor.index,...structuredClone(anchor.reading)},driveValues,brackets,completedBrackets,refinementStatus:budgetStopped?'budget-stopped':'sampled-crossings-completed'};
}
export function serializeSoilFeasibility(project,query){return JSON.stringify({method:SOIL_FEASIBILITY_METHOD,source:JSON.parse(serializeSoilSearch(project,query))},null,2);}
export function parseSoilFeasibility(text){
 if(typeof text!=='string'||new TextEncoder().encode(text).length>6*1024*1024)throw Error('Feasibility file exceeds 6 MiB');
 const value=JSON.parse(text);
 if(!value||value.method!==SOIL_FEASIBILITY_METHOD||Object.keys(value).some(k=>!['method','source'].includes(k)))throw Error('Expected original feasibility inputs and supported method');
 return parseSoilSearch(JSON.stringify(value.source));
}
