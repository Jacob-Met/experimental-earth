import {comparePlacements,comparePlacementsWithFixedSupport,validatePlacementQuery,placementSignature,PLACEMENT_WORK_LIMIT} from './placement-search.js';

/** Same layouts, objectives and original supported hypotheses; only step changes. */
export function comparePlacementResolution(project,input) {
 const query=validatePlacementQuery(project,input),baseStepMinutes=project.weather.stepMinutes;
 const stepsMinutes=[...new Set([baseStepMinutes,Math.max(1,baseStepMinutes/2),Math.max(1,baseStepMinutes/4)])];
 const n=query.eligibleCells.length,variantCount=1+n+(query.maxEdits===2?n*(n-1)/2:0);
 // Count the full declared population at every resolution, before any run.
 // This also covers evaluation of the source evidence at the original step.
 const estimatedCellSteps=variantCount*query.study.ratesMmHr.length*3*project.width*project.height*
   stepsMinutes.reduce((sum,step)=>sum+Math.ceil(project.weather.durationMinutes/step),0);
 const context={query,sourceSignature:placementSignature(project),baseStepMinutes,stepsMinutes,variantCount,estimatedCellSteps,maxCellSteps:PLACEMENT_WORK_LIMIT};
 const refuse=status=>({...context,status,runs:[],plans:[]});
 if(stepsMinutes.length<2)return refuse('minimum-step');
 if(estimatedCellSteps>PLACEMENT_WORK_LIMIT)return refuse('work-limit');
 const baseline=comparePlacements(project,query);
 if(baseline.status!=='compared')return {...refuse(baseline.status),baseline};
 const reports=stepsMinutes.map((step,i)=>i===0?baseline:comparePlacementsWithFixedSupport(project,query,baseline,step));
 const key=cells=>cells.join(',');
 const runs=reports.map((report,i)=>({stepMinutes:stepsMinutes[i],ratesMmHr:report.ratesMmHr,best:report.best,qualifyingCount:report.qualifyingCount,plans:report.plans}));
 const plans=baseline.plans.map(plan=>{
  const atSteps=runs.map(run=>{const p=run.plans.find(p=>key(p.cells)===key(plan.cells));
   return {stepMinutes:run.stepMinutes,score:p.score,meets:p.localTargets.meets,checks:p.localTargets.checks,isBest:run.best.some(c=>key(c)===key(plan.cells))};});
  return {cells:plan.cells,atSteps,qualificationChanged:atSteps.some(x=>x.meets!==atSteps[0].meets),bestChanged:atSteps.some(x=>x.isBest!==atSteps[0].isBest)};
 });
 const bestKey=best=>JSON.stringify(best.map(key).sort());
 return {...context,status:'compared',ratesMmHr:[...baseline.ratesMmHr],sourceSupport:{subset:query.subset,sourceSignature:baseline.sourceSignature,stepMinutes:baseStepMinutes},runs,plans,
  qualificationChanged:plans.some(p=>p.qualificationChanged),bestChanged:runs.some(r=>bestKey(r.best)!==bestKey(runs[0].best)),
  semantics:'Original source-supported hypotheses are fixed at every tested calculation interval; finer calculations do not refit or reclassify evidence. Changes show numerical sensitivity, not convergence, physical accuracy or a new calibration. No project, target or calculation setting is adopted.'};
}
