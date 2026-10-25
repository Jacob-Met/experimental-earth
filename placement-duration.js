import {validateExposureRequest} from './ponding-exposure-request.js';

export function validateDurationGoal(project,goal) {
 if(goal==null)return null;
 if(typeof goal!=='object'||Array.isArray(goal)||Object.keys(goal).some(k=>!['cellIndices','thresholdMm','maxAdditionalMinutes','basis'].includes(k)))throw Error('Invalid within-window duration goal');
 const exposure=validateExposureRequest(project.proposal.length,{cellIndices:goal.cellIndices,thresholdMm:goal.thresholdMm});
 if(!Number.isFinite(goal.maxAdditionalMinutes)||Math.abs(goal.maxAdditionalMinutes)>project.weather.durationMinutes)throw Error('Duration-change limit must lie within the declared event duration');
 if(typeof goal.basis!=='string'||!goal.basis.trim()||goal.basis.length>500)throw Error('Declare a duration threshold/goal basis of at most 500 characters');
 return {...exposure,maxAdditionalMinutes:goal.maxAdditionalMinutes,basis:goal.basis.trim()};
}
export function assessDurationGoal(candidates,goal) {
 if(!goal)return {meets:true,checks:[]};
 if(!candidates.length)throw Error('Duration goals require retained hypotheses');
 const checks=goal.cellIndices.map(cellIndex=>{
  const witnesses=candidates.map(candidate=>{
   const current=candidate.exposure?.current.find(x=>x.cellIndex===cellIndex),proposed=candidate.exposure?.proposed.find(x=>x.cellIndex===cellIndex);
   if(!current||!proposed||!Number.isFinite(current.minutesAbove)||!Number.isFinite(proposed.minutesAbove))throw Error('Missing maintained exposure for a retained hypothesis');
   const minutesChange=proposed.minutesAbove-current.minutesAbove;
   return {rateMmHr:candidate.rateMmHr,current,proposed,minutesChange,excessMinutes:minutesChange-goal.maxAdditionalMinutes,meets:minutesChange<=goal.maxAdditionalMinutes};
  });
  return {cellIndex,thresholdMm:goal.thresholdMm,maxAdditionalMinutes:goal.maxAdditionalMinutes,basis:goal.basis,worstChangeMinutes:Math.max(...witnesses.map(w=>w.minutesChange)),meets:witnesses.every(w=>w.meets),witnesses};
 });
 return {meets:checks.every(c=>c.meets),checks};
}
