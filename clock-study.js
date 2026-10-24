import {validateProject} from './core.js';
import {validateStudy} from './study-contract.js';
import {compareInfiltration} from './infiltration-study.js';
export function compareClockOffsets(project, offsetsMinutes, study=project.infiltrationStudy) {
 validateProject(project);validateStudy(study);
 if(!Array.isArray(offsetsMinutes)||offsetsMinutes.length<2||offsetsMinutes.length>7||!offsetsMinutes.includes(0)||new Set(offsetsMinutes).size!==offsetsMinutes.length||offsetsMinutes.some(x=>!Number.isFinite(x)||Math.abs(x)>60))throw Error('Choose 2–7 distinct offsets within ±60 minutes, including zero');
 const assigned=project.observations.flatMap((o,index)=>o.scenario===study.target&&['calibration','challenge'].includes(o.use)?[index]:[]);
 if(!assigned.length)return {status:'need-assigned-readings',offsets:[]};
 const work=project.width*project.height*Math.ceil(project.weather.durationMinutes/project.weather.stepMinutes)*study.ratesMmHr.length*offsetsMinutes.length;
 if(work>4_000_000)throw Error('Clock comparison exceeds the 4 million cell-step budget; reduce grid, candidate or offset count');
 const offsets=offsetsMinutes.map(offsetMinutes=>{
  const outside=assigned.filter(i=>project.observations[i].minute+offsetMinutes<0||project.observations[i].minute+offsetMinutes>project.weather.durationMinutes);
  if(outside.length)return {offsetMinutes,status:'outside-modeled-window',outsideReadingIndices:outside,comparison:null};
  const shifted=structuredClone(project);
  for(const i of assigned)shifted.observations[i].minute+=offsetMinutes;
  return {offsetMinutes,status:'compared',outsideReadingIndices:[],comparison:compareInfiltration(shifted,study)};
 });
 return {status:'compared',offsets,shiftedReadingIndices:assigned,
  semantics:'Model sampling minute = recorded minute + common offset. Calibration and held-aside depth readings receive the same offset. No source reading, rank or event clock is adopted or changed. These are explicit timing hypotheses, not confidence limits.'};
}
