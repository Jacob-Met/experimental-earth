import {comparePlacements,comparePlacementsWithFixedSupport,validatePlacementQuery,placementSignature,PLACEMENT_WORK_LIMIT,estimatePlacementWork} from './placement-search.js';

/** Same layouts, objectives and original supported hypotheses; only step changes. */
export function comparePlacementResolution(project,input) {
 const query=validatePlacementQuery(project,input),baseStepMinutes=project.weather.stepMinutes;
 const stepsMinutes=[...new Set([baseStepMinutes,Math.max(1,baseStepMinutes/2),Math.max(1,baseStepMinutes/4)])];
 // The same shared estimate covers model runs plus optional exposure segments.
 const workDetail=estimatePlacementWork(project,query,stepsMinutes),{variantCount,estimatedCellSteps}=workDetail;
 const context={query,sourceSignature:placementSignature(project),baseStepMinutes,stepsMinutes,variantCount,estimatedCellSteps,workDetail,maxCellSteps:PLACEMENT_WORK_LIMIT};
 const refuse=status=>({...context,status,runs:[],plans:[]});
 if(stepsMinutes.length<2)return refuse('minimum-step');
 if(estimatedCellSteps>PLACEMENT_WORK_LIMIT)return refuse('work-limit');
 const baseline=comparePlacements(project,query);
 if(baseline.status!=='compared')return {...refuse(baseline.status),baseline};
 const reports=stepsMinutes.map((step,i)=>i===0?baseline:comparePlacementsWithFixedSupport(project,query,baseline,step));
 const key=cells=>cells.join(',');
 const support=report=>report.query.receivingStudy?{hypothesisIds:[...report.hypothesisIds]}:{ratesMmHr:[...report.ratesMmHr]};
 const runs=reports.map((report,i)=>({stepMinutes:stepsMinutes[i],...support(report),best:report.best,qualifyingCount:report.qualifyingCount,plans:report.plans}));
 const plans=baseline.plans.map(plan=>{
  const atSteps=runs.map(run=>{const p=run.plans.find(p=>key(p.cells)===key(plan.cells));
   return {stepMinutes:run.stepMinutes,score:p.score,meets:p.meetsAllTargets,checks:p.localTargets.checks,durationChecks:p.durationTargets.checks,isBest:run.best.some(c=>key(c)===key(plan.cells))};});
  return {cells:plan.cells,atSteps,qualificationChanged:atSteps.some(x=>x.meets!==atSteps[0].meets),bestChanged:atSteps.some(x=>x.isBest!==atSteps[0].isBest)};
 });
 const bestKey=best=>JSON.stringify(best.map(key).sort());
 return {...context,status:'compared',...support(baseline),sourceSupport:{subset:query.subset,sourceSignature:baseline.sourceSignature,stepMinutes:baseStepMinutes},runs,plans,
  qualificationChanged:plans.some(p=>p.qualificationChanged),bestChanged:runs.some(r=>bestKey(r.best)!==bestKey(runs[0].best)),
  semantics:'Original source-supported hypotheses are fixed at every tested calculation interval; finer calculations do not refit or reclassify evidence. Changes show numerical sensitivity, not convergence, physical accuracy or a new calibration. No project, target or calculation setting is adopted.'};
}
