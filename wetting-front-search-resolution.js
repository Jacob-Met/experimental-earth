import {validateSoilSearch,searchSoilParameters,MAX_SOIL_SEARCH_CELL_STEPS} from './wetting-front-search.js';
export const MAX_SOIL_SEARCH_RESOLUTION_CELL_STEPS = 2_000_000;
const same=(a,b)=>a.length===b.length&&a.every(id=>b.includes(id));
/** The exact same finite parameter population at distinct admitted calculation intervals. */
export function compareSoilSearchResolution(project,query){
  const admission=validateSoilSearch(project,query),baseStepMinutes=project.weather.stepMinutes;
  const stepsMinutes=[...new Set([baseStepMinutes,Math.max(1,baseStepMinutes/2),Math.max(1,baseStepMinutes/4)])];
  const pairs=admission.conductivity.length*admission.drive.length;
  const cellSteps=project.width*project.height*pairs*stepsMinutes.reduce((sum,step)=>sum+Math.ceil(project.weather.durationMinutes/step),0);
  const base={schema:'experimental-earth-soil-search-resolution/1',sourceSignature:JSON.stringify(project),query:structuredClone(query),baseStepMinutes,stepsMinutes,cellSteps,runs:[],candidates:[]};
  if(stepsMinutes.length<2)return {...base,status:'minimum-step'};
  if(cellSteps>MAX_SOIL_SEARCH_RESOLUTION_CELL_STEPS || stepsMinutes.some(step=>project.width*project.height*pairs*Math.ceil(project.weather.durationMinutes/step)>MAX_SOIL_SEARCH_CELL_STEPS))return {...base,status:'work-limit'};
  // Each solver request keeps source notebook, geometry and query; only dt differs.
  const runs=stepsMinutes.map(stepMinutes=>({stepMinutes,...searchSoilParameters({...project,weather:{...project.weather,stepMinutes}},query)}));
  if(!runs[0].candidates.length)return {...base,status:runs[0].status,runs};
  const candidates=runs[0].candidates.map(row=>{
    const matches=runs.map(run=>run.candidates.find(x=>x.id===row.id));
    const readings=['calibration','challenge'].flatMap(role=>row[role].errors.map(error=>{
      const predictions=matches.map((candidate,i)=>({stepMinutes:stepsMinutes[i],...candidate[role].errors.find(x=>x.index===error.index)}));
      const depths=predictions.map(x=>x.depthMm);
      return {index:error.index,role,predictions,spreadMm:Math.max(...depths)-Math.min(...depths),bandChanged:predictions.some(x=>x.withinBand!==predictions[0].withinBand)};
    }));
    return {id:row.id,conductivityMmHr:row.conductivityMmHr,capillaryDriveMm:row.capillaryDriveMm,readings};
  });
  const changes={compatible:runs.some(run=>!same(run.compatibleIds,runs[0].compatibleIds)),closest:runs.some(run=>!same(run.closestIds,runs[0].closestIds)),readingBands:candidates.some(row=>row.readings.some(x=>x.bandChanged))};
  return {...base,runs,candidates,changes,status:Object.values(changes).some(Boolean)?'step-sensitive':'no-decision-change',meaning:'Finite calculation-interval sensitivity of the same declared grid. No convergence, physical accuracy, continuous parameter uniqueness or replacement of original evidence is established.'};
}
